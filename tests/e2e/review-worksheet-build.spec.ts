import { expect, test, type Download, type Page } from '@playwright/test';
import type { ContentReviewPack } from '../../src/lib/content-review-pack';

async function downloadBytes(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function exported(page: Page): Promise<Buffer> {
  const pending = page.waitForEvent('download'); await page.locator('#review-export-json').click();
  return downloadBytes(await pending);
}

test('a worksheet follows the real build item and restores manual findings without granting publication approval', async ({ page, request, context, baseURL }) => {
  test.skip(!baseURL?.startsWith('http://127.0.0.1:'), 'Synthetic review findings stay on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  page.on('dialog', dialog => dialog.accept());
  const mutations: string[] = [], runtimes: string[] = [];
  context.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(path);
    if (path.startsWith('/vendor/pyodide/')) runtimes.push(path);
  });
  const response = await request.get('/downloads/content-review.json'); expect(response.ok()).toBe(true);
  const pack: ContentReviewPack = await response.json();
  const item = pack.items.find(item => item.id === 'guide:first-study')!; expect(item).toBeDefined();
  await page.goto('/learning/start/');
  const entry = page.locator('[data-content-provenance="guide:first-study"]').getByRole('link', { name: '填写本项审核回执 →' });
  await expect(entry).toHaveAttribute('href', '/content-status/review/?item=guide%3Afirst-study');
  await entry.click();
  await expect(page.locator('#review-item')).toHaveValue(item.id);
  await expect(page.locator('#review-basis-current')).toContainText(pack.sourceCommit);
  for (const file of item.files) await expect(page.locator('#review-files')).toContainText(file.sha256);

  const reviewer = 'SYNTHETIC ACCEPTANCE REVIEWER — not a real content review';
  const note = 'PRIVATE SYNTHETIC REVIEW NOTE: <script>never execute</script>\n# not a real approval';
  await page.locator('[data-review-field="reviewer"]').fill(reviewer);
  await page.locator('[data-review-field="reviewedAt"]').fill('2026-10-25');
  await page.locator('[data-review-field="scope"]').fill('Synthetic software acceptance only: verify field handling and exact build binding.');
  await page.locator('[data-review-field="notes"]').fill(note);
  for (const check of item.checks) {
    await page.locator(`[data-review-check="${check.id}"][data-review-check-field="decision"]`).selectOption('pass');
    await page.locator(`[data-review-check="${check.id}"][data-review-check-field="note"]`).fill(`Synthetic acceptance for ${check.id}; this does not assert an actual engineering review.`);
  }
  await page.locator('#review-conclusion').selectOption('acceptable');
  await page.locator('#review-conclude').click();
  const backup = await exported(page), document = JSON.parse(backup.toString('utf8'));
  expect(document.basis).toMatchObject({ sourceCommit: pack.sourceCommit, generatedAt: pack.generatedAt, workingTree: pack.workingTree });
  expect(document.item).toMatchObject({ id: item.id, contentVersion: item.contentVersion, fingerprint: item.fingerprint, sourcePath: item.sourcePath });
  expect(document.item.files).toEqual(item.files.map(file => ({ path: file.path, sha256: file.sha256, sizeBytes: file.sizeBytes })));
  expect(document.item.checks).toEqual(item.checks.map(check => ({ id: check.id, question: check.question })));
  expect(document.review).toMatchObject({ reviewer, reviewedAt: '2026-10-25', notes: note, conclusion: 'acceptable' });
  expect(document.publication.approved).toBe(false);

  await page.reload();
  await expect(page.locator('[data-review-field="reviewer"]')).toHaveValue('');
  await page.locator('#review-import-file').setInputFiles({ name: 'synthetic-review-receipt.json', mimeType: 'application/json', buffer: backup });
  await expect(page.locator('#review-import-apply')).toBeEnabled();
  await expect(page.locator('[data-review-field="reviewer"]')).toHaveValue('');
  await page.locator('#review-import-apply').click();
  await expect(page.locator('[data-review-field="reviewer"]')).toHaveValue(reviewer);
  const restored = JSON.parse((await exported(page)).toString('utf8'));
  expect(restored.basis).toEqual(document.basis); expect(restored.item).toEqual(document.item); expect(restored.review).toEqual(document.review);
  expect(restored.publication.approved).toBe(false);

  // A different commit alone is not a content change. Original provenance must survive.
  const priorCommit = '1'.repeat(40), prior = structuredClone(document); prior.basis.sourceCommit = priorCommit;
  await page.locator('#review-import-file').setInputFiles({ name: 'synthetic-prior-commit.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(prior)) });
  await expect(page.locator('#review-import-apply')).toBeEnabled();
  await page.locator('#review-import-apply').click();
  await expect(page.locator('#review-basis-original')).toContainText(priorCommit);
  await expect(page.locator('#review-basis-current')).toContainText(pack.sourceCommit);
  expect(JSON.parse((await exported(page)).toString('utf8')).basis.sourceCommit).toBe(priorCommit);

  // The old fingerprint does not cover checklist wording, so compare it independently.
  const stale = structuredClone(prior); stale.item.checks[0].question += ' SYNTHETIC STALE QUESTION';
  await page.locator('#review-import-file').setInputFiles({ name: 'synthetic-stale-question.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(stale)) });
  await expect(page.locator('#review-import-preview')).toBeVisible();
  await expect(page.locator('#review-import-apply')).toBeDisabled();
  await expect(page.locator('[data-review-field="reviewer"]')).toHaveValue(reviewer);
  const unchanged = JSON.parse((await exported(page)).toString('utf8'));
  expect(unchanged.item.checks).toEqual(document.item.checks); expect(unchanged.review).toEqual(document.review);
  await page.locator('[data-review-check-field="note"]').first().fill('Synthetic revised finding; prior overall conclusion needs a new explicit decision.');
  expect(JSON.parse((await exported(page)).toString('utf8')).review.conclusion).toBe('not-recorded');

  const publicPack: ContentReviewPack = await (await request.get('/downloads/content-review.json')).json();
  expect(publicPack.publication.approved).toBe(false);
  expect(publicPack.items.every(item => item.humanReview.state === 'pending' && item.humanReview.reviewer === null)).toBe(true);
  expect(mutations).toEqual([]); expect(runtimes).toEqual([]);
  expect(await page.evaluate(needle => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(needle), note)).toBe(false);
});
