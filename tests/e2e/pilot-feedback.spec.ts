import { expect, test, type Download, type Page } from '@playwright/test';

const ACTIVITY = '/learning/activity/';
const KEY = 'simulearn-learning-activity-v1';

// Synthetic loopback acceptance only; the exported feedback is not a real trial participant's report.
test.beforeEach(async ({ context, baseURL }) => {
  const url = baseURL ? new URL(baseURL) : null;
  test.skip(!url || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Feedback tests stay on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
});

async function exported(download: Download) {
  expect(download.suggestedFilename()).toBe('simulearn-pilot-feedback.json');
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function exportForm(page: Page) {
  const downloading = page.waitForEvent('download');
  await page.locator('#pilot-feedback').getByRole('button', { name: '导出反馈 JSON' }).click();
  return exported(await downloading);
}

test('guide feedback binds the known version while every other query value stays outside the form and export', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.url()); });
  await page.goto(`${ACTIVITY}?task=first-study&contentVersion=first-study-v1&notes=PRIVATE_QUERY_NOTES&userId=PRIVATE_QUERY_USER&durationMinutes=123&id=PRIVATE_RECORD`);
  const form = page.locator('#pilot-feedback');
  await expect(form.locator('[name="task"]')).toHaveValue('first-study');
  await expect(form.locator('[name="contentVersion"]')).toHaveValue('first-study-v1');
  await expect(form.locator('[name="contentVersion"]')).toHaveAttribute('readonly', '');
  await expect(form.locator('[name="notes"]')).toHaveValue('');
  await expect(form.locator('[name="durationMinutes"]')).toHaveValue('');
  const feedback = await exportForm(page);
  expect(feedback).toMatchObject({ version: 1, task: 'first-study', contentVersion: 'first-study-v1', selfReported: 'not-provided', difficulty: 'not-provided', notes: '', startPoint: null, firstResult: null, stoppedAtStep: null, intendedNext: null, durationMinutes: null });
  expect(JSON.stringify(feedback)).not.toContain('PRIVATE_');
  expect(Number.isFinite(Date.parse(feedback.recordedAt))).toBe(true);
  expect(feedback.scope).toContain('记录时间仅表示导出时间');
  for (const name of ['userId', 'id', 'url', 'passed', 'mastered', 'firstOutputAt', 'startedAt', 'completedAt']) expect(feedback).not.toHaveProperty(name);
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull();
  expect(mutations).toEqual([]);
});

test('changing tasks updates the version and exports exact explicit observations without saving or sending the private text', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.url()); });
  await page.goto(`${ACTIVITY}?task=first-study&contentVersion=first-study-v1`);
  const form = page.locator('#pilot-feedback');
  await form.locator('[name="task"]').selectOption('assembly');
  await expect(form.locator('[name="contentVersion"]')).toHaveValue('labs-v1');
  await form.locator('[name="selfReported"]').selectOption('unfinished');
  await form.locator('[name="difficulty"]').selectOption('4');
  await form.locator('[name="startPoint"]').selectOption('tutorial');
  await form.locator('[name="firstResult"]').selectOption('has-output');
  await form.locator('[name="stoppedAtStep"]').selectOption('assembly');
  await form.locator('[name="intendedNext"]').selectOption('check-source');
  await form.locator('[name="durationMinutes"]').fill('12.5');
  const notes = '  PRIVATE_FORM_NOTES：已看到输出，仍未核对约束。\n<img src=x onerror="window.feedbackInjected=true">  ';
  await form.locator('[name="notes"]').fill(notes);
  const feedback = await exportForm(page);
  expect(feedback).toMatchObject({ task: 'assembly', contentVersion: 'labs-v1', selfReported: 'unfinished', difficulty: '4', startPoint: 'tutorial', firstResult: 'has-output', stoppedAtStep: 'assembly', intendedNext: 'check-source', durationMinutes: 12.5, notes });
  expect(feedback).not.toHaveProperty('completed');
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull();
  expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(value => value.includes('PRIVATE_FORM_NOTES')))).toBe(false);
  await expect(form.locator('img,script')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { feedbackInjected?: boolean }).feedbackInjected)).toBeUndefined();
  await expect(page.locator('#pilot-feedback-status')).toContainText('已导出');
  await page.reload();
  await expect(page.locator('#pilot-feedback [name="notes"]')).toHaveValue('');
  expect(mutations).toEqual([]);
});

test('tampered content versions and oversized notes fail the whole export without silently shortening the original text', async ({ page }) => {
  let downloads = 0; page.on('download', () => downloads++);
  await page.goto(ACTIVITY);
  const form = page.locator('#pilot-feedback');
  await form.locator('[name="contentVersion"]').evaluate((element: HTMLInputElement) => { element.value = 'PRIVATE_UNSUPPORTED_VERSION'; });
  await form.getByRole('button', { name: '导出反馈 JSON' }).click();
  await expect(page.locator('#pilot-feedback-status')).toContainText('任务与内容版本不匹配');
  expect(downloads).toBe(0);
  await form.locator('[name="task"]').selectOption('python');
  await expect(form.locator('[name="contentVersion"]')).toHaveValue('labs-v1');
  const tooLong = '中'.repeat(2001);
  await form.locator('[name="notes"]').evaluate((element: HTMLTextAreaElement, value) => { element.value = value; }, tooLong);
  // Simulate malformed DOM input that bypasses the browser's maxlength UI; application validation must still reject it.
  await form.evaluate(element => element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await expect(page.locator('#pilot-feedback-status')).toContainText('未截断或导出');
  await expect(form.locator('[name="notes"]')).toHaveValue(tooLong);
  expect(downloads).toBe(0);
});

test('unknown or duplicate query versions cannot prefill feedback and feedback remains usable with browser storage denied', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Synthetic storage denial', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Synthetic storage denial', 'SecurityError'); };
  });
  for (const query of ['task=first-study&contentVersion=PRIVATE_BAD_VERSION', 'task=first-study&task=first-study&contentVersion=first-study-v1']) {
    await page.goto(`${ACTIVITY}?${query}&notes=PRIVATE_QUERY_TEXT`);
    const form = page.locator('#pilot-feedback');
    await expect(form.locator('[name="task"]')).toHaveValue('linear-static');
    await expect(form.locator('[name="contentVersion"]')).toHaveValue('linear-static-v1');
    await expect(form.locator('[name="notes"]')).toHaveValue('');
    const feedback = await exportForm(page);
    expect(feedback).toMatchObject({ task: 'linear-static', contentVersion: 'linear-static-v1', notes: '' });
    expect(JSON.stringify(feedback)).not.toContain('PRIVATE_');
    await expect(page.locator('#activity-toggle')).toBeDisabled();
  }
});
