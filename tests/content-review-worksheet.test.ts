import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { ContentReviewPack } from '../src/lib/content-review-pack';
import {
  MAX_REVIEW_WORKSHEET_BYTES, WORKSHEET_SCOPE, concludeReviewWorksheet, editReviewCheck, editReviewWorksheet,
  emptyReviewWorksheet, exportReviewWorksheetJson, readReviewWorksheetFile, reviewWorksheetMarkdown, validateReviewWorksheet,
  type Result, type ReviewWorksheet,
} from '../src/lib/content-review-worksheet';

const stamp = '2026-10-25T04:05:06.000Z';
const later = '2026-10-25T05:06:07.000Z';
const id = 'guide:first-study';
const enc = new TextEncoder();
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const take = <T>(result: Result<T>): T => { if (!result.ok) throw new Error(result.error); return result.value; };
function pack(): ContentReviewPack {
  const checks = ['engineering-scope', 'sources-and-rights', 'evidence-and-privacy', 'first-flow'].map(key => ({ id: key, question: `实际核对 ${key} 的问题？`, result: 'not-reviewed' as const, note: null }));
  return {
    schemaVersion: 1, kind: 'human-review-draft', generatedAt: stamp,
    repository: 'https://github.com/xiaoluobo1234/simulearn-site', sourceCommit: 'a'.repeat(40), workingTree: 'clean', scope: '测试范围', instructions: [],
    publication: { state: 'pending-human-review', approved: false }, stackedPullRequests: [],
    items: [{ id, title: '首次试学', href: '/learning/start/', contentVersion: 'first-study-v1', sourcePath: 'src/pages/learning/start.astro', fingerprint: 'f'.repeat(64),
      files: [{ path: 'src/pages/learning/start.astro', sha256: 'b'.repeat(64), sizeBytes: 321, committedSha256: 'b'.repeat(64), matchesCommit: true, commitUrl: null }, { path: 'src/data/first-study-guide.ts', sha256: 'c'.repeat(64), sizeBytes: 654, committedSha256: 'c'.repeat(64), matchesCommit: true, commitUrl: null }], checks,
      humanReview: { state: 'pending', reviewer: null, reviewedAt: null, conclusion: null, notes: null, boundContentVersion: 'first-study-v1', boundFingerprint: 'f'.repeat(64) } }],
    automatedEvidence: { status: 'unavailable', generatedAt: null, sourceCommit: null, scope: '测试用空参考状态', cases: [] },
  };
}
const empty = (): ReviewWorksheet => emptyReviewWorksheet(pack(), id);
function metadata(sheet = empty()): ReviewWorksheet {
  let value = take(editReviewWorksheet(sheet, 'reviewer', '合成测试审核人'));
  value = take(editReviewWorksheet(value, 'reviewedAt', '2026-10-25'));
  return take(editReviewWorksheet(value, 'scope', '仅测试工作表规则，没有实际教学内容审核。'));
}
function complete(): ReviewWorksheet {
  let value = metadata();
  for (const check of value.review.checks) {
    value = take(editReviewCheck(value, check.id, 'decision', 'pass'));
    value = take(editReviewCheck(value, check.id, 'note', `合成依据：${check.id}，不作为真实审核证据。`));
  }
  return value;
}
function bytes(sheet = empty()): Uint8Array { return enc.encode(exportReviewWorksheetJson(sheet, stamp)); }
async function read(value: Uint8Array, current = pack()) { return take(await readReviewWorksheetFile(value, 'review.json', later, current)); }

describe('single-item local human review worksheet', () => {
  it('starts only the selected item with empty actual-review fields and never approves publication', () => {
    const source = pack(), before = JSON.stringify(source), sheet = emptyReviewWorksheet(source, id);
    expect(sheet.review).toEqual({ reviewer: '', reviewedAt: '', scope: '', notes: '', conclusion: 'not-recorded', checks: source.items[0].checks.map(check => ({ id: check.id, decision: 'not-reviewed', note: '' })) });
    expect(sheet.publication).toEqual({ state: 'pending-repository-review', approved: false });
    expect(sheet.item.files[0]).not.toHaveProperty('commitUrl');
    sheet.item.files[0].sha256 = '0'.repeat(64);
    expect(JSON.stringify(source)).toBe(before);
    expect(() => emptyReviewWorksheet(source, 'unknown')).toThrow('找不到');
  });

  it('exports incomplete work and preserves multiline text exactly without filling dates or names', async () => {
    const note = '第一行\r\n\r\n第二行\r第三行\n';
    const sheet = take(editReviewWorksheet(empty(), 'notes', note));
    const exported = JSON.parse(exportReviewWorksheetJson(sheet, stamp));
    expect(exported.review.notes).toBe(note);
    expect(exported.review.reviewer).toBe(''); expect(exported.review.reviewedAt).toBe('');
    expect(exported.scope).toBe(WORKSHEET_SCOPE); expect(exported.exportedAt).toBe(stamp);
    expect((await read(bytes(sheet))).worksheet).toEqual(sheet);
    expect(sheet.review.conclusion).toBe('not-recorded');
  });

  it('requires metadata and every explicit passed check with an actual note for acceptable', () => {
    expect(concludeReviewWorksheet(empty(), 'acceptable').ok).toBe(false);
    expect(concludeReviewWorksheet(metadata(), 'acceptable').ok).toBe(false);
    let value = complete();
    expect(take(concludeReviewWorksheet(value, 'acceptable')).review.conclusion).toBe('acceptable');
    for (const decision of ['not-reviewed', 'changes-required', 'not-applicable']) {
      const changed = take(editReviewCheck(value, value.review.checks[0].id, 'decision', decision));
      expect(concludeReviewWorksheet(changed, 'acceptable').ok).toBe(false);
    }
    value = take(editReviewCheck(value, value.review.checks[0].id, 'note', ' \n\t'));
    expect(concludeReviewWorksheet(value, 'acceptable').ok).toBe(false);
  });

  it('records changes or blockers only with explicit metadata and supporting findings', () => {
    let value = metadata();
    expect(concludeReviewWorksheet(value, 'changes-required').ok).toBe(false);
    value = take(editReviewCheck(value, value.review.checks[0].id, 'decision', 'changes-required'));
    expect(concludeReviewWorksheet(value, 'changes-required').ok).toBe(false);
    value = take(editReviewCheck(value, value.review.checks[0].id, 'note', '合成问题：缺少输入单位。'));
    expect(take(concludeReviewWorksheet(value, 'changes-required')).review.conclusion).toBe('changes-required');
    expect(concludeReviewWorksheet(value, 'blocked').ok).toBe(false);
    value = take(editReviewWorksheet(value, 'notes', '合成受阻原因：尚未取得附件权限。'));
    expect(take(concludeReviewWorksheet(value, 'blocked')).review.conclusion).toBe('blocked');
    expect(concludeReviewWorksheet(empty(), 'blocked').ok).toBe(false);
  });

  it('revokes a manual conclusion on every actual edit while keeping no-op edits and original input unchanged', () => {
    const sheet = take(concludeReviewWorksheet(complete(), 'acceptable'));
    for (const [field, value] of [['reviewer', '另一合成姓名'], ['reviewedAt', '2026-10-24'], ['scope', '另一范围'], ['notes', '补充依据']] as const) {
      expect(take(editReviewWorksheet(sheet, field, value)).review.conclusion).toBe('not-recorded');
      expect(take(editReviewWorksheet(sheet, field, sheet.review[field])).review.conclusion).toBe('acceptable');
    }
    expect(take(editReviewCheck(sheet, sheet.review.checks[0].id, 'note', '不同依据')).review.conclusion).toBe('not-recorded');
    expect(take(editReviewCheck(sheet, sheet.review.checks[0].id, 'decision', 'changes-required')).review.conclusion).toBe('not-recorded');
    expect(take(editReviewCheck(sheet, sheet.review.checks[0].id, 'decision', 'pass')).review.conclusion).toBe('acceptable');
    expect(sheet.review.conclusion).toBe('acceptable');
    expect(editReviewCheck(sheet, 'unknown', 'note', 'abc').ok).toBe(false);
    expect(editReviewCheck(sheet, sheet.review.checks[0].id, 'decision', 'approved').ok).toBe(false);
  });

  it('validates calendar dates and single-line identity fields without inventing timestamps', () => {
    for (const value of ['2026-02-29', '2026-13-01', '2026-10-25T00:00:00Z', '2026-1-1', '0000-01-01']) expect(editReviewWorksheet(empty(), 'reviewedAt', value).ok).toBe(false);
    expect(editReviewWorksheet(empty(), 'reviewedAt', '2024-02-29').ok).toBe(true);
    for (const value of ['x\ny', 'x\ry', 'x\ty', 'x\0y']) expect(editReviewWorksheet(empty(), 'reviewer', value).ok).toBe(false);
    expect(editReviewWorksheet(empty(), 'notes', 'x\0y').ok).toBe(false);
    expect(editReviewWorksheet(empty(), 'scope', 'x'.repeat(10001)).ok).toBe(false);
    expect(editReviewCheck(empty(), empty().review.checks[0].id, 'note', 'x'.repeat(10001)).ok).toBe(false);
    expect(() => exportReviewWorksheetJson(empty(), '2026-02-30T00:00:00.000Z')).toThrow('导出时间');
  });

  it('restores exact content and file source metadata as unverified declarations without mutating the current pack', async () => {
    const sheet = take(concludeReviewWorksheet(complete(), 'acceptable'));
    const source = pack(), before = JSON.stringify(source), raw = bytes(sheet);
    const result = await read(raw, source);
    expect(result.worksheet).toEqual(sheet);
    expect(result.source).toEqual({ fileName: 'review.json', sha256: hash(raw), sizeBytes: raw.length, importedAt: later });
    expect(result.match).toEqual({ compatible: true, reasons: [] });
    expect(result.worksheet.publication.approved).toBe(false);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('preserves the original basis when only the current commit, generation time or working tree changed', async () => {
    const raw = bytes(), current = pack();
    current.sourceCommit = 'd'.repeat(40); current.generatedAt = later; current.workingTree = 'modified';
    const result = await read(raw, current);
    expect(result.match.compatible).toBe(true);
    expect(result.worksheet.basis).toEqual(empty().basis);
    expect(result.worksheet.basis.sourceCommit).not.toBe(current.sourceCommit);
  });

  it('keeps a stale worksheet readable but incompatible for every identity, byte or checklist change', async () => {
    const changes: ((current: ContentReviewPack) => void)[] = [
      value => { value.items = []; }, value => { value.items[0].title += '新版'; }, value => { value.items[0].href = '/learning/new/'; },
      value => { value.items[0].contentVersion = 'first-study-v2'; }, value => { value.items[0].sourcePath = 'src/other.ts'; }, value => { value.items[0].fingerprint = '0'.repeat(64); },
      value => { value.items[0].files[0].sha256 = '0'.repeat(64); }, value => { value.items[0].files[0].sizeBytes++; }, value => { value.items[0].files[1].path = 'src/changed.ts'; },
      value => { value.items[0].checks[0].question += '改过问题'; }, value => { value.items[0].checks[0].id = 'changed-check'; },
      value => { value.items[0].checks.reverse(); },
    ];
    for (const change of changes) {
      const current = pack(); change(current);
      const result = await read(bytes(), current);
      expect(result.match.compatible).toBe(false); expect(result.match.reasons.length).toBeGreaterThan(0);
      expect(result.worksheet).toEqual(empty());
    }
  });

  it('compares file sets independently of array order or JSON property order while keeping question order meaningful', async () => {
    const data = JSON.parse(exportReviewWorksheetJson(empty(), stamp));
    data.item.files.reverse();
    data.item.files = data.item.files.map((file: { path: string; sha256: string; sizeBytes: number }) => ({ sizeBytes: file.sizeBytes, sha256: file.sha256, path: file.path }));
    data.item.checks = data.item.checks.map((check: { id: string; question: string }) => ({ question: check.question, id: check.id }));
    expect((await read(enc.encode(JSON.stringify(data)))).match.compatible).toBe(true);
  });

  it('rejects unknown structures, schemas, duplicate identities and forged approval or incomplete conclusions', async () => {
    const mutations: ((value: any) => void)[] = [
      value => { value.schemaVersion = 2; }, value => { value.kind = 'human-review-draft'; }, value => { value.extra = true; },
      value => { value.publication.approved = true; }, value => { value.publication.state = 'approved'; }, value => { value.review.conclusion = 'acceptable'; },
      value => { value.basis.repository = 'https://evil.example/'; }, value => { value.basis.sourceCommit = 'HEAD'; }, value => { value.basis.generatedAt = '2026-02-30T00:00:00.000Z'; },
      value => { value.item.href = 'javascript:alert(1)'; }, value => { value.item.files[0].path = 'src/../private.json'; }, value => { value.item.files.push(value.item.files[0]); },
      value => { value.item.checks[1].id = value.item.checks[0].id; }, value => { value.review.checks[0].id = 'unknown'; }, value => { value.review.checks[0].decision = 'approved'; },
      value => { value.item.files[0].sizeBytes = Infinity; }, value => { value.item.fingerprint = 'fake'; }, value => { value.item.title = 'x\n# malicious'; },
    ];
    for (const mutate of mutations) {
      const value = empty(); mutate(value);
      expect(validateReviewWorksheet(value).ok).toBe(false);
    }
    const data = JSON.parse(exportReviewWorksheetJson(empty(), stamp)); data.scope = '发布已经通过';
    expect((await readReviewWorksheetFile(enc.encode(JSON.stringify(data)), 'review.json', later, pack())).ok).toBe(false);
    data.scope = WORKSHEET_SCOPE; data.exportedAt = 'yesterday';
    expect((await readReviewWorksheetFile(enc.encode(JSON.stringify(data)), 'review.json', later, pack())).ok).toBe(false);
  });

  it('rejects poisonous keys, cycles, excessive nesting and unexpected instances', async () => {
    const raw = exportReviewWorksheetJson(empty(), stamp).replace('"reviewer": ""', '"reviewer": "", "__proto__": {"polluted":true}');
    expect((await readReviewWorksheetFile(enc.encode(raw), 'review.json', later, pack())).ok).toBe(false);
    const dangerous = exportReviewWorksheetJson(empty(), stamp).replace('"reviewer": ""', '"reviewer": "", "constructor": {}');
    expect((await readReviewWorksheetFile(enc.encode(dangerous), 'review.json', later, pack())).ok).toBe(false);
    const circular: any = empty(); circular.extra = circular;
    expect(validateReviewWorksheet(circular).ok).toBe(false);
    const deep: any = empty(); deep.extra = Array.from({ length: 300 }, () => null);
    expect(validateReviewWorksheet(deep).ok).toBe(false);
    expect(validateReviewWorksheet(new Date()).ok).toBe(false);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('rejects accessor properties without executing their getters', () => {
    let called = 0;
    const value = empty();
    Object.defineProperty(value.review, 'reviewer', { enumerable: true, get() { called++; return 'untrusted getter'; } });
    expect(validateReviewWorksheet(value).ok).toBe(false);
    expect(called).toBe(0);
  });

  it('enforces raw UTF-8 byte size and metadata limits before parsing', async () => {
    for (const raw of [new Uint8Array(), new Uint8Array(MAX_REVIEW_WORKSHEET_BYTES + 1), new Uint8Array([0xff, 0xfe, 0xff]), enc.encode('{broken'), enc.encode('null')]) expect((await readReviewWorksheetFile(raw, 'review.json', later, pack())).ok).toBe(false);
    for (const fileName of ['', 'x'.repeat(201), 'name\n.json', 'name\0.json']) expect((await readReviewWorksheetFile(bytes(), fileName, later, pack())).ok).toBe(false);
    expect((await readReviewWorksheetFile(bytes(), 'review.json', '2026-10-25', pack())).ok).toBe(false);
  });

  it('hashes exact BOM and CRLF bytes and snapshots them before asynchronous hashing', async () => {
    const json = exportReviewWorksheetJson(empty(), stamp).replace(/\n/g, '\r\n');
    const raw = enc.encode(`\uFEFF${json}`), expected = hash(raw), size = raw.length;
    const pending = readReviewWorksheetFile(raw, 'windows.json', later, pack());
    raw.fill(0);
    const result = take(await pending);
    expect(result.source.sha256).toBe(expected); expect(result.source.sizeBytes).toBe(size);
    expect(result.match.compatible).toBe(true);
    expect(result.worksheet).toEqual(empty());
  });

  it('compares the current pack before asynchronous hashing can observe later caller mutations', async () => {
    const current = pack();
    const pending = readReviewWorksheetFile(bytes(), 'review.json', later, current);
    current.items[0].files[0].sha256 = '0'.repeat(64);
    current.items[0].checks[0].question = 'changed after this read started';
    expect(take(await pending).match).toEqual({ compatible: true, reasons: [] });
  });

  it('renders reviewer text safely in Markdown while retaining multi-line evidence as code blocks', () => {
    let value = empty();
    value.item.title = '<script> [假链接](javascript:alert(1)) | 题目';
    value = take(editReviewWorksheet(value, 'reviewer', '[假的批准](https://evil.example/)'));
    value = take(editReviewWorksheet(value, 'notes', '# 假标题\r\n<script>alert(1)</script>\n[链接](https://evil.example)'));
    const md = reviewWorksheetMarkdown(value, stamp);
    expect(md).toContain('&lt;script&gt;'); expect(md).toContain('\\[假的批准\\]');
    expect(md).toContain('    # 假标题\n    <script>alert(1)</script>\n    [链接](https://evil.example)');
    expect(md).not.toContain('\n# 假标题'); expect(md).not.toContain('\n<script>');
    expect(md).toContain('本项结论：未登记'); expect(md).toContain('本文件不批准发布');
  });
});
