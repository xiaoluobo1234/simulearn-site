#!/usr/bin/env python3
"""Three teaching diagnostic references, Python 3.10+ standard library only.

This is an independent numerical reference, not an ANSYS/CAE solve or a record
of a learner's engineering failure. Default execution prints JSON only.
"""
from __future__ import annotations

import argparse
import json
import math
import platform
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


class SingularSystemError(ValueError):
    """The small teaching matrix has a zero pivot after elimination."""


def near(actual: float, expected: float, label: str) -> None:
    assert math.isclose(actual, expected, rel_tol=1e-11, abs_tol=1e-10), (label, actual, expected)


def matvec(matrix: list[list[float]], vector: list[float]) -> list[float]:
    return [sum(a * b for a, b in zip(row, vector)) for row in matrix]


def solve(matrix: list[list[float]], rhs: list[float]) -> list[float]:
    """Partial-pivot elimination; exact zero detection for these small matrices.

    This is not a condition-number estimator or a production solver. The free
    bar matrix used below cancels exactly, so no general pivot limit is needed.
    """
    n = len(rhs)
    assert n > 0 and len(matrix) == n and all(len(row) == n for row in matrix)
    assert all(math.isfinite(value) for row in matrix for value in row)
    assert all(math.isfinite(value) for value in rhs)
    rows = [[float(value) for value in row] + [float(rhs[i])] for i, row in enumerate(matrix)]
    for column in range(n):
        pivot = max(range(column, n), key=lambda i: abs(rows[i][column]))
        if rows[pivot][column] == 0.0:
            raise SingularSystemError(f"Zero pivot in column {column + 1}: singular teaching system")
        rows[column], rows[pivot] = rows[pivot], rows[column]
        for i in range(column + 1, n):
            factor = rows[i][column] / rows[column][column]
            rows[i][column] = 0.0
            for j in range(column + 1, n + 1):
                rows[i][j] -= factor * rows[column][j]
    answer = [0.0] * n
    for i in range(n - 1, -1, -1):
        answer[i] = (rows[i][-1] - sum(rows[i][j] * answer[j] for j in range(i + 1, n))) / rows[i][i]
    return answer


def constrained_solution(matrix: list[list[float]], force: list[float], prescribed: dict[int, float]) -> dict:
    """Partition prescribed DOFs, then recover reactions from ORIGINAL equations."""
    free = [i for i in range(len(force)) if i not in prescribed]
    assert all(0 <= i < len(force) for i in prescribed)
    reduced = [[matrix[i][j] for j in free] for i in free]
    rhs = [force[i] - sum(matrix[i][j] * value for j, value in prescribed.items()) for i in free]
    solved = solve(reduced, rhs) if free else []
    u = [0.0] * len(force)
    for i, value in prescribed.items():
        u[i] = value
    for i, value in zip(free, solved):
        u[i] = value
    reactions = [value - force[i] for i, value in enumerate(matvec(matrix, u))]
    for i in free:
        near(reactions[i], 0.0, f"free-node residual {i}")
    return {"u_mm": u, "reaction_and_residual_N": reactions}


def calculate(executor: str) -> dict:
    if not __debug__:
        raise RuntimeError("Verification assertions must be enabled; do not use Python -O.")
    if sys.version_info < (3, 10):
        raise RuntimeError("Python 3.10 or newer is required.")
    E, A, L, P = 210000.0, 100.0, 1000.0, 10000.0
    k = E * A / L
    K = [[k, -k], [-k, k]]
    mechanical_force = [0.0, P]
    fixed_bar = constrained_solution(K, mechanical_force, {0: 0.0})
    near(k, 21000.0, "bar stiffness")
    near(fixed_bar["u_mm"][1], 10.0 / 21.0, "end-load displacement")
    near(fixed_bar["reaction_and_residual_N"][0], -P, "left reaction")

    volume = A * L
    rho_correct, rho_wrong = 7.85e-9, 7.85e-6
    mass_correct_Mg, mass_wrong_Mg = rho_correct * volume, rho_wrong * volume
    mass_correct_kg, mass_wrong_kg = mass_correct_Mg * 1000.0, mass_wrong_Mg * 1000.0
    ratio = mass_wrong_kg / mass_correct_kg
    near(volume, 100000.0, "volume")
    near(mass_correct_kg, 0.785, "correct mass")
    near(mass_wrong_kg, 785.0, "wrong mass")
    near(ratio, 1000.0, "mass ratio")
    # With NO body-force/inertia term, both densities give the same K and F.
    static_by_density = []
    for density in [rho_correct, rho_wrong]:
        solution = constrained_solution(K, mechanical_force, {0: 0.0})
        near(solution["u_mm"][1], P * L / (E * A), "density-independent static displacement")
        static_by_density.append({"density_Mg_per_mm3": density, **solution})
    near(static_by_density[0]["u_mm"][1], static_by_density[1]["u_mm"][1], "same static displacement")

    # Actual elimination must reject the free stiffness, rather than invent u.
    rejected, rejection_message = False, ""
    try:
        solve(K, mechanical_force)
    except SingularSystemError as error:
        rejected, rejection_message = True, str(error)
    assert rejected, "The unrestrained matrix must not produce a unique displacement."
    rigid_mode = [1.0, 1.0]
    near(sum(mechanical_force), 10000.0, "nonzero net load")
    for value in matvec(K, rigid_mode):
        near(value, 0.0, "rigid translation null mode")
    assert sum(mechanical_force) != 0.0, "This particular free system also lacks force equilibrium."

    alpha, delta_T = 12e-6, 50.0
    thermal_strain = alpha * delta_T
    thermal_force = E * A * thermal_strain
    equivalent_force = [-thermal_force, thermal_force]
    free_right = constrained_solution(K, equivalent_force, {0: 0.0})
    locked = constrained_solution(K, equivalent_force, {0: 0.0, 1: 0.0})
    for solution in [free_right, locked]:
        total_strain = (solution["u_mm"][1] - solution["u_mm"][0]) / L
        solution["total_axial_strain"] = total_strain
        solution["elastic_axial_strain"] = total_strain - thermal_strain
        solution["axial_stress_MPa"] = E * solution["elastic_axial_strain"]
        near(sum(solution["reaction_and_residual_N"]), 0.0, "thermal reaction equilibrium")
    near(thermal_strain, 0.0006, "free thermal strain")
    near(free_right["u_mm"][1], 0.6, "free expansion")
    near(free_right["axial_stress_MPa"], 0.0, "free expansion stress")
    for value in free_right["reaction_and_residual_N"]:
        near(value, 0.0, "free expansion reaction")
    near(locked["u_mm"][1], 0.0, "locked displacement")
    near(locked["axial_stress_MPa"], -126.0, "locked compressive stress")
    near(locked["reaction_and_residual_N"][0], 12600.0, "locked left reaction")
    near(locked["reaction_and_residual_N"][1], -12600.0, "locked right reaction")

    return {
        "schema_version": 1,
        "status": "教学排查示例·AI环境参考计算·待本人复核",
        "execution": {
            "executor": executor,
            "python_implementation": platform.python_implementation(),
            "python_version": platform.python_version(),
            "executed_at_asia_shanghai": datetime.now(timezone(timedelta(hours=8), "Asia/Shanghai")).isoformat(timespec="seconds"),
            "timezone": "Asia/Shanghai (UTC+08:00)",
            "not_evidence_of": ["用户本机运行", "ANSYS 求解", "模态分析运行", "CAE 工作台测试通过", "作者真实故障经历", "工程安全认证"],
        },
        "common_inputs": {"E_MPa": E, "A_mm2": A, "L_mm": L, "P_N": P, "k_N_per_mm": k},
        "assumptions": [
            "one-dimensional uniform bar; small strain; linear elastic; tension positive",
            "N-mm-s consistent units; density in Mg/mm3; 1 Mg = 1000 kg",
            "mechanical end-load case excludes self-weight, all body forces and inertia",
            "thermal case has uniform temperature and laterally free axial behavior; no applied mechanical load",
            "reaction is support force on the bar; x points from left to right",
            "no modal, buckling, contact, plasticity or three-dimensional restraint analysis was run",
        ],
        "units": {
            "diagnostic_href": "/diagnostic/units/", "volume_mm3": volume,
            "correct_density_Mg_per_mm3": rho_correct, "wrong_density_Mg_per_mm3": rho_wrong,
            "correct_mass_Mg": mass_correct_Mg, "wrong_mass_Mg": mass_wrong_Mg,
            "correct_mass_kg": mass_correct_kg, "wrong_mass_kg": mass_wrong_kg, "mass_ratio": ratio,
            "static_end_load_by_density": static_by_density,
        },
        "rigid_body": {
            "diagnostic_href": "/diagnostic/rigid-body/", "K_N_per_mm": K, "F_N": mechanical_force,
            "rigid_translation_vector": rigid_mode, "K_times_rigid_translation": matvec(K, rigid_mode),
            "net_load_N": sum(mechanical_force), "free_elimination_rejected": rejected,
            "free_elimination_message": rejection_message, "left_fixed": fixed_bar,
            "scope": "zero pivot demonstrates this matrix singularity; other solver pivot warnings can have other causes",
        },
        "boundary": {
            "diagnostic_href": "/diagnostic/boundary/", "alpha_per_K": alpha, "delta_T_K": delta_T,
            "free_thermal_strain": thermal_strain, "equivalent_nodal_thermal_load_N": equivalent_force,
            "left_located_right_free": free_right, "both_axial_ends_fixed": locked,
            "scope": "Whether restraint is erroneous depends on intended physical supports; this is not full three-direction restraint.",
        },
        "self_checks": {"passed": True, "groups": ["density_mass_and_static_displacement", "actual_singular_elimination_and_constrained_equilibrium", "thermal_free_and_axially_fixed_comparison"]},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--executor", default="运行此脚本的 Python 环境（执行者未声明）")
    parser.add_argument("--output", type=Path, help="Optional JSON output; existing file will be replaced.")
    args = parser.parse_args()
    if args.output and args.output.resolve() == Path(__file__).resolve():
        parser.error("The script itself must not be overwritten.")
    result = calculate(args.executor)
    output = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)
    if args.output:
        args.output.write_text(output + "\n", encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
