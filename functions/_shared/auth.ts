/**
 * auth.ts — 用户认证模块
 * 支持两种登录方式：
 *   通道一：邮箱 + 密码 / 邮箱 + 验证码
 *   通道二：微信 / QQ OAuth 扫码
 */

import { ApiError, json } from './dify';
import type { BooksBucket } from './books';
import { putJson } from './books';

// ── Types ──

export interface UserProfile {
  userId: string;
  email?: string;
  name: string;
  avatar?: string;
  authMethod: 'email' | 'wechat' | 'qq';
  openid?: string;
  passwordHash?: string;
  salt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

export interface AuthEnv {
  BOOKS?: BooksBucket;
  JWT_SECRET?: string;
  RESEND_API_KEY?: string;
  WECHAT_APP_ID?: string;
  WECHAT_APP_SECRET?: string;
  QQ_APP_ID?: string;
  QQ_APP_SECRET?: string;
}

// ── Helpers ──

function requireBucket(env: AuthEnv): BooksBucket {
  if (!env.BOOKS) throw new ApiError('存储未配置。', 503);
  return env.BOOKS;
}

function requireJwtSecret(env: AuthEnv): string {
  if (!env.JWT_SECRET) throw new ApiError('JWT 密钥未配置。', 503);
  return env.JWT_SECRET;
}

function emailKey(email: string): string {
  const hash = simpleHash(email.toLowerCase().trim());
  return `users/by-email/${hash}.json`;
}

function profileKey(userId: string): string {
  return `users/${userId}/profile.json`;
}

function codeKey(email: string): string {
  const hash = simpleHash(email.toLowerCase().trim());
  return `users/verification/${hash}.json`;
}

function simpleHash(input: string): string {
  // Fast hex hash for key generation (not cryptographic)
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0');
}

function generateUserId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return 'sl-' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

// ── Password Hashing (PBKDF2) ──

export async function hashPassword(password: string, providedSalt?: Uint8Array): Promise<{ hash: string; salt: string }> {
  const salt = providedSalt || crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, 256,
  );
  return {
    hash: btoa(String.fromCharCode(...new Uint8Array(bits))),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

export async function verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const salt = Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0));
  const { hash } = await hashPassword(password, salt);
  return hash === storedHash;
}

// ── JWT ──

export async function createJWT(payload: { userId: string }, secret: string): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(new TextEncoder().encode(JSON.stringify({ ...payload, iat: now, exp: now + 604800 }))); // 7 days
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('HMAC', key, b64urlDecode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export function setSessionCookie(token: string): string {
  return `simulearn_sess=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `simulearn_sess=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// ── CSRF Protection ──

export async function generateCsrfToken(env: AuthEnv): Promise<string> {
  const secret = env.JWT_SECRET || 'csrf-fallback';
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const payload = b64url(randomBytes);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`csrf:${payload}`));
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyCsrfToken(env: AuthEnv, token: string): Promise<boolean> {
  try {
    const secret = env.JWT_SECRET || 'csrf-fallback';
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('HMAC', key, b64urlDecode(parts[1]), new TextEncoder().encode(`csrf:${parts[0]}`));
  } catch { return false; }
}

// ── User CRUD ──

export async function getUserByEmail(env: AuthEnv, email: string): Promise<UserProfile | null> {
  const bucket = requireBucket(env);
  const key = emailKey(email);
  const obj = await bucket.get(key);
  if (!obj) return null;
  const { userId } = await obj.json<{ userId: string }>();
  return getUserById(env, userId);
}

export async function getUserById(env: AuthEnv, userId: string): Promise<UserProfile | null> {
  const bucket = requireBucket(env);
  const key = profileKey(userId);
  const obj = await bucket.get(key);
  if (!obj) return null;
  return obj.json<UserProfile>();
}

export async function getUserFromRequest(env: AuthEnv, request: Request): Promise<UserProfile | null> {
  const secret = env.JWT_SECRET;
  if (!secret) return null;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/simulearn_sess=([^;]+)/);
  if (!match) return null;
  const payload = await verifyJWT(match[1], secret);
  if (!payload) return null;
  return getUserById(env, payload.userId);
}

export async function createEmailUser(
  env: AuthEnv,
  email: string,
  password: string,
  name?: string,
): Promise<{ user: UserProfile; token: string }> {
  const bucket = requireBucket(env);
  const normalizedEmail = email.toLowerCase().trim();

  // Check if email already registered
  const existing = await getUserByEmail(env, normalizedEmail);
  if (existing) {
    // Login: verify password
    if (!existing.passwordHash || !existing.salt) {
      throw new ApiError('该邮箱使用了社交登录，请使用微信/QQ登录。', 400);
    }
    const ok = await verifyPassword(password, existing.passwordHash, existing.salt);
    if (!ok) throw new ApiError('密码错误。', 401);
    const token = await createJWT({ userId: existing.userId }, requireJwtSecret(env));
    return { user: existing, token };
  }

  // Register new user
  const userId = generateUserId();
  const { hash, salt } = await hashPassword(password);
  const now = new Date().toISOString();
  const displayName = name || normalizedEmail.split('@')[0];

  const profile: UserProfile = {
    userId, email: normalizedEmail, name: displayName,
    authMethod: 'email', passwordHash: hash, salt,
    createdAt: now, updatedAt: now,
  };

  await putJson(bucket, emailKey(normalizedEmail), { userId });
  await putJson(bucket, profileKey(userId), profile);
  const token = await createJWT({ userId }, requireJwtSecret(env));
  return { user: profile, token };
}

export async function createOAuthUser(
  env: AuthEnv,
  provider: 'wechat' | 'qq',
  openid: string,
  profile: { name: string; avatar?: string },
): Promise<{ user: UserProfile; token: string }> {
  const bucket = requireBucket(env);

  // Check if this OAuth user already exists
  const oauthKey = `users/by-openid/${provider}:${openid}.json`;
  const existingObj = await bucket.get(oauthKey);
  if (existingObj) {
    const { userId } = await existingObj.json<{ userId: string }>();
    const user = await getUserById(env, userId);
    if (user) {
      // Update avatar/name
      user.name = profile.name;
      user.avatar = profile.avatar || user.avatar;
      user.updatedAt = new Date().toISOString();
      await putJson(bucket, profileKey(userId), user);
      const token = await createJWT({ userId }, requireJwtSecret(env));
      return { user, token };
    }
  }

  // Create new OAuth user
  const userId = generateUserId();
  const now = new Date().toISOString();
  const userProfile: UserProfile = {
    userId, name: profile.name, avatar: profile.avatar,
    authMethod: provider, openid, createdAt: now, updatedAt: now,
  };

  await putJson(bucket, oauthKey, { userId });
  await putJson(bucket, profileKey(userId), userProfile);
  const token = await createJWT({ userId }, requireJwtSecret(env));
  return { user: userProfile, token };
}

// ── Verification Code (email) ──

export async function sendVerificationCode(env: AuthEnv, email: string): Promise<void> {
  const bucket = requireBucket(env);
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new ApiError('邮件服务未配置。请在环境变量中设置 RESEND_API_KEY。', 503);

  const normalizedEmail = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new ApiError('邮箱格式不正确。', 400);
  }

  // Rate limit: 1 per minute per email
  const ck = codeKey(normalizedEmail);
  const existing = await bucket.get(ck);
  if (existing) {
    const data = await existing.json<{ code: string; expiresAt: number }>();
    if (Date.now() < data.expiresAt - 4 * 60 * 1000) { // sent less than 1 minute ago
      throw new ApiError('验证码已发送，请等待 1 分钟后再试。', 429);
    }
  }

  // Generate code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  await putJson(bucket, ck, { code, expiresAt });

  // Send via Resend
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'SimuLearn <noreply@simulearn.cn>',
      to: [normalizedEmail],
      subject: 'SimuLearn 登录验证码',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <h2>🔐 SimuLearn 登录验证码</h2>
        <p>你的验证码是：</p>
        <p style="font-size:2rem;font-weight:bold;letter-spacing:0.3em;color:#0c8f87">${code}</p>
        <p>5 分钟内有效。如非本人操作，请忽略此邮件。</p>
        <hr style="border:0;border-top:1px solid #e9efee;margin:2rem 0">
        <small style="color:#627482">SimuLearn · 多物理场仿真知识与实训平台</small>
      </div>`,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new ApiError(`邮件发送失败: ${err.slice(0, 200)}`, 502);
  }
}

export async function verifyCode(env: AuthEnv, email: string, code: string): Promise<{ user: UserProfile; token: string }> {
  const bucket = requireBucket(env);
  const normalizedEmail = email.toLowerCase().trim();
  const ck = codeKey(normalizedEmail);
  const obj = await bucket.get(ck);
  if (!obj) throw new ApiError('验证码未发送或已过期。', 400);

  const data = await obj.json<{ code: string; expiresAt: number }>();
  if (Date.now() > data.expiresAt) {
    await bucket.delete(ck);
    throw new ApiError('验证码已过期，请重新获取。', 400);
  }
  if (data.code !== code.trim()) throw new ApiError('验证码错误。', 400);

  // Delete used code
  await bucket.delete(ck);

  // Find or create user
  const existing = await getUserByEmail(env, normalizedEmail);
  if (existing) {
    const token = await createJWT({ userId: existing.userId }, requireJwtSecret(env));
    return { user: existing, token };
  }

  // Auto-register
  const userId = generateUserId();
  const now = new Date().toISOString();
  const displayName = normalizedEmail.split('@')[0];
  const profile: UserProfile = {
    userId, email: normalizedEmail, name: displayName,
    authMethod: 'email', createdAt: now, updatedAt: now,
  };
  await putJson(bucket, emailKey(normalizedEmail), { userId });
  await putJson(bucket, profileKey(userId), profile);
  const token = await createJWT({ userId }, requireJwtSecret(env));
  return { user: profile, token };
}

// ── OAuth URL generation ──

export function getWechatOAuthUrl(env: AuthEnv, redirectUri: string): { url: string; state: string } {
  const appId = env.WECHAT_APP_ID;
  if (!appId) throw new ApiError('微信登录暂未开放。', 503);
  const state = generateUserId(); // Use as CSRF state
  const url = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
  return { url, state };
}

export function getQQOAuthUrl(env: AuthEnv, redirectUri: string): { url: string; state: string } {
  const appId = env.QQ_APP_ID;
  if (!appId) throw new ApiError('QQ 登录暂未开放。', 503);
  const state = generateUserId();
  const url = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=get_user_info`;
  return { url, state };
}

// ── OAuth token exchange ──

export async function exchangeWechatCode(env: AuthEnv, code: string): Promise<{ name: string; avatar?: string; openid: string }> {
  const appId = env.WECHAT_APP_ID;
  const secret = env.WECHAT_APP_SECRET;
  if (!appId || !secret) throw new ApiError('微信登录未配置。', 503);

  // Step 1: code → access_token + openid
  const tokenRes = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${secret}&code=${code}&grant_type=authorization_code`);
  const tokenData = await tokenRes.json() as { access_token?: string; openid?: string; errcode?: number; errmsg?: string };
  if (tokenData.errcode || !tokenData.access_token) {
    throw new ApiError(`微信授权失败: ${tokenData.errmsg || '未知错误'}`, 400);
  }

  // Step 2: access_token → user info
  const userRes = await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token}&openid=${tokenData.openid}`);
  const userData = await userRes.json() as { nickname?: string; headimgurl?: string; errcode?: number };
  if (userData.errcode) throw new ApiError(`获取微信用户信息失败: ${(userData as any).errmsg}`, 400);

  return { name: userData.nickname || '微信用户', avatar: userData.headimgurl, openid: tokenData.openid! };
}

export async function exchangeQQCode(env: AuthEnv, code: string, redirectUri: string): Promise<{ name: string; avatar?: string; openid: string }> {
  const appId = env.QQ_APP_ID;
  const secret = env.QQ_APP_SECRET;
  if (!appId || !secret) throw new ApiError('QQ 登录未配置。', 503);

  // Step 1: code → access_token
  const tokenRes = await fetch(`https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${appId}&client_secret=${secret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}&fmt=json`);
  const tokenData = await tokenRes.json() as { access_token?: string; error?: number; error_description?: string };
  if (tokenData.error || !tokenData.access_token) {
    throw new ApiError(`QQ 授权失败: ${tokenData.error_description || '未知错误'}`, 400);
  }

  // Step 2: access_token → openid
  const openidRes = await fetch(`https://graph.qq.com/oauth2.0/me?access_token=${tokenData.access_token}&fmt=json`);
  const openidData = await openidRes.json() as { openid?: string; error?: number };
  if (openidData.error || !openidData.openid) throw new ApiError('获取 QQ openid 失败。', 400);

  // Step 3: access_token + openid → user info
  const userRes = await fetch(`https://graph.qq.com/user/get_user_info?access_token=${tokenData.access_token}&oauth_consumer_key=${appId}&openid=${openidData.openid}`);
  const userData = await userRes.json() as { nickname?: string; figureurl_qq_2?: string; ret?: number };
  if (userData.ret !== 0) throw new ApiError('获取 QQ 用户信息失败。', 400);

  return { name: userData.nickname || 'QQ用户', avatar: userData.figureurl_qq_2, openid: openidData.openid };
}
