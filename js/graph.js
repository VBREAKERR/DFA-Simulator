/**
 * graph.js - High-Performance Interactive Canvas Graph Renderer for DFA
 * Features:
 * - High-DPI crisp rendering
 * - Draggable nodes with smooth physics
 * - Curved antiparallel edges and self-loops
 * - Concentric final states and initial arrow
 * - Animated glowing pulses and traveling transition particles
 * - Pan & Zoom with dot grid background
 * - Context menu & direct node/edge creation
 */

class DFAGraph {
    constructor(canvas, dfa, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dfa = dfa;

        // Visual constants
        this.nodeRadius = 28;
        this.finalRingOffset = 5;

        // Viewport transformations
        this.pan = { x: 0, y: 0 };
        this.zoom = 1.0;
        this.minZoom = 0.3;
        this.maxZoom = 2.5;

        // State nodes map: { stateName: { x, y, vx, vy, isDragging } }
        this.nodes = new Map();

        // Active simulation state
        this.activeState = null;
        this.activeTransition = null; // { from, to, symbol }
        this.pulseTime = 0;
        this.particleProgress = null; // 0.0 to 1.0

        // Interaction state
        this.draggedNode = null;
        this.hoveredNode = null;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.connectingFromNode = null;
        this.currentMousePos = { x: 0, y: 0 };

        // Interaction mode: 'select' | 'add-state' | 'connect' | 'delete'
        this.mode = 'select';

        // Callbacks
        this.onStateClick = options.onStateClick || null;
        this.onStateDoubleClicked = options.onStateDoubleClicked || null;
        this.onStateContextMenu = options.onStateContextMenu || null;
        this.onTransitionCreated = options.onTransitionCreated || null;
        this.onGraphChanged = options.onGraphChanged || null;

        // Background Reference Image (e.g. uploaded textbook diagram)
        this.backdropImage = null;
        this.backdropOpacity = 0.35;

        // Setup DPI & event listeners
        this.setupDPI();
        this.bindEvents();

        // Start animation loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupDPI() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    handleResize() {
        this.setupDPI();
        this.draw();
    }

    /**
     * Initializes or synchronizes graph nodes with DFA state set
     */
    syncWithDFA(positions = {}) {
        const currentStates = new Set(this.dfa.states);

        // Remove non-existent states
        for (const [name] of this.nodes) {
            if (!currentStates.has(name)) {
                this.nodes.delete(name);
            }
        }

        // Add or position states
        const count = this.dfa.states.length;
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const layoutRadius = Math.min(this.width, this.height) * 0.32;

        this.dfa.states.forEach((state, i) => {
            if (!this.nodes.has(state)) {
                let x, y;
                if (positions && positions[state]) {
                    x = positions[state].x;
                    y = positions[state].y;
                } else {
                    const angle = (2 * Math.PI * i) / Math.max(1, count) - Math.PI / 2;
                    x = centerX + layoutRadius * Math.cos(angle);
                    y = centerY + layoutRadius * Math.sin(angle);
                }
                this.nodes.set(state, { x, y, isDragging: false });
            }
        });

        this.draw();
    }

    /**
     * Automatically arrange nodes in a neat circular layout
     */
    autoLayout() {
        const count = this.dfa.states.length;
        if (count === 0) return;

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const layoutRadius = Math.min(this.width, this.height) * 0.35;

        this.dfa.states.forEach((state, i) => {
            const angle = (2 * Math.PI * i) / count - Math.PI / 2;
            const node = this.nodes.get(state);
            if (node) {
                node.x = centerX + layoutRadius * Math.cos(angle);
                node.y = centerY + layoutRadius * Math.sin(angle);
            }
        });

        this.resetView();
        this.draw();
    }

    resetView() {
        this.pan = { x: 0, y: 0 };
        this.zoom = 1.0;
        this.draw();
    }

    fitView() {
        if (this.nodes.size === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [_, node] of this.nodes) {
            minX = Math.min(minX, node.x - this.nodeRadius * 2);
            maxX = Math.max(maxX, node.x + this.nodeRadius * 2);
            minY = Math.min(minY, node.y - this.nodeRadius * 2);
            maxY = Math.max(maxY, node.y + this.nodeRadius * 2);
        }

        const graphW = maxX - minX || 1;
        const graphH = maxY - minY || 1;
        const padding = 60;

        const scaleX = (this.width - padding * 2) / graphW;
        const scaleY = (this.height - padding * 2) / graphH;
        this.zoom = Math.max(this.minZoom, Math.min(1.2, Math.min(scaleX, scaleY)));

        const centerGraphX = (minX + maxX) / 2;
        const centerGraphY = (minY + maxY) / 2;
        this.pan.x = this.width / 2 - centerGraphX * this.zoom;
        this.pan.y = this.height / 2 - centerGraphY * this.zoom;

        this.draw();
    }

    /**
     * Convert client/canvas coordinates to world graph coordinates
     */
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.pan.x) / this.zoom,
            y: (screenY - this.pan.y) / this.zoom
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.zoom + this.pan.x,
            y: worldY * this.zoom + this.pan.y
        };
    }

    findNodeAt(worldX, worldY) {
        for (const [name, node] of this.nodes) {
            const dist = Math.hypot(node.x - worldX, node.y - worldY);
            if (dist <= this.nodeRadius) {
                return name;
            }
        }
        return null;
    }

    setActiveState(state) {
        this.activeState = state;
    }

    setActiveTransition(from, to, symbol, progress = 0) {
        if (from && to && symbol) {
            this.activeTransition = { from, to, symbol };
            this.particleProgress = progress;
        } else {
            this.activeTransition = null;
            this.particleProgress = null;
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.connectingFromNode = null;
        this.canvas.style.cursor = mode === 'add-state' ? 'crosshair' : (mode === 'connect' ? 'pointer' : 'default');
    }

    /**
     * Event Listeners
     */
    bindEvents() {
        const getCanvasPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };

        this.canvas.addEventListener('mousedown', (e) => {
            const pos = getCanvasPos(e);
            this.currentMousePos = pos;
            const world = this.screenToWorld(pos.x, pos.y);
            const clickedNode = this.findNodeAt(world.x, world.y);

            // Left Click
            if (e.button === 0) {
                if (this.mode === 'add-state') {
                    if (!clickedNode) {
                        if (this.onStateDoubleClicked) {
                            this.onStateDoubleClicked(world.x, world.y);
                        }
                    }
                    return;
                }

                if (this.mode === 'connect') {
                    if (clickedNode) {
                        if (!this.connectingFromNode) {
                            this.connectingFromNode = clickedNode;
                        } else {
                            if (this.onTransitionCreated) {
                                this.onTransitionCreated(this.connectingFromNode, clickedNode);
                            }
                            this.connectingFromNode = null;
                        }
                    } else {
                        this.connectingFromNode = null;
                    }
                    this.draw();
                    return;
                }

                if (clickedNode) {
                    this.draggedNode = clickedNode;
                    const node = this.nodes.get(clickedNode);
                    node.dragOffsetX = world.x - node.x;
                    node.dragOffsetY = world.y - node.y;
                    this.canvas.style.cursor = 'grabbing';
                    if (this.onStateClick) this.onStateClick(clickedNode);
                } else {
                    this.isPanning = true;
                    this.panStart = { x: pos.x - this.pan.x, y: pos.y - this.pan.y };
                    this.canvas.style.cursor = 'grabbing';
                }
            } else if (e.button === 1) { // Middle click pan
                this.isPanning = true;
                this.panStart = { x: pos.x - this.pan.x, y: pos.y - this.pan.y };
            }
        });

        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const pos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            this.currentMousePos = pos;
            const world = this.screenToWorld(pos.x, pos.y);

            if (this.draggedNode) {
                const node = this.nodes.get(this.draggedNode);
                if (node) {
                    node.x = world.x - (node.dragOffsetX || 0);
                    node.y = world.y - (node.dragOffsetY || 0);
                    if (this.onGraphChanged) this.onGraphChanged();
                }
            } else if (this.isPanning) {
                this.pan.x = pos.x - this.panStart.x;
                this.pan.y = pos.y - this.panStart.y;
            } else {
                // Hover detection
                const prevHovered = this.hoveredNode;
                this.hoveredNode = this.findNodeAt(world.x, world.y);
                if (prevHovered !== this.hoveredNode) {
                    this.canvas.style.cursor = this.hoveredNode ? 'grab' : (this.mode === 'connect' ? 'pointer' : 'default');
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.draggedNode) {
                this.draggedNode = null;
                this.canvas.style.cursor = this.hoveredNode ? 'grab' : 'default';
            }
            if (this.isPanning) {
                this.isPanning = false;
                this.canvas.style.cursor = 'default';
            }
        });

        // Double click to add state
        this.canvas.addEventListener('dblclick', (e) => {
            const pos = getCanvasPos(e);
            const world = this.screenToWorld(pos.x, pos.y);
            const clickedNode = this.findNodeAt(world.x, world.y);
            if (!clickedNode && this.onStateDoubleClicked) {
                this.onStateDoubleClicked(world.x, world.y);
            }
        });

        // Context menu (Right-click)
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const pos = getCanvasPos(e);
            const world = this.screenToWorld(pos.x, pos.y);
            const clickedNode = this.findNodeAt(world.x, world.y);
            if (clickedNode && this.onStateContextMenu) {
                this.onStateContextMenu(clickedNode, e.clientX, e.clientY);
            }
        });

        // Wheel Zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const pos = getCanvasPos(e);
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * zoomFactor));

            // Zoom centered at mouse position
            this.pan.x = pos.x - (pos.x - this.pan.x) * (newZoom / this.zoom);
            this.pan.y = pos.y - (pos.y - this.pan.y) * (newZoom / this.zoom);
            this.zoom = newZoom;
            this.draw();
        }, { passive: false });
    }

    /**
     * Animation frame runner
     */
    animate(timestamp) {
        this.pulseTime = timestamp * 0.003;
        this.draw();
        requestAnimationFrame(this.animate);
    }

    /**
     * Core Drawing Method
     */
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Draw elegant grid
        this.drawGrid();

        ctx.save();
        ctx.translate(this.pan.x, this.pan.y);
        ctx.scale(this.zoom, this.zoom);

        // Draw optional backdrop reference image (from uploaded photo/diagram)
        if (this.backdropImage) {
            ctx.save();
            ctx.globalAlpha = this.backdropOpacity;
            const img = this.backdropImage;
            const targetW = Math.min(700, this.width * 0.85);
            const scale = targetW / img.width;
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            const drawX = (this.width / 2) - drawW / 2;
            const drawY = (this.height / 2) - drawH / 2;
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            ctx.restore();
        }

        // Group transitions: fromState -> toState -> symbols[]
        const edgeMap = new Map();
        for (const s of this.dfa.states) {
            for (const sym of this.dfa.alphabet) {
                const target = this.dfa.step(s, sym);
                if (target && this.nodes.has(s) && this.nodes.has(target)) {
                    const key = `${s}->${target}`;
                    if (!edgeMap.has(key)) {
                        edgeMap.set(key, { from: s, to: target, symbols: [] });
                    }
                    edgeMap.get(key).symbols.push(sym);
                }
            }
        }

        // Draw transitions (edges)
        for (const [key, edge] of edgeMap) {
            const hasReverse = edge.from !== edge.to && edgeMap.has(`${edge.to}->${edge.from}`);
            this.drawTransition(edge.from, edge.to, edge.symbols.join(', '), hasReverse);
        }

        // Draw in-progress connection line
        if (this.connectingFromNode && this.nodes.has(this.connectingFromNode)) {
            const fromNode = this.nodes.get(this.connectingFromNode);
            const mouseWorld = this.screenToWorld(this.currentMousePos.x, this.currentMousePos.y);
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2.5;
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.lineTo(mouseWorld.x, mouseWorld.y);
            ctx.stroke();
            ctx.restore();
        }

        // Draw states (nodes)
        for (const s of this.dfa.states) {
            this.drawNode(s);
        }

        // Draw traveling token particle if active
        if (this.activeTransition && this.particleProgress !== null) {
            this.drawTravelingParticle(
                this.activeTransition.from,
                this.activeTransition.to,
                this.particleProgress
            );
        }

        ctx.restore();
    }

    drawGrid() {
        const ctx = this.ctx;
        const isDark = document.body.classList.contains('dark') || true;
        const dotColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)';

        const gridSize = 30 * this.zoom;
        const offsetX = this.pan.x % gridSize;
        const offsetY = this.pan.y % gridSize;

        ctx.save();
        ctx.fillStyle = dotColor;

        for (let x = offsetX; x < this.width; x += gridSize) {
            for (let y = offsetY; y < this.height; y += gridSize) {
                ctx.beginPath();
                ctx.arc(x, y, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    /**
     * Draw State Node
     */
    drawNode(stateName) {
        const node = this.nodes.get(stateName);
        if (!node) return;

        const ctx = this.ctx;
        const x = node.x;
        const y = node.y;
        const r = this.nodeRadius;
        const isInitial = (stateName === this.dfa.initialState);
        const isFinal = this.dfa.isFinal(stateName);
        const isActive = (stateName === this.activeState);
        const isHovered = (stateName === this.hoveredNode);
        const isConnecting = (stateName === this.connectingFromNode);

        // Active State Glowing Aura
        if (isActive) {
            const glowRadius = r + 8 + Math.sin(this.pulseTime * 4) * 3;
            const gradient = ctx.createRadialGradient(x, y, r, x, y, glowRadius + 10);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, glowRadius + 10, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Accent pulsing ring
            ctx.beginPath();
            ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.restore();
        }

        // Draw Initial State Incoming Arrow: -> (q0)
        if (isInitial) {
            ctx.save();
            const arrowLen = 35;
            const startX = x - r - arrowLen;
            const startY = y;
            const endX = x - r;
            const endY = y;

            ctx.strokeStyle = '#3b82f6';
            ctx.fillStyle = '#3b82f6';
            ctx.lineWidth = 2.5;

            // Line
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - 10, endY - 6);
            ctx.lineTo(endX - 10, endY + 6);
            ctx.closePath();
            ctx.fill();

            // "Start" text
            ctx.font = '600 11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Start', startX - 5, startY);
            ctx.restore();
        }

        // Node Base Circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);

        // Fill color based on state
        if (isActive) {
            ctx.fillStyle = '#1e3a8a';
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3;
        } else if (isConnecting) {
            ctx.fillStyle = '#312e81';
            ctx.strokeStyle = '#818cf8';
            ctx.lineWidth = 3;
        } else if (isHovered) {
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2.5;
        } else {
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 2;
        }

        ctx.fill();
        ctx.stroke();

        // Final State Inner Concentric Ring
        if (isFinal) {
            ctx.beginPath();
            ctx.arc(x, y, r - this.finalRingOffset, 0, Math.PI * 2);
            ctx.strokeStyle = isActive ? '#93c5fd' : (isHovered ? '#cbd5e1' : '#64748b');
            ctx.lineWidth = 1.8;
            ctx.stroke();
        }

        // Node Label
        ctx.font = '600 13px "JetBrains Mono", Consolas, monospace';
        ctx.fillStyle = isActive ? '#ffffff' : (isHovered ? '#f8fafc' : '#e2e8f0');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Truncate overly long composite state names if needed
        let label = stateName;
        if (label.length > 7) {
            label = label.substring(0, 6) + '…';
        }
        ctx.fillText(label, x, y);

        ctx.restore();
    }

    /**
     * Draw Transition Edge (Self-Loop or Arc between nodes)
     */
    drawTransition(fromState, toState, label, isCurved = false) {
        const fromNode = this.nodes.get(fromState);
        const toNode = this.nodes.get(toState);
        if (!fromNode || !toNode) return;

        const ctx = this.ctx;
        const isSelfLoop = (fromState === toState);
        const isActive = this.activeTransition &&
            this.activeTransition.from === fromState &&
            this.activeTransition.to === toState;

        ctx.save();
        ctx.strokeStyle = isActive ? '#38bdf8' : '#64748b';
        ctx.fillStyle = isActive ? '#38bdf8' : '#64748b';
        ctx.lineWidth = isActive ? 2.8 : 1.8;

        if (isSelfLoop) {
            // Draw Self-Loop Arc above the state
            const r = this.nodeRadius;
            const loopRadius = 24;
            const loopCenterY = fromNode.y - r - loopRadius * 0.7;
            const loopCenterX = fromNode.x;

            ctx.beginPath();
            ctx.arc(loopCenterX, loopCenterY, loopRadius, 0.4 * Math.PI, 2.6 * Math.PI, false);
            ctx.stroke();

            // Arrow head for self loop
            const endAngle = 0.4 * Math.PI;
            const arrowTipX = loopCenterX + loopRadius * Math.cos(endAngle);
            const arrowTipY = loopCenterY + loopRadius * Math.sin(endAngle);

            this.drawArrowHead(arrowTipX, arrowTipY, 0.9 * Math.PI, ctx);

            // Label on top
            this.drawEdgeLabel(loopCenterX, loopCenterY - loopRadius - 6, label, isActive);
        } else {
            // Directed edge between different nodes
            const r = this.nodeRadius;
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const dist = Math.hypot(dx, dy);

            if (dist === 0) {
                ctx.restore();
                return;
            }

            const angle = Math.atan2(dy, dx);

            if (!isCurved) {
                // Straight Line
                const startX = fromNode.x + r * Math.cos(angle);
                const startY = fromNode.y + r * Math.sin(angle);
                const endX = toNode.x - r * Math.cos(angle);
                const endY = toNode.y - r * Math.sin(angle);

                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                this.drawArrowHead(endX, endY, angle, ctx);

                // Label in center
                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;
                const normalAngle = angle - Math.PI / 2;
                const labelX = midX + 12 * Math.cos(normalAngle);
                const labelY = midY + 12 * Math.sin(normalAngle);
                this.drawEdgeLabel(labelX, labelY, label, isActive);
            } else {
                // Curved Arc for Antiparallel Edges (Avoid overlap)
                const curveOffset = 38;
                const normalAngle = angle - Math.PI / 2;
                const midX = (fromNode.x + toNode.x) / 2 + curveOffset * Math.cos(normalAngle);
                const midY = (fromNode.y + toNode.y) / 2 + curveOffset * Math.sin(normalAngle);

                // Quadratic Bezier Curve
                ctx.beginPath();
                ctx.moveTo(
                    fromNode.x + r * Math.cos(angle - 0.3),
                    fromNode.y + r * Math.sin(angle - 0.3)
                );
                ctx.quadraticCurveTo(midX, midY,
                    toNode.x - r * Math.cos(angle + 0.3),
                    toNode.y - r * Math.sin(angle + 0.3)
                );
                ctx.stroke();

                // Arrow head tangent at target
                const targetX = toNode.x - r * Math.cos(angle + 0.3);
                const targetY = toNode.y - r * Math.sin(angle + 0.3);
                const tangentAngle = Math.atan2(targetY - midY, targetX - midX);
                this.drawArrowHead(targetX, targetY, tangentAngle, ctx);

                // Label near curve crest
                this.drawEdgeLabel(midX, midY, label, isActive);
            }
        }

        ctx.restore();
    }

    drawArrowHead(tipX, tipY, angle, ctx) {
        const headLength = 11;
        const headAngle = Math.PI / 6;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
            tipX - headLength * Math.cos(angle - headAngle),
            tipY - headLength * Math.sin(angle - headAngle)
        );
        ctx.lineTo(
            tipX - headLength * Math.cos(angle + headAngle),
            tipY - headLength * Math.sin(angle + headAngle)
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    drawEdgeLabel(x, y, text, isActive) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = '600 12px "JetBrains Mono", Consolas, monospace';
        const metrics = ctx.measureText(text);
        const padX = 6;
        const padY = 3;
        const w = metrics.width + padX * 2;
        const h = 18;

        // Label pill background
        ctx.fillStyle = isActive ? '#0369a1' : 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = isActive ? '#38bdf8' : 'rgba(100, 116, 139, 0.4)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, 4);
        ctx.fill();
        ctx.stroke();

        // Label text
        ctx.fillStyle = isActive ? '#ffffff' : '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);

        ctx.restore();
    }

    /**
     * Draw glowing particle animating along transition path
     */
    drawTravelingParticle(fromState, toState, t) {
        const fromNode = this.nodes.get(fromState);
        const toNode = this.nodes.get(toState);
        if (!fromNode || !toNode) return;

        let px, py;
        if (fromState === toState) {
            // Self loop parametric circle
            const r = this.nodeRadius;
            const loopRadius = 24;
            const loopCenterY = fromNode.y - r - loopRadius * 0.7;
            const loopCenterX = fromNode.x;
            const angle = 2.6 * Math.PI - t * (2.2 * Math.PI);
            px = loopCenterX + loopRadius * Math.cos(angle);
            py = loopCenterY + loopRadius * Math.sin(angle);
        } else {
            // Bezier or line
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const angle = Math.atan2(dy, dx);
            const curveOffset = 38;
            const normalAngle = angle - Math.PI / 2;
            const midX = (fromNode.x + toNode.x) / 2 + curveOffset * Math.cos(normalAngle);
            const midY = (fromNode.y + toNode.y) / 2 + curveOffset * Math.sin(normalAngle);

            // Quadratic Bezier interpolation: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
            const omt = 1 - t;
            px = omt * omt * fromNode.x + 2 * omt * t * midX + t * t * toNode.x;
            py = omt * omt * fromNode.y + 2 * omt * t * midY + t * t * toNode.y;
        }

        const ctx = this.ctx;
        ctx.save();
        // Particle glow
        const glow = ctx.createRadialGradient(px, py, 2, px, py, 12);
        glow.addColorStop(0, 'rgba(56, 189, 248, 1)');
        glow.addColorStop(0.5, 'rgba(56, 189, 248, 0.4)');
        glow.addColorStop(1, 'rgba(56, 189, 248, 0)');

        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    setBackdropImage(img, opacity = 0.35) {
        this.backdropImage = img;
        this.backdropOpacity = opacity;
        this.draw();
    }

    clearBackdropImage() {
        this.backdropImage = null;
        this.draw();
    }

    /**
     * Export Diagram as High-Resolution Image (PNG)
     */
    exportPNG() {
        // Fit view to graph bounds on a virtual canvas
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.width * 2;
        exportCanvas.height = this.height * 2;
        const expCtx = exportCanvas.getContext('2d');

        expCtx.fillStyle = '#0f172a';
        expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        expCtx.drawImage(this.canvas, 0, 0, exportCanvas.width, exportCanvas.height);

        const link = document.createElement('a');
        link.download = `dfa_diagram_${Date.now()}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DFAGraph;
}

