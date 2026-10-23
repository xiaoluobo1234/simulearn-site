import { getUserFromRequest, type AuthEnv } from '../_shared/auth';
import { ApiError, difyJson, errorResponse, isMock, json } from '../_shared/dify';
import { assertAiRateLimit, type LearningEnv } from '../_shared/learning';
import { StudyStore } from '../_shared/study-store';
import { ORGANIZE_PROMPT } from '../../src/data/study-schema';

export interface StudyEnv extends AuthEnv, LearningEnv {}
const MAX_BODY_BYTES = 128 * 1_024;

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) throw new ApiError('请求格式必须为 JSON。', 415);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY_BYTES) throw new ApiError('记录内容不能超过 128 KiB。', 413);
  // Count streamed bytes as well: Content-Length can be absent or incorrect.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError('请求内容不能为空。', 400);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_BODY_BYTES) { await reader.cancel(); throw new ApiError('记录内容不能超过 128 KiB。', 413); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ApiError('JSON 请求内容无效。', 400); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('请求必须是 JSON 对象。', 400);
  return value as Record<string, unknown>;
}

function assertMutationOrigin(request: Request): void {
  const origin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite === 'cross-site') throw new ApiError('拒绝跨站请求。', 403);
  if (origin) {
    try { if (new URL(origin).origin === new URL(request.url).origin) return; }
    catch { /* reject malformed origins */ }
    throw new ApiError('拒绝跨站请求。', 403);
  }
  // Non-browser clients can omit Origin. Worker must also check the signed CSRF
  // token before dispatching here; an unsigned anonymous cookie is never identity.
}

export async function handleStudyRequest(request: Request, env: StudyEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (!env.BOOKS) throw new ApiError('学习记录存储尚未配置。', 503);
    const store = new StudyStore(env.BOOKS);
    const publicMatch = url.pathname.match(/^\/api\/study\/public\/([a-zA-Z0-9_-]{1,100})\/((?:record|source|note)-[a-f0-9-]{36})\/?$/);
    if (request.method === 'GET' && publicMatch) {
      const saved = await store.get(publicMatch[1], publicMatch[2]);
      if (saved.visibility !== 'public' || saved.reviewStatus !== 'reviewed' || !saved.fields.publicBody?.trim()) throw new ApiError('公开内容不存在。', 404);
      // Never spread saved fields: raw, attachment URLs, references and history
      // remain private even when the separate publicBody has been published.
      return json({ ok: true, item: {
        id: saved.id, kind: saved.kind, title: saved.title,
        fields: { publicBody: saved.fields.publicBody },
        revision: saved.revision, updatedAt: saved.updatedAt,
      } });
    }
    if (!env.JWT_SECRET) throw new ApiError('登录服务尚未配置。', 503);
    const user = await getUserFromRequest(env, request);
    if (!user) throw new ApiError('请先登录，再保存或读取私人学习记录。', 401);
    if (!['GET', 'HEAD'].includes(request.method)) assertMutationOrigin(request);
    if (url.pathname === '/api/study/organize' && request.method === 'POST') {
      const body = await readBody(request);
      if (typeof body.raw !== 'string' || !body.raw.trim() || body.raw.length > 24_000) throw new ApiError('请提供 24000 字以内的原始学习记录。', 400);
      if (isMock(env) || !env.DIFY_API_URL?.trim() || !env.DIFY_CHAT_APP_API_KEY?.trim() || env.DIFY_CHAT_APP_API_KEY.includes('REPLACE')) {
        throw new ApiError('AI 整理尚未接入。可复制完整提示词到 AI 工具，核对后手动保存草稿。', 503);
      }
      await assertAiRateLimit(env, user.userId);
      const result = await difyJson<{ answer?: unknown }>(env, '/chat-messages', env.DIFY_CHAT_APP_API_KEY, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(55_000),
        body: JSON.stringify({
          inputs: {}, query: `${ORGANIZE_PROMPT}\n\n以下是我本次的原始记录：\n${body.raw}`,
          user: user.userId, response_mode: 'blocking', conversation_id: '', auto_generate_name: false,
        }),
      }).catch((error: unknown) => {
        if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw new ApiError('AI 整理超时，请稍后重试或复制提示词手动整理；原始记录仍由你保留。', 504);
        throw error;
      });
      if (typeof result.answer !== 'string' || !result.answer.trim()) throw new ApiError('AI 未返回有效整理稿，请重试或使用手动流程。', 502);
      if (result.answer.length > 31_900) throw new ApiError('AI 整理稿过长，暂不能存入单条记录。请缩小本次原始记录范围后重试。', 502);
      // AI generates a preview only. This branch performs no storage mutation.
      return json({ ok: true, draft: `> AI 整理草稿 · 待人工核对 · 未保存、未公开\n\n${result.answer.trim()}` });
    }
    if (url.pathname === '/api/study/items') {
      if (request.method === 'GET') return json({ ok: true, ...await store.list(user.userId, url.searchParams.get('kind') || undefined, url.searchParams.get('cursor') || undefined) });
      if (request.method === 'POST') {
        const body = await readBody(request);
        return json({ ok: true, item: await store.create(user.userId, body.item, body.publicConfirmed) }, 201);
      }
    }
    const match = url.pathname.match(/^\/api\/study\/items\/((?:record|source|note)-[a-f0-9-]{36})(\/history)?\/?$/);
    if (match) {
      if (match[2] && request.method === 'GET') return json({ ok: true, versions: await store.history(user.userId, match[1]) });
      if (!match[2] && request.method === 'GET') return json({ ok: true, item: await store.get(user.userId, match[1]) });
      if (!match[2] && request.method === 'PUT') {
        const body = await readBody(request);
        return json({ ok: true, item: await store.update(user.userId, match[1], body.revision, body.item, body.publicConfirmed) });
      }
      if (!match[2] && request.method === 'DELETE') {
        const body = await readBody(request);
        await store.remove(user.userId, match[1], body.revision);
        return json({ ok: true });
      }
    }
    throw new ApiError('学习记录接口不存在。', 404);
  } catch (error) { return errorResponse(error); }
}

export const onRequest = (context: { request: Request; env: StudyEnv }): Promise<Response> => handleStudyRequest(context.request, context.env);
