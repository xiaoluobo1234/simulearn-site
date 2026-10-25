import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJWT, type UserProfile } from '../functions/_shared/auth';
import type { BooksBucket, R2ObjectBody } from '../functions/_shared/books';
import { handleStudyRequest, type StudyEnv } from '../functions/api/study';
import { StudyStore } from '../functions/_shared/study-store';
import { ORGANIZE_PROMPT, type StudyItem } from '../src/data/study-schema';

/** Implements real conditional-write behavior rather than silently ignoring CAS. */
class MemoryR2 {
  values = new Map<string, { value: string; etag: string }>();
  serial = 0;
  async get(key: string): Promise<(R2ObjectBody & { etag: string }) | null> {
    const row = this.values.get(key);
    if (!row) return null;
    return {
      etag: row.etag, body: new Response(row.value).body!,
      text: async () => row.value,
      json: async <T>() => JSON.parse(row.value) as T,
      arrayBuffer: async () => new TextEncoder().encode(row.value).buffer,
    };
  }
  async put(key: string, value: string, options?: { onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string } }): Promise<{ etag: string } | null> {
    const prior = this.values.get(key);
    if (options?.onlyIf?.etagMatches && prior?.etag !== options.onlyIf.etagMatches) return null;
    if (options?.onlyIf?.etagDoesNotMatch === '*' && prior) return null;
    const etag = `etag-${++this.serial}`;
    this.values.set(key, { value, etag });
    return { etag };
  }
  async delete(keys: string | string[]): Promise<void> { for (const key of typeof keys === 'string' ? [keys] : keys) this.values.delete(key); }
  async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
    const keys = [...this.values.keys()].filter((key) => key.startsWith(options?.prefix || '')).sort();
    const start = Number(options?.cursor || 0);
    const slice = keys.slice(start, start + (options?.limit || 1000));
    const truncated = start + slice.length < keys.length;
    return {
      objects: slice.map((key) => ({ key, size: this.values.get(key)!.value.length, uploaded: new Date() })),
      truncated, ...(truncated ? { cursor: String(start + slice.length) } : {}),
    };
  }
}

let bucket: MemoryR2;
let env: StudyEnv;
let tokens: Record<string, string>;
const entry = (overrides: Record<string, unknown> = {}) => ({ kind: 'record', title: '首次读取 CSV', fields: { raw: '实际结果尚未记录。' }, ...overrides });
const owner = 'sl-alice';
function call(path: string, method = 'GET', body?: unknown, user = 'alice', headers: Record<string, string> = {}) {
  return handleStudyRequest(new Request(`https://simulearn.cn/api/study${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(user ? { Cookie: `simulearn_sess=${tokens[user]}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), env);
}
async function create(overrides: Record<string, unknown> = {}): Promise<StudyItem> {
  const response = await call('/items', 'POST', { item: entry(overrides) });
  expect(response.status).toBe(201);
  return (await response.json()).item;
}
beforeEach(async () => {
  bucket = new MemoryR2();
  env = { BOOKS: bucket as unknown as BooksBucket, JWT_SECRET: 'test-private-study-secret', SIMULEARN_AI_MODE: 'mock' };
  tokens = {};
  for (const name of ['alice', 'bob']) {
    const profile: UserProfile = { userId: `sl-${name}`, name, authMethod: 'email', createdAt: '2026-10-23', updatedAt: '2026-10-23' };
    await bucket.put(`users/${profile.userId}/profile.json`, JSON.stringify(profile));
    tokens[name] = await createJWT({ userId: profile.userId }, env.JWT_SECRET!);
  }
});
afterEach(() => vi.unstubAllGlobals());

describe('private study authentication and public projection', () => {
  it('requires a verified account session, not an anonymous learning cookie or a forged JWT', async () => {
    expect((await call('/items', 'GET', undefined, '', { Cookie: 'simulearn_uid=11111111-1111-4111-8111-111111111111' })).status).toBe(401);
    expect((await call('/items', 'POST', { item: entry() }, '', { Cookie: 'simulearn_sess=forged' })).status).toBe(401);
    expect((await call('/items', 'POST', { item: entry(), expectedOwner: owner }, '')).status).toBe(401);
    expect([...bucket.values.keys()].filter((key) => key.startsWith('study/'))).toEqual([]);
  });

  it('isolates lists, current versions and history by actual account owner', async () => {
    const saved = await create();
    expect((await (await call('/items', 'GET', undefined, 'bob')).json()).items).toEqual([]);
    for (const suffix of ['', '/history']) expect((await call(`/items/${saved.id}${suffix}`, 'GET', undefined, 'bob')).status).toBe(404);
    expect((await call(`/items/${saved.id}`, 'PUT', { revision: 1, item: saved }, 'bob')).status).toBe(404);
    const own = await call(`/items/${saved.id}`);
    expect(own.headers.get('Cache-Control')).toBe('no-store');
    expect((await own.json()).item.fields.raw).toBe('实际结果尚未记录。');
    expect((await call(`/public/${owner}/${saved.id}`, 'GET', undefined, '')).status).toBe(404);
  });

  it('checks the full origin before any mutation, including protocol and malformed origins', async () => {
    for (const origin of ['https://evil.example', 'http://simulearn.cn', 'null']) {
      expect((await call('/items', 'POST', { item: entry() }, 'alice', { Origin: origin })).status).toBe(403);
    }
    expect((await call('/items', 'POST', { item: entry() }, 'alice', { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403);
    expect((await call('/items', 'POST', { item: entry() }, 'alice', { Origin: 'https://simulearn.cn' })).status).toBe(201);
  });

  it('does not infer review or publication from learning progress and rejects unconfirmed publication', async () => {
    const saved = await create({ learningStatus: 'independent' });
    expect(saved).toMatchObject({ learningStatus: 'independent', reviewStatus: 'draft', visibility: 'private' });
    for (const [reviewStatus, publicConfirmed, publicBody] of [['draft', true, '公开正文'], ['reviewed', false, '公开正文'], ['reviewed', true, '']] as const) {
      expect((await call(`/items/${saved.id}`, 'PUT', {
        revision: 1, publicConfirmed, item: { ...saved, reviewStatus, visibility: 'public', fields: { publicBody } },
      })).status).toBe(400);
    }
    expect((await (await call(`/items/${saved.id}/history`)).json()).versions).toHaveLength(1);
  });

  it('publishes only the separate public draft and revokes it immediately on unpublish or delete', async () => {
    const saved = await create({ fields: { raw: 'private-secret', publicBody: '已核对的有限范围结论', attachments: 'private-url', runStatus: '未运行' }, sourceIds: [] });
    const publicItem = { ...saved, reviewStatus: 'reviewed', visibility: 'public' };
    expect((await call(`/items/${saved.id}`, 'PUT', { revision: 1, item: publicItem, publicConfirmed: true })).status).toBe(200);
    const response = await call(`/public/${owner}/${saved.id}`, 'GET', undefined, '');
    expect(response.status).toBe(200);
    const projection = (await response.json()).item;
    expect(projection.fields).toEqual({ publicBody: '已核对的有限范围结论' });
    expect(projection).not.toHaveProperty('sourceIds');
    expect(projection).not.toHaveProperty('reviewStatus');
    expect(JSON.stringify(projection)).not.toMatch(/private-secret|private-url|未运行/);
    expect((await call(`/items/${saved.id}/history`, 'GET', undefined, '')).status).toBe(401);
    expect((await call(`/items/${saved.id}`, 'PUT', { revision: 2, item: { ...publicItem, visibility: 'private' } })).status).toBe(200);
    expect((await call(`/public/${owner}/${saved.id}`, 'GET', undefined, '')).status).toBe(404);
    expect((await call(`/items/${saved.id}`, 'DELETE', { revision: 3 })).status).toBe(200);
    expect((await call(`/items/${saved.id}`)).status).toBe(404);
    expect((await call(`/public/${owner}/${saved.id}`, 'GET', undefined, '')).status).toBe(404);
    const stored = [...bucket.values.entries()].filter(([key]) => key.startsWith('study/'));
    expect(stored).toHaveLength(1);
    expect(JSON.parse(stored[0][1].value)).toEqual({ deleted: true });
  });
});

describe('optional study mutation account binding', () => {
  it('rejects an account-switched cookie before create, update, delete, quota or AI side effects', async () => {
    const alice = await create({ fields: { raw: 'PRIVATE ALICE INPUT' } });
    const bobResponse = await call('/items', 'POST', { item: entry({ title: 'Bob existing record' }) }, 'bob');
    expect(bobResponse.status).toBe(201);
    const bob = (await bobResponse.json()).item as StudyItem;
    Object.assign(env, { SIMULEARN_AI_MODE: 'live', DIFY_API_URL: 'https://dify.example/v1', DIFY_CHAT_APP_API_KEY: 'test-app-key', AI_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) } });
    const fetchMock = vi.fn();vi.stubGlobal('fetch', fetchMock);
    const before = new Map(bucket.values), serial = bucket.serial;
    const responses = [
      await call('/items', 'POST', { item: entry({ fields: alice.fields }), expectedOwner: owner }, 'bob'),
      await call(`/items/${bob.id}`, 'PUT', { revision: bob.revision, item: { ...bob, fields: alice.fields }, expectedOwner: owner }, 'bob'),
      await call(`/items/${bob.id}`, 'DELETE', { revision: bob.revision, expectedOwner: owner }, 'bob'),
      await call('/organize', 'POST', { raw: alice.fields.raw, expectedOwner: owner }, 'bob'),
    ];
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect((await response.json()).error).toContain('账户已变化');
    }
    expect(bucket.values).toEqual(before);expect(bucket.serial).toBe(serial);
    expect(env.AI_RATE_LIMITER!.limit).not.toHaveBeenCalled();expect(fetchMock).not.toHaveBeenCalled();
    expect((await (await call(`/items/${alice.id}`)).json()).item).toEqual(alice);
    expect((await (await call(`/items/${bob.id}`, 'GET', undefined, 'bob')).json()).item).toEqual(bob);
  });

  it('rejects malformed bindings on every mutation without treating them as absent', async () => {
    const saved = await create();
    Object.assign(env, { SIMULEARN_AI_MODE: 'live', DIFY_API_URL: 'https://dify.example/v1', DIFY_CHAT_APP_API_KEY: 'test-app-key' });
    const fetchMock = vi.fn();vi.stubGlobal('fetch', fetchMock);
    const before = new Map(bucket.values), serial = bucket.serial;
    for (const expectedOwner of [null, 42, [], {}, '', 'sl alice', `${owner}\n`, 'x'.repeat(101)]) {
      for (const [path, method, body] of [
        ['/items', 'POST', { item: entry() }],
        [`/items/${saved.id}`, 'PUT', { revision: saved.revision, item: saved }],
        [`/items/${saved.id}`, 'DELETE', { revision: saved.revision }],
        ['/organize', 'POST', { raw: 'Private input must stay local to this request' }],
      ] as const) {
        expect((await call(path, method, { ...body, expectedOwner })).status).toBe(403);
      }
    }
    expect(bucket.values).toEqual(before);expect(bucket.serial).toBe(serial);expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a matching authenticated account and preserves omitted-field compatibility', async () => {
    Object.assign(env, { SIMULEARN_AI_MODE: 'live', DIFY_API_URL: 'https://dify.example/v1', DIFY_CHAT_APP_API_KEY: 'test-app-key' });
    const fetchMock = vi.fn(async () => Response.json({ answer: 'Only a pending draft.' }));vi.stubGlobal('fetch', fetchMock);
    for (const binding of [{ expectedOwner: 'sl-bob' }, {}]) {
      const created = await call('/items', 'POST', { item: entry(), ...binding }, 'bob');expect(created.status).toBe(201);
      const saved = (await created.json()).item as StudyItem;
      const updated = await call(`/items/${saved.id}`, 'PUT', { revision: saved.revision, item: { ...saved, title: 'Updated by Bob' }, ...binding }, 'bob');
      expect(updated.status).toBe(200);expect((await updated.json()).item.revision).toBe(2);
      expect((await call('/organize', 'POST', { raw: 'Bob supplied this actual text.', ...binding }, 'bob')).status).toBe(200);
      expect((await call(`/items/${saved.id}`, 'DELETE', { revision: 2, ...binding }, 'bob')).status).toBe(200);
      expect((await call(`/items/${saved.id}`, 'GET', undefined, 'bob')).status).toBe(404);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) expect(JSON.parse(init.body as string).user).toBe('sl-bob');
  });
});

describe('study revision integrity and reusable references', () => {
  it('preserves full original snapshots and rejects stale edits without losing the latest revision', async () => {
    const saved = await create();
    expect((await call(`/items/${saved.id}`, 'PUT', { revision: 1, item: { ...saved, title: '本机读取完成', fields: { raw: '真实原始记录', publicBody: '待复核文本' } } })).status).toBe(200);
    expect((await call(`/items/${saved.id}`, 'PUT', { revision: 1, item: { ...saved, title: '过期窗口' } })).status).toBe(409);
    const versions = (await (await call(`/items/${saved.id}/history`)).json()).versions as StudyItem[];
    expect(versions.map((item) => item.revision)).toEqual([2, 1]);
    expect(versions[0].title).toBe('本机读取完成');
    expect(versions[1]).toEqual(saved);
  });

  it('uses atomic ETag conditions so only one simultaneous update can commit', async () => {
    const saved = await create();
    const responses = await Promise.all(['窗口一', '窗口二'].map((title) => call(`/items/${saved.id}`, 'PUT', { revision: 1, item: { ...saved, title } })));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const versions = (await (await call(`/items/${saved.id}/history`)).json()).versions;
    expect(versions).toHaveLength(2);
    expect(versions[0].revision).toBe(2);
    expect([...bucket.values.keys()].filter((key) => key.includes('/history/'))).toHaveLength(2);
    expect((await call(`/items/${saved.id}`, 'DELETE', { revision: 1 })).status).toBe(409);
  });

  it('reuses source/note IDs while preventing cross-owner or wrong-kind references', async () => {
    const source = await create({ kind: 'source', title: '官方 CSV 文档', fields: { url: 'https://docs.python.org/3/library/csv.html', readingStatus: '已收藏' } });
    const note = await create({ kind: 'note', title: '字符串与数值', sourceIds: [source.id] });
    const saved = await create({ sourceIds: [source.id, source.id], noteIds: [note.id] });
    expect(saved.sourceIds).toEqual([source.id]);
    expect(saved.noteIds).toEqual([note.id]);
    expect((await call('/items', 'POST', { item: entry({ sourceIds: [source.id] }) }, 'bob')).status).toBe(400);
    expect((await call('/items', 'POST', { item: entry({ sourceIds: [note.id] }) })).status).toBe(400);
    expect((await (await call('/items?kind=source')).json()).items).toHaveLength(1);
    expect((await call(`/items/${source.id}`, 'PUT', { revision: 1, item: { ...source, kind: 'note' } })).status).toBe(400);
  });

  it('fails closed when the object store cannot provide ETags', async () => {
    const saved = await create();
    const original = bucket.get.bind(bucket);
    bucket.get = async (key: string) => { const row = await original(key); if (row && key.includes('/items/')) delete (row as { etag?: string }).etag; return row; };
    expect((await call(`/items/${saved.id}`, 'PUT', { revision: 1, item: saved })).status).toBe(503);
  });

  it('bounds field counts, types, references and streamed UTF-8 request size', async () => {
    for (const fields of [{ raw: 'x'.repeat(32_001) }, { raw: 42 }, Object.fromEntries(Array.from({ length: 49 }, (_, i) => [`field${i}`, 'x']))]) {
      expect((await call('/items', 'POST', { item: entry({ fields }) })).status).toBe(400);
    }
    expect((await call('/items', 'POST', { item: entry({ learningStatus: 'mastered' }) })).status).toBe(400);
    expect((await call('/items', 'POST', { item: entry(), padding: '中'.repeat(44_000) })).status).toBe(413);
    const store = new StudyStore(bucket as unknown as BooksBucket);
    await expect(store.get(owner, '../users')).rejects.toMatchObject({ status: 400 });
  });
});

describe('on-demand AI organization', () => {
  it('has every original evidence rule and never fabricates a mock draft', async () => {
    for (let i = 1; i <= 12; i++) expect(ORGANIZE_PROMPT).toContain(`${i}. `);
    expect(ORGANIZE_PROMPT).toContain('日期缺失时写“未提供”');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await call('/organize', 'POST', { raw: '还没运行程序' })).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect([...bucket.values.keys()].filter((key) => key.startsWith('study/'))).toEqual([]);
    expect((await call('/organize', 'POST', { raw: 'test' }, '')).status).toBe(401);
  });

  it('sends only the submitted raw record on request and returns a pending preview without saving', async () => {
    await create({ fields: { raw: 'other-private-record' } });
    const before = new Map([...bucket.values].filter(([key]) => key.startsWith('study/')));
    Object.assign(env, { SIMULEARN_AI_MODE: 'live', DIFY_API_URL: 'https://dify.example/v1', DIFY_CHAT_APP_API_KEY: 'test-app-key' });
    const fetchMock = vi.fn(async () => Response.json({ answer: 'A. 实际尝试：待补充。结果：待运行。' }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await call('/organize', 'POST', { raw: '本次只创建了 CSV，没有运行。' });
    expect(response.status).toBe(200);
    expect((await response.json()).draft).toContain('待人工核对 · 未保存、未公开');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://dify.example/v1/chat-messages');
    const payload = JSON.parse(init.body as string);
    expect(payload.user).toBe(owner);
    expect(payload.query).toContain(ORGANIZE_PROMPT);
    expect(payload.query).toContain('本次只创建了 CSV，没有运行。');
    expect(payload.query).not.toContain('other-private-record');
    expect(new Map([...bucket.values].filter(([key]) => key.startsWith('study/')))).toEqual(before);
    expect(bucket.values.has(`users/${owner}/ai-quota.json`)).toBe(true);
  });

  it('reports upstream failure instead of saving or claiming success', async () => {
    Object.assign(env, { SIMULEARN_AI_MODE: 'live', DIFY_API_URL: 'https://dify.example', DIFY_CHAT_APP_API_KEY: 'test-app-key' });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'unavailable' }, { status: 503 })));
    expect((await call('/organize', 'POST', { raw: '真实但不完整的记录' })).status).toBe(502);
    expect([...bucket.values.keys()].filter((key) => key.startsWith('study/'))).toEqual([]);
  });

  it('checks account AI quota before calling Dify and returns a readable 429', async () => {
    Object.assign(env, { SIMULEARN_AI_MODE: 'live', DIFY_API_URL: 'https://dify.example', DIFY_CHAT_APP_API_KEY: 'test-app-key', AI_RATE_LIMITER: { limit: vi.fn(async () => ({ success: false })) } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await call('/organize', 'POST', { raw: '本次记录' });
    expect(response.status).toBe(429);
    expect((await response.json()).error).toContain('频繁');
    expect(env.AI_RATE_LIMITER!.limit).toHaveBeenCalledWith({ key: owner });
    expect(fetchMock).not.toHaveBeenCalled();
    delete env.AI_RATE_LIMITER;
    const now = new Date().toISOString();
    await bucket.put(`users/${owner}/ai-quota.json`, JSON.stringify({ hour: now.slice(0, 13), hourCount: 20, day: now.slice(0, 10), dayCount: 20 }));
    expect((await call('/organize', 'POST', { raw: '本次记录' })).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports timeout without losing existing content and rejects drafts exceeding the field limit', async () => {
    const saved = await create();
    Object.assign(env, { SIMULEARN_AI_MODE: 'live', DIFY_API_URL: 'https://dify.example', DIFY_CHAT_APP_API_KEY: 'test-app-key' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); }));
    const timeout = await call('/organize', 'POST', { raw: '本次记录' });
    expect(timeout.status).toBe(504);
    expect((await timeout.json()).error).toContain('超时');
    expect((await (await call(`/items/${saved.id}`)).json()).item).toEqual(saved);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ answer: 'x'.repeat(32_001) })));
    const tooLong = await call('/organize', 'POST', { raw: '本次记录' });
    expect(tooLong.status).toBe(502);
    expect((await tooLong.json()).error).toContain('过长');
    expect((await (await call(`/items/${saved.id}/history`)).json()).versions).toHaveLength(1);
  });
});
