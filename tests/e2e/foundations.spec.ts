import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('https://cdn.jsdelivr.net/npm/mathjax@3/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
});

test('home and structural guide connect the ten existing lessons and runnable evidence', async ({ page, request }) => {
  await page.goto('/');
  await page.locator('.foundation-home-entry').click();
  await expect(page).toHaveURL(/\/domains\/structural\/#foundation-course$/);
  const guide = page.locator('#foundation-course');
  await expect(guide.getByRole('heading', { name: '力学与有限元基础', exact: true })).toBeVisible();
  await expect(guide.locator('.foundation-lessons a')).toHaveCount(10);
  await expect(guide).toContainText('待本人复核');
  await expect(guide).toContainText('用户本机待复现');
  await expect(page.locator('[data-plan-panel="low"] [data-node-id]')).toHaveCount(20);
  for (const path of ['verify_basics.py', 'README.md', 'reference-results.json', 'verify_extensions.py', 'EXTENSIONS.md', 'reference-extensions.json']) {
    const result = await request.get(`/downloads/mechanics-foundations/${path}`);
    expect(result.ok()).toBe(true);
    expect((await result.body()).length).toBeGreaterThan(100);
  }
  await page.screenshot({ path: '.wrangler/qa/foundations-guide-desktop.png', fullPage: true });
});

for (const [id, expected, script] of [
  ['units-and-dimensions', '7.70085'], ['static-equilibrium', '7500'],
  ['axial-members', '0.476190476'], ['shape-functions', '0.119047619'],
  ['element-stiffness', '2380.95238'], ['mesh-convergence', '0.330070085981'],
  ['supports-and-reactions', '2000', 'verify_extensions.py'], ['hookes-law', '42.857', 'verify_extensions.py'],
  ['global-assembly', '15000', 'verify_extensions.py'], ['constraint-methods', '15500', 'verify_extensions.py'],
]) {
  test(`${id} serves substantive foundation content with reader and accurate status`, async ({ page }) => {
    await page.goto(`/domains/structural/kp/${id}/`);
    await expect(page.locator('[data-kp-page]')).toHaveClass(/foundation-mode/);
    await expect(page.locator('[data-review-badge]')).toContainText('待本人复核');
    const content = page.locator('[data-kp-content]');
    await expect(content).toContainText(expected);
    await expect(content).toContainText('参考答案');
    expect(await content.locator('h2').count()).toBeGreaterThanOrEqual(8);
    await expect(page.locator('[data-tutorial-practice]')).toBeHidden();
    await expect(page.locator('[data-article-reader]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI 拓展', exact: true })).toBeVisible();
    await expect(content.getByRole('link', { name: /脚本/ }).first()).toHaveAttribute('href', `/downloads/mechanics-foundations/${script || 'verify_basics.py'}`);
    expect(await content.locator('h2').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(20);
  });
}

test('foundation guide and long article fit a narrow screen and use readable dark text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/domains/structural/#foundation-course');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.wrangler/qa/foundations-guide-mobile.png', fullPage: true });
  await page.goto('/domains/structural/kp/mesh-convergence/');
  await expect(page.locator('[data-kp-content] table')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  expect(await page.locator('[data-kp-content]').evaluate(el => getComputedStyle(el).color)).toBe('rgb(230, 237, 243)');
  await page.screenshot({ path: '.wrangler/qa/foundations-article-mobile-dark.png', fullPage: true });
});

test('formulas typeset when the optional MathJax script arrives after article content', async ({ page }) => {
  let pending: Route | undefined;
  await page.route('https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js', route => { pending = route; });
  await page.goto('/domains/structural/kp/element-stiffness/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-kp-content]')).toContainText('2380.95238');
  await expect.poll(() => Boolean(pending)).toBe(true);
  expect(await page.evaluate(() => (window as any).MathJax.startup.typeset)).toBe(false);
  // The CDN script can load before startup adds typesetPromise. Release that
  // phase separately so the test also catches lost startup callbacks.
  await pending!.fulfill({ contentType: 'application/javascript', body: 'window.MathJax={startup:{promise:new Promise(resolve=>{window.finishMathStartup=()=>{window.MathJax.typesetPromise=async function(els){els.forEach(el=>el.dataset.mathTypeset="true")};resolve();}})}};' });
  await expect.poll(() => page.evaluate(() => typeof (window as any).finishMathStartup)).toBe('function');
  await page.evaluate(() => (window as any).finishMathStartup());
  await expect(page.locator('[data-kp-content]')).toHaveAttribute('data-math-typeset', 'true');
  // Simulate an unbreakable rendered inline expression, independently of CDN
  // availability; it must scroll within the formula rather than widen the page.
  await page.locator('[data-kp-content]').evaluate(el => {
    const formula = document.createElement('mjx-container');
    const expression = document.createElement('span');
    expression.style.cssText = 'display:inline-block;width:800px;height:30px';
    expression.textContent = 'local formula layout fixture';
    formula.append(expression); el.append(formula);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('[data-kp-content] mjx-container').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
});
