import { expect, test, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const PATH = '/learning/records/#study-backup-import';
const sourceId = 'source-11111111-1111-4111-8111-111111111111';
const noteId = 'note-22222222-2222-4222-8222-222222222222';
const missingId = 'note-33333333-3333-4333-8333-333333333333';
const recordId = 'record-44444444-4444-4444-8444-444444444444';
type Kind = 'record' | 'source' | 'note';
function item(kind: Kind = 'record', title = '  ORIGINAL TITLE  ', fields: Record<string, string> = { body: '<script>PRIVATE_BACKUP</script>\r\n原始正文\r孤立换行', executor: '', reproduction: '', recordType: '', custom: 'EXTRA FIELD', toString: '<img src=x>UNKNOWN KEY' }) {
  return { kind, title, fields, sourceIds: [] as string[], noteIds: [] as string[], learningStatus: 'independent', reviewStatus: 'reviewed', visibility: 'public' };
}
function saved(kind: Kind, id: string, title: string, fields: Record<string, string>) {
  return { ...item(kind, title, fields), id, revision: 3, createdAt: '2026-10-24T01:00:00.000Z', updatedAt: '2026-10-25T01:00:00.000Z' };
}
function backup(main = item(), references: ReturnType<typeof saved>[] = []) { return JSON.stringify({ format: 'simulearn-study-v1', item: main, references }); }
async function select(page: Page, text = backup(), name = 'synthetic-study-backup.json') { await page.locator('#study-backup-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) }); }
async function ready(page: Page) { await expect(page.locator('#study-backup-apply')).toBeEnabled(); }
async function textOf(download: Download) { const stream = await download.createReadStream(); expect(stream).not.toBeNull(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks).toString('utf8'); }
async function exported(page: Page) { const pending = page.waitForEvent('download'); await page.locator('#study-export-json').click(); return JSON.parse(await textOf(await pending)); }
async function markdown(page: Page) { const pending = page.waitForEvent('download'); await page.locator('#study-export').click(); return textOf(await pending); }
const archiveOf = (value: { item: { fields: Record<string, string> } }) => JSON.parse(value.item.fields.studyBackupArchive);

test.beforeEach(async ({ page, baseURL }) => {
  const target = baseURL ? new URL(baseURL) : null;
  test.skip(!target || target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Private backup fixtures run only on a local Worker.');
  await page.route('https://fonts.googleapis.com/**', route => route.abort()); await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  await page.route('**/api/auth/csrf-token', route => route.fulfill({ json: { ok: true, token: 'synthetic-backup-local-only' } }));
});

test('preview is inert, dirty rejection preserves the editor, and explicit application preserves raw fields without old identities or states', async ({ page }) => {
  const writes: string[] = [], runtime: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); if (request.url().includes('/vendor/pyodide/')) runtime.push(request.url()); });
  await page.goto(PATH); await page.locator('#study-title').fill('CURRENT PRIVATE DRAFT');
  const main = item(); await select(page, backup(main)); await ready(page);
  await page.locator('#study-title').blur(); await ready(page);
  await expect(page.locator('#study-title')).toHaveValue('CURRENT PRIVATE DRAFT');
  await expect(page.locator('#study-backup-metadata')).toContainText('independent');
  await expect(page.locator('#study-backup-summary')).toContainText('条目类型：学习记录');
  await expect(page.locator('#study-backup-summary')).toContainText('仅文件声明');
  await expect(page.locator('#study-backup-recovery-target')).toContainText('未开始 / 草稿 / 私人');
  await expect(page.locator('#study-backup-preview details').first()).toHaveJSProperty('open', false);
  await expect(page.locator('#study-backup-preview script, #study-backup-preview img')).toHaveCount(0);
  page.once('dialog', dialog => dialog.dismiss()); await page.locator('#study-backup-apply').click();
  await expect(page.locator('#study-title')).toHaveValue('CURRENT PRIVATE DRAFT');
  await expect(page.locator('#study-backup-status')).toContainText('已取消替换');
  page.once('dialog', dialog => dialog.accept()); await page.locator('#study-backup-apply').click();
  const out = await exported(page);
  expect(out.item).toMatchObject({ title: main.title, kind: 'record', learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private', sourceIds: [], noteIds: [] });
  expect(out.item.id).toBeUndefined(); expect(out.item.revision).toBeUndefined();
  const { studyBackupArchive, ...restoredFields } = out.item.fields;
  expect(restoredFields).toEqual(main.fields);
  expect(JSON.parse(studyBackupArchive).imports[0].declaredItem.learningStatus).toBe('independent');
  await expect(page.locator('[name="field:executor"]')).toHaveValue('');
  await expect(page.locator('[name="field:reproduction"]')).toHaveValue('');
  await expect(page.locator('#study-save-state')).toContainText('未保存');
  const md = await markdown(page); expect(md).toContain('    <script>PRIVATE_BACKUP</script>\n    原始正文\n    孤立换行');
  expect(md).toContain('    字段名：toString'); expect(md).toContain('    <img src=x>UNKNOWN KEY'); expect(md).not.toContain('function toString');
  expect(md).not.toContain('\n<script>PRIVATE_BACKUP</script>');
  await page.locator('#study-body').fill('## 我的新整理\n\n待核对。');
  expect(await markdown(page)).toContain('## 整理稿\n\n## 我的新整理');
  await page.locator('#study-save').click(); await expect(page.locator('#study-message')).toContainText('请先登录');
  expect(writes).toEqual([]); expect(runtime).toEqual([]);
});

test('record, source and note backups accept empty titles, absent fields and CRLF without inventing empty keys', async ({ page }) => {
  await page.goto(PATH);
  const examples = [item('record', '', {}), item('source', '  原资料卡  ', { url: 'https://example.invalid/\r\n保留范围', body: '', publicBody: '<img src=x>旧公开稿' }), item('note', '', { project: '', conditions: '原始条件\r\n第二行\r第三行', body: '  正文  ' })];
  for (const [index, main] of examples.entries()) {
    await select(page, backup(main), `synthetic-${main.kind}.json`); await ready(page);
    if (index) page.once('dialog', dialog => dialog.accept());
    await page.locator('#study-backup-apply').click();
    const out = await exported(page); const { studyBackupArchive, ...fields } = out.item.fields;
    expect(out.item.title).toBe(main.title); expect(out.item.kind).toBe(main.kind); expect(fields).toEqual(main.fields);
    expect(out.item.sourceIds).toEqual([]); expect(out.item.noteIds).toEqual([]); expect(studyBackupArchive).toBeTruthy();
  }
});

test('reference snapshots remain unbound even when the current account has the same IDs, and round trips flatten the archive', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: { userId: 'local-backup-owner' } } }));
  const sources = [saved('source', sourceId, 'CURRENT ACCOUNT SOURCE', { body: 'CURRENT ACCOUNT CONTENT' })];
  await page.route('**/api/study/items?*', route => route.fulfill({ json: { ok: true, items: new URL(route.request().url()).searchParams.get('kind') === 'source' ? sources : [] } }));
  await page.goto(PATH); await expect(page.locator('#study-auth')).toContainText('账户已连接');
  const main = item(); main.sourceIds = [sourceId]; main.noteIds = [noteId, missingId];
  const references = [saved('source', sourceId, 'OLD SNAPSHOT SOURCE', { body: '<script>OLD_REFERENCE</script>' }), saved('note', noteId, 'OLD SNAPSHOT NOTE', { body: '原笔记快照' })];
  await select(page, backup(main, references)); await ready(page);
  await expect(page.locator('#study-backup-references')).toContainText('OLD SNAPSHOT SOURCE');
  await expect(page.locator('#study-backup-unresolved')).toContainText(missingId);
  await expect(page.locator('#study-backup-reference-titles')).toContainText('资料卡：OLD SNAPSHOT SOURCE');
  await expect(page.locator('#study-backup-reference-titles')).toContainText('知识笔记：OLD SNAPSHOT NOTE');
  await expect(page.locator('#study-backup-reference-counts')).toContainText('尚缺 1 个旧引用的原文');
  await expect(page.locator('#study-backup-reference-titles a')).toHaveCount(0);
  await page.locator('#study-backup-apply').click();
  await expect(page.locator('#study-backup-download-snapshots')).toBeEnabled();
  await expect(page.locator('[data-ref="source"]:checked')).toHaveCount(0);
  let out = await exported(page), archive = archiveOf(out);
  expect(out.references).toEqual([]); expect(archive.references).toHaveLength(2); expect(archive.unresolved).toEqual([{ kind: 'note', id: missingId }]);
  expect(archive.references[0].item.fields.body).toBe('<script>OLD_REFERENCE</script>');
  await page.locator('#study-backup-retained summary').click();
  const snapshots = page.waitForEvent('download'); await page.locator('#study-backup-download-snapshots').click();
  expect(JSON.parse(await textOf(await snapshots))).toEqual(archive);
  await select(page, JSON.stringify(out), 'second-export.json'); await ready(page);
  page.once('dialog', dialog => dialog.accept()); await page.locator('#study-backup-apply').click();
  out = await exported(page); archive = archiveOf(out);
  expect(archive.imports).toHaveLength(2); expect(archive.references).toHaveLength(2);
  expect(archive.references[0].item.fields.body).toBe('<script>OLD_REFERENCE</script>');
  expect(out.item.fields.body).toBe(main.fields.body); expect(out.item.sourceIds).toEqual([]); expect(out.references).toEqual([]);
});

test('backup and Python file selections cancel each other, and cancelled delayed reads cannot revive a preview', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer, scope = window as unknown as { releaseBackup: () => void; backupFinished: boolean };
    const gate = new Promise<void>(resolve => { scope.releaseBackup = resolve; }); scope.backupFinished = false;
    File.prototype.arrayBuffer = async function () { const bytes = await original.call(this); if (this.name === 'slow-backup.json') { await gate; scope.backupFinished = true; } return bytes; };
  });
  await page.goto(PATH); await select(page, backup(), 'slow-backup.json');
  await page.locator('#study-backup-cancel').click(); await page.evaluate(() => (window as unknown as { releaseBackup: () => void }).releaseBackup());
  await expect.poll(() => page.evaluate(() => (window as unknown as { backupFinished: boolean }).backupFinished)).toBe(true);
  await expect(page.locator('#study-backup-preview')).toBeHidden();
  await select(page, backup(), 'slow-backup.json'); await ready(page);
  const code = readFileSync('public/downloads/python-lab/csv_check.py', 'utf8');
  const python = JSON.stringify({ schemaVersion: 1, executor: '用户当前浏览器 WebWorker', state: 'succeeded', code, input: 'parameter,value,unit\n', stdout: 'SYNTHETIC ONLY', stderr: '', value: '', environment: 'CPython 3.14.2 · Pyodide 314.0.7 · WebAssembly / WebWorker', startedAt: '2026-10-25T01:00:00.000Z', finishedAt: '2026-10-25T01:00:01.000Z', elapsedMs: 1000, limitation: 'Synthetic UI fixture; no actual run.' });
  await page.locator('#study-result-file').setInputFiles({ name: 'synthetic-python.json', mimeType: 'application/json', buffer: Buffer.from(python) });
  await expect(page.locator('#study-result-apply')).toBeEnabled(); await expect(page.locator('#study-backup-preview')).toBeHidden();
  await select(page); await ready(page); await expect(page.locator('#study-result-preview')).toBeHidden();
  await page.locator('[data-kind="source"]').click(); await expect(page.locator('#study-backup-preview')).toBeHidden();
  await select(page); await ready(page); await page.locator('#study-title').fill('NEW EDIT');
  await expect(page.locator('#study-backup-preview')).toBeHidden();
});

test('late initial load cannot overwrite recovery and a rejected explicit save retains raw fields and expected owner', async ({ page }) => {
  const owner = 'local-backup-owner';
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: { userId: owner } } }));
  await page.route('**/api/study/items?*', route => route.fulfill({ json: { ok: true, items: [] } }));
  let started = false, completed = false, release: () => void = () => {}, posted: Record<string, unknown> | null = null;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/study/items/${recordId}`, async route => { started = true; await gate; await route.fulfill({ json: { ok: true, item: saved('record', recordId, 'LATE OLD RECORD', {}) } }); completed = true; });
  await page.route('**/api/study/items', route => { posted = route.request().postDataJSON(); return route.fulfill({ status: 403, json: { ok: false, error: '账户已变化，未保存。' } }); });
  await page.goto(`/learning/records/?id=${recordId}#study-backup-import`); await expect.poll(() => started).toBe(true);
  const main = item('source', 'RESTORED SOURCE', { body: '原资料\r\n保留换行', url: '' });
  await select(page, backup(main)); await ready(page); await page.locator('#study-backup-apply').click();
  release(); await expect.poll(() => completed).toBe(true);
  await expect(page.locator('#study-title')).toHaveValue('RESTORED SOURCE'); expect(page.url()).not.toContain(`id=${recordId}`);
  expect(posted).toBeNull(); await page.locator('#study-save').click(); await expect(page.locator('#study-message')).toContainText('账户已变化');
  expect(posted).toMatchObject({ expectedOwner: owner, item: { kind: 'source', fields: { body: main.fields.body }, sourceIds: [], noteIds: [] } });
  const out = await exported(page); expect(out.item.id).toBeUndefined(); expect(out.item.fields.body).toBe(main.fields.body); expect(archiveOf(out).imports).toHaveLength(1);
});

test('malformed, poisonous and oversized backups preserve current input', async ({ page }) => {
  await page.goto(PATH); await page.locator('#study-title').fill('KEEP THIS');
  for (const text of ['{bad', '{"format":"simulearn-study-v1","item":{"__proto__":{}},"references":[]}', 'x'.repeat(2 * 1024 * 1024 + 1)]) {
    await select(page, text); await expect(page.locator('#study-backup-status')).toHaveClass(/is-error/);
    await expect(page.locator('#study-backup-preview')).toBeHidden(); await expect(page.locator('#study-title')).toHaveValue('KEEP THIS');
  }
});

test('mobile dark recovery works with storage denied and displays dangerous archive content as text', async ({ page }) => {
  const writes: string[] = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => { Object.defineProperty(Storage.prototype, 'getItem', { value: () => { throw new Error('storage denied'); } }); Object.defineProperty(Storage.prototype, 'setItem', { value: () => { throw new Error('storage denied'); } }); });
  await page.goto(PATH); await select(page, backup(item('note', '<img src=x onerror=alert(1)>', { body: '<script>NO_EXECUTION</script>', conditions: '原条件' })), `${'备份来源_'.repeat(25)}.json`); await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(page.locator('#study-backup-preview img, #study-backup-preview script')).toHaveCount(0);
  await page.locator('#study-backup-apply').click(); await expect(page.locator('#study-backup-download-snapshots')).toBeEnabled();
  await page.locator('#study-backup-retained summary').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await exported(page)).item.fields.body).toBe('<script>NO_EXECUTION</script>'); expect(writes).toEqual([]);
});

test('a delayed Markdown export uses one content and filename snapshot without writing back to a new editor', async ({ page }) => {
  await page.addInitScript(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle), scope = window as unknown as { holdBackupDigest: boolean; releaseBackupDigest: () => void; backupDigestStarted: boolean };
    const gate = new Promise<void>(resolve => { scope.releaseBackupDigest = resolve; }); scope.holdBackupDigest = false; scope.backupDigestStarted = false;
    crypto.subtle.digest = async function (algorithm, data) { const result = await original(algorithm, data); if (scope.holdBackupDigest) { scope.backupDigestStarted = true; await gate; } return result; };
  });
  await page.goto(PATH); await select(page, backup(item('record', 'SNAPSHOT OLD TITLE', { body: 'OLD BODY' }))); await ready(page); await page.locator('#study-backup-apply').click();
  await expect(page.locator('#study-backup-download-snapshots')).toBeEnabled();
  await page.evaluate(() => { (window as unknown as { holdBackupDigest: boolean }).holdBackupDigest = true; });
  const pending = page.waitForEvent('download'); await page.locator('#study-export').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { backupDigestStarted: boolean }).backupDigestStarted)).toBe(true);
  await page.locator('#study-title').fill('NEW EDITOR TITLE'); await page.locator('#study-body').fill('NEW EDITOR BODY');
  await page.evaluate(() => { const scope = window as unknown as { holdBackupDigest: boolean; releaseBackupDigest: () => void }; scope.holdBackupDigest = false; scope.releaseBackupDigest(); });
  const file = await pending; expect(file.suggestedFilename()).toBe('SNAPSHOT OLD TITLE.md');
  const text = await textOf(file); expect(text).toContain('    OLD BODY'); expect(text).not.toContain('NEW EDITOR BODY');
  await expect(page.locator('#study-title')).toHaveValue('NEW EDITOR TITLE'); await expect(page.locator('#study-body')).toHaveValue('NEW EDITOR BODY');
  await expect(page.locator('#study-message')).not.toContainText('已导出所选内容');
});
