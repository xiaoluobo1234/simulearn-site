import { expect, test, type Locator, type Page } from '@playwright/test';

const longToken = 'engineering_reference_'.repeat(45);
const longLink = `https://example.invalid/synthetic-layout/${longToken}`;

async function noPageOverflow(page: Page) {
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, htmlOverflow: getComputedStyle(document.documentElement).overflowX, bodyOverflow: getComputedStyle(document.body).overflowX }));
  expect(size.width).toBeLessThanOrEqual(size.viewport);
  expect(size.htmlOverflow).not.toBe('hidden'); expect(size.bodyOverflow).not.toBe('hidden');
}
async function contrast(node: Locator, surface: string) {
  return node.evaluate((element, selector) => {
    const background = element.closest(selector)!;
    const luminance = (color: string) => {
      const rgb = [...color.matchAll(/[\d.]+/g)].slice(0, 3).map(value => Number(value[0]) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
    };
    const a = luminance(getComputedStyle(element).color), b = luminance(getComputedStyle(background).backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }, surface);
}

test.beforeEach(async ({ page, context, baseURL }) => {
  const local = baseURL ? new URL(baseURL) : null;
  test.skip(!local || local.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(local.hostname), 'Synthetic layout fixtures must stay on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: { ok: true, user: null } });
    if (path === '/api/auth/csrf-token') return route.fulfill({ json: { ok: true, token: 'local-layout-only' } });
    if (path === '/api/ai/health') return route.fulfill({ json: { ok: true, mode: 'mock', configured: { chat: false, review: false, datasets: false } } });
    if (path === '/api/ai/datasets') return route.fulfill({ json: { ok: true, datasets: [] } });
    if (path === '/api/ai/chat' && request.method() === 'POST') return route.fulfill({ json: { ok: true, conversationId: 'synthetic-layout-only', answer: `合成布局回复，不是真实模型回答。\n${longToken}\n${longLink}`, sources: [{ document: `SYNTHETIC SOURCE ${longToken}`, dataset: '合成来源', score: .8, excerpt: `合成引用摘要 ${longLink}` }] } });
    if (path.startsWith('/api/knowledge/')) return route.fulfill({ json: { ok: true, content: { title: `合成标题 ${longToken}`, description: `合成长描述 ${longLink}`, aiContent: `# 合成预览\n\n${longLink}` } } });
    if (path.startsWith('/api/ai/content/')) return route.fulfill({ json: { ok: true, overrides: [], override: null } });
    return route.fulfill({ status: 503, json: { ok: false, error: 'No real AI or writes are permitted in this layout test.' } });
  });
  page.on('dialog', dialog => dialog.dismiss());
});

for (const theme of ['light', 'dark'] as const) {
  test(`390px ${theme}: a submitted synthetic answer and long source wrap inside the workbench`, async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(value => localStorage.setItem('simulearn-theme', value), theme);
    const errors: string[] = [], writes: string[] = [], upstream: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    context.on('request', request => { const url = new URL(request.url()); if (!['GET', 'HEAD'].includes(request.method())) writes.push(url.pathname); if (url.hostname === 'ai.simulearn.cn') upstream.push(url.href); });
    await page.goto('/ai/');
    const actualTheme = await page.locator('html').getAttribute('data-theme');
    expect(actualTheme === 'dark' ? 'dark' : 'light').toBe(theme);
    const nav = page.locator('.workspace-nav nav');
    expect(await nav.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    await noPageOverflow(page);
    await page.locator('[data-chat-form] textarea').fill(`合成布局请求 ${longToken}`);
    await page.locator('[data-chat-form] [type="submit"]').click();
    const answer = page.locator('.message-assistant').last();
    await expect(answer).toContainText('合成布局回复'); await expect(answer.locator('.source-list')).toContainText('合成引用摘要');
    await noPageOverflow(page);
    expect(await answer.evaluate(node => getComputedStyle(node).display)).toBe('grid');
    expect(await contrast(answer.locator(':scope > div:last-child > p'), '.message > div:last-child')).toBeGreaterThanOrEqual(4.5);
    expect(await contrast(answer.locator('.source-list p > span'), '.message > div:last-child')).toBeGreaterThanOrEqual(4.5);
    expect(await contrast(page.locator('.message-user .message-label'), '.message > div:last-child')).toBeGreaterThanOrEqual(4.5);
    expect(writes).toEqual(['/api/ai/chat']); expect(upstream).toEqual([]); expect(errors).toEqual([]);
    await page.screenshot({ path: `.wrangler/qa/ai-workbench-mobile/dynamic-chat-${theme}.png`, fullPage: true });
  });
}

test('mobile dark content editing uses local code and table scrolling while panel switching stays within the viewport', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('simulearn-theme', 'dark'));
  const writes: string[] = [], errors: string[] = [];
  context.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/ai/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  for (const panel of ['organize', 'review', 'datasets', 'content']) {
    await page.locator(`[data-tab="${panel}"]`).click(); await expect(page.locator(`[data-panel="${panel}"]`)).toBeVisible(); await noPageOverflow(page);
  }
  await page.locator('[data-content-kp]').first().click(); await expect(page.locator('[data-content-editor-form]')).toBeVisible();
  await page.locator('[data-content-edit-body]').fill(`# 合成编辑内容\n\n${longLink}`);
  await page.locator('[data-content-tab="preview"]').click();
  const preview = page.locator('[data-content-preview]'); await expect(preview).toContainText('合成编辑内容'); await noPageOverflow(page);
  // Structural layout fixtures exercise dynamic Markdown descendants directly;
  // this test makes no claim about the separate Markdown parser's features.
  await preview.evaluate((node, text) => {
    const pre = document.createElement('pre'), code = document.createElement('code'); code.textContent = `synthetic_result = "${text}"`; pre.append(code); node.append(pre);
    const table = document.createElement('table'), row = document.createElement('tr'); for (let i = 0; i < 12; i++) { const cell = document.createElement('td'); cell.textContent = `synthetic_column_${i}`; row.append(cell); } table.append(row); node.append(table);
  }, longToken);
  const codeBox = preview.locator('pre').last(), table = preview.locator('table').last();
  for (const localScroll of [codeBox, table]) {
    const size = await localScroll.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth, overflow: getComputedStyle(node).overflowX }));
    expect(size.scroll).toBeGreaterThan(size.width); expect(size.overflow).toBe('auto');
  }
  expect(await contrast(codeBox.locator('code'), 'pre')).toBeGreaterThanOrEqual(4.5);
  await noPageOverflow(page); expect(writes).toEqual([]); expect(errors).toEqual([]);
  await page.screenshot({ path: '.wrangler/qa/ai-workbench-mobile/content-long-preview-dark.png', fullPage: true });
});
