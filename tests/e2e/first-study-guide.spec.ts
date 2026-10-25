import { expect, test, type Download, type Page } from '@playwright/test';

const guidePath = '/learning/start/';
const fields = ['prediction', 'pythonObservation', 'assemblyObservation', 'evidenceObservation'] as const;
const steps = ['predict', 'python', 'assembly', 'evidence'] as const;
const privateText = 'PRIVATE FIRST STUDY FIXTURE: 尚未运行，记录真实受阻原因。';
test.beforeEach(async ({ context, baseURL }) => {
  const url = baseURL ? new URL(baseURL) : null;
  test.skip(!url || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'First-study acceptance stays on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
});
async function downloadText(download: Download) {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
async function exported(page: Page) {
  const downloading = page.waitForEvent('download'); await page.locator('#first-study-export-json').click();
  return JSON.parse(await downloadText(await downloading));
}
async function recordFourSteps(page: Page) {
  for (let index = 0; index < fields.length; index++) {
    await page.locator(`#first-${fields[index]}`).fill(`${privateText} ${index + 1}`);
    await page.locator(`#first-check-${steps[index]}`).check();
  }
}

test('four fixed links preserve the current draft and visiting never runs code, saves progress or silently checks steps', async ({ page, context }) => {
  const mutations: string[] = []; const runtimes: string[] = [];
  context.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(path);
    if (path.startsWith('/vendor/pyodide/')) runtimes.push(path);
  });
  await page.goto(guidePath);
  await expect(page.locator('#first-study-count')).toHaveText('0 / 4 步已自行确认');
  await expect(page.locator('[data-guide-check]:checked')).toHaveCount(0);
  const links = {
    python: '/labs/python/?template=bar', assembly: '/labs/assembly/',
    project: '/learning/projects/linear-static/?case=uniform-bar#project-practice',
    feedback: '/learning/activity/?task=first-study&contentVersion=first-study-v1',
  };
  for (const [name, href] of Object.entries(links)) {
    await expect(page.locator(`[data-guide-link="${name}"]`)).toHaveAttribute('href', href);
    await expect(page.locator(`[data-guide-link="${name}"]`)).toHaveAttribute('target', '_blank');
    await expect(page.locator(`[data-guide-link="${name}"]`)).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await page.locator('#first-prediction').fill(privateText);
  const popupPromise = page.waitForEvent('popup'); await page.locator('[data-guide-link="python"]').click();
  const lab = await popupPromise; await lab.waitForLoadState('domcontentloaded');
  await expect(lab.locator('#lab-template')).toHaveValue('bar');
  await expect(lab.locator('[data-lab-status]')).toContainText('尚未加载 Python 或运行代码');
  await expect(lab.locator('[data-lab-export="result"]')).toBeDisabled();
  await expect(page.locator('#first-prediction')).toHaveValue(privateText);
  expect(runtimes).toEqual([]); expect(mutations).toEqual([]);
});

test('exports an unfinished private draft with unknown execution and manual confirmations, without persisting its text', async ({ page }) => {
  await page.goto(guidePath);
  await page.locator('#first-prediction').fill(privateText);
  const draft = await exported(page);
  expect(draft).toMatchObject({ schemaVersion: 1, guideVersion: 'first-study-v1', startedAt: null, finishedAt: null, sessionStatus: 'in-progress', learningCompletion: 'not-assessed', reviewStatus: 'draft-pending-human-review', environment: { status: 'not-provided' }, executionEvidence: { status: 'not-verified-by-guide' } });
  expect(draft).not.toHaveProperty('completion');
  expect(draft.fields.prediction).toBe(privateText);
  expect(draft.declarations.predict).toEqual({ selfReported: false, declaredAt: null });
  expect(draft).not.toHaveProperty('passed'); expect(draft).not.toHaveProperty('learningStatus'); expect(draft).not.toHaveProperty('userId');
  expect(draft.fixedCase.inputs).toMatchObject({ E: { value: 210000 }, A: { value: 100 }, L: { value: 1000 }, P: { value: 10000 } });
  expect(await page.evaluate(text => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(value => value.includes(text)), privateText)).toBe(false);
  await page.reload(); await expect(page.locator('#first-prediction')).toHaveValue('');
  const reloaded = await exported(page); expect(reloaded.startedAt).toBeNull(); expect(reloaded.fields.prediction).toBe('');
});

test('explicit start and four self-reports can finish, while editing revokes stale declaration and clear resets all times', async ({ page }) => {
  await page.goto(guidePath);
  await page.locator('#first-check-predict').click();
  await expect(page.locator('#first-check-predict')).not.toBeChecked();
  await expect(page.locator('#first-study-status')).toContainText('请先写下');
  await page.locator('#first-study-finish').click();
  await expect(page.locator('#first-study-status')).toContainText('请先记录并自行确认四步');
  await page.locator('#first-study-start').click();
  await recordFourSteps(page);
  await expect(page.locator('#first-study-count')).toHaveText('4 / 4 步已自行确认');
  await page.locator('#first-study-finish').click(); await expect(page.locator('#first-study-finish')).toBeDisabled();
  const finished = await exported(page);
  expect(Number.isFinite(Date.parse(finished.startedAt))).toBe(true); expect(Number.isFinite(Date.parse(finished.finishedAt))).toBe(true);
  expect(finished.sessionStatus).toBe('ended'); expect(finished.learningCompletion).toBe('not-assessed'); expect(finished.executionEvidence.status).toBe('not-verified-by-guide');
  expect(finished).not.toHaveProperty('completion');
  expect(Object.values(finished.declarations).every((value: any) => value.selfReported && Number.isFinite(Date.parse(value.declaredAt)))).toBe(true);
  await page.locator('#first-assemblyObservation').fill('修改：仍未实际求解。');
  await expect(page.locator('#first-check-assembly')).not.toBeChecked(); await expect(page.locator('#first-study-finish')).toBeEnabled();
  const changed = await exported(page);
  expect(changed.finishedAt).toBeNull(); expect(changed.declarations.assembly).toEqual({ selfReported: false, declaredAt: null });
  expect(changed.startedAt).toBe(finished.startedAt);
  await page.locator('#first-study-clear').click();
  await expect(page.locator('[data-guide-check]:checked')).toHaveCount(0);
  const cleared = await exported(page);
  expect(cleared.startedAt).toBeNull(); expect(cleared.finishedAt).toBeNull();
  expect(Object.values(cleared.fields).every(text => text === '')).toBe(true);
  expect(Object.values(cleared.declarations).every((value: any) => !value.selfReported && value.declaredAt === null)).toBe(true);
});

test('Markdown export keeps hostile-looking user text as plain text and cannot change the displayed page', async ({ page }) => {
  await page.goto(guidePath);
  const note = '# forged heading\n```\n<img src=x onerror="window.firstStudyInjected=true">';
  await page.locator('#first-prediction').fill(note);
  await page.locator('#first-environment').fill('本人自述：尚未执行。');
  const downloading = page.waitForEvent('download'); await page.locator('#first-study-export-md').click();
  const download = await downloading; expect(download.suggestedFilename()).toBe('simulearn-first-study.md');
  const text = await downloadText(download);
  expect(text).toContain('    # forged heading\n    ```\n    <img src=x onerror="window.firstStudyInjected=true">');
  expect(text).toContain('    本人自述：尚未执行。');
  await expect(page.locator('#first-study-form img, #first-study-form script')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { firstStudyInjected?: boolean }).firstStudyInjected)).toBeUndefined();
});

test('mobile dark mode works with denied local storage and keeps the guide within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Denied', 'SecurityError'); };
    Storage.prototype.getItem = () => { throw new DOMException('Denied', 'SecurityError'); };
  });
  await page.goto(guidePath);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.locator('#first-prediction').fill(privateText); await page.locator('#first-check-predict').check();
  await expect(page.locator('#first-study-count')).toHaveText('1 / 4 步已自行确认');
  const draft = await exported(page); expect(draft.fields.prediction).toBe(privateText);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const field of fields) await expect(page.locator(`#first-${field}`)).toHaveAttribute('maxlength', '2000');
});
