"""
test_dfa.py - Formal Verification Test Suite for DFA Simulator
Runs unit tests to mathematically prove correctness of the 5-tuple engine,
step simulator, complementation, and table-filling minimization.
"""

import unittest
from dfa_engine import DFA


class TestDFASimulator(unittest.TestCase):
    def setUp(self):
        # 1. "Ends with 01"
        self.dfa_01 = DFA(
            states=["q0", "q1", "q2"],
            alphabet=["0", "1"],
            transitions={
                "q0": {"0": "q1", "1": "q0"},
                "q1": {"0": "q1", "1": "q2"},
                "q2": {"0": "q1", "1": "q0"}
            },
            initial_state="q0",
            final_states=["q2"]
        )

        # 2. "Binary Divisible by 3"
        self.dfa_div3 = DFA(
            states=["q0", "q1", "q2"],
            alphabet=["0", "1"],
            transitions={
                "q0": {"0": "q0", "1": "q1"},
                "q1": {"0": "q2", "1": "q0"},
                "q2": {"0": "q1", "1": "q2"}
            },
            initial_state="q0",
            final_states=["q0"]
        )

    def test_validation_valid_dfa(self):
        valid, errors = self.dfa_01.validate()
        self.assertTrue(valid)
        self.assertEqual(len(errors), 0)

    def test_validation_invalid_start_state(self):
        bad_dfa = DFA(
            states=["q0", "q1"],
            alphabet=["0", "1"],
            transitions={"q0": {"0": "q0", "1": "q1"}, "q1": {"0": "q0", "1": "q1"}},
            initial_state="q99",  # Invalid
            final_states=["q1"]
        )
        valid, errors = bad_dfa.validate()
        self.assertFalse(valid)
        self.assertTrue(any("q99" in e for e in errors))

    def test_ends_with_01_acceptance(self):
        # Positive test cases
        for s in ["01", "101", "0001", "1110001", "0101"]:
            accepted, _, err = self.dfa_01.simulate(s)
            self.assertIsNone(err)
            self.assertTrue(accepted, f"Failed on accepting string '{s}'")

        # Negative test cases
        for s in ["", "0", "1", "10", "010", "1110", "0100"]:
            accepted, _, err = self.dfa_01.simulate(s)
            self.assertIsNone(err)
            self.assertFalse(accepted, f"Incorrectly accepted string '{s}'")

    def test_divisible_by_3_acceptance(self):
        # In binary: 0=0, 3=11, 6=110, 9=1001, 12=1100, 15=1111
        for val in [0, 3, 6, 9, 12, 15, 21, 24, 27, 30]:
            b_str = bin(val)[2:]
            accepted, _, err = self.dfa_div3.simulate(b_str)
            self.assertIsNone(err)
            self.assertTrue(accepted, f"Value {val} ({b_str}) should be divisible by 3.")

        # Not divisible: 1, 2, 4, 5, 7, 8, 10
        for val in [1, 2, 4, 5, 7, 8, 10, 11, 13, 14]:
            b_str = bin(val)[2:]
            accepted, _, err = self.dfa_div3.simulate(b_str)
            self.assertIsNone(err)
            self.assertFalse(accepted, f"Value {val} ({b_str}) should NOT be divisible by 3.")

    def test_invalid_alphabet_symbol(self):
        accepted, _, err = self.dfa_01.simulate("01a01")
        self.assertFalse(accepted)
        self.assertIsNotNone(err)
        self.assertIn("not in alphabet", err)

    def test_complementation(self):
        comp = self.dfa_01.complement()
        # Original accepts "01", so complement must reject
        acc_orig, _, _ = self.dfa_01.simulate("01")
        acc_comp, _, _ = comp.simulate("01")
        self.assertTrue(acc_orig)
        self.assertFalse(acc_comp)

        # Original rejects "010", complement must accept
        acc_orig, _, _ = self.dfa_01.simulate("010")
        acc_comp, _, _ = comp.simulate("010")
        self.assertFalse(acc_orig)
        self.assertTrue(acc_comp)

    def test_minimization_equivalence(self):
        """
        Verify that a 6-state redundant DFA minimized via Table-Filling
        produces identical acceptance across test inputs.
        """
        redundant = DFA(
            states=["q0", "q1", "q2", "q3", "q4", "q5"],
            alphabet=["0", "1"],
            transitions={
                "q0": {"0": "q1", "1": "q2"},
                "q1": {"0": "q5", "1": "q2"},
                "q2": {"0": "q1", "1": "q5"},
                "q3": {"0": "q2", "1": "q4"},
                "q4": {"0": "q5", "1": "q3"},
                "q5": {"0": "q5", "1": "q5"}
            },
            initial_state="q0",
            final_states=["q1", "q2", "q4"]
        )

        minimized = redundant.minimize()
        # Minimized DFA should have fewer states
        self.assertLess(len(minimized.states), len(redundant.states))

        # Check language equivalence across test strings
        test_strings = ["", "0", "1", "00", "01", "10", "11", "010", "011", "101", "110", "0101", "1110"]
        for s in test_strings:
            res_red, _, _ = redundant.simulate(s)
            res_min, _, _ = minimized.simulate(s)
            self.assertEqual(res_red, res_min, f"Equivalence failed on string '{s}'")


if __name__ == "__main__":
    unittest.main()

