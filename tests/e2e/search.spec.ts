import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok:true, user:null } }));
});

test('homepage search submits useful terms to complete public results', async ({ page }) => {
  await page.goto('/');
  await page.locator('#home-search-input').fill('CSV');
  await page.getByRole('search', { name:'首页站内搜索' }).getByRole('button', { name:'搜索' }).click();
  await expect(page).toHaveURL(/\/search\/?\?q=CSV$/);
  await expect(page.locator('#searchInput')).toHaveValue('CSV');
  await expect(page.locator('[data-search-result]').first()).toHaveAttribute('href','/domains/tools/kp/file-io/');
  await expect(page.locator('#searchStats')).toContainText('3 条结果');
});

test('keyboard users can skip navigation and reach the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-to-content')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('Chinese composition does not submit or replace query state prematurely', async ({ page }) => {
  await page.goto('/search');
  const input = page.locator('#searchInput');
  await input.dispatchEvent('compositionstart');
  await input.fill('接触');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/search\/?$/);
  await expect(page.locator('#searchRecommendations')).toBeVisible();
  await input.dispatchEvent('compositionend');
  await expect(page).toHaveURL(/q=%E6%8E%A5%E8%A7%A6/);
  await expect(page.locator('#searchRecommendations')).not.toBeVisible();
});

test('search restores combined filters and meaningful browser history', async ({ page }) => {
  await page.goto('/search?q=CSV&domain=tools&type=kp');
  await expect(page.locator('#searchDomain')).toHaveValue('tools');
  await expect(page.locator('#searchType')).toHaveValue('kp');
  await expect(page.locator('[data-search-result]')).toHaveCount(1);
  await page.locator('#searchDomain').selectOption('thermal');
  await expect(page.locator('[data-search-result]')).toHaveCount(0);
  await expect(page.getByText('暂时没有匹配的内容',{exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.locator('#searchDomain')).toHaveValue('tools');
  await expect(page.locator('[data-search-result]')).toHaveCount(1);
  await page.goForward();
  await expect(page.locator('#searchDomain')).toHaveValue('thermal');
  await page.getByRole('button',{name:'清除筛选，保留关键词'}).click();
  await expect(page.locator('#searchInput')).toHaveValue('CSV');
  await expect(page.locator('[data-search-result]')).toHaveCount(3);
});

test('pagination reports all matching content rather than the first display batch', async ({ page }) => {
  await page.goto('/search?type=kp');
  await expect(page.locator('#searchStats')).toContainText('532 条结果');
  await expect(page.locator('[data-search-result]')).toHaveCount(20);
  await page.locator('#searchMore').click();
  await expect(page.locator('[data-search-result]')).toHaveCount(40);
  await expect(page.locator('#searchShown')).toHaveText('已显示 40 / 532 条');
  await expect(page.locator('[data-search-result]').nth(20)).toBeFocused();
});

test('legacy hashes and untrusted query text remain safe', async ({ page }) => {
  const errors:string[]=[]; page.on('pageerror', error=>errors.push(error.message));
  await page.goto('/search#ANSYS-004');
  await expect(page.locator('#searchInput')).toHaveValue('ANSYS-004');
  await expect(page).toHaveURL(/\?q=ANSYS-004$/);
  await expect(page.locator('[data-search-result]')).toHaveCount(1);
  await page.goto('/search#%ZZ');
  await expect(page.locator('#searchInput')).toHaveValue('%ZZ');
  await page.locator('#searchInput').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#searchStats')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#searchStats img')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('quick search supports keyboard selection, escape and private-content exclusion', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('[data-site-search]')).toBeVisible();
  await expect(page.locator('#quick-search-input')).toBeFocused();
  await page.locator('#quick-search-input').fill('ANSYS-004');
  await expect(page.locator('[data-quick-result]')).toHaveCount(1);
  await page.screenshot({path:'.wrangler/qa/quick-search.png'});
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-quick-result]').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/errors\/#ANSYS-004$/);
  await expect(page.locator('#ANSYS-004 .error-details')).toHaveAttribute('open','');
  await expect(page.locator('#ANSYS-004')).toBeFocused();
  const index=await page.request.get('/search-index.json');
  const data=await index.json();
  expect(data.entries.length).toBe(621);
  expect(data.entries.every((item:{href:string})=>!item.href.startsWith('/api/')&&!item.href.includes('owner=')&&!item.href.includes('/learning/shared'))).toBe(true);
});

test('shortcuts leave editable text and existing dialogs alone', async ({ page }) => {
  await page.goto('/');
  await page.locator('#home-search-input').fill('keep draft');
  await page.keyboard.press('Control+k');
  await expect(page.locator('[data-site-search]')).not.toBeVisible();
  await expect(page.locator('#home-search-input')).toHaveValue('keep draft');
  await page.keyboard.press('/');
  await expect(page.locator('#home-search-input')).toHaveValue('keep draft/');
  await page.getByRole('heading',{name:/从结构有限元出发/}).click();
  await page.keyboard.press('/');
  await expect(page.locator('[data-site-search]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-site-search]')).not.toBeVisible();
});

test('loading the quick index preserves keyboard focus on common entrances', async ({ page }) => {
  let releaseIndex!: () => void;
  const pendingIndex = new Promise<void>(resolve => { releaseIndex = resolve; });
  await page.route('**/search-index.json', async route => { await pendingIndex; await route.continue(); });
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await page.keyboard.press('ArrowDown');
  const firstLink = page.locator('[data-quick-result]').first();
  await expect(firstLink).toHaveAttribute('href','/learning');
  await expect(firstLink).toBeFocused();
  const loaded = page.waitForResponse(response => response.url().endsWith('/search-index.json'));
  releaseIndex();
  await (await loaded).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(firstLink).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#quick-search-input')).toBeFocused();
  await page.locator('#quick-search-input').fill('ANSYS-004');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-quick-result]')).toHaveCount(1);
  await expect(page.locator('[data-quick-result]').first()).toBeFocused();
});

test('quick search failure gives a working full-search fallback', async ({ page }) => {
  await page.route('**/search-index.json', route=>route.fulfill({status:503,body:'unavailable'}));
  await page.goto('/');
  await page.locator('.search-link[data-quick-search]').click();
  await page.locator('#quick-search-input').fill('围岩');
  await expect(page.locator('#quick-search-status')).toContainText('索引暂不可用');
  await page.locator('[data-quick-all]').click();
  await expect(page).toHaveURL(/\/search\/?\?q=%E5%9B%B4%E5%B2%A9$/);
  await expect(page.locator('[data-search-result]').first()).toHaveAttribute('href','/cases/rock-dynamic-stability/');
});

test('mobile has direct search and menus close without a pointing device', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.locator('.mobile-search-trigger').click();
  await expect(page.locator('[data-site-search]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mobile-search-trigger')).toBeFocused();
  await page.locator('[data-menu-toggle]').click();
  await page.locator('[data-domain-menu] summary').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-domain-menu]')).not.toHaveAttribute('open','');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-menu-toggle]')).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('[data-menu-toggle]')).toBeFocused();
  await page.locator('[data-menu-toggle]').click();
  await page.locator('.hero-visual figcaption').click();
  await expect(page.locator('[data-menu-toggle]')).toHaveAttribute('aria-expanded','false');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('error deep links reveal hidden targets and handle malformed hashes', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[]; page.on('pageerror', error=>errors.push(error.message));
  await page.goto('/errors/#ANSYS-004');
  await expect(page.locator('#ANSYS-004 .error-details')).toHaveAttribute('open','');
  await expect.poll(()=>page.locator('#ANSYS-004').evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(80);
  await page.locator('.filter-btn[data-filter="Abaqus"]').click();
  await page.locator('#errorSearch').fill('not-found');
  await page.evaluate(()=>location.hash='FLUENT-008');
  await expect(page.locator('#FLUENT-008 .error-details')).toHaveAttribute('open','');
  await expect(page.locator('#errorSearch')).toHaveValue('');
  await expect(page.locator('.filter-btn[data-filter="all"]')).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>location.hash='%ZZ');
  expect(errors).toEqual([]);
});

test('search is responsive in dark mode and the tools route has a navigation context', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/search?q=ANSYS-004');
  await page.locator('[data-menu-toggle]').click();
  await page.locator('[data-theme-toggle]').click();
  await page.locator('[data-menu-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.wrangler/qa/search-mobile-dark.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>localStorage.setItem('simulearn-theme','light'));
  await page.goto('/search?q=CSV');
  await page.screenshot({path:'.wrangler/qa/search-desktop.png',fullPage:true});
  await page.goto('/domains/tools/kp/functions/');
  await expect(page.locator('[data-primary-nav][href="/tools"]')).toHaveClass(/active/);
  await page.goto('/learning/records/');
  await expect(page.locator('header [aria-current="page"]')).toHaveCount(1);
  await expect(page.locator('header [aria-current="page"]')).toHaveAttribute('href','/learning/records');
});
