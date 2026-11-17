/**
 * minimization.js - DFA Minimization using the Table-Filling (Myhill-Nerode) Algorithm
 * Provides complete step-by-step trace data for academic visualization
 */

class DFAMinimizer {
    /**
     * Minimizes a given DFA and returns detailed step-by-step trace
     * @param {DFA} dfa 
     */
    static minimize(dfa) {
        // Step 1: Reachability check & removal of dead/unreachable states
        const unreachable = dfa.getUnreachableStates();
        const reachableStates = dfa.states.filter(s => !unreachable.includes(s));

        if (reachableStates.length === 0) {
            throw new Error('DFA has no reachable states.');
        }

        // Sub-DFA with reachable states only
        const states = [...reachableStates];
        const alphabet = [...dfa.alphabet];
        const initial = dfa.initialState;
        const finalSet = new Set(states.filter(s => dfa.finalStates.has(s)));

        // Step 2: Initialize Table of Pairs
        // We use a map with key: pairKey(p, q) where p < q in state index
        const pairKey = (p, q) => {
            const [first, second] = [p, q].sort();
            return `${first}|${second}`;
        };

        const table = {};
        const pairs = [];
        for (let i = 0; i < states.length; i++) {
            for (let j = 0; j < i; j++) {
                const p = states[i];
                const q = states[j];
                const key = pairKey(p, q);
                pairs.push({ p, q, key });
                table[key] = {
                    p,
                    q,
                    marked: false,
                    iteration: null,
                    reason: ''
                };
            }
        }

        const steps = [];

        // Base step: Mark pairs where one is final and other is non-final
        let initialMarkedCount = 0;
        for (const pair of pairs) {
            const pIsFinal = finalSet.has(pair.p);
            const qIsFinal = finalSet.has(pair.q);
            if (pIsFinal !== qIsFinal) {
                table[pair.key].marked = true;
                table[pair.key].iteration = 0;
                table[pair.key].reason = `One state is final (${pIsFinal ? pair.p : pair.q}) while the other is non-final.`;
                initialMarkedCount++;
            }
        }

        steps.push({
            iteration: 0,
            description: `Base Step: Marked ${initialMarkedCount} pair(s) distinguished by acceptance status (one state ∈ F, one ∉ F).`,
            tableSnapshot: JSON.parse(JSON.stringify(table))
        });

        // Inductive step: Iteratively mark pairs
        let iteration = 1;
        let changed = true;

        while (changed) {
            changed = false;
            let markedInThisRound = 0;

            for (const pair of pairs) {
                const cell = table[pair.key];
                if (cell.marked) continue;

                // Check for each symbol
                for (const a of alphabet) {
                    const nextP = dfa.step(pair.p, a);
                    const nextQ = dfa.step(pair.q, a);

                    if (nextP && nextQ && nextP !== nextQ) {
                        const targetKey = pairKey(nextP, nextQ);
                        if (table[targetKey] && table[targetKey].marked) {
                            cell.marked = true;
                            cell.iteration = iteration;
                            cell.reason = `On input '${a}', leads to previously distinguished pair (${nextP}, ${nextQ}).`;
                            changed = true;
                            markedInThisRound++;
                            break;
                        }
                    }
                }
            }

            if (changed) {
                steps.push({
                    iteration: iteration,
                    description: `Iteration ${iteration}: Marked ${markedInThisRound} additional pair(s) whose transitions lead to distinguished states.`,
                    tableSnapshot: JSON.parse(JSON.stringify(table))
                });
                iteration++;
            }
        }

        // Step 3: Find Equivalence Classes using Disjoint Set Union (DSU)
        const parent = {};
        for (const s of states) parent[s] = s;

        const find = (s) => {
            if (parent[s] !== s) parent[s] = find(parent[s]);
            return parent[s];
        };

        const union = (s1, s2) => {
            const root1 = find(s1);
            const root2 = find(s2);
            if (root1 !== root2) {
                parent[root2] = root1;
            }
        };

        // Union unmarked pairs
        const equivalentPairs = [];
        for (const pair of pairs) {
            if (!table[pair.key].marked) {
                equivalentPairs.push({ p: pair.p, q: pair.q });
                union(pair.p, pair.q);
            }
        }

        // Group states by root
        const groups = {};
        for (const s of states) {
            const root = find(s);
            if (!groups[root]) groups[root] = [];
            groups[root].push(s);
        }

        const equivalenceClasses = Object.values(groups).map(group => group.sort());

        // Step 4: Construct Minimized DFA
        // Create descriptive state names: e.g., "q0" or "q0,q2"
        const classNames = new Map();
        const minStates = [];
        let minInitial = '';
        const minFinal = [];

        for (const eqClass of equivalenceClasses) {
            const name = eqClass.length === 1 ? eqClass[0] : `{${eqClass.join(',')}}`;
            classNames.set(eqClass[0], name);
            for (const s of eqClass) {
                classNames.set(s, name);
            }
            minStates.push(name);

            if (eqClass.includes(initial)) {
                minInitial = name;
            }
            if (eqClass.some(s => finalSet.has(s))) {
                minFinal.push(name);
            }
        }

        const minTransitions = {};
        for (const eqClass of equivalenceClasses) {
            const representative = eqClass[0];
            const fromName = classNames.get(representative);
            minTransitions[fromName] = {};

            for (const a of alphabet) {
                const target = dfa.step(representative, a);
                if (target) {
                    minTransitions[fromName][a] = classNames.get(target);
                }
            }
        }

        const minimizedDFA = new DFA(
            minStates,
            alphabet,
            minTransitions,
            minInitial,
            minFinal
        );

        return {
            unreachableStates: unreachable,
            reachableStates: reachableStates,
            pairs: pairs,
            table: table,
            steps: steps,
            totalIterations: iteration,
            equivalentPairs: equivalentPairs,
            equivalenceClasses: equivalenceClasses,
            minimizedDFA: minimizedDFA,
            reductionCount: dfa.states.length - minStates.length
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DFAMinimizer;
}

