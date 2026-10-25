import { describe, expect, it } from 'vitest';
import input from '../public/downloads/linear-static/uniform-bar/input.json';
import { firstStudyGuide, firstStudySteps } from '../src/data/first-study-guide';
import { ASSEMBLY_DEFAULTS, solveAssembly } from '../src/lib/assembly-lab';
import { pythonLabTemplates } from '../src/lib/python-lab';
import { linearStaticBenchmarks } from '../src/data/linear-static-benchmarks';
import { emptyFirstStudy, updateFirstStudy, declareFirstStudy, startFirstStudy, finishFirstStudy, exportFirstStudy, firstStudyMarkdown, type FirstStudyDraft, type GuideChange } from '../src/lib/first-study-guide';

const start = '2026-10-25T01:00:00.000Z';
const end = '2026-10-25T01:02:00.000Z';
function value(change: GuideChange): FirstStudyDraft { if (!change.ok) throw Error(change.error); return change.draft; }
function declaredDraft() {
  let draft = emptyFirstStudy();
  for (const step of firstStudySteps) {
    draft = value(updateFirstStudy(draft, step.field, `${step.title}：本次没有执行，已记下受阻原因。`));
    draft = value(declareFirstStudy(draft, step.id, true, start));
  }
  return draft;
}

describe('first study guide records explicit self-reports without inventing execution', () => {
  it('keeps the actual linked Python template, assembly defaults and original benchmark on the same model', () => {
    const python = JSON.parse(pythonLabTemplates.find(item => item.id === 'bar')!.input);
    for (const name of ['E','A','L','P'] as const) expect(python[name].value).toBe(firstStudyGuide.inputs[name].value);
    const {constraint,...parameters} = ASSEMBLY_DEFAULTS;
    expect(constraint).toBe('fixed'); expect(parameters).toEqual(firstStudyGuide.assembly);
    const result = solveAssembly(ASSEMBLY_DEFAULTS);
    const quantities = Object.fromEntries(linearStaticBenchmarks.find(item => item.slug === firstStudyGuide.caseSlug)!.quantities.map(item => [item.id,item.value]));
    expect(result.displacement[2]).toBeCloseTo(quantities['tip-displacement'],10);
    expect(result.reactionAndResidual[0]).toBeCloseTo(quantities['reaction-force'],8);
    expect(result.strainEnergy).toBeCloseTo(quantities['strain-energy'],8);
  });
  it('derives all fixed inputs and two-element lengths from the existing downloadable source', () => {
    expect(firstStudyGuide.inputs.E.value).toBe(input.E_MPa);
    expect(firstStudyGuide.inputs.A.value).toBe(input.segments[0].area_mm2);
    expect(firstStudyGuide.inputs.L.value).toBe(input.segments[0].length_mm);
    expect(firstStudyGuide.inputs.P.value).toBe(input.end_force_N);
    expect(firstStudyGuide.assembly.L1 + firstStudyGuide.assembly.L2).toBe(input.segments[0].length_mm);
    expect(firstStudyGuide.assembly.A1).toBe(firstStudyGuide.assembly.A2);
    expect(firstStudyGuide).not.toHaveProperty('answers');
    expect(firstStudyGuide).not.toHaveProperty('quantities');
  });
  it('starts with empty fields, unknown environment and no start, finish or declared times', () => {
    const draft = emptyFirstStudy(); const result = exportFirstStudy(draft, end);
    expect(Object.values(draft.fields).every(text => text === '')).toBe(true);
    expect(Object.values(draft.declarations).every(item => item.selfReported === false && item.declaredAt === null)).toBe(true);
    expect(result).toMatchObject({ startedAt: null, finishedAt: null, sessionStatus: 'in-progress', learningCompletion: 'not-assessed', environment: { status: 'not-provided' }, executionEvidence: { status: 'not-verified-by-guide' }, reviewStatus: 'draft-pending-human-review' });
    expect(result).not.toHaveProperty('completion');
    expect(result).not.toHaveProperty('learningStatus'); expect(result).not.toHaveProperty('passed');
  });
  it('does not change the original draft, does not truncate text and bounds every field', () => {
    const draft = emptyFirstStudy();
    const result = value(updateFirstStudy(draft, 'prediction', 'x'.repeat(2000)));
    expect(result.fields.prediction).toHaveLength(2000); expect(draft.fields.prediction).toBe('');
    for (const field of Object.keys(draft.fields)) expect(updateFirstStudy(draft, field as keyof typeof draft.fields, 'x'.repeat(2001)).ok).toBe(false);
    expect(updateFirstStudy(draft, 'unknown' as 'prediction', 'text').ok).toBe(false);
  });
  it('requires a real written observation before explicit checking and never checks from text alone', () => {
    const draft = emptyFirstStudy();
    expect(declareFirstStudy(draft, 'predict', true, start).ok).toBe(false);
    const written = value(updateFirstStudy(draft, 'prediction', '我还不能解释方向。'));
    expect(written.declarations.predict).toEqual({ selfReported: false, declaredAt: null });
    const checked = value(declareFirstStudy(written, 'predict', true, start));
    expect(checked.declarations.predict).toEqual({ selfReported: true, declaredAt: start });
    expect(value(declareFirstStudy(checked, 'predict', true, end)).declarations.predict.declaredAt).toBe(start);
    expect(value(declareFirstStudy(checked, 'predict', false, end)).declarations.predict).toEqual({ selfReported: false, declaredAt: null });
    expect(checked.declarations.predict.selfReported).toBe(true);
  });
  it('records start and finish only on explicit operations and allows a self-report without a fabricated start', () => {
    const untouched = emptyFirstStudy(); const started = value(startFirstStudy(untouched, start));
    expect(untouched.startedAt).toBeNull(); expect(started.startedAt).toBe(start);
    expect(startFirstStudy(started, end).ok).toBe(false); expect(finishFirstStudy(started, end).ok).toBe(false);
    const draft = declaredDraft(); expect(draft.finishedAt).toBeNull();
    const finished = value(finishFirstStudy(draft, end));
    expect(finished.startedAt).toBeNull(); expect(finished.finishedAt).toBe(end);
    expect(exportFirstStudy(finished, end)).toMatchObject({ sessionStatus: 'ended', learningCompletion: 'not-assessed' });
    expect(exportFirstStudy(finished, end)).not.toHaveProperty('completion');
    expect(firstStudyMarkdown(finished, end)).toContain('自述记录：已结束；任务是否完成：未判定。');
    expect(exportFirstStudy(finished, end).executionEvidence.status).toBe('not-verified-by-guide');
    expect(finishFirstStudy(finished, end).ok).toBe(false); expect(startFirstStudy(finished, end).ok).toBe(false);
  });
  it('invalidates stale declarations and finish when associated text changes or a step is unchecked', () => {
    const finished = value(finishFirstStudy(declaredDraft(), end));
    const edited = value(updateFirstStudy(finished, 'assemblyObservation', '改为：尚未求解。'));
    expect(edited.finishedAt).toBeNull(); expect(edited.declarations.assembly).toEqual({ selfReported: false, declaredAt: null });
    expect(edited.declarations.python).toEqual(finished.declarations.python);
    expect(finishFirstStudy(edited, end).ok).toBe(false);
    expect(value(updateFirstStudy(finished, 'environment', '尚未执行')).finishedAt).toBeNull();
    expect(value(declareFirstStudy(finished, 'predict', false, end)).finishedAt).toBeNull();
    expect(finished.finishedAt).toBe(end);
  });
  it('rejects missing, invalid and backwards times and makes a fresh draft truly independent', () => {
    const draft = declaredDraft();
    for (const date of ['', 'not-a-date', '2026-10-25', '2026-10-25T00:00:00.000Z']) expect(finishFirstStudy(draft, date).ok).toBe(false);
    expect(startFirstStudy(emptyFirstStudy(), 'not-a-date').ok).toBe(false);
    expect(declareFirstStudy(draft, 'predict', true, 'not-a-date').ok).toBe(false);
    expect(() => exportFirstStudy(draft, 'not-a-date')).toThrow();
    const clean = emptyFirstStudy(); clean.declarations.predict.selfReported = true;
    expect(emptyFirstStudy().declarations.predict.selfReported).toBe(false);
  });
  it('exports versions, assumptions, original text and self-report provenance without numeric-answer duplication', () => {
    let draft = declaredDraft(); draft = value(updateFirstStudy(draft, 'environment', '本人自述：浏览器输出文件尚未核对。'));
    const exported = exportFirstStudy(draft, end);
    expect(exported.contentVersions).toEqual({ guide: 'first-study-v1', benchmark: 'linear-static-v1', labs: 'labs-v1' });
    expect(exported.fixedCase.assumptions).toEqual(firstStudyGuide.assumptions);
    expect(exported.environment.status).toBe('learner-self-report-unverified');
    expect(exported.fields).toEqual(draft.fields);
    exported.fields.prediction = 'export change'; exported.declarations.predict.declaredAt = end;
    expect(draft.fields.prediction).not.toBe('export change'); expect(draft.declarations.predict.declaredAt).toBe(start);
    expect(exported.fixedCase).not.toHaveProperty('referenceValues');
  });
  it('preserves user text as indented Markdown text rather than injecting new headings or links', () => {
    const draft = value(updateFirstStudy(emptyFirstStudy(), 'prediction', '# forged heading\n```\n<script>unsafe()</script>\n[private](https://example.com)'));
    const markdown = firstStudyMarkdown(draft, end);
    expect(markdown).toContain('    # forged heading\n    ```\n    <script>unsafe()</script>\n    [private](https://example.com)');
    expect(markdown).not.toContain('\n# forged heading');
    expect(markdown).toContain('显式开始时间：未记录'); expect(markdown).toContain('显式结束时间：未记录');
    expect(markdown).toContain('自述记录：未结束；任务是否完成：未判定。');
    expect(markdown).toContain('不是经系统验证的课程完成');
  });
});
