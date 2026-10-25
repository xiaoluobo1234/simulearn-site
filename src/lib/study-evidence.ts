import officialBarCode from '../../public/downloads/python-lab/axial_bar.py?raw';
import { firstStudyGuide } from '../data/first-study-guide';
import { ASSEMBLY_LIMITS } from './assembly-lab';

export const MAX_EVIDENCE_BYTES = 256 * 1024;
export const MAX_STUDY_EVIDENCE = 2;

export type EvidenceKind = 'python' | 'assembly';
export type EvidenceModelMatch = 'matches-guide-input' | 'different-input' | 'not-determined';
export interface StudyEvidenceDetails {
  kind: EvidenceKind;
  declaredStatus: string;
  declaredEnvironment: string | null;
  modelMatch: EvidenceModelMatch;
  summary: string;
}
export interface StudyEvidence extends StudyEvidenceDetails {
  id: string;
  sha256: string;
  sizeBytes: number;
  fileName: string;
  importedAt: string;
  originalText: string;
  trust: 'unverified-imported-file';
}
export type EvidenceRead<T = StudyEvidenceDetails> = { ok: true; value: T } | { ok: false; error: string };

type RecordValue = Record<string, unknown>;
const encoder = new TextEncoder();
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
const failure = (error: string): { ok: false; error: string } => ({ ok: false, error });
const isRecord = (value: unknown): value is RecordValue => !!value && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exactKeys = (value: unknown, keys: readonly string[]): value is RecordValue => isRecord(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const text = (value: unknown, maximum: number, minimum = 0): value is string => typeof value === 'string'
  && value.length >= minimum && value.length <= maximum;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const time = (value: unknown): value is string => text(value, 24, 24) && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const vector = (value: unknown, size: number): value is number[] => Array.isArray(value)
  && value.length === size && value.every(finite);
const matrix = (value: unknown, rows: number, columns: number): value is number[][] => Array.isArray(value)
  && value.length === rows && value.every(row => vector(row, columns));
const exactArray = (value: unknown, expected: readonly unknown[]) => Array.isArray(value)
  && value.length === expected.length && value.every((item, index) => item === expected[index]);

/** Resource and prototype checks also cover inert JSON embedded in backups. */
function safeTree(value: unknown, depth = 0, seen = new WeakSet<object>()): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value === null || typeof value !== 'number' || Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 64_000;
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.length <= 1000 && value.every(item => safeTree(item, depth + 1, seen));
  if (!isRecord(value) || Reflect.ownKeys(value).length > 100) return false;
  return Reflect.ownKeys(value).every(key => {
    if (typeof key !== 'string' || forbiddenKeys.has(key) || key.length > 200) return false;
    const property = Object.getOwnPropertyDescriptor(value, key);
    return !!property && Object.hasOwn(property, 'value') && safeTree(property.value, depth + 1, seen);
  });
}

const comparison = (match: EvidenceModelMatch) => match === 'matches-guide-input'
  ? '声明输入与引导固定输入相同' : match === 'different-input' ? '声明输入与引导固定输入不同' : '无法确认是否使用引导固定模型';

/** Only the unchanged public formula template permits a model-input comparison. */
function pythonModelMatch(code: string, input: string): EvidenceModelMatch {
  // Textareas normalize CRLF when a template is placed in the browser editor.
  // Whitespace, comments and all other code remain significant. No code is run.
  if (code.replace(/\r\n/g, '\n') !== officialBarCode.replace(/\r\n/g, '\n')) return 'not-determined';
  let raw: unknown;
  try { raw = JSON.parse(input.replace(/^\uFEFF/, '')); } catch { return 'not-determined'; }
  if (!safeTree(raw) || !exactKeys(raw, ['E', 'A', 'L', 'P'])) return 'not-determined';
  const units = { E: 'N/mm2', A: 'mm2', L: 'mm', P: 'N' } as const;
  let matches = true;
  for (const name of ['E', 'A', 'L', 'P'] as const) {
    const item = raw[name];
    if (!exactKeys(item, ['value', 'unit']) || !finite(item.value) || typeof item.unit !== 'string') return 'not-determined';
    if (item.unit !== units[name] || item.value !== firstStudyGuide.inputs[name].value) matches = false;
  }
  return matches ? 'matches-guide-input' : 'different-input';
}

function readPython(value: RecordValue): EvidenceRead {
  const keys = ['schemaVersion', 'executor', 'state', 'code', 'input', 'stdout', 'stderr', 'value', 'environment', 'startedAt', 'finishedAt', 'elapsedMs', 'limitation'];
  if (!exactKeys(value, keys) || value.schemaVersion !== 1 || value.executor !== '用户当前浏览器 WebWorker'
    || !['succeeded', 'error', 'stopped', 'timeout'].includes(String(value.state))
    || !text(value.code, 64_000, 1) || !value.code.trim() || !text(value.input, 64_000) || !text(value.stdout, 32_000)
    || !text(value.stderr, 32_000) || !text(value.value, 4_000) || !text(value.limitation, 2_000, 1)
    || !time(value.startedAt) || !time(value.finishedAt) || Date.parse(value.finishedAt) < Date.parse(value.startedAt)
    || !Number.isSafeInteger(value.elapsedMs) || (value.elapsedMs as number) < 0
    || !(value.environment === null || text(value.environment, 300, 1)
      && /^CPython \d+\.\d+\.\d+[a-zA-Z0-9.+-]* · Pyodide \d+(?:\.\d+)+[a-zA-Z0-9.+-]* · WebAssembly \/ WebWorker$/.test(value.environment))
    || value.state === 'succeeded' && value.environment === null) {
    return failure('Python 文件必须是已结束的站内实验结果 JSON，且字段、状态、时间、环境声明和文本长度有效。');
  }
  const modelMatch = pythonModelMatch(value.code, value.input);
  const environment = value.environment as string | null;
  return { ok: true, value: {
    kind: 'python', declaredStatus: value.state as string, declaredEnvironment: environment, modelMatch,
    summary: `文件声明状态：${value.state}；${environment ? '文件含 Python 环境声明' : '未提供已加载环境，未确认代码运行'}。${comparison(modelMatch)}。标准输出 ${value.stdout.length} 字符，错误输出 ${value.stderr.length} 字符。本页未执行代码，未核验输出与运行历史。`,
  } };
}

function readAssembly(value: RecordValue): EvidenceRead {
  if (!exactKeys(value, ['schemaVersion', 'execution', 'solution']) || value.schemaVersion !== 1
    || !exactKeys(value.execution, ['executor', 'runtime', 'executedAt', 'reviewStatus', 'notEvidenceOf'])
    || value.execution.executor !== '当前浏览器 JavaScript 教学计算'
    || value.execution.runtime !== 'JavaScript Number / IEEE 754 float64' || !time(value.execution.executedAt)
    || value.execution.reviewStatus !== 'AI 辅助编写，待本人复核'
    || !exactArray(value.execution.notEvidenceOf, ['ANSYS 求解', '在线 CAE 任务', '用户独立复现', '个人学习掌握', '工程安全认证'])) {
    return failure('装配文件必须是站内实验导出的 schemaVersion 1 结果，执行声明字段不受支持。');
  }
  const solution = value.solution;
  if (!exactKeys(solution, ['model', 'prescribed', 'freeDofs', 'Kff', 'KfcUc', 'correctedRhs', 'displacement', 'reactionAndResidual', 'elementStrain', 'elementStress', 'elementForce', 'strainEnergy', 'energyFromEndForces', 'equilibriumResidual', 'maxFreeResidual'])
    || !exactKeys(solution.model, ['inputs', 'connectivity', 'stiffness', 'local', 'contributions', 'K', 'F'])
    || !exactKeys(solution.model.inputs, ['E', 'A1', 'A2', 'L1', 'L2', 'P', 'uc', 'constraint'])
    || solution.model.inputs.constraint !== 'fixed') return failure('装配模型或结果字段不完整，或不是受支持的固定左端两单元模型。');
  const model = solution.model, inputs = model.inputs as RecordValue;
  for (const name of Object.keys(ASSEMBLY_LIMITS) as (keyof typeof ASSEMBLY_LIMITS)[]) {
    const number = inputs[name], rule = ASSEMBLY_LIMITS[name];
    if (!finite(number) || number < rule.min || number > rule.max) return failure('装配声明输入超出教学实验支持的有限数值范围。');
  }
  if (!matrix(model.connectivity, 2, 2) || !exactArray(model.connectivity[0], [0, 1]) || !exactArray(model.connectivity[1], [1, 2])
    || !vector(model.stiffness, 2) || !Array.isArray(model.local) || model.local.length !== 2 || !model.local.every(item => matrix(item, 2, 2))
    || !Array.isArray(model.contributions) || model.contributions.length !== 2 || !model.contributions.every(item => matrix(item, 3, 3))
    || !matrix(model.K, 3, 3) || !vector(model.F, 3)
    || !exactKeys(solution.prescribed, ['node', 'value']) || solution.prescribed.node !== 0 || !finite(solution.prescribed.value)
    || !exactArray(solution.freeDofs, [1, 2]) || !matrix(solution.Kff, 2, 2)
    || !vector(solution.KfcUc, 2) || !vector(solution.correctedRhs, 2) || !vector(solution.displacement, 3)
    || !vector(solution.reactionAndResidual, 3) || !vector(solution.elementStrain, 2)
    || !vector(solution.elementStress, 2) || !vector(solution.elementForce, 2)
    || !finite(solution.strainEnergy) || solution.strainEnergy < 0 || !finite(solution.energyFromEndForces)
    || !finite(solution.equilibriumResidual) || !finite(solution.maxFreeResidual) || solution.maxFreeResidual < 0) {
    return failure('装配矩阵、向量的尺寸或有限数值不符合当前两单元结果格式。');
  }
  const modelMatch: EvidenceModelMatch = (Object.keys(firstStudyGuide.assembly) as (keyof typeof firstStudyGuide.assembly)[])
    .every(name => inputs[name] === firstStudyGuide.assembly[name]) ? 'matches-guide-input' : 'different-input';
  return { ok: true, value: {
    kind: 'assembly', declaredStatus: 'succeeded', declaredEnvironment: value.execution.runtime as string, modelMatch,
    summary: `${comparison(modelMatch)}。文件声明端位移 u₂=${solution.displacement[2]} mm、左端反力 R₀=${solution.reactionAndResidual[0]} N、应变能 U=${solution.strainEnergy} N·mm。本页只核对格式与输入，未重新求解或核验这些数值。`,
  } };
}

/** Recognizes known exported data only. Imported code and text are never run. */
export function readStudyEvidence(originalText: string): EvidenceRead {
  if (typeof originalText !== 'string' || !originalText || encoder.encode(originalText).byteLength > MAX_EVIDENCE_BYTES) return failure('结果文件为空或超过 256 KiB。');
  let value: unknown;
  try { value = JSON.parse(originalText.replace(/^\uFEFF/, '')); } catch { return failure('结果文件不是有效 JSON；请选择实验页导出的结果 JSON。'); }
  if (!safeTree(value) || !isRecord(value)) return failure('结果 JSON 含不支持的结构、过深嵌套或危险字段。');
  if (Object.hasOwn(value, 'executor')) return readPython(value);
  if (Object.hasOwn(value, 'execution')) return readAssembly(value);
  return failure('未识别结果格式；仅支持本站 Python 与装配实验导出的结果 JSON。');
}

/** SHA-256 identifies exact selected bytes; it does not authenticate their author. */
export async function createStudyEvidence(bytes: Uint8Array, fileName: string, importedAt: string): Promise<EvidenceRead<StudyEvidence>> {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > MAX_EVIDENCE_BYTES) return failure('结果文件为空或超过 256 KiB。');
  if (!text(fileName, 200, 1) || /[\u0000-\u001f\u007f]/.test(fileName) || !time(importedAt)) return failure('文件名或导入时间无效；文件名最多 200 字，请检查本机时间。');
  // Snapshot before awaiting crypto so caller mutation cannot change the digest.
  const selectedBytes = new Uint8Array(bytes);
  let originalText: string;
  try { originalText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(selectedBytes); }
  catch { return failure('结果文件必须是有效 UTF-8 文本；未读取或替换无效编码。'); }
  const parsed = readStudyEvidence(originalText);
  if (!parsed.ok) return parsed;
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', selectedBytes.buffer);
    const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    return { ok: true, value: { ...parsed.value, id: `${parsed.value.kind}:${sha256}`, sha256,
      sizeBytes: selectedBytes.byteLength, fileName, importedAt, originalText, trust: 'unverified-imported-file' } };
  } catch { return failure('当前浏览器不能计算文件指纹，尚未附加文件。请使用支持 Web Crypto 的安全页面重试。'); }
}

/** Backups cannot promote stored summaries, matches or claims into trusted facts. */
export async function restoreStudyEvidence(value: unknown): Promise<EvidenceRead<StudyEvidence>> {
  if (!exactKeys(value, ['id', 'kind', 'sha256', 'sizeBytes', 'fileName', 'importedAt', 'originalText', 'trust', 'declaredStatus', 'declaredEnvironment', 'modelMatch', 'summary'])
    || !text(value.originalText, MAX_EVIDENCE_BYTES, 1) || !text(value.sha256, 64, 64) || !/^[a-f0-9]{64}$/.test(value.sha256)
    || !Number.isSafeInteger(value.sizeBytes) || (value.sizeBytes as number) <= 0 || (value.sizeBytes as number) > MAX_EVIDENCE_BYTES
    || value.trust !== 'unverified-imported-file' || !['python', 'assembly'].includes(String(value.kind))
    || !text(value.id, 80, 1) || !text(value.summary, 4000) || !text(value.declaredStatus, 100, 1)
    || !(value.declaredEnvironment === null || text(value.declaredEnvironment, 300, 1))
    || !['matches-guide-input', 'different-input', 'not-determined'].includes(String(value.modelMatch))) return failure('备份中的结果附件字段无效或超出上限。');
  const restored = await createStudyEvidence(encoder.encode(value.originalText), value.fileName as string, value.importedAt as string);
  if (!restored.ok) return restored;
  if (restored.value.originalText !== value.originalText || restored.value.sha256 !== value.sha256 || restored.value.sizeBytes !== value.sizeBytes
    || restored.value.id !== value.id || restored.value.kind !== value.kind) return failure('结果附件的原文、指纹、字节数或类型不一致；没有恢复这份附件。');
  // Deliberately replace backup-supplied summary and all derived display fields.
  return restored;
}
