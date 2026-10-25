import { expect, test, type Download } from '@playwright/test';

const PROJECT = '/learning/projects/csv-checker/';
const CASES = ['normal', 'missing-field', 'non-numeric', 'missing-unit'] as const;

test.beforeEach(async ({ page, baseURL }) => {
  const target = baseURL ? new URL(baseURL) : null;
  test.skip(!target || target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'CSV project acceptance runs only against a local Worker.');
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  await page.route('**/api/auth/csrf-token', route => route.fulfill({ json: { ok: true, token: 'local-csv-project-only' } }));
});

async function textOf(download: Download) {
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('project connects four fixed input fixtures to real Python without claiming actual results', async ({ page, request }) => {
  const mutations: string[] = [];
  const runtime: string[] = [];
  page.on('request', item => {
    if (!['GET', 'HEAD'].includes(item.method())) mutations.push(item.url());
    if (item.url().includes('/vendor/pyodide/')) runtime.push(item.url());
  });
  await page.goto(PROJECT);
  await expect(page.locator('[data-csv-project]')).toBeVisible();
  await expect(page.locator('[data-csv-case]')).toHaveCount(4);
  await expect(page.locator('[data-content-provenance="project:csv-checker"]')).toContainText('待本人复核');
  await expect(page.locator('[data-csv-project]')).toContainText('应用不会保存、公开或更新学习进度');
  for (const id of CASES) {
    const card = page.locator(`[data-csv-case="${id}"]`);
    await expect(card.locator('[data-csv-lab-link]')).toHaveAttribute('href', `/labs/python/?template=csv&case=${id}`);
    await expect(card.locator('[data-csv-lab-link]')).toHaveAttribute('target', '_blank');
    await expect(card.locator('[data-csv-lab-link]')).toHaveAttribute('rel', /noopener/);
    await expect(card.locator('.csv-expected')).toContainText('预期');
    const response = await request.get(`/downloads/csv-checker/${id}.csv`);
    expect(response.status()).toBe(200);
    expect(await card.locator('pre').textContent()).toBe(await response.text());
  }
  await expect(page.locator('a[href="/learning/records/?project=csv-checker#study-result-import"]').first()).toBeVisible();
  expect(mutations).toEqual([]);
  expect(runtime).toEqual([]);
});

test('case selection adopts only repository fixtures, stays anonymous and exports exact current input', async ({ page, request }) => {
  const runtime: string[] = [];
  page.on('request', item => { if (item.url().includes('/vendor/pyodide/')) runtime.push(item.url()); });
  for (const id of CASES) {
    await page.goto(`/labs/python/?template=csv&case=${id}&code=PRIVATE_QUERY_CODE&input=PRIVATE_QUERY_INPUT`);
    const fixture = await request.get(`/downloads/csv-checker/${id}.csv`);
    await expect(page.locator('#lab-input')).toHaveValue(await fixture.text());
    await expect(page.locator('#lab-template')).toHaveValue('csv');
    await expect(page.locator('[data-lab-project-case]')).toHaveAttribute('data-case-state', 'original');
    await expect(page.locator('[data-lab-project-case-body]')).toContainText('只是预期');
    await expect(page.locator('[data-lab-stdout]')).toHaveText('（暂无标准输出）');
    await expect(page.locator('[data-lab-export="result"]')).toBeDisabled();
    expect(await page.locator('#lab-code').inputValue()).not.toContain('PRIVATE_QUERY_CODE');
  }
  const download = page.waitForEvent('download');
  await page.locator('[data-lab-export="input"]').click();
  expect(await textOf(await download)).toBe(await page.locator('#lab-input').inputValue());
  await page.locator('[data-lab-run]').click();
  await expect(page.locator('[data-python-lab]')).toHaveAttribute('data-lab-state', 'anonymous');
  await expect(page.locator('[data-lab-project-case-body]')).toContainText('不是你的实际结果');
  expect(runtime).toEqual([]);
});

test('edited input and code lose original-fixture claims; loading another template clears the hint', async ({ page }) => {
  await page.goto('/labs/python/?template=csv&case=normal');
  await page.locator('#lab-input').fill('parameter,value,unit\nE,edited,N/mm2\n');
  await expect(page.locator('[data-lab-project-case]')).toHaveAttribute('data-case-state', 'edited');
  await expect(page.locator('[data-lab-project-case-body]')).toContainText('不再标作原教学样例');
  await expect(page.locator('[data-lab-project-case-body]')).not.toContainText('当前代码与输入来自项目预设');
  await page.reload();
  await page.locator('#lab-code').fill('print("my own experiment")');
  await expect(page.locator('[data-lab-project-case]')).toHaveAttribute('data-case-state', 'edited');
  await page.locator('#lab-template').selectOption('bar');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-lab-load-template]').click();
  await expect(page.locator('[data-lab-project-case]')).toBeHidden();
  await expect(page.locator('[data-lab-project-case]')).toHaveAttribute('data-case-state', 'cleared');
  await expect(page.locator('#lab-input')).toHaveValue(/"E"/);
});

test('unknown, duplicate and mismatched case queries cannot choose input or execute code', async ({ page }) => {
  const runtime: string[] = [];
  page.on('request', item => { if (item.url().includes('/vendor/pyodide/')) runtime.push(item.url()); });
  for (const query of ['template=csv&case=unknown', 'template=csv&case=normal&case=missing-unit', 'template=csv&template=bar&case=normal', 'template=bar&case=normal', 'case=normal']) {
    await page.goto(`/labs/python/?${query}`);
    await expect(page.locator('[data-lab-project-case]')).toBeHidden();
    await expect(page.locator('[data-python-lab]')).toHaveAttribute('data-lab-state', 'idle');
    await expect(page.locator('[data-lab-export="result"]')).toBeDisabled();
  }
  expect(runtime).toEqual([]);
});

test('mobile dark mode presents full fixture text without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value: () => { throw new Error('storage disabled for CSV acceptance'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value: () => { throw new Error('storage disabled for CSV acceptance'); } });
  });
  await page.goto(PROJECT);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  for (const id of CASES) await page.locator(`[data-csv-case="${id}"] summary`).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const contrast = await page.locator('[data-csv-case="normal"] pre').evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }));
  expect(contrast.color).not.toBe(contrast.background);
  await expect(page.locator('[data-csv-case="normal"] pre')).toContainText('parameter,value,unit');
});
