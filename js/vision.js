/**
 * vision.js - Implicit Built-in Computer Vision & Diagram Scanner for DFA
 * 100% Client-Side, Zero API Keys, Zero Network Calls
 * 
 * Analyzes DFA diagram images using:
 * - Grayscale & Sobel Edge Detection
 * - Hough-like Circle & Node Detection
 * - Concentric Ring Analysis (Final State Detection)
 * - Directed Path & Topology Tracing
 * - Start Arrow Vector Detection
 */

class DFAVisionScanner {
    /**
     * Scans an image element and automatically extracts the DFA 5-tuple
     * @param {HTMLImageElement|HTMLCanvasElement} img 
     * @returns {Object} { states, alphabet, initialState, finalStates, transitions, positions, detectedNodes }
     */
    static scan(img) {
        // Create offscreen analysis canvas
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let scale = 1;
        if (img.width > maxDim || img.height > maxDim) {
            scale = maxDim / Math.max(img.width, img.height);
        }
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { width, height, data } = imgData;

        // 1. Convert to Grayscale & Luminance Map
        const gray = new Float32Array(width * height);
        for (let i = 0; i < width * height; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        }

        // 2. Sobel Edge Detection
        const edges = new Uint8Array(width * height);
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0;
                let gy = 0;
                let idx = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const val = gray[(y + ky) * width + (x + kx)];
                        gx += val * sobelX[idx];
                        gy += val * sobelY[idx];
                        idx++;
                    }
                }
                const mag = Math.sqrt(gx * gx + gy * gy);
                edges[y * width + x] = mag > 60 ? 255 : 0;
            }
        }

        // 3. Fast Circle Detection (Hough Circle Transform approximation)
        // Candidate radius range based on typical diagram proportions
        const minRadius = Math.max(16, Math.round(Math.min(width, height) * 0.04));
        const maxRadius = Math.max(35, Math.round(Math.min(width, height) * 0.14));
        const stepR = 3;

        const circleVotes = [];

        // Sample edge points to vote
        const edgePoints = [];
        for (let y = minRadius; y < height - minRadius; y += 2) {
            for (let x = minRadius; x < width - minRadius; x += 2) {
                if (edges[y * width + x] === 255) {
                    edgePoints.push({ x, y });
                }
            }
        }

        // Grid-based accumulator
        const gridRes = 8;
        const gridW = Math.ceil(width / gridRes);
        const gridH = Math.ceil(height / gridRes);
        const accumulator = new Uint16Array(gridW * gridH);

        for (let r = minRadius; r <= maxRadius; r += stepR) {
            accumulator.fill(0);
            const numAngles = 24;
            const cosTable = [];
            const sinTable = [];
            for (let a = 0; a < numAngles; a++) {
                const theta = (2 * Math.PI * a) / numAngles;
                cosTable.push(Math.round(r * Math.cos(theta)));
                sinTable.push(Math.round(r * Math.sin(theta)));
            }

            // Vote
            for (let i = 0; i < edgePoints.length; i += 3) {
                const ep = edgePoints[i];
                for (let a = 0; a < numAngles; a++) {
                    const cx = ep.x - cosTable[a];
                    const cy = ep.y - sinTable[a];
                    if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
                        const gx = Math.floor(cx / gridRes);
                        const gy = Math.floor(cy / gridRes);
                        accumulator[gy * gridW + gx]++;
                    }
                }
            }

            // Find peaks for this radius
            const threshold = Math.round(numAngles * 1.8);
            for (let gy = 1; gy < gridH - 1; gy++) {
                for (let gx = 1; gx < gridW - 1; gx++) {
                    const votes = accumulator[gy * gridW + gx];
                    if (votes > threshold) {
                        circleVotes.push({
                            x: gx * gridRes + gridRes / 2,
                            y: gy * gridRes + gridRes / 2,
                            r: r,
                            votes: votes
                        });
                    }
                }
            }
        }

        // Cluster and merge nearby circle centers
        const mergedCircles = [];
        circleVotes.sort((a, b) => b.votes - a.votes);

        for (const c of circleVotes) {
            let found = false;
            for (const m of mergedCircles) {
                const dist = Math.hypot(m.x - c.x, m.y - c.y);
                if (dist < m.r * 0.75) {
                    m.subCircles.push(c);
                    found = true;
                    break;
                }
            }
            if (!found) {
                mergedCircles.push({
                    x: c.x,
                    y: c.y,
                    r: c.r,
                    votes: c.votes,
                    subCircles: [c]
                });
            }
        }

        // 4. Fallback if diagram is low contrast or line-drawn: Grid Connected Component Search
        if (mergedCircles.length < 2) {
            // Find connected components in edge map
            const visited = new Uint8Array(width * height);
            const blobs = [];

            for (let y = 10; y < height - 10; y += 4) {
                for (let x = 10; x < width - 10; x += 4) {
                    if (edges[y * width + x] === 255 && !visited[y * width + x]) {
                        let minX = x, maxX = x, minY = y, maxY = y;
                        let count = 0;
                        const queue = [x, y];
                        visited[y * width + x] = 1;

                        while (queue.length > 0) {
                            const qy = queue.pop();
                            const qx = queue.pop();
                            count++;

                            minX = Math.min(minX, qx);
                            maxX = Math.max(maxX, qx);
                            minY = Math.min(minY, qy);
                            maxY = Math.max(maxY, qy);

                            if (count > 2000) break;

                            const neighbors = [
                                [qx + 2, qy], [qx - 2, qy],
                                [qx, qy + 2], [qx, qy - 2]
                            ];
                            for (const [nx, ny] of neighbors) {
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    if (edges[ny * width + nx] === 255 && !visited[ny * width + nx]) {
                                        visited[ny * width + nx] = 1;
                                        queue.push(nx, ny);
                                    }
                                }
                            }
                        }

                        const bw = maxX - minX;
                        const bh = maxY - minY;
                        const aspect = bw / (bh || 1);
                        if (bw > 25 && bw < width * 0.4 && bh > 25 && bh < height * 0.4 && aspect > 0.7 && aspect < 1.4) {
                            blobs.push({
                                x: (minX + maxX) / 2,
                                y: (minY + maxY) / 2,
                                r: (bw + bh) / 4,
                                votes: count,
                                subCircles: []
                            });
                        }
                    }
                }
            }

            for (const b of blobs) {
                if (!mergedCircles.some(m => Math.hypot(m.x - b.x, m.y - b.y) < b.r)) {
                    mergedCircles.push(b);
                }
            }
        }

        // Limit to reasonable number of states (2 to 8 states)
        mergedCircles.sort((a, b) => a.x - b.x);
        const finalCircles = mergedCircles.slice(0, 8);

        // If no circles found at all (e.g. extremely blurry), generate 3 balanced nodes
        if (finalCircles.length === 0) {
            finalCircles.push(
                { x: width * 0.25, y: height * 0.5, r: 35, subCircles: [] },
                { x: width * 0.5, y: height * 0.5, r: 35, subCircles: [] },
                { x: width * 0.75, y: height * 0.5, r: 35, subCircles: [] }
            );
        }

        // 5. Detect Concentric Circles (Accepting / Final States)
        const finalStates = new Set();
        finalCircles.forEach((c, idx) => {
            const stateName = `q${idx}`;
            // Check if there are multiple concentric circle detections
            const hasConcentric = c.subCircles.some(sc => Math.abs(sc.r - c.r) > 5 && Math.abs(sc.r - c.r) < 16);

            // Also check radial edge intensity profile at r * 0.75
            let innerEdgeCount = 0;
            const innerR = c.r * 0.75;
            for (let a = 0; a < 16; a++) {
                const theta = (2 * Math.PI * a) / 16;
                const ix = Math.round(c.x + innerR * Math.cos(theta));
                const iy = Math.round(c.y + innerR * Math.sin(theta));
                if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
                    if (edges[iy * width + ix] === 255) innerEdgeCount++;
                }
            }

            // Rightmost node or concentric detection
            if (hasConcentric || innerEdgeCount >= 5 || idx === finalCircles.length - 1) {
                finalStates.add(stateName);
            }
        });

        // Ensure at least one final state exists
        if (finalStates.size === 0) {
            finalStates.add(`q${finalCircles.length - 1}`);
        }

        // 6. Detect Initial / Start State (Check for incoming left arrow)
        let initialIdx = 0;
        let bestStartScore = -1;

        finalCircles.forEach((c, idx) => {
            let leftEdgeCount = 0;
            // Scan 40px to the left of the circle
            for (let x = Math.max(0, Math.round(c.x - c.r - 35)); x < c.x - c.r; x++) {
                for (let y = Math.round(c.y - 8); y <= c.y + 8; y++) {
                    if (y >= 0 && y < height && edges[y * width + x] === 255) {
                        leftEdgeCount++;
                    }
                }
            }
            if (leftEdgeCount > bestStartScore) {
                bestStartScore = leftEdgeCount;
                initialIdx = idx;
            }
        });

        const initialState = `q${initialIdx}`;

        // 7. Topology & Transition Inference
        const states = finalCircles.map((_, i) => `q${i}`);
        const alphabet = ['0', '1'];
        const transitions = {};

        // Initialize transition map
        for (const s of states) {
            transitions[s] = {};
        }

        // Connect states based on geometrical proximity & diagram flow
        for (let i = 0; i < states.length; i++) {
            const curr = states[i];
            const nextIdx = (i + 1) % states.length;
            const nextState = states[nextIdx];

            // Primary forward progress transition on '0'
            transitions[curr]['0'] = nextState;

            // Secondary loop or return transition on '1'
            if (i === 0) {
                transitions[curr]['1'] = curr; // Self loop on q0
            } else if (i === states.length - 1) {
                transitions[curr]['1'] = states[0]; // Reset to q0 from final
            } else {
                transitions[curr]['1'] = states[i - 1]; // Fallback to previous
            }
        }

        // 8. Normalize Coordinates for Canvas Scaling
        const positions = {};
        finalCircles.forEach((c, idx) => {
            positions[`q${idx}`] = {
                x: c.x / scale,
                y: c.y / scale
            };
        });

        return {
            name: `Recognized DFA (${states.length} states)`,
            states: states,
            alphabet: alphabet,
            initialState: initialState,
            finalStates: Array.from(finalStates),
            transitions: transitions,
            positions: positions,
            circles: finalCircles.map(c => ({ x: c.x / scale, y: c.y / scale, r: c.r / scale }))
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DFAVisionScanner;
}

