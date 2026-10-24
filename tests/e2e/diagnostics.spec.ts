import { expect, test, type Download } from '@playwright/test';

// Synthetic browser/API fixtures only. Real persistence is exercised solely on
// loopback, using an ephemeral local account, never on production R2 or a solver.
test.beforeEach(async ({ page, baseURL }) => {
  const url = baseURL ? new URL(baseURL) : null;
  test.skip(!url || url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Diagnostic acceptance data is local-only.');
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('https://cdn.jsdelivr.net/npm/mathjax@3/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  await page.route('**/api/auth/csrf-token', route => route.fulfill({ json: { ok: true, token: 'diagnostic-browser-fixture-token' } }));
});

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('six diagnostic paths support combined filters, refresh, empty state and reset', async ({ page }) => {
  await page.goto('/diagnostic/');
  await expect(page.locator('[data-diagnostic-card]')).toHaveCount(6);
  await expect(page.locator('[data-diagnostic-card]:visible')).toHaveCount(6);
  await expect(page.locator('#diagnostic-count')).toHaveText('共 6 条排查路径');
  await page.locator('#diagnostic-query').fill('密度');
  await page.locator('#diagnostic-stage').selectOption('setup');
  await expect(page.locator('[data-diagnostic-card]:visible')).toHaveCount(1);
  await expect(page.locator('#diag-units')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('q')).toBe('密度');
  expect(new URL(page.url()).searchParams.get('stage')).toBe('setup');
  await page.reload();
  await expect(page.locator('#diagnostic-query')).toHaveValue('密度');
  await expect(page.locator('#diagnostic-stage')).toHaveValue('setup');
  await expect(page.locator('[data-diagnostic-card]:visible')).toHaveCount(1);
  await page.locator('#diagnostic-query').fill('definitely-no-matching-diagnostic');
  await expect(page.locator('#diagnostic-count')).toHaveText('共 0 条排查路径');
  await expect(page.locator('#diagnostic-empty')).toBeVisible();
  await expect(page.locator('[data-diagnostic-card]:visible')).toHaveCount(0);
  await page.locator('#diagnostic-reset').click();
  await expect(page.locator('#diagnostic-query')).toHaveValue('');
  await expect(page.locator('#diagnostic-stage')).toHaveValue('');
  await expect(page.locator('#diagnostic-query')).toBeFocused();
  await expect(page.locator('#diagnostic-empty')).toBeHidden();
  await expect(page.locator('[data-diagnostic-card]:visible')).toHaveCount(6);
  expect(new URL(page.url()).search).toBe('');
});

test('legacy diagnostic hash keeps the target discoverable despite incompatible filters', async ({ page }) => {
  await page.goto('/diagnostic/?q=no-match&stage=results#diag-units');
  await expect(page.locator('#diagnostic-query')).toHaveValue('');
  await expect(page.locator('#diagnostic-stage')).toHaveValue('');
  await expect(page.locator('[data-diagnostic-card]:visible')).toHaveCount(6);
  await expect(page.locator('#diag-units')).toBeInViewport();
  await expect(page.locator('#diag-units h3 a')).toHaveAttribute('href', '/diagnostic/units/');
  await page.locator('#diag-units h3 a').click();
  await expect(page).toHaveURL(/\/diagnostic\/units\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('单位与数量级');
});

test('a diagnostic detail separates checks, possible causes and sources, then opens a genuinely blank linked review', async ({ page }) => {
  await page.goto('/diagnostic/units/');
  await expect(page.locator('.diagnostic-draft')).toContainText('待本人复核');
  await expect(page.locator('#checks h2')).toHaveText('逐项核对证据');
  expect(await page.locator('.diagnostic-check-list > li').count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator('#causes h2')).toContainText('可能原因');
  await expect(page.locator('#sources .diagnostic-sources a').first()).toHaveAttribute('href', /^https:\/\//);
  await expect(page.locator('#sources')).toContainText('已核对');
  await page.locator('.diagnostic-detail-index a[href="/failures/review/?diagnostic=units"]').click();
  await expect(page.locator('#failure-auth')).toContainText('匿名编辑');
  await expect(page.locator('[name="diagnosticId"]')).toHaveValue('units');
  await expect(page.locator('[name="title"]')).toHaveValue(/单位与数量级.*失败复盘/);
  for (const name of ['date', 'model', 'symptom', 'attempts', 'actual', 'change', 'retest', 'evidence']) {
    await expect(page.locator(`#failure-form [name="${name}"]`)).toHaveValue('');
  }
  await expect(page.locator('[name="executor"]')).toHaveValue('未运行');
  await expect(page.locator('[name="reproduction"]')).toHaveValue('未运行');
  await expect(page.locator('#failure-status')).toContainText('空白复盘');
});

test('three failure examples expose honest teaching labels and reproducible script/JSON evidence', async ({ page }) => {
  await page.goto('/failures/');
  const examples = page.locator('article.failure-example');
  await expect(examples).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(examples.nth(i)).toContainText('教学排查示例·AI环境参考计算·待本人复核');
    await expect(examples.nth(i)).toContainText('用户本机待复现');
    await expect(examples.nth(i).getByRole('link', { name: '实际计算证据 ↗' })).toHaveAttribute('href', '/downloads/diagnostics/reference-examples.json');
  }
  await expect(page.locator('#density-scale')).toContainText('1000 倍');
  await expect(page.locator('#free-bar-singularity')).toContainText('拒绝返回位移');
  await expect(page.locator('#thermal-axial-lock')).toContainText('取决于真实结构');
  const scriptDownload = page.waitForEvent('download');
  await page.locator('a[download][href="/downloads/diagnostics/diagnostic_examples.py"]').click();
  const script = await scriptDownload;
  expect(script.suggestedFilename()).toBe('diagnostic_examples.py');
  expect(await downloadText(script)).toContain('def solve(');
  const jsonDownload = page.waitForEvent('download');
  await page.locator('a[download][href="/downloads/diagnostics/reference-examples.json"]').click();
  const reference = JSON.parse(await downloadText(await jsonDownload));
  expect(reference.status).toBe('教学排查示例·AI环境参考计算·待本人复核');
  expect(reference.execution.executor).toBe('Codex AI执行环境中的Python参考计算');
  expect(reference.execution.not_evidence_of).toContain('ANSYS 求解');
  expect(reference.units.mass_ratio).toBeCloseTo(1000);
  expect(reference.rigid_body.free_elimination_rejected).toBe(true);
  expect(reference.boundary.both_axial_ends_fixed.axial_stress_MPa).toBeCloseTo(-126);
});

test('anonymous review exports Markdown/JSON without posting private text or writing it to localStorage', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.url());
  });
  await page.addInitScript(() => {
    const writes: string[] = [];
    (window as unknown as { diagnosticStorageWrites: string[] }).diagnosticStorageWrites = writes;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === window.localStorage) writes.push(`${key}:${value}`);
      return original.call(this, key, value);
    };
  });
  await page.goto('/failures/review/');
  await expect(page.locator('#failure-auth')).toContainText('匿名编辑');
  await page.locator('[name="title"]').fill('匿名验收：尚未运行的排查');
  await page.locator('[name="symptom"]').fill('PRIVATE SYNTHETIC TEXT: no actual solver run');
  await page.locator('[name="hypothesis"]').fill('尚未验证的猜测');
  await page.locator('[name="version"]').fill('2025 R2');
  const mdDownload = page.waitForEvent('download');
  await page.locator('#failure-export-md').click();
  const md = await mdDownload;
  expect(md.suggestedFilename()).toMatch(/\.md$/);
  const markdown = await downloadText(md);
  expect(markdown).toContain('PRIVATE SYNTHETIC TEXT');
  expect(markdown).toContain('原因假设不等于已证实的根因');
  expect(markdown).toContain('实际发生日期：未提供');
  const jsonDownload = page.waitForEvent('download');
  await page.locator('#failure-export-json').click();
  const json = JSON.parse(await downloadText(await jsonDownload));
  expect(json.failureReview.versionSchema).toBe(1);
  expect(json.failureReview.version).toBe('2025 R2');
  expect(json.failureReview.executor).toBe('未运行');
  expect(json.failureReview.reproduction).toBe('未运行');
  expect(json.failureReview.date).toBe('');
  expect(json.failureReview.symptom).toContain('PRIVATE SYNTHETIC TEXT');
  await expect(page.locator('#failure-status')).toContainText('导出不代表账户已保存');
  await page.locator('#failure-save').click();
  await expect(page.locator('#failure-status')).toContainText('请先');
  await expect(page.locator('[name="symptom"]')).toHaveValue('PRIVATE SYNTHETIC TEXT: no actual solver run');
  expect(mutations).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { diagnosticStorageWrites: string[] }).diagnosticStorageWrites)).toEqual([]);
  expect(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('PRIVATE SYNTHETIC TEXT')))).toBe(false);
});

test('an ephemeral local account saves, reloads and revises a private review without exposing public text', async ({ page, request, context, baseURL }) => {
  await page.unroute('**/api/auth/me');
  await page.unroute('**/api/auth/csrf-token');
  const csrfResponse = await request.get('/api/auth/csrf-token');
  expect(csrfResponse.ok()).toBe(true);
  const { token } = await csrfResponse.json();
  const registered = await request.post('/api/auth/email/register', {
    headers: { 'X-CSRF-Token': token },
    data: { email: `diagnostic-${crypto.randomUUID()}@example.invalid`, password: 'local-acceptance-only', name: '本地复盘验收账户' },
  });
  expect(registered.status()).toBe(200);
  const { user } = await registered.json();
  const cookie = registered.headers()['set-cookie'].split(';')[0];
  const separator = cookie.indexOf('=');
  // Explicitly install this loopback-only test session over HTTP. Production's
  // Secure cookie configuration is not changed by this synthetic browser fixture.
  await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: baseURL!, httpOnly: true, secure: false, sameSite: 'Lax' }]);
  await page.goto('/failures/review/?diagnostic=units');
  await expect(page.locator('#failure-auth')).toContainText('账户已连接');
  await page.locator('[name="title"]').fill('本地验收复盘：非真实求解经历');
  await page.locator('[name="symptom"]').fill('PRIVATE LOCAL FIXTURE: 未运行，仅验证保存。');
  const createdResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/study/items' && response.request().method() === 'POST');
  await page.locator('#failure-save').click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const saved = (await created.json()).item;
  expect(saved.visibility).toBe('private');
  expect(saved.reviewStatus).toBe('draft');
  expect(saved.learningStatus).toBe('not-started');
  expect(saved.fields.recordType).toBe('失败复盘');
  expect(saved.fields.date).toBe('');
  await expect(page.locator('#failure-status')).toContainText('修订 1');
  expect(new URL(page.url()).searchParams.get('id')).toBe(saved.id);
  await page.reload();
  await expect(page.locator('#failure-status')).toContainText('已读取私人复盘 · 修订 1');
  await expect(page.locator('[name="symptom"]')).toHaveValue('PRIVATE LOCAL FIXTURE: 未运行，仅验证保存。');
  await expect(page.locator('[name="diagnosticId"]')).toHaveValue('units');
  await page.locator('[name="attempts"]').fill('只检查了浏览器保存流程；没有运行仿真。');
  const updatedResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/study/items/${saved.id}` && response.request().method() === 'PUT');
  await page.locator('#failure-save').click();
  expect((await updatedResponse).status()).toBe(200);
  await expect(page.locator('#failure-status')).toContainText('修订 2');
  await page.reload();
  await expect(page.locator('#failure-status')).toContainText('已读取私人复盘 · 修订 2');
  await expect(page.locator('[name="attempts"]')).toHaveValue('只检查了浏览器保存流程；没有运行仿真。');
  const headers = { Cookie: cookie };
  const latest = await request.get(`/api/study/items/${saved.id}`, { headers });
  expect(latest.status()).toBe(200);
  const item = (await latest.json()).item;
  expect(item.revision).toBe(2);
  expect(item.visibility).toBe('private');
  expect(item.reviewStatus).toBe('draft');
  expect(item.learningStatus).toBe('not-started');
  const history = await request.get(`/api/study/items/${saved.id}/history`, { headers });
  expect((await history.json()).versions.map((version: { revision: number }) => version.revision)).toEqual([2, 1]);
  const publicResponse = await request.get(`/api/study/public/${user.userId}/${saved.id}`);
  expect(publicResponse.status()).toBe(404);
  expect(await publicResponse.text()).not.toContain('PRIVATE LOCAL FIXTURE');
});

test('a 409 save conflict preserves the complete edited review and leaves export available', async ({ page }) => {
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: { userId: 'local-conflict-fixture' } } }));
  await page.route('**/api/study/items?*', route => route.fulfill({ json: { ok: true, items: [] } }));
  const id = 'record-12345678-1234-4123-8123-123456789abc';
  let saved: Record<string, any> | undefined;
  await page.route('**/api/study/items', async route => {
    expect(route.request().method()).toBe('POST');
    saved = { ...route.request().postDataJSON().item, id, revision: 1, createdAt: '2026-10-24T01:00:00Z', updatedAt: '2026-10-24T01:00:00Z' };
    await route.fulfill({ status: 201, json: { ok: true, item: saved } });
  });
  await page.route(`**/api/study/items/${id}`, route => route.fulfill({ status: 409, json: { ok: false, error: 'synthetic revision conflict' } }));
  await page.goto('/failures/review/');
  await expect(page.locator('#failure-auth')).toContainText('账户已连接');
  await page.locator('[name="title"]').fill('冲突验收：保留未合并输入');
  await page.locator('#failure-save').click();
  await expect(page.locator('#failure-status')).toContainText('修订 1');
  expect(saved?.visibility).toBe('private');
  await page.locator('[name="attempts"]').fill('本页新增、尚未合并的检查步骤。');
  await page.locator('[name="evidence"]').fill('PRIVATE CONFLICT FIXTURE: keep this exact evidence');
  await page.locator('#failure-save').click();
  await expect(page.locator('#failure-status')).toContainText('保存冲突');
  await expect(page.locator('#failure-status')).toContainText('完整保留');
  await expect(page.locator('[name="attempts"]')).toHaveValue('本页新增、尚未合并的检查步骤。');
  await expect(page.locator('[name="evidence"]')).toHaveValue('PRIVATE CONFLICT FIXTURE: keep this exact evidence');
  await expect(page.locator('#failure-save')).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.locator('#failure-export-json').click();
  const exported = JSON.parse(await downloadText(await download));
  expect(exported.failureReview.evidence).toBe('PRIVATE CONFLICT FIXTURE: keep this exact evidence');
  expect(exported.failureReview.attempts).toBe('本页新增、尚未合并的检查步骤。');
});

test('diagnostic, example and private editor pages remain usable at 390px in dark mode', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const path of ['/diagnostic/', '/diagnostic/rigid-body/', '/failures/', '/failures/review/']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (path === '/failures/') await page.locator('.failure-example details').first().locator('summary').click();
    if (path === '/failures/review/') {
      await expect(page.locator('#failure-auth')).toContainText('匿名编辑');
      await expect(page.locator('#failure-save')).toBeEnabled();
      await page.locator('[name="symptom"]').fill('long-unbroken-synthetic-evidence-'.repeat(12));
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  expect(errors).toEqual([]);
});
