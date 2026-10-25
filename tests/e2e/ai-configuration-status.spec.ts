import { expect, test } from '@playwright/test';

test('AI configuration states never imply a verified upstream connection or trigger a business call', async ({ page, context, baseURL }) => {
  const local = baseURL ? new URL(baseURL) : null;
  test.skip(!local || local.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(local.hostname), 'Synthetic AI configuration responses stay on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  const writes: string[] = [], upstream: string[] = [], businessCalls: string[] = [];
  context.on('request', request => {
    const url = new URL(request.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(url.pathname);
    if (url.hostname === 'ai.simulearn.cn') upstream.push(request.url());
    if (/^\/api\/ai\/(?:chat|analyze|publish)(?:\/|$)/.test(url.pathname)) businessCalls.push(url.pathname);
  });
  let health: { status?: number; body: unknown } = { body: null };
  await context.route('**/api/ai/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/ai/health') return route.fulfill({ status: health.status ?? 200, json: health.body });
    if (path === '/api/ai/datasets') return route.fulfill({ json: { ok: true, datasets: [] } });
    return route.fulfill({ status: 503, json: { ok: false, error: 'No real AI call is permitted in this local UI test.' } });
  });

  const cases = [
    { body: { ok: true, mode: 'live', configured: { chat: true, review: false, datasets: true } },
      label: '实时服务未配置完整', dot: 'incomplete', detail: '资料整理：未配置' },
    { body: { ok: true, mode: 'live', configured: { chat: true, review: true, datasets: true } },
      label: '实时服务已配置', dot: 'configured', detail: '未验证实际调用' },
    // Demo mode is a mode declaration, not proof that credentials are absent.
    { body: { ok: true, mode: 'mock', configured: { chat: true, review: true, datasets: true } },
      label: '演示模式', dot: 'mock', detail: '未验证真实服务调用' },
    { body: { ok: true, mode: 'live', configured: { chat: 'true', review: true, datasets: true } },
      label: '配置检查失败', dot: 'error', detail: '未返回完整的服务配置声明' },
    { body: { ok: true, mode: 'unknown', configured: { chat: true, review: true, datasets: true } },
      label: '配置检查失败', dot: 'error', detail: '不受支持的格式' },
    { status: 503, body: { ok: false, error: 'Configuration endpoint unavailable' },
      label: '配置检查失败', dot: 'error', detail: 'Configuration endpoint unavailable' },
  ];
  for (const item of cases) {
    health = item;
    await page.goto('/ai/');
    await expect(page.locator('[data-runtime-label]')).toHaveText(item.label);
    await expect(page.locator('.runtime-dot')).toHaveClass(`runtime-dot ${item.dot}`);
    await expect(page.locator('[data-runtime-detail]')).toContainText(item.detail);
    await expect(page.locator('.runtime-card')).not.toContainText('已连接');
    await expect(page.locator('.runtime-card')).not.toContainText('尚未写入真实密钥');
  }
  expect(writes).toEqual([]); expect(upstream).toEqual([]); expect(businessCalls).toEqual([]);
});
