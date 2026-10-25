import { expect, test, type Download, type Page } from '@playwright/test';
import { blankFailureReview } from '../../src/lib/failure-review';

const PAGE = '/failures/review/';
const ORIGINAL = 'PRIVATE EXISTING REVIEW INPUT';
const fixture = (title = 'Synthetic imported review') => ({ ...blankFailureReview(), title, symptom: 'Synthetic observation; no real run is claimed.', executor: '用户本机' as const, reproduction: '已运行待核对' as const });
const file = (name: string, text: string) => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
async function downloadText(download: Download) {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
async function exportReview(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#failure-export-json').click();
  return JSON.parse(await downloadText(await pending));
}
async function preview(page: Page, name: string, text: string) {
  await page.locator('#failure-import-file').setInputFiles(file(name, text));
  await expect(page.locator('#failure-import-apply')).toBeEnabled();
}

test.beforeEach(async ({ context, baseURL, page }) => {
  const url = baseURL ? new URL(baseURL) : null;
  test.skip(!url || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Private import acceptance stays on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort()); await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  page.on('dialog', dialog => dialog.accept());
});

test('preview never edits the form; own blank-title backup restores exactly and origin stays ephemeral', async ({ page }) => {
  await page.goto(PAGE); await expect(page.locator('#failure-auth')).toContainText('匿名编辑');
  const review = fixture(''); const text = JSON.stringify({ failureReview: review });
  await page.locator('#failure-form [name="title"]').fill(ORIGINAL);
  await preview(page, 'blank-title.json', text);
  await expect(page.locator('#failure-form [name="title"]')).toHaveValue(ORIGINAL);
  await expect(page.locator('#failure-import-preview')).toContainText('解除原账户记录的关联');
  await expect(page.locator('[data-failure-preview-field="executor"]')).toHaveText('用户本机');
  await page.locator('#failure-import-cancel').click();
  await expect(page.locator('#failure-import-preview')).toBeHidden(); await expect(page.locator('#failure-form [name="title"]')).toHaveValue(ORIGINAL);
  await preview(page, 'blank-title.json', text); await page.locator('#failure-import-apply').click();
  await expect(page.locator('#failure-form [name="title"]')).toHaveValue('');
  await expect(page.locator('#failure-import-source')).toContainText('仅本页展示');
  expect(await exportReview(page)).toEqual({ failureReview: review });
  await expect(page.locator('#failure-form [name="executor"]')).toHaveValue('用户本机');
  await expect(page.locator('#failure-form [name="reproduction"]')).toHaveValue('已运行待核对');
  await page.reload(); await expect(page.locator('#failure-import-source')).toBeHidden();
});

test('a valid direct backup may be restored even when duplicating it into an account request would exceed its cap', async ({ page }) => {
  await page.goto(PAGE);
  const review = { ...fixture('Large but valid direct backup'), model: '工'.repeat(3000), symptom: '工'.repeat(4000), hypothesis: '工'.repeat(4000), attempts: '工'.repeat(6000), actual: '工'.repeat(6000), evidence: '工'.repeat(4000) };
  const text = JSON.stringify({ failureReview: review }); expect(Buffer.byteLength(text)).toBeLessThan(128 * 1024);
  await preview(page, 'large-valid-review.json', text); await page.locator('#failure-import-apply').click();
  expect(await exportReview(page)).toEqual({ failureReview: review });
});

test('direct backup roundtrip preserves literal CRLF and lone CR until each specific field is edited', async ({ page }) => {
  await page.goto(PAGE);
  const review = { ...fixture('Synthetic title\r\nsecond line\rlast line'), software: 'Tool\r\nsecond\rlast', version: 'Version\r\nsecond\rlast', symptom: 'Observation\r\nnext\rlast', actual: 'Log line 1\r\nLog line 2\rLog line 3' };
  await preview(page, 'literal-line-endings.json', JSON.stringify({ failureReview: review }));
  await page.locator('#failure-import-apply').click();
  await expect(page.locator('#failure-form [name="title"]')).toHaveValue('Synthetic titlesecond linelast line');
  // A deferred blur change with unchanged controls is not a second edit and
  // must not discard literals that the browser normalized only for display.
  await page.locator('#failure-form [name="actual"]').dispatchEvent('change');
  expect(await exportReview(page)).toEqual({ failureReview: review });
  await page.locator('#failure-form [name="software"]').fill('Explicitly edited tool');
  expect(await exportReview(page)).toEqual({ failureReview: { ...review, software: 'Explicitly edited tool' } });
  await page.locator('#failure-form [name="actual"]').fill('Explicit new log\nwith LF');
  expect(await exportReview(page)).toEqual({ failureReview: { ...review, software: 'Explicitly edited tool', actual: 'Explicit new log\nwith LF' } });
  await expect(page.locator('#failure-import-source')).toContainText('其余字段仍保留原格式');
});

test('malformed, oversized and unknown-diagnostic imports retain all current input without dropping associations', async ({ page }) => {
  await page.goto(PAGE); await page.locator('#failure-form [name="title"]').fill(ORIGINAL);
  for (const [name, text] of [['broken.json', '{bad'], ['too-large.json', ' '.repeat(2 * 1024 * 1024 + 1)], ['unknown-diagnostic.json', JSON.stringify({ failureReview: { ...fixture(), diagnosticId: 'not-in-public-catalog' } })]]) {
    await page.locator('#failure-import-file').setInputFiles(file(name, text));
    await expect(page.locator('#failure-import-status')).toContainText(/保持不变|停止起稿/);
    await expect(page.locator('#failure-import-apply')).toBeDisabled();
    await expect(page.locator('#failure-form [name="title"]')).toHaveValue(ORIGINAL);
    await expect(page.locator('#failure-form [name="diagnosticId"]')).toHaveValue('');
  }
});

test('a first-study backup requires an explicit experiment and copies observations with unrun defaults', async ({ page }) => {
  await page.goto('/learning/start/');
  await page.locator('#first-prediction').fill('Synthetic prediction, not a real trial.');
  await page.locator('#first-pythonObservation').fill('Synthetic Python observation: <script>not executable</script>');
  await page.locator('#first-assemblyObservation').fill('Synthetic assembly observation only.');
  const pending = page.waitForEvent('download'); await page.locator('#first-study-export-json').click(); const backup = await downloadText(await pending);
  await page.goto(PAGE); await page.locator('#failure-form [name="title"]').fill(ORIGINAL);
  await page.locator('#failure-import-file').setInputFiles(file('first-study.json', backup));
  await expect(page.locator('#failure-import-kind')).toBeEnabled(); await expect(page.locator('#failure-import-apply')).toBeDisabled();
  await page.locator('#failure-import-kind').selectOption('python'); await expect(page.locator('#failure-import-apply')).toBeEnabled();
  await expect(page.locator('#failure-import-preview')).toContainText('Synthetic Python observation: <script>not executable</script>');
  await expect(page.locator('#failure-import-preview script')).toHaveCount(0);
  await expect(page.locator('#failure-form [name="title"]')).toHaveValue(ORIGINAL);
  await page.locator('#failure-import-apply').click();
  const result = await exportReview(page);
  expect(result.failureReview.executor).toBe('未运行'); expect(result.failureReview.reproduction).toBe('未运行');
  for (const field of ['date', 'hypothesis', 'change', 'retest', 'next', 'diagnosticId']) expect(result.failureReview[field]).toBe('');
  expect(JSON.stringify(result)).toContain('Synthetic Python observation'); expect(JSON.stringify(result)).not.toContain('Synthetic assembly observation');
});

test('late file reads and stale previews cannot overwrite newer editor input', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    const controls = window as unknown as { releaseFailureFile?: () => void; pendingFailureFiles: number; failureHashes: number };
    controls.pendingFailureFiles = 0; controls.failureHashes = 0;
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (...args: Parameters<typeof digest>) => { const value = await digest(...args); controls.failureHashes++; return value; };
    File.prototype.arrayBuffer = async function () {
      if (!this.name.startsWith('slow-')) return original.call(this);
      const bytes = await original.call(this); await new Promise<void>(resolve => { controls.pendingFailureFiles++; controls.releaseFailureFile = resolve; }); return bytes;
    };
  });
  await page.goto(PAGE);
  const text = JSON.stringify({ failureReview: fixture() });
  await page.locator('#failure-import-file').setInputFiles(file('slow-review.json', text));
  await expect.poll(() => page.evaluate(() => (window as unknown as { pendingFailureFiles: number }).pendingFailureFiles)).toBe(1);
  await page.locator('#failure-form [name="title"]').fill(ORIGINAL);
  await page.evaluate(() => (window as unknown as { releaseFailureFile: () => void }).releaseFailureFile());
  await expect.poll(() => page.evaluate(() => (window as unknown as { failureHashes: number }).failureHashes)).toBe(1);
  await expect(page.locator('#failure-import-preview')).toBeHidden(); await expect(page.locator('#failure-import-apply')).toBeDisabled();
  await expect(page.locator('#failure-form [name="title"]')).toHaveValue(ORIGINAL);
  await preview(page, 'review.json', text);
  await page.locator('#failure-form [name="symptom"]').fill('New edit after preview');
  await expect(page.locator('#failure-import-preview')).toBeHidden(); await expect(page.locator('#failure-import-apply')).toBeDisabled();
  await preview(page, 'changed-programmatically.json', text);
  await page.locator('#failure-form [name="title"]').evaluate(node => { (node as HTMLInputElement).value = 'Changed DOM value'; node.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(page.locator('#failure-import-preview')).toBeHidden(); await expect(page.locator('#failure-import-apply')).toBeDisabled();
});

test('an initial account response cannot reopen a URL record after local import; saving uses POST for a new private draft', async ({ page }) => {
  const oldId = 'record-11111111-1111-4111-8111-111111111111'; const newId = 'record-22222222-2222-4222-8222-222222222222';
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', async route => { await gate; await route.fulfill({ json: { ok: true, user: { userId: 'local-import-fixture' } } }); });
  await page.route('**/api/study/items?kind=record', route => route.fulfill({ json: { ok: true, items: [], cursor: '' } }));
  await page.route('**/api/auth/csrf-token', route => route.fulfill({ json: { ok: true, token: 'local-import-test' } }));
  let oldReads = 0; const saved: Record<string, any>[] = [];
  await page.route(`**/api/study/items/${oldId}`, async route => { oldReads++; await route.fulfill({ status: 500, json: { ok: false, error: 'No old record should be opened.' } }); });
  await page.route('**/api/study/items', async route => {
    expect(route.request().method()).toBe('POST'); const body = route.request().postDataJSON(); saved.push(body);
    await route.fulfill({ json: { ok: true, item: { ...body.item, id: newId, revision: 1, createdAt: '2026-10-25T00:00:00.000Z', updatedAt: '2026-10-25T00:00:00.000Z' } } });
  });
  await page.goto(`${PAGE}?id=${oldId}`);
  const review = { ...fixture('Import remains after delayed account load'), software: 'Tool\r\noriginal\rformat', actual: 'Original log\r\nnext line\rlast line' };
  await preview(page, 'private-review.json', JSON.stringify({ failureReview: review })); await page.locator('#failure-import-apply').click();
  expect(new URL(page.url()).search).toBe(''); release();
  await expect(page.locator('#failure-auth')).toContainText('账户已连接');
  await expect(page.locator('#failure-form [name="title"]')).toHaveValue(review.title); expect(oldReads).toBe(0);
  await page.locator('#failure-save').click(); await expect(page.locator('#failure-status')).toContainText('已保存到当前账户');
  expect(saved).toHaveLength(1); expect(saved[0].item).toMatchObject({ title: review.title, learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private' });
  expect(saved[0].item.id).toBeUndefined(); expect(saved[0].revision).toBeUndefined();
  expect(JSON.stringify(saved[0])).not.toContain('private-review.json'); expect(oldReads).toBe(0);
  expect(await exportReview(page)).toEqual({ failureReview: review });
});
