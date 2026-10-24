import { describe, expect, it, vi } from 'vitest';
import type { StudyItem } from '../src/data/study-schema';
import {
  blankFailureReview, failureReviewJson, failureReviewMarkdown, isFailureRecordId,
  parseFailureReview, prefillFailureReview, readFailureDiagnostics, readFailureStudyItem,
  toFailureStudyItem, validateFailureReview, type FailureReview,
} from '../src/lib/failure-review';

const id = 'record-1b4e28ba-2fa1-41d2-883f-377af2a06d98';
const diagnostics = [{ id: 'units', title: '单位与数量级：检查整套量纲及换算记录', href: '/diagnostic/units/' }];
const review = (overrides: Partial<FailureReview> = {}): FailureReview => ({
  ...blankFailureReview(), title: '材料参数数量级待核对', software: 'Mechanical APDL', version: '2025 R2',
  model: 'mm / N / s，质量单位待核对；约束和密度未确认', symptom: '当前位移与手算不符',
  hypothesis: '怀疑密度换算，尚未验证', next: '打印输入单位并核对来源', ...overrides,
});
function saved(overrides: Partial<StudyItem> = {}): StudyItem {
  return { ...toFailureStudyItem(review()), id, revision: 3, createdAt: '2026-10-24T00:00:00.000Z', updatedAt: '2026-10-24T01:00:00.000Z', ...overrides } as StudyItem;
}

describe('failure-review evidence boundaries', () => {
  it('starts empty without inventing dates, experiments, roots, or completed learning', () => {
    const value = blankFailureReview();
    expect(value).toMatchObject({ date: '', attempts: '', actual: '', evidence: '', executor: '未运行', reproduction: '未运行' });
    const item = toFailureStudyItem(review());
    expect(item).toMatchObject({ kind: 'record', learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private', sourceIds: [], noteIds: [] });
    expect(item.fields).toMatchObject({ date: '', attempts: '', actualOutput: '', evidence: '', recordType: '失败复盘', uncertainties: '怀疑密度换算，尚未验证' });
    expect(item.fields).not.toHaveProperty('publicBody');
    expect(item.fields.body).toContain('原因假设不等于已证实的根因');
    expect(item.fields.body).toContain('实际发生日期：未提供');
    expect(item.fields.body).not.toContain('2026-10-24');
    expect(item.fields.body).not.toContain('运行成功');
  });

  it('prefills only a known diagnostic title and association, with every experience field empty', () => {
    const value = prefillFailureReview('units', diagnostics);
    expect(value).toEqual({ ...blankFailureReview(), title: `${diagnostics[0].title}：失败复盘`, diagnosticId: 'units' });
    for (const unknown of ['http://evil.example', 'units?actual=success', '../../private', '<script>', undefined]) expect(prefillFailureReview(unknown, diagnostics)).toEqual(blankFailureReview());
    expect(readFailureDiagnostics([...diagnostics, ...diagnostics, { id: 'attack', title: '链接', href: 'javascript:alert(1)' }, { id: '../private', title: '私人记录', href: '/diagnostic/../private/' }])).toEqual(diagnostics);
    expect(readFailureDiagnostics(Array(201).fill(diagnostics[0]))).toEqual([]);
    const markdown = failureReviewMarkdown(value);
    expect(markdown).toContain('/diagnostic/units/');
    expect(markdown).toContain('不是本次排查的执行证据');
    expect(markdown).toContain('实际排查顺序\n\n未记录');
  });

  it('keeps planned or AI-only execution separate from the user and preserves supplied text in exports', () => {
    const value = review({ executor: 'AI 执行环境', reproduction: '已运行待核对', attempts: 'AI 环境尝试打印表头；用户本机未运行', actual: '字段 stress 无法解析', evidence: '<script>alert("log")</script>\n私人日志仅在用户主动导出时包含' });
    const json = failureReviewJson(value);
    expect(JSON.parse(json)).toEqual({ failureReview: value });
    expect(parseFailureReview(json)).toEqual({ ok: true, value });
    const item = toFailureStudyItem(value);
    expect(item.fields.executor).toBe('AI 执行环境');
    expect(item.learningStatus).toBe('not-started');
    expect(item.visibility).toBe('private');
    expect(failureReviewMarkdown(value)).toContain(value.evidence);
    expect(item.fields.body).toContain('字段 stress 无法解析');
  });

  it('validates real calendar dates, separate environment states and exact schema versions', () => {
    for (const date of ['', '2024-02-29', '2026-10-24']) expect(validateFailureReview(review({ date })).ok).toBe(true);
    for (const date of ['2026-02-29', '2026-13-01', '2026-02-30', '2026-1-1', 'today']) expect(validateFailureReview(review({ date })).ok).toBe(false);
    for (const input of [null, [], {}, { ...review(), versionSchema: 2 }, { ...review(), executor: '已成功' }, { ...review(), reproduction: '已掌握' }, { ...review(), unexpected: 'do not discard' }]) expect(validateFailureReview(input).ok).toBe(false);
    for (const raw of [null, '{bad', '[]', '{}', JSON.stringify({ failureReview: review(), another: 'unknown' }), JSON.stringify({ failureReview: { ...review(), versionSchema: 2 } })]) expect(parseFailureReview(raw).ok).toBe(false);
    const accessor = { ...review() }; const getter = vi.fn(() => 'should not run');
    Object.defineProperty(accessor, 'actual', { get: getter });
    expect(validateFailureReview(accessor).ok).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    expect(validateFailureReview(Object.create(review())).ok).toBe(false);
    expect(validateFailureReview(JSON.parse('{"__proto__":{"polluted":true},"versionSchema":1}')).ok).toBe(false);
    expect({}).not.toHaveProperty('polluted');
  });

  it('rejects oversized text and UTF8 requests without truncating user evidence', () => {
    const large = review({ actual: '报错'.repeat(3001) });
    expect(validateFailureReview(large)).toMatchObject({ ok: false });
    expect(() => failureReviewJson(large)).toThrow('没有被截断');
    expect(large.actual).toHaveLength(6002);
    expect(() => toFailureStudyItem(review({ title: '  ' }))).toThrow('标题');
    const text = '证'.repeat(4000);
    const largeChinese = review({ model: '模'.repeat(3000), symptom: text, expected: '期'.repeat(3000), hypothesis: text, attempts: text, actual: text, evidence: text });
    expect(validateFailureReview(largeChinese).ok).toBe(true);
    expect(() => toFailureStudyItem(largeChinese)).toThrow(/128 KiB/);
  });

  it('reopens its exact private format and preserves revision, sources, unknown fields and independent learning state', () => {
    const original = saved({ learningStatus: 'explain', reviewStatus: 'reviewed', sourceIds: ['source-1b4e28ba-2fa1-41d2-883f-377af2a06d98'], noteIds: ['note-1b4e28ba-2fa1-41d2-883f-377af2a06d98'] });
    original.fields.code = 'sha:abcdef';
    expect(readFailureStudyItem(original)).toEqual({ ok: true, value: { item: original, review: review() } });
    const next = toFailureStudyItem(review({ actual: '新观测；根因尚未确认' }), original);
    expect(next).toMatchObject({ id, revision: 3, learningStatus: 'explain', reviewStatus: 'draft', visibility: 'private', sourceIds: original.sourceIds, noteIds: original.noteIds });
    expect(next.fields.code).toBe('sha:abcdef');
    expect(original.fields.actualOutput).toBe('');
    expect(next.fields.actualOutput).toBe('新观测；根因尚未确认');
    expect(next.createdAt).toBe(original.createdAt);
  });

  it('blocks generic records, nonprivate records and edited mirrors instead of overwriting them', () => {
    for (const previous of [saved({ visibility: 'public' }), saved({ visibility: 'pending' }), saved({ kind: 'note' }), saved({ revision: 0 }), saved({ id: '../other' }), saved({ sourceIds: ['record-invalid'] })]) {
      expect(readFailureStudyItem(previous).ok).toBe(false);
      expect(() => toFailureStudyItem(review(), previous)).toThrow();
    }
    const generic = saved(); generic.fields.raw = '原始日志，不是结构化复盘';
    expect(readFailureStudyItem(generic).ok).toBe(false);
    const edited = saved(); edited.fields.body += '\n在原工作台补充的实际结果';
    expect(readFailureStudyItem(edited)).toMatchObject({ ok: false, error: expect.stringContaining('副本与正文不一致') });
    expect(() => toFailureStudyItem(review(), edited)).toThrow('避免覆盖修改');
    expect(edited.fields.body).toContain('补充的实际结果');
    const renamed = saved({ title: '原工作台修改后的标题' });
    expect(readFailureStudyItem(renamed).ok).toBe(false);
    for (const candidate of [id, 'record-1b4e28ba-2fa1-41d2-883f-377af2a06d98']) expect(isFailureRecordId(candidate)).toBe(true);
    for (const candidate of ['record-../../private', 'source-1b4e28ba-2fa1-41d2-883f-377af2a06d98', `${id}?x=1`, '//evil.example']) expect(isFailureRecordId(candidate)).toBe(false);
  });
});
