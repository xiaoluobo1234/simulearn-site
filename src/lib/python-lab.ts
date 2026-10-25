import csvCode from '../../public/downloads/python-lab/csv_check.py?raw';
import csvInput from '../../public/downloads/python-lab/sample.csv?raw';
import barCode from '../../public/downloads/python-lab/axial_bar.py?raw';
import barInput from '../../public/downloads/python-lab/bar-input.json?raw';

export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_BASE = `/vendor/pyodide/${PYODIDE_VERSION}/`;
export const LAB_EXECUTION_MS = 8_000;
export const LAB_LOAD_MS = 45_000;
export const LAB_AUTH_MS = 8_000;
export const LAB_TEXT_LIMIT = 64_000;
export const LAB_OUTPUT_LIMIT = 32_000;

export const pythonLabTemplates = [
  { id: 'csv', title: 'CSV 字段与单位检查', description: '用 csv、字符串和数值解析检查一份固定格式输入；不猜单位，不代替工程审核。', code: csvCode, input: csvInput, inputFile: 'sample.csv', codeFile: 'csv_check.py' },
  { id: 'bar', title: '均匀轴杆公式计算', description: '一维线弹性轴杆的位移、反力与能量；只计算基础公式，不组装有限元、不调用 CAE。', code: barCode, input: barInput, inputFile: 'bar-input.json', codeFile: 'axial_bar.py' },
] as const;

export type LabState = 'loading' | 'running' | 'succeeded' | 'error' | 'stopped' | 'timeout';
export interface LabResult {
  schemaVersion: 1;
  executor: '用户当前浏览器 WebWorker';
  state: LabState;
  code: string;
  input: string;
  stdout: string;
  stderr: string;
  value: string;
  environment: string | null;
  startedAt: string;
  finishedAt: string | null;
  elapsedMs: number | null;
  limitation: string;
}
export interface LabRunMessage { type: 'run'; id: string; code: string; input: string }
export type LabWorkerMessage =
  | { type: 'ready'; id: string; environment: string }
  | { type: 'stream'; id: string; stream: 'stdout' | 'stderr'; text: string }
  | { type: 'done'; id: string; value: string }
  | { type: 'error'; id: string; error: string };

export function validLabRun(value: unknown): value is LabRunMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<LabRunMessage>;
  return message.type === 'run' && typeof message.id === 'string' && /^[a-z0-9-]{1,80}$/.test(message.id)
    && typeof message.code === 'string' && message.code.length > 0 && message.code.length <= LAB_TEXT_LIMIT
    && typeof message.input === 'string' && message.input.length <= LAB_TEXT_LIMIT;
}

export function hasLabSession(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as { ok?: unknown; user?: unknown };
  if (record.ok !== true || !record.user || typeof record.user !== 'object') return false;
  const user = record.user as { userId?: unknown };
  return typeof user.userId === 'string' && user.userId.trim().length > 0;
}

/** A public template selector only. URL text never becomes Python or input. */
export function requestedPythonTemplate(search: string) {
  const values = new URLSearchParams(search).getAll('template');
  return values.length === 1 ? pythonLabTemplates.find(item => item.id === values[0]) || null : null;
}

export function appendLabOutput(current: string, incoming: string): string {
  const marker = '\n[输出达到上限，已截断]';
  const next = current + incoming;
  // Reserve room for the marker inside the cap, including a later write after
  // an earlier chunk fitted exactly. Repeated writes retain the same marker.
  return next.length > LAB_OUTPUT_LIMIT ? `${next.slice(0, LAB_OUTPUT_LIMIT - marker.length)}${marker}` : next;
}

export function createLabResult(code: string, input: string, startedAt: string): LabResult {
  return { schemaVersion: 1, executor: '用户当前浏览器 WebWorker', state: 'loading', code, input,
    stdout: '', stderr: '', value: '', environment: null, startedAt, finishedAt: null, elapsedMs: null,
    limitation: '仅记录本次浏览器 Python 执行；不证明用户本机复现、CAE 求解或工程验证完成。代码与输入未由本站自动保存或上传。' };
}
