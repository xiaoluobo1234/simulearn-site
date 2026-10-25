import { describe, expect, it } from 'vitest';
import { chooseDeskTask, readDeskRecords } from '../src/lib/learning-desk';
import { linearStaticBenchmarks } from '../src/data/linear-static-benchmarks';
import { blankProjectPractice, readPracticeCatalog, toPracticeStudyItem, type PracticeCatalog, type ProjectPractice } from '../src/lib/project-practice';
import type { StudyItem } from '../src/data/study-schema';

const parsedCatalog = readPracticeCatalog({ version: 'linear-static-v1', cases: linearStaticBenchmarks.map(item => ({ ...item, href: `/cases/benchmarks/${item.slug}/` })) });
if (!parsedCatalog.ok) throw Error('The actual public project catalog must be valid.');
const catalog: PracticeCatalog = parsedCatalog.value;
const id = (index: number) => `record-7090f4a3-87f2-41b1-9ace-c61e90b48f${String(index).padStart(2, '0')}`;
function record(index: number, nextTask = '', date = '2026-10-25T01:00:00Z') {
  return { id: id(index), kind: 'record', title: `真实保存记录 ${index}`, updatedAt: date, fields: { nextTask, raw: '私人原文', email: '不要投影', doneWhen: '' } };
}
function practice(index: number, overrides: Partial<ProjectPractice> = {}, date = '2026-10-25T02:00:00Z'): StudyItem {
  const draft = blankProjectPractice('uniform-bar');
  for (const quantity of catalog.cases[0].quantities) draft.answers[quantity.id] = String(quantity.value);
  const item = toPracticeStudyItem({ ...draft, concept: 'not-proof', ...overrides }, catalog);
  return { ...item, id: id(index), revision: 2, createdAt: '2026-10-25T00:00:00Z', updatedAt: date } as StudyItem;
}

describe('learning desk uses saved records rather than invented progress', () => {
  it('projects only navigation and saved next-task fields, sorts by actual update time and leaves inputs intact', () => {
    const newer = record(1, '只检查一个单位', '2026-10-25T03:00:00Z'); newer.fields.doneWhen = '留下原始输入与核对依据';
    const older = record(2, '稍早的任务'); const input = [older, newer]; const before = JSON.stringify(input);
    const result = readDeskRecords(input);
    expect(result.map(item => item.id)).toEqual([newer.id, older.id]);
    expect(result[0].fields).toEqual({ nextTask: '只检查一个单位', doneWhen: '留下原始输入与核对依据' });
    expect(result[0].fields).not.toHaveProperty('raw'); expect(result[0].fields).not.toHaveProperty('email');
    expect(JSON.stringify(input)).toBe(before);
  });
  it('returns no synthetic records or tasks for empty, foreign and malformed data', () => {
    for (const input of [null, {}, 'records', [], [null, 3, 'x'], [{ ...record(1), kind: 'source' }], [{ ...record(1), id: 'javascript:alert(1)' }], [{ ...record(1), updatedAt: 'not-a-date' }], [{ ...record(1), title: 'x'.repeat(201) }], [{ ...record(1), fields: [] }]]) {
      expect(readDeskRecords(input)).toEqual([]); expect(chooseDeskTask(input, catalog)).toBeNull();
    }
    expect(chooseDeskTask([record(1)], catalog)).toBeNull();
    const oversized = record(1, 'x'.repeat(32001));
    expect(readDeskRecords([oversized])[0].fields).not.toHaveProperty('nextTask');
    expect(chooseDeskTask([oversized], catalog)).toBeNull();
  });
  it('excludes every occurrence of duplicate IDs, including an incompatible copy, without hiding other records', () => {
    const first=record(1,'第一份副本中的任务');
    const conflict={...first,title:'另一个标题',updatedAt:'2026-10-25T03:00:00Z',fields:{nextTask:'另一份副本中的任务'}};
    const unique=record(2,'唯一可定位的任务');
    expect(readDeskRecords([first,conflict,unique]).map(item=>item.id)).toEqual([unique.id]);
    expect(chooseDeskTask([first,conflict,unique],catalog)?.task).toBe('唯一可定位的任务');
    expect(chooseDeskTask([practice(1),{id:first.id,kind:'source'}],catalog)).toBeNull();
    expect(chooseDeskTask([first,{id:first.id}],catalog)).toBeNull();
  });
  it('only projects own saved fields and rejects malformed identifiers or normalized impossible dates', () => {
    const inheritedTask={...record(1),fields:Object.assign(Object.create({nextTask:'不是自身保存的任务',doneWhen:'继承的条件'}),{raw:'私人原文'})};
    expect(readDeskRecords([inheritedTask])[0].fields).toEqual({});
    expect(chooseDeskTask([inheritedTask],catalog)).toBeNull();
    expect(readDeskRecords([Object.create(record(1,'继承的条目'))])).toEqual([]);
    for(const updatedAt of ['10/25/2026','2026-02-30T01:00:00Z','2026-10-25T01:00:00+00:00'])expect(readDeskRecords([{...record(1),updatedAt}])).toEqual([]);
    expect(readDeskRecords([{...record(1),updatedAt:'2026-10-25T01:00:00.123Z'}])).toHaveLength(1);
    expect(readDeskRecords([{...record(1),id:'record-'+ '-'.repeat(36)}])).toEqual([]);
    expect(readDeskRecords([{...record(1),title:'   '}])).toEqual([]);
  });
  it('prioritizes the newest explicit saved task over inferred practice recommendations', () => {
    const oldTask = record(1, '先核对密度来源', '2026-10-24T01:00:00Z');
    const newTask = record(2, '只核对反力正方向', '2026-10-24T02:00:00Z'); newTask.fields.doneWhen = '画出自由体图并解释支反力';
    const task = chooseDeskTask([practice(3), oldTask, newTask], catalog)!;
    expect(task).toMatchObject({ label: '你保存的下一项任务', task: '只核对反力正方向', condition: '画出自由体图并解释支反力', href: `/learning/records/?id=${newTask.id}` });
    expect(task.reason).toContain('不是自动推断的学习成果');
    expect(task).not.toHaveProperty('completed'); expect(task).not.toHaveProperty('learningStatus');
  });
  it('does not invent completion conditions when a real saved next task lacks them', () => {
    const task = chooseDeskTask([record(1, '看真实错误日志')], catalog)!;
    expect(task.task).toBe('看真实错误日志'); expect(task.condition).toContain('尚未填写完成条件');
    expect(task.condition).not.toContain('完成率');
  });
  it('checks current answers first, then asks for missing evidence, without treating correct answers as execution', () => {
    const matching = practice(1); const before = JSON.stringify(matching);
    const evidenceTask = chooseDeskTask([matching], catalog)!;
    expect(evidenceTask.task).toContain('运行自己的案例副本');
    expect(evidenceTask.condition).toContain('由你核对后选择复现状态');
    expect(JSON.stringify(matching)).toBe(before);
    expect(matching).toMatchObject({ learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private' });
    const wrong = practice(2, { answers: { 'tip-displacement': '0', 'reaction-force': '0', 'strain-energy': '0' } });
    const differenceTask = chooseDeskTask([wrong, matching], catalog)!;
    expect(differenceTask.task).toContain('核对当前参考对照中的差异');
    expect(differenceTask.condition).toContain('不等于工程验证完成');
  });
  it('suggests a parameter experiment from supplied evidence without claiming it is complete or upgrading any state', () => {
    const original = practice(1, { executor: '用户本机', reproduction: '已复现', evidence: '本机输入、命令与结果已由我核对' });
    const before = JSON.stringify(original); const task = chooseDeskTask([original], catalog)!;
    expect(task.task).toContain('选择一项参数变化'); expect(task.condition).toContain('记录一个可观察变化');
    expect(task.reason).toContain('不自动改变学习、复现或公开状态');
    expect(JSON.stringify(original)).toBe(before); expect(original.learningStatus).toBe('not-started');
  });
  it('skips public, incompatible, corrupted and general-workbench-edited practice mirrors', () => {
    const publicItem = practice(1); publicItem.visibility = 'public';
    const changed = practice(2); changed.fields.body += '\n在原工作台补充过的文字';
    const corrupted = practice(3); corrupted.fields.raw = '{broken';
    const fallback = practice(4, {}, '2026-10-24T01:00:00Z');
    for (const invalid of [publicItem, changed, corrupted]) expect(chooseDeskTask([invalid], catalog)).toBeNull();
    expect(chooseDeskTask([publicItem, changed, corrupted, fallback], catalog)?.href).toContain(fallback.id);
  });
});
