"""Learner scaffold: two deliberately unfinished linear-static postprocessing tasks.

K is the ORIGINAL symmetric stiffness matrix in N/mm; u is in mm; F is in N.
These exercises use translational DOFs only. They do not run a CAE solver.
"""


def recover_reaction(K, u, F, support_dof):
    """Return the signed support force (N): row support_dof of K*u - F.

    Use the original matrix, including off-diagonal terms. A force applied at
    the support is still an external load and must be subtracted. Do not take
    an absolute value or alter the inputs.
    """
    # TODO: implement the reaction recovery using only Python's standard library.
    raise NotImplementedError("TODO: recover_reaction is not implemented")


def strain_energy(K, u):
    """Return U = 0.5 * u^T * K * u in N mm, without converting to joules.

    Include all matrix contributions, retain the factor 0.5 and support zero
    displacement. A negative displacement does not imply negative energy.
    """
    # TODO: implement the quadratic form using only Python's standard library.
    raise NotImplementedError("TODO: strain_energy is not implemented")
