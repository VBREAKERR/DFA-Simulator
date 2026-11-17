"""
dfa_engine.py - Formal 5-Tuple Mathematical Engine for DFA in Python 3.11
Course: Theory of Automata / Formal Languages & Automata Theory (FLAT)
M = (Q, Sigma, delta, q0, F)
"""

from typing import Set, Dict, List, Tuple, Optional
import json


class DFA:
    def __init__(
        self,
        states: List[str],
        alphabet: List[str],
        transitions: Dict[str, Dict[str, str]],
        initial_state: str,
        final_states: List[str]
    ):
        self.states: List[str] = list(states)
        self.alphabet: List[str] = list(alphabet)
        self.initial_state: str = initial_state
        self.final_states: Set[str] = set(final_states)
        self.transitions: Dict[str, Dict[str, str]] = {}

        # Normalize transition map
        for s in self.states:
            self.transitions[s] = {}
            if s in transitions:
                for a in self.alphabet:
                    if a in transitions[s]:
                        self.transitions[s][a] = transitions[s][a]

    def validate(self) -> Tuple[bool, List[str]]:
        """Validate formal 5-tuple mathematical integrity."""
        errors = []

        if not self.states:
            errors.append("State set Q is empty.")
        if not self.alphabet:
            errors.append("Alphabet Sigma is empty.")
        if self.initial_state not in self.states:
            errors.append(f"Initial state q0 '{self.initial_state}' is not in Q.")
        for f in self.final_states:
            if f not in self.states:
                errors.append(f"Final state '{f}' is not in Q.")

        for s in self.states:
            for a in self.alphabet:
                target = self.transitions.get(s, {}).get(a)
                if target is None:
                    errors.append(f"Incomplete transition: delta({s}, '{a}') is undefined.")
                elif target not in self.states:
                    errors.append(f"Invalid target: delta({s}, '{a}') = '{target}' not in Q.")

        return len(errors) == 0, errors

    def get_unreachable_states(self) -> List[str]:
        """Find states unreachable from start state using BFS."""
        if self.initial_state not in self.states:
            return list(self.states)

        visited = {self.initial_state}
        queue = [self.initial_state]

        while queue:
            curr = queue.pop(0)
            for a in self.alphabet:
                nxt = self.transitions.get(curr, {}).get(a)
                if nxt and nxt in self.states and nxt not in visited:
                    visited.add(nxt)
                    queue.append(nxt)

        return [s for s in self.states if s not in visited]

    def step(self, state: str, symbol: str) -> Optional[str]:
        """Single transition lookup delta(q, a)."""
        return self.transitions.get(state, {}).get(symbol)

    def simulate(self, input_string: str) -> Tuple[bool, List[dict], Optional[str]]:
        """
        Simulate DFA on input string w.
        Returns: (accepted: bool, trace: List[dict], error: Optional[str])
        """
        curr = self.initial_state
        trace = []

        for i, ch in enumerate(input_string):
            if ch not in self.alphabet:
                return False, trace, f"Symbol '{ch}' at position {i} not in alphabet Sigma."
            
            nxt = self.step(curr, ch)
            if nxt is None:
                return False, trace, f"Undefined transition delta({curr}, '{ch}')."

            trace.append({
                "step": i + 1,
                "current_state": curr,
                "symbol": ch,
                "next_state": nxt,
                "remaining": input_string[i + 1:]
            })
            curr = nxt

        accepted = curr in self.final_states
        return accepted, trace, None

    def complement(self) -> 'DFA':
        """Construct complement DFA recognizing Sigma* \\ L(M)."""
        new_final = [s for s in self.states if s not in self.final_states]
        return DFA(
            self.states,
            self.alphabet,
            self.transitions,
            self.initial_state,
            new_final
        )

    def minimize(self) -> 'DFA':
        """
        DFA Minimization via Table-Filling (Myhill-Nerode) Algorithm.
        Removes unreachable states and merges equivalent states.
        """
        # 1. Eliminate unreachable states
        unreachable = set(self.get_unreachable_states())
        states = [s for s in self.states if s not in unreachable]

        # 2. Table of pairs (p, q) with p < q
        pairs = {}
        for i in range(len(states)):
            for j in range(i):
                p, q = sorted([states[i], states[j]])
                key = (p, q)
                # Base step: mark if one is final and other is non-final
                p_final = p in self.final_states
                q_final = q in self.final_states
                pairs[key] = (p_final != q_final)

        # 3. Inductive marking
        changed = True
        while changed:
            changed = False
            for (p, q), marked in list(pairs.items()):
                if not marked:
                    for a in self.alphabet:
                        nxt_p = self.step(p, a)
                        nxt_q = self.step(q, a)
                        if nxt_p and nxt_q and nxt_p != nxt_q:
                            target_key = tuple(sorted([nxt_p, nxt_q]))
                            if pairs.get(target_key, False):
                                pairs[(p, q)] = True
                                changed = True
                                break

        # 4. Equivalence classes using Disjoint Set Union
        parent = {s: s for s in states}

        def find(s):
            if parent[s] != s:
                parent[s] = find(parent[s])
            return parent[s]

        def union(s1, s2):
            r1, r2 = find(s1), find(s2)
            if r1 != r2:
                parent[r2] = r1

        for (p, q), marked in pairs.items():
            if not marked:
                union(p, q)

        groups: Dict[str, List[str]] = {}
        for s in states:
            root = find(s)
            groups.setdefault(root, []).append(s)

        equivalence_classes = [sorted(grp) for grp in groups.values()]

        # 5. Build minimal DFA
        class_names = {}
        min_states = []
        min_final = []
        min_initial = ""

        for eq in equivalence_classes:
            name = eq[0] if len(eq) == 1 else "{" + ",".join(eq) + "}"
            min_states.append(name)
            for s in eq:
                class_names[s] = name
            if self.initial_state in eq:
                min_initial = name
            if any(s in self.final_states for s in eq):
                min_final.append(name)

        min_transitions = {}
        for eq in equivalence_classes:
            rep = eq[0]
            from_name = class_names[rep]
            min_transitions[from_name] = {}
            for a in self.alphabet:
                target = self.step(rep, a)
                if target:
                    min_transitions[from_name][a] = class_names[target]

        return DFA(
            min_states,
            self.alphabet,
            min_transitions,
            min_initial,
            min_final
        )

    def to_dict(self) -> dict:
        return {
            "states": self.states,
            "alphabet": self.alphabet,
            "initial_state": self.initial_state,
            "final_states": list(self.final_states),
            "transitions": self.transitions
        }

    def to_latex(self) -> str:
        q_str = "{" + ", ".join(self.states) + "}"
        sigma_str = "{" + ", ".join(self.alphabet) + "}"
        f_str = "{" + ", ".join(sorted(self.final_states)) + "}"

        latex = [
            r"% Formal 5-tuple Definition",
            r"M = (Q, \Sigma, \delta, q_0, F)\\",
            f"Q = \\{q_str}\\textbackslash\\",
            f"\\Sigma = \\{sigma_str}\\textbackslash\\",
            f"q_0 = {self.initial_state}\\\\",
            f"F = \\{f_str}\\textbackslash\\",
            "",
            r"% Transition Table",
            r"\begin{table}[h]",
            r"\centering",
            r"\begin{tabular}{c|" + "c" * len(self.alphabet) + "}",
            "State & " + " & ".join(self.alphabet) + r" \\\hline"
        ]

        for s in self.states:
            prefix = ""
            if s == self.initial_state:
                prefix += r"$\rightarrow$ "
            if s in self.final_states:
                prefix += "*"
            row = [prefix + s] + [self.transitions.get(s, {}).get(a, "-") for a in self.alphabet]
            latex.append(" & ".join(row) + r" \\")

        latex.extend([
            r"\end{tabular}",
            r"\caption{DFA Transition Table}",
            r"\end{table}"
        ])
        return "\n".join(latex)

