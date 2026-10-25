/** Explicit, local-only trial feedback. No URL, account, activity or answer data is accepted. */
export const PILOT_TASK_VERSIONS = {
  'linear-static': 'linear-static-v1',
  python: 'labs-v1',
  assembly: 'labs-v1',
  convergence: 'labs-v1',
  'first-study': 'first-study-v1',
} as const;
export type PilotTask = keyof typeof PILOT_TASK_VERSIONS;
export const PILOT_START_POINTS = ['tutorial', 'benchmark', 'python', 'assembly', 'convergence'] as const;
export const PILOT_FIRST_RESULTS = ['no-output', 'has-output'] as const;
export const PILOT_STOPPED_STEPS = ['read', 'assumptions', 'predict', 'run', 'assembly', 'check', 'next', 'none-self-report'] as const;
export const PILOT_INTENDED_NEXT = ['retry', 'check-source', 'change-input', 'record', 'continue'] as const;
export const PILOT_FEEDBACK_SCOPE = '用户自行填写的试学反馈；不是系统验证完成记录；耗时与首次结果均为自述，记录时间仅表示导出时间';
const fields = ['task', 'contentVersion', 'selfReported', 'difficulty', 'notes', 'startPoint', 'firstResult', 'stoppedAtStep', 'intendedNext', 'durationMinutes'] as const;

export interface PilotFeedback {
  version: 1;
  recordedAt: string;
  task: PilotTask;
  contentVersion: typeof PILOT_TASK_VERSIONS[PilotTask];
  selfReported: 'not-provided' | 'unfinished' | 'finished-self-report';
  difficulty: 'not-provided' | '1' | '2' | '3' | '4' | '5';
  notes: string;
  startPoint: typeof PILOT_START_POINTS[number] | null;
  firstResult: typeof PILOT_FIRST_RESULTS[number] | null;
  stoppedAtStep: typeof PILOT_STOPPED_STEPS[number] | null;
  intendedNext: typeof PILOT_INTENDED_NEXT[number] | null;
  durationMinutes: number | null;
  scope: typeof PILOT_FEEDBACK_SCOPE;
}
type FeedbackResult = { ok: true; feedback: PilotFeedback } | { ok: false; error: string };

function hasTask(value: unknown): value is PilotTask {
  return typeof value === 'string' && Object.hasOwn(PILOT_TASK_VERSIONS, value);
}

/** Only exact, single known task/version pairs may prefill the form. Extra query data is never returned. */
export function readPilotPrefill(params: URLSearchParams): { task: PilotTask; contentVersion: typeof PILOT_TASK_VERSIONS[PilotTask] } | null {
  const task = params.get('task');
  if (params.getAll('task').length !== 1 || params.getAll('contentVersion').length !== 1 || !hasTask(task)) return null;
  const contentVersion = PILOT_TASK_VERSIONS[task];
  return params.get('contentVersion') === contentVersion ? { task, contentVersion } : null;
}

function optionalEnum<T extends readonly string[]>(value: unknown, options: T): T[number] | null | undefined {
  if (value === 'not-provided') return null;
  return typeof value === 'string' && options.includes(value) ? value : undefined;
}

/** Fail the whole export when a form value is malformed. Never trim or silently truncate the user's notes. */
export function buildPilotFeedback(input: unknown, now = Date.now()): FeedbackResult {
  const invalid = (error: string): FeedbackResult => ({ ok: false, error });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid('反馈格式不完整，请重新选择表单选项。');
  const data = input as Record<string, unknown>;
  if (Object.keys(data).length !== fields.length || Object.keys(data).some(key => !fields.includes(key as typeof fields[number])) || fields.some(key => !Object.hasOwn(data, key))) return invalid('反馈字段不完整或包含未支持的字段，未导出。');
  if (!hasTask(data.task) || data.contentVersion !== PILOT_TASK_VERSIONS[data.task]) return invalid('任务与内容版本不匹配，请重新选择本次任务。');
  if (!['not-provided', 'unfinished', 'finished-self-report'].includes(data.selfReported as string)) return invalid('完成情况选项无效，未导出。');
  if (!['not-provided', '1', '2', '3', '4', '5'].includes(data.difficulty as string)) return invalid('主观难度选项无效，未导出。');
  if (typeof data.notes !== 'string' || data.notes.length > 2000) return invalid('反馈正文最多 2000 个字符；未截断或导出，请自行缩短后重试。');
  const startPoint = optionalEnum(data.startPoint, PILOT_START_POINTS);
  const firstResult = optionalEnum(data.firstResult, PILOT_FIRST_RESULTS);
  const stoppedAtStep = optionalEnum(data.stoppedAtStep, PILOT_STOPPED_STEPS);
  const intendedNext = optionalEnum(data.intendedNext, PILOT_INTENDED_NEXT);
  if ([startPoint, firstResult, stoppedAtStep, intendedNext].includes(undefined)) return invalid('试学过程选项无效，未导出。');
  if (typeof data.durationMinutes !== 'string') return invalid('自述耗时应填写 0 至 1440 的分钟数，或留空。');
  let durationMinutes: number | null = null;
  if (data.durationMinutes !== '') {
    if (data.durationMinutes.length > 32 || !/^(?:0|[1-9]\d*)(?:\.\d+)?(?![\s\S])/.test(data.durationMinutes)) return invalid('自述耗时应填写 0 至 1440 的分钟数，或留空。');
    durationMinutes = Number(data.durationMinutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes > 1440) return invalid('自述耗时应在 0 至 1440 分钟内，未导出。');
  }
  if (!Number.isSafeInteger(now) || now < 0 || now > 8640000000000000) return invalid('当前导出时间不可用，请检查设备时间。');
  return { ok: true, feedback: {
    version: 1,
    recordedAt: new Date(now).toISOString(),
    task: data.task,
    contentVersion: PILOT_TASK_VERSIONS[data.task],
    selfReported: data.selfReported as PilotFeedback['selfReported'],
    difficulty: data.difficulty as PilotFeedback['difficulty'],
    notes: data.notes,
    startPoint: startPoint!, firstResult: firstResult!, stoppedAtStep: stoppedAtStep!, intendedNext: intendedNext!,
    durationMinutes,
    scope: PILOT_FEEDBACK_SCOPE,
  } };
}
