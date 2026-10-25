import { createHash } from 'node:crypto';
import { expect, test, type Download, type Page } from '@playwright/test';

async function downloadBytes(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function exported(page: Page, selector: string): Promise<Buffer> {
  const pending = page.waitForEvent('download'); await page.locator(selector).click();
  return downloadBytes(await pending);
}

test('a real assembly export prepares a separate private review and its backup restores without overwriting the original account record', async ({ page, request, context, baseURL }) => {
  test.setTimeout(60_000);
  test.skip(!baseURL?.startsWith('http://127.0.0.1:'), 'Synthetic acceptance accounts and records stay on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());

  // This account and all observations below are development acceptance data.
  // The assembly calculation and local persistence are real, never mocked.
  const csrf = await request.get('/api/auth/csrf-token'); expect(csrf.ok()).toBe(true);
  const { token } = await csrf.json();
  const registered = await request.post('/api/auth/email/register', {
    headers: { 'X-CSRF-Token': token },
    data: { email: `review-import-${crypto.randomUUID()}@example.invalid`, password: 'local-import-acceptance', name: '本地复盘导入验收' },
  });
  expect(registered.status()).toBe(200);
  const cookie = registered.headers()['set-cookie'].split(';')[0], separator = cookie.indexOf('=');
  await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: baseURL!, httpOnly: true, secure: false, sameSite: 'Lax' }]);

  await page.goto('/labs/assembly/');
  await page.locator('#assembly-solve').click();
  await expect(page.locator('#assembly-result')).toBeVisible();
  const assembly = await exported(page, '#assembly-export');
  expect(JSON.parse(assembly.toString('utf8')).solution.displacement[2]).toBeCloseTo(10 / 21, 10);

  const observation = 'SYNTHETIC ACCEPTANCE OBSERVATION: 浏览器装配显示约 0.47619 mm；本机求解器未运行。';
  const prediction = 'SYNTHETIC ACCEPTANCE PREDICTION: 我预计右端位移为正，尚需核对。';
  const environment = 'SYNTHETIC ACCEPTANCE ENVIRONMENT: 本次开发浏览器；不是用户本机复现声明。';
  await page.goto('/learning/start/');
  await page.locator('#first-prediction').fill(prediction);
  await page.locator('#first-assemblyObservation').fill(observation);
  await page.locator('#first-environment').fill(environment);
  await page.locator('#first-evidenceObservation').fill('DO NOT INFER NEXT TASK FROM THIS MIXED NOTE');
  await page.locator('#study-evidence-file').setInputFiles({ name: 'actual-browser-assembly.json', mimeType: 'application/json', buffer: assembly });
  await expect(page.locator('#study-evidence-apply')).toBeEnabled();
  await page.locator('#study-evidence-apply').click();
  const backup = await exported(page, '#first-study-export-json');
  await expect(page.locator('[data-guide-link="review"]')).toHaveAttribute('href', '/failures/review/#failure-import');

  await page.goto('/failures/review/');
  await expect(page.locator('#failure-auth')).toContainText('账户已连接');
  await page.locator('[name="title"]').fill('SYNTHETIC ORIGINAL: 保留的账户复盘');
  await page.locator('[name="symptom"]').fill('SYNTHETIC ORIGINAL CONTENT: 不应被文件起稿覆盖。');
  const originalResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/study/items' && response.request().method() === 'POST');
  await page.locator('#failure-save').click();
  const original = (await (await originalResponse).json()).item;
  await expect(page.locator('#failure-status')).toContainText('修订 1');

  const mutations: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/study/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.method() + ' ' + new URL(request.url()).pathname); });
  await page.locator('#failure-import-file').setInputFiles({ name: 'private-first-study.json', mimeType: 'application/json', buffer: backup });
  await expect(page.locator('#failure-import-kind')).toBeEnabled();
  await expect(page.locator('#failure-import-apply')).toBeDisabled();
  await expect(page.locator('[name="symptom"]')).toHaveValue('SYNTHETIC ORIGINAL CONTENT: 不应被文件起稿覆盖。');
  await page.locator('#failure-import-kind').selectOption('assembly');
  await expect(page.locator('#failure-import-apply')).toBeEnabled();
  await expect(page.locator('#failure-import-preview')).toContainText(observation);
  await page.locator('#failure-import-apply').click();
  expect(new URL(page.url()).search).toBe('');
  expect(await page.locator('[name="actual"]').inputValue()).toContain(observation);
  expect(await page.locator('[name="actual"]').inputValue()).toContain(environment);
  expect(await page.locator('[name="expected"]').inputValue()).toContain(prediction);
  for (const name of ['date', 'symptom', 'hypothesis', 'attempts', 'change', 'retest', 'next']) await expect(page.locator(`#failure-form [name="${name}"]`)).toHaveValue('');
  await expect(page.locator('[name="executor"]')).toHaveValue('未运行');
  await expect(page.locator('[name="reproduction"]')).toHaveValue('未运行');
  expect(mutations).toEqual([]);

  const preparedBytes = await exported(page, '#failure-export-json');
  const prepared = JSON.parse(preparedBytes.toString('utf8')).failureReview;
  expect(prepared.evidence).toContain(createHash('sha256').update(backup).digest('hex'));
  expect(prepared.evidence).toContain(createHash('sha256').update(assembly).digest('hex'));
  expect(preparedBytes.toString('utf8')).not.toContain('DO NOT INFER NEXT TASK');
  expect(preparedBytes.toString('utf8')).not.toContain('originalText');
  expect(preparedBytes.toString('utf8')).not.toContain('displacement');

  const preparedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/study/items' && response.request().method() === 'POST');
  await page.locator('#failure-save').click();
  const newRecord = (await (await preparedResponse).json()).item;
  expect(newRecord.id).not.toBe(original.id);
  expect(newRecord).toMatchObject({ revision: 1, reviewStatus: 'draft', visibility: 'private', learningStatus: 'not-started' });
  // Retry one local transport reset on this read only; HTTP errors and the
  // complete original-record equality assertion still fail immediately.
  const originalAfter = await request.get(`/api/study/items/${original.id}`, { headers: { Cookie: cookie }, maxRetries: 1 });
  expect((await originalAfter.json()).item).toEqual(original);

  await page.reload();
  await expect(page.locator('#failure-status')).toContainText('已读取私人复盘');
  await page.locator('#failure-import-file').setInputFiles({ name: 'private-review.json', mimeType: 'application/json', buffer: preparedBytes });
  await expect(page.locator('#failure-import-apply')).toBeEnabled();
  await page.locator('#failure-import-apply').click();
  expect(new URL(page.url()).search).toBe('');
  expect(JSON.parse((await exported(page, '#failure-export-json')).toString('utf8')).failureReview).toEqual(prepared);
  expect(mutations).toEqual(['POST /api/study/items']);
  expect(await page.evaluate(needle => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(needle), observation)).toBe(false);
});
