import { describe, expect, it, vi } from 'vitest';
import type { StudyItem } from '../src/data/study-schema';
import {
  PRACTICE_CATALOG_VERSION, blankProjectPractice, checkProjectPractice, isPracticeReferenceHref,
  parsePracticeNumber, parseProjectPractice, projectPracticeJson, projectPracticeMarkdown,
  readPracticeCatalog, readPracticeStudyItem, toPracticeStudyItem, validateProjectPractice,
  type PracticeCatalog, type ProjectPractice,
} from '../src/lib/project-practice';

function catalog(): PracticeCatalog {
  return { version: PRACTICE_CATALOG_VERSION, cases: [{
    slug: 'uniform-bar', title: '均匀杆轴向拉伸', href: '/cases/benchmarks/uniform-bar/', quantities: [
      { id: 'tip-displacement', label: '端部位移', value: 10 / 21, unit: 'mm', absoluteTolerance: 0.000001, relativeTolerance: 0.00001, explanation: '线弹性均匀杆 PL/(EA)，小变形、单轴拉伸。' },
      { id: 'reaction-force', label: '左端反力', value: -10000, unit: 'N', absoluteTolerance: 0.001, relativeTolerance: 0.000001, explanation: '向右为正，固定端反力为 -P。' },
      { id: 'strain-energy', label: '应变能', value: 50000 / 21, unit: 'N·mm', absoluteTolerance: 0.001, relativeTolerance: 0.00001, explanation: '从零比例加载 U=Pδ/2。' },
    ],
  }] };
}
function practice(overrides: Partial<ProjectPractice> = {}): ProjectPractice {
  return { ...blankProjectPractice('uniform-bar'), ...overrides };
}
function correct(): ProjectPractice {
  return practice({ answers: { 'tip-displacement': '4.7619047619e-1', 'reaction-force': '-1e4', 'strain-energy': '2380.952380952381' }, concept: 'not-proof' });
}
const id = 'record-7090f4a3-87f2-41b1-9ace-c61e90b48f85';
function saved(overrides: Partial<StudyItem> = {}): StudyItem {
  return { ...toPracticeStudyItem(correct(), catalog()), id, revision: 4, createdAt: '2026-10-25T00:00:00.000Z', updatedAt: '2026-10-25T01:00:00.000Z', ...overrides } as StudyItem;
}

describe('project practice public reference catalog', () => {
  it('accepts exact public benchmark links and rejects private, mismatched, external or unsafe destinations', () => {
    expect(readPracticeCatalog(catalog())).toEqual({ ok: true, value: catalog() });
    for (const slug of ['uniform-bar', 'stepped-bar', 'cantilever-beam']) expect(isPracticeReferenceHref(`/cases/benchmarks/${slug}/`)).toBe(true);
    for (const href of ['/cases/benchmarks/unknown/', '/learning/records/', '/api/study/items', '/cases/benchmarks/uniform-bar/?token=x', '/cases/benchmarks/uniform-bar/#x', '/cases/benchmarks/%2e%2e/', '//evil.example', 'javascript:alert(1)', 'https://simulearn.cn/cases/benchmarks/uniform-bar/']) {
      expect(isPracticeReferenceHref(href)).toBe(false);
      const invalid = catalog(); invalid.cases[0].href = href;
      expect(readPracticeCatalog(invalid).ok).toBe(false);
    }
    const mismatch = catalog(); mismatch.cases[0].href = '/cases/benchmarks/stepped-bar/';
    expect(readPracticeCatalog(mismatch).ok).toBe(false);
    const duplicate = catalog(); duplicate.cases.push(duplicate.cases[0]);
    expect(readPracticeCatalog(duplicate).ok).toBe(false);
  });

  it('refuses broken reference values or tolerances instead of matching against NaN or infinite tolerances', () => {
    for (const change of [{ value: NaN }, { value: Infinity }, { absoluteTolerance: -1 }, { relativeTolerance: -0.1 }, { relativeTolerance: Infinity }, { value: 1e308, relativeTolerance: 1e308 }, { unit: '' }]) {
      const invalid = catalog(); Object.assign(invalid.cases[0].quantities[0], change);
      expect(readPracticeCatalog(invalid).ok).toBe(false);
    }
    const duplicate = catalog(); duplicate.cases[0].quantities[1].id = 'tip-displacement';
    expect(readPracticeCatalog(duplicate).ok).toBe(false);
    for (const raw of [null, [], {}, { ...catalog(), version: 'future' }, { ...catalog(), cases: [] }]) expect(readPracticeCatalog(raw).ok).toBe(false);
  });
});

describe('strict whole-string numeric comparison', () => {
  it('supports signed decimals and scientific notation, never treating blank, partial or nonfinite text as zero', () => {
    for (const [input, expected] of [['0', 0], ['-0', -0], ['+.5e+2', 50], ['1.', 1], [' -1e4 ', -10000], ['4.7619047619e-1', 0.47619047619]] as const) expect(parsePracticeNumber(input)).toEqual({ ok: true, value: expected });
    for (const input of ['', '   ', '\n', 'NaN', 'Infinity', '-Infinity', '1e309', '0x10', '0b10', '100 mm', '100 N', '1,000', '1_000', '1 2', '1e', '.', '--1', '2.5abc', '１', '1\n2', null, 0, '1'.repeat(65)]) expect(parsePracticeNumber(input).ok).toBe(false);
    expect(checkProjectPractice(practice(), catalog()).quantities.every(value => !value.valid && !value.matches && value.actual === null)).toBe(true);
  });

  it('uses the maximum of absolute and relative tolerance inclusively and respects the sign of reactions', () => {
    const reference = catalog(); reference.cases[0].quantities[0] = { ...reference.cases[0].quantities[0], value: 10, absoluteTolerance: 0.5, relativeTolerance: 0.01 };
    const boundary = correct(); boundary.answers['tip-displacement'] = '10.5';
    const result = checkProjectPractice(boundary, reference);
    expect(result.quantities[0]).toMatchObject({ expected: 10, actual: 10.5, absoluteError: 0.5, tolerance: 0.5, matches: true });
    expect(result.quantities[1].tolerance).toBe(0.01);
    boundary.answers['tip-displacement'] = '10.50001'; boundary.answers['reaction-force'] = '10000';
    const outside = checkProjectPractice(boundary, reference);
    expect(outside.quantities[0].matches).toBe(false);
    expect(outside.quantities[1]).toMatchObject({ absoluteError: 20000, matches: false });
    expect(outside.allMatch).toBe(false);
  });

  it('requires the concept answer separately and never mutates execution or learning state', () => {
    const complete = correct(); const before = JSON.stringify(complete);
    expect(checkProjectPractice(complete, catalog()).allMatch).toBe(true);
    expect(JSON.stringify(complete)).toBe(before);
    expect(complete).toMatchObject({ executor: '未运行', reproduction: '未运行', observation: '', evidence: '' });
    for (const concept of ['', 'proof'] as const) {
      const feedback = checkProjectPractice({ ...complete, concept }, catalog());
      expect(feedback.quantities.every(item => item.matches)).toBe(true);
      expect(feedback.concept.matches).toBe(false); expect(feedback.allMatch).toBe(false);
      expect(feedback.concept.explanation).toContain('不等于工程验证已完成');
    }
  });
});

describe('private versioned project-practice records', () => {
  it('saves an unfinished private draft with empty evidence, no inferred passed flag or fabricated date', () => {
    const item = toPracticeStudyItem(practice(), catalog());
    expect(item).toMatchObject({ kind: 'record', learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private', sourceIds: [], noteIds: [] });
    expect(item.fields).toMatchObject({ recordType: '项目练习', executor: '未运行', reproduction: '未运行', evidence: '' });
    expect(item.fields).not.toHaveProperty('passed'); expect(item.fields).not.toHaveProperty('publicBody');
    expect(item.fields.body).toContain('实际学习日期：未提供'); expect(item.fields.body).toContain('不是求解器输出');
    expect(item.fields.body).not.toContain('全部参考对照相符');
    const raw = JSON.parse(item.fields.raw);
    expect(raw).toEqual({ projectPractice: practice() }); expect(raw.projectPractice).not.toHaveProperty('passed');
    expect(parseProjectPractice(item.fields.raw, catalog())).toEqual({ ok: true, value: practice() });
  });

  it('re-evaluates answers using the current reference instead of trusting saved feedback', () => {
    const item = saved();
    const original = readPracticeStudyItem(item, catalog()); expect(original.ok).toBe(true);
    const updatedCatalog = catalog(); updatedCatalog.cases[0].quantities[0].value *= 2;
    const loaded = readPracticeStudyItem(item, updatedCatalog);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(checkProjectPractice(loaded.value.practice, updatedCatalog).quantities[0].matches).toBe(false);
    item.fields.passed = 'true';
    const loadedWithUntrustedField = readPracticeStudyItem(item, updatedCatalog);
    expect(loadedWithUntrustedField.ok).toBe(true);
    if (loadedWithUntrustedField.ok) expect(checkProjectPractice(loadedWithUntrustedField.value.practice, updatedCatalog).allMatch).toBe(false);
  });

  it('preserves revisions, independent learning status, references and unrelated private fields on an update', () => {
    const original = saved({ learningStatus: 'explain', reviewStatus: 'reviewed', sourceIds: ['source-7090f4a3-87f2-41b1-9ace-c61e90b48f85'] });
    original.fields.code = 'commit:abcdef';
    const update = toPracticeStudyItem({ ...correct(), observation: '应先核查左端反力符号，未运行CAE' }, catalog(), original);
    expect(update).toMatchObject({ id, revision: 4, learningStatus: 'explain', reviewStatus: 'draft', visibility: 'private', sourceIds: original.sourceIds });
    expect(update.fields.code).toBe('commit:abcdef'); expect(update.fields.understanding).toContain('未运行CAE');
    expect(original.fields.understanding).toBe(''); expect(update.createdAt).toBe(original.createdAt);
  });

  it('rejects foreign/private-state changes, future schemas and general-workbench mirror edits without overwriting', () => {
    for (const item of [saved({ visibility: 'public' }), saved({ visibility: 'pending' }), saved({ kind: 'source' }), saved({ revision: 0 }), saved({ id: 'record-other' })]) {
      expect(readPracticeStudyItem(item, catalog()).ok).toBe(false);
      expect(() => toPracticeStudyItem(correct(), catalog(), item)).toThrow();
    }
    const edited = saved(); edited.fields.body += '\n原工作台补充内容';
    expect(readPracticeStudyItem(edited, catalog())).toMatchObject({ ok: false, error: expect.stringContaining('避免覆盖修改') });
    const ordinary = saved(); ordinary.fields.raw = '普通学习原始日志';
    expect(readPracticeStudyItem(ordinary, catalog()).ok).toBe(false);
    for (const change of [{ schemaVersion: 2 }, { catalogVersion: 'linear-static-v2' }, { caseSlug: '../../private' }, { executor: 'AI 执行环境' }, { reproduction: '已掌握' }, { concept: 'maybe' }, { passed: true }]) {
      expect(validateProjectPractice({ ...correct(), ...change }, catalog()).ok).toBe(false);
    }
    for (const raw of ['{bad', '{}', '[]', JSON.stringify({ projectPractice: correct(), extra: true })]) expect(parseProjectPractice(raw, catalog()).ok).toBe(false);
  });

  it('exports user inputs and a clearly derived reference check without claiming local/CAE execution', () => {
    const value = { ...correct(), observation: '<script>仅作为原始观察文本</script>', evidence: '尚未取得本机运行日志' };
    const json = projectPracticeJson(value, catalog()); expect(JSON.parse(json)).toEqual({ projectPractice: value });
    const markdown = projectPracticeMarkdown(value, catalog());
    expect(markdown).toContain('按当前公开目录重新计算的练习反馈'); expect(markdown).toContain('绝对误差'); expect(markdown).toContain('实际学习日期：未提供');
    expect(markdown).toContain(value.observation); expect(markdown).toContain('参考对照不是用户求解证据'); expect(markdown).not.toContain('CAE运行成功');
    expect(value.reproduction).toBe('未运行'); expect(value.executor).toBe('未运行');
  });

  it('bounds input and rejects poisoned records without reading accessors or silently discarding future fields', () => {
    const excessive = correct(); excessive.answers['tip-displacement'] = '1'.repeat(65);
    expect(validateProjectPractice(excessive, catalog()).ok).toBe(false);
    expect(() => projectPracticeJson(excessive, catalog())).toThrow('没有被截断');
    expect(validateProjectPractice({ ...correct(), observation: '观'.repeat(4001) }, catalog()).ok).toBe(false);
    expect(validateProjectPractice({ ...correct(), evidence: '据'.repeat(4001) }, catalog()).ok).toBe(false);
    const object = { ...correct() }; const getter = vi.fn(() => 'do not evaluate'); Object.defineProperty(object, 'concept', { get: getter });
    expect(validateProjectPractice(object, catalog()).ok).toBe(false); expect(getter).not.toHaveBeenCalled();
    expect(validateProjectPractice(Object.create(correct()), catalog()).ok).toBe(false);
    expect(validateProjectPractice(JSON.parse('{"schemaVersion":1,"__proto__":{"polluted":true}}'), catalog()).ok).toBe(false); expect({}).not.toHaveProperty('polluted');
  });
});
