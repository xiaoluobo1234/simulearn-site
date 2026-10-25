import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { ContentProvenance } from '../src/data/content-provenance';
import { contentProvenance } from '../src/data/content-provenance';
import { buildContentReviewPack, reviewItemFingerprint } from '../src/lib/content-review-build';
import { assertReviewPath, escapeReviewMarkdown, humanReviewChecks, reviewSourcePaths, serializeContentReviewJson, serializeContentReviewMarkdown } from '../src/lib/content-review-pack';

const fixtures: string[] = [];
afterEach(() => { for (const path of fixtures.splice(0)) rmSync(path, { recursive: true, force: true }); });
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const item = (slug = 'uniform-bar'): ContentProvenance => ({
  id: `benchmark:${slug}`, title: '同一输入下的位移、反力与能量', href: `/cases/benchmarks/${slug}/`, version: 'linear-static-v1',
  sourcePath: 'src/data/linear-static-benchmarks.ts', review: 'pending', reviewer: null, changes: [{ version: 'linear-static-v1', summary: '教学参考，待复核。' }],
});
const stamp = '2026-10-25T00:00:00.000Z';
function fixture(catalog: ContentProvenance[] = [item()]): string {
  const root = mkdtempSync(join(tmpdir(), 'simulearn-review-'));
  fixtures.push(root);
  for (const path of new Set(catalog.flatMap(reviewSourcePaths))) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), path.endsWith('.zip') ? Buffer.from([0, 13, 10, 255, 10, 0, 87]) : `public review fixture: ${path}\n`);
  }
  writeFileSync(join(root, '.gitignore'), 'public/generated/\n');
  function git(args: string[]) { execFileSync('git', args, { cwd: root, windowsHide: true, stdio: 'pipe' }); }
  git(['init', '--quiet']); git(['-c', 'core.autocrlf=false', 'add', '.']);
  git(['-c', 'user.name=Review Fixture', '-c', 'user.email=review-fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Public review snapshot']);
  return root;
}

describe('version-bound human review draft', () => {
  it('binds versions and exact file bytes, independent of input order', () => {
    const files = [{ path: 'src/b.ts', sha256: hash('B') }, { path: 'src/a.ts', sha256: hash('A') }];
    const before = reviewItemFingerprint('lab:assembly', 'labs-v1', files);
    expect(before).toBe(reviewItemFingerprint('lab:assembly', 'labs-v1', [...files].reverse()));
    expect(reviewItemFingerprint('lab:assembly', 'labs-v2', files)).not.toBe(before);
    expect(reviewItemFingerprint('lab:assembly', 'labs-v1', [{ ...files[0], sha256: hash('changed') }, files[1]])).not.toBe(before);
    expect(reviewItemFingerprint('lab:convergence', 'labs-v1', files)).not.toBe(before);
  });

  it('records actual Git HEAD, hashes and exact-byte permalinks without granting review approval', () => {
    const catalog = [{ ...item(), review: 'approved', reviewer: 'invented' } as unknown as ContentProvenance];
    const root = fixture(catalog);
    const pack = buildContentReviewPack({ root, catalog, generatedAt: stamp });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
    expect(pack.sourceCommit).toBe(head); expect(pack.workingTree).toBe('clean');
    expect(pack.publication).toEqual({ state: 'pending-human-review', approved: false });
    expect(pack.stackedPullRequests.map(pr => pr.number)).toEqual([7, 8, 9, 10, 11, 12]);
    const entry = pack.items[0];
    expect(entry.humanReview).toEqual({ state: 'pending', reviewer: null, reviewedAt: null, conclusion: null, notes: null, boundContentVersion: 'linear-static-v1', boundFingerprint: entry.fingerprint });
    expect(entry.checks.every(check => check.result === 'not-reviewed' && check.note === null)).toBe(true);
    expect(entry.files.some(file => file.path.endsWith('input.json'))).toBe(true);
    expect(entry.files.some(file => file.path.endsWith('verify.py'))).toBe(true);
    expect(entry.files.some(file => file.path.endsWith('reference-results.json'))).toBe(true);
    for (const file of entry.files) {
      expect(file.sha256).toBe(hash(readFileSync(join(root, file.path))));
      expect(file.committedSha256).toBe(file.sha256); expect(file.matchesCommit).toBe(true);
      expect(file.commitUrl).toBe(`https://github.com/xiaoluobo1234/simulearn-site/blob/${head}/${file.path.split('/').map(encodeURIComponent).join('/')}`);
    }
    expect(pack.automatedEvidence.status).toBe('unavailable');
    expect(JSON.parse(serializeContentReviewJson(pack))).toEqual(pack);
  });

  it('invalidates the binding and removes misleading permalinks when a source changes after commit', () => {
    const catalog = [item()]; const root = fixture(catalog);
    const before = buildContentReviewPack({ root, catalog, generatedAt: stamp });
    const path = 'public/downloads/linear-static/uniform-bar/input.json';
    writeFileSync(join(root, path), 'different public input\n');
    const after = buildContentReviewPack({ root, catalog, generatedAt: stamp });
    expect(after.sourceCommit).toBe(before.sourceCommit); expect(after.workingTree).toBe('modified');
    expect(after.items[0].fingerprint).not.toBe(before.items[0].fingerprint);
    const source = after.items[0].files.find(file => file.path === path)!;
    expect(source.matchesCommit).toBe(false); expect(source.commitUrl).toBeNull();
    expect(source.committedSha256).toBe(before.items[0].files.find(file => file.path === path)!.sha256);
    expect(after.items[0].humanReview.state).toBe('pending');
    expect(after.items[0].humanReview.boundFingerprint).toBe(after.items[0].fingerprint);
  });

  it('rejects traversal, absolute paths, duplicate content identities and missing source files', () => {
    for (const path of ['../private.json', 'src/../private.json', '/src/a.ts', 'C:/src/a.ts', 'src\\a.ts', 'src//a.ts', 'src/%2e%2e/a.ts', 'src/./a.ts', 'src/a.ts\0']) expect(() => assertReviewPath(path)).toThrow('Invalid review source path');
    expect(() => assertReviewPath('src/pages/cases/benchmarks/[slug].astro')).not.toThrow();
    expect(() => reviewSourcePaths({ ...item(), sourcePath: 'src/../../private.json' })).toThrow();
    const catalog = [item()]; const root = fixture(catalog);
    expect(() => buildContentReviewPack({ root, catalog: [...catalog, ...catalog] })).toThrow('duplicate');
    unlinkSync(join(root, 'public/downloads/linear-static/uniform-bar/verify.py'));
    expect(() => buildContentReviewPack({ root, catalog })).toThrow();
    expect(() => reviewSourcePaths(item('unknown-case'))).toThrow('Unknown review benchmark');
  });

  it('keeps automation optional and separate, marking stale hashes or malformed evidence without approving content', () => {
    const catalog = ['uniform-bar', 'stepped-bar', 'cantilever-beam'].map(item); const root = fixture(catalog);
    const pack = buildContentReviewPack({ root, catalog, generatedAt: stamp });
    const file = join(root, 'public/generated/learning-evidence.json'); mkdirSync(dirname(file), { recursive: true });
    const evidence = {
      schemaVersion: 1, contentVersion: 'linear-static-v1', sourceCommit: pack.sourceCommit, generatedAt: stamp,
      cases: pack.items.map(entry => ({ id: entry.id, check: 'matched', files: entry.files.filter(source => source.path.endsWith('/input.json') || source.path.endsWith('/verify.py') || source.path.endsWith('/reference-results.json') || source.path === 'src/data/linear-static-benchmarks.ts').map(source => ({ path: source.path, sha256: source.sha256 })) })),
    };
    writeFileSync(file, JSON.stringify(evidence));
    const checked = buildContentReviewPack({ root, catalog, generatedAt: stamp });
    expect(checked.automatedEvidence.status).toBe('matched-to-current-files');
    expect(checked.automatedEvidence.scope).toContain('未逐项验证全部输出');
    expect(checked.items.every(entry => entry.humanReview.state === 'pending')).toBe(true);
    writeFileSync(join(root, 'public/downloads/linear-static/uniform-bar/input.json'), 'changed input');
    expect(buildContentReviewPack({ root, catalog }).automatedEvidence.status).toBe('stale');
    evidence.cases[0].files[0].path = 'src/../../private.json'; writeFileSync(file, JSON.stringify(evidence));
    expect(buildContentReviewPack({ root, catalog }).automatedEvidence.status).toBe('invalid');
    writeFileSync(file, '{broken'); expect(buildContentReviewPack({ root, catalog }).automatedEvidence.status).toBe('invalid');
  });

  it('escapes Markdown titles, delimiters and HTML while preserving the unfilled review template', () => {
    const catalog = [{ ...item(), title: '教材 | [假的批准](javascript:alert(1)) <script>\n# 自动批准' }];
    const root = fixture(catalog); const pack = buildContentReviewPack({ root, catalog, generatedAt: stamp });
    const markdown = serializeContentReviewMarkdown(pack);
    expect(markdown).toContain('\\|'); expect(markdown).toContain('\\[假的批准\\]\\(javascript:alert\\(1\\)\\)');
    expect(markdown).toContain('&lt;script&gt;'); expect(markdown).not.toContain('<script>');
    expect(markdown).not.toContain('\n# 自动批准'); expect(markdown).not.toContain('[x]');
    expect(markdown).toContain('实际审核人：未填写'); expect(markdown).toContain('实际审核结论：未填写');
    expect(markdown).toContain('新引导与本审核包属于后续变更');
    expect(escapeReviewMarkdown('`a` | b\r\nc')).toBe('\\`a\\` \\| b c');
  });

  it('uses engineering-specific questions rather than pretending every content type has the same validation', () => {
    for (const id of ['foundation:axial-members', 'diagnostic:units', 'benchmark:uniform-bar', 'project:linear-static', 'guide:first-study', 'lab:python', 'lab:assembly', 'lab:convergence']) {
      const checks = humanReviewChecks(id); expect(checks).toHaveLength(4);
      expect(checks.some(check => check.id === 'sources-and-rights')).toBe(true);
      expect(checks.some(check => check.id === 'evidence-and-privacy')).toBe(true);
    }
    expect(humanReviewChecks('lab:convergence').at(-1)!.question).toContain('零分母');
    expect(humanReviewChecks('lab:assembly').at(-1)!.question).toContain('非零给定位移');
  });

  it('covers all 24 real public entries and fails if any declared review source is absent', () => {
    const pack = buildContentReviewPack({ generatedAt: stamp });
    expect(pack.items).toHaveLength(24);
    expect(pack.items.map(entry => entry.id)).toEqual(contentProvenance.map(entry => entry.id));
    for (const entry of pack.items) {
      expect(entry.contentVersion).toBe(contentProvenance.find(value => value.id === entry.id)!.version);
      expect(entry.files.some(file => file.path === entry.sourcePath)).toBe(true);
      expect(entry.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256) && file.sizeBytes > 0)).toBe(true);
      expect(entry.humanReview.state).toBe('pending'); expect(entry.humanReview.conclusion).toBeNull();
    }
    expect(pack.items.find(entry => entry.id === 'lab:python')!.files.some(file => file.path.endsWith('pyodide.asm.wasm') && file.sizeBytes > 9_000_000)).toBe(true);
  });
});
