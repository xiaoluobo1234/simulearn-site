import type { Env as DifyEnv } from '../functions/_shared/dify';
import { ApiError, attachCookie, ensureLearningSession, json, resetLearningSession } from '../functions/_shared/dify';
import { onRequestPost as analyze } from '../functions/api/ai/analyze';
import { onRequestPost as chat } from '../functions/api/ai/chat';
import { onRequestGet as datasets } from '../functions/api/ai/datasets';
import { onRequestGet as health } from '../functions/api/ai/health';
import { onRequestPost as publish } from '../functions/api/ai/publish';
import { onRequestGet as status } from '../functions/api/ai/status';
import {
  deleteBook,
  deleteBookRequest,
  getBook,
  getBookAsset,
  importBook,
  listBookRequests,
  listBooks,
  submitBookRequest,
  syncBookToDify,
  type BooksBucket,
} from '../functions/_shared/books';
import { onRequestPost as generatePlan } from '../functions/api/learning/plan';
import { onRequestGet as getProgress, onRequestPut as updateProgress } from '../functions/api/learning/progress';
import { onRequestPost as checkpoint } from '../functions/api/learning/checkpoint';
import { assembleKnowledgeContent, validateDomain } from '../functions/_shared/learning';
import {
  clearSessionCookie,
  createEmailUser,
  createOAuthUser,
  exchangeQQCode,
  exchangeWechatCode,
  getQQOAuthUrl,
  getUserFromRequest,
  getWechatOAuthUrl,
  sendVerificationCode,
  setSessionCookie,
  verifyCode,
} from '../functions/_shared/auth';

interface Env extends DifyEnv {
  BOOKS?: BooksBucket;
  BOOK_IMPORT_MAX_MB?: string;
  JWT_SECRET?: string;
  RESEND_API_KEY?: string;
  WECHAT_APP_ID?: string;
  WECHAT_APP_SECRET?: string;
  QQ_APP_ID?: string;
  QQ_APP_SECRET?: string;
  CAE_BACKEND_URL?: string;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

type RouteHandler = (context: { request: Request; env: Env }) => Response | Promise<Response>;

const routes = new Map<string, RouteHandler>([
  ['GET /api/ai/health', health as RouteHandler],
  ['GET /api/ai/datasets', datasets as RouteHandler],
  ['GET /api/ai/status', status as RouteHandler],
  ['POST /api/ai/chat', chat as RouteHandler],
  ['POST /api/ai/analyze', analyze as RouteHandler],
  ['POST /api/ai/publish', publish as RouteHandler],
]);

function isProtectedPath(pathname: string): boolean {
  return pathname === '/ai' || pathname.startsWith('/ai/') || pathname.startsWith('/api/ai/');
}

function match(pathname: string, pattern: RegExp): RegExpMatchArray | null {
  return pathname.match(pattern);
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < Math.max(leftBytes.length, rightBytes.length); index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return difference === 0;
}

function textResponse(message: string, status: number, authenticate = false): Response {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  if (authenticate) headers.set('WWW-Authenticate', 'Basic realm="SimuLearn AI", charset="UTF-8"');
  return new Response(message, { status, headers });
}

async function authorize(request: Request, env: Env): Promise<Response | null> {
  if ((env.SIMULEARN_AI_MODE || 'mock').toLowerCase() !== 'live') return null;
  if (!env.SIMULEARN_AI_USERNAME || !env.SIMULEARN_AI_PASSWORD) {
    return textResponse('AI 管理员凭据尚未配置。', 503);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Basic ')) {
    return textResponse('需要管理员身份验证。', 401, true);
  }

  let credentials = '';
  try {
    credentials = atob(authorization.slice(6));
  } catch {
    return textResponse('需要管理员身份验证。', 401, true);
  }

  const separator = credentials.indexOf(':');
  if (separator < 0) return textResponse('需要管理员身份验证。', 401, true);
  const [usernameMatches, passwordMatches] = await Promise.all([
    secureEqual(credentials.slice(0, separator), env.SIMULEARN_AI_USERNAME),
    secureEqual(credentials.slice(separator + 1), env.SIMULEARN_AI_PASSWORD),
  ]);
  return usernameMatches && passwordMatches
    ? null
    : textResponse('需要管理员身份验证。', 401, true);
}

async function proxyCaeApi(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(env, request);
  if (!user) {
    return json({ ok: false, error: 'Login required' }, 401);
  }

  const incomingUrl = new URL(request.url);
  const backendBase = new URL(env.CAE_BACKEND_URL || 'http://39.106.111.97');
  const backendUrl = new URL(backendBase.toString());
  const rest = incomingUrl.pathname.replace(/^\/api\/cae\/?/, '');
  const basePath = backendBase.pathname.replace(/\/$/, '');
  backendUrl.pathname = `${basePath}/api/v1/${rest}`.replace(/\/{2,}/g, '/');
  backendUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('X-Simulearn-User-Id', user.userId);
  headers.set('X-Forwarded-Host', incomingUrl.host);
  headers.set('X-Forwarded-Proto', incomingUrl.protocol.replace(':', ''));

  return fetch(new Request(backendUrl.toString(), {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === 'www.simulearn.cn') {
      url.hostname = 'simulearn.cn';
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 308);
    }

    if (isProtectedPath(url.pathname)) {
      const denied = await authorize(request, env);
      if (denied) return denied;
    }

    if (url.pathname === '/api/cae' || url.pathname.startsWith('/api/cae/')) {
      return proxyCaeApi(request, env);
    }

    if (url.pathname.startsWith('/api/ai/')) {
      if (request.method === 'POST' && url.pathname === '/api/ai/books/import') {
        return importBook({ request, env });
      }

      if (request.method === 'GET' && url.pathname === '/api/ai/books/requests') {
        return listBookRequests({ env });
      }

      const deleteRequestMatch = match(url.pathname, /^\/api\/ai\/books\/requests\/(.+)$/);
      if (request.method === 'DELETE' && deleteRequestMatch) {
        return deleteBookRequest({ env }, decodeURIComponent(deleteRequestMatch[1]));
      }

      const deleteBookMatch = match(url.pathname, /^\/api\/ai\/books\/([a-z0-9-]+)$/);
      if (request.method === 'DELETE' && deleteBookMatch
        && deleteBookMatch[1] !== 'requests' && deleteBookMatch[1] !== 'import') {
        return deleteBook({ env }, deleteBookMatch[1]);
      }

      const syncBookMatch = match(url.pathname, /^\/api\/ai\/books\/([a-z0-9-]+)\/sync$/);
      if (request.method === 'POST' && syncBookMatch
        && syncBookMatch[1] !== 'requests' && syncBookMatch[1] !== 'import') {
        try {
          const body = await request.json().catch(() => ({})) as { chapterIds?: string[] };
          const result = await syncBookToDify(env, syncBookMatch[1], body.chapterIds);
          return json({ ok: true, ...result });
        } catch (error) {
          const message = error instanceof Error ? error.message : '同步失败。';
          const status = error && typeof error === 'object' && 'status' in error
            ? (error as { status: number }).status
            : 500;
          return json({ ok: false, error: message }, status);
        }
      }

      const handler = routes.get(`${request.method} ${url.pathname}`);
      if (handler) return handler({ request, env });
      const pathExists = Array.from(routes.keys()).some((key) => key.endsWith(` ${url.pathname}`));
      return pathExists
        ? json({ ok: false, error: '不支持此请求方法。' }, 405)
        : json({ ok: false, error: '接口不存在。' }, 404);
    }

    // ── Auth routes ──

    if (request.method === 'POST' && url.pathname === '/api/auth/email/register') {
      try {
        const body = await request.json() as { email: string; password: string; name?: string };
        if (!body.email || !body.password) throw new ApiError('邮箱和密码不能为空。', 400);
        if (body.password.length < 8) throw new ApiError('密码至少需要 8 个字符。', 400);
        const { user, token } = await createEmailUser(env, body.email, body.password, body.name);
        const resp = json({ ok: true, user: { userId: user.userId, name: user.name, email: user.email, avatar: user.avatar } });
        resp.headers.set('Set-Cookie', setSessionCookie(token));
        return resp;
      } catch (error) {
        const message = error instanceof Error ? error.message : '登录失败。';
        const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
        return json({ ok: false, error: message }, status);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/email/send-code') {
      try {
        const body = await request.json() as { email: string };
        if (!body.email) throw new ApiError('邮箱不能为空。', 400);
        await sendVerificationCode(env, body.email);
        return json({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : '发送失败。';
        const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
        return json({ ok: false, error: message }, status);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/email/verify-code') {
      try {
        const body = await request.json() as { email: string; code: string };
        if (!body.email || !body.code) throw new ApiError('邮箱和验证码不能为空。', 400);
        const { user, token } = await verifyCode(env, body.email, body.code);
        const resp = json({ ok: true, user: { userId: user.userId, name: user.name, email: user.email, avatar: user.avatar } });
        resp.headers.set('Set-Cookie', setSessionCookie(token));
        return resp;
      } catch (error) {
        const message = error instanceof Error ? error.message : '验证失败。';
        const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
        return json({ ok: false, error: message }, status);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      try {
        const user = await getUserFromRequest(env, request);
        if (!user) return json({ ok: true, user: null });
        return json({ ok: true, user: { userId: user.userId, name: user.name, email: user.email, avatar: user.avatar, authMethod: user.authMethod } });
      } catch {
        return json({ ok: true, user: null });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      const resp = json({ ok: true });
      resp.headers.set('Set-Cookie', clearSessionCookie());
      return resp;
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/wechat/url') {
      try {
        const redirectUri = `${new URL(request.url).origin}/api/auth/wechat/callback`;
        const { url } = getWechatOAuthUrl(env, redirectUri);
        return json({ ok: true, url });
      } catch (error) {
        const message = error instanceof Error ? error.message : '微信登录未开放。';
        return json({ ok: false, error: message }, 503);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/wechat/callback') {
      try {
        const callbackUrl = new URL(request.url);
        const code = callbackUrl.searchParams.get('code');
        if (!code) throw new ApiError('授权失败：未收到授权码。', 400);
        const wxUser = await exchangeWechatCode(env, code);
        const { user, token } = await createOAuthUser(env, 'wechat', wxUser.openid, { name: wxUser.name, avatar: wxUser.avatar });
        const origin = new URL(request.url).origin;
        const resp = new Response(null, { status: 302, headers: { Location: `${origin}/login?login=success` } });
        resp.headers.set('Set-Cookie', setSessionCookie(token));
        return resp;
      } catch (error) {
        const origin = new URL(request.url).origin;
        const msg = error instanceof Error ? error.message : '登录失败';
        return new Response(null, { status: 302, headers: { Location: `${origin}/login?error=${encodeURIComponent(msg)}` } });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/qq/url') {
      try {
        const redirectUri = `${new URL(request.url).origin}/api/auth/qq/callback`;
        const { url } = getQQOAuthUrl(env, redirectUri);
        return json({ ok: true, url });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'QQ 登录未开放。';
        return json({ ok: false, error: message }, 503);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/qq/callback') {
      try {
        const callbackUrl = new URL(request.url);
        const code = callbackUrl.searchParams.get('code');
        if (!code) throw new ApiError('授权失败：未收到授权码。', 400);
        const redirectUri = `${new URL(request.url).origin}/api/auth/qq/callback`;
        const qqUser = await exchangeQQCode(env, code, redirectUri);
        const { user, token } = await createOAuthUser(env, 'qq', qqUser.openid, { name: qqUser.name, avatar: qqUser.avatar });
        const origin = new URL(request.url).origin;
        const resp = new Response(null, { status: 302, headers: { Location: `${origin}/login?login=success` } });
        resp.headers.set('Set-Cookie', setSessionCookie(token));
        return resp;
      } catch (error) {
        const origin = new URL(request.url).origin;
        const msg = error instanceof Error ? error.message : '登录失败';
        return new Response(null, { status: 302, headers: { Location: `${origin}/login?error=${encodeURIComponent(msg)}` } });
      }
    }

    // ── Learning system routes ──
    const learningSession = url.pathname.startsWith('/api/learning/')
      ? ensureLearningSession(request)
      : null;
    const learningRequest = learningSession?.request || request;
    const learningResponse = (response: Response | Promise<Response>) =>
      Promise.resolve(response).then((result) => attachCookie(result, learningSession?.setCookie));
    if (request.method === 'POST' && url.pathname === '/api/learning/session/reset') {
      return attachCookie(json({ ok: true }), resetLearningSession());
    }
    if (request.method === 'POST' && url.pathname === '/api/learning/plan') {
      return learningResponse(generatePlan({ request: learningRequest, env }));
    }
    if (url.pathname === '/api/learning/progress') {
      if (request.method === 'GET') return learningResponse(getProgress({ request: learningRequest, env }));
      if (request.method === 'PUT') return learningResponse(updateProgress({ request: learningRequest, env }));
    }
    if (request.method === 'POST' && url.pathname === '/api/learning/checkpoint') {
      return learningResponse(checkpoint({ request: learningRequest, env }));
    }
    const kpContentMatch = match(url.pathname, /^\/api\/knowledge\/([a-z]+)\/([a-z0-9-]+)$/);
    if (request.method === 'GET' && kpContentMatch) {
      try {
        validateDomain(kpContentMatch[1]);
        const content = await assembleKnowledgeContent(env, request, kpContentMatch[1], kpContentMatch[2]);
        return json({ ok: true, content });
      } catch (error) {
        const message = error instanceof Error ? error.message : '请求失败。';
        const status = error && typeof error === 'object' && 'status' in error
          ? (error as { status: number }).status
          : 500;
        return json({ ok: false, error: message }, status);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/books') return listBooks({ env });
    if (request.method === 'POST' && url.pathname === '/api/books/requests') {
      return submitBookRequest({ request, env });
    }
    const bookAssetMatch = match(url.pathname, /^\/api\/books\/([a-z0-9-]+)\/asset\/(.+)$/);
    if (request.method === 'GET' && bookAssetMatch) {
      return getBookAsset({ env }, bookAssetMatch[1], decodeURIComponent(bookAssetMatch[2]));
    }
    const bookMatch = match(url.pathname, /^\/api\/books\/([a-z0-9-]+)$/);
    if (request.method === 'GET' && bookMatch) return getBook({ env }, bookMatch[1]);

    const readerMatch = match(url.pathname, /^\/books\/([a-z0-9-]+)\/?$/);
    if (request.method === 'GET' && readerMatch && readerMatch[1] !== 'reader') {
      const readerUrl = new URL('/books/reader/', request.url);
      return env.ASSETS.fetch(new Request(readerUrl, request));
    }

    // Knowledge point page rewrite: /domains/{domain}/kp/{slug} → /domains/kp/
    const kpPageMatch = match(url.pathname, /^\/domains\/([a-z]+)\/kp\/([a-z0-9-]+)\/?$/);
    if (request.method === 'GET' && kpPageMatch) {
      const kpUrl = new URL('/domains/kp/', request.url);
      return env.ASSETS.fetch(new Request(kpUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
};
