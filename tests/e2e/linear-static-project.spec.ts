import { expect, test, type Dialog, type Download, type Page } from '@playwright/test';
import { inflateRawSync } from 'node:zlib';

const PROJECT = '/learning/projects/linear-static/';
const SLUGS = ['uniform-bar', 'stepped-bar', 'cantilever-beam'] as const;
const QUANTITIES = ['tip-displacement', 'reaction-force', 'strain-energy'] as const;
const ANSWERS: Record<typeof SLUGS[number], [string, string, string]> = {
  'uniform-bar': ['4.76190476e-1', '-1e4', '2.38095238e3'],
  'stepped-bar': ['7.61904762e-1', '-1e4', '3.80952381e3'],
  'cantilever-beam': ['-1.9047619e-1', '1e3', '9.5238095e1'],
};

// All values and account records in this file are synthetic local acceptance
// fixtures, never evidence that a learner ran a solver or completed a project.
test.beforeEach(async ({ page, baseURL }) => {
  const url = baseURL ? new URL(baseURL) : null;
  test.skip(!url || url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Project acceptance data must remain on loopback.');
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('https://cdn.jsdelivr.net/npm/mathjax@3/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  await page.route('**/api/auth/csrf-token', route => route.fulfill({ json: { ok: true, token: 'project-browser-fixture-token' } }));
});

function field(page: Page, name: string) { return page.locator(`#project-practice-form [name="${name}"]`); }
async function chooseConcept(page: Page, value: 'proof' | 'not-proof') {
  const select = page.locator('#project-practice-form select[name="concept"]');
  if (await select.count()) await select.selectOption(value);
  else await page.locator(`#project-practice-form input[name="concept"][value="${value}"]`).check();
}
async function chooseCase(page: Page, slug: typeof SLUGS[number], discard: 'none' | 'accept' | 'cancel' = 'none') {
  if (await field(page, 'caseSlug').inputValue() === slug) return;
  const dialogs: Array<{ type: string; message: string }> = [];
  // Scope dialog handling to this one select action. A clean switch must never
  // silently accept a prompt, and a dirty switch must produce exactly one.
  const handle = async (dialog: Dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    if (discard === 'accept') await dialog.accept();
    else await dialog.dismiss();
  };
  page.on('dialog', handle);
  try { await field(page, 'caseSlug').selectOption(slug); }
  finally { page.off('dialog', handle); }
  if (discard === 'none') expect(dialogs).toEqual([]);
  else {
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].type).toBe('confirm');
    expect(dialogs[0].message).toContain('当前修改尚未保存');
  }
}
async function fillAnswers(page: Page, slug: typeof SLUGS[number], discard: 'none' | 'accept' = 'none') {
  await chooseCase(page, slug, discard);
  for (let i = 0; i < QUANTITIES.length; i++) await field(page, QUANTITIES[i]).fill(ANSWERS[slug][i]);
}
async function downloadBuffer(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function downloadText(download: Download) { return (await downloadBuffer(download)).toString('utf8'); }

// Read real archive payloads rather than accepting an HTML error page named .zip.
// These small first-party fixture archives use ordinary stored/deflated ZIP files.
function unzipEntries(bytes: Buffer): Map<string, Buffer> {
  expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  expect(end).toBeGreaterThanOrEqual(0);
  const count = bytes.readUInt16LE(end + 10);
  let cursor = bytes.readUInt32LE(end + 16);
  const entries = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    expect(bytes.readUInt32LE(cursor)).toBe(0x02014b50);
    const method = bytes.readUInt16LE(cursor + 10);
    const size = bytes.readUInt32LE(cursor + 20);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const local = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    expect(bytes.readUInt32LE(local)).toBe(0x04034b50);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const compressed = bytes.subarray(start, start + size);
    expect([0, 8]).toContain(method);
    entries.set(name, method === 8 ? inflateRawSync(compressed) : compressed);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

test('the project has six connected learning stages and three benchmark routes', async ({ page }) => {
  await page.goto(PROJECT);
  await expect(page.locator('[data-project-practice]')).toBeVisible();
  await expect(page.locator('#practice-auth')).toContainText('匿名');
  for (const id of ['concepts', 'assumptions', 'model', 'solve', 'validate', 'review']) await expect(page.locator(`section#${id}`)).toHaveCount(1);
  await expect(page.locator('.project-case-card')).toHaveCount(3);
  expect((await page.locator('.project-case-card').evaluateAll(links => links.map(link => link.getAttribute('href')))).sort()).toEqual(SLUGS.map(slug => `/cases/benchmarks/${slug}/`).sort());
  await expect(page.locator('#project-benchmarks-data')).toHaveCount(1);
  for (const quantity of QUANTITIES) await expect(field(page, quantity)).toHaveValue('');
  await expect(field(page, 'executor')).toHaveValue('未运行');
  await expect(field(page, 'reproduction')).toHaveValue('未运行');
  await page.locator('.project-case-card[href="/cases/benchmarks/uniform-bar/"]').click();
  await expect(page.locator('.benchmark-article')).toBeVisible();
  await expect(page.locator(`a[href^="${PROJECT}?case=uniform-bar"]`).first()).toBeVisible();
  await page.locator(`a[href^="${PROJECT}?case=uniform-bar"]`).first().click();
  await expect(field(page, 'caseSlug')).toHaveValue('uniform-bar');
});

test('all three benchmark details download genuine self-contained ZIP evidence', async ({ page }) => {
  for (const slug of SLUGS) {
    await page.goto(`/cases/benchmarks/${slug}/`);
    await expect(page.locator('.benchmark-article')).toBeVisible();
    await expect(page.locator('.benchmark-draft')).toContainText('待');
    const archiveLink = page.locator(`.benchmark-download[href="/downloads/linear-static/${slug}.zip"]`).first();
    await expect(archiveLink).toBeVisible();
    const downloading = page.waitForEvent('download');
    await archiveLink.click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`${slug}.zip`);
    const entries = unzipEntries(await downloadBuffer(download));
    expect([...entries.keys()].sort()).toEqual(['README.md', 'input.json', 'reference-results.json', 'verify.py'].sort());
    const input = JSON.parse(entries.get('input.json')!.toString('utf8'));
    expect(input.slug).toBe(slug);
    expect(entries.get('verify.py')!.toString('utf8')).toContain('def ');
    const reference = JSON.parse(entries.get('reference-results.json')!.toString('utf8'));
    expect(reference).toBeTruthy();
    expect(entries.get('README.md')!.toString('utf8')).toContain('Python');
  }
});

test('the course offers an offline coding exercise with an explicitly unfinished scaffold', async ({ page }) => {
  await page.goto(PROJECT);
  const area=page.locator('#code-practice');
  await expect(area.getByRole('heading')).toContainText('反力与能量');
  const downloading=page.waitForEvent('download');
  await area.locator('a[download][href="/downloads/linear-static-exercises/code-practice.zip"]').click();
  const archive=await downloading;
  expect(archive.suggestedFilename()).toBe('code-practice.zip');
  const entries=unzipEntries(await downloadBuffer(archive));
  for(const name of ['exercise.py','run_tests.py','fixtures.json','README.md','reference_solution.py']) expect(entries.has(name)).toBe(true);
  expect(entries.get('exercise.py')!.toString('utf8')).toContain('NotImplementedError');
  expect(entries.get('run_tests.py')!.toString('utf8')).toContain('unittest');
  await expect(field(page,'executor')).toHaveValue('未运行');
  await expect(field(page,'reproduction')).toHaveValue('未运行');
});

test('blank and non-finite numeric inputs are not treated as zero or a successful check', async ({ page }) => {
  await page.goto(PROJECT);
  await expect(page.locator('#practice-auth')).toContainText('匿名');
  await page.locator('#practice-check').click();
  for (const quantity of QUANTITIES) {
    const result = page.locator(`[data-practice-result="${quantity}"]`);
    await expect(result).toContainText('请填写完整');
    await expect(result).toContainText('无法计算');
  }
  await expect(page.locator('[data-practice-concept-result]')).toContainText('尚未选择');
  await expect(page.locator('#practice-feedback')).toContainText('仍有待检查项');
  await fillAnswers(page, 'uniform-bar');
  await field(page, 'tip-displacement').fill('1e309');
  await chooseConcept(page, 'not-proof');
  await page.locator('#practice-check').click();
  await expect(page.locator('[data-practice-result="tip-displacement"]')).toContainText(/有限|无法计算/);
  await expect(page.locator('#practice-feedback')).not.toContainText('全部参考对照相符');
});

test('scientific notation matches each case while keeping numerical comparison distinct from engineering validation', async ({ page }) => {
  await page.goto(PROJECT);
  await expect(page.locator('#practice-auth')).toContainText('匿名');
  for (const slug of SLUGS) {
    await fillAnswers(page, slug, slug === 'uniform-bar' ? 'none' : 'accept');
    await chooseConcept(page, 'not-proof');
    await page.locator('#practice-check').click();
    for (const quantity of QUANTITIES) {
      const result = page.locator(`[data-practice-result="${quantity}"]`);
      await expect(result).toContainText('在参考容差内');
      await expect(result).toContainText('绝对误差');
      await expect(result).toContainText('依据');
    }
    await expect(page.locator('[data-practice-concept-result]')).toContainText('选择相符');
    await expect(page.locator('#practice-feedback')).toContainText('全部参考对照相符');
    await expect(page.locator('#practice-feedback')).toContainText('并非工程验证完成');
    await expect(field(page, 'executor')).toHaveValue('未运行');
    await expect(field(page, 'reproduction')).toHaveValue('未运行');
  }
});

test('wrong answers have separate feedback, edits invalidate it, and dirty case switches require an explicit discard', async ({ page }) => {
  await page.goto(PROJECT);
  await fillAnswers(page, 'uniform-bar');
  await field(page, 'reaction-force').fill('10000');
  await chooseConcept(page, 'proof');
  await page.locator('#practice-check').click();
  await expect(page.locator('[data-practice-result="tip-displacement"]')).toContainText('在参考容差内');
  await expect(page.locator('[data-practice-result="reaction-force"]')).toContainText('超出参考容差');
  await expect(page.locator('[data-practice-concept-result]')).toContainText('需要修正理解');
  await expect(page.locator('[data-practice-concept-result]')).toContainText('平衡');
  await field(page, 'reaction-force').fill('-10000');
  await expect(page.locator('#practice-feedback')).toBeEmpty();
  await expect(page.locator('#practice-status')).toContainText('旧判定已清除');
  await chooseConcept(page, 'not-proof');
  await page.locator('#practice-check').click();
  await expect(page.locator('#practice-feedback')).toContainText('全部参考对照相符');
  await field(page, 'observation').fill('SYNTHETIC observation: no actual solver execution.');
  await expect(page.locator('#practice-feedback')).toBeEmpty();
  await field(page, 'evidence').fill('PRIVATE CASE SWITCH FIXTURE: preserve on cancel');
  await field(page, 'executor').selectOption('用户本机');
  await field(page, 'reproduction').selectOption('已运行待核对');
  await page.locator('#practice-check').click();
  await chooseCase(page, 'stepped-bar', 'cancel');
  await expect(field(page, 'caseSlug')).toHaveValue('uniform-bar');
  await expect(field(page, 'tip-displacement')).toHaveValue(ANSWERS['uniform-bar'][0]);
  await expect(field(page, 'reaction-force')).toHaveValue('-10000');
  await expect(field(page, 'strain-energy')).toHaveValue(ANSWERS['uniform-bar'][2]);
  await expect(field(page, 'observation')).toHaveValue('SYNTHETIC observation: no actual solver execution.');
  await expect(field(page, 'evidence')).toHaveValue('PRIVATE CASE SWITCH FIXTURE: preserve on cancel');
  await expect(field(page, 'executor')).toHaveValue('用户本机');
  await expect(field(page, 'reproduction')).toHaveValue('已运行待核对');
  await expect(page.locator('#practice-feedback')).toContainText('全部参考对照相符');
  await chooseCase(page, 'stepped-bar', 'accept');
  await expect(field(page, 'caseSlug')).toHaveValue('stepped-bar');
  for (const name of [...QUANTITIES, 'observation', 'evidence']) await expect(field(page, name)).toHaveValue('');
  await expect(field(page, 'executor')).toHaveValue('未运行');
  await expect(field(page, 'reproduction')).toHaveValue('未运行');
  await expect(page.locator('#practice-feedback')).toBeEmpty();
});

test('anonymous Markdown and JSON exports keep private observations in downloads without API mutations or local storage', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.url());
  });
  await page.addInitScript(() => {
    const writes: string[] = [];
    (window as unknown as { practiceStorageWrites: string[] }).practiceStorageWrites = writes;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === window.localStorage) writes.push(`${key}:${value}`);
      return original.call(this, key, value);
    };
  });
  await page.goto(PROJECT);
  await expect(page.locator('#practice-auth')).toContainText('匿名');
  await fillAnswers(page, 'uniform-bar');
  await chooseConcept(page, 'not-proof');
  await field(page, 'observation').fill('PRIVATE PRACTICE FIXTURE: pasted answers only, no solver execution.');
  await field(page, 'evidence').fill('PRIVATE EVIDENCE FIXTURE: no result file supplied.');
  await page.locator('#practice-check').click();
  const downloadingMd = page.waitForEvent('download');
  await page.locator('#practice-export-md').click();
  const mdDownload = await downloadingMd;
  expect(mdDownload.suggestedFilename()).toMatch(/\.md$/);
  const markdown = await downloadText(mdDownload);
  expect(markdown).toContain('PRIVATE PRACTICE FIXTURE');
  expect(markdown).toContain('不是求解器输出');
  expect(markdown).toContain('实际学习日期：未提供');
  const downloadingJson = page.waitForEvent('download');
  await page.locator('#practice-export-json').click();
  const json = JSON.parse(await downloadText(await downloadingJson));
  expect(Object.keys(json)).toEqual(['projectPractice']);
  expect(json.projectPractice.schemaVersion).toBe(1);
  expect(json.projectPractice.caseSlug).toBe('uniform-bar');
  expect(json.projectPractice.executor).toBe('未运行');
  expect(json.projectPractice.reproduction).toBe('未运行');
  expect(json.projectPractice.observation).toContain('PRIVATE PRACTICE FIXTURE');
  expect(json.projectPractice).not.toHaveProperty('passed');
  await expect(page.locator('#practice-status')).toContainText('导出不表示账户已保存');
  await page.locator('#practice-save').click();
  await expect(page.locator('#practice-status')).toContainText('请先登录');
  expect(mutations).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { practiceStorageWrites: string[] }).practiceStorageWrites)).toEqual([]);
  expect(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('PRIVATE PRACTICE FIXTURE') || value.includes('PRIVATE EVIDENCE FIXTURE')))).toBe(false);
});

test('URL prefills only select known cases, and malicious log text remains inert in feedback and exports', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const payload = '<img src=x onerror="window.practiceInjected=true"><script>window.practiceInjected=true</script>';
  const params = new URLSearchParams({ case: 'javascript:alert(1)', observation: payload, evidence: payload, executor: '用户本机', reproduction: '已复现', 'tip-displacement': '.476190476' });
  await page.goto(`${PROJECT}?${params}`);
  await expect(page.locator('#practice-auth')).toContainText('匿名');
  await expect(field(page, 'caseSlug')).toHaveValue('uniform-bar');
  for (const name of [...QUANTITIES, 'observation', 'evidence']) await expect(field(page, name)).toHaveValue('');
  await expect(field(page, 'executor')).toHaveValue('未运行');
  await expect(field(page, 'reproduction')).toHaveValue('未运行');
  await page.goto(`${PROJECT}?case=cantilever-beam`);
  await expect(page.locator('#practice-auth')).toContainText('匿名');
  await expect(field(page, 'caseSlug')).toHaveValue('cantilever-beam');
  await field(page, 'observation').fill(payload);
  await field(page, 'evidence').fill(payload);
  await page.locator('#practice-check').click();
  await expect(field(page, 'observation')).toHaveValue(payload);
  await expect(page.locator('#practice-feedback img, #practice-feedback script')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { practiceInjected?: boolean }).practiceInjected)).toBeUndefined();
  const downloading = page.waitForEvent('download');
  await page.locator('#practice-export-json').click();
  const json = JSON.parse(await downloadText(await downloading));
  expect(json.projectPractice.observation).toBe(payload);
  expect(json.projectPractice.evidence).toBe(payload);
  expect(errors).toEqual([]);
});

test('a local account saves and reloads revisions with fresh feedback while the record stays private and not-started', async ({ page, request, context, baseURL }) => {
  await page.unroute('**/api/auth/me');
  await page.unroute('**/api/auth/csrf-token');
  const csrfResponse = await request.get('/api/auth/csrf-token');
  expect(csrfResponse.ok()).toBe(true);
  const { token } = await csrfResponse.json();
  const registration = await request.post('/api/auth/email/register', {
    headers: { 'X-CSRF-Token': token },
    data: { email: `linear-static-${crypto.randomUUID()}@example.invalid`, password: 'local-acceptance-only', name: '本地项目验收账户' },
  });
  expect(registration.status()).toBe(200);
  const { user } = await registration.json();
  const cookie = registration.headers()['set-cookie'].split(';')[0];
  const separator = cookie.indexOf('=');
  // Explicit loopback test session only; production's Secure cookie stays intact.
  await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: baseURL!, httpOnly: true, secure: false, sameSite: 'Lax' }]);
  await page.goto(`${PROJECT}?case=uniform-bar`);
  await expect(page.locator('#practice-auth')).toContainText('账户已连接');
  await fillAnswers(page, 'uniform-bar');
  await chooseConcept(page, 'not-proof');
  await field(page, 'observation').fill('PRIVATE LOCAL PROJECT FIXTURE: no learner solver run.');
  await page.locator('#practice-check').click();
  await expect(page.locator('#practice-feedback')).toContainText('全部参考对照相符');
  const creating = page.waitForResponse(response => new URL(response.url()).pathname === '/api/study/items' && response.request().method() === 'POST');
  await page.locator('#practice-save').click();
  const created = await creating;
  expect(created.status()).toBe(201);
  const saved = (await created.json()).item;
  expect(saved.visibility).toBe('private');
  expect(saved.reviewStatus).toBe('draft');
  expect(saved.learningStatus).toBe('not-started');
  expect(saved.fields.recordType).toBe('项目练习');
  expect(JSON.parse(saved.fields.raw).projectPractice).not.toHaveProperty('passed');
  await expect(page.locator('#practice-status')).toContainText('修订 1');
  expect(new URL(page.url()).searchParams.get('id')).toBe(saved.id);
  await page.reload();
  await expect(page.locator('#practice-status')).toContainText('已读取私人练习 · 修订 1');
  await expect(page.locator('#practice-feedback')).toContainText('全部参考对照相符');
  await expect(field(page, 'executor')).toHaveValue('未运行');
  await expect(field(page, 'reproduction')).toHaveValue('未运行');
  await expect(page.locator('#practice-records')).toHaveAttribute('href', `/learning/records/?id=${saved.id}`);
  await field(page, 'evidence').fill('PRIVATE LOCAL EVIDENCE: synthetic browser persistence check only.');
  await expect(page.locator('#practice-feedback')).toBeEmpty();
  const updating = page.waitForResponse(response => new URL(response.url()).pathname === `/api/study/items/${saved.id}` && response.request().method() === 'PUT');
  await page.locator('#practice-save').click();
  expect((await updating).status()).toBe(200);
  await expect(page.locator('#practice-status')).toContainText('修订 2');
  await page.reload();
  await expect(page.locator('#practice-status')).toContainText('已读取私人练习 · 修订 2');
  await expect(field(page, 'evidence')).toHaveValue('PRIVATE LOCAL EVIDENCE: synthetic browser persistence check only.');
  await expect(page.locator('#practice-feedback')).toContainText('全部参考对照相符');
  const headers = { Cookie: cookie };
  const latestResponse = await request.get(`/api/study/items/${saved.id}`, { headers });
  expect(latestResponse.status()).toBe(200);
  const latest = (await latestResponse.json()).item;
  expect(latest.revision).toBe(2);
  expect(latest.visibility).toBe('private');
  expect(latest.reviewStatus).toBe('draft');
  expect(latest.learningStatus).toBe('not-started');
  const history = await request.get(`/api/study/items/${saved.id}/history`, { headers });
  expect((await history.json()).versions.map((version: { revision: number }) => version.revision)).toEqual([2, 1]);
  const publicResponse = await request.get(`/api/study/public/${user.userId}/${saved.id}`);
  expect(publicResponse.status()).toBe(404);
  expect(await publicResponse.text()).not.toContain('PRIVATE LOCAL PROJECT FIXTURE');

  // A clean switch starts a different document. Old answers, evidence and record
  // identity must never become a submission for the newly selected benchmark.
  await chooseCase(page, 'stepped-bar');
  await expect(field(page, 'caseSlug')).toHaveValue('stepped-bar');
  for (const name of [...QUANTITIES, 'observation', 'evidence']) await expect(field(page, name)).toHaveValue('');
  await expect(field(page, 'executor')).toHaveValue('未运行');
  await expect(field(page, 'reproduction')).toHaveValue('未运行');
  await expect(page.locator('#practice-feedback')).toBeEmpty();
  expect(new URL(page.url()).searchParams.get('id')).toBeNull();
  expect(new URL(page.url()).searchParams.get('case')).toBe('stepped-bar');
  await expect(page.locator('#practice-records')).toHaveAttribute('href', '/learning/records/');
  const creatingNext = page.waitForResponse(response => new URL(response.url()).pathname === '/api/study/items' && response.request().method() === 'POST');
  await page.locator('#practice-save').click();
  const nextResponse = await creatingNext;
  expect(nextResponse.status()).toBe(201);
  const next = (await nextResponse.json()).item;
  expect(next.id).not.toBe(saved.id);
  expect(next.revision).toBe(1);
  expect(next.visibility).toBe('private');
  expect(next.reviewStatus).toBe('draft');
  expect(next.learningStatus).toBe('not-started');
  const nextPractice = JSON.parse(next.fields.raw).projectPractice;
  expect(nextPractice.caseSlug).toBe('stepped-bar');
  expect(nextPractice.answers).toEqual(Object.fromEntries(QUANTITIES.map(id => [id, ''])));
  expect(nextPractice.concept).toBe('');
  expect(nextPractice.observation).toBe('');
  expect(nextPractice.evidence).toBe('');
  expect(nextPractice.executor).toBe('未运行');
  expect(nextPractice.reproduction).toBe('未运行');
  await expect(page.locator('#practice-status')).toContainText('修订 1');
  expect(new URL(page.url()).searchParams.get('id')).toBe(next.id);
  const originalResponse = await request.get(`/api/study/items/${saved.id}`, { headers });
  expect(originalResponse.status()).toBe(200);
  const original = (await originalResponse.json()).item;
  expect(original.revision).toBe(2);
  const originalPractice = JSON.parse(original.fields.raw).projectPractice;
  expect(originalPractice.caseSlug).toBe('uniform-bar');
  expect(originalPractice.answers['tip-displacement']).toBe(ANSWERS['uniform-bar'][0]);
  expect(originalPractice.evidence).toBe('PRIVATE LOCAL EVIDENCE: synthetic browser persistence check only.');
  await page.goto(`/learning/records/?id=${next.id}`);
  await expect(page.locator('#study-save-state')).toContainText('修订 1');
  await expect(page.locator('[name="field:recordType"]')).toHaveValue('项目练习');
  await expect(page.locator('[name="field:project"]')).toHaveValue('线性静力验证项目');
  await expect(page.locator('[name="field:executor"]')).toHaveValue('未运行');
});

test('a 409 conflict preserves all edited answers and evidence for JSON export', async ({ page }) => {
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: { userId: 'local-project-conflict' } } }));
  await page.route('**/api/study/items?*', route => route.fulfill({ json: { ok: true, items: [] } }));
  const id = 'record-12345678-1234-4123-8123-123456789abc';
  await page.route('**/api/study/items', async route => {
    expect(route.request().method()).toBe('POST');
    const item = { ...route.request().postDataJSON().item, id, revision: 1, createdAt: '2026-10-25T01:00:00Z', updatedAt: '2026-10-25T01:00:00Z' };
    await route.fulfill({ status: 201, json: { ok: true, item } });
  });
  await page.route(`**/api/study/items/${id}`, route => route.fulfill({ status: 409, json: { ok: false, error: 'synthetic revision conflict' } }));
  await page.goto(PROJECT);
  await expect(page.locator('#practice-auth')).toContainText('账户已连接');
  await fillAnswers(page, 'uniform-bar');
  await chooseConcept(page, 'not-proof');
  await page.locator('#practice-save').click();
  await expect(page.locator('#practice-status')).toContainText('修订 1');
  await field(page, 'tip-displacement').fill('.47');
  await field(page, 'observation').fill('尚未合并的本页观察。');
  await field(page, 'evidence').fill('PRIVATE CONFLICT PROJECT FIXTURE');
  await page.locator('#practice-save').click();
  await expect(page.locator('#practice-status')).toContainText('保存冲突');
  await expect(page.locator('#practice-status')).toContainText('完整保留');
  await expect(field(page, 'tip-displacement')).toHaveValue('.47');
  await expect(field(page, 'observation')).toHaveValue('尚未合并的本页观察。');
  await expect(field(page, 'evidence')).toHaveValue('PRIVATE CONFLICT PROJECT FIXTURE');
  await expect(page.locator('#practice-save')).toBeEnabled();
  const downloading = page.waitForEvent('download');
  await page.locator('#practice-export-json').click();
  const exported = JSON.parse(await downloadText(await downloading));
  expect(exported.projectPractice.answers['tip-displacement']).toBe('.47');
  expect(exported.projectPractice.observation).toBe('尚未合并的本页观察。');
  expect(exported.projectPractice.evidence).toBe('PRIVATE CONFLICT PROJECT FIXTURE');
});

test('all benchmark details and the practice editor fit a 390px dark viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const path of [...SLUGS.map(slug => `/cases/benchmarks/${slug}/`), PROJECT]) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (path === PROJECT) {
      await expect(page.locator('#practice-auth')).toContainText('匿名');
      await fillAnswers(page, 'cantilever-beam');
      await chooseConcept(page, 'not-proof');
      await field(page, 'observation').fill('long-unbroken-synthetic-observation-'.repeat(10));
      await page.locator('#practice-check').click();
      await expect(page.locator('#practice-feedback')).toContainText('全部参考对照相符');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  expect(errors).toEqual([]);
});
