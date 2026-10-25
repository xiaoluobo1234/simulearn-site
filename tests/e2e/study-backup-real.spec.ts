import { expect, test, type APIRequestContext, type BrowserContext, type Download, type Page } from '@playwright/test';

async function bytes(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function exported(page: Page): Promise<{ buffer: Buffer; payload: any }> {
  const pending = page.waitForEvent('download'); await page.locator('#study-export-json').click();
  const buffer = await bytes(await pending); return { buffer, payload: JSON.parse(buffer.toString('utf8')) };
}
async function account(request: APIRequestContext, context: BrowserContext, baseURL: string) {
  const csrf = await request.get('/api/auth/csrf-token'); expect(csrf.ok()).toBe(true);
  const { token } = await csrf.json();
  const registered = await request.post('/api/auth/email/register', {
    headers: { 'X-CSRF-Token': token },
    data: { email: `backup-${crypto.randomUUID()}@example.invalid`, password: 'local-backup-acceptance', name: '本地备份往返验收账户' },
  });
  expect(registered.status()).toBe(200);
  const { user } = await registered.json();
  const cookie = registered.headers()['set-cookie'].split(';')[0], split = cookie.indexOf('=');
  await context.addCookies([{ name: cookie.slice(0, split), value: cookie.slice(split + 1), url: baseURL, httpOnly: true, secure: false, sameSite: 'Lax' }]);
  return { user, cookie };
}

test('a real Python file and private reference snapshots survive account-to-account backup restoration without binding old identities', async ({ page, request, context, baseURL }) => {
  test.setTimeout(180_000);
  test.skip(!baseURL?.startsWith('http://127.0.0.1:'), 'Synthetic accounts and observations stay on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  const first = await account(request, context, baseURL!);

  // All record text and self-reported states below are synthetic acceptance data.
  // The Python execution, exports and local private R2 writes are real.
  await page.goto('/labs/python/?template=csv&case=normal');
  await page.locator('[data-lab-run]').click();
  await expect(page.locator('[data-python-lab]')).toHaveAttribute('data-lab-state', 'succeeded', { timeout: 55_000 });
  const pendingResult = page.waitForEvent('download'); await page.locator('[data-lab-export="result"]').click();
  const pythonBytes = await bytes(await pendingResult), pythonText = pythonBytes.toString('utf8');
  expect(JSON.parse(pythonText).stdout).toContain('检查发现 0 项问题');
  const tokenResponse = await request.get('/api/auth/csrf-token', { headers: { Cookie: first.cookie } });
  const { token } = await tokenResponse.json();
  async function create(item: Record<string, unknown>) {
    const response = await request.post('/api/study/items', { headers: { Cookie: first.cookie, 'X-CSRF-Token': token }, data: { expectedOwner: first.user.userId, item } });
    expect(response.status()).toBe(201); return (await response.json()).item;
  }
  const state = { learningStatus: 'introduced', reviewStatus: 'draft', visibility: 'private', sourceIds: [], noteIds: [] };
  const source = await create({ ...state, kind: 'source', title: 'PRIVATE SOURCE SNAPSHOT A', fields: { url: 'https://example.invalid/local-source', readRange: 'Synthetic acceptance text only.\r\nNo real source reading claim.' } });
  const missing = await create({ ...state, kind: 'source', title: 'PRIVATE INDIRECT SOURCE, not in exported reference list', fields: { body: 'Synthetic missing-snapshot check.' } });
  const note = await create({ ...state, kind: 'note', title: 'PRIVATE NOTE SNAPSHOT A', fields: { body: '<script>PRIVATE_NOTE_TEXT</script>\r\nOnly an untrusted file snapshot.' }, sourceIds: [missing.id] });
  const original = await create({
    ...state, kind: 'record', title: 'PRIVATE BACKUP ACCEPTANCE: preserve fields and references',
    learningStatus: 'independent', reviewStatus: 'reviewed', visibility: 'pending', sourceIds: [source.id], noteIds: [note.id],
    fields: { date: 'Synthetic historical self-report, not a real learner date', executor: '', reproduction: '', raw: 'PRIVATE_RAW\r\nsecond line\rthird line\tend', body: '## Untrusted saved body\r\n<script>PRIVATE_BODY_TEXT</script>', csvResultOriginal: pythonText, csvResultMetadata: 'Synthetic archive label; the original Python JSON is preserved separately.' },
  });

  await page.goto(`/learning/records/?id=${original.id}`);
  await expect(page.locator('#study-title')).toHaveValue(original.title);
  await expect(page.locator('[name="field:executor"]')).toHaveValue('');
  const firstBackup = await exported(page);
  expect(firstBackup.payload.item.fields).toEqual(original.fields);
  expect(firstBackup.payload.references.map((item: any) => item.id).sort()).toEqual([source.id, note.id].sort());

  const second = await account(request, context, baseURL!);
  await page.goto('/learning/records/#study-backup-import');
  await expect(page.locator('#study-auth')).toContainText('账户已连接');
  const writes: string[] = [];
  context.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/study/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.url()); });
  await page.locator('#study-backup-file').setInputFiles({ name: 'actual-private-backup.json', mimeType: 'application/json', buffer: firstBackup.buffer });
  await expect(page.locator('#study-backup-apply')).toBeEnabled();
  await expect(page.locator('#study-backup-preview')).toContainText(source.title);
  await expect(page.locator('#study-backup-preview')).toContainText(missing.id);
  expect(writes).toEqual([]);
  await page.locator('#study-backup-apply').click();
  await expect(page.locator('#study-title')).toHaveValue(original.title);
  const draft = (await exported(page)).payload.item;
  expect(draft.id).toBeUndefined(); expect(draft.revision).toBeUndefined();
  expect(draft).toMatchObject({ learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private', sourceIds: [], noteIds: [] });
  const { studyBackupArchive: archivedText, ...restoredFields } = draft.fields;
  expect(restoredFields).toEqual(original.fields);
  const archive = JSON.parse(archivedText);
  expect(archive.imports).toHaveLength(1);
  expect(archive.references.map((entry: any) => entry.id).sort()).toEqual([source.id, note.id].sort());
  expect(archive.unresolved).toContainEqual({ kind: 'source', id: missing.id });
  expect(archive.references.find((entry: any) => entry.id === note.id).item).toEqual(note);
  expect(writes).toEqual([]);
  const saving = page.waitForResponse(response => new URL(response.url()).pathname === '/api/study/items' && response.request().method() === 'POST');
  await page.locator('#study-save').click();
  const savedResponse = await saving; expect(savedResponse.status()).toBe(201);
  const saved = (await savedResponse.json()).item;
  expect(saved.id).not.toBe(original.id); expect(savedResponse.request().postDataJSON().expectedOwner).toBe(second.user.userId);
  expect(saved.fields).toEqual(draft.fields);
  await page.goto(`/learning/records/?id=${saved.id}`);
  await expect(page.locator('#study-title')).toHaveValue(original.title);
  const secondBackup = await exported(page);
  expect(secondBackup.payload.item.fields).toEqual(saved.fields);
  expect(secondBackup.payload.references).toEqual([]);
  await page.locator('#study-backup-file').setInputFiles({ name: 'second-generation-backup.json', mimeType: 'application/json', buffer: secondBackup.buffer });
  await expect(page.locator('#study-backup-apply')).toBeEnabled(); await page.locator('#study-backup-apply').click();
  const third = (await exported(page)).payload.item;
  const { studyBackupArchive: secondArchivedText, ...secondRestoredFields } = third.fields;
  expect(secondRestoredFields).toEqual(original.fields);
  const secondArchive = JSON.parse(secondArchivedText);
  expect(secondArchive.imports).toHaveLength(2);
  expect(secondArchive.references).toEqual(archive.references);
  expect(secondArchive.unresolved).toEqual(archive.unresolved);
  expect(secondArchive).not.toHaveProperty('previous');
  expect(writes).toHaveLength(1);

  const untouched = await request.get(`/api/study/items/${original.id}`, { headers: { Cookie: first.cookie }, maxRetries: 1 });
  expect(untouched.status()).toBe(200); expect((await untouched.json()).item).toEqual(original);
  for (const entry of [source, note]) expect((await request.get(`/api/study/items/${entry.id}`, { headers: { Cookie: second.cookie } })).status()).toBe(404);
  for (const owner of [first, second]) {
    const publicResult = await request.get(`/api/study/public/${owner.user.userId}/${owner === first ? original.id : saved.id}`);
    expect(publicResult.status()).toBe(404);
  }
});
