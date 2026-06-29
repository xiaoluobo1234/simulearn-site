export interface Env {
  SIMULEARN_AI_MODE?: string;
  DIFY_API_URL?: string;
  DIFY_CHAT_APP_API_KEY?: string;
  DIFY_REVIEW_APP_API_KEY?: string;
  DIFY_DATASET_API_KEY?: string;
  DIFY_DATASETS_JSON?: string;
  DIFY_REVIEW_FILE_INPUT?: string;
  DIFY_ACCESS_CLIENT_ID?: string;
  DIFY_ACCESS_CLIENT_SECRET?: string;
  SIMULEARN_AI_USERNAME?: string;
  SIMULEARN_AI_PASSWORD?: string;
  MAX_UPLOAD_MB?: string;
}

export type DatasetSlug =
  | 'structural'
  | 'thermal'
  | 'fluids'
  | 'multiphysics'
  | 'chip'
  | 'private'
  | 'review';

export const datasetLabels: Record<DatasetSlug, string> = {
  structural: '结构',
  thermal: '热',
  fluids: '流体',
  multiphysics: '多物理场',
  chip: '芯片仿真',
  private: '私有原始资料',
  review: '待审核整理区',
};

export const allowedExtensions = ['pdf', 'docx', 'md', 'markdown', 'txt', 'csv'];

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return json({ ok: false, error: error.message }, error.status);
  }
  console.error('Unhandled SimuLearn AI API error', error);
  return json({ ok: false, error: '服务暂时不可用，请稍后重试。' }, 500);
}

export function isMock(env: Env): boolean {
  return (env.SIMULEARN_AI_MODE || 'mock').toLowerCase() !== 'live';
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('Origin');
  if (!origin) return;
  const url = new URL(request.url);
  if (new URL(origin).host !== url.host) {
    throw new ApiError('拒绝跨站请求。', 403);
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    throw new ApiError('请求格式必须为 JSON。', 415);
  }
  try {
    return await request.json<T>();
  } catch {
    throw new ApiError('JSON 请求内容无效。', 400);
  }
}

export async function userId(request: Request): Promise<string> {
  const cookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)simulearn_uid=([a-f0-9-]{36})/)?.[1];
  const identity =
    request.headers.get('Cf-Access-Authenticated-User-Email') ||
    cookie ||
    'simulearn-owner';
  const bytes = new TextEncoder().encode(identity.toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sl-${Array.from(new Uint8Array(digest)).slice(0, 12).map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function ensureLearningSession(request: Request): { request: Request; setCookie?: string } {
  if (request.headers.get('Cf-Access-Authenticated-User-Email')) return { request };
  const existing = request.headers.get('Cookie')?.match(/(?:^|;\s*)simulearn_uid=([a-f0-9-]{36})/)?.[1];
  if (existing) return { request };
  const value = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set('Cookie', `${request.headers.get('Cookie') || ''}; simulearn_uid=${value}`);
  return {
    request: new Request(request, { headers }),
    setCookie: `simulearn_uid=${value}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
  };
}

export function resetLearningSession(): string {
  return `simulearn_uid=${crypto.randomUUID()}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
}

export function attachCookie(response: Response, cookie?: string): Response {
  if (!cookie) return response;
  const copy = new Response(response.body, response);
  copy.headers.append('Set-Cookie', cookie);
  return copy;
}

export function datasetMap(env: Env): Record<string, string> {
  if (!env.DIFY_DATASETS_JSON) return {};
  try {
    const parsed = JSON.parse(env.DIFY_DATASETS_JSON);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
    );
  } catch {
    throw new ApiError('DIFY_DATASETS_JSON 配置不是有效 JSON。', 500);
  }
}

export function requireDataset(env: Env, slug: string): string {
  if (!(slug in datasetLabels)) throw new ApiError('未知知识库。', 400);
  const id = datasetMap(env)[slug];
  if (!id || id === 'REPLACE') throw new ApiError(`知识库「${datasetLabels[slug as DatasetSlug]}」尚未配置。`, 503);
  return id;
}

export function validateFile(file: FormDataEntryValue | null, env: Env): File {
  if (!(file instanceof File)) throw new ApiError('请选择需要处理的文件。', 400);
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!allowedExtensions.includes(extension)) {
    throw new ApiError(`暂不支持 .${extension || '未知'} 文件。`, 415);
  }
  const maxMb = Number(env.MAX_UPLOAD_MB || 15);
  if (!Number.isFinite(maxMb) || maxMb <= 0) throw new ApiError('MAX_UPLOAD_MB 配置无效。', 500);
  if (file.size > maxMb * 1024 * 1024) {
    throw new ApiError(`文件不能超过 ${maxMb} MB。`, 413);
  }
  if (file.size === 0) throw new ApiError('不能上传空文件。', 400);
  return file;
}

function baseUrl(env: Env): string {
  const raw = env.DIFY_API_URL?.trim();
  if (!raw) throw new ApiError('DIFY_API_URL 尚未配置。', 503);
  return raw.replace(/\/+$/, '').replace(/\/v1$/, '');
}

function authHeaders(env: Env, token: string): Headers {
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  if (env.DIFY_ACCESS_CLIENT_ID && env.DIFY_ACCESS_CLIENT_SECRET) {
    headers.set('CF-Access-Client-Id', env.DIFY_ACCESS_CLIENT_ID);
    headers.set('CF-Access-Client-Secret', env.DIFY_ACCESS_CLIENT_SECRET);
  }
  return headers;
}

export async function difyFetch(
  env: Env,
  path: string,
  token: string | undefined,
  init: RequestInit = {},
): Promise<Response> {
  if (!token || token.includes('REPLACE')) throw new ApiError('对应的 Dify API Key 尚未配置。', 503);
  const headers = authHeaders(env, token);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  const response = await fetch(`${baseUrl(env)}/v1${path}`, { ...init, headers });
  if (!response.ok) {
    let details = '';
    try {
      const body = await response.json<{ message?: string; error?: string }>();
      details = body.message || body.error || '';
    } catch {
      details = await response.text();
    }
    console.error('Dify API request failed', response.status, path, details.slice(0, 500));
    throw new ApiError(
      response.status === 401 || response.status === 403
        ? 'Dify 鉴权失败，请检查 API Key 和 Access 服务令牌。'
        : `Dify 请求失败（${response.status}）。`,
      response.status >= 400 && response.status < 500 ? response.status : 502,
    );
  }
  return response;
}

export async function difyJson<T>(
  env: Env,
  path: string,
  token: string | undefined,
  init: RequestInit = {},
): Promise<T> {
  const response = await difyFetch(env, path, token, init);
  return response.json<T>();
}
