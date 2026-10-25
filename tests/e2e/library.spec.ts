import { expect, test, type Download, type Page } from '@playwright/test';

const STORAGE_KEY = 'simulearn-reading-library-v1';
const FILE_IO = '/domains/tools/kp/file-io/';
const FUNCTIONS = '/domains/tools/kp/functions/';
const CASE = '/cases/rock-dynamic-stability/';
const PIVOT = '/errors/#ANSYS-004';
const FLUENT = '/errors/#FLUENT-008';
interface LibraryItem { href: string; title: string; at: number }
interface LibraryState { version: number; favorites: LibraryItem[]; recent: LibraryItem[]; historyEnabled: boolean }

// Each test uses a fresh browser profile. No account, private record or production
// endpoint is created; the Worker is used only as a local public-content server.
test.beforeEach(async ({ context, baseURL }) => {
  const host = baseURL ? new URL(baseURL).hostname : '';
  test.skip(!['127.0.0.1', 'localhost', '[::1]'].includes(host), 'Library acceptance runs only against a local Worker.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('https://cdn.jsdelivr.net/npm/mathjax@3/**', route => route.abort());
  await context.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
});

async function snapshot(page: Page): Promise<LibraryState> {
  return page.evaluate(key => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : { version: 1, favorites: [], recent: [], historyEnabled: true };
  }, STORAGE_KEY);
}

const favorite = (page: Page, href: string) => page.locator(`[data-library-favorite="${href}"]`);
const entry = (page: Page, href: string) => page.locator(`[data-library-list] [data-library-entry="${href}"]`);
async function openKnowledge(page: Page, href: string, tracked = true) {
  await page.goto(href);
  await expect(page.locator('[data-kp-page]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-kp-content]')).not.toBeEmpty();
  await expect(favorite(page, href)).toBeVisible();
  if (tracked) await expect.poll(async () => (await snapshot(page)).recent.map(item => item.href)).toContain(href);
}

async function recentTab(page: Page) {
  await page.locator('[data-library-tab="recent"]').click();
  await expect(page.locator('[data-library-tab="recent"]')).toHaveAttribute('aria-pressed', 'true');
}

async function downloadText(download: Download) {
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('search favorites do not navigate, persist across reload and can be removed', async ({ page }) => {
  await page.goto('/search?q=CSV&type=kp&domain=tools');
  await expect(page.locator('[data-search-result]')).toHaveCount(1);
  await expect(page.locator('[data-search-result]')).toHaveAttribute('href', FILE_IO);
  const searchURL = page.url();
  await favorite(page, FILE_IO).click();
  await expect(favorite(page, FILE_IO)).toHaveAttribute('aria-pressed', 'true');
  expect(page.url()).toBe(searchURL);
  await expect.poll(async () => (await snapshot(page)).favorites.map(item => item.href)).toEqual([FILE_IO]);
  expect((await snapshot(page)).recent).toEqual([]);

  await page.reload();
  await expect(favorite(page, FILE_IO)).toHaveAttribute('aria-pressed', 'true');
  await favorite(page, FILE_IO).click();
  await expect(favorite(page, FILE_IO)).toHaveAttribute('aria-pressed', 'false');
  expect(page.url()).toBe(searchURL);
  await expect.poll(async () => (await snapshot(page)).favorites).toEqual([]);
});

test('successful tutorials deduplicate and move the latest visit to the top', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-library-continue]')).not.toBeVisible();
  await openKnowledge(page, FILE_IO);
  await openKnowledge(page, FUNCTIONS);
  await expect.poll(async () => (await snapshot(page)).recent.map(item => item.href)).toEqual([FUNCTIONS, FILE_IO]);
  await openKnowledge(page, FILE_IO);
  await expect.poll(async () => (await snapshot(page)).recent.map(item => item.href)).toEqual([FILE_IO, FUNCTIONS]);
  await page.reload();
  await expect(page.locator('[data-kp-title]')).toHaveText('文件读写');
  await expect.poll(async () => (await snapshot(page)).recent.map(item => item.href)).toEqual([FILE_IO, FUNCTIONS]);
  expect((await snapshot(page)).favorites).toEqual([]);

  await page.goto('/');
  await expect(page.locator('[data-library-continue]')).toBeVisible();
  await expect(page.locator(`[data-library-continue] a[href="${FILE_IO}"]`)).toBeVisible();
  await expect(page.locator(`[data-library-continue] a[href="${FUNCTIONS}"]`)).toBeVisible();
});

test('failed and still-loading tutorials never become recent reading', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/knowledge/tools/file-io', async route => {
    await held;
    await route.fulfill({ status: 503, json: { ok: false, error: '本地测试：内容加载失败' } });
  });
  await page.goto(FILE_IO);
  await expect(page.locator('[data-kp-state]')).toContainText('正在加载');
  expect((await snapshot(page)).recent).toEqual([]);
  release();
  await expect(page.locator('[data-kp-state]')).toContainText('本地测试：内容加载失败');
  await expect(page.locator('[data-kp-page]')).not.toBeVisible();
  await expect(favorite(page, FILE_IO)).toHaveCount(0);
  expect((await snapshot(page)).recent).toEqual([]);
});

test('only opened error details and a real case enter recent reading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/errors/');
  await expect(page.locator('.error-item')).toHaveCount(60);
  expect((await snapshot(page)).recent).toEqual([]);
  await page.locator('#ANSYS-004 .error-details summary').click();
  await expect.poll(async () => (await snapshot(page)).recent.map(item => item.href)).toEqual([PIVOT]);
  await page.locator('#ANSYS-004 .error-details summary').click();
  expect((await snapshot(page)).recent.map(item => item.href)).toEqual([PIVOT]);
  await page.evaluate(() => { location.hash = 'FLUENT-008'; });
  await expect(page.locator('#FLUENT-008 .error-details')).toHaveAttribute('open', '');
  await expect.poll(async () => (await snapshot(page)).recent.map(item => item.href)).toEqual([FLUENT, PIVOT]);
  await page.evaluate(() => { location.hash = '%ZZ'; });
  await page.goto(CASE);
  await expect(favorite(page, CASE)).toBeVisible();
  await expect.poll(async () => (await snapshot(page)).recent.map(item => item.href)).toEqual([CASE, FLUENT, PIVOT]);
});

test('search, private workspaces and public shared-record shells are excluded', async ({ page }) => {
  await page.route('**/api/study/public/**', route => route.fulfill({ status: 404, json: { ok: false, error: '本地测试：记录未公开' } }));
  await page.goto('/search?q=CSV');
  await expect(page.locator('[data-search-result]')).toHaveCount(5);
  expect((await snapshot(page)).recent).toEqual([]);
  await page.goto('/learning/records/');
  await expect(page.locator('#study-title')).toBeVisible();
  expect((await snapshot(page)).recent).toEqual([]);
  await page.goto('/failures/review/');
  await expect(page.locator('#failure-form')).toBeVisible();
  expect((await snapshot(page)).recent).toEqual([]);
  await page.goto('/learning/shared/?owner=fixture&id=fixture');
  await expect(page.locator('#shared-title')).toContainText('暂时无法读取');
  expect((await snapshot(page)).recent).toEqual([]);
  await page.goto('/library/');
  await expect(page.getByRole('heading', { name: '收藏与最近浏览', exact: true })).toBeVisible();
  expect((await snapshot(page)).recent).toEqual([]);
});

test('removing, pausing and clearing recent reading leaves favorites intact', async ({ page }) => {
  await openKnowledge(page, FILE_IO);
  await favorite(page, FILE_IO).click();
  await openKnowledge(page, FUNCTIONS);
  await page.goto('/library/');
  await recentTab(page);
  await entry(page, FILE_IO).locator('[data-library-remove]').click();
  await expect(entry(page, FILE_IO)).toHaveCount(0);
  expect((await snapshot(page)).favorites.map(item => item.href)).toEqual([FILE_IO]);
  await page.locator('[data-library-pause]').click();
  await expect(page.locator('[data-library-pause]')).toHaveAttribute('aria-pressed', 'true');
  expect((await snapshot(page)).historyEnabled).toBe(false);
  await page.goto(CASE);
  await expect(favorite(page, CASE)).toBeVisible();
  expect((await snapshot(page)).recent.map(item => item.href)).toEqual([FUNCTIONS]);
  await page.goto('/library/');
  await recentTab(page);
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('[data-library-clear]').click();
  await expect(entry(page, FUNCTIONS)).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-library-clear]').click();
  await expect(page.locator('[data-library-list] [data-library-entry]')).toHaveCount(0);
  expect((await snapshot(page)).favorites.map(item => item.href)).toEqual([FILE_IO]);
  await page.locator('[data-library-tab="favorites"]').click();
  await expect(entry(page, FILE_IO)).toBeVisible();
  await recentTab(page);
  await page.locator('[data-library-pause]').click();
  await expect(page.locator('[data-library-pause]')).toHaveAttribute('aria-pressed', 'false');
  await page.goto(CASE);
  await expect.poll(async () => (await snapshot(page)).recent.map(item => item.href)).toEqual([CASE]);
  expect((await snapshot(page)).favorites.map(item => item.href)).toEqual([FILE_IO]);
});

test('exports download complete JSON and Markdown even while the list is filtered', async ({ page }) => {
  await openKnowledge(page, FILE_IO);
  await favorite(page, FILE_IO).click();
  await openKnowledge(page, FUNCTIONS);
  await favorite(page, FUNCTIONS).click();
  await page.goto('/library/');
  await page.locator('[data-library-filter]').fill('天文未知短语');
  await expect(page.locator('[data-library-list] [data-library-entry]')).toHaveCount(0);
  const jsonDownload = page.waitForEvent('download');
  await page.locator('[data-library-export="json"]').click();
  const jsonFile = await jsonDownload;
  expect(jsonFile.suggestedFilename()).toMatch(/\.json$/);
  const exported = JSON.parse(await downloadText(jsonFile));
  expect(exported.version).toBe(1);
  expect(exported.favorites.map((item: LibraryItem) => item.href).sort()).toEqual([FILE_IO, FUNCTIONS].sort());
  expect(exported.recent.map((item: LibraryItem) => item.href)).toEqual([FUNCTIONS, FILE_IO]);
  expect(JSON.stringify(exported)).not.toMatch(/simulearn_sess|password|\/api\/study/);
  const markdownDownload = page.waitForEvent('download');
  await page.locator('[data-library-export="markdown"]').click();
  const markdownFile = await markdownDownload;
  expect(markdownFile.suggestedFilename()).toMatch(/\.md$/);
  const markdown = await downloadText(markdownFile);
  expect(markdown).toContain('文件读写');
  expect(markdown).toContain('函数');
  expect(markdown).toContain(FILE_IO);
  expect(markdown).toContain(FUNCTIONS);
  expect(markdown).toMatch(/收藏/);
  expect(markdown).toMatch(/最近/);
});

test('favorite updates synchronize between open tabs without a reload', async ({ page, context }) => {
  await page.goto('/search?q=CSV&type=kp&domain=tools');
  await expect(favorite(page, FILE_IO)).toHaveAttribute('aria-pressed', 'false');
  const other = await context.newPage();
  try {
    await other.goto('/library/');
    await expect(other.locator('[data-library-list] [data-library-entry]')).toHaveCount(0);
    await favorite(page, FILE_IO).click();
    await expect(entry(other, FILE_IO)).toBeVisible();
    await entry(other, FILE_IO).locator('[data-library-remove]').click();
    await expect(favorite(page, FILE_IO)).toHaveAttribute('aria-pressed', 'false');
    await expect(entry(other, FILE_IO)).toHaveCount(0);
  } finally { await other.close(); }
});

test('disabled local storage reports the limitation and leaves browsing usable', async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Local acceptance: storage is blocked', 'SecurityError'); },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/library/');
  await expect(page.getByRole('heading', { name: '收藏与最近浏览', exact: true })).toBeVisible();
  await expect(page.locator('[data-library-storage]')).toContainText(/不可用|无法|临时|当前页/);
  await page.goto('/search?q=CSV&type=kp&domain=tools');
  await expect(page.locator('[data-search-result]')).toHaveAttribute('href', FILE_IO);
  await expect(favorite(page, FILE_IO)).toBeDisabled();
  await expect(favorite(page, FILE_IO)).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-search-result]').click();
  await expect(page.locator('[data-kp-title]')).toHaveText('文件读写');
  expect(errors).toEqual([]);
});

test('a quota failure keeps the favorite unsaved and reports a useful failure', async ({ context, page }) => {
  await context.addInitScript(key => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name: string, value: string) {
      if (name === key) throw new DOMException('Local acceptance: quota exhausted', 'QuotaExceededError');
      write.call(this, name, value);
    };
  }, STORAGE_KEY);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/search?q=CSV&type=kp&domain=tools');
  await expect(favorite(page, FILE_IO)).toBeEnabled();
  const searchURL = page.url();
  await favorite(page, FILE_IO).click();
  await expect(favorite(page, FILE_IO)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-library-feedback]')).toContainText(/未保存|尚未保存|失败/);
  expect(page.url()).toBe(searchURL);
  expect((await snapshot(page)).favorites).toEqual([]);
  await page.evaluate(() => localStorage.setItem('library-quota-fixture', 'other keys still work'));
  expect(await page.evaluate(() => localStorage.getItem('library-quota-fixture'))).toBe('other keys still work');
  await page.locator('[data-search-result]').click();
  await expect(page.locator('[data-kp-title]')).toHaveText('文件读写');
  await expect(favorite(page, FILE_IO)).toHaveAttribute('aria-pressed', 'false');
  expect((await snapshot(page)).recent).toEqual([]);
  expect(errors).toEqual([]);
});

test('damaged and unknown library formats survive until an explicit reset of this key only', async ({ page }) => {
  const fixtures = [
    '{invalid-json',
    JSON.stringify({ version: 999, favorites: [], recent: [], historyEnabled: false, futureFormat: 'keep me' }),
  ];
  for (const raw of fixtures) {
    await page.goto('/library/');
    await page.evaluate(({ key, raw }) => {
      localStorage.setItem(key, raw);
      localStorage.setItem('simulearn-theme', 'dark');
      localStorage.setItem('library-reset-fixture', 'preserve this unrelated value');
    }, { key: STORAGE_KEY, raw });
    await page.reload();
    await expect(page.locator('[data-library-storage]')).toContainText(/损坏|不支持|无法读取/);
    await expect(page.locator('[data-library-reset-storage]')).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);

    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('[data-library-reset-storage]').click();
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);
    await expect(page.locator('[data-library-reset-storage]')).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-library-reset-storage]').click();
    await expect(page.locator('[data-library-reset-storage]')).not.toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('simulearn-theme'))).toBe('dark');
    expect(await page.evaluate(() => localStorage.getItem('library-reset-fixture'))).toBe('preserve this unrelated value');
    expect(await snapshot(page)).toEqual({ version: 1, favorites: [], recent: [], historyEnabled: true });

    await page.goto('/search?q=CSV&type=kp&domain=tools');
    await favorite(page, FILE_IO).click();
    await expect(favorite(page, FILE_IO)).toHaveAttribute('aria-pressed', 'true');
    expect((await snapshot(page)).favorites.map(item => item.href)).toEqual([FILE_IO]);
    expect(await page.evaluate(() => localStorage.getItem('library-reset-fixture'))).toBe('preserve this unrelated value');
  }
});

test('library remains readable on a small screen and in dark mode', async ({ page }) => {
  await openKnowledge(page, FILE_IO);
  await favorite(page, FILE_IO).click();
  await page.goto('/errors/#ANSYS-004');
  await expect.poll(async () => (await snapshot(page)).recent.map(item => item.href)).toContain(PIVOT);
  await favorite(page, PIVOT).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/library/');
  await expect(entry(page, FILE_IO)).toBeVisible();
  await expect(entry(page, PIVOT)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: '.wrangler/qa/library-mobile.png', fullPage: true });
  await page.locator('[data-menu-toggle]').click();
  await page.locator('[data-theme-toggle]').click();
  await page.locator('[data-menu-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: '.wrangler/qa/library-mobile-dark.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '.wrangler/qa/library-desktop-dark.png', fullPage: true });
});
