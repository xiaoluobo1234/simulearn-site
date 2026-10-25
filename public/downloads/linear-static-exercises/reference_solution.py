"""REFERENCE ANSWER, not a completed learner submission or a CAE result.

For the stated translational-DOF exercises only: K [N/mm], u [mm], F [N].
Read exercise.py and try your own implementation before consulting this file.
"""
import math


def _validate(K, u):
    if not isinstance(K, (list, tuple)) or not K or not isinstance(u, (list, tuple)) or len(u) != len(K):
        raise ValueError("K must be a nonempty square matrix compatible with u")
    if any(not isinstance(row, (list, tuple)) or len(row) != len(K) for row in K):
        raise ValueError("K must be square")
    if any(type(value) not in (int, float) or not math.isfinite(value) for row in K for value in row):
        raise ValueError("K must contain finite numbers")
    if any(type(value) not in (int, float) or not math.isfinite(value) for value in u):
        raise ValueError("u must contain finite numbers")


def recover_reaction(K, u, F, support_dof):
    _validate(K, u)
    if not isinstance(F, (list, tuple)) or len(F) != len(u) or any(type(value) not in (int, float) or not math.isfinite(value) for value in F):
        raise ValueError("F must contain compatible finite loads")
    if type(support_dof) is not int or not 0 <= support_dof < len(u):
        raise ValueError("support_dof is outside the matrix")
    return sum(K[support_dof][j] * u[j] for j in range(len(u))) - F[support_dof]


def strain_energy(K, u):
    _validate(K, u)
    return 0.5 * sum(u[i] * sum(K[i][j] * u[j] for j in range(len(u))) for i in range(len(u)))
