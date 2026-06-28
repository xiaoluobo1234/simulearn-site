#!/usr/bin/env python3
"""SimuLearn PDF book ingestion worker.

R2 is the durable source of truth. Redis is used only for a namespaced lock and
short-lived status cache; it never writes to Dify/Celery queues.
"""

from __future__ import annotations

import hashlib
import json
import logging
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
import time
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import boto3
import redis
import requests
from botocore.client import BaseClient
from markdown_it import MarkdownIt
from pypdf import PdfReader

LOG = logging.getLogger("simulearn.books")
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)

JOB_PREFIX = "book-jobs/"
BOOK_PREFIX = "books/"
ALLOWED_DATASETS = {"structural", "thermal", "fluids", "multiphysics", "chip"}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
TERMINAL_STATES = {"done", "failed"}
PROCESS_STATES = {"queued"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def env_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value <= 0:
        raise RuntimeError(f"{name} must be positive")
    return value


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"missing environment variable: {name}")
    return value


@dataclass
class Settings:
    bucket: str
    poll_seconds: int
    max_bytes: int
    max_pages: int
    mineru_mode: str
    mineru_api_url: str
    mineru_api_token: str
    mineru_cli: str
    summary_api_url: str
    summary_api_key: str
    summary_model: str
    dify_api_url: str
    dify_api_key: str
    dataset_ids: dict[str, str]

    @classmethod
    def load(cls) -> "Settings":
        dataset_ids = json.loads(required("DIFY_DATASETS_JSON"))
        if not isinstance(dataset_ids, dict):
            raise RuntimeError("DIFY_DATASETS_JSON must be an object")
        mode = os.getenv("MINERU_MODE", "api").strip().lower()
        if mode not in {"api", "cli"}:
            raise RuntimeError("MINERU_MODE must be api or cli")
        return cls(
            bucket=required("R2_BUCKET"),
            poll_seconds=env_int("BOOK_POLL_SECONDS", 10),
            max_bytes=env_int("BOOK_MAX_MB", 50) * 1024 * 1024,
            max_pages=env_int("BOOK_MAX_PAGES", 200),
            mineru_mode=mode,
            mineru_api_url=os.getenv("MINERU_API_URL", "").rstrip("/"),
            mineru_api_token=os.getenv("MINERU_API_TOKEN", ""),
            mineru_cli=os.getenv("MINERU_CLI", "mineru"),
            summary_api_url=os.getenv("SUMMARY_API_URL", "").rstrip("/"),
            summary_api_key=os.getenv("SUMMARY_API_KEY", ""),
            summary_model=os.getenv("SUMMARY_MODEL", "deepseek-chat"),
            dify_api_url=os.getenv("DIFY_API_URL", "https://ai.simulearn.cn").rstrip("/"),
            dify_api_key=required("DIFY_DATASET_API_KEY"),
            dataset_ids={str(k): str(v) for k, v in dataset_ids.items()},
        )


def make_s3() -> BaseClient:
    return boto3.client(
        "s3",
        endpoint_url=required("R2_ENDPOINT"),
        aws_access_key_id=required("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=required("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
    )


def make_redis() -> redis.Redis:
    return redis.Redis.from_url(
        os.getenv("REDIS_URL", "redis://redis:6379/15"),
        decode_responses=True,
        socket_connect_timeout=3,
    )


class BookWorker:
    def __init__(self, settings: Settings, s3: BaseClient, cache: redis.Redis):
        self.settings = settings
        self.s3 = s3
        self.cache = cache

    def read_json(self, key: str) -> dict[str, Any]:
        body = self.s3.get_object(Bucket=self.settings.bucket, Key=key)["Body"].read()
        return json.loads(body.decode("utf-8"))

    def write_json(self, key: str, value: Any, cache_control: str = "no-store") -> None:
        self.s3.put_object(
            Bucket=self.settings.bucket,
            Key=key,
            Body=json.dumps(value, ensure_ascii=False, indent=2).encode("utf-8"),
            ContentType="application/json; charset=utf-8",
            CacheControl=cache_control,
        )

    def update_job(
        self,
        key: str,
        job: dict[str, Any],
        *,
        status: str | None = None,
        progress: int | None = None,
        stage: str | None = None,
        error: str | None = None,
    ) -> None:
        if status is not None:
            job["status"] = status
        if progress is not None:
            job["progress"] = progress
        if stage is not None:
            job["stage"] = stage
        if error is not None:
            job["error"] = error[:4000]
        job["updatedAt"] = now()
        job.setdefault("log", []).append(f"{job['updatedAt']} {stage or status or 'updated'}")
        job["log"] = job["log"][-100:]
        self.write_json(key, job)
        try:
            self.cache.setex(
                f"simulearn:books:status:{job['id']}",
                86400,
                json.dumps(
                    {
                        "status": job["status"],
                        "progress": job["progress"],
                        "stage": job["stage"],
                        "updatedAt": job["updatedAt"],
                    },
                    ensure_ascii=False,
                ),
            )
        except redis.RedisError as exc:
            LOG.warning("Redis status cache unavailable: %s", exc)

    def list_job_keys(self) -> list[str]:
        paginator = self.s3.get_paginator("list_objects_v2")
        keys: list[str] = []
        for page in paginator.paginate(Bucket=self.settings.bucket, Prefix=JOB_PREFIX):
            keys.extend(
                item["Key"]
                for item in page.get("Contents", [])
                if item["Key"].endswith("/job.json")
            )
        return keys

    def run_once(self) -> None:
        for key in self.list_job_keys():
            try:
                job = self.read_json(key)
            except Exception:
                LOG.exception("Cannot read %s", key)
                continue
            if job.get("status") == "uploaded":
                self.extract_metadata(key, job)
            elif job.get("status") in PROCESS_STATES:
                self.process_with_lock(key, job)

    def extract_metadata(self, key: str, job: dict[str, Any]) -> None:
        self.update_job(key, job, status="metadata", progress=7, stage="正在读取 PDF 元数据和页数")
        with tempfile.TemporaryDirectory(prefix="simulearn-meta-") as temp:
            pdf_path = Path(temp) / "source.pdf"
            self.s3.download_file(
                self.settings.bucket,
                f"{JOB_PREFIX}{job['id']}/source.pdf",
                str(pdf_path),
            )
            try:
                metadata, pages = inspect_pdf(pdf_path, self.settings)
            except Exception as exc:
                self.update_job(key, job, status="failed", progress=7, stage="PDF 预检失败", error=str(exc))
                return
            current = job.setdefault("metadata", {})
            for field, value in metadata.items():
                if value and not current.get(field):
                    current[field] = value
            current["pageCount"] = pages
            self.update_job(
                key,
                job,
                status="awaiting_confirmation",
                progress=10,
                stage="元数据已提取，等待管理员确认",
            )

    def process_with_lock(self, key: str, job: dict[str, Any]) -> None:
        lock = self.cache.lock(
            f"simulearn:books:lock:{job['id']}",
            timeout=6 * 60 * 60,
            blocking_timeout=0,
        )
        try:
            acquired = lock.acquire(blocking=False)
        except redis.RedisError as exc:
            LOG.error("Redis lock unavailable; refusing duplicate-prone processing: %s", exc)
            return
        if not acquired:
            return
        try:
            self.process(key, job)
        except Exception as exc:
            LOG.exception("Book job %s failed", job.get("id"))
            self.update_job(key, job, status="failed", stage="处理失败", error=f"{type(exc).__name__}: {exc}")
        finally:
            try:
                lock.release()
            except redis.RedisError:
                pass

    def process(self, key: str, job: dict[str, Any]) -> None:
        validate_job(job)
        with tempfile.TemporaryDirectory(prefix=f"simulearn-{job['id'][:8]}-") as temp:
            work = Path(temp)
            source = work / "source.pdf"
            output = work / "mineru-output"
            self.s3.download_file(
                self.settings.bucket,
                f"{JOB_PREFIX}{job['id']}/source.pdf",
                str(source),
            )
            metadata, pages = inspect_pdf(source, self.settings)
            job.setdefault("metadata", {})["pageCount"] = pages
            for field, value in metadata.items():
                if value and not job["metadata"].get(field):
                    job["metadata"][field] = value
            self.update_job(key, job, status="processing", progress=20, stage="MinerU 正在解析 PDF")
            parse_mineru(source, output, self.settings)
            markdown_path = find_markdown(output)
            original_markdown = markdown_path.read_text(encoding="utf-8")
            if not original_markdown.strip():
                raise RuntimeError("MinerU produced empty Markdown")

            slug = job["slug"]
            old_document_ids: list[str] = []
            old_target_dataset = job["targetDataset"]
            old_meta_key = f"{BOOK_PREFIX}{slug}/meta.json"
            if self.object_exists(old_meta_key):
                if not job.get("overwrite"):
                    raise RuntimeError("slug already exists; enable overwrite to replace it")
                old_meta = self.read_json(old_meta_key)
                old_document_ids = [str(value) for value in old_meta.get("difyDocumentIds", [])]
                old_target_dataset = str(old_meta.get("targetDataset") or old_target_dataset)
            self.s3.put_object(
                Bucket=self.settings.bucket,
                Key=f"{BOOK_PREFIX}{slug}/versions/{job['id']}/source.md",
                Body=original_markdown.encode("utf-8"),
                ContentType="text/markdown; charset=utf-8",
                CacheControl="public, max-age=60",
            )
            web_markdown = self.upload_assets_and_rewrite(markdown_path, original_markdown, slug, job["id"])
            toc, chapters = split_and_render(web_markdown)

            self.update_job(key, job, status="summarizing", progress=55, stage="生成独立导读和章节摘要")
            guide, summaries = summarize_book(job["metadata"], chapters, self.settings)
            for chapter in chapters:
                chapter["summary"] = summaries.get(chapter["id"], "")

            self.update_job(key, job, status="indexing", progress=70, stage="按章节写入 Dify 知识库")
            document_ids = self.index_dify(job, chapters, old_document_ids, old_target_dataset)

            self.update_job(key, job, status="publishing", progress=88, stage="生成阅读数据和书库索引")
            book_id = hashlib.sha256(slug.encode("utf-8")).hexdigest()[:16]
            published_at = now()
            meta = {
                **job["metadata"],
                "id": book_id,
                "slug": slug,
                "targetDataset": job["targetDataset"],
                "chapterCount": len(chapters),
                "guide": guide,
                "updatedAt": published_at,
                "sourceFilename": job["filename"],
                "bodyPolicy": "mineru-original-no-llm-rewrite",
                "difyDocumentIds": document_ids,
            }
            book = {"meta": meta, "toc": toc, "chapters": chapters}
            self.write_json(f"{BOOK_PREFIX}{slug}/book.json", book, "public, max-age=60")
            self.write_json(f"{BOOK_PREFIX}{slug}/meta.json", meta, "public, max-age=60")
            self.write_json(f"{BOOK_PREFIX}{slug}/toc.json", toc, "public, max-age=60")
            self.write_json(f"{BOOK_PREFIX}{slug}/chapters.json", chapters, "public, max-age=60")
            self.update_catalog(meta, toc)
            self.cleanup_old_versions(slug, job["id"])

            job["result"] = {
                "slug": slug,
                "url": f"/books/{slug}/",
                "bookId": book_id,
            }
            self.update_job(key, job, status="done", progress=100, stage="已完成")

    def upload_assets_and_rewrite(self, markdown_path: Path, markdown: str, slug: str, version: str) -> str:
        root = markdown_path.parent
        replacements: dict[str, str] = {}
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
                continue
            relative = path.relative_to(root).as_posix()
            safe_name = re.sub(r"[^A-Za-z0-9._/-]+", "-", relative).lstrip("/")
            versioned_name = f"{version}/{safe_name}"
            key = f"{BOOK_PREFIX}{slug}/assets/{versioned_name}"
            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            self.s3.upload_file(
                str(path),
                self.settings.bucket,
                key,
                ExtraArgs={"ContentType": content_type, "CacheControl": "public, max-age=31536000, immutable"},
            )
            replacements[relative] = f"/api/books/{slug}/asset/{versioned_name}"
            replacements[f"./{relative}"] = f"/api/books/{slug}/asset/{versioned_name}"
        # The immutable source.md above remains byte-for-byte MinerU output. Only
        # this display copy changes local image URLs to stable R2 proxy URLs.
        def replace_image(match: re.Match[str]) -> str:
            target = match.group(2).split(" ", 1)[0].strip("<>")
            replacement = replacements.get(target)
            return f"{match.group(1)}{replacement}{match.group(3)}" if replacement else match.group(0)

        return re.sub(r"(!\[[^\]]*\]\()([^)]+)(\))", replace_image, markdown)

    def index_dify(
        self,
        job: dict[str, Any],
        chapters: list[dict[str, Any]],
        old_document_ids: list[str],
        old_target_dataset: str,
    ) -> list[str]:
        dataset_id = self.settings.dataset_ids.get(job["targetDataset"])
        if not dataset_id:
            raise RuntimeError(f"dataset id missing for {job['targetDataset']}")
        # Old document IDs are stored in the current book metadata and deleted
        # only after the administrator explicitly selected overwrite.
        ids: list[str] = []
        batches: list[str] = []
        metadata_operations: list[dict[str, Any]] = []
        title = job["metadata"]["title"]
        metadata_fields = self.ensure_dify_metadata_fields(dataset_id)
        try:
            for index, chapter in enumerate(chapters, start=1):
                marker = (
                    f"[BookID:{job['slug']}]\n"
                    f"[ChapterID:{chapter['id']}]\n"
                    f"[Citation:《{title}》{chapter['title']}]\n\n"
                )
                source_text = chapter.pop("markdown", "")
                text = marker + source_text
                response = requests.post(
                    f"{self.settings.dify_api_url}/v1/datasets/{dataset_id}/document/create-by-text",
                    headers={
                        "Authorization": f"Bearer {self.settings.dify_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "name": f"《{title}》{chapter['title']} [{chapter['id']}]",
                        "text": text,
                        "indexing_technique": "high_quality",
                        "process_rule": {"mode": "automatic"},
                    },
                    timeout=120,
                )
                if not response.ok:
                    raise RuntimeError(f"Dify create document failed: HTTP {response.status_code} {response.text[:500]}")
                data = response.json()
                document_id = (data.get("document") or {}).get("id")
                batch = data.get("batch")
                if document_id:
                    ids.append(document_id)
                    metadata_operations.append({
                        "document_id": document_id,
                        "metadata_list": [
                            {"id": metadata_fields["book_id"], "name": "book_id", "value": job["slug"]},
                            {"id": metadata_fields["chapter_id"], "name": "chapter_id", "value": chapter["id"]},
                            {
                                "id": metadata_fields["citation"],
                                "name": "citation",
                                "value": f"《{title}》{chapter['title']}",
                            },
                        ],
                        "partial_update": True,
                    })
                if batch:
                    batches.append(str(batch))
                LOG.info("Indexed chapter %d/%d", index, len(chapters))
            self.assign_dify_metadata(dataset_id, metadata_operations)
            self.wait_for_dify_indexing(dataset_id, batches)
        except Exception:
            for document_id in ids:
                try:
                    self.dify_delete(dataset_id, document_id)
                except Exception:
                    pass
            raise
        old_dataset_id = self.settings.dataset_ids.get(old_target_dataset, dataset_id)
        for document_id in old_document_ids:
            try:
                self.dify_delete(old_dataset_id, document_id)
            except Exception as exc:
                LOG.warning("Could not delete old Dify document %s: %s", document_id, exc)
        return ids

    def wait_for_dify_indexing(self, dataset_id: str, batches: list[str]) -> None:
        deadline = time.monotonic() + 30 * 60
        pending = set(batches)
        headers = {"Authorization": f"Bearer {self.settings.dify_api_key}"}
        while pending:
            if time.monotonic() >= deadline:
                raise RuntimeError(f"Dify indexing timed out for {len(pending)} chapter(s)")
            for batch in list(pending):
                response = requests.get(
                    f"{self.settings.dify_api_url}/v1/datasets/{dataset_id}/documents/{batch}/indexing-status",
                    headers=headers,
                    timeout=60,
                )
                if not response.ok:
                    raise RuntimeError(
                        f"Dify indexing status failed: HTTP {response.status_code} {response.text[:500]}"
                    )
                entries = response.json().get("data", [])
                statuses = {str(item.get("indexing_status")) for item in entries}
                if "error" in statuses:
                    errors = "; ".join(str(item.get("error") or "unknown") for item in entries)
                    raise RuntimeError(f"Dify indexing failed: {errors[:1000]}")
                if entries and statuses == {"completed"}:
                    pending.remove(batch)
            if pending:
                time.sleep(3)

    def ensure_dify_metadata_fields(self, dataset_id: str) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {self.settings.dify_api_key}"}
        response = requests.get(
            f"{self.settings.dify_api_url}/v1/datasets/{dataset_id}/metadata",
            headers=headers,
            timeout=60,
        )
        if not response.ok:
            raise RuntimeError(f"Dify list metadata failed: HTTP {response.status_code} {response.text[:500]}")
        existing = {
            str(item.get("name")): str(item.get("id"))
            for item in response.json().get("doc_metadata", [])
            if item.get("name") and item.get("id")
        }
        for name in ["book_id", "chapter_id", "citation"]:
            if name in existing:
                continue
            created = requests.post(
                f"{self.settings.dify_api_url}/v1/datasets/{dataset_id}/metadata",
                headers={**headers, "Content-Type": "application/json"},
                json={"name": name, "type": "string"},
                timeout=60,
            )
            if not created.ok:
                raise RuntimeError(f"Dify create metadata {name} failed: HTTP {created.status_code} {created.text[:500]}")
            existing[name] = str(created.json()["id"])
        return {name: existing[name] for name in ["book_id", "chapter_id", "citation"]}

    def assign_dify_metadata(self, dataset_id: str, operations: list[dict[str, Any]]) -> None:
        if not operations:
            raise RuntimeError("Dify returned no document IDs")
        response = requests.post(
            f"{self.settings.dify_api_url}/v1/datasets/{dataset_id}/documents/metadata",
            headers={
                "Authorization": f"Bearer {self.settings.dify_api_key}",
                "Content-Type": "application/json",
            },
            json={"operation_data": operations},
            timeout=120,
        )
        if not response.ok:
            raise RuntimeError(f"Dify assign metadata failed: HTTP {response.status_code} {response.text[:500]}")

    def dify_delete(self, dataset_id: str, document_id: str) -> None:
        response = requests.delete(
            f"{self.settings.dify_api_url}/v1/datasets/{dataset_id}/documents/{document_id}",
            headers={"Authorization": f"Bearer {self.settings.dify_api_key}"},
            timeout=60,
        )
        if response.status_code not in {200, 204, 404}:
            raise RuntimeError(f"Dify delete failed: HTTP {response.status_code}")

    def object_exists(self, key: str) -> bool:
        try:
            self.s3.head_object(Bucket=self.settings.bucket, Key=key)
            return True
        except Exception:
            return False

    def delete_prefix(self, prefix: str) -> None:
        paginator = self.s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.settings.bucket, Prefix=prefix):
            keys = [{"Key": item["Key"]} for item in page.get("Contents", [])]
            if keys:
                self.s3.delete_objects(Bucket=self.settings.bucket, Delete={"Objects": keys, "Quiet": True})

    def cleanup_old_versions(self, slug: str, current_version: str) -> None:
        for prefix in [f"{BOOK_PREFIX}{slug}/assets/", f"{BOOK_PREFIX}{slug}/versions/"]:
            paginator = self.s3.get_paginator("list_objects_v2")
            stale: list[dict[str, str]] = []
            keep_prefix = f"{prefix}{current_version}/"
            for page in paginator.paginate(Bucket=self.settings.bucket, Prefix=prefix):
                stale.extend(
                    {"Key": item["Key"]}
                    for item in page.get("Contents", [])
                    if not item["Key"].startswith(keep_prefix)
                )
                while len(stale) >= 1000:
                    batch, stale = stale[:1000], stale[1000:]
                    self.s3.delete_objects(Bucket=self.settings.bucket, Delete={"Objects": batch, "Quiet": True})
            if stale:
                self.s3.delete_objects(Bucket=self.settings.bucket, Delete={"Objects": stale, "Quiet": True})

    def update_catalog(self, meta: dict[str, Any], toc: list[dict[str, Any]]) -> None:
        try:
            catalog = self.read_json(f"{BOOK_PREFIX}catalog.json")
            if not isinstance(catalog, list):
                catalog = []
        except Exception:
            catalog = []
        item = {
            key: meta.get(key)
            for key in [
                "id", "slug", "title", "author", "publisher", "year", "description",
                "isbn", "pageCount", "coverUrl", "targetDataset", "chapterCount", "updatedAt", "guide",
            ]
        }
        item["toc"] = [{"id": node["id"], "title": node["title"], "level": node["level"]} for node in toc]
        catalog = [entry for entry in catalog if entry.get("slug") != meta["slug"]]
        catalog.append(item)
        catalog.sort(key=lambda entry: str(entry.get("updatedAt", "")), reverse=True)
        self.write_json(f"{BOOK_PREFIX}catalog.json", catalog, "public, max-age=60")


def validate_job(job: dict[str, Any]) -> None:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", str(job.get("slug", ""))):
        raise RuntimeError("invalid slug")
    if job.get("targetDataset") not in ALLOWED_DATASETS:
        raise RuntimeError("invalid target dataset")
    if not str(job.get("metadata", {}).get("title", "")).strip():
        raise RuntimeError("title is required")


def inspect_pdf(path: Path, settings: Settings) -> tuple[dict[str, str], int]:
    if path.stat().st_size > settings.max_bytes:
        raise RuntimeError(f"PDF exceeds {settings.max_bytes // 1048576} MB")
    with path.open("rb") as handle:
        if handle.read(5) != b"%PDF-":
            raise RuntimeError("file signature is not PDF")
    reader = PdfReader(str(path))
    pages = len(reader.pages)
    if pages <= 0:
        raise RuntimeError("PDF has no pages")
    if pages > settings.max_pages:
        raise RuntimeError(f"PDF has {pages} pages; limit is {settings.max_pages}")
    raw = reader.metadata or {}

    def value(key: str) -> str:
        text = str(raw.get(key, "") or "").strip()
        return "" if text.lower() == "none" else text[:500]

    year_match = re.search(r"(19|20)\d{2}", value("/CreationDate"))
    metadata = {
        "title": value("/Title"),
        "author": value("/Author"),
        "publisher": value("/Producer"),
        "year": year_match.group(0) if year_match else "",
    }
    if not all([metadata["title"], metadata["author"], metadata["publisher"], metadata["year"]]):
        try:
            first_pages = "\n".join((page.extract_text() or "") for page in reader.pages[:2])
            lines = [
                re.sub(r"\s+", " ", line).strip()
                for line in first_pages.splitlines()
                if 2 < len(re.sub(r"\s+", " ", line).strip()) < 160
            ]
            if not metadata["title"]:
                candidates = [
                    line for line in lines[:30]
                    if not re.fullmatch(r"\d+", line)
                    and not re.search(r"版权|copyright|isbn|出版|目录", line, re.I)
                ]
                if candidates:
                    metadata["title"] = max(candidates[:8], key=len)[:200]
            if not metadata["author"]:
                author_line = next(
                    (line for line in lines[:50] if re.search(r"(作者|主编|编著|著|author)", line, re.I)),
                    "",
                )
                metadata["author"] = author_line[:200]
            if not metadata["publisher"]:
                publisher_line = next(
                    (line for line in lines[:80] if re.search(r"(出版社|university press|publishing)", line, re.I)),
                    "",
                )
                metadata["publisher"] = publisher_line[:200]
            if not metadata["year"]:
                page_year = re.search(r"(19|20)\d{2}", first_pages)
                metadata["year"] = page_year.group(0) if page_year else ""
        except Exception as exc:
            LOG.warning("Title-page metadata heuristic failed: %s", exc)
    return metadata, pages


def parse_mineru(source: Path, output: Path, settings: Settings) -> None:
    output.mkdir(parents=True, exist_ok=True)
    if settings.mineru_mode == "cli":
        command = [settings.mineru_cli, "-p", str(source), "-o", str(output)]
        subprocess.run(command, check=True, timeout=6 * 60 * 60)
        return
    if not settings.mineru_api_url:
        raise RuntimeError("MINERU_API_URL is required when MINERU_MODE=api")
    headers = {"Authorization": f"Bearer {settings.mineru_api_token}"} if settings.mineru_api_token else {}
    with source.open("rb") as handle:
        response = requests.post(
            f"{settings.mineru_api_url}/file_parse",
            headers=headers,
            files={"files": (source.name, handle, "application/pdf")},
            data={
                "return_md": "true",
                "response_format_zip": "true",
                "return_original_file": "false",
            },
            timeout=(30, 6 * 60 * 60),
        )
    if not response.ok:
        raise RuntimeError(f"MinerU API failed: HTTP {response.status_code} {response.text[:500]}")
    content_type = response.headers.get("Content-Type", "")
    archive = output / "result.zip"
    if "zip" in content_type or response.content[:2] == b"PK":
        archive.write_bytes(response.content)
        with zipfile.ZipFile(archive) as zipped:
            zipped.extractall(output)
        archive.unlink()
        return
    data = response.json()
    markdown = data.get("md_content") or data.get("markdown")
    if not markdown and isinstance(data.get("results"), list) and data["results"]:
        markdown = data["results"][0].get("md_content") or data["results"][0].get("markdown")
    if not markdown:
        raise RuntimeError("MinerU API response contains no ZIP or Markdown")
    (output / "document.md").write_text(str(markdown), encoding="utf-8")


def find_markdown(output: Path) -> Path:
    candidates = [path for path in output.rglob("*.md") if path.is_file()]
    if not candidates:
        raise RuntimeError("MinerU output has no Markdown file")
    return max(candidates, key=lambda path: path.stat().st_size)


def split_and_render(markdown: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    heading = re.compile(r"^(#{1,6})[ \t]+(.+?)\s*$", re.MULTILINE)
    matches = list(heading.finditer(markdown))
    if not matches:
        toc = [{"id": "book", "title": "全文", "level": 1}]
        raw_parts = [("book", "全文", 1, 0, len(markdown))]
        heading_infos: list[dict[str, Any]] = []
    else:
        seen: dict[str, int] = {}
        heading_infos = []
        for index, match in enumerate(matches):
            title = re.sub(r"\s+#+\s*$", "", match.group(2)).strip()
            base = slugify_heading(title) or f"chapter-{index + 1}"
            count = seen.get(base, 0) + 1
            seen[base] = count
            heading_infos.append({
                "id": base if count == 1 else f"{base}-{count}",
                "title": title,
                "level": len(match.group(1)),
                "start": match.start(),
            })
        toc = [{"id": item["id"], "title": item["title"], "level": item["level"]} for item in heading_infos]
        level_counts = {
            level: sum(1 for item in heading_infos if item["level"] == level)
            for level in range(1, 7)
        }
        boundary_level = next(
            (level for level in range(1, 7) if level_counts[level] >= 2),
            min(item["level"] for item in heading_infos),
        )
        boundaries = [item for item in heading_infos if item["level"] == boundary_level]
        raw_parts: list[tuple[str, str, int, int, int]] = []
        if boundaries[0]["start"] > 0 and markdown[:boundaries[0]["start"]].strip():
            raw_parts.append(("front-matter", "书前内容", 1, 0, boundaries[0]["start"]))
        for index, item in enumerate(boundaries):
            end = boundaries[index + 1]["start"] if index + 1 < len(boundaries) else len(markdown)
            raw_parts.append((item["id"], item["title"], item["level"], item["start"], end))
    renderer = MarkdownIt("commonmark", {"html": True, "linkify": True, "typographer": False})
    chapters: list[dict[str, Any]] = []
    for chapter_id, title, level, start, end in raw_parts:
        source = markdown[start:end]
        display_source = source
        local_headings = [item for item in heading_infos if start <= item["start"] < end]
        for item in reversed(local_headings):
            offset = item["start"] - start
            if item["id"] == chapter_id and offset == 0:
                continue
            display_source = (
                display_source[:offset]
                + f'<span id="{item["id"]}" class="book-anchor"></span>\n'
                + display_source[offset:]
            )
        chapters.append({
            "id": chapter_id,
            "title": title,
            "level": level,
            "html": renderer.render(display_source),
            "markdown": source,
            "summary": "",
        })
    return toc, chapters


def slugify_heading(title: str) -> str:
    ascii_part = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    if ascii_part:
        return ascii_part[:70]
    return "section-" + hashlib.sha1(title.encode("utf-8")).hexdigest()[:10]


def summarize_book(
    metadata: dict[str, Any],
    chapters: list[dict[str, Any]],
    settings: Settings,
) -> tuple[str, dict[str, str]]:
    if not settings.summary_api_url or not settings.summary_api_key:
        LOG.warning("Summary API not configured; guide and summaries are left empty")
        return "", {}
    summaries: dict[str, str] = {}
    for chapter in chapters:
        source = chapter["markdown"]
        prompt = (
            "你只生成本章的学习摘要，不得重写、修正或补充原文，不得改变公式编号和章节标题。"
            "摘要必须与原文明确分离，控制在200字以内。\n\n"
            f"书名：{metadata['title']}\n章节：{chapter['title']}\n原文：\n{source[:16000]}"
        )
        summaries[chapter["id"]] = call_summary(prompt, settings)
    guide_prompt = (
        "为工程仿真书籍生成一段不超过500字的学习导读。只介绍结构、适合读者和阅读顺序；"
        "不得改写正文，不得虚构书中结论，并明确导读不属于原书正文。\n\n"
        f"书名：{metadata['title']}\n作者：{metadata.get('author', '')}\n"
        "章节目录与摘要：\n"
        + "\n".join(f"- {chapter['title']}：{summaries.get(chapter['id'], '')}" for chapter in chapters)
    )
    return call_summary(guide_prompt, settings), summaries


def call_summary(prompt: str, settings: Settings) -> str:
    response = requests.post(
        f"{settings.summary_api_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.summary_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.summary_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
        },
        timeout=180,
    )
    if not response.ok:
        raise RuntimeError(f"summary API failed: HTTP {response.status_code} {response.text[:500]}")
    return str(response.json()["choices"][0]["message"]["content"]).strip()


def main() -> None:
    settings = Settings.load()
    worker = BookWorker(settings, make_s3(), make_redis())
    LOG.info("Book worker started (MinerU mode=%s)", settings.mineru_mode)
    while True:
        try:
            worker.run_once()
        except Exception:
            LOG.exception("Polling cycle failed")
        time.sleep(settings.poll_seconds)


if __name__ == "__main__":
    main()
