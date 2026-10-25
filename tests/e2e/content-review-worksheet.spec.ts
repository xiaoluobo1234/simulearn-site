import { expect, test, type Download, type Page } from '@playwright/test';

const PAGE = '/content-status/review/';
const PRIVATE = 'SYNTHETIC PRIVATE WORKSHEET TEXT';
const file = (name: string, value: unknown) => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });
async function downloadText(download: Download) {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
async function exportSheet(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#review-export-json').click();
  return JSON.parse(await downloadText(await pending));
}
async function preview(page: Page, value: unknown, name = 'synthetic-review.json') {
  await page.locator('#review-import-file').setInputFiles(file(name, value));
  await expect(page.locator('#review-import-apply')).toBeEnabled();
}

test.beforeEach(async ({ context, baseURL, page }) => {
  const url = baseURL ? new URL(baseURL) : null;
  test.skip(!url || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Private review tests stay on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  page.on('dialog', dialog => dialog.accept());
});

test('starts with an empty single item, supports partial export and restricts URL selection to one known item', async ({ page }) => {
  await page.goto(`${PAGE}?item=unknown&reviewer=URL-PRIVATE`);
  await expect(page.locator('#review-item')).toHaveValue('guide:first-study');
  for (const field of ['reviewer', 'reviewedAt', 'scope', 'notes']) await expect(page.locator(`[data-review-field="${field}"]`)).toHaveValue('');
  const blank = await exportSheet(page);
  expect(blank.review.conclusion).toBe('not-recorded'); expect(blank.review.checks.every((check: { decision: string; note: string }) => check.decision === 'not-reviewed' && check.note === '')).toBe(true);
  expect(blank.publication).toEqual({ state: 'pending-repository-review', approved: false });
  await page.locator('[data-review-field="notes"]').fill(PRIVATE);
  const partial = await exportSheet(page); expect(partial.review.notes).toBe(PRIVATE); expect(partial.review.reviewedAt).toBe('');
  await page.goto(`${PAGE}?item=lab:assembly`); await expect(page.locator('#review-item')).toHaveValue('lab:assembly');
  await page.goto(`${PAGE}?item=lab:assembly&item=lab:python`); await expect(page.locator('#review-item')).toHaveValue('guide:first-study');
});

test('records a conclusion only after explicit manual findings and resets it on a real edit', async ({ page }) => {
  await page.goto(PAGE);
  await page.locator('#review-conclusion').selectOption('acceptable'); await page.locator('#review-conclude').click();
  await expect(page.locator('#review-status')).toContainText('填写');
  await expect(page.locator('#review-conclusion-state')).toContainText('未登记');
  await page.locator('[data-review-field="reviewer"]').fill('Synthetic reviewer (not a real review)');
  await page.locator('[data-review-field="reviewedAt"]').fill('2026-10-25');
  await page.locator('[data-review-field="scope"]').fill('Synthetic test findings only.');
  for (const node of await page.locator('[data-review-check-field="decision"]').all()) await node.selectOption('pass');
  for (const node of await page.locator('[data-review-check-field="note"]').all()) await node.fill('Synthetic test evidence; no actual content review claimed.');
  await page.locator('#review-conclusion').selectOption('acceptable'); await page.locator('#review-conclude').click();
  expect((await exportSheet(page)).review.conclusion).toBe('acceptable');
  await page.locator('[data-review-field="scope"]').dispatchEvent('change');
  expect((await exportSheet(page)).review.conclusion).toBe('acceptable');
  await page.locator('[data-review-field="reviewedAt"]').fill('2026-02-30');
  await expect(page.locator('#review-conclusion-state')).toContainText('未登记');
  await page.locator('#review-export-json').click(); await expect(page.locator('#review-status')).toContainText('无效输入');
  await page.locator('[data-review-field="reviewedAt"]').fill('2026-10-25');
  await page.locator('#review-conclusion').selectOption('acceptable'); await page.locator('#review-conclude').click();
  await page.locator('[data-review-field="notes"]').fill('An explicit new finding.');
  await expect(page.locator('#review-conclusion-state')).toContainText('未登记');
  expect((await exportSheet(page)).review.conclusion).toBe('not-recorded');
});

test('previews safely, can cancel, restores raw multiline fields and preserves original reviewer/date', async ({ page }) => {
  await page.goto(PAGE); const original = await exportSheet(page);
  original.review.reviewer = '<script>window.reviewInjected=true</script>';
  original.review.reviewedAt = '2026-10-24'; original.review.scope = 'Synthetic scope\r\nSecond line\rThird line';
  original.review.notes = `${PRIVATE}\r\n<img src=x onerror=alert(1)>\rUnedited raw text`;
  await page.locator('[data-review-field="notes"]').fill('Current unsaved draft');
  await preview(page, original);
  await expect(page.locator('#review-import-preview')).toContainText('<script>window.reviewInjected=true</script>');
  await expect(page.locator('#review-import-preview script, #review-import-preview img, #review-import-preview a')).toHaveCount(0);
  await expect(page.locator('[data-review-field="notes"]')).toHaveValue('Current unsaved draft');
  await page.locator('#review-import-cancel').click(); await expect(page.locator('#review-import-preview')).toBeHidden();
  await preview(page, original); await page.locator('#review-import-apply').click();
  await expect(page.locator('[data-review-field="reviewedAt"]')).toHaveValue('2026-10-24');
  await page.locator('[data-review-field="scope"]').dispatchEvent('change');
  const restored = await exportSheet(page); expect(restored.review).toEqual(original.review);
  await page.locator('[data-review-field="reviewer"]').fill('Explicit edit only');
  const edited = await exportSheet(page); expect(edited.review.notes).toBe(original.review.notes); expect(edited.review.scope).toBe(original.review.scope);
  await expect(page.locator('#review-restored-source')).toContainText('synthetic-review.json');
});

test('rejects stale questions, malformed and oversized files without changing the current record', async ({ page }) => {
  await page.goto(PAGE); const original = await exportSheet(page);
  const stale = structuredClone(original); stale.item.checks[0].question += ' Synthetic changed question.';
  await page.locator('[data-review-field="notes"]').fill(PRIVATE);
  await page.locator('#review-import-file').setInputFiles(file('stale.json', stale));
  await expect(page.locator('#review-import-status')).toContainText('不匹配'); await expect(page.locator('#review-import-preview')).toContainText('问题文本已变化');
  await expect(page.locator('#review-import-apply')).toBeDisabled();
  for (const [name, value] of [['broken.json', '{broken'], ['oversized.json', ' '.repeat(2 * 1024 * 1024 + 1)]]) {
    await page.locator('#review-import-file').setInputFiles(file(name, value));
    await expect(page.locator('#review-import-status')).toContainText('保持不变');
    await expect(page.locator('#review-import-apply')).toBeDisabled();
  }
  await expect(page.locator('[data-review-field="notes"]')).toHaveValue(PRIVATE);
  await page.locator('[data-review-field="reviewedAt"]').fill('2026-02-30');
  await page.locator('#review-export-json').click(); await expect(page.locator('#review-status')).toContainText('无效输入');
  await page.locator('#review-import-file').setInputFiles(file('valid.json', original));
  await expect(page.locator('#review-import-status')).toContainText('当前输入无效'); await expect(page.locator('#review-import-apply')).toBeDisabled();
});

test('confirms unsaved item switching and clearing and makes no private API or storage writes', async ({ page }) => {
  const writes: string[] = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') writes.push(request.url()); });
  await page.goto(PAGE); await page.locator('[data-review-field="notes"]').fill(PRIVATE);
  page.removeAllListeners('dialog'); page.once('dialog', async dialog => { expect(dialog.message()).toContain('尚未导出'); await dialog.dismiss(); });
  await page.locator('#review-item').selectOption('lab:assembly');
  await expect(page.locator('#review-item')).toHaveValue('guide:first-study'); await expect(page.locator('[data-review-field="notes"]')).toHaveValue(PRIVATE);
  page.once('dialog', dialog => dialog.accept()); await page.locator('#review-item').selectOption('lab:assembly');
  await expect(page.locator('[data-review-field="notes"]')).toHaveValue('');
  await page.locator('[data-review-field="notes"]').fill(PRIVATE);
  page.once('dialog', dialog => dialog.accept()); await page.locator('#review-new').click();
  await expect(page.locator('[data-review-field="notes"]')).toHaveValue('');
  expect(writes).toEqual([]);
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href })); expect(storage).not.toContain(PRIVATE);
});

test('late reads cannot override a cancelled preview, a newer field edit or an item switch', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    const controls = window as unknown as { releaseWorksheetFile?: () => void; pendingWorksheetFiles: number; worksheetHashes: number };
    controls.pendingWorksheetFiles = 0; controls.worksheetHashes = 0;
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (...args: Parameters<typeof digest>) => { const value = await digest(...args); controls.worksheetHashes++; return value; };
    File.prototype.arrayBuffer = async function () { const bytes = await original.call(this); if (this.name.startsWith('slow-')) await new Promise<void>(resolve => { controls.pendingWorksheetFiles++; controls.releaseWorksheetFile = resolve; }); return bytes; };
  });
  await page.goto(PAGE); const original = await exportSheet(page);
  for (const [index, action] of ['cancel', 'edit', 'switch'].entries()) {
    await page.locator('#review-import-file').setInputFiles(file(`slow-${index}.json`, original));
    await expect.poll(() => page.evaluate(() => (window as unknown as { pendingWorksheetFiles: number }).pendingWorksheetFiles)).toBe(index + 1);
    if (action === 'cancel') await page.locator('#review-import-cancel').click();
    if (action === 'edit') await page.locator('[data-review-field="notes"]').fill(PRIVATE);
    if (action === 'switch') await page.locator('#review-item').selectOption('lab:assembly');
    await page.evaluate(() => (window as unknown as { releaseWorksheetFile: () => void }).releaseWorksheetFile());
    await expect.poll(() => page.evaluate(() => (window as unknown as { worksheetHashes: number }).worksheetHashes)).toBe(index + 1);
    await expect(page.locator('#review-import-preview')).toBeHidden(); await expect(page.locator('#review-import-apply')).toBeDisabled();
  }
  await expect(page.locator('#review-item')).toHaveValue('lab:assembly');
});
