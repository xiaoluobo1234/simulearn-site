import type { ContentReviewItem, ContentReviewPack } from './content-review-pack';

export const MAX_REVIEW_WORKSHEET_BYTES = 2 * 1024 * 1024;
export const WORKSHEET_SCOPE = '本地单项人工审核记录。审核人、日期、检查与结论均为填写者或导入文件的声明，未验证身份或审核真实性；不写入服务器，不修改公开审核状态，不批准发布。';
const REPOSITORY = 'https://github.com/xiaoluobo1234/simulearn-site';
const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
export type ReviewDecision = 'not-reviewed' | 'pass' | 'changes-required' | 'not-applicable';
export type ReviewConclusion = 'not-recorded' | 'acceptable' | 'changes-required' | 'blocked';
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface ReviewWorksheet {
  schemaVersion: 1;
  kind: 'content-review-worksheet';
  basis: { repository: string; sourceCommit: string; generatedAt: string; workingTree: 'clean' | 'modified' };
  item: {
    id: string; title: string; href: string; contentVersion: string; sourcePath: string; fingerprint: string;
    files: { path: string; sha256: string; sizeBytes: number }[];
    checks: { id: string; question: string }[];
  };
  review: {
    reviewer: string; reviewedAt: string; scope: string; notes: string; conclusion: ReviewConclusion;
    checks: { id: string; decision: ReviewDecision; note: string }[];
  };
  publication: { state: 'pending-repository-review'; approved: false };
}
export interface ReviewWorksheetImport {
  worksheet: ReviewWorksheet;
  source: { fileName: string; sha256: string; sizeBytes: number; importedAt: string };
  match: { compatible: boolean; reasons: string[] };
}
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const own = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function keys(value: unknown, expected: string[]): value is Record<string, unknown> {
  return own(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
function text(value: unknown, maximum: number, singleLine = false): value is string {
  return typeof value === 'string' && value.length <= maximum && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value) && (!singleLine || !/[\r\n\t]/.test(value));
}
function filled(value: string): boolean { return value.trim().length > 0; }
function stamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function date(value: unknown): value is string {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function path(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 400 && /^(?:src|public|docs|scripts)\/[A-Za-z0-9/_.\[\]-]+$/.test(value) && value.split('/').every(part => !!part && part !== '.' && part !== '..');
}
function safeTree(value: unknown, depth = 0, seen = new Set<object>()): boolean {
  if (depth > 16) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value) || (!Array.isArray(value) && !own(value))) return false;
  seen.add(value);
  const names = Reflect.ownKeys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  // Public validation also accepts unknown objects: inspect data descriptors without invoking getters.
  const valid = names.length <= 256 && names.every(key => typeof key === 'string' && !['__proto__', 'prototype', 'constructor'].includes(key) && Object.hasOwn(descriptors[key], 'value')) && (!Array.isArray(value) || value.length <= 255) && names.every(key => typeof key === 'string' && safeTree(descriptors[key].value, depth + 1, seen));
  seen.delete(value);
  return valid;
}
function conclusionError(sheet: ReviewWorksheet): string | null {
  const review = sheet.review;
  if (review.conclusion === 'not-recorded') return null;
  if (![review.reviewer, review.reviewedAt, review.scope].every(filled)) return '登记结论前请填写实际审核人、审核日期与核对范围。';
  if (review.conclusion === 'acceptable' && !review.checks.every(check => check.decision === 'pass' && filled(check.note))) return '“可接受”要求每项检查明确通过并填写实际依据；未核对、不适用或需修改不能替代通过。';
  if (review.conclusion === 'changes-required' && !review.checks.some(check => check.decision === 'changes-required' && filled(check.note))) return '“需要修改”至少需要一项需修改的检查及问题依据。';
  if (review.conclusion === 'blocked' && !filled(review.notes)) return '“审核受阻”需要填写受阻原因。';
  return null;
}

export function validateReviewWorksheet(input: unknown): Result<ReviewWorksheet> {
  try {
    if (!safeTree(input) || !keys(input, ['schemaVersion', 'kind', 'basis', 'item', 'review', 'publication']) || input.schemaVersion !== 1 || input.kind !== 'content-review-worksheet') return fail('不是支持的单项人工审核记录格式。');
    const basis = input.basis, item = input.item, review = input.review;
    if (!keys(basis, ['repository', 'sourceCommit', 'generatedAt', 'workingTree']) || basis.repository !== REPOSITORY || typeof basis.sourceCommit !== 'string' || !COMMIT.test(basis.sourceCommit) || !stamp(basis.generatedAt) || !['clean', 'modified'].includes(basis.workingTree as string)) return fail('审核依据的仓库、提交或生成时间无效。');
    if (!keys(item, ['id', 'title', 'href', 'contentVersion', 'sourcePath', 'fingerprint', 'files', 'checks']) || !text(item.id, 160, true) || !/^[a-z0-9:-]+$/.test(item.id) || !text(item.title, 300, true) || !filled(item.title) || !text(item.href, 300, true) || !/^\/[a-z0-9/-]+\/$/.test(item.href) || !text(item.contentVersion, 100, true) || !filled(item.contentVersion) || !path(item.sourcePath) || typeof item.fingerprint !== 'string' || !SHA.test(item.fingerprint)) return fail('审核条目的身份、页面或文件集合指纹无效。');
    if (!Array.isArray(item.files) || item.files.length < 1 || item.files.length > 128 || !item.files.every(file => keys(file, ['path', 'sha256', 'sizeBytes']) && path(file.path) && typeof file.sha256 === 'string' && SHA.test(file.sha256) && Number.isSafeInteger(file.sizeBytes) && (file.sizeBytes as number) > 0 && (file.sizeBytes as number) <= 100 * 1024 * 1024) || new Set(item.files.map(file => file.path)).size !== item.files.length || !item.files.some(file => file.path === item.sourcePath)) return fail('审核文件列表无效或重复。');
    if (!Array.isArray(item.checks) || item.checks.length < 1 || item.checks.length > 32 || !item.checks.every(check => keys(check, ['id', 'question']) && text(check.id, 100, true) && /^[a-z0-9-]+$/.test(check.id) && text(check.question, 2000, true) && filled(check.question)) || new Set(item.checks.map(check => check.id)).size !== item.checks.length) return fail('审核检查问题无效或重复。');
    const itemChecks = item.checks as { id: string; question: string }[];
    if (!keys(review, ['reviewer', 'reviewedAt', 'scope', 'notes', 'conclusion', 'checks']) || !text(review.reviewer, 200, true) || !date(review.reviewedAt) || !text(review.scope, 10000) || !text(review.notes, 20000) || !['not-recorded', 'acceptable', 'changes-required', 'blocked'].includes(review.conclusion as string)) return fail('审核人、日期、范围、说明或结论格式无效。');
    if (!Array.isArray(review.checks) || review.checks.length !== itemChecks.length || !review.checks.every((check, index) => keys(check, ['id', 'decision', 'note']) && check.id === itemChecks[index].id && ['not-reviewed', 'pass', 'changes-required', 'not-applicable'].includes(check.decision as string) && text(check.note, 10000))) return fail('实际检查记录与问题列表不一致。');
    if (!keys(input.publication, ['state', 'approved']) || input.publication.state !== 'pending-repository-review' || input.publication.approved !== false) return fail('本地审核记录不能批准发布或修改仓库审核状态。');
    const sheet = input as unknown as ReviewWorksheet;
    const error = conclusionError(sheet);
    if (error) return fail(error);
    if (new TextEncoder().encode(JSON.stringify(sheet)).byteLength > MAX_REVIEW_WORKSHEET_BYTES) return fail('审核记录超过 2 MiB 限制。');
    return { ok: true, value: clone(sheet) };
  } catch { return fail('无法读取审核记录结构。'); }
}

function itemSnapshot(item: ContentReviewItem): ReviewWorksheet['item'] {
  return { id: item.id, title: item.title, href: item.href, contentVersion: item.contentVersion, sourcePath: item.sourcePath, fingerprint: item.fingerprint, files: item.files.map(file => ({ path: file.path, sha256: file.sha256, sizeBytes: file.sizeBytes })), checks: item.checks.map(check => ({ id: check.id, question: check.question })) };
}
export function emptyReviewWorksheet(pack: ContentReviewPack, itemId: string): ReviewWorksheet {
  const item = pack.items.find(value => value.id === itemId);
  if (!item) throw new Error('找不到当前审核条目。');
  const result = validateReviewWorksheet({ schemaVersion: 1, kind: 'content-review-worksheet', basis: { repository: pack.repository, sourceCommit: pack.sourceCommit, generatedAt: pack.generatedAt, workingTree: pack.workingTree }, item: itemSnapshot(item), review: { reviewer: '', reviewedAt: '', scope: '', notes: '', conclusion: 'not-recorded', checks: item.checks.map(check => ({ id: check.id, decision: 'not-reviewed', note: '' })) }, publication: { state: 'pending-repository-review', approved: false } });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
export function editReviewWorksheet(sheet: ReviewWorksheet, field: 'reviewer' | 'reviewedAt' | 'scope' | 'notes', value: string): Result<ReviewWorksheet> {
  const checked = validateReviewWorksheet(sheet);
  if (!checked.ok) return checked;
  if (!['reviewer', 'reviewedAt', 'scope', 'notes'].includes(field)) return fail('未知审核字段。');
  const next = checked.value;
  if (next.review[field] !== value) { next.review[field] = value; next.review.conclusion = 'not-recorded'; }
  return validateReviewWorksheet(next);
}
export function editReviewCheck(sheet: ReviewWorksheet, checkId: string, field: 'decision' | 'note', value: string): Result<ReviewWorksheet> {
  const checked = validateReviewWorksheet(sheet);
  if (!checked.ok) return checked;
  if (field !== 'decision' && field !== 'note') return fail('未知检查字段。');
  const check = checked.value.review.checks.find(item => item.id === checkId);
  if (!check) return fail('未知检查项目。');
  if (check[field] !== value) {
    if (field === 'decision') check.decision = value as ReviewDecision;
    else check.note = value;
    checked.value.review.conclusion = 'not-recorded';
  }
  return validateReviewWorksheet(checked.value);
}
export function concludeReviewWorksheet(sheet: ReviewWorksheet, conclusion: ReviewConclusion): Result<ReviewWorksheet> {
  const checked = validateReviewWorksheet(sheet);
  if (!checked.ok) return checked;
  checked.value.review.conclusion = conclusion;
  return validateReviewWorksheet(checked.value);
}
export function exportReviewWorksheetJson(sheet: ReviewWorksheet, exportedAt: string): string {
  const checked = validateReviewWorksheet(sheet);
  if (!checked.ok) throw new Error(checked.error);
  if (!stamp(exportedAt)) throw new Error('导出时间无效。');
  const result = `${JSON.stringify({ ...checked.value, scope: WORKSHEET_SCOPE, exportedAt }, null, 2)}\n`;
  if (new TextEncoder().encode(result).byteLength > MAX_REVIEW_WORKSHEET_BYTES) throw new Error('审核记录超过 2 MiB 限制。');
  return result;
}
const escaped = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&').replace(/[\r\n]+/g, ' ');
const block = (value: string): string => (value || '未填写').replace(/\r\n?/g, '\n').split('\n').map(line => `    ${line}`).join('\n');
export function reviewWorksheetMarkdown(sheet: ReviewWorksheet, exportedAt: string): string {
  exportReviewWorksheetJson(sheet, exportedAt); // Same validity and size limits as the JSON backup.
  const decision: Record<ReviewDecision, string> = { 'not-reviewed': '未核对', pass: '已核对通过（填写者声明）', 'changes-required': '需要修改', 'not-applicable': '不适用（不能替代通过）' };
  const conclusion: Record<ReviewConclusion, string> = { 'not-recorded': '未登记', acceptable: '本项可接受（填写者声明）', 'changes-required': '需要修改', blocked: '审核受阻' };
  const lines = ['# SimuLearn 单项人工审核记录', '', WORKSHEET_SCOPE, '', `导出时间：${exportedAt}`, `原审核依据提交：${sheet.basis.sourceCommit}`, `依据生成时间：${sheet.basis.generatedAt}`, `依据工作树：${sheet.basis.workingTree}`, '', `## ${escaped(sheet.item.title)}`, '', `条目：${escaped(sheet.item.id)}；页面：${escaped(sheet.item.href)}`, `内容版本：${escaped(sheet.item.contentVersion)}`, `文件集合 SHA-256：${sheet.item.fingerprint}`, '', `实际审核人（声明）：${escaped(sheet.review.reviewer || '未填写')}`, `实际审核日期（声明）：${sheet.review.reviewedAt || '未填写'}`, `本项结论：${conclusion[sheet.review.conclusion]}`, '', '### 实际核对范围', '', block(sheet.review.scope), '', '### 总体问题与依据', '', block(sheet.review.notes), '', '## 逐项检查', ''];
  sheet.item.checks.forEach((check, index) => lines.push(`### ${escaped(check.question)}`, '', `检查 ID：${escaped(check.id)}`, `结论：${decision[sheet.review.checks[index].decision]}`, '', block(sheet.review.checks[index].note), ''));
  lines.push('## 原审核文件依据', '', ...sheet.item.files.map(file => `- ${escaped(file.path)}：${file.sha256}；${file.sizeBytes} 字节`), '', '**发布仍待仓库评审；本文件不批准发布。**', '');
  return lines.join('\n');
}

function matchItem(sheet: ReviewWorksheet, pack: ContentReviewPack): ReviewWorksheetImport['match'] {
  const current = pack.items.find(item => item.id === sheet.item.id);
  if (!current) return { compatible: false, reasons: ['当前审核目录中没有此条目。'] };
  const snapshot = itemSnapshot(current), reasons: string[] = [];
  if (sheet.basis.repository !== pack.repository) reasons.push('审核依据仓库不同。');
  for (const field of ['id', 'title', 'href', 'contentVersion', 'sourcePath', 'fingerprint'] as const) if (sheet.item[field] !== snapshot[field]) reasons.push(`条目 ${field} 与当前版本不一致。`);
  const files = (values: ReviewWorksheet['item']['files']) => JSON.stringify([...values].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(file => ({ path: file.path, sha256: file.sha256, sizeBytes: file.sizeBytes })));
  if (files(sheet.item.files) !== files(snapshot.files)) reasons.push('相关文件路径、SHA-256 或字节数已变化。');
  const checks = (values: ReviewWorksheet['item']['checks']) => JSON.stringify(values.map(check => ({ id: check.id, question: check.question })));
  if (checks(sheet.item.checks) !== checks(snapshot.checks)) reasons.push('检查项目或问题文本已变化。');
  return { compatible: reasons.length === 0, reasons };
}
export async function readReviewWorksheetFile(bytes: Uint8Array, fileName: string, importedAt: string, pack: ContentReviewPack): Promise<Result<ReviewWorksheetImport>> {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > MAX_REVIEW_WORKSHEET_BYTES) return fail('请选择不超过 2 MiB 的审核 JSON 文件。');
    if (!text(fileName, 200, true) || !filled(fileName) || !stamp(importedAt)) return fail('文件名或本次读取时间无效。');
    const copy = new Uint8Array(bytes); // Freeze the selected bytes before any await.
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(copy);
    const data: unknown = JSON.parse(raw);
    if (!safeTree(data) || !keys(data, ['schemaVersion', 'kind', 'basis', 'item', 'review', 'publication', 'scope', 'exportedAt']) || data.scope !== WORKSHEET_SCOPE || !stamp(data.exportedAt)) return fail('不是支持的审核工作表备份；请使用本工作台导出的 JSON。');
    const { scope: _scope, exportedAt: _exportedAt, ...worksheet } = data;
    const checked = validateReviewWorksheet(worksheet);
    if (!checked.ok) return checked;
    const match = matchItem(checked.value, pack); // Compare this read's current basis before the async boundary.
    const digest = await crypto.subtle.digest('SHA-256', copy);
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return { ok: true, value: { worksheet: checked.value, source: { fileName, sha256, sizeBytes: copy.byteLength, importedAt }, match } };
  } catch { return fail('文件不是有效的 UTF-8 审核 JSON，当前记录保持不变。'); }
}
