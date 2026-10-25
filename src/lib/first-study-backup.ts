import { firstStudyGuide, firstStudySteps, type FirstStudyField } from '../data/first-study-guide';
import { emptyFirstStudy, exportFirstStudy, FIRST_STUDY_TEXT_LIMIT, type FirstStudyDraft, type FirstStudyRestoreSource } from './first-study-guide';
import { restoreStudyEvidence } from './study-evidence';

export const MAX_FIRST_STUDY_BACKUP_BYTES = 2 * 1024 * 1024;
export type FirstStudyBackupResult = { ok: true; draft: FirstStudyDraft } | { ok: false; error: string };

const LEGACY_EXECUTION_NOTE = '本页不运行程序、不读取其他实验页结果。手动勾选与自述结束不证明已运行、已复现或已掌握；实际运行文件需要另行导出并由本人核对。';
const LEGACY_SCOPE = '用户在当前页面填写的私人试学自述草稿。时间来自本机浏览器，只记录显式点击；不是经系统验证的课程完成、工程求解或用户反馈验收记录。';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const hasKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const time = (value: unknown): value is string => typeof value === 'string' && value.length === 24 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const nullableTime = (value: unknown): value is string | null => value === null || time(value);
const validFileName = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);
const fail = (error: string): FirstStudyBackupResult => ({ ok: false, error });

/** Strict comparison is independent of JSON object key order. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => same(item, b[index]));
  return record(a) && record(b) && hasKeys(a, Object.keys(b)) && Object.keys(b).every(key => same(a[key], b[key]));
}

/** Never assign untrusted object keys to a draft, including prototype names. */
function safeTree(value: unknown, depth = 0): boolean {
  if (depth > 32) return false;
  if (Array.isArray(value)) return value.every(item => safeTree(item, depth + 1));
  if (!record(value)) return true;
  return Object.keys(value).every(key => !['__proto__', 'prototype', 'constructor'].includes(key) && safeTree(value[key], depth + 1));
}

function validRestoreSource(value: unknown): value is FirstStudyRestoreSource | null {
  if (value === null) return true;
  return hasKeys(value, ['fileName', 'sha256', 'sizeBytes', 'importedAt', 'sourceSchemaVersion'])
    && validFileName(value.fileName) && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256)
    && Number.isSafeInteger(value.sizeBytes) && (value.sizeBytes as number) > 0 && (value.sizeBytes as number) <= MAX_FIRST_STUDY_BACKUP_BYTES
    && time(value.importedAt) && (value.sourceSchemaVersion === 1 || value.sourceSchemaVersion === 2);
}

/** Reads a local backup as data only. It neither executes files nor changes a live draft. */
export async function readFirstStudyBackup(bytes: Uint8Array, fileName: string, importedAt: string): Promise<FirstStudyBackupResult> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAX_FIRST_STUDY_BACKUP_BYTES) return fail('草稿备份必须非空且不超过 2 MiB。');
  if (!validFileName(fileName) || !time(importedAt)) return fail('文件名或本次恢复时间无效。');
  // Snapshot before awaiting a hash; a caller cannot replace parsed bytes afterwards.
  const selected = Uint8Array.from(bytes);
  let value: unknown;
  try {
    const original = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(selected);
    value = JSON.parse(original.startsWith('\uFEFF') ? original.slice(1) : original);
  } catch { return fail('无法读取草稿：需要完整的 UTF-8 JSON 备份文件。'); }
  if (!safeTree(value) || !record(value)) return fail('草稿包含不支持的对象键或嵌套结构。');
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) return fail('不支持这个草稿格式版本；请保留原文件。');
  const sourceSchemaVersion = value.schemaVersion;
  const keys = ['schemaVersion', 'guideVersion', 'contentVersions', 'title', 'reviewStatus', 'visibility', 'fixedCase', 'recordedAt', 'startedAt', 'finishedAt', 'sessionStatus', 'learningCompletion', 'environment', 'fields', 'declarations', 'executionEvidence', 'scope'];
  if (sourceSchemaVersion === 2) keys.push('evidence', 'restoredFrom');
  if (!hasKeys(value, keys)) return fail('草稿字段缺失或包含未支持字段。');
  if (!time(value.recordedAt) || !nullableTime(value.startedAt) || !nullableTime(value.finishedAt)) return fail('草稿中的日期必须是完整的 ISO 时间或允许的空值。');
  const expected = exportFirstStudy(emptyFirstStudy(), value.recordedAt);
  if (value.guideVersion !== firstStudyGuide.version || !same(value.contentVersions, expected.contentVersions)) return fail('引导或教学内容版本不匹配，请保留原备份并核对版本。');
  if (value.title !== expected.title || !same(value.fixedCase, expected.fixedCase)) return fail('固定教学模型、单位、假设或原始来源发生变化，不能恢复到本次引导。');
  if (value.reviewStatus !== expected.reviewStatus || value.visibility !== expected.visibility || value.learningCompletion !== expected.learningCompletion || value.scope !== (sourceSchemaVersion === 1 ? LEGACY_SCOPE : expected.scope)) return fail('草稿的审核、私人范围或未判定状态不符合本页格式。');
  const executionEvidence = sourceSchemaVersion === 1 ? { status: 'not-verified-by-guide', note: LEGACY_EXECUTION_NOTE } : expected.executionEvidence;
  if (!same(value.executionEvidence, executionEvidence)) return fail('草稿中的证据范围声明发生变化，不能将其恢复为核验结果。');
  const draft = emptyFirstStudy();
  const fieldNames = Object.keys(draft.fields) as FirstStudyField[];
  const fields = value.fields;
  if (!hasKeys(fields, fieldNames) || fieldNames.some(field => typeof fields[field] !== 'string' || (fields[field] as string).length > FIRST_STUDY_TEXT_LIMIT)) return fail('草稿应包含五项完整文本，每项最多 2,000 字。');
  for (const field of fieldNames) draft.fields[field] = fields[field] as string;
  const expectedEnvironment = { status: draft.fields.environment.trim() ? 'learner-self-report-unverified' : 'not-provided', statement: draft.fields.environment || '未提供；本页没有核验执行环境。' };
  if (!same(value.environment, expectedEnvironment)) return fail('执行环境状态必须与原始自述一致，不能改成已核验环境。');
  if (!hasKeys(value.declarations, firstStudySteps.map(step => step.id))) return fail('草稿需要四项独立的自述声明。');
  for (const step of firstStudySteps) {
    const declaration = value.declarations[step.id];
    if (!hasKeys(declaration, ['selfReported', 'declaredAt']) || typeof declaration.selfReported !== 'boolean' || !nullableTime(declaration.declaredAt)
      || declaration.selfReported !== (declaration.declaredAt !== null) || (declaration.selfReported && !draft.fields[step.field].trim())) return fail('自述声明、原始文字与声明时间不一致。');
    draft.declarations[step.id] = { selfReported: declaration.selfReported, declaredAt: declaration.declaredAt };
  }
  draft.startedAt = value.startedAt; draft.finishedAt = value.finishedAt;
  const declarations = firstStudySteps.map(step => draft.declarations[step.id]);
  if (draft.finishedAt && (declarations.some(item => !item.selfReported || Date.parse(item.declaredAt!) > Date.parse(draft.finishedAt!)) || (draft.startedAt && Date.parse(draft.startedAt) > Date.parse(draft.finishedAt)))) return fail('结束标记需要四步自述，且不能早于开始或声明时间。');
  if (value.sessionStatus !== (draft.finishedAt ? 'ended' : 'in-progress')) return fail('会话结束状态与原始结束时间不一致。');
  const latestClaim = [draft.startedAt, draft.finishedAt, ...declarations.map(item => item.declaredAt)].filter((item): item is string => item !== null);
  if (latestClaim.some(item => Date.parse(item) > Date.parse(value.recordedAt as string))) return fail('原始导出时间早于其自述声明时间，请核对原文件。');
  if (sourceSchemaVersion === 2) {
    if (!validRestoreSource(value.restoredFrom)) return fail('草稿恢复来源元数据无效。');
    if (!Array.isArray(value.evidence) || value.evidence.length > 2) return fail('草稿每种实验最多保留一份结果文件。');
    for (const item of value.evidence) {
      const restored = await restoreStudyEvidence(item);
      if (!restored.ok) return fail(`附加结果文件无法恢复：${restored.error}`);
      if (draft.evidence.some(prior => prior.kind === restored.value.kind || prior.id === restored.value.id || prior.sha256 === restored.value.sha256)) return fail('草稿包含重复结果文件；每种实验最多一份。');
      if (Date.parse(restored.value.importedAt) > Date.parse(value.recordedAt as string)) return fail('结果文件导入时间晚于原草稿导出时间。');
      draft.evidence.push(structuredClone(restored.value));
    }
    if (value.restoredFrom && Date.parse(value.restoredFrom.importedAt) > Date.parse(value.recordedAt as string)) return fail('原恢复时间晚于原草稿导出时间。');
  }
  try {
    const hash = await crypto.subtle.digest('SHA-256', selected.buffer);
    const sha256 = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    draft.restoredFrom = { fileName, sha256, sizeBytes: selected.byteLength, importedAt, sourceSchemaVersion };
  } catch { return fail('当前浏览器无法计算文件散列，未恢复草稿。'); }
  return { ok: true, draft };
}
