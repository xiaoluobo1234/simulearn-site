import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../public/downloads/mechanics-foundations/', import.meta.url));
const script = join(directory, 'verify_basics.py');
const referencePath = join(directory, 'reference-results.json');
const referenceText = readFileSync(referencePath, 'utf8');
const reference = JSON.parse(referenceText);
const bundledPython = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
const python = process.env.SIMULEARN_PYTHON || (existsSync(bundledPython) ? bundledPython : process.platform === 'win32' ? 'py' : 'python3');
let actual: typeof reference;
function near(a: number, b: number, absolute = 1e-8) {
  expect(Number.isFinite(a)).toBe(true);
  expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(absolute, Math.abs(b) * 1e-10));
}
function multiply(matrix: number[][], vector: number[]) { return matrix.map(row => row.reduce((sum, value, index) => sum + value * vector[index], 0)); }
function numericallyEqual(a: any, b: any) {
  if (typeof b === 'number') { near(a, b); return; }
  if (Array.isArray(b)) { expect(a).toHaveLength(b.length); b.forEach((value, index) => numericallyEqual(a[index], value)); return; }
  if (b && typeof b === 'object') { expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort()); for (const key of Object.keys(b)) numericallyEqual(a[key], b[key]); return; }
  expect(a).toBe(b);
}
beforeAll(() => {
  const output = execFileSync(python, [script, '--executor', 'Vitest 调用 Python 参考计算'], { encoding: 'utf8', timeout: 20_000, windowsHide: true });
  actual = JSON.parse(output);
});

describe('downloadable mechanics reference benchmarks', () => {
  it('executes the actual Python script and reproduces the published numerical results without rewriting them', () => {
    const [major, minor] = actual.execution.python_version.split('.').map(Number);
    expect(major > 3 || major === 3 && minor >= 10).toBe(true);
    expect(actual.self_checks.passed).toBe(true);
    expect(actual.self_checks.groups).toHaveLength(7);
    for (const key of Object.keys(reference).filter(key => key !== 'execution')) numericallyEqual(actual[key], reference[key]);
    expect(readFileSync(referencePath, 'utf8')).toBe(referenceText);
  });

  it('records the actual reference executor, version and date without claiming user or CAE execution', () => {
    expect(reference.execution.executor).toBe('Codex AI执行环境中的Python参考计算');
    expect(reference.execution.python_version).toBe('3.12.14');
    expect(reference.execution.execution_date_asia_shanghai).toBe('2026-10-24');
    expect(reference.execution.executed_at_asia_shanghai).toMatch(/^2026-10-24T.*\+08:00$/);
    expect(reference.execution.not_evidence_of).toContain('用户本机运行');
    expect(reference.execution.not_evidence_of).toContain('ANSYS 求解');
    expect(reference.execution.not_evidence_of).toContain('CAE 工作台测试通过');
  });

  it('checks dimensional conversions, bar values and force/moment balance independently', () => {
    const { E_N_per_mm2: E, A0_mm2: A, L_mm: L, P_N: P } = actual.parameters;
    near(actual.uniform_bar.sigma_MPa, P / A);
    near(actual.uniform_bar.epsilon, P / (E * A));
    near(actual.uniform_bar.delta_mm, P * L / (E * A));
    near(actual.units.density_Mg_per_mm3, 7850 / 1e12, 1e-20);
    near(actual.units.mass_kg, 7850 * A * L / 1e9);
    near(actual.units.weight_N, actual.units.mass_kg * 9.81);
    const beam = actual.static_beam;
    near(beam.Rx_A_N, 0);
    near(beam.Ry_A_N, 7500);
    near(beam.Ry_B_N, 2500);
    near(beam.Ry_A_N + beam.Ry_B_N + beam.load_y_N, 0);
    near(beam.Ry_B_N * beam.L_mm + beam.load_y_N * beam.load_x_mm, 0);
    near(-beam.Ry_A_N * beam.L_mm + beam.load_y_N * (beam.load_x_mm - beam.L_mm), 0);
    near(actual.serial_bar.delta_total_mm, P * (400 / (E * 100) + 600 / (E * 50)));
    near(actual.serial_bar.equivalent_stiffness_N_per_mm, 13125);
  });

  it('reproduces linear interpolation and gives zero strain for equal-node translation', () => {
    const shape = actual.shape_functions;
    expect(shape.N).toEqual([0.75, 0.25]);
    near(shape.N.reduce((sum: number, value: number) => sum + value, 0), 1);
    near(shape.N[0] * shape.nodal_u_mm[0] + shape.N[1] * shape.nodal_u_mm[1], 0.119047619047619);
    near(shape.B_per_mm.reduce((sum: number, value: number) => sum + value * 3.2, 0), 0);
  });

  it('checks the assembled uniform matrix, rigid and elastic modes, constrained displacement, reaction and energy', () => {
    const model = actual.two_element_uniform_bar;
    const K: number[][] = model.K_N_per_mm;
    expect(K).toEqual([[42000, -42000, 0], [-42000, 84000, -42000], [0, -42000, 42000]]);
    for (const [eigenvalue, vector] of [[0, [1, 1, 1]], [42000, [1, 0, -1]], [126000, [1, -2, 1]]] as Array<[number, number[]]>) {
      multiply(K, vector).forEach((value, index) => near(value, eigenvalue * vector[index]));
    }
    near(model.u_mm[0], 0);
    near(model.u_mm[1], 5 / 21);
    near(model.u_mm[2], 10 / 21);
    const internal = multiply(K, model.u_mm);
    internal.forEach((force, index) => near(force - model.F_N[index], index === 0 ? -10000 : 0));
    near(model.strain_energy_Nmm, 0.5 * model.u_mm.reduce((sum: number, value: number, index: number) => sum + value * internal[index], 0));
    near(model.strain_energy_Nmm, 2380.95238095238);
  });

  it('checks actual matrix solutions across meshes, separates analytic error from adjacent-grid change and verifies energy', () => {
    const model = actual.variable_area_bar;
    const { E_N_per_mm2: E, A0_mm2: A, L_mm: L, P_N: P } = actual.parameters;
    const exact = P * L / (E * A) * Math.log(2);
    near(model.exact_tip_mm, exact);
    expect(model.meshes.map((mesh: any) => mesh.elements)).toEqual([1, 2, 4, 8, 16]);
    let previous: any;
    for (const mesh of model.meshes) {
      const n = mesh.elements;
      expect(mesh.K_N_per_mm).toHaveLength(n + 1);
      expect(mesh.reduced_K_N_per_mm).toHaveLength(n);
      expect(mesh.u_mm).toHaveLength(n + 1);
      const internal = multiply(mesh.K_N_per_mm, mesh.u_mm);
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n; j++) near(mesh.K_N_per_mm[i][j], mesh.K_N_per_mm[j][i]);
        near(internal[i] - mesh.F_N[i], i === 0 ? -P : 0, 1e-6);
      }
      mesh.element_stiffness_N_per_mm.forEach((k: number, index: number) => near(k, E * A * (1 + (index + 0.5) / n) / (L / n)));
      near(mesh.tip_mm, mesh.u_mm[n]);
      near(mesh.relative_tip_error, Math.abs(exact - mesh.tip_mm) / exact);
      near(mesh.relative_tip_error_percent, 100 * mesh.relative_tip_error);
      near(mesh.strain_energy_Nmm, 0.5 * P * mesh.tip_mm);
      near(mesh.reaction_N, -P, 1e-6);
      expect(mesh.tip_mm).toBeLessThan(exact);
      if (previous) {
        expect(mesh.tip_mm).toBeGreaterThan(previous.tip_mm);
        expect(mesh.relative_tip_error).toBeLessThan(previous.relative_tip_error);
        near(mesh.adjacent_change_percent, 100 * Math.abs(mesh.tip_mm - previous.tip_mm) / Math.abs(mesh.tip_mm));
      } else expect(mesh.adjacent_change_percent).toBeNull();
      previous = mesh;
    }
    expect(previous.relative_tip_error_percent).toBeLessThan(0.02);
    expect(previous.observed_error_order).toBeGreaterThan(1.9);
    expect(previous.observed_error_order).toBeLessThan(2.1);
  });

  it('refuses an optimized Python run that would disable its verification assertions', () => {
    expect(() => execFileSync(python, ['-O', script], { encoding: 'utf8', timeout: 20_000, windowsHide: true, stdio: 'pipe' })).toThrow();
  });
});
