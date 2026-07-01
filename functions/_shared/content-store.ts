import { ApiError, json } from './dify';
import type { BooksBucket } from './books';

// ── Content override types ──

export interface ContentOverride {
  /** Knowledge point slug, e.g. "intro-to-python" */
  slug: string;
  /** Domain, e.g. "tools" */
  domain: string;
  /** Overridden title (optional, keep original if empty) */
  title?: string;
  /** Overridden description (optional) */
  description?: string;
  /** Overridden markdown body (optional) */
  aiContent?: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** ISO timestamp of creation */
  createdAt: string;
}

export interface ContentOverrideSummary {
  slug: string;
  domain: string;
  title: string;
  updatedAt: string;
}

export interface ContentEnv {
  BOOKS?: BooksBucket;
}

// ── Helpers ──

function requireBucket(env: ContentEnv): BooksBucket {
  if (!env.BOOKS) {
    throw new ApiError('内容存储尚未配置。请添加名为 BOOKS 的 R2 绑定。', 503);
  }
  return env.BOOKS;
}

function overrideKey(domain: string, slug: string): string {
  return `content/${domain}/${slug}.json`;
}

function overridePrefix(domain: string): string {
  return `content/${domain}/`;
}

// ── CRUD operations ──

/** Get a single content override. Returns null if none exists. */
export async function getOverride(
  env: ContentEnv,
  domain: string,
  slug: string,
): Promise<ContentOverride | null> {
  const bucket = requireBucket(env);
  const key = overrideKey(domain, slug);
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return await object.json<ContentOverride>();
  } catch {
    throw new ApiError('内容覆盖文件损坏。', 500);
  }
}

/** Save (create or update) a content override. */
export async function putOverride(
  env: ContentEnv,
  domain: string,
  slug: string,
  fields: { title?: string; description?: string; aiContent?: string },
): Promise<ContentOverride> {
  const bucket = requireBucket(env);
  const key = overrideKey(domain, slug);
  const now = new Date().toISOString();

  // Read existing if present
  let existing: ContentOverride | null = null;
  const object = await bucket.get(key);
  if (object) {
    try {
      existing = await object.json<ContentOverride>();
    } catch {
      // Treat corrupt file as non-existent
    }
  }

  const override: ContentOverride = {
    slug,
    domain,
    title: fields.title !== undefined ? fields.title : existing?.title,
    description: fields.description !== undefined ? fields.description : existing?.description,
    aiContent: fields.aiContent !== undefined ? fields.aiContent : existing?.aiContent,
    updatedAt: now,
    createdAt: existing?.createdAt || now,
  };

  await bucket.put(key, JSON.stringify(override), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });

  return override;
}

/** Delete a content override. Succeeds silently if it doesn't exist. */
export async function deleteOverride(
  env: ContentEnv,
  domain: string,
  slug: string,
): Promise<void> {
  const bucket = requireBucket(env);
  const key = overrideKey(domain, slug);
  await bucket.delete(key);
}

/** List all content overrides for a domain. */
export async function listOverrides(
  env: ContentEnv,
  domain: string,
): Promise<ContentOverrideSummary[]> {
  const bucket = requireBucket(env);
  const prefix = overridePrefix(domain);
  const result = await bucket.list({ prefix, limit: 500 });

  const summaries: ContentOverrideSummary[] = [];
  for (const obj of result.objects) {
    // Extract slug from key: content/{domain}/{slug}.json
    const slugMatch = obj.key.match(/^content\/[a-z]+\/(.+)\.json$/);
    if (!slugMatch) continue;
    try {
      const item = await bucket.get(obj.key);
      if (!item) continue;
      const override = await item.json<ContentOverride>();
      summaries.push({
        slug: override.slug,
        domain: override.domain,
        title: override.title || override.slug,
        updatedAt: override.updatedAt,
      });
    } catch {
      // Skip unreadable items
    }
  }

  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return summaries;
}

/** Get all override keys for all domains — used to inject into build-time catalog. */
export async function listAllOverrideSlugs(
  env: ContentEnv,
): Promise<Array<{ domain: string; slug: string }>> {
  const bucket = requireBucket(env);
  const result = await bucket.list({ prefix: 'content/', limit: 1000 });

  const entries: Array<{ domain: string; slug: string }> = [];
  for (const obj of result.objects) {
    const match = obj.key.match(/^content\/([a-z]+)\/(.+)\.json$/);
    if (match) {
      entries.push({ domain: match[1], slug: match[2] });
    }
  }
  return entries;
}
