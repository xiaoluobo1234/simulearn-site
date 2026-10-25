import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
});

test('homepage composition retains real evidence and accessible primary paths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.hero-line')).toHaveCount(2);
  await expect(page.locator('.hero-actions a')).toHaveCount(2);
  await expect(page.locator('.shortcut')).toHaveCount(4);
  await expect(page.locator('.domain-card')).toHaveCount(5);
  await expect(page.locator('.progress-track')).toHaveCount(0);
  await expect(page.locator('.domain-card--featured .build-status')).toHaveText('实践沉淀');
  await expect(page.locator('.hero-visual figcaption')).toContainText('非求解结果');
  await expect(page.locator('.case-figure img')).toHaveAttribute('src', '/images/cases/energy-partition.png');
  const content = await page.locator('.home-content').evaluate(el => Array.from(el.children).filter(c => !c.hasAttribute('hidden')).map(c => c.className));
  expect(content.slice(0, 2)).toEqual(['domain-section', 'case-section']);
  expect(await page.locator('.hero-line').evaluateAll(lines => lines.every(el => el.scrollWidth <= el.getBoundingClientRect().width + 1))).toBe(true);
  // Below-fold illustrations load when scrolled into view; wait for decoding
  // rather than treating a pending native lazy load as a broken image.
  for (const image of await page.locator('.home-page img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '.wrangler/qa/home-desktop-v2.png', fullPage: true });
  await page.locator('[data-domain-menu] summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-domain-menu] a').first()).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-domain-menu] a').first()).toBeFocused();
  await page.locator('.hero-actions a').first().click();
  await expect(page).toHaveURL(/\/learning\/start\/$/);
  await expect(page.locator('#first-study-form')).toBeVisible();
});

test('homepage stays readable on mobile and respects dark theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.hero-visual img')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.wrangler/qa/home-mobile-v2.png', fullPage: true });
  await page.getByRole('button', { name: '打开导航' }).click();
  await page.locator('[data-domain-menu] summary').click();
  await expect(page.locator('[data-domain-menu] a')).toHaveCount(5);
  await expect(page.locator('[data-domain-menu] a').last()).toBeVisible();
  await expect(page.locator('[data-primary-nav]').first()).toHaveAttribute('href', '/learning');
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '打开导航' }).click();
  await page.screenshot({ path: '.wrangler/qa/home-mobile-dark-v2.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
