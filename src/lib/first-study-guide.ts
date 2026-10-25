import { firstStudyGuide, firstStudySteps, type FirstStudyField, type FirstStudyStep } from '../data/first-study-guide';

export const FIRST_STUDY_TEXT_LIMIT = 2000;
export interface FirstStudyDraft {
  fields: Record<FirstStudyField, string>;
  declarations: Record<FirstStudyStep, { selfReported: boolean; declaredAt: string | null }>;
  startedAt: string | null;
  finishedAt: string | null;
}
export type GuideChange = { ok: true; draft: FirstStudyDraft } | { ok: false; error: string };
const validTime = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const copy = (draft: FirstStudyDraft): FirstStudyDraft => structuredClone(draft);

export function emptyFirstStudy(): FirstStudyDraft {
  return { fields: { prediction: '', pythonObservation: '', assemblyObservation: '', evidenceObservation: '', environment: '' },
    declarations: { predict: { selfReported: false, declaredAt: null }, python: { selfReported: false, declaredAt: null }, assembly: { selfReported: false, declaredAt: null }, evidence: { selfReported: false, declaredAt: null } },
    startedAt: null, finishedAt: null };
}

/** Editing an observation invalidates its earlier declaration and completion. */
export function updateFirstStudy(draft: FirstStudyDraft, field: FirstStudyField, text: string): GuideChange {
  if (!Object.hasOwn(draft.fields, field) || typeof text !== 'string' || text.length > FIRST_STUDY_TEXT_LIMIT) return { ok: false, error: '每项最多 2,000 字；请缩短后再导出。' };
  const next = copy(draft);
  if (next.fields[field] === text) return { ok: true, draft: next };
  next.fields[field] = text; next.finishedAt = null;
  const step = firstStudySteps.find(item => item.field === field);
  if (step) next.declarations[step.id] = { selfReported: false, declaredAt: null };
  return { ok: true, draft: next };
}

export function declareFirstStudy(draft: FirstStudyDraft, step: FirstStudyStep, checked: boolean, now: string): GuideChange {
  const definition = firstStudySteps.find(item => item.id === step);
  if (!definition || !validTime(now)) return { ok: false, error: '无法记录本次声明时间，请检查本机时间。' };
  if (checked && !draft.fields[definition.field].trim()) return { ok: false, error: '请先写下这一步的预测、观察或未完成原因，再自行勾选。' };
  const next = copy(draft);
  if (next.declarations[step].selfReported === checked) return { ok: true, draft: next };
  next.declarations[step] = { selfReported: checked, declaredAt: checked ? now : null };
  next.finishedAt = null;
  return { ok: true, draft: next };
}

export function startFirstStudy(draft: FirstStudyDraft, now: string): GuideChange {
  if (!validTime(now)) return { ok: false, error: '无法记录开始时间，请检查本机时间。' };
  if (draft.startedAt || draft.finishedAt) return { ok: false, error: '本次时间已记录；重新开始请先清空本页。' };
  const next = copy(draft); next.startedAt = now;
  return { ok: true, draft: next };
}

export function finishFirstStudy(draft: FirstStudyDraft, now: string): GuideChange {
  if (!firstStudySteps.every(step => draft.declarations[step.id].selfReported && draft.fields[step.field].trim())) return { ok: false, error: '请先记录并自行确认四步；未完成或受阻也可以如实写明。' };
  if (!validTime(now) || (draft.startedAt && Date.parse(now) < Date.parse(draft.startedAt)) || firstStudySteps.some(step => Date.parse(now) < Date.parse(draft.declarations[step.id].declaredAt!))) return { ok: false, error: '结束时间早于本次记录，请检查本机时间后再试。' };
  if (draft.finishedAt) return { ok: false, error: '本次自述已结束。修改记录会撤销结束标记，需要你重新确认。' };
  const next = copy(draft); next.finishedAt = now;
  return { ok: true, draft: next };
}

export function exportFirstStudy(draft: FirstStudyDraft, now: string) {
  if (!validTime(now)) throw new Error('导出时间不可用。');
  return {
    schemaVersion: 1, guideVersion: firstStudyGuide.version, contentVersions: { ...firstStudyGuide.contentVersions },
    title: firstStudyGuide.title, reviewStatus: 'draft-pending-human-review', visibility: 'private-local-export',
    fixedCase: { slug: firstStudyGuide.caseSlug, inputs: structuredClone(firstStudyGuide.inputs), assembly: { ...firstStudyGuide.assembly }, sourceInput: firstStudyGuide.sourceInput, assumptions: [...firstStudyGuide.assumptions], limits: [...firstStudyGuide.limits] },
    recordedAt: now, startedAt: draft.startedAt, finishedAt: draft.finishedAt,
    sessionStatus: draft.finishedAt ? 'ended' : 'in-progress', learningCompletion: 'not-assessed',
    environment: { status: draft.fields.environment.trim() ? 'learner-self-report-unverified' : 'not-provided', statement: draft.fields.environment || '未提供；本页没有核验执行环境。' },
    fields: { ...draft.fields }, declarations: structuredClone(draft.declarations),
    executionEvidence: { status: 'not-verified-by-guide', note: '本页不运行程序、不读取其他实验页结果。手动勾选与自述结束不证明已运行、已复现或已掌握；实际运行文件需要另行导出并由本人核对。' },
    scope: '用户在当前页面填写的私人试学自述草稿。时间来自本机浏览器，只记录显式点击；不是经系统验证的课程完成、工程求解或用户反馈验收记录。',
  };
}

/** Indent every user-authored line so it cannot create Markdown headings. */
const asTextBlock = (value: string) => (value || '未记录').split(/\r?\n/).map(line => `    ${line}`).join('\n');
export function firstStudyMarkdown(draft: FirstStudyDraft, now: string): string {
  const data = exportFirstStudy(draft, now);
  return [`# ${data.title}：私人自述草稿`, '', `引导版本：${data.guideVersion}；内容：${Object.entries(data.contentVersions).map(([key, value]) => `${key}=${value}`).join(' / ')}`,
    '内容审核：待人工复核；自述不证明已运行、已复现或已掌握。', `导出时间：${now}`, `显式开始时间：${draft.startedAt || '未记录'}`, `显式结束时间：${draft.finishedAt || '未记录'}`, `自述记录：${data.sessionStatus === 'ended' ? '已结束' : '未结束'}；任务是否完成：未判定。`, '',
    '## 固定教学输入', '', ...Object.entries(firstStudyGuide.inputs).map(([key, value]) => `- ${key} = ${value.value} ${value.unit}`), `- 装配长度：L1=${firstStudyGuide.assembly.L1} mm；L2=${firstStudyGuide.assembly.L2} mm`, `- 原始输入：${firstStudyGuide.sourceInput}`, '',
    '## 模型假设与未验证范围', '', ...[...firstStudyGuide.assumptions, ...firstStudyGuide.limits].map(value => `- ${value}`), '',
    '## 我自述的执行环境（未经本页核验）', '', asTextBlock(draft.fields.environment), '',
    ...firstStudySteps.flatMap(step => [`## ${step.number} / ${step.title}`, '', asTextBlock(draft.fields[step.field]), '', `手动声明：${draft.declarations[step.id].selfReported ? '已自行确认' : '未确认'}；声明时间：${draft.declarations[step.id].declaredAt || '未记录'}`, '']),
    '## 证据范围', '', data.executionEvidence.note, '', data.scope, ''].join('\n');
}
