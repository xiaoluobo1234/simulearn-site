import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createLabResult, pythonLabTemplates } from '../src/lib/python-lab';
import { ASSEMBLY_DEFAULTS, solveAssembly } from '../src/lib/assembly-lab';
import { createStudyEvidence, MAX_EVIDENCE_BYTES, MAX_STUDY_EVIDENCE, readStudyEvidence, restoreStudyEvidence } from '../src/lib/study-evidence';

const startedAt = '2026-10-25T01:00:00.000Z';
const finishedAt = '2026-10-25T01:00:01.000Z';
const importedAt = '2026-10-25T01:01:00.000Z';
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
function python() {
  const template = pythonLabTemplates.find(item => item.id === 'bar')!;
  return { ...createLabResult(template.code, template.input, startedAt), state: 'succeeded',
    environment: 'CPython 3.14.2 · Pyodide 314.0.7 · WebAssembly / WebWorker',
    finishedAt, elapsedMs: 1000, stdout: '端位移 = 0.476190476 mm\n左端反力 = -10000.000000 N\n' };
}
function assembly() {
  return { schemaVersion: 1, execution: {
    executor: '当前浏览器 JavaScript 教学计算', runtime: 'JavaScript Number / IEEE 754 float64',
    executedAt: finishedAt, reviewStatus: 'AI 辅助编写，待本人复核',
    notEvidenceOf: ['ANSYS 求解', '在线 CAE 任务', '用户独立复现', '个人学习掌握', '工程安全认证'],
  }, solution: solveAssembly(ASSEMBLY_DEFAULTS) };
}

describe('selected local lab evidence files', () => {
  it('recognizes actual producer shapes and labels all outputs as imported declarations', () => {
    expect(MAX_EVIDENCE_BYTES).toBe(256 * 1024); expect(MAX_STUDY_EVIDENCE).toBe(2);
    const py = readStudyEvidence(JSON.stringify(python()));
    expect(py).toMatchObject({ ok: true, value: { kind: 'python', declaredStatus: 'succeeded', modelMatch: 'matches-guide-input' } });
    if (py.ok) { expect(py.value.summary).toContain('未执行代码'); expect(py.value.summary).toContain('未核验'); }
    const bars = readStudyEvidence(JSON.stringify(assembly()));
    expect(bars).toMatchObject({ ok: true, value: { kind: 'assembly', modelMatch: 'matches-guide-input' } });
    if (bars.ok) { expect(bars.value.summary).toContain('文件声明'); expect(bars.value.summary).toContain('未重新求解'); }
  });

  it('compares only untouched official Python code and complete values plus exact units', () => {
    const original = python();
    expect(readStudyEvidence(JSON.stringify({ ...original, code: original.code.replace(/\r\n/g, '\n') }))).toMatchObject({ ok: true, value: { modelMatch: 'matches-guide-input' } });
    for (const code of ['print("forged output")', `${original.code}\n# changed`, `${original.code}\n__import__("js").fetch("/api/learning/records")`]) {
      expect(readStudyEvidence(JSON.stringify({ ...original, code }))).toMatchObject({ ok: true, value: { modelMatch: 'not-determined' } });
    }
    const input = JSON.parse(original.input);
    input.P.value = -10000;
    expect(readStudyEvidence(JSON.stringify({ ...original, input: JSON.stringify(input) }))).toMatchObject({ ok: true, value: { modelMatch: 'different-input' } });
    input.P.value = 10000; input.E.unit = 'MPa';
    expect(readStudyEvidence(JSON.stringify({ ...original, input: JSON.stringify(input) }))).toMatchObject({ ok: true, value: { modelMatch: 'different-input' } });
    for (const badInput of ['not JSON', '{}', '{"E":true}', JSON.stringify({ ...JSON.parse(original.input), extra: 'ignored by Python' })]) {
      expect(readStudyEvidence(JSON.stringify({ ...original, input: badInput }))).toMatchObject({ ok: true, value: { modelMatch: 'not-determined' } });
    }
  });

  it('preserves errors, stop and timeout without inventing a completed run or loaded environment', () => {
    for (const state of ['error', 'stopped', 'timeout']) {
      const result = readStudyEvidence(JSON.stringify({ ...python(), state, environment: null, stderr: '<script>not executed</script>', stdout: '' }));
      expect(result).toMatchObject({ ok: true, value: { declaredStatus: state, declaredEnvironment: null } });
      if (result.ok) expect(result.value.summary).toContain('未确认代码运行');
    }
    for (const state of ['loading', 'running', 'approved', '', null]) expect(readStudyEvidence(JSON.stringify({ ...python(), state })).ok).toBe(false);
    expect(readStudyEvidence(JSON.stringify({ ...python(), environment: null })).ok).toBe(false);
    expect(readStudyEvidence(JSON.stringify({ ...python(), finishedAt: null })).ok).toBe(false);
  });

  it('preserves UTF-8 BOM, line endings and all original bytes in the SHA-256 attachment', async () => {
    const originalText = '\uFEFF' + JSON.stringify(python(), null, 2).replace(/\n/g, '\r\n') + '\r\n';
    const bytes = new TextEncoder().encode(originalText);
    const result = await createStudyEvidence(bytes, '私人的结果.json', importedAt);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.originalText).toBe(originalText);
    expect(result.value.sizeBytes).toBe(bytes.byteLength);
    expect(result.value.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(result.value.id).toBe(`python:${result.value.sha256}`);
    expect(result.value.trust).toBe('unverified-imported-file');
    expect(await restoreStudyEvidence(result.value)).toEqual(result);
  });

  it('rejects invalid UTF-8 rather than replacing it before hashing or reading', async () => {
    const bytes = encode(python());
    const invalid = new Uint8Array(bytes.length + 2); invalid.set(bytes); invalid.set([0xc0, 0xaf], bytes.length);
    const result = await createStudyEvidence(invalid, 'bad.json', importedAt);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('UTF-8');
    for (const name of ['', 'x'.repeat(201), 'bad\u0000.json']) expect((await createStudyEvidence(bytes, name, importedAt)).ok).toBe(false);
    expect((await createStudyEvidence(bytes, 'result.json', 'yesterday')).ok).toBe(false);
    expect((await createStudyEvidence(new Uint8Array(), 'result.json', importedAt)).ok).toBe(false);
  });

  it('enforces byte and field limits independently, including multibyte text', async () => {
    const original = python();
    for (const [key, limit] of [['code', 64000], ['input', 64000], ['stdout', 32000], ['stderr', 32000], ['value', 4000], ['limitation', 2000]] as const) {
      expect(readStudyEvidence(JSON.stringify({ ...original, [key]: 'a'.repeat(limit + 1) })).ok, key).toBe(false);
    }
    expect(readStudyEvidence(JSON.stringify({ ...original, code: '中'.repeat(64000), input: '中'.repeat(64000) })).ok).toBe(false);
    expect((await createStudyEvidence(new Uint8Array(MAX_EVIDENCE_BYTES + 1), 'result.json', importedAt)).ok).toBe(false);
    expect(readStudyEvidence(JSON.stringify({ ...original, stdout: 'x'.repeat(32000), stderr: 'x'.repeat(32000), value: 'x'.repeat(4000) })).ok).toBe(true);
  });

  it('rejects unsupported fields, dangerous prototype keys, unknown schemas and invalid numeric/date claims', () => {
    for (const value of [{ ...python(), schemaVersion: 2 }, { ...python(), unsupported: 'private extra' },
      { ...python(), elapsedMs: -1 }, { ...python(), elapsedMs: 1.5 }, { ...python(), elapsedMs: null },
      { ...python(), finishedAt: '2026-10-24T01:00:00.000Z' }, { ...python(), executor: 'ANSYS' },
      { ...python(), environment: '工程认证通过' }, { schemaVersion: 1 }, [python()]]) expect(readStudyEvidence(JSON.stringify(value)).ok).toBe(false);
    const unsafe = JSON.stringify(python()).replace('"schemaVersion":1', '"schemaVersion":1,"__proto__":{"polluted":true}');
    expect(readStudyEvidence(unsafe).ok).toBe(false);
    expect(readStudyEvidence(JSON.stringify({ ...python(), constructor: 'bad' })).ok).toBe(false);
    const deep = `${'['.repeat(70)}0${']'.repeat(70)}`;
    expect(readStudyEvidence(deep).ok).toBe(false);
    expect(readStudyEvidence(JSON.stringify({ ...python(), extra: Array(1001).fill(1) })).ok).toBe(false);
    expect(readStudyEvidence(JSON.stringify(python()).replace('"elapsedMs":1000', '"elapsedMs":1e309')).ok).toBe(false);
  });

  it('rejects incorrect assembly dimensions or unsupported inputs before deriving a comparison', () => {
    const different = assembly(); different.solution.model.inputs.P = 9000;
    expect(readStudyEvidence(JSON.stringify(different))).toMatchObject({ ok: true, value: { modelMatch: 'different-input' } });
    const mutate = (change: (value: ReturnType<typeof assembly>) => void) => { const value = assembly(); change(value); return readStudyEvidence(JSON.stringify(value)); };
    expect(mutate(value => { value.solution.model.K = [[1]]; }).ok).toBe(false);
    expect(mutate(value => { value.solution.displacement = [0, 1]; }).ok).toBe(false);
    expect(mutate(value => { value.solution.model.local = [[[1]], [[1]]]; }).ok).toBe(false);
    expect(mutate(value => { value.solution.model.inputs.constraint = 'free'; }).ok).toBe(false);
    expect(mutate(value => { value.solution.model.inputs.E = 0; }).ok).toBe(false);
    expect(mutate(value => { value.solution.model.inputs.P = Number.NaN; }).ok).toBe(false);
    expect(mutate(value => { value.solution.strainEnergy = -1; }).ok).toBe(false);
    expect(mutate(value => { value.solution.freeDofs = [0, 2] as unknown as [1, 2]; }).ok).toBe(false);
    expect(mutate(value => { value.execution.notEvidenceOf = []; }).ok).toBe(false);
    expect(mutate(value => { Object.assign(value.solution, { unsupported: 1 }); }).ok).toBe(false);
  });

  it('does not certify or repair forged finite outputs, even when the inputs match', () => {
    const value = assembly(); value.solution.displacement[2] = 123456;
    const result = readStudyEvidence(JSON.stringify(value));
    expect(result).toMatchObject({ ok: true, value: { modelMatch: 'matches-guide-input' } });
    if (result.ok) { expect(result.value.summary).toContain('文件声明端位移 u₂=123456'); expect(result.value.summary).toContain('未重新求解或核验'); }
  });

  it('re-hashes restored original text and replaces all backup-supplied derived summaries', async () => {
    const created = await createStudyEvidence(encode(python()), '../../<img onerror=alert(1)>.json', importedAt);
    expect(created.ok).toBe(true); if (!created.ok) return;
    const original = created.value;
    const fake = { ...original, summary: '已经核验成功并掌握', declaredStatus: 'approved', declaredEnvironment: 'ANSYS', modelMatch: 'different-input' };
    expect(await restoreStudyEvidence(fake)).toEqual(created);
    for (const patch of [
      { originalText: original.originalText + '\n' }, { sha256: '0'.repeat(64) }, { sizeBytes: original.sizeBytes + 1 },
      { id: 'python:forged' }, { kind: 'assembly' }, { trust: 'verified' }, { extra: true },
    ]) expect((await restoreStudyEvidence({ ...original, ...patch })).ok).toBe(false);
  });

  it('snapshots the selected bytes before the asynchronous digest', async () => {
    const bytes = encode(python()); const expected = createHash('sha256').update(bytes).digest('hex');
    const pending = createStudyEvidence(bytes, 'result.json', importedAt); bytes.fill(0);
    const result = await pending; expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sha256).toBe(expected);
  });
});
