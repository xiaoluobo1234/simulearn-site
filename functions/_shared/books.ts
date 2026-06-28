import { ApiError, assertSameOrigin, json, readJson } from './dify';

export type BookJobStatus =
  | 'uploading'
  | 'uploaded'
  | 'metadata'
  | 'awaiting_confirmation'
  | 'queued'
  | 'processing'
  | 'summarizing'
  | 'publishing'
  | 'indexing'
  | 'done'
  | 'failed';

export interface R2ObjectBody {
  body: ReadableStream;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}

export interface R2ListResult {
  objects: Array<{ key: string; size: number; uploaded: Date }>;
  truncated: boolean;
  cursor?: string;
}

export interface BooksBucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string }; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<R2ListResult>;
}

export interface BookMetadata {
  title: string;
  author: string;
  publisher: string;
  year: string;
  description: string;
  isbn?: string;
  pageCount?: number;
  coverUrl?: string;
}

export interface BookJob {
  id: string;
  filename: string;
  size: number;
  status: BookJobStatus;
  progress: number;
  stage: string;
  createdAt: string;
  updatedAt: string;
  metadata: BookMetadata;
  slug?: string;
  targetDataset?: string;
  overwrite?: boolean;
  error?: string;
  log?: string[];
  result?: { slug: string; url: string; bookId: string };
}

export interface BookCatalogItem extends BookMetadata {
  id: string;
  slug: string;
  targetDataset: string;
  chapterCount: number;
  toc: Array<{ id: string; title: string; level: number }>;
  updatedAt: string;
  guide?: string;
}

export interface BooksEnv {
  BOOKS?: BooksBucket;
  BOOK_MAX_MB?: string;
  BOOK_MAX_PAGES?: string;
}

const PUBLIC_DATASETS = new Set(['structural', 'thermal', 'fluids', 'multiphysics', 'chip']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function requireBooksBucket(env: BooksEnv): BooksBucket {
  if (!env.BOOKS) {
    throw new ApiError('书籍存储尚未配置。请先创建 R2 存储桶并添加 BOOKS 绑定。', 503);
  }
  return env.BOOKS;
}

export function maxBookBytes(env: BooksEnv): number {
  const value = Number(env.BOOK_MAX_MB || 50);
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    throw new ApiError('BOOK_MAX_MB 配置无效。', 500);
  }
  return value * 1024 * 1024;
}

function cleanFilename(value: unknown): string {
  const filename = String(value || '').trim().replace(/[\\/]/g, '-');
  if (!filename.toLowerCase().endsWith('.pdf')) throw new ApiError('只允许上传 PDF 文件。', 415);
  if (filename.length < 5 || filename.length > 180) throw new ApiError('PDF 文件名长度无效。', 400);
  return filename;
}

function emptyMetadata(filename: string): BookMetadata {
  return {
    title: filename.replace(/\.pdf$/i, ''),
    author: '',
    publisher: '',
    year: '',
    description: '',
  };
}

async function readJob(bucket: BooksBucket, id: string): Promise<BookJob> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new ApiError('任务 ID 无效。', 400);
  const object = await bucket.get(`book-jobs/${id}/job.json`);
  if (!object) throw new ApiError('任务不存在。', 404);
  return object.json<BookJob>();
}

async function writeJob(bucket: BooksBucket, job: BookJob): Promise<void> {
  job.updatedAt = new Date().toISOString();
  await bucket.put(`book-jobs/${job.id}/job.json`, JSON.stringify(job, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
}

export async function createBookJob(context: { request: Request; env: BooksEnv }): Promise<Response> {
  try {
    assertSameOrigin(context.request);
    const bucket = requireBooksBucket(context.env);
    const body = await readJson<{ filename?: string; size?: number }>(context.request);
    const filename = cleanFilename(body.filename);
    const size = Number(body.size);
    if (!Number.isInteger(size) || size <= 0) throw new ApiError('PDF 文件大小无效。', 400);
    if (size > maxBookBytes(context.env)) {
      throw new ApiError(`PDF 不能超过 ${Number(context.env.BOOK_MAX_MB || 50)} MB。`, 413);
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const job: BookJob = {
      id,
      filename,
      size,
      status: 'uploading',
      progress: 0,
      stage: '等待上传 PDF',
      createdAt: now,
      updatedAt: now,
      metadata: emptyMetadata(filename),
      log: [`${now} 创建任务`],
    };
    await writeJob(bucket, job);
    return json({ ok: true, job, uploadUrl: `/api/ai/books/jobs/${id}/file` }, 201);
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    console.error(error);
    return json({ ok: false, error: '创建书籍任务失败。' }, 500);
  }
}

export async function uploadBookFile(
  context: { request: Request; env: BooksEnv },
  id: string,
): Promise<Response> {
  try {
    assertSameOrigin(context.request);
    const bucket = requireBooksBucket(context.env);
    const job = await readJob(bucket, id);
    if (job.status !== 'uploading') throw new ApiError('当前任务不能重复上传文件。', 409);
    const length = Number(context.request.headers.get('Content-Length') || 0);
    if (length <= 0) throw new ApiError('未收到 PDF 文件内容。', 400);
    if (length !== job.size) throw new ApiError('上传大小与创建任务时不一致。', 400);
    if (length > maxBookBytes(context.env)) throw new ApiError('PDF 超过大小上限。', 413);
    const contentType = context.request.headers.get('Content-Type') || '';
    if (!contentType.includes('application/pdf')) throw new ApiError('Content-Type 必须是 application/pdf。', 415);
    if (!context.request.body) throw new ApiError('PDF 请求体为空。', 400);

    await bucket.put(`book-jobs/${id}/source.pdf`, context.request.body, {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' },
      customMetadata: { filename: job.filename, jobId: job.id },
    });
    job.status = 'uploaded';
    job.progress = 5;
    job.stage = '等待提取书籍元数据';
    job.log?.push(`${new Date().toISOString()} PDF 上传完成`);
    await writeJob(bucket, job);
    return json({ ok: true, job });
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    console.error(error);
    return json({ ok: false, error: '上传 PDF 失败。' }, 500);
  }
}

export async function updateBookJob(
  context: { request: Request; env: BooksEnv },
  id: string,
): Promise<Response> {
  try {
    assertSameOrigin(context.request);
    const bucket = requireBooksBucket(context.env);
    const job = await readJob(bucket, id);
    if (!['uploaded', 'awaiting_confirmation', 'failed'].includes(job.status)) {
      throw new ApiError('任务当前状态不能提交或修改。', 409);
    }
    const body = await readJson<{
      metadata?: Partial<BookMetadata>;
      slug?: string;
      targetDataset?: string;
      overwrite?: boolean;
      retry?: boolean;
    }>(context.request);
    const metadata = { ...job.metadata, ...(body.metadata || {}) };
    metadata.title = String(metadata.title || '').trim();
    metadata.author = String(metadata.author || '').trim();
    metadata.publisher = String(metadata.publisher || '').trim();
    metadata.year = String(metadata.year || '').trim();
    metadata.description = String(metadata.description || '').trim();
    if (!metadata.title) throw new ApiError('书名不能为空。', 400);
    if (metadata.title.length > 200 || metadata.description.length > 2000) {
      throw new ApiError('书籍元数据过长。', 400);
    }
    const slug = String(body.slug || job.slug || '').trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug) || slug.length > 100) {
      throw new ApiError('URL 标识只能使用小写字母、数字和连字符。', 400);
    }
    const targetDataset = String(body.targetDataset || job.targetDataset || '');
    if (!PUBLIC_DATASETS.has(targetDataset)) throw new ApiError('请选择一个公开领域知识库。', 400);

    job.metadata = metadata;
    job.slug = slug;
    job.targetDataset = targetDataset;
    job.overwrite = Boolean(body.overwrite);
    job.error = undefined;
    job.status = 'queued';
    job.progress = 10;
    job.stage = '已确认，等待解析';
    job.log?.push(`${new Date().toISOString()} 管理员确认元数据并提交`);
    await writeJob(bucket, job);
    return json({ ok: true, job });
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    console.error(error);
    return json({ ok: false, error: '提交书籍任务失败。' }, 500);
  }
}

export async function getBookJob(context: { env: BooksEnv }, id: string): Promise<Response> {
  try {
    const job = await readJob(requireBooksBucket(context.env), id);
    return json({ ok: true, job });
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: '读取任务失败。' }, 500);
  }
}

export async function listBookJobs(context: { env: BooksEnv }): Promise<Response> {
  try {
    const bucket = requireBooksBucket(context.env);
    const listed = await bucket.list({ prefix: 'book-jobs/', limit: 500 });
    const keys = listed.objects
      .filter((item) => item.key.endsWith('/job.json'))
      .sort((left, right) => right.uploaded.getTime() - left.uploaded.getTime())
      .slice(0, 50);
    const jobs = (await Promise.all(keys.map(async ({ key }) => {
      const item = await bucket.get(key);
      return item ? item.json<BookJob>() : null;
    }))).filter(Boolean);
    return json({ ok: true, jobs });
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    console.error(error);
    return json({ ok: false, error: '读取任务列表失败。' }, 500);
  }
}

export async function listBooks(context: { env: BooksEnv }): Promise<Response> {
  try {
    const bucket = requireBooksBucket(context.env);
    const object = await bucket.get('books/catalog.json');
    const books = object ? await object.json<BookCatalogItem[]>() : [];
    return json({ ok: true, books });
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: '读取书库失败。' }, 500);
  }
}

export async function getBook(context: { env: BooksEnv }, slug: string): Promise<Response> {
  try {
    if (!SLUG_PATTERN.test(slug)) throw new ApiError('书籍 URL 无效。', 400);
    const object = await requireBooksBucket(context.env).get(`books/${slug}/book.json`);
    if (!object) throw new ApiError('书籍不存在。', 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: '读取书籍失败。' }, 500);
  }
}

export async function getBookAsset(
  context: { env: BooksEnv },
  slug: string,
  assetPath: string,
): Promise<Response> {
  try {
    if (!SLUG_PATTERN.test(slug) || assetPath.includes('..') || assetPath.startsWith('/')) {
      throw new ApiError('资源路径无效。', 400);
    }
    const object = await requireBooksBucket(context.env).get(`books/${slug}/assets/${assetPath}`);
    if (!object) throw new ApiError('资源不存在。', 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: '读取书籍资源失败。' }, 500);
  }
}
