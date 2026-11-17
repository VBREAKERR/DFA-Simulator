/**
 * presets.js - Standard Textbook Automata Problems & Test Cases
 */

const DFA_PRESETS = {
    'ends_with_01': {
        name: 'Strings Ending with "01"',
        description: 'Accepts all binary strings that end with the suffix "01" (e.g., 01, 101, 0001).',
        alphabet: ['0', '1'],
        states: ['q0', 'q1', 'q2'],
        initialState: 'q0',
        finalStates: ['q2'],
        transitions: {
            'q0': { '0': 'q1', '1': 'q0' },
            'q1': { '0': 'q1', '1': 'q2' },
            'q2': { '0': 'q1', '1': 'q0' }
        },
        positions: {
            'q0': { x: 150, y: 250 },
            'q1': { x: 380, y: 250 },
            'q2': { x: 610, y: 250 }
        },
        testCases: [
            { input: '01', expected: true },
            { input: '101', expected: true },
            { input: '110001', expected: true },
            { input: '0', expected: false },
            { input: '10', expected: false },
            { input: '010', expected: false },
            { input: '', expected: false }
        ]
    },

    'contains_101': {
        name: 'Contains Substring "101"',
        description: 'Accepts all binary strings containing "101" as a contiguous substring.',
        alphabet: ['0', '1'],
        states: ['q0', 'q1', 'q2', 'q3'],
        initialState: 'q0',
        finalStates: ['q3'],
        transitions: {
            'q0': { '0': 'q0', '1': 'q1' },
            'q1': { '0': 'q2', '1': 'q1' },
            'q2': { '0': 'q0', '1': 'q3' },
            'q3': { '0': 'q3', '1': 'q3' }
        },
        positions: {
            'q0': { x: 120, y: 250 },
            'q1': { x: 300, y: 250 },
            'q2': { x: 480, y: 250 },
            'q3': { x: 660, y: 250 }
        },
        testCases: [
            { input: '101', expected: true },
            { input: '0010100', expected: true },
            { input: '11101', expected: true },
            { input: '1001', expected: false },
            { input: '1100', expected: false },
            { input: '010', expected: false }
        ]
    },

    'divisible_by_3': {
        name: 'Binary Number Divisible by 3',
        description: 'Processes binary strings as unsigned numbers (most significant bit first) and accepts if value mod 3 == 0.',
        alphabet: ['0', '1'],
        states: ['q0', 'q1', 'q2'],
        initialState: 'q0',
        finalStates: ['q0'],
        transitions: {
            'q0': { '0': 'q0', '1': 'q1' }, // 2*0 % 3 = 0, (2*0 + 1)%3 = 1
            'q1': { '0': 'q2', '1': 'q0' }, // (2*1)%3 = 2, (2*1 + 1)%3 = 0
            'q2': { '0': 'q1', '1': 'q2' }  // (2*2)%3 = 1, (2*2 + 1)%3 = 2
        },
        positions: {
            'q0': { x: 200, y: 160 },
            'q1': { x: 550, y: 160 },
            'q2': { x: 375, y: 380 }
        },
        testCases: [
            { input: '0', expected: true },      // 0 % 3 == 0
            { input: '11', expected: true },     // 3 % 3 == 0
            { input: '110', expected: true },    // 6 % 3 == 0
            { input: '1001', expected: true },   // 9 % 3 == 0
            { input: '1', expected: false },     // 1 % 3 != 0
            { input: '10', expected: false },    // 2 % 3 != 0
            { input: '100', expected: false }    // 4 % 3 != 0
        ]
    },

    'even_zeros_even_ones': {
        name: 'Even Number of 0s AND 1s',
        description: 'Accepts strings where the total count of 0s is even and the total count of 1s is even (Parity State Grid).',
        alphabet: ['0', '1'],
        states: ['qEE', 'qOE', 'qEO', 'qOO'],
        initialState: 'qEE',
        finalStates: ['qEE'],
        transitions: {
            'qEE': { '0': 'qOE', '1': 'qEO' },
            'qOE': { '0': 'qEE', '1': 'qOO' },
            'qEO': { '0': 'qOO', '1': 'qEE' },
            'qOO': { '0': 'qEO', '1': 'qOE' }
        },
        positions: {
            'qEE': { x: 250, y: 160 },
            'qEO': { x: 550, y: 160 },
            'qOE': { x: 250, y: 360 },
            'qOO': { x: 550, y: 360 }
        },
        testCases: [
            { input: '', expected: true },
            { input: '00', expected: true },
            { input: '11', expected: true },
            { input: '0101', expected: true },
            { input: '0011', expected: true },
            { input: '0', expected: false },
            { input: '1', expected: false },
            { input: '011', expected: false }
        ]
    },

    'starts_ends_same': {
        name: 'Starts and Ends with Same Letter',
        description: 'Accepts non-empty strings over {a, b} that start and terminate with the same symbol (e.g., a, abba, b, baab).',
        alphabet: ['a', 'b'],
        states: ['q0', 'qA', 'qA_acc', 'qB', 'qB_acc'],
        initialState: 'q0',
        finalStates: ['qA_acc', 'qB_acc'],
        transitions: {
            'q0': { 'a': 'qA_acc', 'b': 'qB_acc' },
            'qA_acc': { 'a': 'qA_acc', 'b': 'qA' },
            'qA': { 'a': 'qA_acc', 'b': 'qA' },
            'qB_acc': { 'a': 'qB', 'b': 'qB_acc' },
            'qB': { 'a': 'qB', 'b': 'qB_acc' }
        },
        positions: {
            'q0': { x: 120, y: 260 },
            'qA_acc': { x: 350, y: 140 },
            'qA': { x: 580, y: 140 },
            'qB_acc': { x: 350, y: 380 },
            'qB': { x: 580, y: 380 }
        },
        testCases: [
            { input: 'a', expected: true },
            { input: 'b', expected: true },
            { input: 'aba', expected: true },
            { input: 'bab', expected: true },
            { input: 'ab', expected: false },
            { input: 'ba', expected: false },
            { input: '', expected: false }
        ]
    },

    'minimization_demo': {
        name: 'Minimization Demo (Redundant States)',
        description: 'A 6-state textbook automaton designed specifically to demonstrate Table-Filling Minimization. States {q1, q2} and {q3, q4} can be merged.',
        alphabet: ['0', '1'],
        states: ['q0', 'q1', 'q2', 'q3', 'q4', 'q5'],
        initialState: 'q0',
        finalStates: ['q1', 'q2', 'q4'],
        transitions: {
            'q0': { '0': 'q1', '1': 'q2' },
            'q1': { '0': 'q5', '1': 'q2' },
            'q2': { '0': 'q1', '1': 'q5' },
            'q3': { '0': 'q2', '1': 'q4' },
            'q4': { '0': 'q5', '1': 'q3' },
            'q5': { '0': 'q5', '1': 'q5' }
        },
        positions: {
            'q0': { x: 140, y: 250 },
            'q1': { x: 320, y: 150 },
            'q2': { x: 320, y: 350 },
            'q3': { x: 520, y: 350 },
            'q4': { x: 520, y: 150 },
            'q5': { x: 700, y: 250 }
        },
        testCases: [
            { input: '0', expected: true },
            { input: '1', expected: true },
            { input: '01', expected: true },
            { input: '00', expected: false },
            { input: '11', expected: false }
        ]
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DFA_PRESETS;
}
