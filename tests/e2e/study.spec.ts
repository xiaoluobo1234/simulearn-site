import { expect, test } from '@playwright/test';

// Browser fixtures test UI behavior only. They are never written to production R2.
test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  await page.route('**/api/auth/csrf-token', route => route.fulfill({ json: { ok: true, token: 'browser-fixture-token' } }));
});

test('learning overview distinguishes proposed tasks from actual results on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/learning/');
  await expect(page.getByRole('heading', { name: /让每一次学习/ })).toBeVisible();
  await expect(page.getByText('项目状态 · 拟开展')).toBeVisible();
  await expect(page.locator('tbody .waiting')).toHaveCount(4);
  await expect(page.locator('#desk-message')).toContainText('登录后保存私人草稿');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.wrangler/qa/learning-overview-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '.wrangler/qa/learning-overview-desktop.png', fullPage: true });
});

test('unsigned learning input can be exported without claiming it was saved', async ({ page }) => {
  await page.goto('/learning/records/');
  await expect(page.locator('#study-auth')).toContainText('登录后');
  await page.locator('#study-title').fill('浏览器测试：一次尚未运行的 CSV 尝试');
  await page.locator('[name="field:problem"]').fill('如何读取表头？');
  await page.locator('[name="field:actualOutput"]').fill('未运行');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#study-export').click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.md$/);
  await expect(page.locator('#study-save-state')).toContainText('未保存');
  await page.locator('#study-save').click();
  await expect(page.locator('#study-message')).toContainText('请先登录');
});

test('AI suggestion is previewed before application and preserves independent learning state', async ({ page }) => {
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: { userId: 'fixture-user' } } }));
  await page.route('**/api/study/items?*', route => route.fulfill({ json: { ok: true, items: [] } }));
  await page.route('**/api/study/organize', route => route.fulfill({ json: { ok: true, draft: 'AI 草稿：待用户核对；实际结果未运行。' } }));
  await page.goto('/learning/records/');
  await expect(page.locator('#study-auth')).toContainText('账户已连接');
  await page.locator('[name="field:problem"]').fill('读取 CSV');
  await page.locator('[name="learningStatus"]').selectOption('introduced');
  await page.locator('[name="reviewStatus"]').selectOption('pending');
  await page.locator('#study-body').fill('原整理稿');
  await page.locator('#study-organize').click();
  await expect(page.locator('#study-ai-dialog')).toBeVisible();
  await expect(page.locator('#study-body')).toHaveValue('原整理稿');
  await page.locator('#study-apply-ai').click();
  await expect(page.locator('#study-body')).toHaveValue(/AI 草稿/);
  await expect(page.locator('[name="learningStatus"]')).toHaveValue('introduced');
  await expect(page.locator('[name="reviewStatus"]')).toHaveValue('draft');
  await expect(page.locator('[name="visibility"]')).toHaveValue('private');
  await expect(page.locator('#study-save-state')).toContainText('未保存');
});

test('reviewed publication requires a separate public body and explicit checkbox', async ({ page }) => {
  await page.goto('/learning/records/');
  await page.locator('#study-publish').click();
  await expect(page.locator('#study-message')).toContainText('已核对');
  await page.locator('[name="reviewStatus"]').selectOption('reviewed');
  await page.locator('#study-publish').click();
  await expect(page.locator('#study-public-dialog')).toBeVisible();
  await expect(page.locator('#study-public-body')).toHaveValue('');
  await page.locator('#study-confirm-publish').click();
  await expect(page.locator('#study-public-error')).toContainText('本人核对确认');
});

test('shared record renders only supplied public projection as text', async ({ page }) => {
  await page.route('**/api/study/public/*/*', route => route.fulfill({ json: { ok: true, item: { title: '公开测试正文', revision: 1, fields: { publicBody: '<script>unsafe()</script>\n待复现' } } } }));
  await page.goto('/learning/shared/?owner=fixture&id=fixture');
  await expect(page.locator('#shared-title')).toHaveText('公开测试正文');
  await expect(page.locator('#shared-body')).toContainText('<script>unsafe()</script>');
  await expect(page.locator('#shared-body script')).toHaveCount(0);
});

test('local Worker persists revisions in R2 and exposes only explicitly confirmed public text', async ({ request, baseURL }) => {
  test.skip(!baseURL?.startsWith('http://127.0.0.1:'), 'Local acceptance data must never be sent to production.');
  const csrfResponse = await request.get('/api/auth/csrf-token');
  const { token } = await csrfResponse.json();
  const csrf = { 'X-CSRF-Token': token };
  const registered = await request.post('/api/auth/email/register', {
    headers: csrf,
    data: { email: `study-${crypto.randomUUID()}@example.invalid`, password: 'local-acceptance-only', name: '本地验收账户' },
  });
  expect(registered.status()).toBe(200);
  const { user } = await registered.json();
  // The test request context uses HTTP loopback. Supply the local test session
  // explicitly instead of changing the production Secure cookie policy.
  const cookie = registered.headers()['set-cookie'].split(';')[0];
  const headers = { ...csrf, Cookie: cookie };
  const item = {
    kind: 'record', title: '本地验收记录（非学习成果）',
    fields: { raw: 'PRIVATE RAW: synthetic acceptance fixture', actualOutput: '未运行', publicBody: '可公开正文：仍待复现' },
    sourceIds: [], noteIds: [], learningStatus: 'introduced', reviewStatus: 'draft', visibility: 'private',
  };
  const created = await request.post('/api/study/items', { headers, data: { item } });
  expect(created.status()).toBe(201);
  const saved = (await created.json()).item;
  expect(saved.revision).toBe(1);
  expect((await request.get(`/api/study/items/${saved.id}`, { headers })).status()).toBe(200);
  const publicPath = `/api/study/public/${user.userId}/${saved.id}`;
  expect((await request.get(publicPath)).status()).toBe(404);
  const publication = { ...saved, reviewStatus: 'reviewed', visibility: 'public' };
  expect((await request.put(`/api/study/items/${saved.id}`, { headers, data: { revision: 1, item: publication } })).status()).toBe(400);
  const published = await request.put(`/api/study/items/${saved.id}`, { headers, data: { revision: 1, item: publication, publicConfirmed: true } });
  expect(published.status()).toBe(200);
  const exposed = await request.get(publicPath);
  expect(exposed.status()).toBe(200);
  const publicText = await exposed.text();
  expect(publicText).toContain('可公开正文');
  expect(publicText).not.toContain('PRIVATE RAW');
  expect(publicText).not.toContain('sourceIds');
  expect((await request.put(`/api/study/items/${saved.id}`, { headers, data: { revision: 1, item: saved } })).status()).toBe(409);
  const latest = (await published.json()).item;
  expect((await request.put(`/api/study/items/${saved.id}`, { headers, data: { revision: latest.revision, item: { ...latest, visibility: 'private' } } })).status()).toBe(200);
  expect((await request.get(publicPath)).status()).toBe(404);
  const history = await request.get(`/api/study/items/${saved.id}/history`, { headers });
  expect((await history.json()).versions.map((v: { revision: number }) => v.revision)).toEqual([3, 2, 1]);
  const ai = await request.post('/api/study/organize', { headers, data: { raw: '本地验收。尚未运行实验。' } });
  expect(ai.status()).toBe(503);
});
