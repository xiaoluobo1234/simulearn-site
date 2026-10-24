#!/usr/bin/env python3
"""Independent supports/materials/assembly/constraints references, Python 3.10+.

Uses the standard library only and never imports or overwrites verify_basics.py
or its saved results. No ANSYS or CAE workbench is invoked.
"""
from __future__ import annotations

import argparse
import json
import math
import platform
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


def close(actual: float, expected: float, name: str, *, abs_tol: float = 1e-8) -> None:
    assert math.isclose(actual, expected, rel_tol=1e-10, abs_tol=abs_tol), (name, actual, expected)


def matvec(matrix: list[list[float]], vector: list[float]) -> list[float]:
    return [sum(a * b for a, b in zip(row, vector)) for row in matrix]


def solve(matrix: list[list[float]], rhs: list[float]) -> list[float]:
    """Actual partial-pivot Gaussian elimination, not a displacement lookup."""
    n = len(rhs)
    assert len(matrix) == n and n > 0 and all(len(row) == n for row in matrix)
    rows = [[float(value) for value in row] + [float(rhs[i])] for i, row in enumerate(matrix)]
    scale = max(abs(value) for row in matrix for value in row)
    assert scale > 0
    for column in range(n):
        pivot = max(range(column, n), key=lambda i: abs(rows[i][column]))
        assert abs(rows[pivot][column]) > scale * 1e-13, "Singular linear system"
        rows[column], rows[pivot] = rows[pivot], rows[column]
        for i in range(column + 1, n):
            factor = rows[i][column] / rows[column][column]
            rows[i][column] = 0.0
            for j in range(column + 1, n + 1):
                rows[i][j] -= factor * rows[column][j]
    result = [0.0] * n
    for i in range(n - 1, -1, -1):
        result[i] = (rows[i][-1] - sum(rows[i][j] * result[j] for j in range(i + 1, n))) / rows[i][i]
    return result


def matrix_rank(matrix: list[list[float]]) -> int:
    """Elimination rank for these small examples; not a condition-number estimate."""
    rows = [[float(value) for value in row] for row in matrix]
    scale = max(abs(value) for row in rows for value in row)
    if scale == 0:
        return 0
    count = 0
    for column in range(len(rows[0])):
        pivot = max(range(count, len(rows)), key=lambda i: abs(rows[i][column]))
        if abs(rows[pivot][column]) <= scale * 1e-12:
            continue
        rows[count], rows[pivot] = rows[pivot], rows[count]
        for i in range(count + 1, len(rows)):
            factor = rows[i][column] / rows[count][column]
            for j in range(column, len(rows[0])):
                rows[i][j] -= factor * rows[count][j]
        count += 1
        if count == len(rows):
            break
    return count


def assemble_bar(E: float, lengths: list[float], areas: list[float]) -> tuple[list[list[float]], list[float]]:
    assert len(lengths) == len(areas) and all(value > 0 for value in [E, *lengths, *areas])
    stiffness = [E * area / length for area, length in zip(areas, lengths)]
    K = [[0.0] * (len(lengths) + 1) for _ in range(len(lengths) + 1)]
    for e, k in enumerate(stiffness):
        for a, b, value in [(e, e, k), (e, e + 1, -k), (e + 1, e, -k), (e + 1, e + 1, k)]:
            K[a][b] += value
    return K, stiffness


def constrain_and_solve(K: list[list[float]], F: list[float], prescribed: dict[int, float], areas: list[float], stiffness: list[float]) -> dict:
    free = [i for i in range(len(F)) if i not in prescribed]
    Kff = [[K[i][j] for j in free] for i in free]
    rhs = [F[i] - sum(K[i][j] * value for j, value in prescribed.items()) for i in free]
    uf = solve(Kff, rhs)
    u = [0.0] * len(F)
    for i, value in prescribed.items():
        u[i] = value
    for i, value in zip(free, uf):
        u[i] = value

    # Independent symmetric row/column replacement. Correct the complete RHS
    # with original columns first; do not lose the nonzero prescribed motion.
    replacement_K = [row[:] for row in K]
    replacement_F = [F[i] - sum(K[i][j] * value for j, value in prescribed.items()) for i in range(len(F))]
    for j, value in prescribed.items():
        for i in range(len(F)):
            replacement_K[i][j] = 0.0
            replacement_K[j][i] = 0.0
        constraint_scale = K[j][j]
        assert constraint_scale > 0.0
        replacement_K[j][j] = constraint_scale
        replacement_F[j] = constraint_scale * value
    replacement_u = solve(replacement_K, replacement_F)
    for i in range(len(F)):
        close(u[i], replacement_u[i], "partition vs symmetric replacement")
        for j in range(len(F)):
            close(replacement_K[i][j], replacement_K[j][i], "replacement symmetry")

    Ku = matvec(K, u)
    residual = [Ku[i] - F[i] for i in range(len(F))]
    for i in free:
        close(residual[i], 0.0, "free DOF equilibrium")
    for value in matvec(K, [1.0] * len(F)):
        close(value, 0.0, "unconstrained rigid translation")
    close(sum(residual) + sum(F), 0.0, "global force balance")
    axial_forces = [stiffness[i] * (u[i + 1] - u[i]) for i in range(len(areas))]
    stresses = [force / area for force, area in zip(axial_forces, areas)]
    energy = 0.5 * sum(value * internal for value, internal in zip(u, Ku))
    element_energies = [0.5 * stiffness[i] * (u[i + 1] - u[i]) ** 2 for i in range(len(areas))]
    half_external_force_dot_u = 0.5 * sum(force * value for force, value in zip(F, u))
    half_prescribed_reaction_dot_u = 0.5 * sum(residual[j] * value for j, value in prescribed.items())
    close(energy, sum(element_energies), "matrix vs element energy")
    close(energy, half_external_force_dot_u + half_prescribed_reaction_dot_u, "complete endpoint energy identity")
    return {
        "prescribed_u_mm": {str(key): value for key, value in prescribed.items()},
        "free_dofs": free, "Kff_N_per_mm": Kff, "corrected_free_rhs_N": rhs,
        "u_mm": u, "reaction_and_residual_N": residual,
        "element_axial_forces_N": axial_forces, "element_stresses_MPa": stresses,
        "strain_energy_Nmm": energy, "element_energy_Nmm": element_energies,
        "half_external_force_dot_u_Nmm": half_external_force_dot_u,
        "half_prescribed_reaction_dot_u_Nmm": half_prescribed_reaction_dot_u,
        "symmetric_replacement_matrix": replacement_K,
        "symmetric_replacement_rhs": replacement_F, "symmetric_replacement_u_mm": replacement_u,
        "symmetric_constraint_scale_N_per_mm": {str(j): K[j][j] for j in prescribed},
        "wrong_reactions_from_replaced_equations": [a - b for a, b in zip(matvec(replacement_K, u), replacement_F)],
    }


def calculate(executor: str) -> dict:
    if not __debug__:
        raise RuntimeError("Run without -O: reference assertions must remain enabled.")
    E, nu, sx = 210_000.0, 0.3, 100.0
    mu = E / (2 * (1 + nu))
    lame_lambda = E * nu / ((1 + nu) * (1 - 2 * nu))
    C = [[lame_lambda + (2 * mu if i == j else 0.0) for j in range(3)] for i in range(3)]
    S = [[(1.0 if i == j else -nu) / E for j in range(3)] for i in range(3)]
    free_strain = solve(C, [sx, 0.0, 0.0])
    for actual, expected in zip(free_strain, [sx / E, -nu * sx / E, -nu * sx / E]):
        close(actual, expected, "uniaxial stress strain", abs_tol=1e-14)
    effective_modulus = C[0][0]
    constrained_strain = [sx / effective_modulus, 0.0, 0.0]
    constrained_stress = matvec(C, constrained_strain)
    close(constrained_stress[0], sx, "prescribed axial stress")
    close(constrained_stress[1], nu * sx / (1 - nu), "lateral reaction stress")
    close(constrained_stress[2], constrained_stress[1], "lateral symmetry")
    for actual, expected in zip(matvec(S, constrained_stress), constrained_strain):
        close(actual, expected, "independent compliance check", abs_tol=1e-14)

    reference_length = 2_000.0
    support_cases = []
    for name, rows, expected_rank, null_mode in [
        ("pin_A_and_vertical_roller_B", [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 1.0, 2000.0]], 3, None),
        ("three_vertical_rollers", [[0.0, 1.0, 0.0], [0.0, 1.0, 1000.0], [0.0, 1.0, 2000.0]], 2, [1.0, 0.0, 0.0]),
        ("pin_A_and_horizontal_roller_B", [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [1.0, 0.0, 0.0]], 2, [0.0, 0.0, 1.0]),
    ]:
        scaled = [[row[0], row[1], row[2] / reference_length] for row in rows]
        raw_rank = matrix_rank(rows)
        scaled_rank = matrix_rank(scaled)
        assert raw_rank == scaled_rank == expected_rank
        if null_mode is not None:
            for value in matvec(rows, null_mode):
                close(value, 0.0, "unrestrained rigid motion")
        support_cases.append({"name": name, "physical_rows": rows, "scaled_rows": scaled,
                              "rank": raw_rank, "scaled_rank": scaled_rank, "unrestrained_mode": null_mode})
    theta = 0.001
    displacement_B = [0.0 - 0.0 * theta, 0.0 + 2000.0 * theta]
    close(displacement_B[1], 2.0, "rigid rotation displacement at B")

    lengths, areas = [400.0, 600.0], [100.0, 50.0]
    K, stiffness = assemble_bar(E, lengths, areas)
    F = [0.0, 5000.0, 10000.0]
    expected_K = [[52500.0, -52500.0, 0.0], [-52500.0, 70000.0, -17500.0], [0.0, -17500.0, 17500.0]]
    assert K == expected_K
    fixed = constrain_and_solve(K, F, {0: 0.0}, areas, stiffness)
    moved = constrain_and_solve(K, F, {0: 0.2}, areas, stiffness)
    for actual, expected in zip(fixed["u_mm"], [0.0, 2 / 7, 6 / 7]):
        close(actual, expected, "fixed support displacement")
    for actual, expected in zip(moved["u_mm"], [0.2, 17 / 35, 37 / 35]):
        close(actual, expected, "nonzero support displacement")
    assert moved["corrected_free_rhs_N"] == [15500.0, 10000.0]
    for result in [fixed, moved]:
        close(result["reaction_and_residual_N"][0], -15000.0, "support reaction")
        close(result["strain_energy_Nmm"], 5000.0, "strain energy")
        for actual, expected in zip(result["element_axial_forces_N"], [15000.0, 10000.0]):
            close(actual, expected, "element axial force")
        for actual, expected in zip(result["element_stresses_MPa"], [150.0, 200.0]):
            close(actual, expected, "element average stress")
    close(moved["half_external_force_dot_u_Nmm"], 6500.0, "incomplete external-force-only expression")
    close(moved["half_prescribed_reaction_dot_u_Nmm"], -1500.0, "boundary contribution")

    alpha, delta_temperature = 12e-6, 50.0
    free_thermal_strain = alpha * delta_temperature
    axial_stress = -E * free_thermal_strain
    axial_total_strain = [elastic + free_thermal_strain for elastic in matvec(S, [axial_stress, 0.0, 0.0])]
    all_fixed_stress = matvec(C, [-free_thermal_strain] * 3)
    close(axial_stress, -126.0, "axially fixed, laterally free thermal stress")
    close(axial_total_strain[0], 0.0, "zero total axial strain", abs_tol=1e-14)
    close(axial_total_strain[1], 0.00078, "free lateral strain including Poisson effect", abs_tol=1e-14)
    for stress in all_fixed_stress:
        close(stress, -315.0, "three-direction fixed thermal stress")
    executed = datetime.now(timezone(timedelta(hours=8)))
    return {
        "execution": {"executor": executor, "python_version": platform.python_version(),
                      "python_implementation": platform.python_implementation(),
                      "executed_at_asia_shanghai": executed.isoformat(timespec="seconds"),
                      "execution_date_asia_shanghai": executed.date().isoformat(),
                      "calculation_type": "standalone stdlib Python reference calculation",
                      "not_evidence_of": ["用户本机运行", "ANSYS 求解", "CAE 工作台测试通过", "工程安全认证"]},
        "assumptions": ["small strain, isotropic linear elasticity, tension positive",
                        "normal-stress block only; no shear-component convention is implied",
                        "bar elements carry only axial force; distributed loads and self-weight excluded",
                        "constraint rank concerns 2D rigid motion, not flexibility or engineering adequacy",
                        "0.5*(F^T*u+R_c^T*u_c) is an endpoint elastic-energy identity",
                        "interpreting its individual terms as work assumes proportional quasistatic ramping of all forces and prescribed motions from zero",
                        "replacement equations are numerical constraints, not the original physical stiffness or force equations"],
        "materials": {"E_MPa": E, "nu": nu, "normal_stiffness_MPa": C, "normal_compliance_per_MPa": S,
                      "uniaxial_stress_MPa": [sx, 0.0, 0.0], "uniaxial_strain": free_strain,
                      "lateral_fixed_stress_MPa": constrained_stress, "lateral_fixed_strain": constrained_strain,
                      "lateral_fixed_effective_modulus_MPa": effective_modulus},
        "supports": {"physical_coordinate_order": ["tx_mm", "ty_mm", "theta_rad"],
                     "scaled_coordinate_order": ["tx_mm", "ty_mm", "Lref_times_theta_mm"],
                     "reference_length_mm": reference_length, "cases": support_cases,
                     "rotation_example": {"theta_rad": theta, "B_xy_mm": [2000.0, 0.0], "B_displacement_mm": displacement_B},
                     "scope": "rank after explicit coordinate scaling; mixed-unit entries are not a condition number"},
        "assembly": {"E_MPa": E, "lengths_mm": lengths, "areas_mm2": areas,
                     "element_stiffness_N_per_mm": stiffness, "K_N_per_mm": K, "F_N": F,
                     "fixed_u0": fixed, "prescribed_u0_0p2_mm": moved},
        "thermal": {"alpha_per_K": alpha, "delta_T_K": delta_temperature, "free_thermal_strain": free_thermal_strain,
                    "axially_fixed_laterally_free_stress_MPa": [axial_stress, 0.0, 0.0],
                    "axially_fixed_laterally_free_total_strain": axial_total_strain,
                    "three_direction_fixed_total_strain": [0.0, 0.0, 0.0],
                    "three_direction_fixed_stress_MPa": all_fixed_stress},
        "self_checks": {"passed": True, "groups": ["uniaxial_isotropic_hooke_solution", "lateral_constraint_compliance", "scaled_rigid_support_rank", "actual_assembly_partition_and_symmetric_replacement", "distinct_axial_and_three_direction_thermal_constraints"]},
    }


def table(result: dict) -> str:
    return "\n".join([
        f"Executor: {result['execution']['executor']}",
        f"Python: {result['execution']['python_version']} | {result['execution']['executed_at_asia_shanghai']}",
        f"Uniaxial strains: {result['materials']['uniaxial_strain']}",
        f"Lateral-fixed stress / strain: {result['materials']['lateral_fixed_stress_MPa']} / {result['materials']['lateral_fixed_strain']}",
        f"Support ranks (pin+vertical, 3 vertical, pin+horizontal): {[case['rank'] for case in result['supports']['cases']]}",
        f"u0=0: u={result['assembly']['fixed_u0']['u_mm']}, U={result['assembly']['fixed_u0']['strain_energy_Nmm']} N mm",
        f"u0=0.2: u={result['assembly']['prescribed_u0_0p2_mm']['u_mm']}, rhs={result['assembly']['prescribed_u0_0p2_mm']['corrected_free_rhs_N']}",
        f"Energy: force-only={result['assembly']['prescribed_u0_0p2_mm']['half_external_force_dot_u_Nmm']}, boundary={result['assembly']['prescribed_u0_0p2_mm']['half_prescribed_reaction_dot_u_Nmm']} N mm",
        f"Axial-fixed thermal stresses: {result['thermal']['axially_fixed_laterally_free_stress_MPa']} MPa",
        f"Three-direction-fixed thermal stresses: {result['thermal']['three_direction_fixed_stress_MPa']} MPa",
        f"Python reference self-check groups passed: {len(result['self_checks']['groups'])}",
        "Not an ANSYS/CAE solve or evidence of user-local execution.",
    ])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format", choices=["json", "table"], default="json")
    parser.add_argument("--executor", default="运行此脚本的 Python 环境（执行者未声明）")
    parser.add_argument("--output", type=Path, help="Optional JSON file to write; existing file will be replaced.")
    args = parser.parse_args()
    protected = {Path(__file__).with_name(name).resolve() for name in ["verify_basics.py", "reference-results.json"]}
    if args.output and args.output.resolve() in protected:
        parser.error("The original verify_basics.py and reference-results.json evidence must not be overwritten.")
    result = calculate(args.executor)
    output = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)
    if args.output:
        args.output.write_text(output + "\n", encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(table(result) if args.format == "table" else output)


if __name__ == "__main__":
    main()
