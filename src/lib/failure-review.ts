import type { StudyItem } from '../data/study-schema';

/** Private failure-review documents. No solver result or learning progress is inferred. */
export const FAILURE_REVIEW_FIELDS = [
  'title', 'date', 'software', 'version', 'model', 'symptom', 'expected', 'hypothesis',
  'attempts', 'actual', 'evidence', 'change', 'retest', 'next', 'diagnosticId',
] as const;
export const FAILURE_EXECUTORS = ['未运行', '用户本机', 'AI 执行环境', '其他明确环境'] as const;
export const FAILURE_REPRODUCTION = ['未运行', '已运行待核对', '已复现'] as const;
export type FailureExecutor = typeof FAILURE_EXECUTORS[number];
export type FailureReproduction = typeof FAILURE_REPRODUCTION[number];
export type FailureTextField = typeof FAILURE_REVIEW_FIELDS[number];
export type FailureReview = Record<FailureTextField, string> & {
  versionSchema: 1;
  executor: FailureExecutor;
  reproduction: FailureReproduction;
};
export interface FailureDiagnostic { id: string; title: string; href: string }
export type FailureStudyDraft = Omit<StudyItem, 'id' | 'revision' | 'createdAt' | 'updatedAt'> & Partial<Pick<StudyItem, 'id' | 'revision' | 'createdAt' | 'updatedAt'>>;
export type FailureResult<T> = { ok: true; value: T } | { ok: false; error: string };
export const FAILURE_FIELD_LIMITS: Record<FailureTextField, number> = {
  title: 200, date: 10, software: 120, version: 120, model: 3_000,
  symptom: 4_000, expected: 3_000, hypothesis: 4_000, attempts: 6_000,
  actual: 6_000, evidence: 4_000, change: 4_000, retest: 4_000, next: 2_000, diagnosticId: 80,
};
const labels: Record<FailureTextField, string> = {
  title: '标题', date: '实际发生日期', software: '软件', version: '软件版本', model: '模型、单位与工况',
  symptom: '实际现象或报错', expected: '预期表现与判定依据', hypothesis: '原因假设（尚待验证）',
  attempts: '实际排查顺序', actual: '实际输出与结果', evidence: '证据、日志与来源',
  change: '修改内容及其依据', retest: '复测条件与实际结果', next: '下一项具体任务', diagnosticId: '关联诊断',
};
const RECORD_ID = /^record-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const DIAGNOSTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_RAW = 32_000;
const MAX_BODY_BYTES = 128 * 1_024;
const badKeys = new Set(['__proto__', 'constructor', 'prototype']);

function plain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && !badKeys.has(key) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value'));
}
function invalid(error: string): { ok: false; error: string } { return { ok: false, error }; }
function validDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function isFailureRecordId(value: unknown): value is string { return typeof value === 'string' && RECORD_ID.test(value); }

export function blankFailureReview(): FailureReview {
  const fields = Object.fromEntries(FAILURE_REVIEW_FIELDS.map(key => [key, ''])) as Record<FailureTextField, string>;
  return { ...fields, versionSchema: 1, executor: '未运行', reproduction: '未运行' };
}

/** Strict projection: no arbitrary query properties, accessors or future schemas are accepted. */
export function validateFailureReview(input: unknown): FailureResult<FailureReview> {
  if (!plain(input) || input.versionSchema !== 1) return invalid('这份复盘的格式或版本不受支持，原内容未修改。');
  const allowed = new Set<string>([...FAILURE_REVIEW_FIELDS, 'versionSchema', 'executor', 'reproduction']);
  if (Object.keys(input).some(key => !allowed.has(key))) return invalid('这份复盘含有当前版本无法识别的字段，请使用原学习工作台查看。');
  const value = blankFailureReview();
  for (const key of FAILURE_REVIEW_FIELDS) {
    const text = input[key];
    if (typeof text !== 'string' || text.length > FAILURE_FIELD_LIMITS[key] || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return invalid(`${labels[key]}必须是 ${FAILURE_FIELD_LIMITS[key]} 字以内的文本；内容没有被截断。`);
    value[key] = text;
  }
  if (!validDate(value.date)) return invalid('实际发生日期无效；缺失时请留空，不会自动填入今天。');
  if (value.diagnosticId && !DIAGNOSTIC_ID.test(value.diagnosticId)) return invalid('关联诊断标识无效。');
  if (typeof input.executor !== 'string' || !FAILURE_EXECUTORS.includes(input.executor as FailureExecutor)) return invalid('请选择明确的执行者与环境。');
  if (typeof input.reproduction !== 'string' || !FAILURE_REPRODUCTION.includes(input.reproduction as FailureReproduction)) return invalid('复现状态无效。');
  value.executor = input.executor as FailureExecutor;
  value.reproduction = input.reproduction as FailureReproduction;
  if (JSON.stringify({ failureReview: value }).length > MAX_RAW) return invalid('本条复盘总内容超过 32000 字，请拆分记录；原输入仍保留。');
  return { ok: true, value };
}

export function parseFailureReview(raw: unknown): FailureResult<FailureReview> {
  if (typeof raw !== 'string' || raw.length > MAX_RAW) return invalid('这不是当前版本的结构化失败复盘，请到原学习工作台查看。');
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!plain(envelope) || Object.keys(envelope).length !== 1 || !Object.hasOwn(envelope, 'failureReview')) return invalid('这不是当前版本的结构化失败复盘，请到原学习工作台查看。');
    return validateFailureReview(envelope.failureReview);
  } catch { return invalid('复盘原始数据无法读取；原内容未修改，请到原学习工作台查看。'); }
}

/** Only verified public diagnostic metadata can provide a URL prefill. */
export function readFailureDiagnostics(input: unknown): FailureDiagnostic[] {
  if (!Array.isArray(input) || input.length > 200) return [];
  const seen = new Set<string>();
  return input.flatMap(value => {
    if (!plain(value) || typeof value.id !== 'string' || value.id.length > 80 || !DIAGNOSTIC_ID.test(value.id) || seen.has(value.id)
      || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 200
      || value.href !== `/diagnostic/${value.id}/`) return [];
    seen.add(value.id);
    return [{ id: value.id, title: value.title, href: value.href as string }];
  });
}
export function prefillFailureReview(diagnosticId: unknown, diagnostics: FailureDiagnostic[]): FailureReview {
  const value = blankFailureReview();
  const diagnostic = readFailureDiagnostics(diagnostics).find(card => card.id === diagnosticId);
  if (diagnostic) { value.title = `${diagnostic.title}：失败复盘`.slice(0, 200); value.diagnosticId = diagnostic.id; }
  return value;
}

/** Markdown remains a download, never HTML inserted into the workbench. */
export function failureReviewMarkdown(input: FailureReview): string {
  const checked = validateFailureReview(input);
  if (checked.ok === false) throw new Error(checked.error);
  const review = checked.value;
  const chunks = [
    `# ${review.title.trim() || '未命名失败复盘'}`,
    '> 私人失败复盘草稿。空白项表示未记录；原因假设不等于已证实的根因。',
    `实际发生日期：${review.date || '未提供'}\n\n执行者与环境：${review.executor}\n\n复现状态：${review.reproduction}`,
  ];
  if (review.diagnosticId) chunks.push(`关联诊断：/diagnostic/${review.diagnosticId}/（指导材料，不是本次排查的执行证据）`);
  for (const key of FAILURE_REVIEW_FIELDS) {
    if (['title', 'date', 'diagnosticId'].includes(key)) continue;
    chunks.push(`## ${labels[key]}\n\n${review[key].trim() || '未记录'}`);
  }
  return `${chunks.join('\n\n')}\n`;
}

function mappedFields(review: FailureReview): Record<string, string> {
  return {
    recordType: '失败复盘', raw: JSON.stringify({ failureReview: review }), date: review.date,
    problem: review.symptom, expected: review.expected, attempts: review.attempts, actualOutput: review.actual,
    evidence: review.evidence, executor: review.executor, reproduction: review.reproduction,
    version: [review.software, review.version].filter(Boolean).join(' · '), conditions: review.model,
    uncertainties: review.hypothesis, misconceptions: review.change, nextTask: review.next,
    knowledgeLinks: review.diagnosticId ? `/diagnostic/${review.diagnosticId}/` : '', body: failureReviewMarkdown(review),
  };
}

/** Accept only private, intact reviews. Other records must never be silently converted. */
export function readFailureStudyItem(input: unknown): FailureResult<{ item: StudyItem; review: FailureReview }> {
  if (!plain(input) || input.kind !== 'record' || !isFailureRecordId(input.id) || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200
    || !plain(input.fields) || input.fields.recordType !== '失败复盘') return invalid('这条记录不是失败复盘，请到原学习工作台查看，避免覆盖其他内容。');
  if (input.visibility !== 'private') return invalid('这条记录已设为待公开或已公开。请到原学习工作台管理公开状态，本页不会修改或撤回它。');
  if (typeof input.learningStatus !== 'string' || !['not-started', 'introduced', 'followed', 'explain', 'independent'].includes(input.learningStatus)
    || typeof input.reviewStatus !== 'string' || !['draft', 'pending', 'reviewed'].includes(input.reviewStatus) || !Number.isSafeInteger(input.revision) || Number(input.revision) < 1
    || typeof input.createdAt !== 'string' || typeof input.updatedAt !== 'string') return invalid('记录状态或版本无效，已停止编辑以保护原内容。');
  const fields = input.fields;
  if (Object.keys(fields).length > 48 || Object.entries(fields).some(([key, value]) => !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || typeof value !== 'string' || value.length > MAX_RAW)) return invalid('记录含有无法安全保存的字段，请到原学习工作台查看。');
  for (const [key, prefix] of [['sourceIds', 'source'], ['noteIds', 'note']] as const) {
    if (!Array.isArray(input[key]) || input[key].length > 40 || input[key].some(id => typeof id !== 'string' || !new RegExp(`^${prefix}-[a-f0-9-]{36}$`).test(id))) return invalid('记录关联数据无效，请到原学习工作台查看。');
  }
  const parsed = parseFailureReview(fields.raw);
  if (parsed.ok === false) return parsed;
  if (input.title !== parsed.value.title.trim() || Object.entries(mappedFields(parsed.value)).some(([key, value]) => fields[key] !== value)) return invalid('这条复盘已在原学习工作台修改，结构化副本与正文不一致。请在那里继续编辑，避免覆盖修改。');
  return { ok: true, value: { item: input as unknown as StudyItem, review: parsed.value } };
}

export function toFailureStudyItem(input: FailureReview, previous?: StudyItem): FailureStudyDraft {
  const checked = validateFailureReview(input);
  if (checked.ok === false) throw new Error(checked.error);
  const review = { ...checked.value, title: checked.value.title.trim() };
  if (!review.title) throw new Error('请先填写一个具体的复盘标题。');
  if (previous) {
    const previousReview = readFailureStudyItem(previous);
    if (previousReview.ok === false) throw new Error(previousReview.error);
  }
  const item: FailureStudyDraft = {
    ...(previous || {}), kind: 'record', title: review.title,
    fields: { ...(previous?.fields || {}), ...mappedFields(review) },
    sourceIds: [...(previous?.sourceIds || [])], noteIds: [...(previous?.noteIds || [])],
    learningStatus: previous?.learningStatus || 'not-started', reviewStatus: 'draft', visibility: 'private',
  };
  if (Object.keys(item.fields).length > 48 || Object.values(item.fields).some(value => value.length > MAX_RAW)) throw new Error('单条复盘内容超过存储字段限制，请拆分；原输入仍保留。');
  if (new TextEncoder().encode(JSON.stringify({ item, revision: previous?.revision })).byteLength > MAX_BODY_BYTES) throw new Error('复盘超过 128 KiB 请求限制，请拆分记录或先导出；内容没有被截断。');
  return item;
}

export function failureReviewJson(input: FailureReview): string {
  const checked = validateFailureReview(input);
  if (checked.ok === false) throw new Error(checked.error);
  return JSON.stringify({ failureReview: checked.value }, null, 2);
}
