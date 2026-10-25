import { expect, test, type Download, type Page } from '@playwright/test';

const LAB = '/labs/python/';
const VERSION = '314.0.7';
// Synthetic local account only; Python and its actual outputs are never mocked.
const account = { ok: true, user: { userId: 'python-lab-local-fixture', name: 'Local acceptance', email: 'python-lab@example.invalid', authMethod: 'email' } };

test.beforeEach(async ({ page, baseURL }) => {
  const target = baseURL ? new URL(baseURL) : null;
  test.skip(!target || target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Python acceptance fixtures may run only against a local Worker.');
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  await page.route('**/api/auth/csrf-token', route => route.fulfill({ json: { ok: true, token: 'local-python-lab-only' } }));
});

async function signedIn(page: Page) {
  await page.route('**/api/auth/me', route => route.fulfill({ json: account }));
}
async function start(page: Page, terminal: 'succeeded' | 'error' | 'timeout' = 'succeeded') {
  await page.locator('[data-lab-run]').click();
  await expect(page.locator('[data-python-lab]')).toHaveAttribute('data-lab-state', terminal, { timeout: 55_000 });
}
async function downloadText(download: Download) {
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('anonymous editing and export work without requesting a Python runtime or claiming execution', async ({ page }) => {
  const assets: string[] = [];
  page.on('request', request => { if (request.url().includes('/vendor/pyodide/')) assets.push(request.url()); });
  await page.goto(LAB);
  await page.locator('#lab-code').fill('print(2 + 2)\n');
  await page.locator('[data-lab-run]').click();
  await expect(page.locator('[data-python-lab]')).toHaveAttribute('data-lab-state', 'anonymous');
  await expect(page.locator('[data-lab-status]')).toContainText('尚未执行');
  await expect(page.locator('[data-lab-environment]')).toHaveText('尚未加载运行环境');
  await expect(page.locator('[data-lab-login]')).toBeVisible();
  await expect(page.locator('[data-lab-export="result"]')).toBeDisabled();
  expect(assets).toEqual([]);
  const exported = page.waitForEvent('download');
  await page.locator('[data-lab-export="code"]').click();
  const file = await exported;
  expect(file.suggestedFilename()).toBe('csv_check.py');
  expect(await downloadText(file)).toBe('print(2 + 2)\n');
  await page.reload();
  await expect(page.locator('#lab-code')).not.toHaveValue('print(2 + 2)\n');
});

test('real Python arithmetic, partial stdout, stderr and input snapshots export with actual environment', async ({ page }) => {
  test.setTimeout(65_000);
  await signedIn(page);
  await page.addInitScript(() => {
    (window as unknown as { labActivities: unknown[] }).labActivities = [];
    window.addEventListener('simulearn:activity', event => (window as unknown as { labActivities: unknown[] }).labActivities.push((event as CustomEvent).detail));
  });
  const posts: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET' && request.method() !== 'HEAD') posts.push(request.url()); });
  await page.goto(LAB);
  const code = 'import sys\nprint(2 + 2, end="")\nprint("error-channel", file=sys.stderr)\nprint(input_text)\n2 + 2';
  const input = 'not executable: __import__("os").getcwd()';
  await page.locator('#lab-code').fill(code);
  await page.locator('#lab-input').fill(input);
  await start(page);
  await expect(page.locator('[data-lab-stdout]')).toHaveText(`4${input}\n`);
  await expect(page.locator('[data-lab-stderr]')).toContainText('error-channel');
  await expect(page.locator('[data-lab-value]')).toHaveText('表达式返回值：4');
  await expect(page.locator('[data-lab-environment]')).toContainText('CPython 3.14.2');
  await expect(page.locator('[data-lab-environment]')).toContainText(`Pyodide ${VERSION}`);
  await expect(page.locator('[data-lab-environment]')).toContainText('WebWorker');
  const exported = page.waitForEvent('download');
  await page.locator('[data-lab-export="result"]').click();
  const result = JSON.parse(await downloadText(await exported));
  expect(result).toMatchObject({ state: 'succeeded', executor: '用户当前浏览器 WebWorker', code, input, stdout: `4${input}\n`, value: '4' });
  expect(result.environment).toContain('CPython 3.14.2');
  expect(Date.parse(result.finishedAt)).toBeGreaterThanOrEqual(Date.parse(result.startedAt));
  expect(result.elapsedMs).toBeGreaterThan(0);
  expect(result.limitation).toContain('不证明用户本机复现');
  expect(posts).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { labActivities: unknown[] }).labActivities)).toEqual([{ kind: 'reference-run', page: 'python' }]);

  // A real Python write fills the display cap exactly, then writes another line.
  // Both the page and exported snapshot must disclose that text was discarded.
  const boundaryCode = 'print("x" * 31999)\nprint("TAIL")\n"y" * 4100';
  await page.locator('#lab-code').fill(boundaryCode);
  await start(page);
  const boundaryOutput = (await page.locator('[data-lab-stdout]').textContent())!;
  expect(boundaryOutput).toHaveLength(32_000);
  expect(boundaryOutput.endsWith('\n[输出达到上限，已截断]')).toBe(true);
  expect(boundaryOutput).not.toContain('TAIL');
  const boundaryDownload = page.waitForEvent('download');
  await page.locator('[data-lab-export="result"]').click();
  const boundaryResult = JSON.parse(await downloadText(await boundaryDownload));
  expect(boundaryResult).toMatchObject({ state: 'succeeded', code: boundaryCode, input, stdout: boundaryOutput });
  expect(boundaryResult.value).toHaveLength(4_000);
  expect(boundaryResult.value.endsWith('\n[表达式返回值达到上限，已截断]')).toBe(true);
  await expect(page.locator('[data-lab-value]')).toHaveText(`表达式返回值：${boundaryResult.value}`);
  expect(boundaryResult.environment).toContain('CPython 3.14.2');
});

test('the real CSV template checks actual rows and the axial template calculates signed results', async ({ page }) => {
  test.setTimeout(95_000);
  await signedIn(page); await page.goto(LAB);
  await start(page);
  await expect(page.locator('[data-lab-stdout]')).toContainText('读取 4 行；检查发现 0 项问题');
  const csv = await page.locator('#lab-input').inputValue();
  await page.locator('#lab-input').fill(csv.replace('A,100,', 'A,abc,'));
  await start(page);
  await expect(page.locator('[data-lab-stdout]')).toContainText("第 3 行: value='abc' 无法解析为有限数值");
  await page.locator('#lab-template').selectOption('bar');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-lab-load-template]').click();
  await expect(page.locator('[data-lab-template-description]')).toContainText('不组装有限元');
  await start(page);
  await expect(page.locator('[data-lab-stdout]')).toContainText('端位移 = 0.476190476 mm');
  await expect(page.locator('[data-lab-stdout]')).toContainText('左端反力 = -10000.000000 N');
  await expect(page.locator('[data-lab-stdout]')).toContainText('应变能 = 2380.952381 N·mm');
  await expect(page.locator('[data-lab-stdout]')).toContainText('非 CAE 求解');
});

test('real Python exceptions remain errors, and stopping an infinite loop permits a clean next run', async ({ page }) => {
  test.setTimeout(95_000);
  await page.addInitScript(() => {
    (window as unknown as { labActivities: unknown[] }).labActivities = [];
    window.addEventListener('simulearn:activity', event => (window as unknown as { labActivities: unknown[] }).labActivities.push((event as CustomEvent).detail));
  });
  await signedIn(page); await page.goto(LAB);
  await page.locator('#lab-code').fill('print("before-error")\n1 / 0');
  await start(page, 'error');
  await expect(page.locator('[data-lab-stderr]')).toContainText('ZeroDivisionError');
  await expect(page.locator('[data-lab-stdout]')).toContainText('before-error');
  await page.locator('#lab-code').fill('persistent_value = 123\nwhile True:\n    pass');
  await page.locator('[data-lab-run]').click();
  await expect(page.locator('[data-python-lab]')).toHaveAttribute('data-lab-state', 'running', { timeout: 55_000 });
  await page.locator('[data-lab-stop]').click();
  await expect(page.locator('[data-python-lab]')).toHaveAttribute('data-lab-state', 'stopped');
  await expect(page.locator('[data-lab-status]')).toContainText('本次执行未完成');
  await expect(page.locator('[data-lab-run]')).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as { labActivities: unknown[] }).labActivities)).toEqual([]);
  await page.locator('#lab-code').fill('print("fresh", "persistent_value" not in globals())\nprint(2 + 2)');
  await start(page);
  await expect(page.locator('[data-lab-stdout]')).toContainText('fresh True\n4');
});

test('the real infinite loop reaches the execution deadline rather than freezing the page', async ({ page }) => {
  test.setTimeout(70_000);
  await signedIn(page); await page.goto(LAB);
  await page.locator('#lab-code').fill('while True:\n    pass');
  await start(page, 'timeout');
  await expect(page.locator('[data-lab-status]')).toContainText('执行超过 8 秒');
  await expect(page.locator('[data-lab-run]')).toBeEnabled();
  await expect(page.locator('[data-lab-stop]')).toBeDisabled();
  const exported = page.waitForEvent('download');
  await page.locator('[data-lab-export="result"]').click();
  expect(JSON.parse(await downloadText(await exported)).state).toBe('timeout');
});

test('login service and runtime download failures stay honest and offer a local fallback', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 503, json: { ok: false } }));
  const requested: string[] = [];
  page.on('request', request => { if (request.url().includes('/vendor/pyodide/')) requested.push(request.url()); });
  await page.goto(LAB); await page.locator('[data-lab-run]').click();
  await expect(page.locator('[data-python-lab]')).toHaveAttribute('data-lab-state', 'auth-error');
  await expect(page.locator('[data-lab-fallback]')).toBeVisible();
  expect(requested).toEqual([]);
  await signedIn(page);
  await page.route(`**/vendor/pyodide/${VERSION}/pyodide.mjs`, route => route.abort());
  await start(page, 'error');
  await expect(page.locator('[data-lab-status]')).toContainText('环境加载失败');
  await expect(page.locator('[data-lab-environment]')).toHaveText('尚未加载运行环境');
  await expect(page.locator('[data-lab-fallback] a[download]')).toHaveAttribute('href', '/downloads/python-lab/python-lab.zip');
});

test('network bridges are unavailable to ordinary Python, and mobile dark mode works with storage disabled', async ({ page }) => {
  test.setTimeout(65_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value: () => { throw new Error('storage disabled for test'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value: () => { throw new Error('storage disabled for test'); } });
  });
  await signedIn(page); await page.goto(LAB);
  await page.locator('#lab-code').fill('import js\nprint("fetch visible:", hasattr(js, "fetch"))\nprint(2 + 2)');
  await start(page);
  await expect(page.locator('[data-lab-stdout]')).toContainText('fetch visible: False\n4');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#python-workbench').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/python-lab-mobile-dark.png', fullPage: true });
});
