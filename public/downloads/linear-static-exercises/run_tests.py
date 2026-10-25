#!/usr/bin/env python3
"""Offline unittest runner; default exercise.py is deliberately unfinished.

python run_tests.py
python run_tests.py --implementation reference_solution.py
Each comparison prints expected/actual and its unit. Passing covers only the
given teaching fixtures, never CAE validation or personal mastery.
"""
import argparse
import copy
import importlib.util
import json
import math
from pathlib import Path
import sys
import unittest

IMPLEMENTATION = None
FIXTURES = {}


class Comparison(unittest.TestCase):
    def check_fixture(self, case_id, operation):
        data = copy.deepcopy(FIXTURES[case_id])
        reaction = operation == "recover_reaction"
        expected = data["expected_reaction_N" if reaction else "expected_energy_Nmm"]
        unit = "N" if reaction else "N mm"
        try:
            function = getattr(IMPLEMENTATION, operation)
            actual = function(data["K"], data["u"], data["F"], data["support_dof"]) if reaction else function(data["K"], data["u"])
        except NotImplementedError as exc:
            print("\n[COMPARE] " + case_id + " / " + operation + ": expected=" + repr(expected) + " " + unit + "; actual=NotImplementedError (TODO unfinished)")
            self.fail("Unfinished exercise: " + str(exc))
        print("\n[COMPARE] " + case_id + " / " + operation + ": expected=" + repr(expected) + " " + unit + "; actual=" + repr(actual) + " " + unit)
        self.assertTrue(type(actual) in (int, float) and math.isfinite(actual), "expected a finite numeric result; actual=" + repr(actual))
        self.assertTrue(math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-9), "expected=" + repr(expected) + "; actual=" + repr(actual) + " " + unit)


class OriginalMatrixReactionTests(Comparison):
    def test_original_K_and_negative_reaction(self):
        self.check_fixture("standard-bar", "recover_reaction")

    def test_external_load_at_support_is_subtracted(self):
        self.check_fixture("loaded-support", "recover_reaction")

    def test_positive_reaction_for_reversed_load(self):
        self.check_fixture("reverse-load", "recover_reaction")

    def test_support_index_one_and_coupled_row(self):
        self.check_fixture("coupled-matrix", "recover_reaction")


class CoupledEnergyTests(Comparison):
    def test_uniform_bar_half_quadratic_form(self):
        self.check_fixture("standard-bar", "strain_energy")

    def test_symmetric_nondiagonal_matrix(self):
        self.check_fixture("coupled-matrix", "strain_energy")

    def test_negative_displacement_positive_energy(self):
        self.check_fixture("reverse-load", "strain_energy")


class ZeroDisplacementTests(Comparison):
    def test_zero_reaction(self):
        self.check_fixture("zero-motion", "recover_reaction")

    def test_zero_energy(self):
        self.check_fixture("zero-motion", "strain_energy")


class EnergyUnitTests(Comparison):
    def test_energy_remains_in_Nmm_not_joules(self):
        self.check_fixture("standard-bar", "strain_energy")


def main():
    global IMPLEMENTATION, FIXTURES
    if sys.version_info < (3, 10):
        raise ValueError("Python 3.10+ is required")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--implementation", type=Path, default=Path(__file__).with_name("exercise.py"))
    args = parser.parse_args()
    path = args.implementation.resolve()
    spec = importlib.util.spec_from_file_location("learner_implementation", path)
    if spec is None or spec.loader is None:
        raise ValueError("implementation must be an importable local Python file")
    IMPLEMENTATION = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(IMPLEMENTATION)
    fixtures = json.loads(Path(__file__).with_name("fixtures.json").read_text(encoding="utf-8"))
    FIXTURES = {case["id"]: case for case in fixtures["cases"]}
    print("Implementation: " + path.name + "; local teaching checks only; no CAE execution or learning-state update")
    suite = unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromTestCase(group) for group in
        (OriginalMatrixReactionTests, CoupledEnergyTests, ZeroDisplacementTests, EnergyUnitTests))
    result = unittest.TextTestRunner(stream=sys.stdout, verbosity=2).run(suite)
    print("[SUMMARY] tests=" + str(result.testsRun) + " failures=" + str(len(result.failures)) + " errors=" + str(len(result.errors)) + " successful=" + str(result.wasSuccessful()).lower())
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, ImportError) as exc:
        print("Exercise runner could not start: " + str(exc), file=sys.stderr)
        sys.exit(2)
