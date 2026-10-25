import { expect, test, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const GUIDE = '/learning/start/';
const marker = 'PRIVATE LOCAL STUDY NOTE';
const code = readFileSync('public/downloads/python-lab/axial_bar.py', 'utf8');
const input = readFileSync('public/downloads/python-lab/bar-input.json', 'utf8');
// A deliberately unverified JSON fixture; this test never claims it was executed.
const pythonFixture = JSON.stringify({ schemaVersion: 1, executor: '用户当前浏览器 WebWorker', state: 'succeeded', code, input,
  stdout: 'FIXTURE ONLY: not evidence of an executed program', stderr: '', value: '', environment: 'CPython 3.14.2 · Pyodide 314.0.7 · WebAssembly / WebWorker',
  startedAt: '2026-10-24T01:00:00.000Z', finishedAt: '2026-10-24T01:00:01.000Z', elapsedMs: 1000,
  limitation: '仅记录本次浏览器 Python 执行；不证明用户本机复现、CAE 求解或工程验证完成。代码与输入未由本站自动保存或上传。' });

async function downloadedText(download: Download) {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
async function exported(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#first-study-export-json').click();
  return JSON.parse(await downloadedText(await pending));
}
const file = (name: string, text: string) => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
async function attachPython(page: Page) {
  await page.locator('#study-evidence-file').setInputFiles(file('python-result.json', pythonFixture));
  await expect(page.locator('#study-evidence-apply')).toBeEnabled();
  await page.locator('#study-evidence-apply').click();
  await expect(page.locator('[data-study-evidence="python"]')).toHaveCount(1);
}

test.beforeEach(async ({ context, baseURL }) => {
  const url = baseURL ? new URL(baseURL) : null;
  test.skip(!url || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Study import acceptance runs only on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
});

test('a backup is previewed before explicit restoration and preserves historical self-report times', async ({ page }) => {
  await page.goto(GUIDE);
  await page.locator('#first-study-start').click();
  await page.locator('#first-prediction').fill(`${marker} source`);
  await page.locator('#first-check-predict').check();
  await page.locator('#first-environment').fill('Self-report: not run.');
  const original = await exported(page); const text = JSON.stringify(original);
  await page.locator('#first-prediction').fill(`${marker} current`);
  await page.locator('#study-backup-file').setInputFiles(file('last-study.json', text));
  await expect(page.locator('#study-backup-apply')).toBeEnabled();
  await expect(page.locator('#study-backup-preview')).toContainText(`${marker} source`);
  await expect(page.locator('#study-backup-preview')).toContainText('当前页面已有记录');
  await expect(page.locator('#first-prediction')).toHaveValue(`${marker} current`);
  await expect(page.locator('#first-check-predict')).not.toBeChecked();
  await page.locator('#study-backup-apply').click();
  await expect(page.locator('#first-prediction')).toHaveValue(`${marker} source`);
  await expect(page.locator('#first-check-predict')).toBeChecked();
  const restored = await exported(page);
  expect(restored.startedAt).toBe(original.startedAt); expect(restored.declarations).toEqual(original.declarations);
  expect(restored.restoredFrom).toMatchObject({ fileName: 'last-study.json', sha256: createHash('sha256').update(text).digest('hex'), sizeBytes: Buffer.byteLength(text), sourceSchemaVersion: 2 });
  expect(Date.parse(restored.restoredFrom.importedAt)).toBeGreaterThanOrEqual(Date.parse(original.recordedAt));
  expect(restored.learningCompletion).toBe('not-assessed'); expect(restored.executionEvidence.status).toBe('not-verified-by-guide');
  await expect(page.locator('#study-restored-source')).toContainText('历史自述时间');
});

test('invalid backups leave current text, times and attached result files intact', async ({ page }) => {
  await page.goto(GUIDE); await page.locator('#first-study-start').click();
  await page.locator('#first-prediction').fill(marker); await attachPython(page);
  const before = await exported(page);
  for (const [name, text] of [['broken.json', '{bad'], ['large.json', ' '.repeat(2 * 1024 * 1024 + 1)], ['wrong-version.json', JSON.stringify({ ...before, guideVersion: 'unknown-guide' })]]) {
    await page.locator('#study-backup-file').setInputFiles(file(name, text));
    await expect(page.locator('#study-backup-status')).toContainText('当前草稿保持不变');
    await expect(page.locator('#study-backup-apply')).toBeDisabled();
    await expect(page.locator('#study-backup-preview')).toBeHidden();
    const after = await exported(page);
    expect(after.fields).toEqual(before.fields); expect(after.startedAt).toBe(before.startedAt); expect(after.declarations).toEqual(before.declarations); expect(after.evidence).toEqual(before.evidence);
  }
});

test('result attachment is explicit, never fills answers, rejects duplicates, and revokes only related self-reports', async ({ page }) => {
  await page.goto(GUIDE); await page.locator('#first-study-start').click();
  for (const [field, step] of [['prediction', 'predict'], ['pythonObservation', 'python'], ['assemblyObservation', 'assembly'], ['evidenceObservation', 'evidence']]) {
    await page.locator(`#first-${field}`).fill(`${marker} ${field}`); await page.locator(`#first-check-${step}`).check();
  }
  await page.locator('#first-environment').fill('My unverified environment');
  await page.locator('#first-study-finish').click();
  const before = await exported(page);
  await page.locator('#study-evidence-file').setInputFiles(file('python-result.json', pythonFixture));
  await expect(page.locator('#study-evidence-apply')).toBeEnabled();
  await expect(page.locator('#study-evidence-preview')).toContainText('未经证实');
  await expect(page.locator('#study-evidence-preview')).toContainText('与本次固定教学输入一致');
  await expect(page.locator('[data-study-evidence]')).toHaveCount(0);
  expect((await exported(page)).finishedAt).toBe(before.finishedAt);
  await page.locator('#study-evidence-apply').click();
  await expect(page.locator('#first-check-python')).not.toBeChecked(); await expect(page.locator('#first-check-evidence')).not.toBeChecked();
  await expect(page.locator('#first-check-predict')).toBeChecked(); await expect(page.locator('#first-check-assembly')).toBeChecked();
  const attached = await exported(page);
  expect(attached.fields).toEqual(before.fields); expect(attached.finishedAt).toBeNull();
  expect(attached.evidence[0]).toMatchObject({ kind: 'python', originalText: pythonFixture, trust: 'unverified-imported-file', modelMatch: 'matches-guide-input', sha256: createHash('sha256').update(pythonFixture).digest('hex') });
  expect(attached.learningCompletion).toBe('not-assessed');
  await page.locator('#study-evidence-file').setInputFiles(file('renamed-result.json', pythonFixture));
  await expect(page.locator('#study-evidence-apply')).toBeEnabled(); await page.locator('#study-evidence-apply').click();
  await expect(page.locator('#study-evidence-status')).toContainText('已经附'); await expect(page.locator('[data-study-evidence]')).toHaveCount(1);
  await page.locator('[data-remove-evidence="python"]').click();
  await expect(page.locator('[data-study-evidence]')).toHaveCount(0); expect((await exported(page)).fields).toEqual(before.fields);
});

test('new selection and cancellation discard stale previews, while different inputs remain clearly labeled', async ({ page }) => {
  await page.goto(GUIDE); await page.locator('#first-prediction').fill(marker);
  await page.locator('#study-evidence-file').setInputFiles(file('valid.json', pythonFixture));
  await expect(page.locator('#study-evidence-apply')).toBeEnabled();
  await page.locator('#study-evidence-file').setInputFiles(file('broken.json', '{}'));
  await expect(page.locator('#study-evidence-status')).toContainText('当前记录保持不变');
  await expect(page.locator('#study-evidence-apply')).toBeDisabled(); await expect(page.locator('#study-evidence-preview')).toBeHidden();
  const altered = JSON.parse(pythonFixture); const changedInput = JSON.parse(altered.input); changedInput.P.value = 20000; altered.input = JSON.stringify(changedInput);
  await page.locator('#study-evidence-file').setInputFiles(file('different-input.json', JSON.stringify(altered)));
  await expect(page.locator('#study-evidence-apply')).toBeEnabled(); await expect(page.locator('#study-evidence-preview')).toContainText('与本次固定教学输入不同');
  await page.locator('#study-evidence-cancel').click();
  await expect(page.locator('#study-evidence-apply')).toBeDisabled(); await expect(page.locator('#study-evidence-preview')).toBeHidden();
  await expect(page.locator('#first-prediction')).toHaveValue(marker); await expect(page.locator('[data-study-evidence]')).toHaveCount(0);
  const backup = await exported(page);
  await page.locator('#study-backup-file').setInputFiles(file('preview.json', JSON.stringify(backup)));
  await expect(page.locator('#study-backup-apply')).toBeEnabled();
  await page.locator('#first-prediction').fill(`${marker} changed after preview`);
  await expect(page.locator('#study-backup-apply')).toBeDisabled(); await expect(page.locator('#study-backup-preview')).toBeHidden();
});

test('late local file reads cannot reattach cleared evidence or replace a changed draft', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    const controls = window as unknown as { pendingStudyFiles: number; completedStudyHashes: number; releaseStudyFile?: () => void };
    controls.pendingStudyFiles = 0; controls.completedStudyHashes = 0;
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (...args: Parameters<typeof digest>) => {
      const result = await digest(...args); controls.completedStudyHashes++; return result;
    };
    File.prototype.arrayBuffer = async function () {
      if (!this.name.startsWith('slow-')) return original.call(this);
      const bytes = await original.call(this);
      await new Promise<void>(resolve => { controls.pendingStudyFiles++; controls.releaseStudyFile = resolve; });
      return bytes;
    };
  });
  await page.goto(GUIDE); await page.locator('#first-prediction').fill(marker);
  const backup = await exported(page);
  await page.locator('#study-evidence-file').setInputFiles(file('slow-result.json', pythonFixture));
  await expect.poll(() => page.evaluate(() => (window as unknown as { pendingStudyFiles: number }).pendingStudyFiles)).toBe(1);
  await page.locator('#first-study-clear').click();
  await page.evaluate(() => (window as unknown as { releaseStudyFile: () => void }).releaseStudyFile());
  await expect.poll(() => page.evaluate(() => (window as unknown as { completedStudyHashes: number }).completedStudyHashes)).toBe(1);
  await expect(page.locator('#study-evidence-status')).toContainText('已清空');
  await expect(page.locator('#study-evidence-apply')).toBeDisabled(); await expect(page.locator('#study-evidence-preview')).toBeHidden();
  await page.locator('#first-prediction').fill(`${marker} fresh draft`);
  await page.locator('#study-backup-file').setInputFiles(file('slow-backup.json', JSON.stringify(backup)));
  await expect.poll(() => page.evaluate(() => (window as unknown as { pendingStudyFiles: number }).pendingStudyFiles)).toBe(2);
  await page.locator('#first-prediction').fill(`${marker} edited during read`);
  await page.evaluate(() => (window as unknown as { releaseStudyFile: () => void }).releaseStudyFile());
  await expect.poll(() => page.evaluate(() => (window as unknown as { completedStudyHashes: number }).completedStudyHashes)).toBe(2);
  await expect(page.locator('#study-backup-apply')).toBeDisabled(); await expect(page.locator('#study-backup-preview')).toBeHidden();
  await expect(page.locator('#first-prediction')).toHaveValue(`${marker} edited during read`);
  await expect(page.locator('[data-study-evidence]')).toHaveCount(0);
});

test('mobile dark mode imports and exports privately with denied storage and no extra API or runtime calls', async ({ page }) => {
  const mutations: string[] = []; const runtime: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(path);
    if (path.startsWith('/vendor/pyodide/')) runtime.push(path);
  });
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Denied', 'SecurityError'); }; Storage.prototype.getItem = () => { throw new DOMException('Denied', 'SecurityError'); }; });
  await page.goto(GUIDE); await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.locator('#first-prediction').fill(marker); await attachPython(page);
  const backup = await exported(page);
  await page.locator('#first-study-clear').click();
  await page.locator('#study-backup-file').setInputFiles(file('private-study.json', JSON.stringify(backup)));
  await expect(page.locator('#study-backup-apply')).toBeEnabled(); await page.locator('#study-backup-apply').click();
  await expect(page.locator('#first-prediction')).toHaveValue(marker);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(mutations).toEqual([]); expect(runtime).toEqual([]);
  const pending = page.waitForEvent('download'); await page.locator('#first-study-export-md').click(); const text = await downloadedText(await pending);
  expect(text).toContain('SHA-256'); expect(text).not.toContain(code); expect(text).not.toContain(pythonFixture);
});
