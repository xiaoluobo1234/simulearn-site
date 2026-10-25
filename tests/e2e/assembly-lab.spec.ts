import { expect, test, type Download, type Page } from '@playwright/test';

const LAB = '/labs/assembly/';
const input = (page: Page, name: string) => page.locator(`#assembly-form [name="${name}"]`);
const value = (page: Page, name: string) => page.locator(`[data-result-value="${name}"]`);
test.beforeEach(async ({ page, baseURL }) => {
  const url = baseURL ? new URL(baseURL) : null;
  test.skip(!url || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Teaching acceptance runs only on a local server.');
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
});
async function signedFixture(page: Page) {
  // Auth is mocked; the teaching numerical solve itself runs in the real browser.
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: { userId: 'local-assembly-fixture' } } }));
  await page.goto(LAB);
  await expect(page.locator('#assembly-auth')).toContainText('账户已连接');
}
async function downloadText(download: Download) {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
async function exported(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#assembly-export').click();
  const download = await pending; expect(download.suggestedFilename()).toBe('assembly-lab-reference.json');
  return JSON.parse(await downloadText(download));
}
async function number(page: Page, key: string) { return Number(await value(page, key).getAttribute('data-numeric')); }

test('anonymous users can follow connectivity and stepwise additions, but cannot solve or store results', async ({ page }) => {
  const mutations: string[] = []; let checks = 0;
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/api/auth/me') checks++;
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.url());
  });
  await page.addInitScript(() => {
    const writes: string[] = [];
    (window as unknown as { assemblyStorageWrites: string[] }).assemblyStorageWrites = writes;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === window.localStorage) writes.push(`${key}:${value}`);
      return original.call(this, key, value);
    };
  });
  await page.goto(LAB);
  await expect(page.locator('#assembly-auth')).toContainText('匿名');
  await expect(page.locator('#assembly-local [data-matrix-cell="0,0"]')).toHaveAttribute('data-numeric', '42000');
  await page.locator('[data-select-element="1"]').click();
  await expect(page.locator('[data-element-shape="1"]')).toHaveClass(/is-selected/);
  const local = page.locator('[data-local-cell="0,1"]');
  await local.focus(); await page.keyboard.press('Enter');
  await expect(local).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#assembly-contribution [data-matrix-cell="1,2"]')).toHaveClass(/is-active/);
  await expect(page.locator('#assembly-cell-explanation')).toContainText('K[1, 2]');
  await page.locator('[data-assembly-step="0"]').click();
  expect(await page.locator('#assembly-global td').evaluateAll(cells => cells.every(cell => (cell as HTMLElement).dataset.numeric === '0'))).toBe(true);
  await page.locator('[data-assembly-step="1"]').click();
  await expect(page.locator('#assembly-global [data-matrix-cell="1,1"]')).toHaveAttribute('data-numeric', '42000');
  await expect(page.locator('#assembly-global [data-matrix-cell="2,2"]')).toHaveAttribute('data-numeric', '0');
  await page.locator('[data-assembly-step="2"]').click();
  await expect(page.locator('#assembly-global [data-matrix-cell="1,1"]')).toHaveAttribute('data-numeric', '84000');
  await expect(page.locator('#assembly-global [data-matrix-cell="2,2"]')).toHaveAttribute('data-numeric', '42000');
  await page.locator('#assembly-solve').click();
  await expect(page.locator('#assembly-status')).toContainText('请先登录');
  await expect(page.locator('#assembly-result')).toBeHidden();
  await expect(page.locator('#assembly-export')).toBeDisabled();
  expect(checks).toBeGreaterThanOrEqual(2);
  expect(mutations).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { assemblyStorageWrites: string[] }).assemblyStorageWrites)).toEqual([]);
});

test('the browser actually solves, exports original-equation evidence and invalidates results after a parameter edit', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') mutations.push(request.url()); });
  await page.addInitScript(() => {
    const events: unknown[] = [];
    (window as unknown as { assemblyActivityEvents: unknown[] }).assemblyActivityEvents = events;
    window.addEventListener('simulearn:activity', event => {
      const detail = (event as CustomEvent).detail;
      if (detail?.kind === 'reference-run' && detail?.page === 'assembly') events.push(detail);
    });
  });
  await signedFixture(page);
  await page.locator('#assembly-solve').click();
  await expect(page.locator('#assembly-result')).toBeVisible();
  expect(await number(page, 'u1')).toBeCloseTo(5 / 21, 10);
  expect(await number(page, 'u2')).toBeCloseTo(10 / 21, 10);
  expect(await number(page, 'R0')).toBeCloseTo(-10000, 7);
  expect(await number(page, 'energy')).toBeCloseTo(50000 / 21, 7);
  const result = await exported(page);
  expect(result.execution.executor).toBe('当前浏览器 JavaScript 教学计算');
  expect(result.execution.notEvidenceOf).toContain('ANSYS 求解');
  expect(result.solution.model.K).toEqual([[42000, -42000, 0], [-42000, 84000, -42000], [0, -42000, 42000]]);
  expect(result.solution.displacement[2]).toBeCloseTo(10 / 21, 10);
  expect(result.solution.maxFreeResidual).toBeLessThan(1e-7);
  expect(result.solution.equilibriumResidual).toBeCloseTo(0, 7);
  expect(await page.evaluate(() => (window as unknown as { assemblyActivityEvents: unknown[] }).assemblyActivityEvents)).toEqual([{ kind: 'reference-run', page: 'assembly' }]);
  await input(page, 'E').fill('4.2e5');
  await expect(page.locator('#assembly-result')).toBeHidden();
  await expect(page.locator('[data-result-value]')).toHaveCount(0);
  await expect(page.locator('#assembly-export')).toBeDisabled();
  await expect(page.locator('#assembly-status')).toContainText('旧求解结果');
  await page.locator('#assembly-solve').click();
  await expect(page.locator('#assembly-result')).toBeVisible();
  expect(await number(page, 'u2')).toBeCloseTo(5 / 21, 10);
  expect(await number(page, 'energy')).toBeCloseTo(25000 / 21, 7);
  expect(await number(page, 'R0')).toBeCloseTo(-10000, 7);
  expect(await page.evaluate(() => (window as unknown as { assemblyActivityEvents: unknown[] }).assemblyActivityEvents)).toEqual([{ kind: 'reference-run', page: 'assembly' }, { kind: 'reference-run', page: 'assembly' }]);
  expect(mutations).toEqual([]);
});

test('nonzero support motion changes Kfc*uc and the RHS without creating artificial elastic energy', async ({ page }) => {
  await signedFixture(page);
  await input(page, 'A2').fill('50'); await input(page, 'L1').fill('400'); await input(page, 'L2').fill('600'); await input(page, 'uc').fill('.2');
  await page.locator('#assembly-solve').click();
  await expect(page.locator('#assembly-result')).toBeVisible();
  await expect(page.locator('#assembly-partition')).toContainText('Kfc · uc / N = [-10500, 0]');
  await expect(page.locator('#assembly-partition')).toContainText('Ff − Kfc · uc / N = [10500, 10000]');
  const result = (await exported(page)).solution;
  expect(result.displacement[0]).toBe(.2);
  expect(result.displacement[1]).toBeCloseTo(.2 + 4 / 21, 10);
  expect(result.displacement[2]).toBeCloseTo(.2 + 16 / 21, 10);
  expect(result.reactionAndResidual[0]).toBeCloseTo(-10000, 7);
  expect(result.strainEnergy).toBeCloseTo(80000 / 21, 7);
  expect(result.energyFromEndForces).toBeCloseTo(result.strainEnergy, 7);
});

test('a free model refuses unique displacements for nonzero and zero load without adding weak springs', async ({ page }) => {
  await signedFixture(page);
  await input(page, 'constraint').selectOption('free');
  await page.locator('#assembly-solve').click();
  await expect(page.locator('#assembly-status')).toContainText('完整刚度矩阵奇异');
  await expect(page.locator('#assembly-status')).toContainText('不添加弱弹簧');
  await expect(page.locator('#assembly-result')).toBeHidden();
  await expect(page.locator('#assembly-export')).toBeDisabled();
  await input(page, 'P').fill('0'); await page.locator('#assembly-solve').click();
  await expect(page.locator('#assembly-status')).toContainText('无法给出唯一位移');
  await expect(page.locator('#assembly-result')).toBeHidden();
  await page.locator('[data-assembly-step="2"]').click();
  expect(await page.locator('#assembly-global tbody tr').evaluateAll(rows => rows.map(row => [...row.querySelectorAll<HTMLElement>('td')].reduce((sum, cell) => sum + Number(cell.dataset.numeric), 0)))).toEqual([0, 0, 0]);
});

test('invalid ranges and partial unit strings clear the old matrices and cannot be solved', async ({ page }) => {
  await signedFixture(page);
  await page.locator('#assembly-solve').click(); await expect(page.locator('#assembly-result')).toBeVisible();
  await input(page, 'A1').fill('0'); await input(page, 'L2').fill('500 mm');
  await page.locator('#assembly-solve').click();
  await expect(page.locator('#assembly-validation')).toContainText('单元 1 截面');
  await expect(page.locator('#assembly-validation')).toContainText('完整的有限十进制');
  await expect(page.locator('#assembly-local table')).toHaveCount(0);
  await expect(page.locator('#assembly-result')).toBeHidden();
  await expect(page.locator('#assembly-export')).toBeDisabled();
  await input(page, 'A1').fill('1e2'); await input(page, 'L2').fill('5e2');
  await page.locator('#assembly-solve').click(); await expect(page.locator('#assembly-result')).toBeVisible();
  expect(await number(page, 'u2')).toBeCloseTo(10 / 21, 10);
});

test('solve checks the current session again rather than trusting an earlier signed-in badge', async ({ page }) => {
  await page.unroute('**/api/auth/me'); let loggedIn = true, requests = 0;
  await page.route('**/api/auth/me', route => { requests++; return route.fulfill({ json: { ok: true, user: loggedIn ? { userId: 'local-expiring-fixture' } : null } }); });
  await page.goto(LAB); await expect(page.locator('#assembly-auth')).toContainText('账户已连接');
  await expect(page.locator('[data-user-menu]')).toBeVisible();
  const initialRequests = requests;
  loggedIn = false;
  await page.locator('#assembly-solve').click();
  await expect(page.locator('#assembly-status')).toContainText('请先登录');
  await expect(page.locator('#assembly-auth')).toContainText('匿名');
  await expect(page.locator('#assembly-result')).toBeHidden();
  expect(requests).toBe(initialRequests + 1);
});

test('the model, three matrices and computed results fit a 390px dark viewport', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await signedFixture(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('[data-select-element="1"]').click(); await page.locator('[data-assembly-step="2"]').click();
  await page.locator('#assembly-solve').click(); await expect(page.locator('#assembly-result')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
