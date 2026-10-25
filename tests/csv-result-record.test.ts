import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { csvProjectCases } from '../src/lib/csv-project';
import { createLabResult, pythonLabTemplates, type LabResult } from '../src/lib/python-lab';
import { ASSEMBLY_DEFAULTS, solveAssembly } from '../src/lib/assembly-lab';
import { createCsvResultDraft, MAX_CSV_RESULT_BYTES } from '../src/lib/csv-result-record';

const startedAt = '2026-10-24T01:00:00.000Z';
const finishedAt = '2026-10-24T01:00:01.000Z';
const importedAt = '2026-10-25T01:01:00.000Z';
const environment = 'CPython 3.14.2 · Pyodide 314.0.7 · WebAssembly / WebWorker';
const csvTemplate = pythonLabTemplates.find(item => item.id === 'csv')!;
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
function python(patch: Partial<LabResult> = {}): LabResult {
  return { ...createLabResult(csvTemplate.code, csvProjectCases[0].input, startedAt),
    state: 'succeeded', environment, finishedAt, elapsedMs: 1000,
    stdout: '读取 4 行；检查发现 0 项问题。\n', ...patch };
}
function assembly() {
  return { schemaVersion: 1, execution: {
    executor: '当前浏览器 JavaScript 教学计算', runtime: 'JavaScript Number / IEEE 754 float64',
    executedAt: finishedAt, reviewStatus: 'AI 辅助编写，待本人复核',
    notEvidenceOf: ['ANSYS 求解', '在线 CAE 任务', '用户独立复现', '个人学习掌握', '工程安全认证'],
  }, solution: solveAssembly(ASSEMBLY_DEFAULTS) };
}

describe('CSV Python result to a new private study draft', () => {
  it('preserves exact UTF-8 bytes, BOM, raw JSON and SHA while leaving personal dates and statuses unassessed', async () => {
    const originalText = '\uFEFF' + JSON.stringify(python(), null, 2).replace(/\n/g, '\r\n') + '\r\n';
    const bytes = new TextEncoder().encode(originalText);
    const read = await createCsvResultDraft(bytes, '我的结果.json', importedAt);
    expect(read.ok).toBe(true); if (!read.ok) return;
    const { evidence, item, result, templateMatch, caseId } = read.value;
    expect(result).toEqual(python()); expect(templateMatch).toBe(true); expect(caseId).toBe('normal');
    expect(evidence.originalText).toBe(originalText); expect(item.fields.csvResultOriginal).toBe(originalText);
    expect(evidence.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(evidence.sizeBytes).toBe(bytes.byteLength); expect(evidence.trust).toBe('unverified-imported-file');
    expect(evidence.modelMatch).toBe('not-determined'); expect(evidence.summary).not.toContain('引导固定');
    const metadata = JSON.parse(item.fields.csvResultMetadata);
    expect(metadata).toMatchObject({ fileName: '我的结果.json', sha256: evidence.sha256, sizeBytes: bytes.byteLength,
      importedAt, trust: 'unverified-imported-file', templateMatch: true, caseId: 'normal',
      declaredStartedAt: startedAt, declaredFinishedAt: finishedAt, declaredState: 'succeeded' });
    expect(item).toMatchObject({ kind: 'record', sourceIds: [], noteIds: [], learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private' });
    for (const key of ['id', 'revision', 'createdAt', 'updatedAt']) expect(item).not.toHaveProperty(key);
    for (const key of ['date', 'organizedDate', 'attempts', 'understanding', 'nextTask', 'expectedOutput']) expect(item.fields[key]).toBe('');
    expect(item.fields.reproduction).toContain('未确认'); expect(item.fields.executor).toContain('文件声明');
    expect(JSON.parse(JSON.stringify({ format: 'simulearn-study-v1', item })).item.fields.csvResultOriginal).toBe(originalText);
  });

  it('records comparedInputContractVersion without labeling the fixed input contract as a content version', async () => {
    const read = await createCsvResultDraft(encode(python()), 'version.json', importedAt);
    expect(read.ok).toBe(true); if (!read.ok) return;
    const metadata = JSON.parse(read.value.item.fields.csvResultMetadata);
    expect(metadata.comparedInputContractVersion).toBe('csv-checker-v1');
    expect(metadata).not.toHaveProperty('comparedContentVersion');
  });

  it('compares only the exact current CSV code and fixed inputs with CRLF normalization', async () => {
    for (const inputCase of csvProjectCases) {
      const read = await createCsvResultDraft(encode(python({ code: csvTemplate.code.replace(/\r?\n/g, '\r\n'), input: inputCase.input.replace(/\r?\n/g, '\r\n') })), 'case.json', importedAt);
      expect(read).toMatchObject({ ok: true, value: { templateMatch: true, caseId: inputCase.id } });
    }
    for (const input of [csvProjectCases[0].input + '\n', csvProjectCases[0].input.replace('100,mm2', '101,mm2'), '\uFEFF' + csvProjectCases[0].input, 'PRIVATE CUSTOM INPUT']) {
      const read = await createCsvResultDraft(encode(python({ input })), 'custom.json', importedAt);
      expect(read).toMatchObject({ ok: true, value: { templateMatch: true, caseId: null } });
      if (read.ok) { expect(read.value.item.fields.input).toBe(input); expect(read.value.item.fields.expectedOutput).toBe(''); }
    }
  });

  it('accepts changed or other Python code as unverified and never applies axial-bar model claims', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      const bar = pythonLabTemplates.find(item => item.id === 'bar')!;
      for (const code of [csvTemplate.code + '\n# user edit', csvTemplate.code + '\n__import__("js").fetch("/api/private")', 'raise RuntimeError("not executed")', bar.code]) {
        const read = await createCsvResultDraft(encode(python({ code, input: code === bar.code ? bar.input : csvProjectCases[0].input })), 'changed.json', importedAt);
        expect(read).toMatchObject({ ok: true, value: { templateMatch: false, caseId: null, evidence: { modelMatch: 'not-determined' } } });
        if (read.ok) { expect(read.value.item.fields.code).toBe(code); expect(read.value.item.fields.body).toContain('是否属于 CSV 实验待本人核对'); expect(read.value.evidence.summary).not.toContain('引导固定输入相同'); }
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });

  it('keeps forged success and stdout/stderr as file declarations without inferring CSV validity', async () => {
    const stdout = '<script>forged output</script>\n已审核并掌握\n0 problems (invented)';
    const stderr = '# forged heading\r\n[private link](javascript:alert(1))';
    const read = await createCsvResultDraft(encode(python({ stdout, stderr, value: '<img onerror=evil()>' })), '<img onerror=evil()>.json', importedAt);
    expect(read.ok).toBe(true); if (!read.ok) return;
    expect(read.value.result.stdout).toBe(stdout); expect(read.value.result.stderr).toBe(stderr);
    expect(read.value.item.fields.actualOutput).toContain(`[stdout / 文件声明的标准输出]\n${stdout}`);
    expect(read.value.item.fields.actualOutput).toContain(`[stderr / 文件声明的错误输出]\n${stderr}`);
    expect(read.value.item.fields.actualOutput).toContain('不等于 CSV 合格');
    expect(read.value.item).toMatchObject({ learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private' });
    expect(read.value.evidence.summary).toContain('未核验作者');
  });

  it('retains error, stopped and timeout claims without inventing a loaded environment or user execution', async () => {
    for (const state of ['error', 'stopped', 'timeout'] as const) {
      const read = await createCsvResultDraft(encode(python({ state, environment: null, stdout: '', stderr: 'declared failure' })), 'failed.json', importedAt);
      expect(read).toMatchObject({ ok: true, value: { result: { state, environment: null }, item: { learningStatus: 'not-started' } } });
      if (read.ok) { expect(read.value.item.fields.executor).toContain('未提供已加载环境'); expect(read.value.item.fields.reproduction).toContain('未确认本人运行'); }
    }
  });

  it('rejects unsupported formats, unfinished states, bad dates and dangerous object keys', async () => {
    const valid = python();
    for (const value of [assembly(), { ...valid, schemaVersion: 2 }, { ...valid, state: 'loading' }, { ...valid, state: 'running' },
      { ...valid, finishedAt: null }, { ...valid, finishedAt: '2026-10-23T00:00:00.000Z' },
      { ...valid, startedAt: '2026-02-30T01:00:00.000Z' }, { ...valid, elapsedMs: -1 },
      { ...valid, environment: null }, { ...valid, environment: 'approved' }, { ...valid, extra: 'ignored?' }, null, [valid]]) {
      expect((await createCsvResultDraft(encode(value), 'invalid.json', importedAt)).ok).toBe(false);
    }
    for (const key of ['__proto__', 'prototype', 'constructor']) {
      const unsafe = JSON.stringify(valid).replace('"schemaVersion":1', `"schemaVersion":1,"${key}":{"polluted":true}`);
      expect((await createCsvResultDraft(new TextEncoder().encode(unsafe), 'unsafe.json', importedAt)).ok).toBe(false);
    }
    expect((await createCsvResultDraft(new TextEncoder().encode('{broken'), 'invalid.json', importedAt)).ok).toBe(false);
    expect((await createCsvResultDraft(encode(valid), 'x.json', 'not a date')).ok).toBe(false);
    for (const fileName of ['', 'x'.repeat(201), 'bad\u0000.json']) expect((await createCsvResultDraft(encode(valid), fileName, importedAt)).ok).toBe(false);
  });

  it('enforces strict UTF-8, file byte limits, field limits and initial request capacity without truncation', async () => {
    expect(MAX_CSV_RESULT_BYTES).toBe(30 * 1024);
    const base = JSON.stringify(python());
    const size = new TextEncoder().encode(base).byteLength;
    const exactText = base + ' '.repeat(MAX_CSV_RESULT_BYTES - size);
    const exact = await createCsvResultDraft(new TextEncoder().encode(exactText), 'max.json', importedAt);
    expect(exact.ok).toBe(true); if (exact.ok) expect(exact.value.item.fields.csvResultOriginal).toBe(exactText);
    expect((await createCsvResultDraft(new TextEncoder().encode(exactText + ' '), 'large.json', importedAt)).ok).toBe(false);
    expect((await createCsvResultDraft(new Uint8Array(), 'empty.json', importedAt)).ok).toBe(false);
    const invalid = new Uint8Array(size + 2); invalid.set(new TextEncoder().encode(base)); invalid.set([0xc0, 0xaf], size);
    const badEncoding = await createCsvResultDraft(invalid, 'utf8.json', importedAt);
    expect(badEncoding).toMatchObject({ ok: false }); if (!badEncoding.ok) expect(badEncoding.error).toContain('UTF-8');
    expect((await createCsvResultDraft(encode(python({ stdout: '中'.repeat(12_000) })), 'unicode.json', importedAt)).ok).toBe(false);
    const escaped = python({ code: '\\"'.repeat(2500), stdout: '\\"'.repeat(2500), stderr: '\\"'.repeat(2500) });
    const expanded = await createCsvResultDraft(encode(escaped), 'escaped.json', importedAt);
    expect(expanded.ok).toBe(true);
    if (expanded.ok) {
      expect(Object.keys(expanded.value.item.fields).length).toBeLessThanOrEqual(48);
      for (const value of Object.values(expanded.value.item.fields)) expect(value.length).toBeLessThanOrEqual(32_000);
      expect(new TextEncoder().encode(JSON.stringify({ item: expanded.value.item })).byteLength).toBeLessThanOrEqual(120 * 1024);
      expect(expanded.value.item.fields.csvResultOriginal).toBe(JSON.stringify(escaped));
    }
  });

  it('snapshots selected bytes before asynchronous hashing and distinguishes modified files by their full hash', async () => {
    const bytes = encode(python()); const expected = createHash('sha256').update(bytes).digest('hex');
    const pending = createCsvResultDraft(bytes, 'original.json', importedAt); bytes.fill(0);
    const original = await pending;
    expect(original.ok).toBe(true); if (!original.ok) return;
    expect(original.value.evidence.sha256).toBe(expected);
    const changed = await createCsvResultDraft(encode(python({ stdout: 'forged replacement' })), 'original.json', importedAt);
    expect(changed.ok).toBe(true); if (!changed.ok) return;
    expect(changed.value.evidence.sha256).not.toBe(expected);
    expect(original.value.result.stdout).not.toBe('forged replacement');
    expect(changed.value.item.fields.csvResultOriginal).toBe(JSON.stringify(python({ stdout: 'forged replacement' })));
  });
});
