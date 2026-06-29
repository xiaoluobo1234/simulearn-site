import type { Env } from './_shared/dify';

const protectedPaths = ['/ai', '/api/ai', '/books', '/api/books'];

function isProtectedPath(pathname: string): boolean {
  return protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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

function unauthorized(): Response {
  return new Response('需要管理员身份验证。', {
    status: 401,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'WWW-Authenticate': 'Basic realm="SimuLearn AI", charset="UTF-8"',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const pathname = new URL(context.request.url).pathname;
  if (!isProtectedPath(pathname) || (context.env.SIMULEARN_AI_MODE || 'mock').toLowerCase() !== 'live') {
    return context.next();
  }

  const expectedUsername = context.env.SIMULEARN_AI_USERNAME;
  const expectedPassword = context.env.SIMULEARN_AI_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    return new Response('AI 管理员凭据尚未配置。', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const authorization = context.request.headers.get('Authorization');
  if (!authorization?.startsWith('Basic ')) return unauthorized();

  let credentials = '';
  try {
    credentials = atob(authorization.slice(6));
  } catch {
    return unauthorized();
  }
  const separator = credentials.indexOf(':');
  if (separator < 0) return unauthorized();

  const username = credentials.slice(0, separator);
  const password = credentials.slice(separator + 1);
  const [usernameMatches, passwordMatches] = await Promise.all([
    secureEqual(username, expectedUsername),
    secureEqual(password, expectedPassword),
  ]);
  if (!usernameMatches || !passwordMatches) return unauthorized();

  return context.next();
};
