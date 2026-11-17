"""
cli.py - Terminal Interface for DFA Simulator
Allows running simulations, batch testing, and minimization from command line.
"""

import sys
import os
from dfa_engine import DFA

PRESETS = {
    "1": {
        "name": "Ends with '01'",
        "states": ["q0", "q1", "q2"],
        "alphabet": ["0", "1"],
        "transitions": {
            "q0": {"0": "q1", "1": "q0"},
            "q1": {"0": "q1", "1": "q2"},
            "q2": {"0": "q1", "1": "q0"}
        },
        "initial_state": "q0",
        "final_states": ["q2"]
    },
    "2": {
        "name": "Binary Divisible by 3",
        "states": ["q0", "q1", "q2"],
        "alphabet": ["0", "1"],
        "transitions": {
            "q0": {"0": "q0", "1": "q1"},
            "q1": {"0": "q2", "1": "q0"},
            "q2": {"0": "q1", "1": "q2"}
        },
        "initial_state": "q0",
        "final_states": ["q0"]
    },
    "3": {
        "name": "Contains substring '101'",
        "states": ["q0", "q1", "q2", "q3"],
        "alphabet": ["0", "1"],
        "transitions": {
            "q0": {"0": "q0", "1": "q1"},
            "q1": {"0": "q2", "1": "q1"},
            "q2": {"0": "q0", "1": "q3"},
            "q3": {"0": "q3", "1": "q3"}
        },
        "initial_state": "q0",
        "final_states": ["q3"]
    }
}


def print_dfa(dfa: DFA):
    print("\n" + "=" * 50)
    print(f"Formal 5-Tuple Definition M = (Q, Sigma, delta, q0, F):")
    print(f"  Q     = {set(dfa.states)}")
    print(f"  Sigma = {set(dfa.alphabet)}")
    print(f"  q0    = {dfa.initial_state}")
    print(f"  F     = {dfa.final_states}")
    print("\nTransition Table delta:")
    header = f"  {'State':<12} | " + " | ".join(f"{a:^6}" for a in dfa.alphabet)
    print(header)
    print("  " + "-" * (len(header) - 2))
    for s in dfa.states:
        prefix = ("-> " if s == dfa.initial_state else "   ")
        suffix = ("*" if s in dfa.final_states else " ")
        lbl = f"{prefix}{s}{suffix}"
        row = f"  {lbl:<12} | " + " | ".join(f"{dfa.transitions.get(s, {}).get(a, '-'):^6}" for a in dfa.alphabet)
        print(row)
    print("=" * 50)


def main():
    print("=" * 50)
    print("      DFA SIMULATOR - AUTOMATA THEORY CLI")
    print("=" * 50)
    print("Select a textbook preset automaton:")
    for k, v in PRESETS.items():
        print(f"  [{k}] {v['name']}")

    choice = input("\nEnter choice (default: 1): ").strip() or "1"
    preset = PRESETS.get(choice, PRESETS["1"])

    dfa = DFA(
        preset["states"],
        preset["alphabet"],
        preset["transitions"],
        preset["initial_state"],
        preset["final_states"]
    )

    print(f"\nLoaded Automaton: {preset['name']}")
    print_dfa(dfa)

    while True:
        print("\nCommands:")
        print("  [1] Test string w")
        print("  [2] Minimize DFA (Table-Filling)")
        print("  [3] Complement DFA (L' = Sigma* \\ L)")
        print("  [4] Display LaTeX representation")
        print("  [q] Quit")

        cmd = input("\nEnter command: ").strip()

        if cmd == "1":
            s = input("Enter string w to simulate: ").strip()
            accepted, trace, err = dfa.simulate(s)
            if err:
                print(f"[-] Error: {err}")
            else:
                print("\nExecution Trace:")
                curr = dfa.initial_state
                for step in trace:
                    print(f"  delta({step['current_state']}, '{step['symbol']}') -> {step['next_state']}")
                print(f"\nResult: {'>>> ACCEPTED <<<' if accepted else '>>> REJECTED <<<'}")
        elif cmd == "2":
            min_dfa = dfa.minimize()
            print("\n*** Minimized DFA Generated ***")
            print(f"States reduced from {len(dfa.states)} to {len(min_dfa.states)}.")
            print_dfa(min_dfa)
            dfa = min_dfa
        elif cmd == "3":
            dfa = dfa.complement()
            print("\n*** Complemented DFA Generated (Final states inverted) ***")
            print_dfa(dfa)
        elif cmd == "4":
            print("\n--- LaTeX Code ---")
            print(dfa.to_latex())
            print("------------------")
        elif cmd.lower() in ["q", "exit"]:
            print("Exiting DFA Simulator.")
            break


if __name__ == "__main__":
    main()

