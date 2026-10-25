import { expect, test, type Download } from '@playwright/test';

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('all four published CSV cases run the actual Python checker and export their distinct observed outcomes', async ({ page, context, request, baseURL }) => {
  test.setTimeout(120_000);
  test.skip(!baseURL?.startsWith('http://127.0.0.1:'), 'Real runtime acceptance with synthetic identity stays on loopback.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: { userId: 'local-csv-browser-acceptance' } } }));
  const mutations: string[] = [];
  context.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.url()); });
  const expected = [
    { id: 'normal', state: 'succeeded', stdout: '读取 4 行；检查发现 0 项问题', stderr: '' },
    { id: 'missing-field', state: 'error', stdout: '', stderr: '缺少表头: unit' },
    { id: 'non-numeric', state: 'succeeded', stdout: "第 3 行: value='abc' 无法解析为有限数值", stderr: '' },
    { id: 'missing-unit', state: 'succeeded', stdout: "第 2 行: 单位 '' 不符合本练习约定", stderr: '' },
  ];
  const codeResponse = await request.get('/downloads/python-lab/csv_check.py'); expect(codeResponse.ok()).toBe(true);
  const actualCode = await codeResponse.text();
  for (const item of expected) {
    const inputResponse = await request.get(`/downloads/csv-checker/${item.id}.csv`); expect(inputResponse.ok()).toBe(true);
    const actualInput = await inputResponse.text();
    await page.goto(`/labs/python/?template=csv&case=${item.id}`);
    await expect(page.locator('[data-lab-project-case]')).toHaveAttribute('data-case-state', 'original');
    await expect(page.locator('[data-lab-export="result"]')).toBeDisabled();
    await page.locator('[data-lab-run]').click();
    await expect(page.locator('[data-python-lab]')).toHaveAttribute('data-lab-state', item.state, { timeout: 55_000 });
    const pending = page.waitForEvent('download'); await page.locator('[data-lab-export="result"]').click();
    const result = JSON.parse(await downloadText(await pending));
    expect(result).toMatchObject({ state: item.state, code: actualCode, input: actualInput, executor: '用户当前浏览器 WebWorker' });
    expect(result.environment).toContain('CPython 3.14.2'); expect(result.environment).toContain('WebWorker');
    expect(result.stdout).toContain(item.stdout); expect(result.stderr).toContain(item.stderr);
    expect(result.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); expect(result.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.limitation).toContain('不证明用户本机复现');
    if (item.id === 'non-numeric' || item.id === 'missing-unit') expect(result.stdout).toContain('检查发现 1 项问题');
  }
  expect(mutations).toEqual([]);
});
