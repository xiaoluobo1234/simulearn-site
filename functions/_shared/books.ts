import { ApiError, assertSameOrigin, json } from './dify';

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
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    },
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
  guide?: string;
}

export interface BookHeading {
  id: string;
  title: string;
  level: number;
}

export interface BookChapter extends BookHeading {
  markdown: string;
  headings: BookHeading[];
}

export interface BookCatalogItem extends BookMetadata {
  id: string;
  slug: string;
  targetDataset: string;
  chapterCount: number;
  toc: BookHeading[];
  updatedAt: string;
  sourceFormat: 'markdown' | 'json';
}

export interface BooksEnv {
  BOOKS?: BooksBucket;
  BOOK_IMPORT_MAX_MB?: string;
}

interface ParsedUpload {
  sourceFormat: 'markdown' | 'json';
  sourceText: string;
  markdown: string;
  metadata: Partial<BookMetadata>;
}

const PUBLIC_DATASETS = new Set(['structural', 'thermal', 'fluids', 'multiphysics', 'chip']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export function requireBooksBucket(env: BooksEnv): BooksBucket {
  if (!env.BOOKS) {
    throw new ApiError('书籍存储尚未配置。请添加名为 BOOKS 的 R2 绑定。', 503);
  }
  return env.BOOKS;
}

function maxImportBytes(env: BooksEnv): number {
  const value = Number(env.BOOK_IMPORT_MAX_MB || 50);
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    throw new ApiError('BOOK_IMPORT_MAX_MB 配置无效。', 500);
  }
  return value * 1024 * 1024;
}

function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function cleanMetadata(value: Partial<BookMetadata>): BookMetadata {
  const metadata: BookMetadata = {
    title: String(value.title || '').trim(),
    author: String(value.author || '').trim(),
    publisher: String(value.publisher || '').trim(),
    year: String(value.year || '').trim(),
    description: String(value.description || '').trim(),
    isbn: String(value.isbn || '').trim(),
    coverUrl: String(value.coverUrl || '').trim(),
    guide: String(value.guide || '').trim(),
  };
  const pageCount = Number(value.pageCount || 0);
  if (Number.isInteger(pageCount) && pageCount > 0) metadata.pageCount = pageCount;
  if (!metadata.title) throw new ApiError('书名不能为空。', 400);
  if (
    metadata.title.length > 200
    || metadata.author.length > 300
    || metadata.publisher.length > 300
    || metadata.description.length > 4000
    || (metadata.guide?.length || 0) > 12000
  ) {
    throw new ApiError('书籍元数据过长。', 400);
  }
  return metadata;
}

function parseJsonDocument(sourceText: string): ParsedUpload {
  let value: unknown;
  try {
    value = JSON.parse(sourceText);
  } catch {
    throw new ApiError('JSON 文件格式无效。', 400);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('JSON 顶层必须是对象。', 400);
  }
  const document = value as Record<string, unknown>;
  const metadataValue = document.meta || document.metadata || {};
  const metadata = metadataValue && typeof metadataValue === 'object' && !Array.isArray(metadataValue)
    ? metadataValue as Partial<BookMetadata>
    : {};
  if (typeof document.guide === 'string' && !metadata.guide) metadata.guide = document.guide;

  let markdown = typeof document.markdown === 'string'
    ? document.markdown
    : typeof document.content === 'string'
      ? document.content
      : '';
  if (!markdown && Array.isArray(document.chapters)) {
    markdown = document.chapters.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new ApiError(`JSON 第 ${index + 1} 章格式无效。`, 400);
      }
      const chapter = item as Record<string, unknown>;
      const content = typeof chapter.markdown === 'string'
        ? chapter.markdown
        : typeof chapter.content === 'string'
          ? chapter.content
          : '';
      if (!content.trim()) throw new ApiError(`JSON 第 ${index + 1} 章没有 Markdown 内容。`, 400);
      if (/^#{1,6}[ \t]+/m.test(content)) return content.trim();
      const title = String(chapter.title || `第 ${index + 1} 章`).trim();
      const level = Math.min(6, Math.max(1, Number(chapter.level) || 1));
      return `${'#'.repeat(level)} ${title}\n\n${content.trim()}`;
    }).join('\n\n');
  }
  if (!markdown.trim()) {
    throw new ApiError('JSON 必须包含 markdown、content 或 chapters。', 400);
  }
  return { sourceFormat: 'json', sourceText, markdown, metadata };
}

async function parseDocument(file: File): Promise<ParsedUpload> {
  const filename = file.name.toLowerCase();
  const sourceText = await file.text();
  if (!sourceText.trim()) throw new ApiError('上传文档为空。', 400);
  if (filename.endsWith('.json')) return parseJsonDocument(sourceText);
  if (!filename.endsWith('.md') && !filename.endsWith('.markdown')) {
    throw new ApiError('只允许上传 .md、.markdown 或 .json 文件。', 415);
  }
  return {
    sourceFormat: 'markdown',
    sourceText,
    markdown: sourceText,
    metadata: { title: file.name.replace(/\.(md|markdown)$/i, '') },
  };
}

function slugifyHeading(title: string, index: number): string {
  const ascii = title.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return ascii || `section-${index + 1}`;
}

function headingTitle(value: string): string {
  return value
    .replace(/\s+#+\s*$/, '')
    .replace(/!\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}

function splitIntoChapters(markdown: string): { toc: BookHeading[]; chapters: BookChapter[] } {
  const expression = /^(#{1,6})[ \t]+(.+?)\s*$/gm;
  const matches = Array.from(markdown.matchAll(expression));
  if (!matches.length) {
    return {
      toc: [{ id: 'book', title: '全文', level: 1 }],
      chapters: [{ id: 'book', title: '全文', level: 1, markdown, headings: [] }],
    };
  }

  const seen = new Map<string, number>();
  const headings = matches.map((match, index) => {
    const title = headingTitle(match[2]);
    const base = slugifyHeading(title, index);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return {
      id: count === 1 ? base : `${base}-${count}`,
      title,
      level: match[1].length,
      start: match.index || 0,
    };
  });
  const levelCounts = new Map<number, number>();
  headings.forEach((heading) => levelCounts.set(heading.level, (levelCounts.get(heading.level) || 0) + 1));
  const boundaryLevel = [1, 2, 3, 4, 5, 6].find((level) => (levelCounts.get(level) || 0) >= 2)
    || Math.min(...headings.map((heading) => heading.level));
  const boundaries = headings.filter((heading) => heading.level === boundaryLevel);
  const chapters: BookChapter[] = [];

  if (boundaries[0].start > 0 && markdown.slice(0, boundaries[0].start).trim()) {
    chapters.push({
      id: 'front-matter',
      title: '书前内容',
      level: 1,
      markdown: markdown.slice(0, boundaries[0].start),
      headings: [],
    });
  }
  boundaries.forEach((boundary, index) => {
    const end = boundaries[index + 1]?.start ?? markdown.length;
    chapters.push({
      id: boundary.id,
      title: boundary.title,
      level: boundary.level,
      markdown: markdown.slice(boundary.start, end),
      headings: headings
        .filter((heading) => heading.start >= boundary.start && heading.start < end)
        .map(({ id, title, level }) => ({ id, title, level })),
    });
  });
  return {
    toc: headings.map(({ id, title, level }) => ({ id, title, level })),
    chapters,
  };
}

function normalizeReference(value: string): string {
  let decoded = value.trim().replace(/^<|>$/g, '').replace(/\\/g, '/');
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the original reference if it is not valid percent encoding.
  }
  return decoded.replace(/^\.?\//, '');
}

function safeAssetPath(value: string, fallback: string): string {
  const normalized = normalizeReference(value || fallback);
  const segments = normalized.split('/').filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === '..')) {
    throw new ApiError('图片路径无效。', 400);
  }
  return segments
    .map((segment) => segment.normalize('NFKC').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'asset')
    .join('/');
}

function rewriteMarkdownImages(markdown: string, assets: Map<string, string>): string {
  return markdown.replace(/(!\[[^\]]*]\()([^)]+)(\))/g, (whole, open, rawTarget, close) => {
    const target = String(rawTarget).split(/\s+["'(]/, 1)[0].replace(/^<|>$/g, '');
    if (/^data:image\//i.test(target)) return whole;
    if (/^https?:/i.test(target)) {
      const replacement = assets.get(target);
      return replacement ? `${open}${replacement}${close}` : whole;
    }
    const normalized = normalizeReference(target);
    const replacement = assets.get(normalized) || assets.get(normalized.split('/').pop() || '');
    return replacement ? `${open}${replacement}${close}` : whole;
  });
}

async function downloadExternalImages(
  markdownText: string,
  bucket: BooksBucket,
  slug: string,
  version: string,
  maxBytes: number,
  usedBytes: number,
): Promise<{ map: Map<string, string>; downloaded: number; failed: number; totalBytes: number }> {
  const urlMap = new Map<string, string>();
  const externalUrls: string[] = [];
  const imgRegex = /!\[[^\]]*]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(markdownText)) !== null) {
    const target = match[1].split(/\s+["'(]/, 1)[0].replace(/^<|>$/g, '');
    if (/^https?:/i.test(target) && !externalUrls.includes(target)) externalUrls.push(target);
  }
  if (externalUrls.length > 500) {
    throw new ApiError('Markdown 中的外部图片超过 500 张上限。', 400);
  }
  let totalBytes = usedBytes;
  let downloaded = 0;
  let failed = 0;
  for (const [index, url] of externalUrls.entries()) {
    if (totalBytes >= maxBytes) { failed = externalUrls.length - index; break; }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'SimuLearn-BookImport/1.0' } });
      if (!response.ok) { failed++; continue; }
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.startsWith('image/')) { failed++; continue; }
      const buffer = await response.arrayBuffer();
      totalBytes += buffer.byteLength;
      if (totalBytes > maxBytes) { failed++; break; }
      const extension = IMAGE_TYPES.get(contentType) || '.jpg';
      const filename = `ext-${String(index + 1).padStart(3, '0')}${extension}`;
      await bucket.put(`books/${slug}/assets/${version}/${filename}`, buffer, {
        httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
      });
      urlMap.set(url, `/api/books/${slug}/asset/${version}/${filename}`);
      downloaded++;
    } catch {
      failed++;
    }
  }
  return { map: urlMap, downloaded, failed, totalBytes };
}

async function putJson(bucket: BooksBucket, key: string, value: unknown, cacheControl = 'no-store'): Promise<void> {
  await bucket.put(key, JSON.stringify(value, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl },
  });
}

async function updateCatalog(bucket: BooksBucket, item: BookCatalogItem): Promise<void> {
  const catalogObject = await bucket.get('books/catalog.json');
  const catalog = catalogObject ? await catalogObject.json<BookCatalogItem[]>() : [];
  const next = catalog.filter((book) => book.slug !== item.slug);
  next.push(item);
  next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  await putJson(bucket, 'books/catalog.json', next, 'public, max-age=60');
}

async function cleanupOldAssets(bucket: BooksBucket, slug: string, currentVersion: string): Promise<void> {
  const prefix = `books/${slug}/assets/`;
  let cursor: string | undefined;
  const stale: string[] = [];
  do {
    const listed = await bucket.list({ prefix, limit: 1000, cursor });
    stale.push(...listed.objects
      .map((item) => item.key)
      .filter((key) => !key.startsWith(`${prefix}${currentVersion}/`)));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  for (let index = 0; index < stale.length; index += 1000) {
    await bucket.delete(stale.slice(index, index + 1000));
  }
}

export async function importBook(context: { request: Request; env: BooksEnv }): Promise<Response> {
  try {
    assertSameOrigin(context.request);
    const bucket = requireBooksBucket(context.env);
    const contentLength = Number(context.request.headers.get('Content-Length') || 0);
    if (contentLength && contentLength > maxImportBytes(context.env)) {
      throw new ApiError(`上传内容不能超过 ${Number(context.env.BOOK_IMPORT_MAX_MB || 50)} MB。`, 413);
    }
    const form = await context.request.formData();
    const documentEntry = form.get('document');
    if (!(documentEntry instanceof File) || !documentEntry.size) {
      throw new ApiError('请选择 Markdown 或 JSON 文档。', 400);
    }
    const parsed = await parseDocument(documentEntry);
    const slug = formText(form, 'slug').toLowerCase();
    if (!SLUG_PATTERN.test(slug) || slug.length > 100) {
      throw new ApiError('URL 标识只能使用小写字母、数字和连字符。', 400);
    }
    const targetDataset = formText(form, 'targetDataset');
    if (!PUBLIC_DATASETS.has(targetDataset)) throw new ApiError('请选择书籍所属领域。', 400);
    const overwrite = formText(form, 'overwrite') === 'true';
    const oldBook = await bucket.get(`books/${slug}/book.json`);
    if (oldBook && !overwrite) throw new ApiError('该 URL 已存在，请勾选覆盖旧版本。', 409);

    const metadata = cleanMetadata({
      ...parsed.metadata,
      title: formText(form, 'title') || parsed.metadata.title,
      author: formText(form, 'author') || parsed.metadata.author,
      publisher: formText(form, 'publisher') || parsed.metadata.publisher,
      year: formText(form, 'year') || parsed.metadata.year,
      description: formText(form, 'description') || parsed.metadata.description,
      isbn: formText(form, 'isbn') || parsed.metadata.isbn,
      guide: formText(form, 'guide') || parsed.metadata.guide,
      pageCount: Number(formText(form, 'pageCount') || parsed.metadata.pageCount || 0),
      coverUrl: String(parsed.metadata.coverUrl || ''),
    });

    const assets = form.getAll('assets').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (assets.length > 500) throw new ApiError('单本书最多上传 500 张图片。', 400);
    const rawPaths = formText(form, 'assetPaths');
    let assetPaths: string[] = [];
    if (rawPaths) {
      try {
        const value = JSON.parse(rawPaths);
        if (Array.isArray(value)) assetPaths = value.map(String);
      } catch {
        throw new ApiError('图片路径清单无效。', 400);
      }
    }
    const totalBytes = documentEntry.size + assets.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > maxImportBytes(context.env)) {
      throw new ApiError(`文档和图片合计不能超过 ${Number(context.env.BOOK_IMPORT_MAX_MB || 50)} MB。`, 413);
    }

    const version = crypto.randomUUID();
    const assetMap = new Map<string, string>();
    for (const [index, file] of assets.entries()) {
      const filenameExtension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
      const extension = IMAGE_EXTENSIONS.has(filenameExtension)
        ? filenameExtension
        : IMAGE_TYPES.get(file.type) || '';
      if (!extension) throw new ApiError(`不支持图片格式：${file.name}`, 415);
      const contentType = IMAGE_TYPES.has(file.type)
        ? file.type
        : extension === '.png'
          ? 'image/png'
          : extension === '.webp'
            ? 'image/webp'
            : extension === '.gif'
              ? 'image/gif'
              : 'image/jpeg';
      const originalPath = normalizeReference(assetPaths[index] || file.name);
      let path = safeAssetPath(originalPath, `image-${index + 1}${extension}`);
      if (!path.toLowerCase().endsWith(extension)) path += extension;
      const publicUrl = `/api/books/${slug}/asset/${version}/${path}`;
      assetMap.set(originalPath, publicUrl);
      assetMap.set(file.name, publicUrl);
      assetMap.set(originalPath.split('/').pop() || file.name, publicUrl);
      await bucket.put(`books/${slug}/assets/${version}/${path}`, file, {
        httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
      });
    }

    const maxBytes = maxImportBytes(context.env);
    const usedBytes = documentEntry.size + assets.reduce((sum, file) => sum + file.size, 0);
    const externalResult = await downloadExternalImages(parsed.markdown, bucket, slug, version, maxBytes, usedBytes);
    externalResult.map.forEach((r2Url, originalUrl) => assetMap.set(originalUrl, r2Url));

    const markdown = rewriteMarkdownImages(parsed.markdown, assetMap);
    const { toc, chapters } = splitIntoChapters(markdown);
    const updatedAt = new Date().toISOString();
    const id = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(slug))
      .then((buffer) => Array.from(new Uint8Array(buffer).slice(0, 8), (byte) => byte.toString(16).padStart(2, '0')).join(''));
    if (metadata.coverUrl) {
      metadata.coverUrl = assetMap.get(normalizeReference(metadata.coverUrl)) || metadata.coverUrl;
    }
    const catalogItem: BookCatalogItem = {
      ...metadata,
      id,
      slug,
      targetDataset,
      chapterCount: chapters.length,
      toc,
      updatedAt,
      sourceFormat: parsed.sourceFormat,
    };
    const book = {
      meta: {
        ...catalogItem,
        bodyPolicy: 'administrator-reviewed-manual-import',
        sourceFilename: documentEntry.name,
      },
      toc,
      chapters,
    };

    const sourceExtension = parsed.sourceFormat === 'json' ? 'json' : 'md';
    await bucket.put(`books/${slug}/versions/${version}/source.${sourceExtension}`, parsed.sourceText, {
      httpMetadata: {
        contentType: parsed.sourceFormat === 'json'
          ? 'application/json; charset=utf-8'
          : 'text/markdown; charset=utf-8',
        cacheControl: 'private, no-store',
      },
    });
    await putJson(bucket, `books/${slug}/book.json`, book, 'public, max-age=60');
    await putJson(bucket, `books/${slug}/meta.json`, book.meta, 'public, max-age=60');
    await putJson(bucket, `books/${slug}/toc.json`, toc, 'public, max-age=60');
    await putJson(bucket, `books/${slug}/chapters.json`, chapters, 'public, max-age=60');
    await updateCatalog(bucket, catalogItem);
    await cleanupOldAssets(bucket, slug, version);

    const warnings: string[] = [];
    if (externalResult.failed > 0) {
      warnings.push(`外部图片：成功下载 ${externalResult.downloaded} 张，${externalResult.failed} 张下载失败。`);
    }
    if (!assets.length && !externalResult.downloaded) {
      warnings.push('未上传本地图片；请确认 Markdown 中的图片使用可访问的 HTTPS 地址。');
    }

    return json({
      ok: true,
      book: catalogItem,
      url: `/books/${slug}/`,
      warnings,
    }, 201);
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    console.error(error);
    return json({ ok: false, error: '发布书籍失败。' }, 500);
  }
}

export async function listBooks(context: { env: BooksEnv }): Promise<Response> {
  try {
    const object = await requireBooksBucket(context.env).get('books/catalog.json');
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

export interface BookRequest {
  id: string;
  title: string;
  author: string;
  notes: string;
  contact: string;
  createdAt: string;
  status: 'pending' | 'fulfilled';
}

export async function deleteBook(context: { env: BooksEnv }, slug: string): Promise<Response> {
  try {
    if (!SLUG_PATTERN.test(slug)) throw new ApiError('书籍 URL 无效。', 400);
    const bucket = requireBooksBucket(context.env);

    const bookObject = await bucket.get(`books/${slug}/book.json`);
    if (!bookObject) throw new ApiError('书籍不存在。', 404);

    let cursor: string | undefined;
    let deletedCount = 0;
    do {
      const listed = await bucket.list({ prefix: `books/${slug}/`, limit: 1000, cursor });
      if (listed.objects.length > 0) {
        await bucket.delete(listed.objects.map((item) => item.key));
        deletedCount += listed.objects.length;
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    const catalogObject = await bucket.get('books/catalog.json');
    const catalog = catalogObject ? await catalogObject.json<BookCatalogItem[]>() : [];
    const updatedCatalog = catalog.filter((item) => item.slug !== slug);
    await putJson(bucket, 'books/catalog.json', updatedCatalog, 'public, max-age=60');

    return json({ ok: true, slug, deletedCount });
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    console.error(error);
    return json({ ok: false, error: '删除书籍失败。' }, 500);
  }
}

export async function submitBookRequest(context: { request: Request; env: BooksEnv }): Promise<Response> {
  try {
    assertSameOrigin(context.request);
    const bucket = requireBooksBucket(context.env);

    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      throw new ApiError('请求体无效。', 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ApiError('请求体必须是 JSON 对象。', 400);
    }
    const data = body as Record<string, unknown>;
    const title = String(data.title || '').trim();
    if (!title) throw new ApiError('书名不能为空。', 400);
    if (title.length > 200) throw new ApiError('书名过长。', 400);

    const entry: BookRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      author: String(data.author || '').trim().slice(0, 200),
      notes: String(data.notes || '').trim().slice(0, 2000),
      contact: String(data.contact || '').trim().slice(0, 200),
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    const existing = await bucket.get('books/requests.json');
    const requests = existing ? await existing.json<BookRequest[]>() : [];
    requests.unshift(entry);
    if (requests.length > 500) requests.length = 500;
    await putJson(bucket, 'books/requests.json', requests, 'no-store');

    return json({ ok: true, request: entry }, 201);
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    console.error(error);
    return json({ ok: false, error: '提交书籍需求失败。' }, 500);
  }
}

export async function listBookRequests(context: { env: BooksEnv }): Promise<Response> {
  try {
    const object = await requireBooksBucket(context.env).get('books/requests.json');
    const requests = object ? await object.json<BookRequest[]>() : [];
    return json({ ok: true, requests });
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: '读取书籍需求失败。' }, 500);
  }
}

export async function deleteBookRequest(context: { env: BooksEnv }, requestId: string): Promise<Response> {
  try {
    if (!requestId || requestId.length > 100) throw new ApiError('需求 ID 无效。', 400);
    const bucket = requireBooksBucket(context.env);
    const object = await bucket.get('books/requests.json');
    const requests = object ? await object.json<BookRequest[]>() : [];
    const filtered = requests.filter((item) => item.id !== requestId);
    if (filtered.length === requests.length) throw new ApiError('需求记录不存在。', 404);
    await putJson(bucket, 'books/requests.json', filtered, 'no-store');
    return json({ ok: true, id: requestId });
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: '删除需求失败。' }, 500);
  }
}
