#!/usr/bin/env python3
"""Original linear-static teaching FE references; Python 3.10+ standard library.

No ANSYS invocation, user-practice claim, engineering certification or network I/O.
Every case assembles element matrices, partitions prescribed DOFs, solves the
free equations and recovers reactions using the unmodified K and F.
"""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import platform
import sys


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(value, name, positive=False):
    require(type(value) in (int, float) and math.isfinite(value), name + " must be finite numeric data")
    require(not positive or value > 0, name + " must be positive")
    return float(value)


def count(value):
    require(type(value) is int and 1 <= value <= 64, "elements must be an integer from 1 to 64")
    return value


def exact_keys(value, expected, name):
    require(type(value) is dict and set(value) == set(expected), name + " has missing or unsupported fields")


def validate(data):
    require(type(data) is dict, "input must be an object")
    require(type(data.get("schema_version")) is int and data["schema_version"] == 1, "unsupported schema_version")
    slug = data.get("slug")
    require(slug in ("uniform-bar", "stepped-bar", "cantilever-beam"), "unsupported case slug")
    beam = slug == "cantilever-beam"
    common = {"schema_version", "slug", "model", "units", "E_MPa", "end_force_N", "left_displacement_mm"}
    extra = {"I_mm4", "length_mm", "elements", "left_rotation_rad"} if beam else {"segments"}
    exact_keys(data, common | extra, "input")
    expected_model = "euler-bernoulli-beam" if beam else "axial-bar"
    require(data["model"] == expected_model, "model does not match case slug")
    require(data["units"] == {"length": "mm", "force": "N", "stress": "MPa", "rotation": "rad"}, "units must be mm, N, MPa and rad; no automatic conversion")
    number(data["E_MPa"], "E_MPa", True)
    number(data["end_force_N"], "end_force_N")
    number(data["left_displacement_mm"], "left_displacement_mm")
    if beam:
        number(data["I_mm4"], "I_mm4", True)
        number(data["length_mm"], "length_mm", True)
        number(data["left_rotation_rad"], "left_rotation_rad")
        count(data["elements"])
    else:
        require(type(data["segments"]) is list and len(data["segments"]) == (1 if slug == "uniform-bar" else 2), "wrong number of segments")
        for segment in data["segments"]:
            exact_keys(segment, {"length_mm", "area_mm2", "elements"}, "segment")
            number(segment["length_mm"], "length_mm", True)
            number(segment["area_mm2"], "area_mm2", True)
            count(segment["elements"])
    return data


def solve_linear(matrix, rhs):
    """Scaled partial-pivot Gaussian elimination; never forms an inverse."""
    n = len(rhs)
    a = [list(row) + [rhs[i]] for i, row in enumerate(matrix)]
    scales = [max(abs(v) for v in row) for row in matrix]
    require(all(s > 0 for s in scales), "singular free system: zero row")
    for k in range(n):
        pivot = max(range(k, n), key=lambda i: abs(a[i][k]) / scales[i])
        require(abs(a[pivot][k]) / scales[pivot] > 1e-14, "singular or numerically unsupported free system")
        a[k], a[pivot] = a[pivot], a[k]
        scales[k], scales[pivot] = scales[pivot], scales[k]
        for i in range(k + 1, n):
            factor = a[i][k] / a[k][k]
            for j in range(k + 1, n + 1):
                a[i][j] -= factor * a[k][j]
            a[i][k] = 0.0
    solution = [0.0] * n
    for i in range(n - 1, -1, -1):
        solution[i] = (a[i][n] - sum(a[i][j] * solution[j] for j in range(i + 1, n))) / a[i][i]
    require(all(math.isfinite(v) for v in solution), "nonfinite displacement solution")
    return solution


def matvec(matrix, vector):
    return [sum(v * vector[j] for j, v in enumerate(row)) for row in matrix]


def calculate(data, executor="运行此脚本的 Python 环境（执行者未声明）", input_sha256=None):
    validate(data)
    E, P = data["E_MPa"], data["end_force_N"]
    beam = data["model"] == "euler-bernoulli-beam"
    coordinates, elements = [0.0], []
    if beam:
        n, L, I = data["elements"], data["length_mm"], data["I_mm4"]
        h = L / n
        base = [[12, 6*h, -12, 6*h], [6*h, 4*h*h, -6*h, 2*h*h],
                [-12, -6*h, 12, -6*h], [6*h, 2*h*h, -6*h, 4*h*h]]
        for i in range(n):
            coordinates.append((i + 1) * h)
            elements.append(([2*i, 2*i+1, 2*i+2, 2*i+3], [[E * I / h**3 * v for v in row] for row in base]))
        size, tip = 2 * (n + 1), 2 * n
        prescribed = {0: data["left_displacement_mm"], 1: data["left_rotation_rad"]}
        compliance = L**3 / (3 * E * I)
        analytic_tip = prescribed[0] + prescribed[1] * L + P * compliance
    else:
        for segment in data["segments"]:
            h = segment["length_mm"] / segment["elements"]
            start = coordinates[-1]
            for i in range(segment["elements"]):
                a = len(coordinates) - 1
                coordinates.append(start + (i + 1) * h)
                k = E * segment["area_mm2"] / h
                elements.append(([a, a + 1], [[k, -k], [-k, k]]))
        L, size, tip = coordinates[-1], len(coordinates), len(coordinates) - 1
        prescribed = {0: data["left_displacement_mm"]}
        compliance = sum(s["length_mm"] / (E * s["area_mm2"]) for s in data["segments"])
        analytic_tip = prescribed[0] + P * compliance
    K, F = [[0.0] * size for _ in range(size)], [0.0] * size
    F[tip] = P
    for dofs, ke in elements:
        for i, Iglobal in enumerate(dofs):
            for j, Jglobal in enumerate(dofs):
                K[Iglobal][Jglobal] += ke[i][j]
    free = [i for i in range(size) if i not in prescribed]
    rhs = [F[i] - sum(K[i][c] * value for c, value in prescribed.items()) for i in free]
    uf = solve_linear([[K[i][j] for j in free] for i in free], rhs)
    u = [prescribed.get(i, 0.0) for i in range(size)]
    for i, value in zip(free, uf):
        u[i] = value
    Ku = matvec(K, u)
    R = [Ku[i] - F[i] for i in range(size)]
    energy = 0.5 * sum(u[i] * Ku[i] for i in range(size))
    element_energies = []
    for dofs, ke in elements:
        ue = [u[i] for i in dofs]
        element_energies.append(0.5 * sum(a * b for a, b in zip(ue, matvec(ke, ue))))
    quantities = {"tip_displacement_mm": u[tip], "reaction_force_N": R[0], "strain_energy_Nmm": energy}
    analytical = {"tip_displacement_mm": analytic_tip, "reaction_force_N": -P, "strain_energy_Nmm": 0.5 * P * P * compliance}
    errors = {key: abs(value - analytical[key]) for key, value in quantities.items()}
    for key in quantities:
        require(errors[key] <= max(1e-8, abs(analytical[key]) * 1e-8), "FE/analytical mismatch: " + key)
    force_free = [abs(R[i]) for i in free if not beam or i % 2 == 0]
    moment_free = [abs(R[i]) for i in free if beam and i % 2 == 1]
    force_residual = max(force_free, default=0.0)
    moment_residual = max(moment_free, default=0.0)
    require(force_residual <= max(1e-6, abs(P) * 1e-8), "free force residual exceeds reference self-check")
    require(moment_residual <= max(1e-6, abs(P * L) * 1e-8), "free moment residual exceeds reference self-check")
    require(abs(energy - sum(element_energies)) <= max(1e-7, abs(energy) * 1e-8), "element/global energy mismatch")
    result = {
        "schema_version": 1, "slug": data["slug"], "status": "教学有限元参考计算·AI辅助编写·待本人复核",
        "execution": {"executor": executor, "python_implementation": platform.python_implementation(),
            "python_version": platform.python_version(), "platform": platform.platform(),
            "executed_at_asia_shanghai": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "not_evidence_of": ["用户本机运行", "ANSYS求解", "CAE端到端验收", "作者真实工程经历", "工程安全认证"]},
        "input_sha256": input_sha256, "input": data,
        "finite_element": {"coordinates_mm": coordinates, "element_count": len(elements),
            "dof_order": "v0(mm),theta0(rad),v1(mm),theta1(rad),..." if beam else "u0(mm),u1(mm),...",
            "K_original": K, "F_original": F, "prescribed_dofs": {str(k): v for k, v in prescribed.items()},
            "u": u, "reactions_and_free_residuals": R,
            "nodal_load_units": "N,Nmm,N,Nmm,..." if beam else "N for every DOF",
            "element_energies_Nmm": element_energies},
        "quantities": quantities, "analytical": analytical, "absolute_errors": errors,
        "checks": {"passed": True, "free_force_residual_max_N": force_residual,
            "free_moment_residual_max_Nmm": moment_residual, "global_force_balance_N": R[0] + P,
            "element_energy_sum_Nmm": sum(element_energies)},
        "scope": ["small-displacement linear static teaching model; no distributed load, self-weight or inertia",
            "axial rods ignore bending and step-junction stress concentration",
            "Euler-Bernoulli beam ignores shear deformation, local clamp stress, geometric nonlinearity and buckling",
            "mesh agreement for these polynomial exact fields is an assembly check, not general 3D mesh convergence"]}
    if beam:
        result["checks"]["global_moment_balance_Nmm"] = R[1] + P * L
        result["support_moment_Nmm"] = R[1]
        require(abs(R[1] + P * L) <= max(1e-6, abs(P * L) * 1e-8), "support moment equilibrium mismatch")
    return result


def no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate JSON field: " + key)
        result[key] = value
    return result


def main():
    require(sys.version_info >= (3, 10), "Python 3.10+ is required")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path(__file__).with_name("input.json"))
    parser.add_argument("--output", type=Path)
    parser.add_argument("--executor", default="运行此脚本的 Python 环境（执行者未声明）")
    args = parser.parse_args()
    raw = args.input.read_bytes()
    data = json.loads(raw.decode("utf-8"), object_pairs_hook=no_duplicates)
    result = calculate(data, args.executor, hashlib.sha256(raw).hexdigest())
    text = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    if args.output:
        require(args.output.resolve() not in (Path(__file__).resolve(), args.input.resolve()), "output cannot overwrite the script or input")
        args.output.write_text(text, encoding="utf-8")
    else:
        print(text, end="")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, OverflowError, ZeroDivisionError) as exc:
        print("Input/reference calculation failed: " + str(exc), file=sys.stderr)
        sys.exit(2)
