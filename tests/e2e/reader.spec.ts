import { expect, test, type Locator, type Page } from '@playwright/test';

const READER_KEY = 'simulearn-reading-position-v1';
const LIBRARY_KEY = 'simulearn-reading-library-v1';
const FILE_IO = '/domains/tools/kp/file-io/';
const FUNCTIONS = '/domains/tools/kp/functions/';
const STRUCTURAL = '/domains/structural/kp/units-and-dimensions/';
const CASE = '/cases/rock-dynamic-stability/';
interface Position {
  href: string; anchor: string; label: string; sectionProgress: number;
  progress: number; updatedAt: number; signature: string;
}
interface ReaderState { version: number; positions: Position[]; fontSize: 'normal' | 'large' | 'extra' }

// Fixture prose is explicitly browser acceptance content. Its length and repeated
// headings exercise real scrolling and TOC IDs without depending on future edits
// to the public tutorials. It never enters an account, AI service or production.
const titles = ['路径与编码', '路径与编码', '继续读取', '异常分支', '继续读取', '验证输出', '适用边界', '下次继续'];
const paragraph = '这段文字仅用于本地浏览器验收，不代表学习经历或运行结果。需要验证长文阅读中的目录定位、正文位置和再次打开时的行为。'.repeat(4);
const fixtureMarkdown = [
  '这是本地长文阅读验收内容。',
  ...titles.flatMap((title, index) => [
    `${index % 3 === 2 ? '###' : '##'} ${title}`,
    ...Array.from({ length: 6 }, (_, p) => `第 ${index + 1} 节第 ${p + 1} 段。${paragraph}`),
    ...(index === 1 ? ['~~~python', '## 代码块里的文字不是目录标题', 'print("local reader fixture")', '~~~'] : []),
  ]),
].join('\n\n');

test.beforeEach(async ({ context, page, baseURL }) => {
  const host = baseURL ? new URL(baseURL).hostname : '';
  test.skip(!['127.0.0.1', 'localhost', '[::1]'].includes(host), 'Reader acceptance runs only against a local Worker.');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('https://cdn.jsdelivr.net/npm/mathjax@3/**', route => route.abort());
  await context.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
});

async function readerState(page: Page): Promise<ReaderState> {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : { version: 1, positions: [], fontSize: 'normal' };
  }, READER_KEY);
}
async function position(page: Page, href = FILE_IO) {
  return (await readerState(page)).positions.find(item => item.href === href);
}
const body = (page: Page) => page.locator('[data-article-reader-content]');
const toolbar = (page: Page) => page.locator('[data-article-reader]');
const favorite = (page: Page, href = FILE_IO) => page.locator(`[data-library-favorite="${href}"]`);

async function useFixture(page: Pick<Page, 'route'>, href = FILE_IO, options: { markdown?: string; tutorial?: boolean } = {}) {
  const parts = href.split('/').filter(Boolean);
  const domain = parts[1], slug = parts[3];
  await page.route(`**/api/knowledge/${domain}/${slug}`, route => route.fulfill({ json: {
    ok: true, content: {
      title: href === FUNCTIONS ? '函数' : href === STRUCTURAL ? '单位制与量纲' : '文件读写',
      description: '本地阅读体验验收：不代表已完成学习。', aiContent: options.markdown || fixtureMarkdown,
      tutorialMode: options.tutorial ?? true, difficulty: '基础', checkpointQuestion: '本地测试题',
      relations: { prerequisites: [], next: [], related: [] },
    },
  } }));
  if (domain !== 'tools') await page.route('**/api/learning/progress?*', route => route.fulfill({ json: { ok: true, progress: null } }));
}

async function openReader(page: Page, href = FILE_IO) {
  await page.goto(href);
  await expect(toolbar(page)).toBeVisible({ timeout: 15_000 });
  await expect(body(page)).not.toBeEmpty();
}

async function tocLinks(page: Page) {
  const toc = page.locator('[data-reader-toc]');
  if ((await toc.getAttribute('open')) === null) await toc.locator('summary').click();
  return toc.locator('[data-reader-heading]');
}

async function headingForLink(page: Page, link: Locator) {
  const href = await link.getAttribute('href');
  expect(href).toMatch(/^#/);
  const id = decodeURIComponent(href!.slice(1));
  return body(page).locator(`[id="${id}"]`);
}

async function scrollAndSave(page: Page, href = FILE_IO, index = 4) {
  const previousUpdate = (await position(page, href))?.updatedAt ?? 0;
  const links = await tocLinks(page);
  const target = await headingForLink(page, links.nth(index));
  // Save with the directory collapsed, matching the default layout on reopen.
  // Its expanded sticky height would otherwise change the viewport comparison.
  await page.locator('[data-reader-toc] summary').click();
  // A genuine wheel gesture arms position recording. The following browser
  // scroll reaches a reproducible point inside a long section, not just its title.
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width - 70, Math.min(650, viewport.height - 100));
  await page.mouse.wheel(0, 320);
  await target.evaluate(el => window.scrollTo({ top: scrollY + el.getBoundingClientRect().top + 210, behavior: 'instant' }));
  // A previous visit may already exceed 10%; wait for this gesture's saved
  // snapshot before using its scroll position as a restoration reference.
  await expect.poll(async () => {
    const current = await position(page, href);
    return Boolean(current && current.updatedAt > previousUpdate && current.progress > .1);
  }, { timeout: 6000 }).toBe(true);
  const saved = (await position(page, href))!;
  expect(saved.signature).toMatch(/^v1-[a-f0-9]{8}$/);
  expect(saved.sectionProgress).toBeGreaterThanOrEqual(0);
  expect(saved.sectionProgress).toBeLessThanOrEqual(1);
  await expect(body(page).locator(`[id="${saved.anchor}"]`)).toHaveCount(1);
  return { saved, y: await page.evaluate(() => scrollY) };
}

async function expectRestoredScroll(page: Page, y: number) {
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000 }).toBeGreaterThan(y - 230);
  expect(await page.evaluate(() => scrollY)).toBeLessThan(y + 230);
}

test('the real long tutorial has a body-only TOC and persistent effective font sizes', async ({ page }) => {
  await openReader(page);
  const headings = await body(page).locator('h2,h3').count();
  expect(headings).toBeGreaterThan(5);
  await expect(await tocLinks(page)).toHaveCount(headings);
  const sample = body(page).locator('p').first();
  const normal = await sample.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  await page.locator('[data-reader-font="large"]').click();
  await expect(body(page)).toHaveAttribute('data-reader-font-size', 'large');
  await expect.poll(() => sample.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(normal);
  const large = await sample.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  await page.locator('[data-reader-font="extra"]').click();
  await expect(body(page)).toHaveAttribute('data-reader-font-size', 'extra');
  await expect.poll(() => sample.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(large);
  expect((await readerState(page)).fontSize).toBe('extra');
  await page.reload();
  await expect(body(page)).toHaveAttribute('data-reader-font-size', 'extra');
  await expect(page.locator('[data-reader-font="extra"]')).toHaveAttribute('aria-pressed', 'true');
});

test('repeated headings get stable unique anchors and TOC links land below navigation', async ({ page }) => {
  await useFixture(page);
  await openReader(page);
  const links = await tocLinks(page);
  await expect(links).toHaveCount(titles.length);
  const anchors = await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  expect(new Set(anchors).size).toBe(titles.length);
  expect(await links.allTextContents()).not.toContain('代码块里的文字不是目录标题');
  for (let index = 0; index < titles.length; index++) await expect(await headingForLink(page, links.nth(index))).toHaveCount(1);
  const target = await headingForLink(page, links.nth(3));
  await links.nth(3).click();
  expect(new URL(page.url()).hash).toBe(anchors[3]);
  await expect.poll(() => target.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(70);
  expect(await target.evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(260);
  await page.reload();
  expect(await (await tocLinks(page)).evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).toEqual(anchors);
});

test('real scrolling survives reload and revisit, with explicit continue and restart choices', async ({ page }) => {
  await useFixture(page);
  await openReader(page);
  const { saved, y } = await scrollAndSave(page);
  expect(y).toBeGreaterThan(1000);
  await page.reload();
  await expect(toolbar(page)).toBeVisible();
  expect((await position(page))?.anchor).toBe(saved.anchor);
  await page.goto('/search?q=CSV');
  await openReader(page);
  await expect(page.locator('[data-reader-resume]')).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBeLessThan(y - 500);
  await page.locator('[data-reader-continue]').click();
  await expectRestoredScroll(page, y);
  await expect(page.locator('[data-reader-resume]')).not.toBeVisible();

  await page.goto('/search?q=CSV');
  await openReader(page);
  await expect(page.locator('[data-reader-resume]')).toBeVisible();
  await page.locator('[data-reader-restart]').click();
  await expect(page.locator('[data-reader-resume]')).not.toBeVisible();
  await expect.poll(async () => (await position(page))?.progress || 0).toBeLessThanOrEqual(0.01);
  await page.goto('/search?q=CSV');
  await openReader(page);
  await expect(page.locator('[data-reader-resume]')).not.toBeVisible();
});

test('valid section hashes take priority and explicit continue links restore reading', async ({ page }) => {
  await useFixture(page);
  await openReader(page);
  const links = await tocLinks(page);
  const earlierHash = (await links.nth(1).getAttribute('href'))!;
  await scrollAndSave(page);
  await openReader(page, `${FILE_IO}${earlierHash}`);
  const heading = body(page).locator(`[id="${decodeURIComponent(earlierHash.slice(1))}"]`);
  await expect(page.locator('[data-reader-resume]')).not.toBeVisible();
  await expect.poll(() => heading.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(70);
  expect(await heading.evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(260);

  const { y } = await scrollAndSave(page);
  await page.goto('/');
  const homeResume = page.locator(`[data-library-continue] a[href="${FILE_IO}#reader-resume"]`);
  await expect(homeResume).toBeVisible();
  await homeResume.click();
  await expect(toolbar(page)).toBeVisible();
  await expectRestoredScroll(page, y);
  await expect(page.locator('[data-reader-resume]')).not.toBeVisible();
  await page.goto('/library/?tab=recent');
  const libraryResume = page.locator(`[data-library-entry="${FILE_IO}"] a[href="${FILE_IO}#reader-resume"]`);
  await expect(libraryResume).toBeVisible();
  await libraryResume.click();
  await expectRestoredScroll(page, y);
});

test('updated article content resumes at the saved section start without applying its old fraction', async ({ page }) => {
  await useFixture(page);
  await openReader(page);
  const { saved } = await scrollAndSave(page);
  expect(saved.sectionProgress).toBeGreaterThan(0.1);
  await page.goto('/search?q=CSV');

  // Keep every heading intact while materially changing the saved section's
  // height. Reusing its old fraction would land well below the section start.
  const revised = fixtureMarkdown.replace('第 5 节第 1 段。', `${Array.from({ length: 5 }, () => `正文更新后的新增验收段落。${paragraph}`).join('\n\n')}\n\n第 5 节第 1 段。`);
  await page.unroute('**/api/knowledge/tools/file-io');
  await useFixture(page, FILE_IO, { markdown: revised });
  await openReader(page);
  await expect(page.locator('[data-reader-resume]')).toContainText('正文已更新');
  const savedHeading = body(page).locator(`[id="${saved.anchor}"]`);
  await expect(savedHeading).toHaveCount(1);
  await page.locator('[data-reader-continue]').click();
  await expect(page.locator('[data-reader-status]')).toContainText('正文已更新');
  await expect.poll(async () => {
    const headingTop = await savedHeading.evaluate(el => el.getBoundingClientRect().top);
    const toolbarBottom = await toolbar(page).evaluate(el => el.getBoundingClientRect().bottom);
    const gap = headingTop - toolbarBottom;
    return gap >= 0 && gap < 50;
  }).toBe(true);
  await expect.poll(async () => (await position(page))?.signature, { timeout: 6000 }).not.toBe(saved.signature);
  const updated = (await position(page))!;
  expect(updated.signature).toMatch(/^v1-[a-f0-9]{8}$/);
  expect(updated.anchor).toBe(saved.anchor);
  expect(updated.sectionProgress).toBeLessThan(0.05);

  await page.goto('/search?q=CSV');
  await page.unroute('**/api/knowledge/tools/file-io');
  await useFixture(page, FILE_IO, { markdown: `## 全新章节\n\n${Array.from({length:20}, () => paragraph).join('\n\n')}` });
  await openReader(page);
  await expect(body(page).locator(`[id="${saved.anchor}"]`)).toHaveCount(0);
  await page.locator('[data-reader-continue]').click();
  await expect(page.locator('[data-reader-status]')).toContainText('原章节已失效');
  await expect.poll(async () => (await position(page))?.progress || 0).toBeLessThanOrEqual(.01);
});

test('clearing history in another tab revokes pending and future position writes in the old reader', async ({ context, page }) => {
  // Route the public fixture at context level so every tab has the same public
  // article, while account/private APIs remain outside this acceptance flow.
  await useFixture(context);
  await openReader(page);
  await favorite(page).click();
  await page.locator('[data-reader-font="extra"]').click();
  await scrollAndSave(page);
  const other = await context.newPage();
  try {
    await other.goto('/library/?tab=recent');
    await expect(other.locator(`[data-library-entry="${FILE_IO}"]`)).toBeVisible();
    await page.bringToFront();
    // Do not wait out the controller's 800ms throttle: clear from the other tab
    // immediately after PageDown so it must revoke the older pending write too.
    await page.keyboard.press('PageDown');
    other.once('dialog', dialog => dialog.accept());
    await other.locator('[data-library-clear]').click();
    await expect(page.locator('[data-reader-status]')).toContainText('本篇已不在最近浏览');
    await expect.poll(async () => (await readerState(other)).positions).toEqual([]);

    await page.bringToFront();
    await page.mouse.move(1100, 650);
    await page.mouse.wheel(0, 650);
    // Explicitly outlive the throttle once; a queued timer must not resurrect
    // positions after the cross-tab removal, even before the pagehide flush.
    await page.waitForTimeout(950);
    expect((await readerState(other)).positions).toEqual([]);
    await page.goto('/search?q=CSV');
    expect((await readerState(other)).positions).toEqual([]);
    const library = await other.evaluate(key => JSON.parse(localStorage.getItem(key)!), LIBRARY_KEY);
    expect(library.recent).toEqual([]);
    expect(library.favorites.map((item: { href: string }) => item.href)).toEqual([FILE_IO]);
    expect((await readerState(other)).fontSize).toBe('extra');
    await other.locator('[data-library-tab="favorites"]').click();
    await expect(other.locator(`[data-library-entry="${FILE_IO}"]`)).toBeVisible();
  } finally { await other.close(); }
});

test('a delayed clear-event snapshot revokes the old reader even when current history already contains the entry again', async ({ page }) => {
  await useFixture(page);
  await openReader(page);
  const original = (await scrollAndSave(page)).saved;
  const currentLibraryRaw = await page.evaluate(key => localStorage.getItem(key), LIBRARY_KEY);
  expect(JSON.parse(currentLibraryRaw!).recent.map((item: { href: string }) => item.href)).toContain(FILE_IO);

  // Model a clear notification arriving after another page has re-added this
  // article. Only the event carries the older snapshot: do not alter storage or
  // call a store method, which would hide a controller that checks current state
  // but incorrectly ignores the invalidation represented by event.newValue.
  await page.evaluate(key => {
    window.dispatchEvent(new StorageEvent('storage', {
      key,
      newValue: JSON.stringify({ version: 1, favorites: [], recent: [], historyEnabled: true }),
      storageArea: localStorage,
    }));
  }, LIBRARY_KEY);
  await expect(page.locator('[data-reader-status]')).toContainText('本篇已不在最近浏览');
  expect(await page.evaluate(key => localStorage.getItem(key), LIBRARY_KEY)).toBe(currentLibraryRaw);
  expect(await position(page)).toEqual(original);

  await page.mouse.move(1100, 650);
  await page.mouse.wheel(0, 650);
  await page.waitForTimeout(950); // Outlive the real controller's save throttle.
  expect((await position(page))?.updatedAt).toBe(original.updatedAt);
  await page.goto('/search?q=CSV');
  expect(await position(page)).toEqual(original);
  expect(await page.evaluate(key => localStorage.getItem(key), LIBRARY_KEY)).toBe(currentLibraryRaw);
});

test('paused history preserves the old position instead of recording new scrolls', async ({ page }) => {
  await useFixture(page);
  await openReader(page);
  const original = (await scrollAndSave(page)).saved;
  await page.goto('/library/?tab=recent');
  await page.locator('[data-library-pause]').click();
  await expect(page.locator('[data-library-pause]')).toHaveAttribute('aria-pressed', 'true');
  await openReader(page);
  await expect(page.locator('[data-reader-status]')).toContainText(/暂停/);
  const target = await headingForLink(page, (await tocLinks(page)).nth(6));
  await page.mouse.move(1100, 600);
  await page.mouse.wheel(0, 400);
  await target.evaluate(el => window.scrollTo({ top: scrollY + el.getBoundingClientRect().top + 180, behavior: 'instant' }));
  await page.goto('/library/?tab=recent');
  expect(await position(page)).toEqual(original);
});

test('storage denial keeps reading usable without claiming a position was saved', async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Local reader acceptance: storage blocked', 'SecurityError'); } });
  });
  await useFixture(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openReader(page);
  await expect(page.locator('[data-reader-status]')).toContainText(/不可用|未保存|无法/);
  const target = await headingForLink(page, (await tocLinks(page)).nth(4));
  await page.mouse.move(1100, 650);
  await page.mouse.wheel(0, 350);
  await target.evaluate(el => window.scrollTo({ top: scrollY + el.getBoundingClientRect().top, behavior: 'instant' }));
  await page.reload();
  await expect(toolbar(page)).toBeVisible();
  await expect(page.locator('[data-reader-resume]')).not.toBeVisible();
  await expect(page.locator('[data-reader-status]')).toContainText(/不可用|未保存|无法/);
  expect(errors).toEqual([]);
});

test('failed loads and private pages have no reader, and AI output stays outside the TOC', async ({ page }) => {
  await page.route('**/api/knowledge/tools/file-io', route => route.fulfill({ status: 503, json: { ok: false, error: '本地测试：正文没有加载成功' } }));
  await page.goto(FILE_IO);
  await expect(page.locator('[data-kp-state]')).toContainText('正文没有加载成功');
  await expect(toolbar(page)).toHaveCount(0);
  expect((await readerState(page)).positions).toEqual([]);
  await page.goto('/learning/records/');
  await expect(toolbar(page)).toHaveCount(0);
  await page.goto('/search?q=CSV');
  await expect(toolbar(page)).toHaveCount(0);
  expect((await readerState(page)).positions).toEqual([]);

  await useFixture(page, STRUCTURAL, { tutorial: false });
  await page.route('**/api/learning/checkpoint', route => route.fulfill({ json: { ok: true, answer: '## AI 补充标题不应进入正文目录\n\n仅用于本地验收，待核验。', sources: [] } }));
  await openReader(page, STRUCTURAL);
  await expect(await tocLinks(page)).toHaveCount(titles.length);
  await page.locator('[data-expand-start]').click();
  await expect(page.locator('[data-expand-content] h2')).toHaveText('AI 补充标题不应进入正文目录');
  await expect(await tocLinks(page)).toHaveCount(titles.length);
  expect(await (await tocLinks(page)).allTextContents()).not.toContain('AI 补充标题不应进入正文目录');
});

test('removing and clearing recent reading clear positions while preserving favorites and font', async ({ page }) => {
  await useFixture(page);
  await useFixture(page, FUNCTIONS);
  await openReader(page);
  await favorite(page).click();
  await page.locator('[data-reader-font="extra"]').click();
  await scrollAndSave(page);
  await openReader(page, FUNCTIONS);
  await scrollAndSave(page, FUNCTIONS);
  await page.goto('/library/?tab=recent');
  await page.locator(`[data-library-entry="${FILE_IO}"] [data-library-remove]`).click();
  await expect.poll(async () => (await readerState(page)).positions.map(item => item.href)).toEqual([FUNCTIONS]);
  expect((await readerState(page)).fontSize).toBe('extra');
  const favoriteHrefs = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).favorites.map((item: { href: string }) => item.href), LIBRARY_KEY);
  expect(favoriteHrefs).toEqual([FILE_IO]);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-library-clear]').click();
  await expect.poll(async () => (await readerState(page)).positions).toEqual([]);
  expect((await readerState(page)).fontSize).toBe('extra');

  await openReader(page);
  await scrollAndSave(page);
  await page.goto('/library/');
  await page.evaluate(key => localStorage.setItem(key, '{invalid-library-for-explicit-reset'), LIBRARY_KEY);
  await page.reload();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-library-reset-storage]').click();
  await expect.poll(async () => (await readerState(page)).positions).toEqual([]);
  expect((await readerState(page)).fontSize).toBe('extra');
});

test('the static case has its own body reader and can retain a genuine reading position', async ({ page }) => {
  await openReader(page, CASE);
  const links = await tocLinks(page);
  expect(await links.count()).toBeGreaterThan(5);
  await scrollAndSave(page, CASE, 4);
  await page.goto('/search?q=围岩');
  await openReader(page, CASE);
  await expect(page.locator('[data-reader-resume]')).toBeVisible();
});

test('large-font reading and the resume prompt stay usable on mobile in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useFixture(page);
  await openReader(page);
  await page.locator('[data-reader-font="extra"]').click();
  await scrollAndSave(page, FILE_IO, 3);
  await page.goto('/search?q=CSV');
  await openReader(page);
  await expect(page.locator('[data-reader-resume]')).toBeVisible();
  await page.locator('[data-menu-toggle]').click();
  await page.locator('[data-theme-toggle]').click();
  await page.locator('[data-menu-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(body(page)).toHaveAttribute('data-reader-font-size', 'extra');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: '.wrangler/qa/reader-mobile-dark.png' });
  await page.locator('[data-reader-continue]').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: '.wrangler/qa/reader-mobile-resumed.png' });
});
