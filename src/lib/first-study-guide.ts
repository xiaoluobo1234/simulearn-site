import { firstStudyGuide, firstStudySteps, type FirstStudyField, type FirstStudyStep } from '../data/first-study-guide';
import type { StudyEvidence } from './study-evidence';

export const FIRST_STUDY_TEXT_LIMIT = 2000;
export interface FirstStudyDraft {
  fields: Record<FirstStudyField, string>;
  declarations: Record<FirstStudyStep, { selfReported: boolean; declaredAt: string | null }>;
  startedAt: string | null;
  finishedAt: string | null;
  evidence: StudyEvidence[];
  restoredFrom: FirstStudyRestoreSource | null;
}
export interface FirstStudyRestoreSource {
  fileName: string; sha256: string; sizeBytes: number; importedAt: string; sourceSchemaVersion: 1 | 2;
}
export type GuideChange = { ok: true; draft: FirstStudyDraft } | { ok: false; error: string };
const validTime = (value: string) => value.length === 24 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const copy = (draft: FirstStudyDraft): FirstStudyDraft => structuredClone(draft);

export function emptyFirstStudy(): FirstStudyDraft {
  return { fields: { prediction: '', pythonObservation: '', assemblyObservation: '', evidenceObservation: '', environment: '' },
    declarations: { predict: { selfReported: false, declaredAt: null }, python: { selfReported: false, declaredAt: null }, assembly: { selfReported: false, declaredAt: null }, evidence: { selfReported: false, declaredAt: null } },
    startedAt: null, finishedAt: null, evidence: [], restoredFrom: null };
}

/** Importing a file changes the observation basis; only the learner can re-confirm it. */
export function addStudyEvidence(draft: FirstStudyDraft, evidence: StudyEvidence): GuideChange {
  if (!evidence || !['python', 'assembly'].includes(evidence.kind)) return { ok: false, error: '请选择 Python 或装配实验导出的结果文件。' };
  if (draft.evidence.some(item => item.id === evidence.id || item.sha256 === evidence.sha256)) return { ok: false, error: '这个结果文件已经附在本次草稿中。' };
  if (draft.evidence.length >= 2 || draft.evidence.some(item => item.kind === evidence.kind)) return { ok: false, error: '每种实验最多附一份文件；替换前请先移除原文件。' };
  const next = copy(draft); next.evidence.push(structuredClone(evidence));
  next.declarations[evidence.kind] = { selfReported: false, declaredAt: null };
  next.declarations.evidence = { selfReported: false, declaredAt: null }; next.finishedAt = null;
  return { ok: true, draft: next };
}

export function removeStudyEvidence(draft: FirstStudyDraft, kind: StudyEvidence['kind']): GuideChange {
  if (!['python', 'assembly'].includes(kind) || !draft.evidence.some(item => item.kind === kind)) return { ok: false, error: '没有找到这份已附结果文件。' };
  const next = copy(draft); next.evidence = next.evidence.filter(item => item.kind !== kind);
  next.declarations[kind] = { selfReported: false, declaredAt: null };
  next.declarations.evidence = { selfReported: false, declaredAt: null }; next.finishedAt = null;
  return { ok: true, draft: next };
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
    schemaVersion: 2, guideVersion: firstStudyGuide.version, contentVersions: { ...firstStudyGuide.contentVersions },
    title: firstStudyGuide.title, reviewStatus: 'draft-pending-human-review', visibility: 'private-local-export',
    fixedCase: { slug: firstStudyGuide.caseSlug, inputs: structuredClone(firstStudyGuide.inputs), assembly: { ...firstStudyGuide.assembly }, sourceInput: firstStudyGuide.sourceInput, assumptions: [...firstStudyGuide.assumptions], limits: [...firstStudyGuide.limits] },
    recordedAt: now, startedAt: draft.startedAt, finishedAt: draft.finishedAt,
    sessionStatus: draft.finishedAt ? 'ended' : 'in-progress', learningCompletion: 'not-assessed',
    environment: { status: draft.fields.environment.trim() ? 'learner-self-report-unverified' : 'not-provided', statement: draft.fields.environment || '未提供；本页没有核验执行环境。' },
    fields: { ...draft.fields }, declarations: structuredClone(draft.declarations),
    evidence: structuredClone(draft.evidence), restoredFrom: structuredClone(draft.restoredFrom),
    executionEvidence: { status: 'not-verified-by-guide', note: '自选文件只经过格式与输入对照检查；文件中的执行状态、环境和输出仍是未经证实的声明。本页不执行导入代码或复算输出，不证明文件由本人运行、历史真实、结果正确、已独立复现或已掌握。' },
    scope: '用户在当前页面填写或从文件恢复的私人试学自述草稿。当前新时间来自本机浏览器的显式点击；恢复的历史时间是文件自述，文件导入时间另记。不是经系统验证的课程完成、工程求解或用户反馈验收记录。',
  };
}

/** Indent every user-authored line so it cannot create Markdown headings. */
const asTextBlock = (value: string) => (value || '未记录').split(/\r\n?|\n/).map(line => `    ${line}`).join('\n');
export function firstStudyMarkdown(draft: FirstStudyDraft, now: string): string {
  const data = exportFirstStudy(draft, now);
  return [`# ${data.title}：私人自述草稿`, '', `引导版本：${data.guideVersion}；内容：${Object.entries(data.contentVersions).map(([key, value]) => `${key}=${value}`).join(' / ')}`,
    '内容审核：待人工复核；自述不证明已运行、已复现或已掌握。', `导出时间：${now}`, `${draft.restoredFrom ? '文件自述开始时间' : '显式开始时间'}：${draft.startedAt || '未记录'}`, `${draft.restoredFrom ? '文件自述结束时间' : '显式结束时间'}：${draft.finishedAt || '未记录'}`, `自述记录：${data.sessionStatus === 'ended' ? '已结束' : '未结束'}；任务是否完成：未判定。`, '',
    '## 固定教学输入', '', ...Object.entries(firstStudyGuide.inputs).map(([key, value]) => `- ${key} = ${value.value} ${value.unit}`), `- 装配长度：L1=${firstStudyGuide.assembly.L1} mm；L2=${firstStudyGuide.assembly.L2} mm`, `- 原始输入：${firstStudyGuide.sourceInput}`, '',
    '## 模型假设与未验证范围', '', ...[...firstStudyGuide.assumptions, ...firstStudyGuide.limits].map(value => `- ${value}`), '',
    '## 我自述的执行环境（未经本页核验）', '', asTextBlock(draft.fields.environment), '',
    ...firstStudySteps.flatMap(step => [`## ${step.number} / ${step.title}`, '', asTextBlock(draft.fields[step.field]), '', `手动声明：${draft.declarations[step.id].selfReported ? '已自行确认' : '未确认'}；声明时间：${draft.declarations[step.id].declaredAt || '未记录'}`, '']),
    '## 自选结果文件（未经证实的导入文件）', '',
    ...(draft.evidence.length ? draft.evidence.flatMap(item => [
      `### ${item.kind === 'python' ? 'Python' : '装配'} 文件`, '',
      asTextBlock(`文件名：${item.fileName}\nSHA-256：${item.sha256}\n字节数：${item.sizeBytes}\n导入时间：${item.importedAt}\n信任状态：${item.trust}\n文件声明状态：${item.declaredStatus}\n文件声明环境：${item.declaredEnvironment || '未提供'}\n输入对照：${item.modelMatch}`), '',
      '格式与输入对照摘要（不证明运行历史或结果正确）：', '', asTextBlock(JSON.stringify(item.summary, null, 2)), '',
    ]) : ['未附结果文件。', '']),
    '原始文件文本保存在 JSON 备份中；本 Markdown 仅列出文件元数据与检查摘要。散列用于识别字节内容，不证明来源或真实性。', '',
    '## 草稿恢复来源', '',
    draft.restoredFrom ? asTextBlock(`文件名：${draft.restoredFrom.fileName}\nSHA-256：${draft.restoredFrom.sha256}\n字节数：${draft.restoredFrom.sizeBytes}\n恢复时间：${draft.restoredFrom.importedAt}\n来源格式：schemaVersion ${draft.restoredFrom.sourceSchemaVersion}`) : '未从文件恢复。', '',
    '恢复保留原文件中的自述与声明时间；这些时间不是本次的新点击或经系统核验的运行时间。', '',
    '## 证据范围', '', data.executionEvidence.note, '', data.scope, ''].join('\n');
}
