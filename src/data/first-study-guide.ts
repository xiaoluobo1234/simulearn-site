import input from '../../public/downloads/linear-static/uniform-bar/input.json';
import { linearStaticBenchmarks } from './linear-static-benchmarks';

const benchmark = linearStaticBenchmarks.find(item => item.slug === 'uniform-bar');
if (!benchmark || input.slug !== benchmark.slug || input.segments.length !== 1 || input.left_displacement_mm !== 0) {
  throw new Error('The first-study guide requires the existing fixed-left uniform-bar input.');
}
const segment = input.segments[0];

/** Fixed public teaching inputs are taken from the downloadable benchmark. */
export const firstStudyGuide = {
  version: 'first-study-v1',
  title: '第一次线性静力实验',
  caseSlug: benchmark.slug,
  contentVersions: { guide: 'first-study-v1', benchmark: 'linear-static-v1', labs: 'labs-v1' },
  inputs: {
    E: { value: input.E_MPa, unit: 'N/mm²' },
    A: { value: segment.area_mm2, unit: 'mm²' },
    L: { value: segment.length_mm, unit: 'mm' },
    P: { value: input.end_force_N, unit: 'N' },
    uc: { value: input.left_displacement_mm, unit: 'mm' },
  },
  assembly: {
    E: input.E_MPa, A1: segment.area_mm2, A2: segment.area_mm2,
    L1: segment.length_mm / 2, L2: segment.length_mm / 2,
    P: input.end_force_N, uc: input.left_displacement_mm,
  },
  assumptions: benchmark.assumptions,
  limits: benchmark.limits,
  sourceInput: '/downloads/linear-static/uniform-bar/input.json',
  benchmarkHref: '/cases/benchmarks/uniform-bar/',
  sources: benchmark.sources,
  feedbackHref: '/learning/activity/?task=first-study&contentVersion=first-study-v1',
} as const;

export const firstStudySteps = [
  { id: 'predict', number: '01', title: '先预测，再看参考', field: 'prediction', fieldLabel: '我的预测与理由', checkLabel: '我已记录预测或未完成原因（自述）' },
  { id: 'python', number: '02', title: '用真实 Python 计算公式', field: 'pythonObservation', fieldLabel: 'Python 实际输出、报错或未运行原因', checkLabel: '我已记录 Python 这一步的观察或受阻情况（自述）' },
  { id: 'assembly', number: '03', title: '用两个单元核对装配', field: 'assemblyObservation', fieldLabel: '装配观察、实际结果或未求解原因', checkLabel: '我已记录装配这一步的观察或受阻情况（自述）' },
  { id: 'evidence', number: '04', title: '留下证据与下一项任务', field: 'evidenceObservation', fieldLabel: '对照结论、证据位置、仍存疑之处与下一项任务', checkLabel: '我已记录本次核对与下一步（自述）' },
] as const;

export type FirstStudyStep = typeof firstStudySteps[number]['id'];
export type FirstStudyField = typeof firstStudySteps[number]['field'] | 'environment';
