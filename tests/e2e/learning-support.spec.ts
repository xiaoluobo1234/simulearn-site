import { expect, test, type Download, type Page } from '@playwright/test';

const ACTIVITY = '/learning/activity/';
const KEY = 'simulearn-learning-activity-v1';
const LIBRARY_KEY = 'simulearn-reading-library-v1';
interface StepEvent { kind: string; page: string; at: number }
interface ActivityState { version: number; enabled: boolean; events: StepEvent[] }

// These tests use local synthetic input. No real feedback is submitted to GitHub
// or another person, and no production account or solver task is created.
test.beforeEach(async ({ context, baseURL }) => {
  const url = baseURL ? new URL(baseURL) : null;
  test.skip(!url || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Learning-support acceptance stays on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
});
async function rawActivity(page: Page) { return page.evaluate(key => localStorage.getItem(key), KEY); }
async function activity(page: Page): Promise<ActivityState | null> {
  const raw = await rawActivity(page); return raw === null ? null : JSON.parse(raw);
}
async function downloadText(download: Download) {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('activity is disabled by default and visiting an assembly lab does not silently create a history', async ({ page, context }) => {
  await page.goto(ACTIVITY);
  await expect(page.locator('#activity-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#activity-toggle')).toContainText('启用');
  await expect(page.locator('[data-activity-stat="events"]')).toHaveText('0');
  expect(await rawActivity(page)).toBeNull();
  const lab = await context.newPage();
  await lab.goto('/labs/assembly/?private_query=DO_NOT_COLLECT_THIS_QUERY');
  await expect(lab.locator('#assembly-auth')).toContainText('匿名');
  await lab.locator('[data-select-element="1"]').click();
  await lab.locator('[data-assembly-step="2"]').click();
  expect(await rawActivity(lab)).toBeNull();
  await expect(page.locator('[data-activity-stat="events"]')).toHaveText('0');
});

test('explicit opt-in counts actual lab events and pausing stops writes without capturing queries or numeric inputs', async ({ page, context }) => {
  const mutations: string[] = [];
  context.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.url()); });
  await context.unroute('**/api/auth/me');
  await context.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: { userId: 'PRIVATE_ACCOUNT_FIXTURE' } } }));
  await page.goto(ACTIVITY);
  await page.locator('#activity-toggle').click();
  await expect(page.locator('#activity-toggle')).toHaveAttribute('aria-pressed', 'true');
  expect((await activity(page))?.events).toEqual([]);
  const lab = await context.newPage();
  await lab.goto('/labs/assembly/?secret=PRIVATE_QUERY_FIXTURE&record=record-private');
  await expect(lab.locator('#assembly-auth')).toContainText('账户已连接');
  await lab.locator('#assembly-solve').click();
  await expect(lab.locator('#assembly-result')).toBeVisible();
  await expect.poll(async () => (await activity(page))?.events.length).toBe(2);
  await expect(page.locator('[data-activity-stat="events"]')).toHaveText('2');
  await expect(page.locator('[data-activity-stat="runs"]')).toHaveText('1');
  await expect(page.locator('[data-activity-stat="checks"]')).toHaveText('0');
  await lab.locator('#assembly-form [name="P"]').fill('123456.78');
  await lab.locator('#assembly-solve').click();
  await expect(lab.locator('#assembly-result')).toBeVisible();
  await expect.poll(async () => (await activity(page))?.events.length).toBe(3);
  const saved = (await activity(page))!;
  expect(saved.events.map(event => [event.kind, event.page])).toEqual([['page-view', 'assembly'], ['reference-run', 'assembly'], ['reference-run', 'assembly']]);
  for (const event of saved.events) {
    expect(Object.keys(event).sort()).toEqual(['at', 'kind', 'page']);
    expect(Number.isSafeInteger(event.at)).toBe(true);
  }
  const raw = (await rawActivity(page))!;
  for (const privateValue of ['PRIVATE_QUERY_FIXTURE', 'PRIVATE_ACCOUNT_FIXTURE', 'record-private', '123456.78', '/labs/assembly/']) expect(raw).not.toContain(privateValue);
  const downloading = page.waitForEvent('download');
  await page.locator('#activity-export').click();
  const exported = JSON.parse(await downloadText(await downloading));
  expect(exported.events).toEqual(saved.events);
  expect(exported.scope).toContain('非学习完成');
  expect(exported.summary.runs).toBe(2);
  await page.locator('#activity-toggle').click();
  await expect(page.locator('#activity-toggle')).toHaveAttribute('aria-pressed', 'false');
  await lab.locator('#assembly-solve').click();
  await expect(lab.locator('#assembly-result')).toBeVisible();
  expect((await activity(page))?.events).toEqual(saved.events);
  expect(mutations).toEqual([]);
});

test('clearing activity removes only its own key and returns to default off', async ({ page }) => {
  const library = JSON.stringify({ version: 1, favorites: [], recent: [], historyEnabled: true });
  await page.addInitScript(({ key, libraryKey, libraryValue }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, enabled: true, events: [{ kind: 'page-view', page: 'project', at: Date.now() - 1000 }] }));
    localStorage.setItem(libraryKey, libraryValue);
    localStorage.setItem('simulearn-theme', 'dark');
    localStorage.setItem('unrelated-acceptance-fixture', 'preserve this exact unrelated value');
  }, { key: KEY, libraryKey: LIBRARY_KEY, libraryValue: library });
  await page.goto(ACTIVITY);
  await expect(page.locator('[data-activity-stat="events"]')).toHaveText('1');
  await page.locator('#activity-clear').click();
  expect(await rawActivity(page)).toBeNull();
  await expect(page.locator('#activity-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-activity-stat="events"]')).toHaveText('0');
  await expect(page.locator('#activity-status')).toContainText('收藏与其他学习记录不受影响');
  expect(await page.evaluate(key => localStorage.getItem(key), LIBRARY_KEY)).toBe(library);
  expect(await page.evaluate(() => localStorage.getItem('simulearn-theme'))).toBe('dark');
  expect(await page.evaluate(() => localStorage.getItem('unrelated-acceptance-fixture'))).toBe('preserve this exact unrelated value');
});

test('pilot feedback exports only an explicit self-report and does not post or persist its private text', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.url()); });
  await page.goto(ACTIVITY);
  const form = page.locator('#pilot-feedback');
  const notes = 'PRIVATE FEEDBACK FIXTURE: <img src=x onerror="window.feedbackInjected=true">; 尚未取得独立复现证据。';
  await form.locator('[name="task"]').selectOption('assembly');
  await form.locator('[name="selfReported"]').selectOption('finished-self-report');
  await form.locator('[name="difficulty"]').selectOption('4');
  await form.locator('[name="notes"]').fill(notes);
  const downloading = page.waitForEvent('download');
  await form.getByRole('button', { name: '导出反馈 JSON' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('simulearn-pilot-feedback.json');
  const feedback = JSON.parse(await downloadText(download));
  expect(feedback.version).toBe(1);
  expect(feedback.task).toBe('assembly');
  expect(feedback.selfReported).toBe('finished-self-report');
  expect(feedback.difficulty).toBe('4');
  expect(feedback.notes).toBe(notes);
  expect(feedback.scope).toContain('不是系统验证完成记录');
  expect(feedback).not.toHaveProperty('passed');
  expect(feedback).not.toHaveProperty('userId');
  expect(Number.isFinite(Date.parse(feedback.recordedAt))).toBe(true);
  expect(await rawActivity(page)).toBeNull();
  expect(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('PRIVATE FEEDBACK FIXTURE')))).toBe(false);
  await expect(form.locator('img, script')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { feedbackInjected?: boolean }).feedbackInjected)).toBeUndefined();
  expect(mutations).toEqual([]);
});

test('corrupt JSON and future activity schemas fail closed until an explicit clear', async ({ page, context }) => {
  let downloads = 0; page.on('download', () => downloads++);
  for (const corrupt of ['{broken activity JSON', '{"version":2,"enabled":true,"events":[]}']) {
    await page.goto(ACTIVITY);
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: KEY, raw: corrupt });
    await page.reload();
    await expect(page.locator('#activity-toggle')).toBeDisabled();
    await expect(page.locator('#activity-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#activity-status')).toContainText('格式损坏');
    await page.locator('#activity-export').click();
    await expect(page.locator('#activity-status')).toContainText('未生成可能误导的统计');
    const lab = await context.newPage();
    await lab.goto('/labs/assembly/');
    await expect(lab.locator('#assembly-auth')).toContainText('匿名');
    expect(await rawActivity(lab)).toBe(corrupt);
    await lab.close();
    expect(await rawActivity(page)).toBe(corrupt);
    await page.locator('#activity-clear').click();
    await expect(page.locator('#activity-toggle')).toBeEnabled();
    expect(await rawActivity(page)).toBeNull();
  }
  expect(downloads).toBe(0);
});

test('build evidence is distinct from human review and correction links carry only the public page/version', async ({ page, request }) => {
  const response = await request.get('/generated/learning-evidence.json');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.contentVersion).toBe('linear-static-v1');
  expect(manifest.reviewStatus).toBe('pending-human-review');
  expect(Number.isFinite(Date.parse(manifest.generatedAt))).toBe(true);
  expect(manifest.cases.map((item: { id: string }) => item.id).sort()).toEqual(['benchmark:cantilever-beam', 'benchmark:stepped-bar', 'benchmark:uniform-bar']);
  for (const item of manifest.cases) {
    expect(item.check).toBe('matched');
    expect(item.files.length).toBeGreaterThan(0);
    for (const file of item.files) expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
  }
  await page.goto('/cases/benchmarks/uniform-bar/?private=PRIVATE_CORRECTION_QUERY&id=record-private');
  const provenance = page.locator('[data-content-provenance="benchmark:uniform-bar"]');
  await expect(provenance).toContainText('内容版本');
  await expect(provenance).toContainText('linear-static-v1');
  await expect(provenance).toContainText('待本人复核');
  await expect(provenance).toContainText('审核日期尚未登记');
  await expect(provenance.locator('[data-evidence-result]')).toBeVisible();
  await expect(provenance.locator('[data-evidence-result]')).toContainText('本次构建环境已重跑参考程序');
  await expect(provenance.locator('[data-evidence-result]')).toContainText('不是用户本机或在线 CAE 验证');
  const correction = provenance.getByRole('link', { name: '报告本页问题 ↗' });
  const href = new URL((await correction.getAttribute('href'))!);
  expect(href.origin).toBe('https://github.com');
  expect(href.pathname).toBe('/xiaoluobo1234/simulearn-site/issues/new');
  expect(href.searchParams.get('template')).toBe('content-correction.yml');
  expect(href.searchParams.get('page')).toBe('/cases/benchmarks/uniform-bar/');
  expect(href.searchParams.get('content_version')).toBe('linear-static-v1');
  expect([...href.searchParams.keys()].sort()).toEqual(['content_version', 'page', 'template', 'title']);
  expect(href.toString()).not.toContain('PRIVATE_CORRECTION_QUERY');
  expect(href.toString()).not.toContain('record-private');
  await expect(correction).toHaveAttribute('target', '_blank');
  await provenance.getByRole('link', { name: '查看内容版本与审核索引 →' }).click();
  await expect(page).toHaveURL(/\/content-status\/$/);
  const card = page.locator('.project-case-card').filter({ has: page.locator('a[href="/cases/benchmarks/uniform-bar/"]') });
  await expect(card).toContainText('linear-static-v1 · 待本人复核');
  await expect(card.getByRole('link', { name: '针对这一版本报告问题 ↗' })).toHaveAttribute('href', href.href);
  await expect(page.locator('a[href="/generated/learning-evidence.json"]')).toBeVisible();
});

test('unavailable build evidence never becomes a successful reference-run claim', async ({ page }) => {
  await page.route('**/generated/learning-evidence.json', route => route.fulfill({ status: 404, json: { error: 'synthetic missing evidence' } }));
  await page.goto('/cases/benchmarks/uniform-bar/');
  const provenance = page.locator('[data-content-provenance="benchmark:uniform-bar"]');
  await expect(provenance).toContainText('待本人复核');
  await expect(provenance.locator('[data-evidence-result]')).toBeHidden();
  await expect(provenance).not.toContainText('本次构建环境已重跑参考程序');
});
