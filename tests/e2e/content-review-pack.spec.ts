import { expect, test, type Download } from '@playwright/test';
import type { ContentReviewPack } from '../../src/lib/content-review-pack';

const PRIVATE_QUERY = 'PRIVATE_REVIEW_QUERY_5d32';
const PRIVATE_STORAGE = 'PRIVATE_REVIEW_STORAGE_d479';
const JSON_PATH = '/downloads/content-review.json';
const MD_PATH = '/downloads/content-review.md';

test.beforeEach(async ({ context, baseURL }) => {
  const url = baseURL ? new URL(baseURL) : null;
  test.skip(!url || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Review acceptance uses loopback and synthetic private markers only.');
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/auth/me', route => route.fulfill({ json: { ok: true, user: null } }));
  await context.addInitScript(marker => localStorage.setItem('synthetic-private-review-fixture', marker), PRIVATE_STORAGE);
});

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('status downloads expose the same real build snapshot, with all 24 human reviews still unfilled', async ({ page }) => {
  await page.goto(`/content-status/?private=${PRIVATE_QUERY}&id=record-private`);
  await expect(page.locator('.project-case-card')).toHaveCount(24);
  const jsonLink = page.getByRole('link', { name: '下载版本与文件指纹 JSON ↓' });
  const markdownLink = page.getByRole('link', { name: '下载人工审核清单 Markdown ↓' });
  await expect(jsonLink).toHaveAttribute('href', JSON_PATH);
  await expect(markdownLink).toHaveAttribute('href', MD_PATH);
  const jsonDownload = page.waitForEvent('download'); await jsonLink.click();
  const jsonFile = await jsonDownload; expect(jsonFile.suggestedFilename()).toMatch(/content-review\.json$/);
  const json = await downloadText(jsonFile); const pack: ContentReviewPack = JSON.parse(json);
  const markdownDownload = page.waitForEvent('download'); await markdownLink.click();
  const markdownFile = await markdownDownload; expect(markdownFile.suggestedFilename()).toMatch(/content-review\.md$/);
  const markdown = await downloadText(markdownFile);
  const readableMarkdown = markdown.replace(/\\([\\`*_{}\[\]()#+.!|~-])/g, '$1');
  expect(pack.schemaVersion).toBe(1); expect(pack.kind).toBe('human-review-draft');
  expect(pack.sourceCommit).toMatch(/^[a-f0-9]{40}$/); expect(Number.isFinite(Date.parse(pack.generatedAt))).toBe(true);
  expect(readableMarkdown).toContain(pack.sourceCommit); expect(readableMarkdown).toContain(pack.generatedAt);
  expect(pack.items).toHaveLength(24); expect(pack.publication).toEqual({ state: 'pending-human-review', approved: false });
  expect(pack.stackedPullRequests.map(pr => pr.number)).toEqual([7, 8, 9, 10]);
  for (const item of pack.items) {
    expect(item.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(item.humanReview).toEqual({ state: 'pending', reviewer: null, reviewedAt: null, conclusion: null, notes: null, boundContentVersion: item.contentVersion, boundFingerprint: item.fingerprint });
    expect(item.checks.length).toBeGreaterThanOrEqual(4);
    expect(item.checks.every(check => check.result === 'not-reviewed' && check.note === null)).toBe(true);
    expect(readableMarkdown).toContain(item.fingerprint); expect(readableMarkdown).toContain(item.contentVersion);
  }
  expect(markdown).toContain('实际审核人：未填写'); expect(markdown).toContain('实际审核结论：未填写');
  expect(markdown).not.toContain('[x]');
  for (const marker of [PRIVATE_QUERY, PRIVATE_STORAGE, 'record-private']) {
    expect(json).not.toContain(marker); expect(markdown).not.toContain(marker);
  }
});

test('guide provenance binds its five implementation files and real benchmark input to exact source bytes', async ({ page, request }) => {
  const response = await request.get(`${JSON_PATH}?private=${PRIVATE_QUERY}`);
  expect(response.ok()).toBe(true); expect(response.headers()['content-type']).toContain('application/json');
  const raw = await response.text(); const pack: ContentReviewPack = JSON.parse(raw);
  const guide = pack.items.find(item => item.id === 'guide:first-study'); expect(guide).toBeDefined();
  expect(guide!.contentVersion).toBe('first-study-v1'); expect(guide!.sourcePath).toBe('src/pages/learning/start.astro');
  for (const path of [
    'src/pages/learning/start.astro', 'src/data/first-study-guide.ts', 'src/lib/first-study-guide.ts',
    'src/scripts/first-study-guide.ts', 'src/styles/first-study-guide.css',
    'public/downloads/linear-static/uniform-bar/input.json', 'src/data/linear-static-benchmarks.ts',
  ]) expect(guide!.files.some(file => file.path === path && /^[a-f0-9]{64}$/.test(file.sha256) && file.sizeBytes > 0)).toBe(true);
  for (const item of pack.items) for (const file of item.files) {
    expect(file.sha256).toMatch(/^[a-f0-9]{64}$/); expect(file.sizeBytes).toBeGreaterThan(0);
    if (file.matchesCommit) {
      expect(file.committedSha256).toBe(file.sha256);
      const url = new URL(file.commitUrl!); expect(url.origin).toBe('https://github.com');
      expect(decodeURIComponent(url.pathname)).toBe(`/xiaoluobo1234/simulearn-site/blob/${pack.sourceCommit}/${file.path}`);
    } else expect(file.commitUrl).toBeNull(); // A modified/CRLF local snapshot need not have matching commit links.
  }
  expect(raw).not.toContain(PRIVATE_QUERY); expect(raw).not.toContain(PRIVATE_STORAGE);
  await page.goto(`/learning/start/?private=${PRIVATE_QUERY}`);
  const provenance = page.locator('[data-content-provenance="guide:first-study"]');
  await expect(provenance).toContainText('first-study-v1');
  await expect(provenance.getByRole('link', { name: '下载人工审核清单 Markdown ↓' })).toHaveAttribute('href', MD_PATH);
  await expect(provenance.getByRole('link', { name: '下载版本与文件指纹 JSON ↓' })).toHaveAttribute('href', JSON_PATH);
  await provenance.locator('summary').click();
  await expect(provenance).toContainText(pack.sourceCommit); await expect(provenance).toContainText(guide!.fingerprint);
  const primary = guide!.files.find(file => file.path === guide!.sourcePath)!;
  if (primary.commitUrl) await expect(provenance.getByRole('link', { name: '查看本次构建对应的源码提交 ↗' })).toHaveAttribute('href', primary.commitUrl);
  else await expect(provenance).toContainText('当前源码字节尚无相符的提交永久链接');
});

test('real machine evidence stays distinct from human publication approval on the index and benchmark page', async ({ page, request }) => {
  const [packResponse, evidenceResponse] = await Promise.all([request.get(JSON_PATH), request.get('/generated/learning-evidence.json')]);
  expect(packResponse.ok()).toBe(true); expect(evidenceResponse.ok()).toBe(true);
  const pack: ContentReviewPack = await packResponse.json(); const evidence = await evidenceResponse.json();
  expect(evidence.reviewStatus).toBe('pending-human-review');
  expect(evidence.cases).toHaveLength(3); expect(evidence.cases.every((item: { check: string }) => item.check === 'matched')).toBe(true);
  expect(['matched-to-current-files', 'stale']).toContain(pack.automatedEvidence.status);
  expect(pack.automatedEvidence.cases).toHaveLength(3);
  expect(pack.automatedEvidence.scope).toContain('未逐项验证全部输出');
  expect(pack.publication.approved).toBe(false); expect(pack.items.every(item => item.humanReview.state === 'pending' && item.humanReview.reviewer === null)).toBe(true);
  await page.goto('/content-status/'); await expect(page.locator('.review-download')).toContainText('下载或测试通过都不会批准发布');
  await expect(page.locator('.project-callout').filter({ hasText: '构建参考证据状态' })).toContainText(pack.automatedEvidence.status);
  await page.goto('/cases/benchmarks/uniform-bar/');
  const provenance = page.locator('[data-content-provenance="benchmark:uniform-bar"]');
  await expect(provenance.locator('[data-evidence-result]')).toContainText('本次构建环境已重跑参考程序');
  await expect(provenance).toContainText('审核人、实际审核范围与审核日期尚未登记');
  await expect(provenance).toContainText('审核状态：待本人复核');
});
