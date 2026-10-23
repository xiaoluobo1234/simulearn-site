import { describe, expect, it } from 'vitest';
import worker from '../worker/index';

const env = {
  JWT_SECRET: 'local-study-test-only',
  BOOKS: {} as any,
  ASSETS: { fetch: async () => new Response('asset') },
};

describe('study Worker routing', () => {
  it('routes private records through real auth without an anonymous learning cookie', async () => {
    const response = await worker.fetch(new Request('https://simulearn.cn/api/study/items?kind=record'), env);
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('rejects study writes without the signed CSRF token before dispatch', async () => {
    const response = await worker.fetch(new Request('https://simulearn.cn/api/study/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item: {} }),
    }), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, error: expect.stringContaining('CSRF') });
  });

  it('leaves the public learning page with the existing static asset handler', async () => {
    const response = await worker.fetch(new Request('https://simulearn.cn/learning/'), env);
    expect(await response.text()).toBe('asset');
  });
});
