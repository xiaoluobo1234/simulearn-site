import type { Env as DifyEnv } from '../functions/_shared/dify';
import { json } from '../functions/_shared/dify';
import { onRequestPost as analyze } from '../functions/api/ai/analyze';
import { onRequestPost as chat } from '../functions/api/ai/chat';
import { onRequestGet as datasets } from '../functions/api/ai/datasets';
import { onRequestGet as health } from '../functions/api/ai/health';
import { onRequestPost as publish } from '../functions/api/ai/publish';
import { onRequestGet as status } from '../functions/api/ai/status';

interface Env extends DifyEnv {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (isProtectedPath(url.pathname)) {
      const denied = await authorize(request, env);
      if (denied) return denied;
    }

    if (url.pathname.startsWith('/api/ai/')) {
      const handler = routes.get(`${request.method} ${url.pathname}`);
      if (handler) return handler({ request, env });
      const pathExists = Array.from(routes.keys()).some((key) => key.endsWith(` ${url.pathname}`));
      return pathExists
        ? json({ ok: false, error: '不支持此请求方法。' }, 405)
        : json({ ok: false, error: '接口不存在。' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
