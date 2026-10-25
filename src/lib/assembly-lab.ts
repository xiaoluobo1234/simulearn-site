/** Original two-element axial-bar teaching model, N–mm units, tension positive. */
export interface AssemblyInputs {
  E: number; A1: number; A2: number; L1: number; L2: number;
  P: number; uc: number; constraint: 'fixed' | 'free';
}
export const ASSEMBLY_DEFAULTS: AssemblyInputs = {
  E: 210000, A1: 100, A2: 100, L1: 500, L2: 500, P: 10000, uc: 0, constraint: 'fixed',
};
export const ASSEMBLY_LIMITS = {
  E: { min: 1000, max: 1000000, unit: 'MPa = N/mm²', label: '弹性模量 E' },
  A1: { min: 1, max: 10000, unit: 'mm²', label: '单元 1 截面 A₁' },
  A2: { min: 1, max: 10000, unit: 'mm²', label: '单元 2 截面 A₂' },
  L1: { min: 10, max: 100000, unit: 'mm', label: '单元 1 长度 L₁' },
  L2: { min: 10, max: 100000, unit: 'mm', label: '单元 2 长度 L₂' },
  P: { min: -1000000, max: 1000000, unit: 'N', label: '节点 2 轴向力 P' },
  uc: { min: -100, max: 100, unit: 'mm', label: '左端给定位移 u₀' },
} as const;
export type AssemblyParameter = keyof typeof ASSEMBLY_LIMITS;
export interface AssemblyModel {
  inputs: AssemblyInputs;
  connectivity: [[0, 1], [1, 2]];
  stiffness: [number, number];
  local: [number[][], number[][]];
  contributions: [number[][], number[][]];
  K: number[][]; F: number[];
}
export interface AssemblySolution {
  model: AssemblyModel;
  prescribed: { node: 0; value: number };
  freeDofs: [1, 2]; Kff: number[][]; KfcUc: number[]; correctedRhs: number[];
  displacement: number[]; reactionAndResidual: number[];
  elementStrain: number[]; elementStress: number[]; elementForce: number[];
  strainEnergy: number; energyFromEndForces: number;
  equilibriumResidual: number; maxFreeResidual: number;
}
export class AssemblySingularityError extends Error {
  constructor() {
    super('完整刚度矩阵奇异：整体轴向平移没有被约束，无法给出唯一位移。本演示不添加弱弹簧或自动固定节点。');
    this.name = 'AssemblySingularityError';
  }
}
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
export function readAssemblyInputs(raw: Record<string, unknown>): { ok: true; value: AssemblyInputs } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const values: Partial<AssemblyInputs> = {};
  for (const name of Object.keys(ASSEMBLY_LIMITS) as AssemblyParameter[]) {
    const rule = ASSEMBLY_LIMITS[name];
    const text = typeof raw[name] === 'number' ? String(raw[name]) : typeof raw[name] === 'string' ? raw[name].trim() : '';
    if (!text || text.length > 64 || !DECIMAL.test(text) || !Number.isFinite(Number(text))) {
      errors.push(`${rule.label}：请输入完整的有限十进制数值，可用科学计数法，单位为 ${rule.unit}。`);
      continue;
    }
    const value = Number(text);
    if (value < rule.min || value > rule.max) errors.push(`${rule.label}：本演示输入范围为 ${rule.min} 至 ${rule.max} ${rule.unit}。`);
    else values[name] = value;
  }
  if (raw.constraint !== 'fixed' && raw.constraint !== 'free') errors.push('请选择左端给定位移或无约束。');
  else values.constraint = raw.constraint;
  return errors.length ? { ok: false, errors } : { ok: true, value: values as AssemblyInputs };
}
export function multiply(matrix: number[][], vector: number[]): number[] {
  return matrix.map(row => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}
export function assembleBars(inputs: AssemblyInputs): AssemblyModel {
  const checked = readAssemblyInputs(inputs as unknown as Record<string, unknown>);
  if (!checked.ok) throw new Error(checked.errors.join('\n'));
  const p = checked.value;
  const stiffness: [number, number] = [p.E * p.A1 / p.L1, p.E * p.A2 / p.L2];
  const connectivity: [[0, 1], [1, 2]] = [[0, 1], [1, 2]];
  const local = stiffness.map(k => [[k, -k], [-k, k]]) as [number[][], number[][]];
  const contributions = connectivity.map((nodes, e) => {
    const matrix = Array.from({ length: 3 }, () => [0, 0, 0]);
    nodes.forEach((a, i) => nodes.forEach((b, j) => { matrix[a][b] += local[e][i][j]; }));
    return matrix;
  }) as [number[][], number[][]];
  const K = contributions[0].map((row, i) => row.map((value, j) => value + contributions[1][i][j]));
  return { inputs: { ...p }, connectivity, stiffness, local, contributions, K, F: [0, 0, p.P] };
}
/** Actual partial-pivot Gaussian elimination for these small, scaled teaching systems. */
export function gaussianSolve(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  if (n < 1 || n > 3 || matrix.length !== n || matrix.some(row => row.length !== n || row.some(value => !Number.isFinite(value))) || rhs.some(value => !Number.isFinite(value))) throw new Error('教学线性方程尺寸或数值无效。');
  const rows = matrix.map((row, i) => [...row, rhs[i]]);
  const scale = Math.max(...matrix.flat().map(Math.abs));
  if (!scale) throw new AssemblySingularityError();
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let i = column + 1; i < n; i++) if (Math.abs(rows[i][column]) > Math.abs(rows[pivot][column])) pivot = i;
    // This internal numerical guard serves this bounded demonstration only;
    // it is not a universal engineering or commercial-solver pivot criterion.
    if (Math.abs(rows[pivot][column]) <= scale * 1e-12) throw new AssemblySingularityError();
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    for (let i = column + 1; i < n; i++) {
      const factor = rows[i][column] / rows[column][column]; rows[i][column] = 0;
      for (let j = column + 1; j <= n; j++) rows[i][j] -= factor * rows[column][j];
    }
  }
  const result = Array(n).fill(0) as number[];
  for (let i = n - 1; i >= 0; i--) result[i] = (rows[i][n] - rows[i].slice(i + 1, n).reduce((sum, value, index) => sum + value * result[i + 1 + index], 0)) / rows[i][i];
  if (result.some(value => !Number.isFinite(value))) throw new Error('计算结果超出有限数范围，未返回位移。');
  return result;
}
export function solveAssembly(inputs: AssemblyInputs): AssemblySolution {
  const model = assembleBars(inputs);
  const { K, F } = model;
  if (inputs.constraint === 'free') {
    gaussianSolve(K, F); // Actually attempt elimination; do not invent a reference displacement.
    throw new AssemblySingularityError();
  }
  const freeDofs: [1, 2] = [1, 2];
  const Kff = freeDofs.map(i => freeDofs.map(j => K[i][j]));
  const KfcUc = freeDofs.map(i => K[i][0] * inputs.uc);
  const correctedRhs = freeDofs.map((i, index) => F[i] - KfcUc[index]);
  const uf = gaussianSolve(Kff, correctedRhs);
  const displacement = [inputs.uc, ...uf];
  const Ku = multiply(K, displacement);
  const reactionAndResidual = Ku.map((value, i) => value - F[i]);
  const elementStrain = [(displacement[1] - displacement[0]) / inputs.L1, (displacement[2] - displacement[1]) / inputs.L2];
  const elementStress = elementStrain.map(value => inputs.E * value);
  const elementForce = elementStress.map((value, i) => value * (i === 0 ? inputs.A1 : inputs.A2));
  // Equivalent to .5*uᵀKu, evaluated through extensions to avoid subtracting
  // large rigid translations when the prescribed support motion is nonzero.
  const strainEnergy = model.stiffness.reduce((sum, k, e) => sum + .5 * k * (displacement[e + 1] - displacement[e]) ** 2, 0);
  const energyFromEndForces = .5 * (F.reduce((sum, value, i) => sum + value * displacement[i], 0) + reactionAndResidual[0] * inputs.uc);
  const equilibriumResidual = F.reduce((sum, value) => sum + value, 0) + reactionAndResidual.reduce((sum, value) => sum + value, 0);
  const maxFreeResidual = Math.max(...freeDofs.map(i => Math.abs(reactionAndResidual[i])));
  return { model, prescribed: { node: 0, value: inputs.uc }, freeDofs, Kff, KfcUc, correctedRhs, displacement, reactionAndResidual, elementStrain, elementStress, elementForce, strainEnergy, energyFromEndForces, equilibriumResidual, maxFreeResidual };
}
