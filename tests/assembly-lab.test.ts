import { describe, expect, it } from 'vitest';
import { ASSEMBLY_DEFAULTS, ASSEMBLY_LIMITS, AssemblySingularityError, assembleBars, gaussianSolve, multiply, readAssemblyInputs, solveAssembly } from '../src/lib/assembly-lab';

const near = (actual: number, expected: number, absolute = 1e-8) => {
  expect(Number.isFinite(actual)).toBe(true);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(absolute, Math.abs(expected) * 1e-10));
};

describe('three-node teaching assembly', () => {
  it('actually maps and adds both local matrices at their shared global DOF', () => {
    const model = assembleBars(ASSEMBLY_DEFAULTS);
    expect(model.stiffness).toEqual([42000, 42000]);
    expect(model.local).toEqual([[[42000, -42000], [-42000, 42000]], [[42000, -42000], [-42000, 42000]]]);
    expect(model.contributions[0]).toEqual([[42000, -42000, 0], [-42000, 42000, 0], [0, 0, 0]]);
    expect(model.contributions[1]).toEqual([[0, 0, 0], [0, 42000, -42000], [0, -42000, 42000]]);
    expect(model.K).toEqual([[42000, -42000, 0], [-42000, 84000, -42000], [0, -42000, 42000]]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) near(model.K[i][j], model.contributions[0][i][j] + model.contributions[1][i][j]);
    expect(multiply(model.K, [1, 1, 1])).toEqual([0, 0, 0]);
  });

  it('solves the default actual partition and recovers reaction, strain energy and equilibrium from original equations', () => {
    const result = solveAssembly(ASSEMBLY_DEFAULTS);
    [0, 5 / 21, 10 / 21].forEach((value, i) => near(result.displacement[i], value));
    const original = multiply(result.model.K, result.displacement);
    original.forEach((value, i) => near(value - result.model.F[i], result.reactionAndResidual[i]));
    near(result.reactionAndResidual[0], -10000);
    near(result.strainEnergy, 50000 / 21);
    near(result.strainEnergy, .5 * result.displacement.reduce((sum, u, i) => sum + u * original[i], 0));
    result.elementStress.forEach(value => near(value, 100));
    near(result.equilibriumResidual, 0); near(result.maxFreeResidual, 0);
  });

  it('uses independently changed geometry/material, not fixed reference displacements', () => {
    const inputs = { ...ASSEMBLY_DEFAULTS, E: 70000, A1: 80, A2: 160, L1: 400, L2: 600, P: -1200 };
    const result = solveAssembly(inputs);
    const extension1 = inputs.P * inputs.L1 / (inputs.E * inputs.A1);
    const extension2 = inputs.P * inputs.L2 / (inputs.E * inputs.A2);
    near(result.displacement[1], extension1); near(result.displacement[2], extension1 + extension2);
    result.elementForce.forEach(value => near(value, inputs.P));
    near(result.reactionAndResidual[0], -inputs.P);
    near(result.elementStress[0], inputs.P / inputs.A1); near(result.elementStress[1], inputs.P / inputs.A2);
    near(result.strainEnergy, .5 * inputs.P * (extension1 + extension2));
    expect(result.strainEnergy).toBeGreaterThan(0);
  });

  it('moves Kfc*uc to the RHS and includes prescribed-support force in the endpoint energy identity', () => {
    const inputs = { ...ASSEMBLY_DEFAULTS, A2: 50, L1: 400, L2: 600, uc: .2 };
    const result = solveAssembly(inputs);
    expect(result.KfcUc).toEqual([-10500, 0]);
    expect(result.correctedRhs).toEqual([10500, 10000]);
    near(result.displacement[0], .2); near(result.displacement[1], .2 + 4 / 21); near(result.displacement[2], .2 + 16 / 21);
    near(result.reactionAndResidual[0], -10000);
    near(result.strainEnergy, 80000 / 21);
    near(result.energyFromEndForces, result.strainEnergy);
    const forceOnly = .5 * result.model.F.reduce((sum, value, i) => sum + value * result.displacement[i], 0);
    near(forceOnly - result.strainEnergy, 1000);
  });

  it('rejects actual free-matrix elimination for both unbalanced and balanced loads without weak springs', () => {
    const free = { ...ASSEMBLY_DEFAULTS, constraint: 'free' as const };
    expect(() => solveAssembly(free)).toThrow(AssemblySingularityError);
    expect(() => solveAssembly({ ...free, P: 0 })).toThrow(AssemblySingularityError);
    const model = assembleBars(free);
    expect(() => gaussianSolve(model.K, model.F)).toThrow(AssemblySingularityError);
    expect(model.K.map(row => row.reduce((sum, value) => sum + value, 0))).toEqual([0, 0, 0]);
    expect(model.K[0][0]).toBe(model.stiffness[0]);
  });

  it('accepts scientific notation but refuses blanks, nonfinite/partial numbers and model bounds before assembly', () => {
    const valid = readAssemblyInputs({ ...ASSEMBLY_DEFAULTS, E: '2.1e5', P: '-1e4', uc: '.2' });
    expect(valid.ok).toBe(true);
    if (valid.ok) { expect(valid.value.E).toBe(210000); expect(valid.value.P).toBe(-10000); }
    for (const [key, value] of [['E', ''], ['A1', 0], ['L1', '500 mm'], ['P', 'Infinity'], ['P', '1e309'], ['A2', '0x10'], ['uc', 101], ['constraint', 'auto-fixed']] as const) {
      expect(readAssemblyInputs({ ...ASSEMBLY_DEFAULTS, [key]: value }).ok).toBe(false);
    }
    for (const name of Object.keys(ASSEMBLY_LIMITS)) expect(() => assembleBars({ ...ASSEMBLY_DEFAULTS, [name]: Number.NaN })).toThrow();
  });

  it('handles zero applied load plus a rigid prescribed translation without artificial strain or energy', () => {
    const solution = solveAssembly({ ...ASSEMBLY_DEFAULTS, P: 0, uc: 10 });
    solution.displacement.forEach(value => near(value, 10));
    solution.reactionAndResidual.forEach(value => near(value, 0));
    near(solution.strainEnergy, 0); near(solution.equilibriumResidual, 0);
  });

  it('does not mutate input arrays during pivoted elimination and refuses malformed systems', () => {
    const K = [[0, 2], [3, 4]], F = [4, 11];
    expect(gaussianSolve(K, F)).toEqual([1, 2]);
    expect(K).toEqual([[0, 2], [3, 4]]); expect(F).toEqual([4, 11]);
    expect(() => gaussianSolve([[1, 2]], [1])).toThrow();
    expect(() => gaussianSolve([[1]], [Infinity])).toThrow();
  });
});
