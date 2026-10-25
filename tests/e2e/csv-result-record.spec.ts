import { expect, test, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const PATH = '/learning/records/?project=csv-checker#study-result-import';
const code = readFileSync('public/downloads/python-lab/csv_check.py', 'utf8');
const input = readFileSync('public/downloads/csv-checker/non-numeric.csv', 'utf8');
const existingId = 'record-11111111-1111-4111-8111-111111111111';
const account = { userId: 'csv-import-local-fixture' };
// Synthetic UI declarations only. Real Python and storage are covered separately.
function result(stdout = '<img src=x onerror="alert(1)">\r<script>PRIVATE_OUTPUT</script>') {
  return JSON.stringify({ schemaVersion: 1, executor: '用户当前浏览器 WebWorker', state: 'succeeded', code, input, stdout, stderr: '', value: '', environment: 'CPython 3.14.2 · Pyodide 314.0.7 · WebAssembly / WebWorker', startedAt: '2026-10-25T01:00:00.000Z', finishedAt: '2026-10-25T01:00:01.000Z', elapsedMs: 1000, limitation: 'Synthetic local browser UI fixture; not evidence of a real execution.' });
}
async function select(page: Page, original = result(), name = 'synthetic-python-result.json') {
  await page.locator('#study-result-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(original) });
}
async function ready(page: Page) { await expect(page.locator('#study-result-apply')).toBeEnabled(); }
async function textOf(download: Download) {
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
async function exported(page: Page) {
  const download = page.waitForEvent('download'); await page.locator('#study-export-json').click();
  return JSON.parse(await textOf(await download));
}
test.beforeEach(async ({ page, baseURL }) => {
  const target = baseURL ? new URL(baseURL) : null;
  test.skip(!target || target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Synthetic private import fixtures run only on a local Worker.');
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  await page.route('**/api/auth/csrf-token', route => route.fulfill({ json: { ok: true, token: 'local-csv-import-only' } }));
});

test('anonymous preview, rejected replacement and explicit new draft keep claims private and raw bytes in exports', async ({ page }) => {
  const writes: string[] = [], runtime: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); if (request.url().includes('/vendor/pyodide/')) runtime.push(request.url()); });
  await page.goto(PATH);
  await expect(page.locator('#study-auth')).toContainText('登录后');
  await page.locator('#study-title').fill('PRIVATE CURRENT DRAFT');
  const original = result();
  await select(page, original); await ready(page);
  await page.locator('#study-title').blur();
  await ready(page); // Delayed same-value text change on blur is not a new edit.
  await expect(page.locator('#study-title')).toHaveValue('PRIVATE CURRENT DRAFT');
  await expect(page.locator('#study-result-metadata')).toContainText('未经核验');
  await expect(page.locator('#study-result-stdout')).toContainText('<script>PRIVATE_OUTPUT</script>');
  await expect(page.locator('#study-result-preview script, #study-result-preview img')).toHaveCount(0);
  expect(writes).toEqual([]);
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#study-result-apply').click();
  await expect(page.locator('#study-title')).toHaveValue('PRIVATE CURRENT DRAFT');
  await expect(page.locator('#study-result-status')).toContainText('已取消替换');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#study-result-apply').click();
  await expect(page.locator('#study-title')).toHaveValue(/CSV 结果归档/);
  await expect(page.locator('#study-save-state')).toContainText('未保存');
  await expect(page.locator('[name="learningStatus"]')).toHaveValue('not-started');
  await expect(page.locator('[name="reviewStatus"]')).toHaveValue('draft');
  await expect(page.locator('[name="visibility"]')).toHaveValue('private');
  await expect(page.locator('[name="field:date"]')).toHaveValue('');
  await expect(page.locator('[name="field:organizedDate"]')).toHaveValue('');
  const backup = await exported(page);
  expect(backup.item.id).toBeUndefined(); expect(backup.item.revision).toBeUndefined();
  expect(backup.item.sourceIds).toEqual([]); expect(backup.item.noteIds).toEqual([]);
  expect(backup.item.fields.csvResultOriginal).toBe(original);
  const metadata = JSON.parse(backup.item.fields.csvResultMetadata);
  expect(metadata).toMatchObject({ trust: 'unverified-imported-file', declaredState: 'succeeded', caseId: 'non-numeric', templateMatch: true, sizeBytes: Buffer.byteLength(original), sha256: createHash('sha256').update(original).digest('hex') });
  await page.locator('#study-body').fill('## 我的人工说明\n\n仍待核对。');
  const mdDownload = page.waitForEvent('download'); await page.locator('#study-export').click();
  const md = await textOf(await mdDownload);
  expect(md).toContain('\n    <img src=x onerror="alert(1)">\n    <script>PRIVATE_OUTPUT</script>');
  expect(md).toContain('## 整理稿\n\n## 我的人工说明');
  await page.locator('#study-save').click(); await expect(page.locator('#study-message')).toContainText('请先登录');
  expect(writes).toEqual([]); expect(runtime).toEqual([]);
  expect(page.url()).not.toContain('PRIVATE_OUTPUT');
  expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(value => value.includes('PRIVATE_OUTPUT')))).toBe(false);
});

test('cancelled delayed read cannot revive a preview, and the same file can be selected again', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    const scope = window as unknown as { releaseCsvFile: () => void; csvFileFinished: boolean };
    const gate = new Promise<void>(resolve => { scope.releaseCsvFile = resolve; });
    scope.csvFileFinished = false;
    File.prototype.arrayBuffer = async function () { const bytes = await original.call(this); if (this.name === 'slow-result.json') { await gate; scope.csvFileFinished = true; } return bytes; };
  });
  await page.goto(PATH);
  await select(page, result(), 'slow-result.json');
  await expect(page.locator('#study-result-status')).toContainText('正在本地读取');
  await page.locator('#study-result-cancel').click();
  await page.evaluate(() => (window as unknown as { releaseCsvFile: () => void }).releaseCsvFile());
  await expect.poll(() => page.evaluate(() => (window as unknown as { csvFileFinished: boolean }).csvFileFinished)).toBe(true);
  await expect(page.locator('#study-result-preview')).toBeHidden();
  await expect(page.locator('#study-result-apply')).toBeDisabled();
  await select(page, result(), 'slow-result.json'); await ready(page);
  await expect(page.locator('#study-result-metadata')).toContainText('slow-result.json');
  await page.locator('#study-title').fill('EDIT AFTER PREVIEW');
  await expect(page.locator('#study-result-preview')).toBeHidden();
  await expect(page.locator('#study-result-apply')).toBeDisabled();
});

test('new file and kind switch invalidate earlier asynchronous reads', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    const scope = window as unknown as { releaseOldCsvFile: () => void; oldCsvFinished: boolean };
    const gate = new Promise<void>(resolve => { scope.releaseOldCsvFile = resolve; });
    scope.oldCsvFinished = false;
    File.prototype.arrayBuffer = async function () { const bytes = await original.call(this); if (this.name === 'old-slow.json') { await gate; scope.oldCsvFinished = true; } return bytes; };
  });
  await page.goto(PATH); await select(page, result('OLD FILE'), 'old-slow.json');
  await select(page, result('NEW FILE'), 'new-result.json'); await ready(page);
  await page.evaluate(() => (window as unknown as { releaseOldCsvFile: () => void }).releaseOldCsvFile());
  await expect.poll(() => page.evaluate(() => (window as unknown as { oldCsvFinished: boolean }).oldCsvFinished)).toBe(true);
  await expect(page.locator('#study-result-metadata')).toContainText('new-result.json');
  await expect(page.locator('#study-result-stdout')).toHaveText('NEW FILE');
  await page.locator('[data-kind="source"]').click();
  await expect(page.locator('#study-result-preview')).toBeHidden();
  await expect(page.locator('#study-result-apply')).toBeDisabled();
  await expect(page.locator('#study-kind-label')).toHaveText('新建资料卡');
});

test('late initial saved-record response cannot overwrite an explicitly applied import', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: account } }));
  await page.route('**/api/study/items?*', route => route.fulfill({ json: { ok: true, items: [] } }));
  let started = false, completed = false, release: () => void = () => {};
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/study/items/${existingId}`, async route => {
    started = true; await waiting;
    await route.fulfill({ json: { ok: true, item: { id: existingId, revision: 4, kind: 'record', title: 'OLD ACCOUNT RECORD', fields: {}, sourceIds: [], noteIds: [], learningStatus: 'independent', reviewStatus: 'reviewed', visibility: 'private' } } }); completed = true;
  });
  await page.goto(`/learning/records/?id=${existingId}&project=csv-checker`);
  await expect.poll(() => started).toBe(true);
  await select(page); await ready(page); await page.locator('#study-result-apply').click();
  release(); await expect.poll(() => completed).toBe(true);
  await expect(page.locator('#study-title')).toHaveValue(/CSV 结果归档/);
  const backup = await exported(page); expect(backup.item.id).toBeUndefined();
  expect(backup.item.fields.csvResultOriginal).toBe(result());
  expect(page.url()).not.toContain(`id=${existingId}`);
});

test('invalid or oversized files never replace current input; account changes prevent an import from being saved to another owner', async ({ page }) => {
  let owner = account.userId;
  const writes: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: { userId: owner } } }));
  await page.route('**/api/study/items?*', route => route.fulfill({ json: { ok: true, items: [] } }));
  await page.goto(PATH); await expect(page.locator('#study-auth')).toContainText('账户已连接');
  await page.locator('#study-title').fill('CURRENT UNSAVED');
  await select(page, '{invalid json');
  await expect(page.locator('#study-result-status')).toContainText('保持不变');
  await expect(page.locator('#study-title')).toHaveValue('CURRENT UNSAVED');
  await select(page, 'x'.repeat(30 * 1024 + 1));
  await expect(page.locator('#study-result-status')).toContainText('不超过 30 KiB');
  await select(page); await ready(page);
  page.once('dialog', dialog => dialog.accept()); await page.locator('#study-result-apply').click();
  owner = 'another-owner';
  await page.locator('#study-save').click();
  await expect(page.locator('#study-message')).toContainText('账户已改变');
  await expect(page.locator('#study-title')).toHaveValue(/CSV 结果归档/);
  expect(writes).toEqual([]);
});

test('mobile dark preview works when browser storage is disabled and preserves long untrusted filenames as text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => { Object.defineProperty(Storage.prototype, 'getItem', { value: () => { throw new Error('storage unavailable'); } }); Object.defineProperty(Storage.prototype, 'setItem', { value: () => { throw new Error('storage unavailable'); } }); });
  await page.goto(PATH);
  const name = `${'原始实验结果_'.repeat(20)}.json`;
  await select(page, result(), name); await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#study-result-metadata')).toContainText(name);
  for (const summary of await page.locator('#study-result-preview summary').all()) await summary.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#study-result-apply').click();
  await expect(page.locator('#study-save-state')).toContainText('未保存');
  expect((await exported(page)).item.fields.csvResultOriginal).toBe(result());
});

test('explicit save includes the expected owner and a server rejection preserves the complete unsaved draft', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: account } }));
  await page.route('**/api/study/items?*', route => route.fulfill({ json: { ok: true, items: [] } }));
  let posted: { expectedOwner?: string; item?: { id?: string; fields?: Record<string, string> } } | null = null;
  await page.route('**/api/study/items', route => {
    posted = route.request().postDataJSON();
    return route.fulfill({ status: 403, json: { ok: false, error: '账户已改变；服务器没有保存当前草稿。' } });
  });
  await page.goto(PATH); await expect(page.locator('#study-auth')).toContainText('账户已连接');
  const original = result(); await select(page, original); await ready(page); await page.locator('#study-result-apply').click();
  expect(posted).toBeNull();
  await page.locator('#study-save').click(); await expect(page.locator('#study-message')).toContainText('服务器没有保存');
  expect(posted).toMatchObject({ expectedOwner: account.userId, item: { fields: { csvResultOriginal: original } } });
  expect((posted as unknown as { item: { id?: string } }).item.id).toBeUndefined();
  const backup = await exported(page);
  expect(backup.item.fields.csvResultOriginal).toBe(original);
  expect(backup.item.id).toBeUndefined();
  expect(backup.item).toMatchObject({ learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private' });
});
