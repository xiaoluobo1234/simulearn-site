import { createHash } from 'node:crypto';
import { expect, test, type Download } from '@playwright/test';

async function bytes(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test('an actual CSV Python result becomes a separate private account draft only after preview and explicit save', async ({ page, context, request, baseURL }) => {
  test.setTimeout(95_000);
  test.skip(!baseURL?.startsWith('http://127.0.0.1:'), 'Acceptance accounts and files stay on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());

  // The account is synthetic; the Python execution and private Worker/R2 save are real.
  const csrf = await request.get('/api/auth/csrf-token'); expect(csrf.ok()).toBe(true);
  const { token } = await csrf.json();
  const registered = await request.post('/api/auth/email/register', {
    headers: { 'X-CSRF-Token': token },
    data: { email: `csv-record-${crypto.randomUUID()}@example.invalid`, password: 'local-csv-record-acceptance', name: '本地CSV记录验收' },
  });
  expect(registered.status()).toBe(200);
  const { user } = await registered.json();
  const cookie = registered.headers()['set-cookie'].split(';')[0], separator = cookie.indexOf('=');
  await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: baseURL!, httpOnly: true, secure: false, sameSite: 'Lax' }]);
  const seedTokenResponse = await request.get('/api/auth/csrf-token', { headers: { Cookie: cookie } });
  const seedToken = (await seedTokenResponse.json()).token;
  const seedResponse = await request.post('/api/study/items', {
    headers: { Cookie: cookie, 'X-CSRF-Token': seedToken },
    data: { expectedOwner: user.userId, item: { kind: 'record', title: 'PRIVATE ORIGINAL RECORD: keep unchanged', fields: { problem: '原记录不得被文件导入覆盖' }, sourceIds: [], noteIds: [], learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private' } },
  });
  expect(seedResponse.status()).toBe(201);
  const seed = (await seedResponse.json()).item;
  const mutations: string[] = [];
  context.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.url()); });

  await page.goto('/labs/python/?template=csv&case=non-numeric');
  await page.locator('[data-lab-run]').click();
  await expect(page.locator('[data-python-lab]')).toHaveAttribute('data-lab-state', 'succeeded', { timeout: 55_000 });
  const exporting = page.waitForEvent('download'); await page.locator('[data-lab-export="result"]').click();
  const original = await bytes(await exporting), result = JSON.parse(original.toString('utf8'));
  expect(result.stdout).toContain("value='abc' 无法解析为有限数值");
  expect(result.stdout).toContain('检查发现 1 项问题'); expect(result.state).toBe('succeeded');
  expect(result.environment).toContain('CPython 3.14.2');

  await page.goto(`/learning/records/?id=${seed.id}&project=csv-checker#study-result-import`);
  await expect(page.locator('#study-auth')).toContainText('账户已连接');
  await expect(page.locator('#study-title')).toHaveValue(seed.title);
  await page.locator('#study-result-file').setInputFiles({ name: 'actual-csv-result.json', mimeType: 'application/json', buffer: original });
  await expect(page.locator('#study-result-preview')).toBeVisible();
  await expect(page.locator('#study-result-preview')).toContainText('检查发现 1 项问题');
  await expect(page.locator('#study-title')).toHaveValue(seed.title);
  expect(mutations).toEqual([]);
  await page.locator('#study-result-apply').click();
  expect(new URL(page.url()).searchParams.has('id')).toBe(false);
  await expect(page.locator('[name="learningStatus"]')).toHaveValue('not-started');
  await expect(page.locator('[name="reviewStatus"]')).toHaveValue('draft');
  await expect(page.locator('[name="visibility"]')).toHaveValue('private');
  await expect(page.locator('[name="field:date"]')).toHaveValue('');
  await expect(page.locator('[name="field:input"]')).toHaveValue(result.input);
  await expect(page.locator('[name="field:actualOutput"]')).toHaveValue(/检查发现 1 项问题/);
  await expect(page.locator('[name="field:reproduction"]')).not.toHaveValue('已复现');
  const localExport = page.waitForEvent('download'); await page.locator('#study-export-json').click();
  const draft = JSON.parse((await bytes(await localExport)).toString('utf8')).item;
  expect(draft).not.toHaveProperty('id');
  expect(draft.fields.csvResultOriginal).toBe(original.toString('utf8'));
  expect(draft.fields.csvResultMetadata).toContain(createHash('sha256').update(original).digest('hex'));
  expect(mutations).toEqual([]);

  const title = 'PRIVATE LOCAL CSV ACCEPTANCE: actual worker export, no learner mastery claim';
  await page.locator('#study-title').fill(title);
  const saving = page.waitForResponse(response => new URL(response.url()).pathname === '/api/study/items' && response.request().method() === 'POST');
  await page.locator('#study-save').click();
  const savedResponse = await saving; expect(savedResponse.status()).toBe(201);
  const saved = (await savedResponse.json()).item;
  expect(saved.id).not.toBe(seed.id);
  expect(savedResponse.request().postDataJSON().expectedOwner).toBe(user.userId);
  expect(saved).toMatchObject({ title, visibility: 'private', reviewStatus: 'draft', learningStatus: 'not-started', revision: 1 });
  expect(saved.fields.csvResultOriginal).toBe(original.toString('utf8'));
  await expect(page.locator('#study-message')).toContainText('修订 1');
  await page.goto(`/learning/records/?id=${saved.id}`);
  await expect(page.locator('#study-title')).toHaveValue(title);
  const reExport = page.waitForEvent('download'); await page.locator('#study-export-json').click();
  const restored = JSON.parse((await bytes(await reExport)).toString('utf8')).item;
  expect(restored.fields.csvResultOriginal).toBe(original.toString('utf8'));
  expect(restored.fields.csvResultMetadata).toBe(saved.fields.csvResultMetadata);
  expect(restored.fields.input).toBe(result.input);
  expect(restored.reviewStatus).toBe('draft'); expect(restored.visibility).toBe('private');
  const publicResponse = await request.get(`/api/study/public/${user.userId}/${saved.id}`);
  expect(publicResponse.status()).toBe(404); expect(await publicResponse.text()).not.toContain(title);
  const untouchedResponse = await request.get(`/api/study/items/${seed.id}`, { headers: { Cookie: cookie }, maxRetries: 1 });
  expect(untouchedResponse.status()).toBe(200); expect((await untouchedResponse.json()).item).toEqual(seed);
  expect(mutations).toHaveLength(1);
});
