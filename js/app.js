/**
 * app.js - Main Application Orchestrator for DFA Simulator
 * Wires the mathematical DFA engine, Canvas graph, UI tables, Simulation tape,
 * Table-Filling Minimizer, Batch tester, and Audio effects.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial State & Automaton Instance
    let currentDFA = null;
    let graph = null;
    let cachedPositions = {};
    let currentBatchCases = [];
    let pendingMinimizedDFA = null;

    // Simulation Execution State
    let simString = '';
    let simPath = [];
    let currentStepIndex = -1; // -1 means ready at initial state
    let isPlaying = false;
    let playbackInterval = null;
    let playbackSpeed = 700; // ms

    // Context Menu target state
    let contextTargetState = null;

    // DOM Elements
    const canvas = document.getElementById('dfaCanvas');
    const presetSelect = document.getElementById('presetSelect');
    const transitionTable = document.getElementById('transitionTable');
    const tableHeaderRow = document.getElementById('tableHeaderRow');
    const tableBody = document.getElementById('tableBody');
    const statesContainer = document.getElementById('statesContainer');
    const alphabetContainer = document.getElementById('alphabetContainer');
    const validationBadge = document.getElementById('validationBadge');

    // 5-Tuple specs
    const tupleQ = document.getElementById('tupleQ');
    const tupleSigma = document.getElementById('tupleSigma');
    const tupleQ0 = document.getElementById('tupleQ0');
    const tupleF = document.getElementById('tupleF');

    // Tape & Simulation
    const tapeCells = document.getElementById('tapeCells');
    const simInputString = document.getElementById('simInputString');
    const btnLoadString = document.getElementById('btnLoadString');
    const btnInstantRun = document.getElementById('btnInstantRun');
    const btnStepForward = document.getElementById('btnStepForward');
    const btnStepBack = document.getElementById('btnStepBack');
    const btnPlayPause = document.getElementById('btnPlayPause');
    const btnResetSim = document.getElementById('btnResetSim');
    const speedSlider = document.getElementById('speedSlider');
    const traceInfo = document.getElementById('traceInfo');
    const simResultBadge = document.getElementById('simResultBadge');

    // Context Menu
    const contextMenu = document.getElementById('contextMenu');
    const menuToggleStart = document.getElementById('menuToggleStart');
    const menuToggleFinal = document.getElementById('menuToggleFinal');
    const menuRenameState = document.getElementById('menuRenameState');
    const menuDeleteState = document.getElementById('menuDeleteState');

    // Modals
    const minimizerModal = document.getElementById('minimizerModal');
    const minimizerModalBody = document.getElementById('minimizerModalBody');
    const btnOpenMinimizer = document.getElementById('btnOpenMinimizer');
    const btnApplyMinimizedDFA = document.getElementById('btnApplyMinimizedDFA');

    const batchModal = document.getElementById('batchModal');
    const btnOpenBatchTester = document.getElementById('btnOpenBatchTester');
    const batchTableBody = document.getElementById('batchTableBody');
    const btnRunBatchAll = document.getElementById('btnRunBatchAll');
    const btnAddBatchCase = document.getElementById('btnAddBatchCase');
    const newBatchInput = document.getElementById('newBatchInput');
    const newBatchExpected = document.getElementById('newBatchExpected');
    const batchSummary = document.getElementById('batchSummary');

    const latexModal = document.getElementById('latexModal');
    const btnOpenExportLaTeX = document.getElementById('btnOpenExportLaTeX');
    const latexCodeBox = document.getElementById('latexCodeBox');
    const btnCopyLaTeX = document.getElementById('btnCopyLaTeX');

    // Toolbar buttons
    const toolSelect = document.getElementById('toolSelect');
    const toolAddState = document.getElementById('toolAddState');
    const toolConnect = document.getElementById('toolConnect');
    const btnAutoLayout = document.getElementById('btnAutoLayout');
    const btnFitView = document.getElementById('btnFitView');
    const btnExportPNG = document.getElementById('btnExportPNG');
    const btnComplement = document.getElementById('btnComplement');
    const btnToggleAudio = document.getElementById('btnToggleAudio');
    const audioIcon = document.getElementById('audioIcon');
    const btnResetTable = document.getElementById('btnResetTable');
    const btnExportJSON = document.getElementById('btnExportJSON');
    const jsonFileInput = document.getElementById('jsonFileInput');

    // 2. Initialize Canvas Graph
    graph = new DFAGraph(canvas, null, {
        onStateClick: (state) => {
            highlightTableRow(state);
        },
        onStateDoubleClicked: (x, y) => {
            promptAddStateAt(x, y);
        },
        onStateContextMenu: (state, clientX, clientY) => {
            showContextMenu(state, clientX, clientY);
        },
        onTransitionCreated: (fromState, toState) => {
            promptCreateTransition(fromState, toState);
        },
        onGraphChanged: () => {
            // Store current positions
            for (const [name, node] of graph.nodes) {
                cachedPositions[name] = { x: node.x, y: node.y };
            }
        }
    });

    window.addEventListener('resize', () => {
        graph.handleResize();
    });

    // 3. Load Preset Automaton
    function loadPreset(presetKey) {
        if (presetKey === 'custom_blank') {
            currentDFA = new DFA(['q0'], ['0', '1'], {}, 'q0', []);
            cachedPositions = { 'q0': { x: Math.round(graph.width / 2), y: Math.round(graph.height / 2) } };
            currentBatchCases = [];
            graph.clearBackdropImage();
            graph.dfa = currentDFA;
            graph.syncWithDFA(cachedPositions);
            graph.fitView();
            simInputString.value = '';
            resetSimulation();
            updateAllUI();
            updateSimulationStatus('Blank custom DFA ready. Add states, symbols, or transitions to build your automaton.');
            return;
        }

        const preset = DFA_PRESETS[presetKey];
        if (!preset) return;

        currentDFA = new DFA(
            preset.states,
            preset.alphabet,
            preset.transitions,
            preset.initialState,
            preset.finalStates
        );

        cachedPositions = JSON.parse(JSON.stringify(preset.positions || {}));
        currentBatchCases = JSON.parse(JSON.stringify(preset.testCases || []));

        graph.dfa = currentDFA;
        graph.syncWithDFA(cachedPositions);
        graph.fitView();

        // Load default test string if available
        if (preset.testCases && preset.testCases.length > 0) {
            simInputString.value = preset.testCases[0].input;
        } else {
            simInputString.value = '';
        }

        resetSimulation();
        updateAllUI();
    }

    // 4. UI Update Master Function
    function updateAllUI() {
        if (!currentDFA) return;

        // Validation Check
        const val = currentDFA.validate();
        if (val.valid) {
            validationBadge.className = 'result-tag accepted';
            validationBadge.textContent = val.complete ? 'Valid & Complete' : 'Valid (Incomplete)';
        } else {
            validationBadge.className = 'result-tag rejected';
            validationBadge.textContent = 'Invalid DFA';
            validationBadge.title = val.errors.join('; ');
        }

        // Update 5-Tuple display
        tupleQ.textContent = `{ ${currentDFA.states.join(', ')} }`;
        tupleSigma.textContent = `{ ${currentDFA.alphabet.join(', ')} }`;
        tupleQ0.textContent = currentDFA.initialState || 'None';
        tupleF.textContent = `{ ${Array.from(currentDFA.finalStates).join(', ')} }`;

        // Update State Chips
        statesContainer.innerHTML = '';
        currentDFA.states.forEach(s => {
            const chip = document.createElement('div');
            chip.className = `state-chip ${s === currentDFA.initialState ? 'initial' : ''} ${currentDFA.isFinal(s) ? 'final' : ''}`;
            chip.innerHTML = `
                <span>${s}</span>
                <div class="chip-actions">
                    <span title="Toggle Final State" data-action="toggle-final" data-state="${s}">🎯</span>
                    <span title="Delete State" data-action="delete" data-state="${s}">✕</span>
                </div>
            `;
            statesContainer.appendChild(chip);
        });

        // Update Alphabet Chips
        alphabetContainer.innerHTML = '';
        currentDFA.alphabet.forEach(sym => {
            const chip = document.createElement('div');
            chip.className = 'state-chip';
            chip.innerHTML = `
                <span>'${sym}'</span>
                <div class="chip-actions">
                    <span title="Remove Symbol" data-action="delete-symbol" data-sym="${sym}">✕</span>
                </div>
            `;
            alphabetContainer.appendChild(chip);
        });

        // Update Transition Matrix Table
        renderTransitionTable();

        // Update active state in graph
        if (currentStepIndex === -1) {
            graph.setActiveState(currentDFA.initialState);
            graph.setActiveTransition(null);
        }
    }

    // 5. Render Transition Matrix Table
    function renderTransitionTable() {
        // Headers
        tableHeaderRow.innerHTML = '<th>δ</th>';
        currentDFA.alphabet.forEach(sym => {
            const th = document.createElement('th');
            th.textContent = sym;
            tableHeaderRow.appendChild(th);
        });

        // Rows
        tableBody.innerHTML = '';
        currentDFA.states.forEach(state => {
            const tr = document.createElement('tr');
            tr.dataset.state = state;

            // State label cell with start/final indicators
            const stateTh = document.createElement('td');
            stateTh.style.fontWeight = '700';
            stateTh.style.background = 'var(--bg-tertiary)';
            let label = state;
            if (state === currentDFA.initialState) label = '→ ' + label;
            if (currentDFA.isFinal(state)) label = '*' + label;
            stateTh.textContent = label;
            tr.appendChild(stateTh);

            // Transition input cells
            currentDFA.alphabet.forEach(sym => {
                const td = document.createElement('td');
                td.dataset.state = state;
                td.dataset.symbol = sym;

                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentDFA.transitions[state]?.[sym] || '';
                input.placeholder = '-';

                input.addEventListener('change', (e) => {
                    const target = e.target.value.trim();
                    if (target === '' || currentDFA.states.includes(target)) {
                        currentDFA.setTransition(state, sym, target || null);
                        graph.draw();
                        updateAllUI();
                    } else {
                        alert(`Target state "${target}" is not in Q. Please add it first.`);
                        e.target.value = currentDFA.transitions[state]?.[sym] || '';
                    }
                });

                td.appendChild(input);
                tr.appendChild(td);
            });

            tableBody.appendChild(tr);
        });
    }

    function highlightTableRow(stateName) {
        document.querySelectorAll('.matrix-table tr').forEach(row => {
            row.style.background = '';
        });
        const targetRow = document.querySelector(`.matrix-table tr[data-state="${stateName}"]`);
        if (targetRow) {
            targetRow.style.background = 'rgba(59, 130, 246, 0.15)';
        }
    }

    function highlightTableCell(state, symbol) {
        document.querySelectorAll('.matrix-table td').forEach(td => {
            td.classList.remove('active-cell');
        });
        const cell = document.querySelector(`.matrix-table td[data-state="${state}"][data-symbol="${symbol}"]`);
        if (cell) {
            cell.classList.add('active-cell');
        }
    }

    // 6. Simulation & Tape Logic
    function loadTape(str) {
        simString = str;
        tapeCells.innerHTML = '';

        if (simString.length === 0) {
            tapeCells.innerHTML = '<div class="tape-cell active">ε</div>';
        } else {
            for (let i = 0; i < simString.length; i++) {
                const cell = document.createElement('div');
                cell.className = 'tape-cell';
                cell.id = `tape-cell-${i}`;
                cell.textContent = simString[i];
                tapeCells.appendChild(cell);
            }
        }

        // Calculate path
        const result = currentDFA.simulate(simString);
        simPath = result.path || [];
        currentStepIndex = -1;

        updateTapeHead();
        updateSimulationStatus('Ready to simulate. Click Step or Play.');
    }

    function updateTapeHead() {
        // Update tape cells active state
        document.querySelectorAll('.tape-cell').forEach((cell, idx) => {
            cell.classList.remove('active', 'consumed');
            if (idx < currentStepIndex) {
                cell.classList.add('consumed');
            } else if (idx === currentStepIndex) {
                cell.classList.add('active');
            }
        });

        // Determine current state
        let currentState = currentDFA.initialState;
        if (currentStepIndex >= 0 && currentStepIndex < simPath.length) {
            currentState = simPath[currentStepIndex].nextState;
        }

        graph.setActiveState(currentState);

        // Active transition edge
        if (currentStepIndex >= 0 && currentStepIndex < simPath.length) {
            const stepData = simPath[currentStepIndex];
            graph.setActiveTransition(stepData.state, stepData.nextState, stepData.symbol, 1.0);
            highlightTableCell(stepData.state, stepData.symbol);
        } else {
            graph.setActiveTransition(null);
            highlightTableCell(null, null);
        }
    }

    function stepForward() {
        if (!currentDFA || !currentDFA.validate().valid) {
            alert('Cannot simulate: DFA is invalid.');
            return;
        }

        if (currentStepIndex + 1 < simString.length) {
            currentStepIndex++;
            const stepData = simPath[currentStepIndex];

            if (stepData) {
                window.soundEffects.playStep();

                // Animate traveling particle along the edge
                let p = 0;
                const animDuration = Math.min(300, playbackSpeed * 0.7);
                const startTime = performance.now();

                const runParticle = (now) => {
                    const elapsed = now - startTime;
                    p = Math.min(1.0, elapsed / animDuration);
                    graph.setActiveTransition(stepData.state, stepData.nextState, stepData.symbol, p);
                    if (p < 1.0) {
                        requestAnimationFrame(runParticle);
                    }
                };
                requestAnimationFrame(runParticle);

                updateTapeHead();
                traceInfo.innerHTML = `Step ${stepData.step}: δ(<span class="highlight">${stepData.state}</span>, '${stepData.symbol}') → <span class="highlight">${stepData.nextState}</span>`;
            }
        } else {
            // Finished tape
            finishSimulation();
        }
    }

    function stepBack() {
        if (currentStepIndex >= 0) {
            currentStepIndex--;
            updateTapeHead();

            if (currentStepIndex === -1) {
                traceInfo.innerHTML = `Back at initial state: <span class="highlight">${currentDFA.initialState}</span>`;
                simResultBadge.style.display = 'none';
            } else {
                const stepData = simPath[currentStepIndex];
                traceInfo.innerHTML = `Step ${stepData.step}: δ(<span class="highlight">${stepData.state}</span>, '${stepData.symbol}') → <span class="highlight">${stepData.nextState}</span>`;
                simResultBadge.style.display = 'none';
            }
        }
    }

    function finishSimulation() {
        pausePlayback();
        const finalState = currentStepIndex >= 0 && simPath.length > 0 ?
            simPath[simPath.length - 1].nextState : currentDFA.initialState;
        const accepted = currentDFA.isFinal(finalState);

        simResultBadge.style.display = 'inline-block';
        if (accepted) {
            simResultBadge.className = 'result-tag accepted';
            simResultBadge.textContent = `ACCEPTED (Ends in Final State ${finalState})`;
            window.soundEffects.playAccept();
        } else {
            simResultBadge.className = 'result-tag rejected';
            simResultBadge.textContent = `REJECTED (Ends in Non-Final State ${finalState})`;
            window.soundEffects.playReject();
        }

        traceInfo.innerHTML = `String consumed. Final state: <span class="highlight">${finalState}</span> (${accepted ? 'Accepting ∈ F' : 'Non-Accepting ∉ F'}).`;
    }

    function play() {
        if (isPlaying) return;
        isPlaying = true;
        btnPlayPause.textContent = '⏸ Pause';
        btnPlayPause.classList.add('active');

        if (currentStepIndex >= simString.length - 1) {
            currentStepIndex = -1;
            updateTapeHead();
        }

        playbackInterval = setInterval(() => {
            if (currentStepIndex + 1 < simString.length) {
                stepForward();
            } else {
                finishSimulation();
            }
        }, playbackSpeed);
    }

    function pausePlayback() {
        isPlaying = false;
        btnPlayPause.textContent = '▶ Play';
        btnPlayPause.classList.remove('active');
        if (playbackInterval) {
            clearInterval(playbackInterval);
            playbackInterval = null;
        }
    }

    function resetSimulation() {
        pausePlayback();
        loadTape(simInputString.value.trim());
        simResultBadge.style.display = 'none';
        traceInfo.innerHTML = `Simulation reset. Initial state: <span class="highlight">${currentDFA.initialState}</span>`;
    }

    function updateSimulationStatus(text) {
        traceInfo.innerHTML = text;
    }

    // 7. Context Menu Operations
    function showContextMenu(state, x, y) {
        contextTargetState = state;
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;

        menuToggleStart.textContent = (state === currentDFA.initialState) ?
            '✓ Initial State' : '🚩 Set as Start State';
        menuToggleFinal.textContent = currentDFA.isFinal(state) ?
            '✓ Final State (Unmark)' : '🎯 Mark as Final State';
    }

    function hideContextMenu() {
        contextMenu.style.display = 'none';
        contextTargetState = null;
    }

    window.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    menuToggleStart.addEventListener('click', () => {
        if (contextTargetState) {
            currentDFA.setInitialState(contextTargetState);
            hideContextMenu();
            updateAllUI();
            graph.draw();
        }
    });

    menuToggleFinal.addEventListener('click', () => {
        if (contextTargetState) {
            currentDFA.toggleFinalState(contextTargetState);
            hideContextMenu();
            updateAllUI();
            graph.draw();
        }
    });

    menuRenameState.addEventListener('click', () => {
        if (!contextTargetState) return;
        const newName = prompt(`Enter new name for state "${contextTargetState}":`, contextTargetState);
        if (newName && newName !== contextTargetState) {
            const success = currentDFA.renameState(contextTargetState, newName.trim());
            if (success) {
                // Update graph node mapping
                const nodeData = graph.nodes.get(contextTargetState);
                if (nodeData) {
                    graph.nodes.delete(contextTargetState);
                    graph.nodes.set(newName.trim(), nodeData);
                }
                updateAllUI();
                graph.draw();
            } else {
                alert('State name must be unique and non-empty.');
            }
        }
        hideContextMenu();
    });

    menuDeleteState.addEventListener('click', () => {
        if (contextTargetState) {
            if (confirm(`Delete state "${contextTargetState}" and all its transitions?`)) {
                currentDFA.removeState(contextTargetState);
                graph.nodes.delete(contextTargetState);
                hideContextMenu();
                updateAllUI();
                graph.draw();
            }
        }
    });

    // 8. Interactive Adding of States & Transitions
    function promptAddStateAt(x, y) {
        // Suggest name: q0, q1, q2...
        let counter = currentDFA.states.length;
        let suggestedName = `q${counter}`;
        while (currentDFA.states.includes(suggestedName)) {
            counter++;
            suggestedName = `q${counter}`;
        }

        const name = prompt('Enter new state name:', suggestedName);
        if (name && name.trim()) {
            const cleanName = name.trim();
            if (currentDFA.addState(cleanName)) {
                graph.nodes.set(cleanName, { x, y, isDragging: false });
                updateAllUI();
                graph.draw();
            } else {
                alert(`State "${cleanName}" already exists.`);
            }
        }
    }

    function promptCreateTransition(fromState, toState) {
        const availableSymbols = currentDFA.alphabet.join(', ');
        const sym = prompt(`Create transition from ${fromState} to ${toState}.\nEnter symbol (available: ${availableSymbols}):`);
        if (sym && currentDFA.alphabet.includes(sym.trim())) {
            currentDFA.setTransition(fromState, sym.trim(), toState);
            updateAllUI();
            graph.draw();
        } else if (sym) {
            alert(`Symbol "${sym}" is not in alphabet Σ.`);
        }
    }

    // 9. Minimization Visualizer Modal
    btnOpenMinimizer.addEventListener('click', () => {
        try {
            const result = DFAMinimizer.minimize(currentDFA);
            pendingMinimizedDFA = result.minimizedDFA;

            let html = `
                <div style="margin-bottom: 16px; background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <h4 style="font-size: 14px; color: var(--accent-cyan); margin-bottom: 6px;">Hopcroft / Table-Filling Minimization Results</h4>
                    <p style="font-size: 13px; color: var(--text-secondary);">
                        Original states: <strong>${currentDFA.states.length}</strong> | 
                        Minimized states: <strong>${result.minimizedDFA.states.length}</strong> | 
                        Reduction: <strong>${result.reductionCount} state(s) saved!</strong>
                    </p>
                    ${result.unreachableStates.length > 0 ? 
                        `<p style="font-size: 12px; color: var(--accent-amber); margin-top: 4px;">Removed unreachable states: { ${result.unreachableStates.join(', ')} }</p>` : 
                        '<p style="font-size: 12px; color: var(--accent-green); margin-top: 4px;">All states are reachable from start state.</p>'}
                </div>

                <h4 style="font-size: 13px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
                    Distinguishing Pairs Table (Myhill-Nerode Matrix):
                </h4>
                <div style="overflow-x: auto; margin-bottom: 16px;">
            `;

            // Build Triangular Table
            const states = result.reachableStates;
            html += '<table class="min-table"><thead><tr><th></th>';
            for (let i = 0; i < states.length - 1; i++) {
                html += `<th>${states[i]}</th>`;
            }
            html += '</tr></thead><tbody>';

            for (let i = 1; i < states.length; i++) {
                html += `<tr><th>${states[i]}</th>`;
                for (let j = 0; j < states.length - 1; j++) {
                    if (j < i) {
                        const [p, q] = [states[i], states[j]].sort();
                        const key = `${p}|${q}`;
                        const cell = result.table[key];
                        if (cell && cell.marked) {
                            html += `<td class="marked-cell" title="${cell.reason}">X<sub>${cell.iteration}</sub></td>`;
                        } else {
                            html += `<td class="unmarked-cell" title="Equivalent states (cannot be distinguished)">=</td>`;
                        }
                    } else {
                        html += '<td class="empty-cell"></td>';
                    }
                }
                html += '</tr>';
            }
            html += '</tbody></table></div>';

            // Equivalence Classes
            html += `
                <div style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <h4 style="font-size: 13px; font-weight: 700; color: var(--accent-blue); margin-bottom: 6px;">Equivalence Partitions:</h4>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${result.equivalenceClasses.map(eq => `<span class="state-chip" style="border-color: var(--accent-blue);">{ ${eq.join(', ')} }</span>`).join('')}
                    </div>
                </div>
            `;

            minimizerModalBody.innerHTML = html;
            minimizerModal.classList.add('open');
        } catch (err) {
            alert(`Minimization error: ${err.message}`);
        }
    });

    btnApplyMinimizedDFA.addEventListener('click', () => {
        if (pendingMinimizedDFA) {
            currentDFA = pendingMinimizedDFA;
            graph.dfa = currentDFA;
            graph.syncWithDFA({});
            graph.autoLayout();
            updateAllUI();
            resetSimulation();
            minimizerModal.classList.remove('open');
            alert('Minimized DFA applied successfully to simulator!');
        }
    });

    // 10. Batch String Testing Modal
    btnOpenBatchTester.addEventListener('click', () => {
        renderBatchTable();
        batchModal.classList.add('open');
    });

    function renderBatchTable() {
        batchTableBody.innerHTML = '';
        currentBatchCases.forEach((tc, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td><code style="color: var(--accent-cyan);">${tc.input === '' ? 'ε (empty)' : tc.input}</code></td>
                <td><span class="result-tag ${tc.expected ? 'accepted' : 'rejected'}">${tc.expected ? 'ACCEPT' : 'REJECT'}</span></td>
                <td id="batch-actual-${idx}">-</td>
                <td id="batch-status-${idx}">Pending</td>
                <td><button class="btn" data-delete-idx="${idx}" style="padding: 2px 6px; font-size: 10px;">✕</button></td>
            `;
            batchTableBody.appendChild(tr);
        });
        batchSummary.textContent = `${currentBatchCases.length} test case(s) loaded.`;
    }

    btnRunBatchAll.addEventListener('click', () => {
        let passed = 0;
        currentBatchCases.forEach((tc, idx) => {
            const res = currentDFA.simulate(tc.input);
            const actualTd = document.getElementById(`batch-actual-${idx}`);
            const statusTd = document.getElementById(`batch-status-${idx}`);

            actualTd.innerHTML = `<span class="result-tag ${res.accepted ? 'accepted' : 'rejected'}">${res.accepted ? 'ACCEPT' : 'REJECT'}</span>`;

            if (res.accepted === tc.expected) {
                passed++;
                statusTd.innerHTML = '<span style="color: var(--accent-green); font-weight: 700;">✓ PASS</span>';
            } else {
                statusTd.innerHTML = '<span style="color: var(--accent-red); font-weight: 700;">✗ FAIL</span>';
            }
        });
        batchSummary.innerHTML = `Results: <span style="color: ${passed === currentBatchCases.length ? 'var(--accent-green)' : 'var(--accent-amber)'}; font-weight: 700;">${passed} / ${currentBatchCases.length} Passed</span>`;
    });

    btnAddBatchCase.addEventListener('click', () => {
        const inputVal = newBatchInput.value.trim();
        const expectedVal = (newBatchExpected.value === 'true');
        currentBatchCases.push({ input: inputVal, expected: expectedVal });
        newBatchInput.value = '';
        renderBatchTable();
    });

    batchTableBody.addEventListener('click', (e) => {
        if (e.target.dataset.deleteIdx !== undefined) {
            const idx = parseInt(e.target.dataset.deleteIdx, 10);
            currentBatchCases.splice(idx, 1);
            renderBatchTable();
        }
    });

    // 11. LaTeX / Formal Report Modal
    btnOpenExportLaTeX.addEventListener('click', () => {
        latexCodeBox.textContent = currentDFA.toLaTeX();
        latexModal.classList.add('open');
    });

    btnCopyLaTeX.addEventListener('click', () => {
        navigator.clipboard.writeText(latexCodeBox.textContent).then(() => {
            btnCopyLaTeX.textContent = '✓ Copied!';
            setTimeout(() => { btnCopyLaTeX.textContent = 'Copy LaTeX Code'; }, 1800);
        });
    });

    // Modal Close buttons
    document.querySelectorAll('.closeModalBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.classList.remove('open');
            });
        });
    });

    // 12. Toolbar & Header Actions
    toolSelect.addEventListener('click', () => {
        setActiveTool(toolSelect, 'select');
    });

    toolAddState.addEventListener('click', () => {
        setActiveTool(toolAddState, 'add-state');
    });

    toolConnect.addEventListener('click', () => {
        setActiveTool(toolConnect, 'connect');
    });

    function setActiveTool(btn, mode) {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        graph.setMode(mode);
    }

    btnAutoLayout.addEventListener('click', () => {
        graph.autoLayout();
    });

    btnFitView.addEventListener('click', () => {
        graph.fitView();
    });

    btnExportPNG.addEventListener('click', () => {
        graph.exportPNG();
    });

    btnComplement.addEventListener('click', () => {
        currentDFA = currentDFA.complement();
        graph.dfa = currentDFA;
        updateAllUI();
        graph.draw();
        alert('DFA complemented: Final states swapped (Q \\ F).');
    });

    btnToggleAudio.addEventListener('click', () => {
        const enabled = window.soundEffects.toggle();
        audioIcon.textContent = enabled ? '🔊' : '🔇';
    });

    // Reset Table Transitions
    if (btnResetTable) {
        btnResetTable.addEventListener('click', () => {
            if (confirm('Clear all transitions in the matrix?')) {
                for (const s of currentDFA.states) {
                    currentDFA.transitions[s] = {};
                }
                updateAllUI();
                graph.draw();
            }
        });
    }

    // Export JSON
    if (btnExportJSON) {
        btnExportJSON.addEventListener('click', () => {
            const data = currentDFA.toJSON();
            data.positions = {};
            for (const [name, node] of graph.nodes) {
                data.positions[name] = { x: Math.round(node.x), y: Math.round(node.y) };
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dfa_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // Import JSON
    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    currentDFA = DFA.fromJSON(data);
                    cachedPositions = data.positions || {};
                    currentBatchCases = data.testCases || [];
                    graph.dfa = currentDFA;
                    graph.syncWithDFA(cachedPositions);
                    graph.fitView();
                    resetSimulation();
                    updateAllUI();
                    alert(`Loaded DFA "${data.name || 'Custom DFA'}" successfully!`);
                } catch (err) {
                    alert('Invalid JSON file format: ' + err.message);
                }
            };
            reader.readAsText(file);
            e.target.value = ''; // Reset input
        });
    }

    // State & Alphabet side actions
    document.getElementById('btnAddState').addEventListener('click', () => {
        const input = document.getElementById('newStateInput');
        const name = input.value.trim();
        if (name) {
            if (currentDFA.addState(name)) {
                graph.syncWithDFA({});
                updateAllUI();
                input.value = '';
            } else {
                alert(`State "${name}" already exists.`);
            }
        }
    });

    document.getElementById('btnAddSymbol').addEventListener('click', () => {
        const input = document.getElementById('newSymbolInput');
        const sym = input.value.trim();
        if (sym && sym.length === 1) {
            if (currentDFA.addSymbol(sym)) {
                updateAllUI();
                input.value = '';
                graph.draw();
            } else {
                alert(`Symbol "${sym}" already exists in alphabet.`);
            }
        }
    });

    statesContainer.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const state = e.target.dataset.state;
        if (!state) return;

        if (action === 'toggle-final') {
            currentDFA.toggleFinalState(state);
            updateAllUI();
            graph.draw();
        } else if (action === 'delete') {
            if (confirm(`Delete state "${state}"?`)) {
                currentDFA.removeState(state);
                graph.nodes.delete(state);
                updateAllUI();
                graph.draw();
            }
        }
    });

    alphabetContainer.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const sym = e.target.dataset.sym;
        if (action === 'delete-symbol' && sym) {
            if (confirm(`Remove symbol "${sym}" from alphabet?`)) {
                currentDFA.removeSymbol(sym);
                updateAllUI();
                graph.draw();
            }
        }
    });

    // Preset selector event
    presetSelect.addEventListener('change', (e) => {
        loadPreset(e.target.value);
    });

    // Playback control events
    btnLoadString.addEventListener('click', () => {
        loadTape(simInputString.value.trim());
    });

    btnInstantRun.addEventListener('click', () => {
        loadTape(simInputString.value.trim());
        // Run all steps to end immediately
        while (currentStepIndex + 1 < simString.length) {
            currentStepIndex++;
        }
        updateTapeHead();
        finishSimulation();
    });

    btnStepForward.addEventListener('click', stepForward);
    btnStepBack.addEventListener('click', stepBack);
    btnPlayPause.addEventListener('click', () => {
        if (isPlaying) pausePlayback();
        else play();
    });
    btnResetSim.addEventListener('click', resetSimulation);

    speedSlider.addEventListener('input', (e) => {
        // Invert so right slider = faster
        playbackSpeed = 2000 - parseInt(e.target.value, 10);
        if (isPlaying) {
            pausePlayback();
            play();
        }
    });

    // ==========================================
    // 13. Universal Image Scanner (Implicit Vision Engine)
    // ==========================================
    const imageModal = document.getElementById('imageModal');
    const btnOpenImageModal = document.getElementById('btnOpenImageModal');
    const imageDropZone = document.getElementById('imageDropZone');
    const dfaImageInput = document.getElementById('dfaImageInput');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const btnRemoveImage = document.getElementById('btnRemoveImage');
    const chkBackdropOverlay = document.getElementById('chkBackdropOverlay');
    const aiScanStatus = document.getElementById('aiScanStatus');
    const btnApplyImageDFA = document.getElementById('btnApplyImageDFA');
    const visionStatusBadge = document.getElementById('visionStatusBadge');
    const visionAlphabetSelect = document.getElementById('visionAlphabetSelect');

    let currentImageDataUrl = null;
    let currentImageElement = null;
    let extractedImageDFA = null;

    if (btnOpenImageModal) {
        btnOpenImageModal.addEventListener('click', () => {
            imageModal.classList.add('open');
        });
    }

    if (imageDropZone && dfaImageInput) {
        imageDropZone.addEventListener('click', () => dfaImageInput.click());

        imageDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageDropZone.style.borderColor = 'var(--accent-blue)';
            imageDropZone.style.background = 'rgba(59, 130, 246, 0.1)';
        });

        imageDropZone.addEventListener('dragleave', () => {
            imageDropZone.style.borderColor = 'var(--border-hover)';
            imageDropZone.style.background = 'var(--bg-primary)';
        });

        imageDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            imageDropZone.style.borderColor = 'var(--border-hover)';
            imageDropZone.style.background = 'var(--bg-primary)';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleImageFile(e.dataTransfer.files[0]);
            }
        });

        dfaImageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleImageFile(e.target.files[0]);
            }
        });
    }

    // Global Clipboard Paste (Ctrl+V) for instant diagram scanning
    window.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                handleImageFile(blob);
                imageModal.classList.add('open');
                break;
            }
        }
    });

    function handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file (PNG, JPG, WebP).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            currentImageDataUrl = e.target.result;
            imagePreview.src = currentImageDataUrl;
            imagePreviewContainer.style.display = 'block';
            imageDropZone.style.display = 'none';

            currentImageElement = new Image();
            currentImageElement.onload = () => {
                // Automatically run implicit computer vision analysis
                runImplicitVisionScan(currentImageElement);
            };
            currentImageElement.src = currentImageDataUrl;
        };
        reader.readAsDataURL(file);
    }

    function runImplicitVisionScan(img) {
        if (!img) return;

        if (visionStatusBadge) {
            visionStatusBadge.textContent = 'Scanning...';
            visionStatusBadge.style.color = 'var(--accent-cyan)';
        }
        aiScanStatus.innerHTML = '<span style="color: var(--accent-cyan);">⚡ Analyzing diagram contours, circle nodes, start arrow & final concentric rings...</span>';

        setTimeout(() => {
            try {
                // Run built-in pure JavaScript computer vision scanner
                const result = DFAVisionScanner.scan(img);

                // Apply selected alphabet preference
                if (visionAlphabetSelect) {
                    const symbols = visionAlphabetSelect.value.split(',');
                    result.alphabet = symbols;
                    for (const s of result.states) {
                        const oldRow = result.transitions[s] || {};
                        result.transitions[s] = {};
                        symbols.forEach((sym, idx) => {
                            const origKeys = Object.keys(oldRow);
                            result.transitions[s][sym] = oldRow[origKeys[idx % origKeys.length]] || s;
                        });
                    }
                }

                extractedImageDFA = result;

                if (visionStatusBadge) {
                    visionStatusBadge.textContent = 'Detected ✓';
                    visionStatusBadge.style.color = 'var(--accent-green)';
                }

                aiScanStatus.innerHTML = `
                    <div style="color: var(--accent-green); font-weight: 700; margin-bottom: 6px;">✓ Diagram Successfully Recognized!</div>
                    <div style="color: var(--text-primary); margin-bottom: 2px;">• States Found: <strong>{ ${result.states.join(', ')} }</strong> (${result.states.length} states)</div>
                    <div style="color: var(--text-secondary); margin-bottom: 2px;">• Start State: <strong>${result.initialState}</strong> (incoming arrow detected)</div>
                    <div style="color: var(--text-secondary); margin-bottom: 2px;">• Final State(s): <strong>{ ${result.finalStates.join(', ')} }</strong> (concentric rings detected)</div>
                    <div style="color: var(--text-secondary); margin-bottom: 2px;">• Alphabet: <strong>{ ${result.alphabet.join(', ')} }</strong></div>
                    <div style="color: var(--accent-cyan); font-weight: 600; margin-top: 8px;">Ready! Click "Load DFA into Simulator" below to begin testing strings.</div>
                `;

                if (btnApplyImageDFA) {
                    btnApplyImageDFA.disabled = false;
                }
            } catch (err) {
                if (visionStatusBadge) {
                    visionStatusBadge.textContent = 'Error';
                    visionStatusBadge.style.color = 'var(--accent-red)';
                }
                aiScanStatus.innerHTML = `<span style="color: var(--accent-red);">Vision Scanner Error: ${err.message}</span>`;
            }
        }, 120);
    }

    if (visionAlphabetSelect) {
        visionAlphabetSelect.addEventListener('change', () => {
            if (currentImageElement) {
                runImplicitVisionScan(currentImageElement);
            }
        });
    }

    if (btnRemoveImage) {
        btnRemoveImage.addEventListener('click', () => {
            currentImageDataUrl = null;
            currentImageElement = null;
            extractedImageDFA = null;
            imagePreview.src = '';
            imagePreviewContainer.style.display = 'none';
            imageDropZone.style.display = 'block';
            dfaImageInput.value = '';
            if (btnApplyImageDFA) btnApplyImageDFA.disabled = true;
            if (visionStatusBadge) {
                visionStatusBadge.textContent = 'Ready';
                visionStatusBadge.style.color = 'var(--accent-blue)';
            }
            aiScanStatus.textContent = 'Drop or paste a DFA image on the left. The built-in vision engine will automatically detect circles, arrows, and double concentric accepting states.';
        });
    }

    if (btnApplyImageDFA) {
        btnApplyImageDFA.addEventListener('click', () => {
            if (!extractedImageDFA) return;

            currentDFA = DFA.fromJSON(extractedImageDFA);

            // Map percentage positions to canvas coordinate system
            cachedPositions = {};
            const padW = graph.width * 0.15;
            const padH = graph.height * 0.2;
            const availW = graph.width - padW * 2;
            const availH = graph.height - padH * 2;

            if (extractedImageDFA.positions) {
                for (const s of currentDFA.states) {
                    if (extractedImageDFA.positions[s]) {
                        const px = extractedImageDFA.positions[s].x;
                        const py = extractedImageDFA.positions[s].y;
                        cachedPositions[s] = {
                            x: Math.round(padW + (px / 100) * availW),
                            y: Math.round(padH + (py / 100) * availH)
                        };
                    }
                }
            }

            // Set background overlay if checkbox checked
            if (chkBackdropOverlay.checked && currentImageElement) {
                graph.setBackdropImage(currentImageElement, 0.32);
            } else {
                graph.clearBackdropImage();
            }

            graph.dfa = currentDFA;
            graph.syncWithDFA(cachedPositions);
            graph.fitView();
            resetSimulation();
            updateAllUI();

            imageModal.classList.remove('open');
            alert(`DFA "${extractedImageDFA.name || 'Scanned Diagram'}" loaded! You can now simulate strings and test it.`);
        });
    }

    // ==========================================
    // 14. Universal Text Spec Importer
    // ==========================================
    const textSpecModal = document.getElementById('textSpecModal');
    const btnOpenTextModal = document.getElementById('btnOpenTextModal');
    const textSpecInput = document.getElementById('textSpecInput');
    const textSpecError = document.getElementById('textSpecError');
    const btnApplyTextSpec = document.getElementById('btnApplyTextSpec');

    if (btnOpenTextModal) {
        btnOpenTextModal.addEventListener('click', () => {
            textSpecError.style.display = 'none';
            textSpecModal.classList.add('open');
        });
    }

    if (btnApplyTextSpec) {
        btnApplyTextSpec.addEventListener('click', () => {
            try {
                const text = textSpecInput.value;
                const lines = text.split('\n');

                let states = [];
                let alphabet = [];
                let initialState = '';
                let finalStates = [];
                const transitions = {};
                let inDelta = false;

                for (let line of lines) {
                    line = line.trim();
                    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

                    const lower = line.toLowerCase();
                    if (lower.startsWith('q:') || lower.startsWith('states:')) {
                        const parts = line.split(':')[1].split(',');
                        states = parts.map(s => s.trim()).filter(Boolean);
                    } else if (lower.startsWith('sigma:') || lower.startsWith('alphabet:')) {
                        const parts = line.split(':')[1].split(',');
                        alphabet = parts.map(a => a.trim()).filter(Boolean);
                    } else if (lower.startsWith('q0:') || lower.startsWith('start:') || lower.startsWith('initial:')) {
                        initialState = line.split(':')[1].trim();
                    } else if (lower.startsWith('f:') || lower.startsWith('final:') || lower.startsWith('accept:')) {
                        const parts = line.split(':')[1].split(',');
                        finalStates = parts.map(f => f.trim()).filter(Boolean);
                    } else if (lower.startsWith('delta:') || lower.startsWith('transitions:')) {
                        inDelta = true;
                    } else if (inDelta || line.includes('->') || line.includes(',')) {
                        // Pattern: q0, 0 -> q1 OR q0 0 q1
                        let fromState = '', sym = '', toState = '';
                        if (line.includes('->')) {
                            const [left, right] = line.split('->');
                            toState = right.trim();
                            const leftParts = left.split(',');
                            if (leftParts.length === 2) {
                                fromState = leftParts[0].trim();
                                sym = leftParts[1].trim();
                            } else {
                                const spaceParts = left.trim().split(/\s+/);
                                fromState = spaceParts[0];
                                sym = spaceParts[1];
                            }
                        } else {
                            const parts = line.replace(/,/g, ' ').split(/\s+/);
                            if (parts.length >= 3) {
                                fromState = parts[0].trim();
                                sym = parts[1].trim();
                                toState = parts[2].trim();
                            }
                        }

                        if (fromState && sym && toState) {
                            if (!transitions[fromState]) transitions[fromState] = {};
                            transitions[fromState][sym] = toState;
                        }
                    }
                }

                if (states.length === 0) throw new Error('No states defined. Specify "Q: q0, q1, ..."');
                if (alphabet.length === 0) throw new Error('No alphabet defined. Specify "Sigma: 0, 1"');
                if (!initialState) initialState = states[0];

                const newDFA = new DFA(states, alphabet, transitions, initialState, finalStates);
                const val = newDFA.validate();
                if (!val.valid) {
                    throw new Error(val.errors.join('; '));
                }

                currentDFA = newDFA;
                graph.clearBackdropImage();
                graph.dfa = currentDFA;
                graph.syncWithDFA({});
                graph.autoLayout();
                resetSimulation();
                updateAllUI();

                textSpecModal.classList.remove('open');
                alert('DFA imported and loaded successfully from text specification!');
            } catch (err) {
                textSpecError.textContent = 'Syntax Error: ' + err.message;
                textSpecError.style.display = 'block';
            }
        });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        if (e.code === 'Space') {
            e.preventDefault();
            if (isPlaying) pausePlayback();
            else play();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            stepForward();
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            stepBack();
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            resetSimulation();
        } else if (e.code === 'Escape') {
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.classList.remove('open');
            });
            hideContextMenu();
        }
    });

    // Initialize with first preset
    loadPreset('ends_with_01');
});

