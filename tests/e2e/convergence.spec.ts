import { expect, test, type Download, type Page } from '@playwright/test';
const ROUTE = '/labs/convergence/';
test.beforeEach(async ({ page, baseURL }) => {
  const url = baseURL ? new URL(baseURL) : null;
  test.skip(!url || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Local fixture input only.');
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('https://cdn.jsdelivr.net/npm/mathjax@3/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
});
const input = (page: Page, name: string) => page.locator(`#convergence-form [name="${name}"]`);
async function downloadText(download: Download) {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
test('real teaching data produces SVG points, equivalent table and keyboard point detail without claiming completion', async ({ page }) => {
  await page.goto(ROUTE); await page.locator('#convergence-example').click();
  await page.evaluate(() => {
    (window as any).__convergenceActivity = [];
    window.addEventListener('simulearn:activity', event => (window as any).__convergenceActivity.push((event as CustomEvent).detail));
  });
  await expect(page.locator('#convergence-chart svg')).toHaveCount(0);
  await expect(input(page, 'unit')).toHaveValue('mm'); await expect(input(page, 'reference')).toHaveValue('0.3300700859809263');
  await page.locator('#convergence-analyze').click();
  expect(await page.evaluate(() => (window as any).__convergenceActivity)).toEqual([{ kind: 'practice-check', page: 'convergence' }]);
  await expect(page.locator('#convergence-table tbody tr')).toHaveCount(5);
  await expect(page.locator('[data-convergence-point]')).toHaveCount(5);
  await expect(page.locator('#convergence-source')).toContainText('不是用户运行');
  await page.locator('[data-convergence-point="2"]').focus();
  await expect(page.locator('#convergence-point')).toContainText('第 2 档');
  await expect(page.locator('#convergence-point')).toContainText('500');
  await expect(page.locator('#convergence-status')).toContainText('没有自动作出收敛');
  const invalidCoordinates = await page.locator('#convergence-chart svg').evaluate(svg => Array.from(svg.querySelectorAll('circle')).some(circle => !Number.isFinite(Number(circle.getAttribute('cx'))) || !Number.isFinite(Number(circle.getAttribute('cy')))));
  expect(invalidCoordinates).toBe(false);
  await input(page, 'unit').fill('N'); await expect(page.locator('#convergence-chart svg')).toHaveCount(0);
  await expect(page.locator('#convergence-export-json')).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__convergenceActivity)).toHaveLength(1);
});
test('malformed CSV reports the exact field and scientific notation is parsed after explicit units', async ({ page }) => {
  await page.goto(ROUTE); await input(page, 'target').fill('位移'); await input(page, 'unit').fill('mm');
  await input(page, 'csv').fill('h,value\n4,1\n2,2\n1,NaN'); await page.locator('#convergence-analyze').click();
  await expect(page.locator('#convergence-status')).toContainText('第 4 行，第 3 列');
  await expect(page.locator('#convergence-chart svg')).toHaveCount(0);
  await input(page, 'csv').fill('h,value\n4e0,-1e0\n2e0,-1.5e0\n1e0,-2e0'); await page.locator('#convergence-analyze').click();
  await expect(page.locator('#convergence-table tbody tr')).toHaveCount(3);
  await expect(page.locator('#convergence-table')).toContainText('无参考');
});
test('local file upload sorts explicitly, exports original strings/conditions and never calls a study or solver API', async ({ page }) => {
  const mutations: string[] = []; page.on('request', request => { if (/\/api\/(study|cae|ai|learning)/.test(request.url())) mutations.push(request.url()); });
  await page.goto(ROUTE);
  await page.locator('#convergence-file').setInputFiles({ name: 'local-grid.csv', mimeType: 'text/csv', buffer: Buffer.from('h,value\r\n1,3e-1\r\n4,0.1\r\n2,.2') });
  await expect(page.locator('#convergence-status')).toContainText('本地文件已读入');
  await input(page, 'target').fill('自定义目标'); await input(page, 'unit').fill('未知但显式的单位'); await input(page, 'conditions').fill('同一支承与提取位置');
  await page.locator('#convergence-analyze').click();
  await expect(page.locator('#convergence-status')).toContainText('从粗到细排序');
  const jsonDownload = page.waitForEvent('download'); await page.locator('#convergence-export-json').click();
  const json = JSON.parse(await downloadText(await jsonDownload));
  expect(json.report.originalRows.map((row: any) => row.h)).toEqual([1, 4, 2]); expect(json.report.rows.map((row: any) => row.h)).toEqual([4, 2, 1]);
  expect(json.report.originalRows[0].valueText).toBe('3e-1'); expect(json.report.unit).toBe('未知但显式的单位'); expect(json.report.conditions).toBe('同一支承与提取位置');
  expect(json.source).toContain('local-grid.csv'); expect(json.report.logs.join(' ')).toContain('未自动换算');
  const csvDownload = page.waitForEvent('download'); await page.locator('#convergence-export-csv').click();
  const csv = await downloadText(await csvDownload); expect(csv).toContain('h_raw,value_raw'); expect(csv).toContain('analysis_log'); expect(csv).toContain('同一支承与提取位置');
  await input(page, 'csv').fill('h,value\n1,0.4\n4,0.1\n2,0.2');
  await expect(page.locator('#convergence-source')).not.toContainText('local-grid.csv');
  await expect(page.locator('#convergence-source')).toContainText('本页编辑的 CSV');
  await page.locator('#convergence-analyze').click();
  const editedDownload = page.waitForEvent('download'); await page.locator('#convergence-export-json').click();
  const edited = JSON.parse(await downloadText(await editedDownload));
  expect(edited.source).not.toContain('local-grid.csv'); expect(edited.report.originalRows[0].valueText).toBe('0.4');
  expect(mutations).toEqual([]);
});
test('zero denominators remain unavailable and hostile metadata is only text', async ({ page }) => {
  await page.goto(ROUTE); await input(page, 'csv').fill('h,value\n4,2\n2,1\n1,0');
  await input(page, 'target').fill('<img src=x onerror="window.bad=1">'); await input(page, 'unit').fill('mm'); await input(page, 'reference').fill('0');
  await page.locator('#convergence-analyze').click();
  await expect(page.locator('#convergence-table tbody tr').last()).toContainText('不可计算');
  await expect(page.locator('#convergence-table img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).bad)).toBeUndefined();
});
test('mobile rendering keeps the page within the viewport and allows table scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(ROUTE);
  await page.locator('#convergence-example').click(); await page.locator('#convergence-analyze').click();
  await expect(page.locator('#convergence-chart svg')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expect(page.locator('a[href="/learning/projects/linear-static/"]').last()).toBeVisible();
  await expect(page.locator('a[href="/diagnostic/stress-singularity/"]')).toHaveCount(1);
});
