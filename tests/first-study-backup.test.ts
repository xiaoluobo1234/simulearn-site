import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import legacyV1 from './fixtures/first-study-v1.json';
import priorRuntimeCheck from '../public/downloads/python-lab/runtime-check.json';
import { firstStudySteps } from '../src/data/first-study-guide';
import { ASSEMBLY_DEFAULTS, solveAssembly } from '../src/lib/assembly-lab';
import { createLabResult, pythonLabTemplates } from '../src/lib/python-lab';
import { createStudyEvidence, type StudyEvidence } from '../src/lib/study-evidence';
import { MAX_FIRST_STUDY_BACKUP_BYTES, readFirstStudyBackup } from '../src/lib/first-study-backup';
import { addStudyEvidence, declareFirstStudy, emptyFirstStudy, exportFirstStudy, finishFirstStudy, firstStudyMarkdown, removeStudyEvidence, startFirstStudy, updateFirstStudy, type FirstStudyDraft, type GuideChange } from '../src/lib/first-study-guide';

const start = '2026-10-25T01:00:00.000Z';
const finish = '2026-10-25T01:00:01.000Z';
const attachmentTime = '2026-10-25T01:01:00.000Z';
const saved = '2026-10-25T01:10:00.000Z';
const restoredAt = '2026-10-25T02:00:00.000Z';
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
function changed(change: GuideChange): FirstStudyDraft { if (!change.ok) throw new Error(change.error); return change.draft; }
function selfReported() {
  let draft = changed(startFirstStudy(emptyFirstStudy(), start));
  for (const step of firstStudySteps) {
    draft = changed(updateFirstStudy(draft, step.field, `测试夹具：${step.title} 尚待本人核对，不代表学习者实际完成。`));
    draft = changed(declareFirstStudy(draft, step.id, true, finish));
  }
  return changed(finishFirstStudy(draft, saved));
}
async function attachments(): Promise<StudyEvidence[]> {
  const template = pythonLabTemplates.find(item => item.id === 'bar')!;
  // Producer helper plus prior recorded Node/WASM stdout; this is an inert import
  // fixture, never evidence that a learner actually ran code in a browser.
  const python = { ...createLabResult(template.code, template.input, start), state: 'succeeded',
    environment: 'CPython 3.14.2 · Pyodide 314.0.7 · WebAssembly / WebWorker',
    finishedAt: finish, elapsedMs: 1000, stdout: priorRuntimeCheck.checks.find(item => item.code === 'axial_bar.py')!.stdout };
  const assembly = { schemaVersion: 1, execution: {
    executor: '当前浏览器 JavaScript 教学计算', runtime: 'JavaScript Number / IEEE 754 float64',
    executedAt: finish, reviewStatus: 'AI 辅助编写，待本人复核',
    notEvidenceOf: ['ANSYS 求解', '在线 CAE 任务', '用户独立复现', '个人学习掌握', '工程安全认证'],
  }, solution: solveAssembly(ASSEMBLY_DEFAULTS) };
  const files = await Promise.all([createStudyEvidence(encode(python), 'python-result.json', attachmentTime), createStudyEvidence(encode(assembly), 'assembly-result.json', attachmentTime)]);
  return files.map(item => { if (!item.ok) throw new Error(item.error); return item.value; });
}
async function restored(value: unknown) { return readFirstStudyBackup(encode(value), 'first-study.json', restoredAt); }

describe('strict private first-study backup restoration', () => {
  it('restores the actual schema 1 export fixture generated with the d927f29 exporter', async () => {
    expect(legacyV1.schemaVersion).toBe(1);
    const selected = new TextEncoder().encode('\uFEFF' + JSON.stringify(legacyV1, null, 2).replace(/\n/g, '\r\n') + '\r\n');
    const result = await readFirstStudyBackup(selected, '旧版学习记录.json', restoredAt);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.draft.fields).toEqual(legacyV1.fields);
    expect(result.draft.declarations).toEqual(legacyV1.declarations);
    expect(result.draft.startedAt).toBeNull(); expect(result.draft.finishedAt).toBeNull();
    expect(result.draft.evidence).toEqual([]);
    expect(result.draft.restoredFrom).toEqual({ fileName: '旧版学习记录.json', sha256: createHash('sha256').update(selected).digest('hex'), sizeBytes: selected.byteLength, importedAt: restoredAt, sourceSchemaVersion: 1 });
    expect(exportFirstStudy(result.draft, restoredAt)).toMatchObject({ schemaVersion: 2, learningCompletion: 'not-assessed', executionEvidence: { status: 'not-verified-by-guide' } });
  });

  it('preserves original explicit times and self-reports rather than creating new clicks or completion', async () => {
    const original = exportFirstStudy(selfReported(), saved);
    const result = await restored(original); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.draft.startedAt).toBe(start); expect(result.draft.finishedAt).toBe(saved);
    expect(result.draft.declarations).toEqual(original.declarations);
    expect(result.draft.fields).toEqual(original.fields);
    expect(result.draft.restoredFrom!.importedAt).toBe(restoredAt);
    expect(exportFirstStudy(result.draft, restoredAt)).toMatchObject({ sessionStatus: 'ended', learningCompletion: 'not-assessed', visibility: 'private-local-export', reviewStatus: 'draft-pending-human-review' });
  });

  it('round-trips both known producer file shapes, exact original text, hashes and restore provenance', async () => {
    let draft = emptyFirstStudy();
    const files = await attachments();
    for (const file of files) draft = changed(addStudyEvidence(draft, file));
    draft = changed(updateFirstStudy(draft, 'environment', '夹具自述，未经核验。'));
    const data = exportFirstStudy(draft, saved);
    const result = await restored(data); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.draft.evidence).toEqual(files); expect(result.draft.fields).toEqual(draft.fields);
    expect(result.draft.restoredFrom?.sourceSchemaVersion).toBe(2);
    const resaved = exportFirstStudy(result.draft, restoredAt);
    expect(resaved.evidence).toEqual(files); expect(resaved.restoredFrom).toEqual(result.draft.restoredFrom);
    expect((await readFirstStudyBackup(encode(resaved), 'resaved.json', '2026-10-25T03:00:00.000Z')).ok).toBe(true);
    resaved.evidence[0].originalText = 'changed export'; resaved.restoredFrom!.fileName = 'changed export';
    expect(result.draft.evidence[0].originalText).toBe(files[0].originalText); expect(result.draft.restoredFrom!.fileName).toBe('first-study.json');
  });

  it('reparses all derived attachment claims instead of trusting uploaded summaries or status', async () => {
    const draft = emptyFirstStudy(); draft.evidence = await attachments();
    const original = draft.evidence[0]; const data = exportFirstStudy(draft, saved);
    data.evidence[0].declaredStatus = 'verified-user-completion'; data.evidence[0].declaredEnvironment = 'claimed verified production';
    data.evidence[0].modelMatch = 'different-input'; data.evidence[0].summary = 'forged system-approved result';
    const result = await restored(data); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.draft.evidence[0]).toEqual(original);
    expect(result.draft.evidence[0].trust).toBe('unverified-imported-file');
    expect(result.draft.evidence[0].summary).toContain('未核验');
  });

  it('rejects edited original text, hash, byte size, evidence identity and elevated trust', async () => {
    const draft = emptyFirstStudy(); draft.evidence = await attachments();
    const original = exportFirstStudy(draft, saved);
    const mutations = [
      (data: typeof original) => { data.evidence[0].originalText += '\n'; },
      (data: typeof original) => { data.evidence[0].sha256 = '0'.repeat(64); },
      (data: typeof original) => { data.evidence[0].sizeBytes += 1; },
      (data: typeof original) => { data.evidence[0].id = `python:${'0'.repeat(64)}`; },
      (data: typeof original) => { data.evidence[0].trust = 'verified' as 'unverified-imported-file'; },
    ];
    for (const mutate of mutations) { const data = structuredClone(original); mutate(data); expect((await restored(data)).ok).toBe(false); }
    expect(original.evidence).toEqual(draft.evidence);
  });

  it('rejects duplicate attachments and a second file of the same kind', async () => {
    const draft = emptyFirstStudy(); draft.evidence = await attachments();
    const data = exportFirstStudy(draft, saved);
    data.evidence = [data.evidence[0], structuredClone(data.evidence[0])];
    expect((await restored(data)).ok).toBe(false);
    (data.evidence as unknown[]).push(data.evidence[0]);
    expect((await restored(data)).ok).toBe(false);
  });

  it('bounds byte size, enforces UTF-8, rejects unsafe file names and never silently repairs bytes', async () => {
    expect(MAX_FIRST_STUDY_BACKUP_BYTES).toBe(2 * 1024 * 1024);
    for (const bytes of [new Uint8Array(), new Uint8Array(MAX_FIRST_STUDY_BACKUP_BYTES + 1), new Uint8Array([0xc0, 0xaf])]) expect((await readFirstStudyBackup(bytes, 'backup.json', restoredAt)).ok).toBe(false);
    for (const name of ['', '   ', 'x'.repeat(201), 'evil\u0000.json', 'evil\rname.json', 'evil\nname.json']) expect((await readFirstStudyBackup(encode(legacyV1), name, restoredAt)).ok).toBe(false);
    for (const date of ['', '2026-10-25', 'yesterday', '2026-02-30T02:00:00.000Z']) expect((await readFirstStudyBackup(encode(legacyV1), 'valid.json', date)).ok).toBe(false);
    expect((await readFirstStudyBackup(new TextEncoder().encode('\uFEFF\uFEFF' + JSON.stringify(legacyV1)), 'backup.json', restoredAt)).ok).toBe(false);
  });

  it('rejects unknown and prototype keys rather than assigning them into the current draft', async () => {
    for (const value of [
      { ...legacyV1, extra: 'unsupported' }, { ...legacyV1, schemaVersion: 3 },
      { ...legacyV1, fields: { ...legacyV1.fields, ignored: '' } },
      { ...legacyV1, environment: { ...legacyV1.environment, extra: true } },
    ]) expect((await restored(value)).ok).toBe(false);
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const text = JSON.stringify(legacyV1).replace('"fields":{', `"fields":{"${key}":{},`);
      expect((await readFirstStudyBackup(new TextEncoder().encode(text), 'backup.json', restoredAt)).ok).toBe(false);
    }
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it('binds immutable versions, inputs, units, case, assumptions, review and visibility', async () => {
    const original = exportFirstStudy(emptyFirstStudy(), saved);
    const mutations = [
      (value: any) => { value.guideVersion = 'first-study-v2'; },
      (value: any) => { value.contentVersions.labs = 'labs-v2'; },
      (value: any) => { value.contentVersions.extra = 'unknown'; },
      (value: any) => { value.fixedCase.slug = 'cantilever'; },
      (value: any) => { value.fixedCase.inputs.E.value = 1; },
      (value: any) => { value.fixedCase.inputs.E.unit = 'MPa'; },
      (value: any) => { value.fixedCase.assembly.L1 = 1; },
      (value: any) => { value.fixedCase.assumptions.pop(); },
      (value: any) => { value.fixedCase.limits.push('extra'); },
      (value: any) => { value.fixedCase.sourceInput = 'https://example.com/model.json'; },
      (value: any) => { value.reviewStatus = 'approved'; },
      (value: any) => { value.visibility = 'public'; },
      (value: any) => { value.learningCompletion = 'completed'; },
      (value: any) => { value.executionEvidence.status = 'verified'; },
    ];
    for (const mutate of mutations) { const data = structuredClone(original); mutate(data); expect((await restored(data)).ok).toBe(false); }
  });

  it('requires all five bounded text fields and matching unverified environment statements', async () => {
    for (const field of Object.keys(legacyV1.fields)) {
      const invalid = structuredClone(legacyV1) as any; invalid.fields[field] = 'x'.repeat(2001);
      expect((await restored(invalid)).ok).toBe(false);
      delete invalid.fields[field]; expect((await restored(invalid)).ok).toBe(false);
    }
    const written = exportFirstStudy(changed(updateFirstStudy(emptyFirstStudy(), 'environment', '未运行')), saved);
    written.environment.status = 'not-provided'; expect((await restored(written)).ok).toBe(false);
    const hidden = structuredClone(legacyV1); hidden.environment.statement = 'verified'; expect((await restored(hidden)).ok).toBe(false);
  });

  it('rejects incoherent declarations, incomplete finish and malformed or backwards claim times', async () => {
    const original = exportFirstStudy(selfReported(), saved);
    const mutations = [
      (value: any) => { value.declarations.predict.selfReported = 'true'; },
      (value: any) => { value.declarations.predict.declaredAt = null; },
      (value: any) => { value.declarations.predict.selfReported = false; },
      (value: any) => { value.fields.prediction = '   '; },
      (value: any) => { value.declarations.predict.declaredAt = 'today'; },
      (value: any) => { value.declarations.predict.declaredAt = '2026-10-25T01:00:01Z'; },
      (value: any) => { value.startedAt = '2026-10-25T01:00:00.000+00:00'; },
      (value: any) => { value.finishedAt = start; },
      (value: any) => { value.startedAt = restoredAt; },
      (value: any) => { value.recordedAt = start; },
      (value: any) => { value.sessionStatus = 'in-progress'; },
    ];
    for (const mutate of mutations) { const data = structuredClone(original); mutate(data); expect((await restored(data)).ok).toBe(false); }
    const noStart = structuredClone(original); noStart.startedAt = null;
    expect((await restored(noStart)).ok).toBe(true);
    const noFinish = exportFirstStudy(emptyFirstStudy(), saved); noFinish.sessionStatus = 'ended';
    expect((await restored(noFinish)).ok).toBe(false);
  });

  it('validates existing restore metadata but identifies the currently selected source bytes anew', async () => {
    const first = await restored(exportFirstStudy(emptyFirstStudy(), saved)); if (!first.ok) throw new Error(first.error);
    const original = exportFirstStudy(first.draft, restoredAt);
    for (const mutate of [
      (value: any) => { value.restoredFrom.sha256 = 'bad'; },
      (value: any) => { value.restoredFrom.sourceSchemaVersion = 9; },
      (value: any) => { value.restoredFrom.fileName = 'bad\nfilename'; },
      (value: any) => { value.restoredFrom.importedAt = 'tomorrow'; },
      (value: any) => { value.restoredFrom.sizeBytes = 0; },
      (value: any) => { value.restoredFrom.importedAt = '2026-10-26T01:00:00.000Z'; },
    ]) { const invalid = structuredClone(original); mutate(invalid); expect((await restored(invalid)).ok).toBe(false); }
    const selected = encode(original); const second = await readFirstStudyBackup(selected, 'second-backup.json', '2026-10-25T03:00:00.000Z');
    expect(second.ok).toBe(true); if (!second.ok) return;
    expect(second.draft.restoredFrom).toMatchObject({ fileName: 'second-backup.json', sourceSchemaVersion: 2, sha256: createHash('sha256').update(selected).digest('hex') });
    expect(second.draft.restoredFrom!.sha256).not.toBe(first.draft.restoredFrom!.sha256);
  });

  it('does not call network, execute original code or mutate an existing draft on failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('must not request network'); });
    const current = selfReported(); const snapshot = structuredClone(current);
    try {
      expect((await restored({ ...exportFirstStudy(current, saved), schemaVersion: 99 })).ok).toBe(false);
      const files = await attachments(); const selected = changed(addStudyEvidence(current, files[0]));
      expect((await restored(exportFirstStudy(selected, saved))).ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled(); expect(current).toEqual(snapshot);
    } finally { fetchSpy.mockRestore(); }
  });
});

describe('file changes are independent from learning declarations', () => {
  it('clones attachment state, rejects duplicates and invalidates only related declarations plus evidence and finish', async () => {
    const files = await attachments(); const original = selfReported();
    const attached = changed(addStudyEvidence(original, files[0]));
    expect(original.evidence).toEqual([]); expect(original.finishedAt).toBe(saved);
    expect(attached.fields).toEqual(original.fields); expect(attached.startedAt).toBe(start); expect(attached.finishedAt).toBeNull();
    expect(attached.declarations.python).toEqual({ selfReported: false, declaredAt: null });
    expect(attached.declarations.evidence).toEqual({ selfReported: false, declaredAt: null });
    expect(attached.declarations.predict).toEqual(original.declarations.predict); expect(attached.declarations.assembly).toEqual(original.declarations.assembly);
    expect(addStudyEvidence(attached, files[0]).ok).toBe(false);
    expect(addStudyEvidence(attached, { ...files[0], id: 'python:other', sha256: '0'.repeat(64) }).ok).toBe(false);
    files[0].fileName = 'changed caller'; expect(attached.evidence[0].fileName).toBe('python-result.json');
    const both = changed(addStudyEvidence(attached, files[1])); expect(both.evidence).toHaveLength(2);
    expect(both.declarations.assembly.selfReported).toBe(false);
    expect(removeStudyEvidence(both, 'unknown' as 'python').ok).toBe(false);
    let confirmed = both;
    for (const step of firstStudySteps) confirmed = changed(declareFirstStudy(confirmed, step.id, true, saved));
    confirmed = changed(finishFirstStudy(confirmed, saved));
    const removed = changed(removeStudyEvidence(confirmed, 'assembly'));
    expect(removed.evidence).toHaveLength(1); expect(removed.declarations.assembly.selfReported).toBe(false); expect(removed.declarations.evidence.selfReported).toBe(false);
    expect(removed.declarations.python.selfReported).toBe(true); expect(removed.finishedAt).toBeNull();
    expect(removeStudyEvidence(removed, 'assembly').ok).toBe(false);
  });

  it('keeps raw original code in JSON only and indents all file names, claims, summaries and lone CR lines in Markdown', async () => {
    const draft = emptyFirstStudy(); const files = await attachments(); draft.evidence = [files[0]];
    draft.evidence[0].fileName = '[private](https://example.com).json';
    draft.evidence[0].summary = '# forged heading\r[private](https://example.com)\n<script>unsafe()</script>';
    draft.restoredFrom = { fileName: '<img src=x onerror=unsafe()>', sha256: 'a'.repeat(64), sizeBytes: 12, importedAt: restoredAt, sourceSchemaVersion: 2 };
    draft.fields.prediction = 'first\r# injected heading';
    const markdown = firstStudyMarkdown(draft, restoredAt);
    expect(markdown).toContain('    文件名：[private](https://example.com).json');
    expect(markdown).toContain('    文件名：<img src=x onerror=unsafe()>');
    expect(markdown).toContain('    first\n    # injected heading');
    expect(markdown).not.toContain('\n# injected heading');
    expect(markdown).not.toContain(files[0].originalText);
    expect(markdown).toContain('散列用于识别字节内容，不证明来源或真实性');
    expect(markdown).toContain('不是本次的新点击');
    expect(exportFirstStudy(draft, restoredAt).evidence[0].originalText).toBe(files[0].originalText);
  });
});
