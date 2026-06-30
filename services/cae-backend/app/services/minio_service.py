"""Storage service with MinIO + local-filesystem fallback.

When MinIO is unavailable (e.g., local dev without Docker), automatically
falls back to local disk storage under /tmp/simulearn-storage/.
"""

import json
from io import BytesIO
from pathlib import Path
from typing import Optional

from minio import Minio

from app.core.config import get_settings
from app.models.simulation import SimulationTask

settings = get_settings()

_client: Optional[Minio] = None
_minio_available: Optional[bool] = None

# Local fallback directory
LOCAL_STORAGE = Path("/tmp/simulearn-storage")
LOCAL_STORAGE.mkdir(parents=True, exist_ok=True)


def _get_client() -> Optional[Minio]:
    """Get MinIO client with short timeout. Returns None if unavailable."""
    global _client, _minio_available
    if _minio_available is False:
        return None
    if _client is None:
        import urllib3
        http_client = urllib3.PoolManager(
            timeout=urllib3.Timeout(connect=2.0, read=5.0),
            retries=urllib3.Retry(0, redirect=False),
        )
        _client = Minio(
            endpoint=settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
            http_client=http_client,
        )
    return _client


async def ensure_bucket():
    """Ensure the storage bucket/directory exists."""
    global _client, _minio_available

    client = _get_client()
    if client:
        try:
            found = client.bucket_exists(settings.minio_bucket)
            if not found:
                client.make_bucket(settings.minio_bucket)
            print(f"✅ MinIO bucket ready: {settings.minio_bucket}")
            _minio_available = True
            return
        except Exception as e:
            print(f"⚠️ MinIO unavailable, using local storage: {e}")
            _client = None
            _minio_available = False

    # Local fallback
    (LOCAL_STORAGE / settings.minio_bucket).mkdir(parents=True, exist_ok=True)
    print(f"✅ Local storage ready: {LOCAL_STORAGE / settings.minio_bucket}")


def _local_path(object_key: str) -> Path:
    return LOCAL_STORAGE / settings.minio_bucket / object_key


async def upload_file(object_key: str, data: bytes, content_type: str = "application/octet-stream"):
    """Upload a file (MinIO with auto-fallback to local)."""
    global _client, _minio_available

    client = _get_client()
    if client:
        try:
            client.put_object(
                bucket_name=settings.minio_bucket,
                object_name=object_key,
                data=BytesIO(data),
                length=len(data),
                content_type=content_type,
            )
            _minio_available = True
            return
        except Exception as e:
            print(f"⚠️ MinIO upload failed → local fallback: {e}")
            _client = None
            _minio_available = False

    path = _local_path(object_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


async def get_file_stream(object_key: str):
    """Get file stream from storage."""
    client = _get_client()
    if client:
        try:
            return client.get_object(settings.minio_bucket, object_key)
        except Exception:
            pass

    path = _local_path(object_key)
    if path.exists():
        return BytesIO(path.read_bytes())
    return None


async def get_file_bytes(object_key: str) -> Optional[bytes]:
    """Get file bytes from storage."""
    global _client, _minio_available

    client = _get_client()
    if client:
        try:
            response = client.get_object(settings.minio_bucket, object_key)
            return response.read()
        except Exception:
            _client = None
            _minio_available = False

    path = _local_path(object_key)
    if path.exists():
        return path.read_bytes()
    return None


# ---- Task metadata ----

TASK_PREFIX = "tasks"


async def store_task(task: SimulationTask):
    key = f"{TASK_PREFIX}/{task.task_id}.json"
    data = task.model_dump_json(indent=2).encode()
    await upload_file(key, data, "application/json")


async def get_task(task_id: str) -> Optional[SimulationTask]:
    data = await get_file_bytes(f"{TASK_PREFIX}/{task_id}.json")
    if data is None:
        return None
    return SimulationTask(**json.loads(data))
