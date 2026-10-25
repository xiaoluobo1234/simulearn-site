import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { failureExamples } from '../src/data/failure-examples';

const directory = fileURLToPath(new URL('../public/downloads/diagnostics/', import.meta.url));
const script = join(directory, 'diagnostic_examples.py');
const evidencePath = join(directory, 'reference-examples.json');
const savedText = readFileSync(evidencePath, 'utf8');
const reference = JSON.parse(savedText);
const bundledPython = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
const python = process.env.SIMULEARN_PYTHON || (existsSync(bundledPython) ? bundledPython : process.platform === 'win32' ? 'py' : 'python3');
let actual: typeof reference;

function near(value: number, expected: number, tolerance = 1e-9) {
  expect(Number.isFinite(value)).toBe(true);
  expect(Math.abs(value - expected)).toBeLessThanOrEqual(Math.max(tolerance, Math.abs(expected) * 1e-10));
}
function matvec(matrix: number[][], vector: number[]) {
  return matrix.map(row => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}
function compare(actualValue: any, expectedValue: any) {
  if (typeof expectedValue === 'number') { near(actualValue, expectedValue); return; }
  if (Array.isArray(expectedValue)) {
    expect(actualValue).toHaveLength(expectedValue.length);
    expectedValue.forEach((value, index) => compare(actualValue[index], value));
    return;
  }
  if (expectedValue && typeof expectedValue === 'object') {
    expect(Object.keys(actualValue).sort()).toEqual(Object.keys(expectedValue).sort());
    for (const key of Object.keys(expectedValue)) compare(actualValue[key], expectedValue[key]);
    return;
  }
  expect(actualValue).toBe(expectedValue);
}

beforeAll(() => {
  actual = JSON.parse(execFileSync(python, [script, '--executor', 'Vitest 调用 Python 教学诊断参考计算'], { encoding: 'utf8', timeout: 20_000, windowsHide: true }));
});

describe('reproducible teaching diagnostic examples', () => {
  it('actually runs the standalone reference and reproduces all saved calculations without overwriting evidence', () => {
    expect(actual.self_checks.passed).toBe(true);
    expect(actual.self_checks.groups).toHaveLength(3);
    for (const key of Object.keys(reference).filter(key => key !== 'execution')) compare(actual[key], reference[key]);
    expect(readFileSync(evidencePath, 'utf8')).toBe(savedText);
    expect(reference.execution.executor).toBe('Codex AI执行环境中的Python参考计算');
    expect(reference.execution.python_implementation).toBe('CPython');
    expect(reference.execution.python_version).toMatch(/^3\.(?:1\d|[2-9]\d)\./);
    expect(reference.execution.executed_at_asia_shanghai).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
    expect(Number.isFinite(Date.parse(reference.execution.executed_at_asia_shanghai))).toBe(true);
    expect(reference.execution.not_evidence_of).toEqual(expect.arrayContaining(['用户本机运行', 'ANSYS 求解', '模态分析运行', '作者真实故障经历']));
  });

  it('checks mass in Mg and kg while keeping the body-force-free static result independent of density', () => {
    const units = actual.units;
    const input = actual.common_inputs;
    near(units.volume_mm3, input.A_mm2 * input.L_mm);
    near(units.correct_mass_Mg, units.correct_density_Mg_per_mm3 * units.volume_mm3);
    near(units.wrong_mass_Mg, units.wrong_density_Mg_per_mm3 * units.volume_mm3);
    near(units.correct_mass_kg, units.correct_mass_Mg * 1000);
    near(units.wrong_mass_kg, units.wrong_mass_Mg * 1000);
    near(units.correct_mass_kg, .785); near(units.wrong_mass_kg, 785); near(units.mass_ratio, 1000);
    for (const solution of units.static_end_load_by_density) {
      near(solution.u_mm[1], input.P_N * input.L_mm / (input.E_MPa * input.A_mm2));
      near(solution.reaction_and_residual_N[0], -input.P_N);
    }
    expect(actual.assumptions).toContain('mechanical end-load case excludes self-weight, all body forces and inertia');
  });

  it('demonstrates both the rigid null mode and incompatible load, and rejects actual singular elimination', () => {
    const rigid = actual.rigid_body;
    const { E_MPa: E, A_mm2: A, L_mm: L } = actual.common_inputs;
    const k = E * A / L;
    expect(rigid.K_N_per_mm).toEqual([[k, -k], [-k, k]]);
    matvec(rigid.K_N_per_mm, [1, 1]).forEach(value => near(value, 0));
    near(rigid.net_load_N, rigid.F_N.reduce((sum: number, force: number) => sum + force, 0));
    expect(rigid.net_load_N).not.toBe(0);
    expect(rigid.free_elimination_rejected).toBe(true);
    expect(rigid.free_elimination_message).toContain('Zero pivot in column 2');
    const fixed = rigid.left_fixed;
    near(fixed.u_mm[0], 0); near(fixed.u_mm[1], 10 / 21);
    const Ku = matvec(rigid.K_N_per_mm, fixed.u_mm);
    Ku.forEach((value, index) => near(value - rigid.F_N[index], fixed.reaction_and_residual_N[index]));
    near(fixed.reaction_and_residual_N[0], -10000);
    near(fixed.reaction_and_residual_N[1], 0);
  });

  it('distinguishes allowed thermal slip from axial lock using strain compatibility and original-equation reactions', () => {
    const thermal = actual.boundary;
    const { E_MPa: E, A_mm2: A, L_mm: L } = actual.common_inputs;
    const thermalStrain = thermal.alpha_per_K * thermal.delta_T_K;
    near(thermalStrain, .0006);
    thermal.equivalent_nodal_thermal_load_N.forEach((value: number, i: number) => near(value, (i === 0 ? -1 : 1) * E * A * thermalStrain));
    for (const model of [thermal.left_located_right_free, thermal.both_axial_ends_fixed]) {
      const totalStrain = (model.u_mm[1] - model.u_mm[0]) / L;
      near(model.total_axial_strain, totalStrain);
      near(model.axial_stress_MPa, E * (totalStrain - thermalStrain));
      const Ku = matvec(actual.rigid_body.K_N_per_mm, model.u_mm);
      Ku.forEach((value, index) => near(value - thermal.equivalent_nodal_thermal_load_N[index], model.reaction_and_residual_N[index]));
      near(model.reaction_and_residual_N.reduce((sum: number, value: number) => sum + value, 0), 0);
    }
    near(thermal.left_located_right_free.u_mm[1], .6);
    near(thermal.left_located_right_free.axial_stress_MPa, 0);
    thermal.left_located_right_free.reaction_and_residual_N.forEach((value: number) => near(value, 0));
    expect(thermal.both_axial_ends_fixed.u_mm).toEqual([0, 0]);
    near(thermal.both_axial_ends_fixed.axial_stress_MPa, -126);
    near(thermal.both_axial_ends_fixed.reaction_and_residual_N[0], 12600);
    near(thermal.both_axial_ends_fixed.reaction_and_residual_N[1], -12600);
  });

  it('presents only labeled teaching scenarios with limits and matching diagnostic/evidence routes', () => {
    expect(failureExamples).toHaveLength(3);
    expect(new Set(failureExamples.map(item => item.id)).size).toBe(3);
    expect(failureExamples.map(item => item.diagnosticSlug)).toEqual(['units', 'rigid-body', 'boundary']);
    for (const example of failureExamples) {
      expect(example.summary).toContain('教学排查示例·AI环境参考计算·待本人复核');
      expect(example.actualResult).toContain('用户本机待复现');
      expect(example.limits.length).toBeGreaterThan(0);
      expect(example.evidenceHref).toBe('/downloads/diagnostics/reference-examples.json');
      const computation = actual[example.diagnosticSlug === 'rigid-body' ? 'rigid_body' : example.diagnosticSlug];
      expect(computation.diagnostic_href).toBe(`/diagnostic/${example.diagnosticSlug}/`);
    }
  });

  it('refuses verification with disabled assertions and protects the script from output overwrite', () => {
    expect(() => execFileSync(python, ['-O', script], { encoding: 'utf8', timeout: 20_000, windowsHide: true, stdio: 'pipe' })).toThrow();
    const source = readFileSync(script, 'utf8');
    expect(() => execFileSync(python, [script, '--output', script], { encoding: 'utf8', timeout: 20_000, windowsHide: true, stdio: 'pipe' })).toThrow();
    expect(readFileSync(script, 'utf8')).toBe(source);
  });
});
