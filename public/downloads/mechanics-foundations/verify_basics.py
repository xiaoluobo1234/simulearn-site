#!/usr/bin/env python3
"""Small, auditable mechanics reference calculations; Python 3.10+ stdlib only.

No ANSYS, CAE solver, external packages, network or user project data are used.
The finite-element examples assemble matrices and solve partitioned systems.
Run without -O so the reference assertions remain active.
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
    """Gaussian elimination with partial pivoting; no inverse or canned bar formula."""
    n = len(rhs)
    assert len(matrix) == n and all(len(row) == n for row in matrix)
    augmented = [[float(value) for value in row] + [float(rhs[i])] for i, row in enumerate(matrix)]
    scale = max(abs(value) for row in matrix for value in row)
    assert scale > 0
    for column in range(n):
        pivot = max(range(column, n), key=lambda row: abs(augmented[row][column]))
        assert abs(augmented[pivot][column]) > scale * 1e-13, "Singular reduced stiffness matrix"
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        for row in range(column + 1, n):
            multiplier = augmented[row][column] / augmented[column][column]
            augmented[row][column] = 0.0
            for j in range(column + 1, n + 1):
                augmented[row][j] -= multiplier * augmented[column][j]
    result = [0.0] * n
    for row in range(n - 1, -1, -1):
        result[row] = (augmented[row][-1] - sum(augmented[row][j] * result[j] for j in range(row + 1, n))) / augmented[row][row]
    return result


def axial_fem(E: float, areas: list[float], length: float, load: float) -> dict:
    """Assemble connected 2-node axial elements; fix u0=0 and partition the system."""
    count = len(areas)
    h = length / count
    local_k = [E * area / h for area in areas]
    matrix = [[0.0] * (count + 1) for _ in range(count + 1)]
    for element, stiffness in enumerate(local_k):
        matrix[element][element] += stiffness
        matrix[element][element + 1] -= stiffness
        matrix[element + 1][element] -= stiffness
        matrix[element + 1][element + 1] += stiffness
    for i in range(count + 1):
        for j in range(count + 1):
            close(matrix[i][j], matrix[j][i], "K symmetry")
    for value in matvec(matrix, [1.0] * (count + 1)):
        close(value, 0.0, "rigid translation K*1", abs_tol=1e-7)
    forces = [0.0] * count + [load]
    free = list(range(1, count + 1))
    reduced_matrix = [[matrix[i][j] for j in free] for i in free]
    reduced_rhs = [forces[i] for i in free]  # K_fc * u_c vanishes because u_c=0.
    displacements = [0.0] + solve(reduced_matrix, reduced_rhs)
    internal = matvec(matrix, displacements)
    residual = [internal[i] - forces[i] for i in range(count + 1)]
    reaction = residual[0]
    close(reaction, -load, "support reaction", abs_tol=1e-6)
    close(reaction + sum(forces), 0.0, "whole-system force balance", abs_tol=1e-6)
    free_residual = max(abs(residual[i]) for i in free)
    assert free_residual < 1e-6, ("free-DOF equilibrium", free_residual)
    element_forces = [local_k[i] * (displacements[i + 1] - displacements[i]) for i in range(count)]
    for value in element_forces:
        close(value, load, "constant axial force", abs_tol=1e-6)
    energy = 0.5 * sum(u * ku for u, ku in zip(displacements, internal))
    element_energy = sum(0.5 * local_k[i] * (displacements[i + 1] - displacements[i]) ** 2 for i in range(count))
    close(energy, element_energy, "matrix vs element strain energy")
    close(energy, 0.5 * load * displacements[-1], "strain energy vs quasistatic work")
    return {
        "elements": count, "element_length_mm": h, "element_areas_mm2": areas,
        "element_stiffness_N_per_mm": local_k, "K_N_per_mm": matrix,
        "F_N": forces, "free_dofs": free, "reduced_K_N_per_mm": reduced_matrix,
        "reduced_F_N": reduced_rhs, "u_mm": displacements,
        "reaction_N": reaction, "free_residual_max_N": free_residual,
        "element_axial_force_N": element_forces,
        "strain_energy_Nmm": energy, "element_energy_sum_Nmm": element_energy,
    }


def calculate(executor: str) -> dict:
    if not __debug__:
        raise RuntimeError("Please run without -O: the reference assertions must remain enabled.")
    E, A, L, P = 210_000.0, 100.0, 1_000.0, 10_000.0
    checks: list[str] = []
    sigma = P / A
    epsilon = sigma / E
    delta = epsilon * L
    close(sigma, 100.0, "uniform bar stress MPa")
    close(epsilon, 1 / 2_100, "uniform bar strain")
    close(delta, 10 / 21, "uniform bar extension mm")
    checks.append("uniform_bar_analytic_stress_strain_extension")

    density_kg_m3 = 7_850.0
    density_Mg_mm3 = density_kg_m3 * 1e-3 / (1_000.0 ** 3)
    volume_mm3 = A * L
    mass_Mg = density_Mg_mm3 * volume_mm3
    mass_kg = mass_Mg * 1_000.0
    gravity_mm_s2 = 9_810.0
    weight_N = mass_Mg * gravity_mm_s2
    close(density_Mg_mm3, 7.85e-9, "density conversion", abs_tol=1e-20)
    close(mass_kg, 0.785, "bar mass kg")
    close(weight_N, 7.70085, "weight in consistent mm-Mg-s-N units")
    close(weight_N, mass_kg * 9.81, "independent SI weight")
    checks.append("density_mass_gravity_unit_consistency")

    beam_L, load_x = 2_000.0, 500.0
    reaction_B = P * load_x / beam_L
    reaction_A = P - reaction_B
    horizontal_A = 0.0
    sum_Fx = horizontal_A + 0.0
    sum_Fy = reaction_A + reaction_B - P
    moment_A = reaction_B * beam_L - P * load_x
    moment_B = -reaction_A * beam_L + (-P) * (load_x - beam_L)
    close(reaction_A, 7_500.0, "beam support A")
    close(reaction_B, 2_500.0, "beam support B")
    for name, value in [("sum Fx", sum_Fx), ("sum Fy", sum_Fy), ("moment about A", moment_A), ("moment about B", moment_B)]:
        close(value, 0.0, name)
    checks.append("beam_independent_force_and_moment_balance")

    x = 250.0
    shape_N = [1.0 - x / L, x / L]
    B = [-1.0 / L, 1.0 / L]
    interpolated_u = shape_N[0] * 0.0 + shape_N[1] * delta
    close(sum(shape_N), 1.0, "partition of unity")
    close(interpolated_u, 5 / 42, "interpolated displacement at x=250 mm")
    close(B[0] * 0.0 + B[1] * delta, epsilon, "constant axial strain")
    rigid_strain = sum(derivative * 3.2 for derivative in B)
    close(rigid_strain, 0.0, "equal-node translation produces zero strain")
    checks.append("linear_shape_functions_and_rigid_translation")

    uniform = axial_fem(E, [A, A], L, P)
    close(uniform["u_mm"][1], 5 / 21, "assembled middle-node displacement")
    close(uniform["u_mm"][-1], delta, "assembled tip vs analytic extension")
    close(uniform["strain_energy_Nmm"], P * delta / 2, "uniform bar strain energy")
    k = E * A / 500.0
    expected_K = [[k, -k, 0.0], [-k, 2 * k, -k], [0.0, -k, k]]
    for row, expected_row in zip(uniform["K_N_per_mm"], expected_K):
        for actual, expected in zip(row, expected_row):
            close(actual, expected, "two-element assembled stiffness")
    # Three independent eigenvectors establish one rigid mode and two positive modes.
    eigenvalues = [0.0, k, 3 * k]
    eigenvectors = [[1.0, 1.0, 1.0], [1.0, 0.0, -1.0], [1.0, -2.0, 1.0]]
    for eigenvalue, eigenvector in zip(eigenvalues, eigenvectors):
        for actual, coordinate in zip(matvec(uniform["K_N_per_mm"], eigenvector), eigenvector):
            close(actual, eigenvalue * coordinate, "global rigid/elastic eigenmode")
    uniform["unconstrained_eigenvalues_N_per_mm"] = eigenvalues
    checks.append("two_element_assembly_partitioned_solve_reaction_energy_and_modes")

    serial_delta = [P * 400.0 / (E * 100.0), P * 600.0 / (E * 50.0)]
    serial_total = sum(serial_delta)
    close(serial_total, 16 / 21, "two-section serial bar extension")
    close(P / serial_total, 13_125.0, "serial equivalent stiffness")
    checks.append("two_section_serial_bar_compliance")

    exact_tip = P * L / (E * A) * math.log(2.0)
    exact_energy = 0.5 * P * exact_tip
    mesh_rows = []
    previous_tip = None
    previous_error = None
    for count in [1, 2, 4, 8, 16]:
        h = L / count
        areas = [A * (1.0 + ((i + 0.5) * h) / L) for i in range(count)]
        solution = axial_fem(E, areas, L, P)
        tip = solution["u_mm"][-1]
        error = abs(exact_tip - tip) / abs(exact_tip)
        adjacent = None if previous_tip is None else abs(tip - previous_tip) / abs(tip)
        order = None if previous_error is None else math.log(previous_error / error, 2.0)
        assert 0.0 < tip < exact_tip
        if previous_tip is not None:
            assert previous_tip < tip
            assert error < previous_error
        mesh_rows.append({
            **solution, "tip_mm": tip, "relative_tip_error": error,
            "relative_tip_error_percent": 100.0 * error,
            "adjacent_change_relative_to_finer_tip": adjacent,
            "adjacent_change_percent": None if adjacent is None else 100.0 * adjacent,
            "observed_error_order": order,
        })
        previous_tip, previous_error = tip, error
    assert mesh_rows[-1]["relative_tip_error"] < 0.001
    assert 1.9 < mesh_rows[-1]["observed_error_order"] < 2.1
    checks.append("variable_area_bar_actual_assembled_mesh_convergence")

    executed = datetime.now(timezone(timedelta(hours=8)))
    return {
        "execution": {
            "executor": executor,
            "calculation_type": "stdlib Python mechanics reference calculations",
            "python_version": platform.python_version(),
            "python_implementation": platform.python_implementation(),
            "executed_at_asia_shanghai": executed.isoformat(timespec="seconds"),
            "execution_date_asia_shanghai": executed.date().isoformat(),
            "not_evidence_of": ["用户本机运行", "ANSYS 求解", "CAE 工作台测试通过", "工程安全认证"],
        },
        "assumptions": [
            "small strain, linear elasticity, constant positive E",
            "1D axial bar, prescribed zero displacement at x=0, positive end tension P",
            "bar examples exclude self-weight, dynamics, shear and bending",
            "beam example is static force/moment equilibrium only, not a beam FE solve",
            "variable bar A(x)=A0*(1+x/L), exact integration of each linear-area element stiffness",
            "quasistatic loading from zero gives external work P*u/2",
        ],
        "parameters": {"E_N_per_mm2": E, "A0_mm2": A, "L_mm": L, "P_N": P},
        "uniform_bar": {"sigma_MPa": sigma, "epsilon": epsilon, "delta_mm": delta},
        "units": {"density_kg_per_m3": density_kg_m3, "density_Mg_per_mm3": density_Mg_mm3,
                  "volume_mm3": volume_mm3, "mass_Mg": mass_Mg, "mass_kg": mass_kg,
                  "gravity_mm_per_s2": gravity_mm_s2, "weight_N": weight_N},
        "static_beam": {"L_mm": beam_L, "load_x_mm": load_x, "load_y_N": -P,
                        "Rx_A_N": horizontal_A, "Ry_A_N": reaction_A, "Ry_B_N": reaction_B,
                        "sum_Fx_N": sum_Fx, "sum_Fy_N": sum_Fy,
                        "sum_M_A_Nmm": moment_A, "sum_M_B_Nmm": moment_B},
        "shape_functions": {"x_mm": x, "N": shape_N, "B_per_mm": B,
                            "nodal_u_mm": [0.0, delta], "u_at_x_mm": interpolated_u,
                            "rigid_translation_mm": [3.2, 3.2], "rigid_translation_strain": rigid_strain},
        "two_element_uniform_bar": uniform,
        "serial_bar": {"lengths_mm": [400.0, 600.0], "areas_mm2": [100.0, 50.0],
                       "delta_each_mm": serial_delta, "delta_total_mm": serial_total,
                       "equivalent_stiffness_N_per_mm": P / serial_total},
        "variable_area_bar": {"area_function": "A(x)=A0*(1+x/L)", "exact_tip_mm": exact_tip,
                              "exact_strain_energy_Nmm": exact_energy,
                              "adjacent_change_definition": "abs(u_finer-u_coarser)/abs(u_finer)",
                              "meshes": mesh_rows},
        "self_checks": {"passed": True, "groups": checks},
    }


def table(result: dict) -> str:
    rows = [
        f"Executor: {result['execution']['executor']}",
        f"Python: {result['execution']['python_version']} | {result['execution']['executed_at_asia_shanghai']}",
        "Not an ANSYS/CAE solve or evidence of user-local execution.",
        f"Uniform: sigma={result['uniform_bar']['sigma_MPa']:.9f} MPa, epsilon={result['uniform_bar']['epsilon']:.12f}, delta={result['uniform_bar']['delta_mm']:.12f} mm",
        f"Variable-area exact tip: {result['variable_area_bar']['exact_tip_mm']:.12f} mm",
        "N     FE tip (mm)       exact error (%)   adjacent change (%)    U (N mm)          reaction (N)",
    ]
    for mesh in result["variable_area_bar"]["meshes"]:
        adjacent = "--" if mesh["adjacent_change_percent"] is None else f"{mesh['adjacent_change_percent']:.9f}"
        rows.append(f"{mesh['elements']:<5} {mesh['tip_mm']:.12f}   {mesh['relative_tip_error_percent']:.9f}       {adjacent:<20} {mesh['strain_energy_Nmm']:.9f}   {mesh['reaction_N']:.6f}")
    rows.append(f"Python reference self-check groups passed: {len(result['self_checks']['groups'])}")
    return "\n".join(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format", choices=["json", "table"], default="json")
    parser.add_argument("--output", type=Path, help="Optional JSON output file (existing file will be replaced).")
    parser.add_argument("--executor", default="运行此脚本的 Python 环境（执行者未声明）", help="Describe the actual executor; never infer the user's environment.")
    args = parser.parse_args()
    result = calculate(args.executor)
    output = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)
    if args.output:
        args.output.write_text(output + "\n", encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(table(result) if args.format == "table" else output)


if __name__ == "__main__":
    main()
