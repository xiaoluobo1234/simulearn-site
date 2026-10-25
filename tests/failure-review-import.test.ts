import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import legacyV1 from './fixtures/first-study-v1.json';
import { firstStudyGuide } from '../src/data/first-study-guide';
import { ASSEMBLY_DEFAULTS, solveAssembly } from '../src/lib/assembly-lab';
import { emptyFirstStudy, exportFirstStudy } from '../src/lib/first-study-guide';
import { createLabResult, pythonLabTemplates } from '../src/lib/python-lab';
import { createStudyEvidence } from '../src/lib/study-evidence';
import {
  blankFailureReview, failureReviewJson, parseFailureReview, toFailureStudyItem,
  validateFailureReview, type FailureReview,
} from '../src/lib/failure-review';
import {
  MAX_FAILURE_REVIEW_FILE_BYTES, MAX_FAILURE_REVIEW_IMPORT_BYTES,
  prepareFailureReviewImport, readFailureReviewImport, type FailureReviewImport,
} from '../src/lib/failure-review-import';

const originalAt = '2026-10-25T01:00:00.000Z';
const finishedAt = '2026-10-25T01:00:01.000Z';
const savedAt = '2026-10-25T01:10:00.000Z';
const importedAt = '2026-10-25T02:00:00.000Z';
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const review = (): FailureReview => ({ ...blankFailureReview(), title: '夹具：位移尚待核对',
  date: '2026-10-24', executor: 'AI 执行环境', reproduction: '已运行待核对', actual: '<script>neverExecute()</script>\r\n原始日志', diagnosticId: 'units' });
async function imported(value: unknown): Promise<FailureReviewImport> {
  const result = await readFailureReviewImport(encode(value), 'private.json', importedAt);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
async function studyFiles() {
  const draft = emptyFirstStudy();
  draft.fields = { prediction: '夹具：我预测 1 mm\r\n# 原文标题', pythonObservation: 'PRIVATE_PYTHON 自述报错，尚待核对',
    assemblyObservation: 'PRIVATE_ASSEMBLY 自述数值，与预期有差异', evidenceObservation: 'PRIVATE_MIXED 不应自动提取下一步或结论', environment: 'PRIVATE_ENV 未经核验的本机环境' };
  const template = pythonLabTemplates.find(item => item.id === 'bar')!;
  const python = { ...createLabResult(template.code, template.input, originalAt), state: 'succeeded', finishedAt,
    elapsedMs: 1000, environment: 'CPython 3.14.2 · Pyodide 314.0.7 · WebAssembly / WebWorker', stdout: 'PRIVATE_RAW_OUTPUT 不应复制到复盘' };
  const assembly = { schemaVersion: 1, execution: { executor: '当前浏览器 JavaScript 教学计算',
    runtime: 'JavaScript Number / IEEE 754 float64', executedAt: finishedAt, reviewStatus: 'AI 辅助编写，待本人复核',
    notEvidenceOf: ['ANSYS 求解', '在线 CAE 任务', '用户独立复现', '个人学习掌握', '工程安全认证'] }, solution: solveAssembly(ASSEMBLY_DEFAULTS) };
  for (const [file, name] of [[python, 'python-private.json'], [assembly, 'assembly-private.json']] as const) {
    const parsed = await createStudyEvidence(encode(file), name, finishedAt);
    if (!parsed.ok) throw new Error(parsed.error);
    draft.evidence.push(parsed.value);
  }
  return exportFirstStudy(draft, savedAt);
}

describe('local failure-review backup imports', () => {
  it('restores the exact existing export including an unfinished blank title', async () => {
    for (const value of [blankFailureReview(), review()]) {
      const bytes = new TextEncoder().encode(failureReviewJson(value));
      const result = await readFailureReviewImport(bytes, '失败复盘.json', importedAt);
      expect(result.ok).toBe(true); if (!result.ok) continue;
      expect(result.value).toEqual({ kind: 'failure-review', review: value,
        source: { fileName: '失败复盘.json', sha256: createHash('sha256').update(bytes).digest('hex'), sizeBytes: bytes.byteLength, importedAt } });
      expect(prepareFailureReviewImport(result.value)).toEqual({ ok: true, value });
      if (result.value.kind === 'failure-review') result.value.review.actual = 'caller changed';
      expect(value.actual).not.toBe('caller changed');
    }
  });

  it('accepts a near-32000-character pretty Chinese export even when the compact parser cannot accept its whitespace', async () => {
    const value = blankFailureReview(); value.title = '近上限中文复盘夹具';
    Object.assign(value, { model: '模'.repeat(3000), symptom: '症'.repeat(4000), expected: '预'.repeat(3000),
      hypothesis: '猜'.repeat(4000), attempts: '试'.repeat(6000), actual: '果'.repeat(6000), change: '改'.repeat(3000) });
    const envelope = () => JSON.stringify({ failureReview: value });
    value.evidence = '证'.repeat(31_990 - envelope().length);
    expect(envelope()).toHaveLength(31_990);
    expect(validateFailureReview(value).ok).toBe(true);
    const pretty = failureReviewJson(value);
    expect(pretty.length).toBeGreaterThan(32_000);
    expect(parseFailureReview(pretty).ok).toBe(false);
    expect(new TextEncoder().encode(pretty).byteLength).toBeLessThan(MAX_FAILURE_REVIEW_FILE_BYTES);
    const parsed = await imported(JSON.parse(pretty));
    // The actual pretty export, rather than only its compact projection, is accepted.
    expect((await readFailureReviewImport(new TextEncoder().encode(pretty), 'large.json', importedAt)).ok).toBe(true);
    expect(prepareFailureReviewImport(parsed)).toEqual({ ok: true, value });
    expect(() => toFailureStudyItem(value)).toThrow('128 KiB');
    expect(value.evidence).toHaveLength(31_990 - (envelope().length - value.evidence.length));
  });

  it('hashes original BOM and CRLF bytes and snapshots them before awaiting the hash', async () => {
    const selected = new TextEncoder().encode('\uFEFF' + failureReviewJson(review()).replace(/\n/g, '\r\n') + '\r\n');
    const original = Uint8Array.from(selected);
    const pending = readFailureReviewImport(selected, 'bom.json', importedAt);
    selected.fill(0);
    const result = await pending;
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.value.source).toMatchObject({ sha256: createHash('sha256').update(original).digest('hex'), sizeBytes: original.byteLength });
    expect(result.value.kind === 'failure-review' && result.value.review.actual).toBe(review().actual);
  });

  it('rejects invalid UTF-8, malformed JSON, filenames and import times without repairs', async () => {
    for (const bytes of [new Uint8Array(), new Uint8Array([0xc0, 0xaf]), new TextEncoder().encode('{bad'), new TextEncoder().encode('\uFEFF\uFEFF' + failureReviewJson(review()))]) {
      expect((await readFailureReviewImport(bytes, 'valid.json', importedAt)).ok).toBe(false);
    }
    for (const name of ['', '  ', 'x'.repeat(201), 'unsafe\nname.json', 'unsafe\u0000.json', 'unsafe\u007f.json']) expect((await readFailureReviewImport(encode({ failureReview: review() }), name, importedAt)).ok).toBe(false);
    for (const time of ['', 'yesterday', '2026-10-25', '2026-02-30T02:00:00.000Z']) expect((await readFailureReviewImport(encode({ failureReview: review() }), 'valid.json', time)).ok).toBe(false);
  });

  it('enforces the two different file byte limits before returning a document', async () => {
    expect(MAX_FAILURE_REVIEW_IMPORT_BYTES).toBe(2 * 1024 * 1024);
    expect(MAX_FAILURE_REVIEW_FILE_BYTES).toBe(128 * 1024);
    expect((await readFailureReviewImport(new Uint8Array(MAX_FAILURE_REVIEW_IMPORT_BYTES + 1), 'large.json', importedAt)).ok).toBe(false);
    const padded = new TextEncoder().encode(failureReviewJson(review()) + ' '.repeat(MAX_FAILURE_REVIEW_FILE_BYTES));
    expect((await readFailureReviewImport(padded, 'large-review.json', importedAt))).toMatchObject({ ok: false, error: expect.stringContaining('128 KiB') });
  });

  it('rejects unknown envelopes, fields, schemas, prototype keys and excessive nesting', async () => {
    for (const data of [null, [], {}, { failureReview: review(), extra: true }, { failureReview: { ...review(), extra: true } },
      { failureReview: { ...review(), versionSchema: 2 } }, { failureReview: { ...review(), actual: 'x'.repeat(6001) } }, { schemaVersion: 3 }]) {
      expect((await readFailureReviewImport(encode(data), 'unsupported.json', importedAt)).ok).toBe(false);
    }
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const raw = `{"failureReview":${JSON.stringify(review()).replace('{', `{"${key}":{},`)}}`;
      expect((await readFailureReviewImport(new TextEncoder().encode(raw), 'unsafe.json', importedAt)).ok).toBe(false);
    }
    let nested: unknown = null; for (let index = 0; index < 40; index++) nested = { child: nested };
    expect((await readFailureReviewImport(encode({ nested }), 'deep.json', importedAt)).ok).toBe(false);
    expect({}).not.toHaveProperty('polluted');
  });
});

describe('explicit first-study to fresh failure-review preparation', () => {
  it('accepts actual prior schema 1 and current schema 2 only through the strict backup reader', async () => {
    for (const backup of [legacyV1, exportFirstStudy(emptyFirstStudy(), savedAt)]) {
      const result = await imported(backup);
      expect(result.kind).toBe('first-study'); if (result.kind !== 'first-study') continue;
      expect(result.draft.fields).toEqual(backup.fields);
      expect(result.source).toEqual({ fileName: 'private.json', sha256: createHash('sha256').update(encode(backup)).digest('hex'), sizeBytes: encode(backup).byteLength, importedAt });
    }
    const current = exportFirstStudy(emptyFirstStudy(), savedAt);
    const altered = { ...current, fixedCase: { ...current.fixedCase, inputs: { ...current.fixedCase.inputs, E: { ...current.fixedCase.inputs.E, unit: 'Pa' } } } };
    expect((await readFailureReviewImport(encode(altered), 'changed.json', importedAt)).ok).toBe(false);
    expect((await readFailureReviewImport(encode({ ...legacyV1, extra: true }), 'unknown.json', importedAt)).ok).toBe(false);
  });

  it('requires the learner to choose an experiment and does not infer failure from a result status', async () => {
    const parsed = await imported(await studyFiles());
    expect(prepareFailureReviewImport(parsed).ok).toBe(false);
    expect(prepareFailureReviewImport(parsed, 'unknown' as 'python').ok).toBe(false);
    const result = prepareFailureReviewImport(parsed, 'python');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.value.title).toBe('Python 试学排查草稿（待补问题）');
    expect(result.value).toMatchObject({ date: '', symptom: '', version: '', executor: '未运行', reproduction: '未运行',
      hypothesis: '', attempts: '', change: '', retest: '', next: '', diagnosticId: '' });
    expect(toFailureStudyItem(result.value)).toMatchObject({ visibility: 'private', learningStatus: 'not-started', reviewStatus: 'draft' });
  });

  it('copies only the selected literal observation, prediction and unverified environment', async () => {
    const parsed = await imported(await studyFiles());
    for (const kind of ['python', 'assembly'] as const) {
      const snapshot = structuredClone(parsed);
      const prepared = prepareFailureReviewImport(parsed, kind);
      expect(prepared.ok).toBe(true); if (!prepared.ok || parsed.kind !== 'first-study') continue;
      expect(prepared.value.actual).toContain(parsed.draft.fields[kind === 'python' ? 'pythonObservation' : 'assemblyObservation']);
      expect(prepared.value.actual).toContain(parsed.draft.fields.environment);
      expect(prepared.value.actual).not.toContain(kind === 'python' ? 'PRIVATE_ASSEMBLY' : 'PRIVATE_PYTHON');
      expect(prepared.value.expected).toContain(parsed.draft.fields.prediction);
      expect(prepared.value.expected).toContain('不等于已证实');
      expect(prepared.value.actual).toContain('未经核验');
      expect(JSON.stringify(prepared.value)).not.toContain('PRIVATE_MIXED');
      expect(parsed).toEqual(snapshot);
    }
  });

  it('indexes source and selected attachment metadata without raw output, code, summary or other attachments', async () => {
    const backup = await studyFiles(); const parsed = await imported(backup);
    const result = prepareFailureReviewImport(parsed, 'python');
    expect(result.ok).toBe(true); if (!result.ok || parsed.kind !== 'first-study') return;
    const text = JSON.stringify(result.value);
    expect(result.value.evidence).toContain(parsed.source.sha256);
    expect(result.value.evidence).toContain(parsed.draft.evidence[0].sha256);
    expect(result.value.evidence).toContain('python-private.json');
    expect(result.value.evidence).toContain('succeeded');
    expect(result.value.evidence).toContain('不是学习发生日期');
    expect(text).not.toContain('assembly-private.json');
    expect(text).not.toContain(parsed.draft.evidence[1].sha256);
    expect(text).not.toContain('PRIVATE_RAW_OUTPUT');
    expect(text).not.toContain(parsed.draft.evidence[0].originalText);
    expect(text).not.toContain(parsed.draft.evidence[0].summary);
    expect(result.value.model).toContain('不是导入文件实际工况');
    expect(result.value.model).toContain(`${firstStudyGuide.inputs.E.value} ${firstStudyGuide.inputs.E.unit}`);
    expect(result.value.model).toContain(firstStudyGuide.sourceInput);
  });

  it('permits self-reports without a result file, retaining empty observations as empty', async () => {
    const parsed = await imported(exportFirstStudy(emptyFirstStudy(), savedAt));
    const result = prepareFailureReviewImport(parsed, 'assembly');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.value.actual).toBe(''); expect(result.value.expected).toBe('');
    expect(result.value.evidence).toContain('未附 装配 结果文件');
    expect(result.value.evidence).toContain('不证明已运行');
  });

  it('keeps full-length literal self-reports and rejects unsupported control text without truncation', async () => {
    const draft = emptyFirstStudy(); draft.fields.pythonObservation = '观'.repeat(2000); draft.fields.environment = '境'.repeat(2000); draft.fields.prediction = '预'.repeat(2000);
    const parsed = await imported(exportFirstStudy(draft, savedAt));
    const result = prepareFailureReviewImport(parsed, 'python');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.value.actual).toContain(draft.fields.pythonObservation); expect(result.value.actual).toContain(draft.fields.environment);
    expect(result.value.expected).toContain(draft.fields.prediction);
    expect(() => toFailureStudyItem(result.value)).not.toThrow();
    draft.fields.pythonObservation = '原文\u0000禁止控制符';
    const control = await imported(exportFirstStudy(draft, savedAt));
    expect(prepareFailureReviewImport(control, 'python')).toMatchObject({ ok: false, error: expect.stringContaining('没有被截断') });
    expect(draft.fields.pythonObservation).toBe('原文\u0000禁止控制符');
  });

  it('does not use the network or execute result code while reading and preparing either format', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('must not request network'); });
    try {
      const direct = await imported({ failureReview: review() });
      expect(prepareFailureReviewImport(direct).ok).toBe(true);
      const source = await imported(await studyFiles());
      expect(prepareFailureReviewImport(source, 'assembly').ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
});
