import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../public/downloads/mechanics-foundations/', import.meta.url));
const script = join(directory, 'verify_extensions.py');
const originalReferencePath = join(directory, 'reference-results.json');
const originalReference = readFileSync(originalReferencePath, 'utf8');
const referencePath = join(directory, 'reference-extensions.json');
const referenceText = readFileSync(referencePath, 'utf8');
const reference = JSON.parse(referenceText);
const bundledPython = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
const python = process.env.SIMULEARN_PYTHON || (existsSync(bundledPython) ? bundledPython : process.platform === 'win32' ? 'py' : 'python3');
let actual: typeof reference;
function near(a: number, b: number, tolerance = 1e-8) { expect(Number.isFinite(a)).toBe(true); expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(tolerance, Math.abs(b) * 1e-10)); }
function multiply(matrix: number[][], vector: number[]) { return matrix.map(row => row.reduce((sum, value, index) => sum + value * vector[index], 0)); }
function compare(a: any, b: any) {
  if (typeof b === 'number') { near(a, b); return; }
  if (Array.isArray(b)) { expect(a).toHaveLength(b.length); b.forEach((value, index) => compare(a[index], value)); return; }
  if (b && typeof b === 'object') { expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort()); for (const key of Object.keys(b)) compare(a[key], b[key]); return; }
  expect(a).toBe(b);
}
beforeAll(() => {
  actual = JSON.parse(execFileSync(python, [script, '--executor', 'Vitest 调用 Python 扩展参考计算'], { encoding: 'utf8', timeout: 20_000, windowsHide: true }));
});

describe('standalone mechanics extension references', () => {
  it('actually executes the new stdlib script, reproduces published numbers and preserves both evidence files', () => {
    expect(actual.self_checks.passed).toBe(true);
    expect(actual.self_checks.groups).toHaveLength(5);
    for (const key of Object.keys(reference).filter(key => key !== 'execution')) compare(actual[key], reference[key]);
    expect(readFileSync(originalReferencePath, 'utf8')).toBe(originalReference);
    expect(readFileSync(referencePath, 'utf8')).toBe(referenceText);
    expect(readFileSync(script, 'utf8')).not.toMatch(/(?:from|import)\s+verify_basics/);
  });

  it('preserves the actual Python provenance while excluding user/ANSYS/CAE success claims', () => {
    expect(reference.execution.executor).toBe('Codex AI执行环境中的Python参考计算');
    expect(reference.execution.python_version).toBe('3.12.14');
    expect(reference.execution.executed_at_asia_shanghai).toBe('2026-10-24T08:23:29+08:00');
    expect(reference.execution.not_evidence_of).toEqual(expect.arrayContaining(['用户本机运行', 'ANSYS 求解', 'CAE 工作台测试通过']));
    expect(actual.execution.python_version).toMatch(/^3\.(?:1\d|[2-9]\d)\./);
  });

  it('checks isotropic normal stiffness/compliance and distinguishes uniaxial stress from constrained strain', () => {
    const material = actual.materials;
    const { E_MPa: E, nu } = material;
    const C: number[][] = material.normal_stiffness_MPa;
    const S: number[][] = material.normal_compliance_per_MPa;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      near(C[i].reduce((sum, value, k) => sum + value * S[k][j], 0), i === j ? 1 : 0, 1e-12);
    }
    const eps: number[] = material.uniaxial_strain;
    near(eps[0], 100 / E, 1e-14); near(eps[1], -nu * 100 / E, 1e-14); near(eps[2], eps[1], 1e-14);
    multiply(C, eps).forEach((value, index) => near(value, index === 0 ? 100 : 0));
    const constrained = material.lateral_fixed_stress_MPa;
    near(constrained[0], 100); near(constrained[1], 300 / 7); near(constrained[2], 300 / 7);
    near(material.lateral_fixed_strain[0], 13 / 36750, 1e-14);
    expect(material.lateral_fixed_strain.slice(1)).toEqual([0, 0]);
    near(material.lateral_fixed_effective_modulus_MPa, E * (1 - nu) / ((1 + nu) * (1 - 2 * nu)));
  });

  it('checks independent rigid-motion constraints and their null modes without treating mixed-unit entries as conditioning', () => {
    const cases = actual.supports.cases;
    expect(cases.map((value: any) => value.rank)).toEqual([3, 2, 2]);
    expect(cases.map((value: any) => value.scaled_rank)).toEqual([3, 2, 2]);
    const rows = cases[0].physical_rows;
    // Triangular determinant is nonzero: all three rigid freedoms constrained.
    near(rows[0][0] * rows[1][1] * rows[2][2], 2000);
    const rollers: number[][] = cases[1].physical_rows;
    expect(rollers.every(row => row[0] === 0)).toBe(true);
    near(rollers[0][1] * rollers[1][2] - rollers[1][1] * rollers[0][2], 1000);
    multiply(rollers, [1, 0, 0]).forEach(value => near(value, 0));
    multiply(cases[2].physical_rows, [0, 0, 1]).forEach(value => near(value, 0));
    expect(cases[2].physical_rows[0]).toEqual(cases[2].physical_rows[2]);
    expect(actual.supports.rotation_example.B_displacement_mm).toEqual([0, 2]);
    expect(actual.supports.scope).toContain('not a condition number');
  });

  it('checks the actual unequal-element assembly and verifies both prescribed-displacement solvers with the original equations', () => {
    const assembly = actual.assembly;
    const K: number[][] = assembly.K_N_per_mm;
    expect(K).toEqual([[52500, -52500, 0], [-52500, 70000, -17500], [0, -17500, 17500]]);
    expect(assembly.F_N).toEqual([0, 5000, 10000]);
    assembly.element_stiffness_N_per_mm.forEach((value: number, index: number) => near(value, assembly.E_MPa * assembly.areas_mm2[index] / assembly.lengths_mm[index]));
    for (const [model, prescribed, expected] of [[assembly.fixed_u0, 0, [0, 2 / 7, 6 / 7]], [assembly.prescribed_u0_0p2_mm, .2, [.2, 17 / 35, 37 / 35]]] as Array<[any, number, number[]]>) {
      expect(model.symmetric_replacement_matrix[0]).toEqual([52500, 0, 0]);
      near(model.symmetric_replacement_rhs[0], 52500 * prescribed);
      expect(model.symmetric_constraint_scale_N_per_mm['0']).toBe(52500);
      model.u_mm.forEach((value: number, index: number) => near(value, expected[index]));
      model.symmetric_replacement_u_mm.forEach((value: number, index: number) => near(value, model.u_mm[index]));
      const Ku = multiply(K, model.u_mm);
      Ku.forEach((value, index) => near(value - assembly.F_N[index], index === 0 ? -15000 : 0));
      near(model.corrected_free_rhs_N[0], 5000 - K[1][0] * prescribed);
      expect(model.corrected_free_rhs_N[1]).toBe(10000);
      near(model.element_axial_forces_N[0], 15000); near(model.element_axial_forces_N[1], 10000);
      near(model.element_stresses_MPa[0], 150); near(model.element_stresses_MPa[1], 200);
      near(model.strain_energy_Nmm, 5000);
      near(model.strain_energy_Nmm, .5 * model.u_mm.reduce((sum: number, value: number, index: number) => sum + value * Ku[index], 0));
      // The modified constraint equation has zero residual, hiding the real reaction.
      near(model.wrong_reactions_from_replaced_equations[0], 0);
      expect(model.reaction_and_residual_N[0]).toBe(-15000);
    }
  });

  it('includes the prescribed-reaction term in the endpoint energy identity and records its loading-path qualification', () => {
    const model = actual.assembly.prescribed_u0_0p2_mm;
    near(model.half_external_force_dot_u_Nmm, 6500);
    near(model.half_prescribed_reaction_dot_u_Nmm, -1500);
    near(model.strain_energy_Nmm, model.half_external_force_dot_u_Nmm + model.half_prescribed_reaction_dot_u_Nmm);
    expect(actual.assumptions.some((text: string) => text.includes('proportional quasistatic ramping'))).toBe(true);
  });

  it('separates axial-only thermal restraint from full three-direction restraint', () => {
    const { E_MPa: E, nu } = actual.materials;
    const thermal = actual.thermal;
    const eps = thermal.alpha_per_K * thermal.delta_T_K;
    near(eps, .0006, 1e-14);
    near(thermal.axially_fixed_laterally_free_stress_MPa[0], -E * eps);
    near(thermal.axially_fixed_laterally_free_stress_MPa[0], -126);
    expect(thermal.axially_fixed_laterally_free_stress_MPa.slice(1)).toEqual([0, 0]);
    near(thermal.axially_fixed_laterally_free_total_strain[0], 0, 1e-14);
    near(thermal.axially_fixed_laterally_free_total_strain[1], (1 + nu) * eps, 1e-14);
    thermal.three_direction_fixed_stress_MPa.forEach((value: number) => near(value, -E * eps / (1 - 2 * nu)));
    expect(thermal.three_direction_fixed_total_strain).toEqual([0, 0, 0]);
  });

  it('refuses disabled verification assertions', () => {
    expect(() => execFileSync(python, ['-O', script], { encoding: 'utf8', timeout: 20_000, windowsHide: true, stdio: 'pipe' })).toThrow();
  });

  it('protects the previous seven-group evidence even if it is selected as the output path', () => {
    expect(() => execFileSync(python, [script, '--output', originalReferencePath], { encoding: 'utf8', timeout: 20_000, windowsHide: true, stdio: 'pipe' })).toThrow();
    expect(readFileSync(originalReferencePath, 'utf8')).toBe(originalReference);
  });
});
