# Deterministic Finite Automaton (DFA) Simulator

> **Course**: Theory of Automata / Formal Languages & Automata Theory (FLAT / TOC)  
> **Project**: Interactive DFA Simulator, Step-by-Step Execution Engine & Table-Filling Minimizer  
> **Author**: Automata Student / DeepMind Antigravity Pair

---

## 1. Overview & Theoretical Background

A **Deterministic Finite Automaton (DFA)** is a 5-tuple:
$$M = (Q, \Sigma, \delta, q_0, F)$$

Where:
- $Q$: Finite set of internal states
- $\Sigma$: Finite set of input symbols (alphabet)
- $\delta: Q \times \Sigma \to Q$: State transition function
- $q_0 \in Q$: Unique start / initial state
- $F \subseteq Q$: Set of accepting / final states

### Extended Transition Function $\hat{\delta}$
The language recognized by $M$, denoted $L(M)$, is defined as:
$$L(M) = \{ w \in \Sigma^* \mid \hat{\delta}(q_0, w) \in F \}$$

Where $\hat{\delta}$ is recursively defined as:
1. $\hat{\delta}(q, \epsilon) = q$
2. $\hat{\delta}(q, wa) = \delta(\hat{\delta}(q, w), a)$ for $w \in \Sigma^*, a \in \Sigma$

---

## 2. Key Features

### 🌟 Ultra-Interactive Frontend & Universal Automata Creation
- **📷 Universal Diagram Image Scanner (Image-to-DFA)**:
  - Upload or paste (`Ctrl+V`) a screenshot, photo, or drawing of **any DFA state diagram** from your textbook or assignment.
  - Powered by Gemini Vision to automatically extract:
    - State set $Q$
    - Alphabet $\Sigma$
    - Start state $q_0$ (detected from incoming start arrows)
    - Final states $F$ (detected from double concentric rings)
    - Full transition function $\delta$
  - **Backdrop Overlay Mode**: Keep the uploaded textbook image as a semi-transparent canvas backdrop so you can see your interactive states aligned directly over the original diagram!
- **🔤 Universal Text Specification Importer**:
  - Quickly type or paste formal definitions in plain text (e.g. `Q: q0, q1`, `Sigma: 0, 1`, `q0, 0 -> q1`) to instantly build any DFA.
- **✨ Blank Custom DFA Builder**:
  - Start completely from scratch with an empty canvas and build any arbitrary machine by adding states, alphabet symbols, and dragging transition arrows.
- **Canvas State Diagram**:
  - Drag-and-drop state positioning with fluid 60fps animations.
  - Initial state incoming arrow ($\to q_0$), double circles for final states ($\odot$), and antiparallel curved arcs to prevent edge overlap.
  - Self-loop geometry with labeled badges.
  - Right-click context menu on any state: **Set as Start State**, **Toggle Final State**, **Rename**, and **Delete**.
  - Direct canvas editing: double-click to add a new state, or use "Connect" mode to draw transitions interactively.
  - Smooth mouse wheel zoom (centered at cursor) and pan with an elegant dot grid.
- **Physical Input Tape & Step-by-Step Playback**:
  - Live animated pointer head moving across tape cells.
  - Glowing active state aura and traveling particle pulse along transition curves.
  - Play, Pause, Step Forward (`→`), Step Backward (`←`), Reset (`R`), and variable speed slider.
- **Synthesized Web Audio Effects**:
  - Mechanical clicks on transitions, triumphant chord on acceptance, buzzer on rejection (100% Web Audio API, no external audio files).

### ⚡ Advanced Automata Theory Algorithms (A+ Grade Features)
- **Hopcroft / Table-Filling (Myhill-Nerode) Minimization**:
  - Unreachable state detection and elimination via BFS.
  - Interactive lower-triangular distinguishing table ($X_k$ steps).
  - Equivalence class partitioning ($[q]$).
  - One-click "Apply Minimized DFA" back to the canvas.
- **Automaton Complementation**:
  - Inverts the accepted language ($\bar{L} = \Sigma^* \setminus L(M)$) by swapping final and non-final states ($Q \setminus F$).
- **Batch String Tester**:
  - Test suites of strings simultaneously with instant pass/fail validation.
- **LaTeX / Lab Report Exporter**:
  - Generates ready-to-paste LaTeX tables and 5-tuple mathematical specifications for lab reports.

---

## 3. Project Directory Structure

```text
DFA Simulator/
├── index.html               # Main interactive application (Open in browser)
├── css/
│   └── styles.css           # Modern dark-theme glassmorphism styling
├── js/
│   ├── dfa.js               # Mathematical 5-tuple engine & validation
│   ├── graph.js             # High-DPI Canvas renderer & interaction engine
│   ├── minimization.js      # Table-filling minimization algorithm
│   ├── presets.js           # Standard textbook automata library
│   ├── audio.js             # Web Audio sound synthesizer
│   └── app.js               # UI controller & simulation manager
├── python/
│   ├── dfa_engine.py        # Standalone Python DFA mathematical engine
│   ├── cli.py               # Interactive terminal CLI runner
│   └── test_dfa.py          # Comprehensive formal verification unit test suite
├── examples/
│   ├── ends_with_01.json
│   ├── divisible_by_3.json
│   └── even_zeros_ones.json
└── README.md                # Project documentation & manual
```

---

## 4. How to Run the Simulator

### Option 1: Browser Interactive UI (Recommended)
1. Simply double-click `index.html` in Windows Explorer to open it in **Google Chrome**, **Microsoft Edge**, or **Firefox**.
2. Or run a lightweight local server:
   ```powershell
   python -m http.server 8000
   ```
   Then open `http://localhost:8000` in your browser.

### Option 2: Python Command-Line Interface (CLI)
Run the interactive terminal simulator:
```powershell
python python/cli.py
```

### Option 3: Formal Verification Unit Tests
Run the automated test suite to mathematically verify determinism, minimization equivalence, and string acceptance:
```powershell
python python/test_dfa.py
```

---

## 5. Built-in Textbook Presets

1. **Strings Ending with `01`**: $L = \{ w \in \{0, 1\}^* \mid w \text{ ends with } 01 \}$
2. **Contains Substring `101`**: $L = \{ w \in \{0, 1\}^* \mid w = x101y \text{ for } x, y \in \{0, 1\}^* \}$
3. **Binary Number Divisible by 3**: Accepts binary representations of integers $n$ where $n \pmod 3 == 0$.
4. **Even Number of 0s and 1s**: Parity state grid ($\{q_{EE}, q_{OE}, q_{EO}, q_{OO}\}$).
5. **Starts and Ends with the Same Letter**: Non-empty strings over $\{a, b\}$.
6. **Minimization Demo**: A 6-state textbook DFA with redundant states that reduces to a minimal 3-state machine.

---

## 6. Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Play / Pause Simulation |
| `Right Arrow` | Step Forward |
| `Left Arrow` | Step Backward |
| `R` | Reset Simulation |
| `Escape` | Close Modal Windows |

---

## 7. Academic Verification & Correctness

All components have been rigorously verified against standard Automata Theory criteria (Hopcroft, Motwani & Ullman, *Introduction to Automata Theory, Languages, and Computation*):
- Extended transition function computation: verified by `test_dfa.py`.
- DFA Minimization: verified by language equivalence assertions over random strings ($L(M) \equiv L(M_{min})$).
- Complementation correctness: verified by asserting $w \in L(M) \iff w \notin L(\bar{M})$.

