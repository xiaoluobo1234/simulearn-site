import { ApiError } from './dify';
import type { BooksBucket, R2ObjectBody } from './books';
import {
  STUDY_KINDS, LEARNING_STATUS_LABELS, REVIEW_STATUS_LABELS, VISIBILITY_LABELS,
  type StudyItem, type StudyKind,
} from '../../src/data/study-schema';

type ConditionalOptions = {
  onlyIf: { etagMatches?: string; etagDoesNotMatch?: string };
  httpMetadata: { contentType: string; cacheControl: string };
};
/** R2 supports conditional writes; the shared legacy BooksBucket type omits them. */
type StudyBucket = Omit<BooksBucket, 'put' | 'get'> & {
  get(key: string): Promise<(R2ObjectBody & { etag?: string }) | null>;
  put(key: string, value: string, options: ConditionalOptions): Promise<unknown | null>;
};
interface Head { item: StudyItem; historyKey: string; deleted?: boolean }
interface Snapshot { item: StudyItem; previousKey?: string }
interface LoadedHead { head: Head; etag: string }
const ID_PATTERN = /^(record|source|note)-[a-f0-9-]{36}$/;
const OWNER_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;
const MAX_FIELDS = 48;
const MAX_FIELD_LENGTH = 32_000;
const MAX_REFERENCES = 40;
const MAX_REVISIONS = 1_000;
const metadata = { contentType: 'application/json; charset=utf-8', cacheControl: 'private, no-store' };

function ownerPrefix(owner: string): string {
  if (!OWNER_PATTERN.test(owner)) throw new ApiError('用户标识无效。', 400);
  return `study/v1/${owner}/`;
}
function itemKey(owner: string, id: string): string {
  if (!ID_PATTERN.test(id)) throw new ApiError('记录标识无效。', 400);
  return `${ownerPrefix(owner)}items/${id}.json`;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('记录必须是 JSON 对象。', 400);
  return value as Record<string, unknown>;
}
function enumeration<T extends string>(value: unknown, labels: Record<T, unknown>, fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !Object.hasOwn(labels, value)) throw new ApiError('记录状态无效。', 400);
  return value as T;
}
function references(value: unknown, kind: StudyKind): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_REFERENCES || value.some((id) => typeof id !== 'string' || !ID_PATTERN.test(id) || !id.startsWith(`${kind}-`))) {
    throw new ApiError(`关联${kind === 'source' ? '资料' : '笔记'}无效（最多 ${MAX_REFERENCES} 项）。`, 400);
  }
  return [...new Set(value as string[])];
}
export function validateStudyItem(input: unknown, previous?: StudyItem): StudyItem {
  const data = object(input);
  if (typeof data.kind !== 'string' || !STUDY_KINDS.includes(data.kind as StudyKind)) throw new ApiError('记录类型无效。', 400);
  if (previous && data.kind !== previous.kind) throw new ApiError('已保存记录不能更改类型。', 400);
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200) throw new ApiError('请填写 200 字以内的标题。', 400);
  const rawFields = data.fields === undefined ? {} : object(data.fields);
  const keys = Object.keys(rawFields);
  if (keys.length > MAX_FIELDS) throw new ApiError(`记录最多包含 ${MAX_FIELDS} 个字段。`, 400);
  const fields: Record<string, string> = {};
  for (const key of keys) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || ['constructor', 'prototype', '__proto__'].includes(key)) throw new ApiError('字段名称无效。', 400);
    if (typeof rawFields[key] !== 'string' || (rawFields[key] as string).length > MAX_FIELD_LENGTH) throw new ApiError(`字段内容必须是 ${MAX_FIELD_LENGTH} 字以内的文本。`, 400);
    fields[key] = rawFields[key] as string;
  }
  const now = new Date().toISOString();
  return {
    id: previous?.id || `${data.kind}-${crypto.randomUUID()}`,
    kind: data.kind as StudyKind,
    title: data.title.trim(), fields,
    sourceIds: references(data.sourceIds, 'source'), noteIds: references(data.noteIds, 'note'),
    learningStatus: enumeration(data.learningStatus, LEARNING_STATUS_LABELS, 'not-started'),
    reviewStatus: enumeration(data.reviewStatus, REVIEW_STATUS_LABELS, 'draft'),
    visibility: enumeration(data.visibility, VISIBILITY_LABELS, 'private'),
    revision: previous ? previous.revision + 1 : 1,
    createdAt: previous?.createdAt || now, updatedAt: now,
  };
}

/** Head and snapshots are private R2 objects. Only a committed head defines history. */
export class StudyStore {
  private bucket: StudyBucket;
  constructor(bucket: BooksBucket) { this.bucket = bucket as unknown as StudyBucket; }

  private async load(owner: string, id: string): Promise<LoadedHead> {
    const stored = await this.bucket.get(itemKey(owner, id));
    if (!stored) throw new ApiError('记录不存在。', 404);
    const head = await stored.json<Head>();
    if (head.deleted) throw new ApiError('记录不存在。', 404);
    if (!stored.etag) throw new ApiError('存储不支持安全版本写入，请联系管理员。', 503);
    return { head, etag: stored.etag };
  }

  async get(owner: string, id: string): Promise<StudyItem> { return (await this.load(owner, id)).head.item; }

  async list(owner: string, kind?: string, cursor?: string): Promise<{ items: StudyItem[]; cursor?: string }> {
    if (kind && !STUDY_KINDS.includes(kind as StudyKind)) throw new ApiError('记录类型无效。', 400);
    if (cursor && cursor.length > 2_048) throw new ApiError('分页游标无效。', 400);
    const prefix = `${ownerPrefix(owner)}items/${kind ? `${kind}-` : ''}`;
    const page = await this.bucket.list({ prefix, limit: 200, cursor });
    // R2 list contains only keys. Read bounded batches rather than all records at once.
    const items: StudyItem[] = [];
    for (let offset = 0; offset < page.objects.length; offset += 20) {
      const batch = await Promise.all(page.objects.slice(offset, offset + 20).map(async ({ key }) => {
        const stored = await this.bucket.get(key);
        return stored ? stored.json<Head>() : null;
      }));
      for (const head of batch) if (head && !head.deleted) items.push(head.item);
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { items, ...(page.truncated && page.cursor ? { cursor: page.cursor } : {}) };
  }

  private async validateLinks(owner: string, item: StudyItem): Promise<void> {
    for (const id of [...item.sourceIds, ...item.noteIds]) {
      if (id === item.id) throw new ApiError('记录不能关联自身。', 400);
      try { await this.get(owner, id); }
      catch (error) {
        if (error instanceof ApiError && error.status === 404) throw new ApiError('关联的资料或笔记不存在于你的资料库。', 400);
        throw error;
      }
    }
  }

  private assertPublication(item: StudyItem, confirmed: unknown): void {
    if (item.visibility !== 'public') return;
    if (item.reviewStatus !== 'reviewed' || confirmed !== true || !item.fields.publicBody?.trim()) {
      throw new ApiError('公开前请核对内容、填写独立公开稿并明确确认公开。', 400);
    }
  }

  private async commit(owner: string, item: StudyItem, previous?: LoadedHead): Promise<void> {
    const historyKey = `${ownerPrefix(owner)}history/${item.id}/${String(item.revision).padStart(6, '0')}-${crypto.randomUUID()}.json`;
    const snapshot: Snapshot = { item, ...(previous ? { previousKey: previous.head.historyKey } : {}) };
    const written = await this.bucket.put(historyKey, JSON.stringify(snapshot), {
      httpMetadata: metadata, onlyIf: { etagDoesNotMatch: '*' },
    });
    if (written === null) throw new ApiError('版本保存冲突，请重试。', 409);
    // The head is the single commit point, so a failed CAS can never leak into history.
    const result = await this.bucket.put(itemKey(owner, item.id), JSON.stringify({ item, historyKey } satisfies Head), {
      httpMetadata: metadata,
      onlyIf: previous ? { etagMatches: previous.etag } : { etagDoesNotMatch: '*' },
    });
    if (result === null) {
      await this.bucket.delete(historyKey).catch(() => {});
      throw new ApiError('记录已在其他页面更新。请先读取最新版本，再合并你的修改。', 409);
    }
  }

  async create(owner: string, input: unknown, publicConfirmed?: unknown): Promise<StudyItem> {
    const item = validateStudyItem(input);
    this.assertPublication(item, publicConfirmed);
    await this.validateLinks(owner, item);
    await this.commit(owner, item);
    return item;
  }

  async update(owner: string, id: string, revision: unknown, input: unknown, publicConfirmed?: unknown): Promise<StudyItem> {
    const previous = await this.load(owner, id);
    if (!Number.isSafeInteger(revision) || revision !== previous.head.item.revision) throw new ApiError('记录版本已变化，请读取最新版本并合并修改。', 409);
    if (previous.head.item.revision >= MAX_REVISIONS) throw new ApiError('本条记录已达到 1000 个版本，请导出后新建续篇。', 409);
    const item = validateStudyItem(input, previous.head.item);
    this.assertPublication(item, publicConfirmed);
    await this.validateLinks(owner, item);
    await this.commit(owner, item, previous);
    return item;
  }

  async history(owner: string, id: string): Promise<StudyItem[]> {
    const { head } = await this.load(owner, id);
    const versions: StudyItem[] = [];
    let key: string | undefined = head.historyKey;
    while (key && versions.length < MAX_REVISIONS) {
      if (!key.startsWith(`${ownerPrefix(owner)}history/${id}/`)) throw new ApiError('版本链无效。', 500);
      const stored = await this.bucket.get(key);
      if (!stored) throw new ApiError('版本记录暂时不可用。', 503);
      const snapshot: Snapshot = await stored.json<Snapshot>();
      versions.push(snapshot.item);
      key = snapshot.previousKey;
    }
    return versions;
  }

  async remove(owner: string, id: string, revision: unknown): Promise<void> {
    const previous = await this.load(owner, id);
    if (!Number.isSafeInteger(revision) || revision !== previous.head.item.revision) throw new ApiError('记录版本已变化，请刷新后再删除。', 409);
    // Revoke access atomically before deleting private snapshots. Keep a tiny tombstone
    // so an in-flight writer with the old ETag cannot restore a deleted public item.
    const result = await this.bucket.put(itemKey(owner, id), JSON.stringify({ deleted: true }), {
      onlyIf: { etagMatches: previous.etag }, httpMetadata: metadata,
    });
    if (result === null) throw new ApiError('记录已变化，请刷新后再删除。', 409);
    let cursor: string | undefined;
    do {
      const page = await this.bucket.list({ prefix: `${ownerPrefix(owner)}history/${id}/`, limit: 1_000, cursor });
      if (page.objects.length) await this.bucket.delete(page.objects.map(({ key }) => key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
}
