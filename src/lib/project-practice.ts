import type { StudyItem } from '../data/study-schema';

export const PRACTICE_CATALOG_VERSION = 'linear-static-v1' as const;
export const PRACTICE_CASE_SLUGS = ['uniform-bar', 'stepped-bar', 'cantilever-beam'] as const;
export const PRACTICE_QUANTITIES = ['tip-displacement', 'reaction-force', 'strain-energy'] as const;
export const PRACTICE_EXECUTORS = ['未运行', '用户本机', '其他明确环境'] as const;
export const PRACTICE_REPRODUCTION = ['未运行', '已运行待核对', '已复现'] as const;
export type PracticeQuantityId = typeof PRACTICE_QUANTITIES[number];
export interface PracticeQuantity {
  id: PracticeQuantityId; label: string; value: number; unit: string;
  absoluteTolerance: number; relativeTolerance: number; explanation: string;
}
export interface PracticeCase { slug: string; title: string; href: string; quantities: PracticeQuantity[] }
export interface PracticeCatalog { version: typeof PRACTICE_CATALOG_VERSION; cases: PracticeCase[] }
export interface ProjectPractice {
  schemaVersion: 1;
  catalogVersion: typeof PRACTICE_CATALOG_VERSION;
  caseSlug: string;
  answers: Record<PracticeQuantityId, string>;
  concept: '' | 'not-proof' | 'proof';
  observation: string;
  executor: typeof PRACTICE_EXECUTORS[number];
  reproduction: typeof PRACTICE_REPRODUCTION[number];
  evidence: string;
}
export type PracticeResult<T> = { ok: true; value: T } | { ok: false; error: string };
export interface QuantityFeedback {
  id: PracticeQuantityId; label: string; input: string; unit: string;
  expected: number; actual: number | null; absoluteError: number | null;
  tolerance: number; valid: boolean; matches: boolean; explanation: string; message: string;
}
export interface PracticeFeedback {
  quantities: QuantityFeedback[];
  concept: { input: string; answered: boolean; matches: boolean; explanation: string };
  allMatch: boolean;
}
export type PracticeStudyDraft = Omit<StudyItem, 'id' | 'revision' | 'createdAt' | 'updatedAt'> & Partial<Pick<StudyItem, 'id' | 'revision' | 'createdAt' | 'updatedAt'>>;
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const CASE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RECORD_ID = /^record-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const MAX_RAW = 32_000;
const MAX_BODY_BYTES = 128 * 1024;
export const PRACTICE_CONCEPT_EXPLANATION = '求解成功只说明求解器在给定设置下返回了结果；仍需核查模型假设、单位、载荷与支承、平衡、误差及适用范围。数值对照相符也不等于工程验证已完成或个人已经掌握。';

function plain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Reflect.ownKeys(value).every(key => typeof key === 'string' && !BAD_KEYS.has(key) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value'));
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && own.every(key => keys.includes(key));
}
function bad(error: string): { ok: false; error: string } { return { ok: false, error }; }
function text(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
export function isPracticeRecordId(value: unknown): value is string { return typeof value === 'string' && RECORD_ID.test(value); }

/** References stay on explicitly public benchmark routes, with no query or fragment. */
export function isPracticeReferenceHref(value: unknown): value is string {
  return typeof value === 'string' && PRACTICE_CASE_SLUGS.some(slug => value === `/cases/benchmarks/${slug}/`);
}
export function readPracticeCatalog(input: unknown): PracticeResult<PracticeCatalog> {
  if (!plain(input) || input.version !== PRACTICE_CATALOG_VERSION || !Array.isArray(input.cases) || !input.cases.length || input.cases.length > 50) return bad('项目参考目录暂不可读，未进行数值判定。');
  const cases: PracticeCase[] = [];
  const slugs = new Set<string>();
  for (const item of input.cases) {
    if (!plain(item) || !text(item.slug, 80) || !CASE_SLUG.test(item.slug) || !PRACTICE_CASE_SLUGS.includes(item.slug as typeof PRACTICE_CASE_SLUGS[number]) || slugs.has(item.slug) || !text(item.title, 160) || !item.title.trim()
      || !isPracticeReferenceHref(item.href) || item.href !== `/cases/benchmarks/${item.slug}/` || !Array.isArray(item.quantities) || item.quantities.length !== 3) return bad('参考案例数据无效，未进行数值判定。');
    const quantities: PracticeQuantity[] = [];
    const ids = new Set<string>();
    for (const quantity of item.quantities) {
      if (!plain(quantity) || typeof quantity.id !== 'string' || !PRACTICE_QUANTITIES.includes(quantity.id as PracticeQuantityId) || ids.has(quantity.id)
        || !text(quantity.label, 80) || !quantity.label.trim() || !text(quantity.unit, 40) || !quantity.unit.trim() || !text(quantity.explanation, 2000)
        || typeof quantity.value !== 'number' || !Number.isFinite(quantity.value)
        || typeof quantity.absoluteTolerance !== 'number' || !Number.isFinite(quantity.absoluteTolerance) || quantity.absoluteTolerance < 0
        || typeof quantity.relativeTolerance !== 'number' || !Number.isFinite(quantity.relativeTolerance) || quantity.relativeTolerance < 0
        || !Number.isFinite(quantity.relativeTolerance * Math.abs(quantity.value))) return bad('参考数值、单位或容差无效，未进行数值判定。');
      ids.add(quantity.id);
      quantities.push({ id: quantity.id as PracticeQuantityId, label: quantity.label, value: quantity.value, unit: quantity.unit, absoluteTolerance: quantity.absoluteTolerance, relativeTolerance: quantity.relativeTolerance, explanation: quantity.explanation });
    }
    slugs.add(item.slug);
    cases.push({ slug: item.slug, title: item.title, href: item.href, quantities: PRACTICE_QUANTITIES.map(id => quantities.find(quantity => quantity.id === id)!) });
  }
  return { ok: true, value: { version: PRACTICE_CATALOG_VERSION, cases } };
}
export function blankProjectPractice(caseSlug: string): ProjectPractice {
  return {
    schemaVersion: 1, catalogVersion: PRACTICE_CATALOG_VERSION, caseSlug,
    answers: { 'tip-displacement': '', 'reaction-force': '', 'strain-energy': '' },
    concept: '', observation: '', executor: '未运行', reproduction: '未运行', evidence: '',
  };
}
export function validateProjectPractice(input: unknown, catalog: PracticeCatalog): PracticeResult<ProjectPractice> {
  if (!plain(input) || !exactKeys(input, ['schemaVersion', 'catalogVersion', 'caseSlug', 'answers', 'concept', 'observation', 'executor', 'reproduction', 'evidence'])
    || input.schemaVersion !== 1 || input.catalogVersion !== PRACTICE_CATALOG_VERSION) return bad('练习格式或版本不受支持，原内容未修改。');
  if (!text(input.caseSlug, 80) || !catalog.cases.some(item => item.slug === input.caseSlug)) return bad('这个案例不在当前公开参考目录中，请到原学习工作台查看。');
  if (!plain(input.answers) || !exactKeys(input.answers, [...PRACTICE_QUANTITIES])) return bad('练习答案字段无效，原内容未修改。');
  const answers = {} as Record<PracticeQuantityId, string>;
  for (const id of PRACTICE_QUANTITIES) {
    if (!text(input.answers[id], 64)) return bad('每项数值输入最多 64 字；输入没有被截断。');
    answers[id] = input.answers[id] as string;
  }
  if (typeof input.concept !== 'string' || !['', 'not-proof', 'proof'].includes(input.concept)) return bad('概念选项无效。');
  if (!text(input.observation, 4000) || !text(input.evidence, 4000)) return bad('观察和证据各限 4000 字；原输入仍保留。');
  if (typeof input.executor !== 'string' || !PRACTICE_EXECUTORS.includes(input.executor as ProjectPractice['executor'])
    || typeof input.reproduction !== 'string' || !PRACTICE_REPRODUCTION.includes(input.reproduction as ProjectPractice['reproduction'])) return bad('执行者或复现状态无效。');
  return { ok: true, value: {
    schemaVersion: 1, catalogVersion: PRACTICE_CATALOG_VERSION, caseSlug: input.caseSlug, answers,
    concept: input.concept as ProjectPractice['concept'], observation: input.observation,
    executor: input.executor as ProjectPractice['executor'], reproduction: input.reproduction as ProjectPractice['reproduction'], evidence: input.evidence,
  } };
}
export function parseProjectPractice(raw: unknown, catalog: PracticeCatalog): PracticeResult<ProjectPractice> {
  if (typeof raw !== 'string' || raw.length > MAX_RAW) return bad('这不是当前版本的项目练习，请到原学习工作台查看。');
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!plain(envelope) || !exactKeys(envelope, ['projectPractice'])) return bad('这不是当前版本的项目练习，请到原学习工作台查看。');
    return validateProjectPractice(envelope.projectPractice, catalog);
  } catch { return bad('练习原始数据无法读取，原内容未修改。'); }
}

/** A whole-string decimal parser. Blank strings, units, hex, NaN and Infinity never become zero. */
export function parsePracticeNumber(input: unknown): PracticeResult<number> {
  if (!text(input, 64) || !input.trim() || !NUMERIC.test(input.trim())) return bad('请填写完整的有限十进制数值，可用科学计数；单位见输入框旁标注。');
  const value = Number(input.trim());
  if (!Number.isFinite(value)) return bad('数值超出有限数范围，未进行判定。');
  return { ok: true, value };
}
export function checkProjectPractice(input: ProjectPractice, catalog: PracticeCatalog): PracticeFeedback {
  const checked = validateProjectPractice(input, catalog);
  if (checked.ok === false) throw new Error(checked.error);
  const practice = checked.value;
  const item = catalog.cases.find(value => value.slug === practice.caseSlug)!;
  const quantities = item.quantities.map(quantity => {
    const parsed = parsePracticeNumber(practice.answers[quantity.id]);
    const tolerance = Math.max(quantity.absoluteTolerance, quantity.relativeTolerance * Math.abs(quantity.value));
    const error = parsed.ok ? Math.abs(parsed.value - quantity.value) : null;
    const valid = parsed.ok && error !== null && Number.isFinite(error);
    const matches = valid && error! <= tolerance;
    return {
      id: quantity.id, label: quantity.label, input: practice.answers[quantity.id], unit: quantity.unit,
      expected: quantity.value, actual: parsed.ok ? parsed.value : null,
      absoluteError: valid ? error : null, tolerance, valid, matches, explanation: quantity.explanation,
      message: parsed.ok === false ? parsed.error : !valid ? '数值差超出可计算范围，未进行判定。' : matches ? '在参考容差内' : '超出参考容差',
    };
  });
  const concept = { input: practice.concept, answered: Boolean(practice.concept), matches: practice.concept === 'not-proof', explanation: PRACTICE_CONCEPT_EXPLANATION };
  return { quantities, concept, allMatch: quantities.every(item => item.matches) && concept.matches };
}
export function projectPracticeMarkdown(input: ProjectPractice, catalog: PracticeCatalog, includeFeedback = true): string {
  const checked = validateProjectPractice(input, catalog);
  if (checked.ok === false) throw new Error(checked.error);
  const practice = checked.value;
  const item = catalog.cases.find(value => value.slug === practice.caseSlug)!;
  const choice = practice.concept === 'not-proof' ? '还需核查假设、平衡与误差' : practice.concept === 'proof' ? '已证明工程验证完成' : '未选择';
  const chunks = [
    `# ${item.title}：项目练习`,
    '> 私人项目练习草稿。这里记录填写的答案与观察；参考对照不是用户求解证据，不证明工程验证完成或已经掌握。',
    `参考目录：${practice.catalogVersion}\n\n案例：${item.href}\n\n实际学习日期：未提供`,
    `执行者：${practice.executor}\n\n复现状态：${practice.reproduction}`,
    '## 我填写的数值（不是求解器输出）\n\n' + item.quantities.map(quantity => `${quantity.label}：${practice.answers[quantity.id] || '未填写'} ${quantity.unit}`).join('\n\n'),
    `## 概念选择\n\n求解成功是否等于工程验证完成？\n\n我的选择：${choice}`,
    `## 我的观察\n\n${practice.observation || '未记录'}`,
    `## 证据与来源\n\n${practice.evidence || '未提供'}`,
  ];
  if (includeFeedback) {
    const feedback = checkProjectPractice(practice, catalog);
    chunks.push('## 按当前公开目录重新计算的练习反馈\n\n' + feedback.quantities.map(quantity => `${quantity.label}：输入 ${quantity.input || '未填写'}；参考 ${quantity.expected} ${quantity.unit}；绝对误差 ${quantity.absoluteError ?? '无法计算'}；容差 ${quantity.tolerance} ${quantity.unit}；${quantity.message}。\n\n依据：${quantity.explanation}`).join('\n\n'));
    chunks.push(`判定规则：abs(输入−参考)<=max(绝对容差,相对容差×abs(参考))。\n\n概念对照：${feedback.concept.matches ? '选择相符' : feedback.concept.answered ? '需要修正理解' : '尚未选择'}。${PRACTICE_CONCEPT_EXPLANATION}`);
  }
  return chunks.join('\n\n') + '\n';
}
export function projectPracticeJson(input: ProjectPractice, catalog: PracticeCatalog): string {
  const checked = validateProjectPractice(input, catalog);
  if (checked.ok === false) throw new Error(checked.error);
  return JSON.stringify({ projectPractice: checked.value }, null, 2);
}
function mappedFields(practice: ProjectPractice, catalog: PracticeCatalog): Record<string, string> {
  const item = catalog.cases.find(value => value.slug === practice.caseSlug)!;
  return {
    recordType: '项目练习', project: '线性静力验证项目', raw: JSON.stringify({ projectPractice: practice }),
    knowledgeLinks: item.href, problem: `${item.title}：数值参考对照与工程验证边界`,
    input: item.quantities.map(quantity => `${quantity.label}：${practice.answers[quantity.id] || '未填写'} ${quantity.unit}`).join('\n'),
    expectedOutput: `公开参考目录 ${practice.catalogVersion}；案例 ${practice.caseSlug}。数值判定需在项目页按当前目录重新计算。`,
    actualOutput: '此处是填写的练习答案，不是求解器运行输出。', understanding: practice.observation,
    executor: practice.executor, reproduction: practice.reproduction, evidence: practice.evidence,
    body: projectPracticeMarkdown(practice, catalog, false),
  };
}
export function readPracticeStudyItem(input: unknown, catalog: PracticeCatalog): PracticeResult<{ item: StudyItem; practice: ProjectPractice }> {
  if (!plain(input) || input.kind !== 'record' || !isPracticeRecordId(input.id) || !text(input.title, 200) || !input.title.trim()
    || !plain(input.fields) || input.fields.recordType !== '项目练习') return bad('这不是本项目的结构化练习，请到原学习工作台查看，避免覆盖其他内容。');
  if (input.visibility !== 'private') return bad('这条记录为待公开或已公开，请到原学习工作台管理；本页不会修改或撤回它。');
  if (typeof input.learningStatus !== 'string' || !['not-started', 'introduced', 'followed', 'explain', 'independent'].includes(input.learningStatus)
    || typeof input.reviewStatus !== 'string' || !['draft', 'pending', 'reviewed'].includes(input.reviewStatus) || !Number.isSafeInteger(input.revision) || Number(input.revision) < 1
    || typeof input.createdAt !== 'string' || typeof input.updatedAt !== 'string') return bad('记录状态或修订版本无效，已停止编辑。');
  const fields = input.fields;
  if (Object.keys(fields).length > 48 || Object.entries(fields).some(([key, value]) => !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || !text(value, MAX_RAW))) return bad('记录字段无法安全保存，请到原学习工作台查看。');
  for (const [key, kind] of [['sourceIds', 'source'], ['noteIds', 'note']] as const) {
    if (!Array.isArray(input[key]) || input[key].length > 40 || input[key].some(id => typeof id !== 'string' || !new RegExp(`^${kind}-[a-f0-9-]{36}$`).test(id))) return bad('记录关联数据无效，请到原学习工作台查看。');
  }
  const parsed = parseProjectPractice(fields.raw, catalog);
  if (parsed.ok === false) return parsed;
  const item = catalog.cases.find(value => value.slug === parsed.value.caseSlug)!;
  if (input.title !== `${item.title}：项目练习` || Object.entries(mappedFields(parsed.value, catalog)).some(([key, value]) => fields[key] !== value)) return bad('这条练习已在原学习工作台修改，结构化副本与正文不一致，请在那里继续编辑，避免覆盖修改。');
  return { ok: true, value: { item: input as unknown as StudyItem, practice: parsed.value } };
}
export function toPracticeStudyItem(input: ProjectPractice, catalog: PracticeCatalog, previous?: StudyItem): PracticeStudyDraft {
  const checked = validateProjectPractice(input, catalog);
  if (checked.ok === false) throw new Error(checked.error);
  if (previous) { const old = readPracticeStudyItem(previous, catalog); if (old.ok === false) throw new Error(old.error); }
  const practice = checked.value;
  const item: PracticeStudyDraft = {
    ...(previous || {}), kind: 'record', title: `${catalog.cases.find(value => value.slug === practice.caseSlug)!.title}：项目练习`,
    fields: { ...(previous?.fields || {}), ...mappedFields(practice, catalog) },
    sourceIds: [...(previous?.sourceIds || [])], noteIds: [...(previous?.noteIds || [])],
    learningStatus: previous?.learningStatus || 'not-started', reviewStatus: 'draft', visibility: 'private',
  };
  if (Object.keys(item.fields).length > 48 || Object.values(item.fields).some(value => value.length > MAX_RAW)) throw new Error('练习超过单条字段限制，请拆分观察或证据；原输入仍保留。');
  if (new TextEncoder().encode(JSON.stringify({ item, revision: previous?.revision })).byteLength > MAX_BODY_BYTES) throw new Error('练习超过 128 KiB 请求限制，请先导出并拆分；内容未被截断。');
  return item;
}
