import { firstStudyGuide } from '../data/first-study-guide';
import { readFirstStudyBackup, MAX_FIRST_STUDY_BACKUP_BYTES } from './first-study-backup';
import type { FirstStudyDraft } from './first-study-guide';
import type { EvidenceKind } from './study-evidence';
import {
  blankFailureReview, toFailureStudyItem, validateFailureReview,
  type FailureResult, type FailureReview,
} from './failure-review';

export const MAX_FAILURE_REVIEW_IMPORT_BYTES = MAX_FIRST_STUDY_BACKUP_BYTES;
export const MAX_FAILURE_REVIEW_FILE_BYTES = 128 * 1024;
export interface FailureReviewImportSource {
  fileName: string; sha256: string; sizeBytes: number; importedAt: string;
}
export type FailureReviewImport =
  | { kind: 'failure-review'; review: FailureReview; source: FailureReviewImportSource }
  | { kind: 'first-study'; draft: FirstStudyDraft; source: FailureReviewImportSource };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const fileNameOK = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
  && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);
const timeOK = (value: unknown): value is string => typeof value === 'string' && value.length === 24
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function safeTree(value: unknown, depth = 0): boolean {
  if (depth > 32) return false;
  if (Array.isArray(value)) return value.length <= 1000 && value.every(item => safeTree(item, depth + 1));
  return !record(value) || Object.keys(value).every(key => !['__proto__', 'prototype', 'constructor'].includes(key)
    && safeTree(value[key], depth + 1));
}

/** Local file parsing only: no account lookup, upload, execution or live form mutation. */
export async function readFailureReviewImport(bytes: Uint8Array, fileName: string, importedAt: string): Promise<FailureResult<FailureReviewImport>> {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > MAX_FAILURE_REVIEW_IMPORT_BYTES) return fail('请选择非空且不超过 2 MiB 的 JSON 文件。');
  if (!fileNameOK(fileName) || !timeOK(importedAt)) return fail('文件名或本次读取时间无效。');
  // Snapshot before any await so a caller cannot change the file under validation.
  const selected = Uint8Array.from(bytes);
  let data: unknown;
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(selected);
    data = JSON.parse(text.startsWith('\uFEFF') ? text.slice(1) : text);
  } catch { return fail('无法读取文件：需要完整的 UTF-8 JSON 备份。'); }
  if (!record(data) || !safeTree(data)) return fail('文件包含不支持的结构或对象键。');

  if (Object.hasOwn(data, 'failureReview')) {
    if (selected.byteLength > MAX_FAILURE_REVIEW_FILE_BYTES) return fail('失败复盘 JSON 文件不能超过 128 KiB；内容未被截断。');
    if (Object.keys(data).length !== 1) return fail('失败复盘备份包含未支持的字段。');
    // Validate the decoded document, not the whitespace of its pretty JSON export.
    const checked = validateFailureReview(data.failureReview);
    if (!checked.ok) return checked;
    try {
      const hash = await crypto.subtle.digest('SHA-256', selected.buffer);
      const sha256 = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
      return { ok: true, value: { kind: 'failure-review', review: checked.value,
        source: { fileName, sha256, sizeBytes: selected.byteLength, importedAt } } };
    } catch { return fail('当前浏览器无法计算文件散列，未读取备份。'); }
  }

  if (data.schemaVersion !== 1 && data.schemaVersion !== 2) return fail('只支持本站导出的失败复盘 JSON 或首次试学备份（格式 1 / 2）。');
  const restored = await readFirstStudyBackup(selected, fileName, importedAt);
  if (!restored.ok) return fail(restored.error);
  const source = restored.draft.restoredFrom!;
  return { ok: true, value: { kind: 'first-study', draft: restored.draft,
    source: { fileName: source.fileName, sha256: source.sha256, sizeBytes: source.sizeBytes, importedAt: source.importedAt } } };
}

/** Copy only literal self-reports and a bounded file index into a fresh review. */
export function prepareFailureReviewImport(imported: FailureReviewImport, kind?: EvidenceKind): FailureResult<FailureReview> {
  if (imported.kind === 'failure-review') {
    // An unfinished export may have no title or exceed the account request size.
    // It must remain recoverable; the existing explicit save validates storage limits.
    return validateFailureReview(imported.review);
  }
  if (imported.kind !== 'first-study' || (kind !== 'python' && kind !== 'assembly')) return fail('请先明确选择要整理的 Python 或装配步骤。');
  const { draft, source } = imported;
  const label = kind === 'python' ? 'Python' : '装配';
  const observation = kind === 'python' ? draft.fields.pythonObservation : draft.fields.assemblyObservation;
  const attachment = draft.evidence.find(item => item.kind === kind);
  const review = blankFailureReview();
  review.title = `${label} 试学排查草稿（待补问题）`;
  review.software = kind === 'python' ? 'Python 教学实验' : '双杆装配教学实验';
  review.expected = draft.fields.prediction ? `原试学预测（来源文件自述，不等于已证实的判定依据）：\n${draft.fields.prediction}` : '';
  review.actual = [
    observation ? `所选步骤原始自述（未经核验）：\n${observation}` : '',
    draft.fields.environment ? `原试学执行环境自述（未经核验）：\n${draft.fields.environment}` : '',
  ].filter(Boolean).join('\n\n');
  review.model = [
    '引导固定教学模型，仅作来源背景；不是导入文件实际工况或所用输入的核验。',
    ...Object.entries(firstStudyGuide.inputs).map(([name, input]) => `${name} = ${input.value} ${input.unit}`),
    ...(kind === 'assembly' ? [`L1 = ${firstStudyGuide.assembly.L1} mm；L2 = ${firstStudyGuide.assembly.L2} mm`] : []),
    `公开输入：${firstStudyGuide.sourceInput}`,
    '教学模型假设：', ...firstStudyGuide.assumptions,
    '未验证范围：', ...firstStudyGuide.limits,
  ].join('\n');
  review.evidence = [
    '来源索引（所有文件与自述均待本人核对；散列只标识字节，不证明真实性）：',
    `试学备份文件名：${source.fileName}`,
    `试学备份 SHA-256：${source.sha256}`,
    `试学备份字节数：${source.sizeBytes}`,
    `本次本机读取时间：${source.importedAt}（不是学习发生日期）`,
    `引导版本：${firstStudyGuide.version}`,
    attachment ? [
      `所选 ${label} 结果文件名：${attachment.fileName}`,
      `结果 SHA-256：${attachment.sha256}`,
      `结果字节数：${attachment.sizeBytes}`,
      `结果文件原导入时间（文件声明）：${attachment.importedAt}`,
      `文件声明状态（未经核验）：${attachment.declaredStatus}`,
      `文件声明环境（未经核验）：${attachment.declaredEnvironment || '未提供'}`,
      `格式与输入对照标签（不核验输出）：${attachment.modelMatch}`,
      '原始结果文本未复制到此复盘。请另外保留原始结果和完整试学 JSON 备份。',
    ].join('\n') : `备份中未附 ${label} 结果文件；本条自述不证明已运行。`,
    '未复制其他实验观察、声明时间、结束状态或混合的下一步段落。请自行补充实际异常、发生日期、执行者与复现状态。',
  ].join('\n');
  const checked = validateFailureReview(review);
  if (!checked.ok) return checked;
  try { toFailureStudyItem(checked.value); }
  catch (error) { return fail(error instanceof Error ? error.message : '派生复盘超过保存限制；内容未被截断。'); }
  return checked;
}
