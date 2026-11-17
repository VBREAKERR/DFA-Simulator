/**
 * dfa.js - Formal 5-Tuple Mathematical Engine for DFA
 * Represents M = (Q, Σ, δ, q0, F)
 */

class DFA {
    constructor(states = [], alphabet = [], transitions = {}, initialState = '', finalStates = []) {
        this.states = [...states];
        this.alphabet = [...alphabet];
        this.transitions = {}; // { state: { symbol: nextState } }
        this.initialState = initialState;
        this.finalStates = new Set(finalStates);

        // Normalize transitions
        for (const s of this.states) {
            this.transitions[s] = {};
            if (transitions[s]) {
                for (const sym of this.alphabet) {
                    if (transitions[s][sym] !== undefined) {
                        this.transitions[s][sym] = transitions[s][sym];
                    }
                }
            }
        }
    }

    addState(state) {
        if (!state || this.states.includes(state)) return false;
        this.states.push(state);
        this.transitions[state] = {};
        if (!this.initialState) this.initialState = state;
        return true;
    }

    removeState(state) {
        const idx = this.states.indexOf(state);
        if (idx === -1) return false;
        this.states.splice(idx, 1);
        delete this.transitions[state];
        this.finalStates.delete(state);

        // Clean transitions pointing to this state
        for (const s of this.states) {
            for (const sym of this.alphabet) {
                if (this.transitions[s][sym] === state) {
                    delete this.transitions[s][sym];
                }
            }
        }

        if (this.initialState === state) {
            this.initialState = this.states.length > 0 ? this.states[0] : '';
        }
        return true;
    }

    renameState(oldState, newState) {
        if (!this.states.includes(oldState) || this.states.includes(newState) || !newState.trim()) {
            return false;
        }
        const idx = this.states.indexOf(oldState);
        this.states[idx] = newState;

        // Update transitions
        this.transitions[newState] = this.transitions[oldState] || {};
        delete this.transitions[oldState];

        for (const s of this.states) {
            for (const sym of this.alphabet) {
                if (this.transitions[s][sym] === oldState) {
                    this.transitions[s][sym] = newState;
                }
            }
        }

        if (this.initialState === oldState) this.initialState = newState;
        if (this.finalStates.has(oldState)) {
            this.finalStates.delete(oldState);
            this.finalStates.add(newState);
        }
        return true;
    }

    addSymbol(symbol) {
        if (!symbol || this.alphabet.includes(symbol) || symbol.length !== 1) return false;
        this.alphabet.push(symbol);
        return true;
    }

    removeSymbol(symbol) {
        const idx = this.alphabet.indexOf(symbol);
        if (idx === -1) return false;
        this.alphabet.splice(idx, 1);
        for (const s of this.states) {
            delete this.transitions[s][symbol];
        }
        return true;
    }

    setTransition(fromState, symbol, toState) {
        if (!this.states.includes(fromState) || !this.alphabet.includes(symbol)) return false;
        if (toState && !this.states.includes(toState)) return false;

        if (!this.transitions[fromState]) this.transitions[fromState] = {};
        if (toState) {
            this.transitions[fromState][symbol] = toState;
        } else {
            delete this.transitions[fromState][symbol];
        }
        return true;
    }

    setInitialState(state) {
        if (this.states.includes(state)) {
            this.initialState = state;
            return true;
        }
        return false;
    }

    toggleFinalState(state) {
        if (!this.states.includes(state)) return false;
        if (this.finalStates.has(state)) {
            this.finalStates.delete(state);
        } else {
            this.finalStates.add(state);
        }
        return true;
    }

    isFinal(state) {
        return this.finalStates.has(state);
    }

    /**
     * Formal mathematical validation of the 5-tuple
     */
    validate() {
        const errors = [];
        const warnings = [];

        if (this.states.length === 0) {
            errors.push('State set Q is empty. At least one state is required.');
        }

        if (this.alphabet.length === 0) {
            errors.push('Alphabet Σ is empty. At least one input symbol is required.');
        }

        if (!this.initialState || !this.states.includes(this.initialState)) {
            errors.push(`Start state q0 ("${this.initialState}") must be an element of Q.`);
        }

        for (const f of this.finalStates) {
            if (!this.states.includes(f)) {
                errors.push(`Final state "${f}" is not in state set Q.`);
            }
        }

        // Check completeness of transition function δ: Q x Σ -> Q
        let missingTransitions = 0;
        for (const s of this.states) {
            for (const sym of this.alphabet) {
                const target = this.transitions[s]?.[sym];
                if (!target) {
                    missingTransitions++;
                    warnings.push(`Missing transition: δ(${s}, '${sym}') is not defined.`);
                } else if (!this.states.includes(target)) {
                    errors.push(`Invalid transition target: δ(${s}, '${sym}') = "${target}" not in Q.`);
                }
            }
        }

        // Reachability analysis
        const unreachable = this.getUnreachableStates();
        if (unreachable.length > 0) {
            warnings.push(`Unreachable state(s) detected: { ${unreachable.join(', ')} }`);
        }

        return {
            valid: errors.length === 0,
            complete: missingTransitions === 0,
            errors,
            warnings,
            missingTransitions
        };
    }

    /**
     * Breadth-First Search to find unreachable states from initialState
     */
    getUnreachableStates() {
        if (!this.initialState || !this.states.includes(this.initialState)) {
            return [...this.states];
        }
        const reachable = new Set([this.initialState]);
        const queue = [this.initialState];

        while (queue.length > 0) {
            const curr = queue.shift();
            for (const sym of this.alphabet) {
                const next = this.transitions[curr]?.[sym];
                if (next && this.states.includes(next) && !reachable.has(next)) {
                    reachable.add(next);
                    queue.push(next);
                }
            }
        }

        return this.states.filter(s => !reachable.has(s));
    }

    /**
     * Single step evaluation: δ(s, a)
     */
    step(state, symbol) {
        if (!this.states.includes(state) || !this.alphabet.includes(symbol)) {
            return null;
        }
        return this.transitions[state]?.[symbol] || null;
    }

    /**
     * Full string simulation: calculates sequence of transitions
     * Returns: { accepted, path: [{step, state, symbol, nextState, remaining}], finalState, error }
     */
    simulate(inputString) {
        const val = this.validate();
        if (!val.valid) {
            return {
                accepted: false,
                path: [],
                finalState: null,
                error: `Invalid DFA specification: ${val.errors[0]}`
            };
        }

        const path = [];
        let currentState = this.initialState;
        const chars = Array.from(inputString);

        for (let i = 0; i < chars.length; i++) {
            const sym = chars[i];
            const remaining = chars.slice(i + 1).join('');

            if (!this.alphabet.includes(sym)) {
                return {
                    accepted: false,
                    path,
                    finalState: currentState,
                    error: `Input symbol '${sym}' at position ${i} is not in alphabet Σ = {${this.alphabet.join(', ')}}`,
                    stoppedAtStep: i
                };
            }

            const nextState = this.step(currentState, sym);
            if (!nextState) {
                return {
                    accepted: false,
                    path,
                    finalState: currentState,
                    error: `Undefined transition from state "${currentState}" on symbol '${sym}' (DFA is incomplete).`,
                    stoppedAtStep: i
                };
            }

            path.push({
                step: i + 1,
                state: currentState,
                symbol: sym,
                nextState: nextState,
                remaining: remaining
            });

            currentState = nextState;
        }

        const accepted = this.finalStates.has(currentState);

        return {
            accepted,
            path,
            finalState: currentState,
            error: null
        };
    }

    /**
     * Complementation: L(M') = Σ* \ L(M)
     * Swap accepting and non-accepting states
     */
    complement() {
        const newFinal = this.states.filter(s => !this.finalStates.has(s));
        return new DFA(
            [...this.states],
            [...this.alphabet],
            JSON.parse(JSON.stringify(this.transitions)),
            this.initialState,
            newFinal
        );
    }

    /**
     * Deep clone of DFA
     */
    clone() {
        return new DFA(
            [...this.states],
            [...this.alphabet],
            JSON.parse(JSON.stringify(this.transitions)),
            this.initialState,
            Array.from(this.finalStates)
        );
    }

    /**
     * Export to standard JSON
     */
    toJSON() {
        return {
            states: this.states,
            alphabet: this.alphabet,
            initialState: this.initialState,
            finalStates: Array.from(this.finalStates),
            transitions: this.transitions
        };
    }

    /**
     * Load from JSON
     */
    static fromJSON(data) {
        return new DFA(
            data.states || [],
            data.alphabet || [],
            data.transitions || {},
            data.initialState || '',
            data.finalStates || []
        );
    }

    /**
     * Generate LaTeX representation for formal academic lab reports
     */
    toLaTeX() {
        const statesStr = `\\{${this.states.join(', ')}\\}`;
        const alphaStr = `\\{${this.alphabet.join(', ')}\\}`;
        const finalStr = `\\{${Array.from(this.finalStates).join(', ')}\\}`;

        let latex = `% Formal 5-tuple Definition\n`;
        latex += `M = (Q, \\Sigma, \\delta, q_0, F)\\\\\n`;
        latex += `Q = ${statesStr}\\\\\n`;
        latex += `\\Sigma = ${alphaStr}\\\\\n`;
        latex += `q_0 = ${this.initialState}\\\\\n`;
        latex += `F = ${finalStr}\\\\\n\n`;

        latex += `% Transition Table\n`;
        latex += `\\begin{table}[h]\n\\centering\n`;
        const cols = 'c|' + 'c'.repeat(this.alphabet.length);
        latex += `\\begin{tabular}{${cols}}\n`;
        latex += `State & ${this.alphabet.join(' & ')} \\\\\n\\hline\n`;

        for (const s of this.states) {
            let prefix = '';
            if (s === this.initialState) prefix += '$\\rightarrow$ ';
            if (this.isFinal(s)) prefix += '*';
            const row = [prefix + s];
            for (const a of this.alphabet) {
                row.push(this.transitions[s]?.[a] || '-');
            }
            latex += `${row.join(' & ')} \\\\\n`;
        }

        latex += `\\end{tabular}\n`;
        latex += `\\caption{DFA Transition Table}\n\\end{table}`;
        return latex;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DFA;
}

