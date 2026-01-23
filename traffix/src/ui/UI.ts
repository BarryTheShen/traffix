import { Simulation } from '../core/Simulation';
import type { SimulationState } from '../core/types';

export class UI {
    private container: HTMLElement;
    private simulation: Simulation;
    private logEl: HTMLElement | null = null;
    private scoreEl: HTMLElement | null = null;

    constructor(container: HTMLElement, simulation: Simulation) {
        this.container = container;
        this.simulation = simulation;
    }

    public init() {
        const overlay = document.createElement('div');
        overlay.id = 'ui-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '10px';
        overlay.style.right = '10px';
        overlay.style.width = '300px';
        overlay.style.background = 'rgba(0, 0, 0, 0.8)';
        overlay.style.color = '#fff';
        overlay.style.padding = '10px';
        overlay.style.fontFamily = 'monospace';
        overlay.style.borderRadius = '8px';
        overlay.style.pointerEvents = 'auto';
        overlay.style.maxHeight = '90vh';
        overlay.style.overflowY = 'auto';

        overlay.innerHTML = `
            <div style="margin-bottom: 10px; border-bottom: 1px solid #555; padding-bottom: 5px;">
                <h3 style="margin: 0; color: #3498db;">Traffix Controls</h3>
            </div>
            
            <div id="spawn-stuck-warning" style="display: none; position: absolute; top: 100px; left: 50%; transform: translateX(-50%); background: rgba(231, 76, 60, 0.9); color: white; padding: 20px 40px; font-size: 2rem; border-radius: 8px; font-weight: bold; text-align: center; box-shadow: 0 0 20px rgba(0,0,0,0.5); z-index: 2000;">
                ⚠️ SPAWN BLOCKED! ⚠️
                <div style="font-size: 1rem; margin-top: 10px;">Clear traffic or Game Over!</div>
                <div id="countdown-timer" style="font-size: 3rem; margin-top: 10px; color: #f1c40f;">10</div>
            </div>

            <div class="stats-panel">
                <div>Score: <span id="score-val" style="color: #2ecc71; font-weight: bold;">0</span></div>
                <div style="font-size: 0.8rem; color: #aaa;">Exited: <span id="exited-val">0</span></div>
                <div style="font-size: 0.8rem; color: #aaa; margin-top: 2px;">Spawn Rate: <span id="current-spawn-val" style="color: #3498db;">0.0</span>/s</div>
            </div>

            <div class="control-panel" style="margin-top: 10px;">
                <div class="input-group">
                    <label>Sim Speed:</label>
                    <input type="range" id="sim-speed" min="0.1" max="5.0" step="0.1" value="1.0" style="width: 100%;">
                    <span id="speed-val">1.0x</span>
                </div>
                
                <div style="display: flex; gap: 5px; margin-top: 5px;">
                    <button id="pause-sim" style="flex: 1; padding: 5px; background: #f39c12; border: none; color: white; border-radius: 4px; cursor: pointer;">Pause</button>
                    <button id="reset-sim" style="flex: 1; padding: 5px; background: #95a5a6; border: none; color: white; border-radius: 4px; cursor: pointer;">Reset Sim</button>
                    <button id="back-menu" style="flex: 1; padding: 5px; background: #34495e; border: none; color: white; border-radius: 4px; cursor: pointer;">Menu</button>
                </div>

                <div style="margin-top: 5px;">
                     <button id="reset-rules" style="width: 100%; padding: 4px; background: #7f8c8d; border: 1px dashed #aaa; color: #ddd; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Reset Light Rules</button>
                </div>
                
                <div style="margin-top: 10px;">
                    <label style="display: flex; align-items: center; color: white; gap: 5px; font-size: 0.9rem; cursor: pointer;">
                        <input type="checkbox" id="debug-toggle"> Enable Debug / Cheats
                    </label>
                </div>

                <div id="debug-panel" style="display: none; margin-top: 10px; padding: 10px; border: 1px solid #c0392b; border-radius: 4px; background: rgba(192, 57, 43, 0.1);">
                    <div style="color: #e74c3c; font-weight: bold; margin-bottom: 5px;">Debug / Cheats</div>
                    
                    <div style="margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">
                        <div style="font-size: 0.8rem; color: #f1c40f; margin-bottom: 5px;">Car Capabilities:</div>
                        <div class="input-group">
                            <label style="font-size: 0.7rem;">Accel:</label>
                            <input type="range" id="car-accel" min="0.001" max="0.5" step="0.001" value="0.02" style="width: 70%;">
                            <span id="accel-val" style="font-size: 0.7rem;">0.020</span>
                        </div>
                        <div class="input-group" style="margin-top: 2px;">
                            <label style="font-size: 0.7rem;">Decel:</label>
                            <input type="range" id="car-decel" min="0.01" max="2.0" step="0.01" value="0.05" style="width: 70%;">
                            <span id="decel-val" style="font-size: 0.7rem;">0.05</span>
                        </div>
                        <div class="input-group" style="margin-top: 2px;">
                            <label style="font-size: 0.7rem;">Rebel%:</label>
                            <input type="range" id="rebel-chance" min="0" max="10" step="0.5" value="0.5" style="width: 70%;">
                            <span id="rebel-val" style="font-size: 0.7rem;">0.5%</span>
                        </div>
                        <div style="margin-top: 5px;">
                            <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; color: #ff00ff;">
                                <input type="checkbox" id="rebel-debug"> Color Rebels 👾
                            </label>
                        </div>
                    </div>

                    <div class="input-group" style="margin-top: 5px;">
                        <label>Spawn Rate:</label>
                        <input type="range" id="spawn-rate" min="0.0" max="50.0" step="0.5" value="1.0" style="width: 100%;">
                        <span id="spawn-rate-val">1.0x</span>
                    </div>
                    
                    <div class="input-group" style="margin-top: 8px;">
                        <label title="Points deducted per crash">Crash Penalty:</label>
                        <input type="number" id="crash-penalty" value="1000" step="100" style="width: 60px; background: #333; color: white; border: none; border-radius: 2px;">
                    </div>

                    <div class="input-group" style="margin-top: 5px;">
                        <label title="How long crashed cars block traffic (ticks)">Crash Blockade:</label>
                        <input type="number" id="crash-timeout" value="1800" step="100" style="width: 60px; background: #333; color: white; border: none; border-radius: 2px;">
                    </div>

                     <div class="input-group" style="margin-top: 5px;">
                        <label title="How long before Game Over at entry (ticks)">Entry Timeout:</label>
                        <input type="number" id="gameover-timeout" value="1200" step="100" style="width: 60px; background: #333; color: white; border: none; border-radius: 2px;">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 10px;">
                        <button id="spawn-manual" style="padding: 5px; background: #27ae60; border: none; color: white; border-radius: 4px; cursor: pointer;">+ Car</button>
                        <button id="clear-cars" style="padding: 5px; background: #c0392b; border: none; color: white; border-radius: 4px; cursor: pointer;">Clear All</button>
                    </div>
                     <div style="margin-top: 10px;">
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem;">
                            <input type="checkbox" id="debug-draw" checked> Show Paths/Debug
                        </label>
                    </div>
                </div>
            </div>

            <div style="margin-top: 15px; border-top: 1px solid #555; padding-top: 5px;">
                <h4 style="margin: 0 0 5px 0; color: #aaa;">Legend</h4>
                <div style="font-size: 0.8rem; display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    <div style="display:flex; align-items:center; gap:5px;"><span style="display:inline-block; width:10px; height:10px; background:#f1c40f;"></span> Moving</div>
                    <div style="display:flex; align-items:center; gap:5px;"><span style="display:inline-block; width:10px; height:10px; background:#e67e22;"></span> Stuck</div>
                    <div style="display:flex; align-items:center; gap:5px;"><span style="display:inline-block; width:10px; height:10px; background:#e74c3c;"></span> Blocked (Entry)</div>
                    <div style="display:flex; align-items:center; gap:5px;"><span style="display:inline-block; width:10px; height:10px; background:#8e44ad;"></span> Crashed</div>
                    <div style="display:flex; align-items:center; gap:5px;"><span style="display:inline-block; width:10px; height:10px; background:#3498db;"></span> Selected</div>
                </div>
            </div>

            <div id="selection-info" style="margin-top: 15px; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 4px; min-height: 40px;">
                Click a car to track path
            </div>

            <div style="margin-top: 15px;">
                <h4 style="margin: 0 0 5px 0; color: #f1c40f;">Traffic Lights</h4>
                <div id="lights-list"></div>
            </div>

            <div style="margin-top: 15px; border-top: 1px solid #555; padding-top: 5px;">
                <h4 style="margin: 0 0 5px 0;">Log</h4>
                <div id="sim-log" style="height: 100px; overflow-y: auto; font-size: 0.8rem; color: #aaa;"></div>
            </div>
        `;

        this.container.appendChild(overlay);
        this.logEl = document.getElementById('sim-log');
        this.scoreEl = document.getElementById('score-val');

        this.setupEventListeners();
        this.showStartScreen();
    }

    private setupEventListeners() {
        const speedSlider = document.getElementById('sim-speed') as HTMLInputElement;
        speedSlider?.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.simulation.timeScale = val;
            document.getElementById('speed-val')!.innerText = val.toFixed(1) + 'x';
        });

        const spawnRateSlider = document.getElementById('spawn-rate') as HTMLInputElement;
        spawnRateSlider?.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.simulation.spawnRate = val;
            document.getElementById('spawn-rate-val')!.innerText = val.toFixed(1) + 'x';
        });
        
        document.getElementById('car-accel')?.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.simulation.carAcceleration = val;
            document.getElementById('accel-val')!.innerText = val.toFixed(3);
        });

        document.getElementById('car-decel')?.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.simulation.carDeceleration = val;
            document.getElementById('decel-val')!.innerText = val.toFixed(2);
        });

        document.getElementById('rebel-chance')?.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.simulation.rebelChance = val / 100;
            document.getElementById('rebel-val')!.innerText = val.toFixed(1) + "%";
        });

        document.getElementById('rebel-debug')?.addEventListener('change', (e) => {
            this.simulation.rebelDebug = (e.target as HTMLInputElement).checked;
        });

        document.getElementById('crash-penalty')?.addEventListener('change', (e) => {
            this.simulation.crashPenalty = parseInt((e.target as HTMLInputElement).value);
        });

        document.getElementById('crash-timeout')?.addEventListener('change', (e) => {
            this.simulation.collisionCleanupTimeout = parseInt((e.target as HTMLInputElement).value);
        });
        
        document.getElementById('gameover-timeout')?.addEventListener('change', (e) => {
            this.simulation.gameOverTimeout = parseInt((e.target as HTMLInputElement).value);
        });

        document.getElementById('pause-sim')?.addEventListener('click', () => {
            if (this.simulation.timeScale === 0) {
                const val = parseFloat(speedSlider.value);
                this.simulation.timeScale = val;
                document.getElementById('pause-sim')!.innerText = 'Pause';
            } else {
                this.simulation.timeScale = 0;
                document.getElementById('pause-sim')!.innerText = 'Resume';
            }
        });

        document.getElementById('debug-toggle')?.addEventListener('change', (e) => {
            document.getElementById('debug-panel')!.style.display = (e.target as HTMLInputElement).checked ? 'block' : 'none';
        });
        
        document.getElementById('debug-draw')?.addEventListener('change', (e) => {
            if ((window as any).renderer) (window as any).renderer.debugMode = (e.target as HTMLInputElement).checked;
        });

        document.getElementById('spawn-manual')?.addEventListener('click', () => this.simulation.spawnVehicle());
        document.getElementById('clear-cars')?.addEventListener('click', () => this.simulation.getState().vehicles = []);

        document.getElementById('reset-sim')?.addEventListener('click', () => {
            this.simulation.reset(true);
            this.updateScore(0, 0, 0);
            if ((window as any).renderer) (window as any).renderer.clearCache();
            this.renderIntersections();
            this.resetControls();
            document.getElementById('game-over-screen')?.remove();
        });

        document.getElementById('reset-rules')?.addEventListener('click', () => {
             if (confirm('Reset all traffic light phases to default?')) {
                 this.simulation.reset(false);
                 this.renderIntersections();
                 this.updateScore(0, 0, 0);
             }
        });

        document.getElementById('back-menu')?.addEventListener('click', () => {
             this.simulation.stop();
             this.showStartScreen();
             document.getElementById('game-over-screen')?.remove();
        });

        document.getElementById('selection-info')?.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('#del-veh');
            if (btn) {
                const id = btn.getAttribute('data-id');
                const state = this.simulation.getState();
                const idx = state.vehicles.findIndex((v: any) => v.id === id);
                if (idx !== -1) {
                    state.vehicles.splice(idx, 1);
                    this.simulation.selectedVehicleId = null;
                }
            }
        });
    }

    private resetControls() {
        (document.getElementById('sim-speed') as HTMLInputElement).value = "1.0";
        this.simulation.timeScale = 1.0;
        document.getElementById('speed-val')!.innerText = "1.0x";
        
        (document.getElementById('spawn-rate') as HTMLInputElement).value = "1.0";
        this.simulation.spawnRate = 1.0;
        document.getElementById('spawn-rate-val')!.innerText = "1.0x";

        (document.getElementById('car-accel') as HTMLInputElement).value = "0.02";
        this.simulation.carAcceleration = 0.02;
        document.getElementById('accel-val')!.innerText = "0.020";

        (document.getElementById('car-decel') as HTMLInputElement).value = "0.05";
        this.simulation.carDeceleration = 0.05;
        document.getElementById('decel-val')!.innerText = "0.05";

        (document.getElementById('rebel-chance') as HTMLInputElement).value = "0.5";
        this.simulation.rebelChance = 0.005;
        document.getElementById('rebel-val')!.innerText = "0.5%";

        (document.getElementById('crash-penalty') as HTMLInputElement).value = "1000";
        this.simulation.crashPenalty = 1000;

        (document.getElementById('crash-timeout') as HTMLInputElement).value = "1800";
        this.simulation.collisionCleanupTimeout = 1800;

        (document.getElementById('gameover-timeout') as HTMLInputElement).value = "1200";
        this.simulation.gameOverTimeout = 1200;
    }

    private showStartScreen() {
        const startScreen = document.createElement('div');
        startScreen.id = 'start-screen';
        startScreen.style.position = 'absolute';
        startScreen.style.top = '0'; startScreen.style.left = '0';
        startScreen.style.width = '100%'; startScreen.style.height = '100%';
        startScreen.style.background = 'rgba(0,0,0,0.95)';
        startScreen.style.display = 'flex'; startScreen.style.flexDirection = 'column';
        startScreen.style.justifyContent = 'center'; startScreen.style.alignItems = 'center';
        startScreen.style.zIndex = '1000'; startScreen.style.color = 'white';
        startScreen.style.fontFamily = 'monospace';

        startScreen.innerHTML = `
            <h1 style="font-size: 3rem; color: #3498db; margin-bottom: 20px;">TRAFFIX</h1>
            <div style="max-width: 600px; text-align: center; margin-bottom: 30px; line-height: 1.6;">
                <p>Welcome to Traffix, the traffic optimization simulator.</p>
                <p><strong>Goal:</strong> Manage traffic lights to ensure smooth flow. Cars exiting correctly give points.</p>
                <p><strong>Rules:</strong></p>
                <ul style="text-align: left; display: inline-block;">
                    <li>Configure traffic light phases for each intersection.</li>
                    <li>Avoid gridlock! If a car is stuck at a spawn point for too long, <strong>GAME OVER</strong>.</li>
                    <li>Stuck cars elsewhere will eventually be removed with a score penalty.</li>
                </ul>
            </div>
            <h3 style="margin-bottom: 10px;">Select Level</h3>
            <div style="display: flex; gap: 10px;">
                <button class="level-btn" data-level="tutorial" style="padding: 10px 20px; font-size: 1.2rem; background: #e67e22; color: white; border: none; border-radius: 8px; cursor: pointer;">Tutorial</button>
                <button class="level-btn" data-level="classic" style="padding: 10px 20px; font-size: 1.2rem; background: #27ae60; color: white; border: none; border-radius: 8px; cursor: pointer;">Classic</button>
                <button class="level-btn" data-level="level1" style="padding: 10px 20px; font-size: 1.2rem; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer;">Level 1</button>
                <button class="level-btn" data-level="level2" style="padding: 10px 20px; font-size: 1.2rem; background: #9b59b6; color: white; border: none; border-radius: 8px; cursor: pointer;">Level 2</button>
                <button class="level-btn" data-level="random" style="padding: 10px 20px; font-size: 1.2rem; background: #c0392b; color: white; border: none; border-radius: 8px; cursor: pointer;">Random</button>
            </div>
        `;
        this.container.appendChild(startScreen);
        this.simulation.timeScale = 0;
        startScreen.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = (e.target as HTMLElement).getAttribute('data-level')!;
                this.simulation.currentLevel = level;
                this.simulation.reset();
                if ((window as any).renderer) (window as any).renderer.clearCache();
                this.renderIntersections();
                startScreen.remove();
                this.simulation.timeScale = 1.0;
                (document.getElementById('sim-speed') as HTMLInputElement).value = "1.0";
            });
        });
    }

    private getStateColor(state: string) {
        if (state === 'GREEN') return '#2ecc71';
        if (state === 'YELLOW') return '#f1c40f';
        return '#e74c3c';
    }

    private handleIntersectionChange(e: Event) {
        const target = e.target as any;
        const intIdx = parseInt(target.getAttribute('data-int'));
        const phaseIdx = parseInt(target.getAttribute('data-phase'));
        const field = target.getAttribute('data-field');
        const dir = target.getAttribute('data-dir');
        const intersection = this.simulation.getState().intersections[intIdx];
        const phase = intersection.phases[phaseIdx];
        if (field === 'name') phase.name = target.value;
        if (field === 'duration') phase.duration = parseInt(target.value);
        if (dir) phase.lightStates[dir] = target.value;
    }

    private renderIntersections() {
        if (!this.simulation) return;
        const intersections = this.simulation.getState().intersections;
        const list = document.getElementById('lights-list');
        if (!list) return;
        list.innerHTML = '';
        intersections.forEach((intersection, intIdx) => {
            const div = document.createElement('div');
            div.className = 'intersection-control';
            div.style.marginBottom = '20px'; div.style.padding = '10px';
            div.style.border = '1px solid #555'; div.style.background = 'rgba(255,255,255,0.05)';
            div.style.borderRadius = '4px';
            let phasesHtml = '';
            intersection.phases.forEach((phase, phaseIdx) => {
                const isCurrent = intersection.currentPhaseIndex === phaseIdx;
                phasesHtml += `
                    <div style="margin-top: 5px; padding: 5px; border: 1px solid ${isCurrent ? '#2ecc71' : '#444'}; background: ${isCurrent ? 'rgba(46, 204, 113, 0.1)' : 'transparent'}">
                        <div style="display:flex; justify-content:space-between; font-size: 0.7rem; align-items: center;">
                            <input type="text" value="${phase.name}" data-int="${intIdx}" data-phase="${phaseIdx}" data-field="name" style="width: 80px; background: transparent; color: white; border: none; border-bottom: 1px solid #444;">
                            <div style="display: flex; align-items: center; gap: 2px;">
                                <input type="number" value="${phase.duration}" data-int="${intIdx}" data-phase="${phaseIdx}" data-field="duration" style="width: 40px; background: #222; color: white; border: 1px solid #444; border-radius: 2px; padding: 1px;">
                                <span style="font-size: 0.6rem; color: #aaa;">ticks</span>
                            </div>
                            <button class="del-phase" data-int="${intIdx}" data-phase="${phaseIdx}" style="background:none; border:none; color:#c0392b; cursor:pointer; font-weight:bold;">×</button>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px; margin-top: 5px;">
                            ${['n', 's', 'e', 'w'].map(dir => `
                                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                                    <span style="font-size: 0.6rem; color: #888;">${dir.toUpperCase()}</span>
                                    <select data-int="${intIdx}" data-phase="${phaseIdx}" data-dir="${dir}" style="font-size: 0.7rem; background: #333; color: ${this.getStateColor(phase.lightStates[dir])}; border: 1px solid #555; border-radius: 2px; width: 100%;">
                                        <option value="RED" ${phase.lightStates[dir] === 'RED' ? 'selected' : ''}>RED</option>
                                        <option value="YELLOW" ${phase.lightStates[dir] === 'YELLOW' ? 'selected' : ''}>YEL</option>
                                        <option value="GREEN" ${phase.lightStates[dir] === 'GREEN' ? 'selected' : ''}>GRN</option>
                                    </select>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            });
            div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 8px;"><strong style="color: #3498db; font-size: 0.9rem;">${intersection.id}</strong><button class="add-phase" data-int="${intIdx}" style="padding: 2px 8px; font-size: 0.7rem; background: #27ae60; color: white; border: none; border-radius: 3px; cursor: pointer;">+ Add Phase</button></div><div class="phases-container">${phasesHtml}</div>`;
            list.appendChild(div);
        });
        list.querySelectorAll('input, select').forEach(el => el.addEventListener('change', (e) => this.handleIntersectionChange(e)));
        list.querySelectorAll('.add-phase').forEach(btn => btn.addEventListener('click', (e) => {
            const intIdx = parseInt((e.target as HTMLElement).getAttribute('data-int')!);
            this.simulation.getState().intersections[intIdx].phases.push({ id: 'p' + Date.now(), name: 'New Phase', duration: 60, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' } });
            this.renderIntersections();
        }));
        list.querySelectorAll('.del-phase').forEach(btn => btn.addEventListener('click', (e) => {
            const btnEl = (e.target as HTMLElement).closest('.del-phase') as HTMLElement;
            const intIdx = parseInt(btnEl.getAttribute('data-int')!);
            const phaseIdx = parseInt(btnEl.getAttribute('data-phase')!);
            this.simulation.getState().intersections[intIdx].phases.splice(phaseIdx, 1);
            this.renderIntersections();
        }));
    }

    public update(state: SimulationState) {
        if (state.gameOver) { this.showGameOver(state.gameOverReason || "Game Over", state.score); return; }
        const warningEl = document.getElementById('spawn-stuck-warning');
        const countdownEl = document.getElementById('countdown-timer');
        if (warningEl) {
            const isWarning = state.spawnStuckWarning;
            warningEl.style.display = isWarning ? 'block' : 'none';
            if (isWarning) {
                const speedSlider = document.getElementById('sim-speed') as HTMLInputElement;
                if (speedSlider && speedSlider.value !== "1.0") {
                    speedSlider.value = "1.0";
                    document.getElementById('speed-val')!.innerText = "1.0x";
                }

                // Calculate countdown: 1200 ticks is game over. Warning starts at 600.
                const maxStuck = Math.max(0, ...state.vehicles.map(v => v.spawnStuckTimer || 0));
                const remaining = Math.ceil((1200 - maxStuck) / 60);
                if (countdownEl) {
                    countdownEl.innerText = remaining > 0 ? remaining.toString() : "!";
                }
            }
        }
        this.updateScore(state.score, state.exitedCars, state.currentSpawnRate);
        const selInfo = document.getElementById('selection-info');
        if (selInfo) {
            const selId = this.simulation.selectedVehicleId;
            const vehicle = state.vehicles.find((v: any) => v.id === selId);
            if (vehicle) {
                const isStuck = vehicle.stuckTimer > 1200;
                selInfo.innerHTML = `<div style="margin-bottom: 5px;"><strong>Vehicle: ${vehicle.id}</strong> <button id="del-veh" data-id="${vehicle.id}" style="padding: 2px 5px; font-size: 0.7rem; background: #c0392b; color: white; border: none; border-radius: 3px; cursor: pointer;">Delete</button></div>Pos: (${vehicle.position.x.toFixed(1)}, ${vehicle.position.y.toFixed(1)})<br/>Vel: ${vehicle.velocity.toFixed(3)}<br/>State: <span style="color: ${isStuck ? '#e74c3c' : '#e67e22'}">${vehicle.debugState}</span><br/>Stuck: ${vehicle.stuckTimer} / Spawn: ${vehicle.spawnStuckTimer}<br/>Rebel: ${vehicle.violatesRules ? 'YES' : 'NO'}`;
            } else { selInfo.innerText = 'Click a car to track path'; this.simulation.selectedVehicleId = null; }
        }
        const list = document.getElementById('lights-list');
        if (list) {
             const intersectionControls = list.querySelectorAll('.intersection-control');
             state.intersections.forEach((intersection: any, i: number) => {
                 const ctrl = intersectionControls[i];
                 if (ctrl) {
                     const phaseContainers = ctrl.querySelectorAll('.phases-container > div');
                     phaseContainers.forEach((pDiv: any, pIdx) => {
                         const isCurrent = intersection.currentPhaseIndex === pIdx;
                         pDiv.style.border = `1px solid ${isCurrent ? '#2ecc71' : '#444'}`;
                         pDiv.style.background = isCurrent ? 'rgba(46, 204, 113, 0.1)' : 'transparent';
                         const selects = pDiv.querySelectorAll('select');
                         selects.forEach((sel: HTMLSelectElement) => sel.style.color = this.getStateColor(sel.value));
                     });
                 }
             });
        }
    }

    public updateScore(score: number, exited: number, rate?: number) {
        if (this.scoreEl) this.scoreEl.innerText = score.toString();
        const exitedEl = document.getElementById('exited-val');
        if (exitedEl) exitedEl.innerText = exited.toString();
        const rateEl = document.getElementById('current-spawn-val');
        if (rateEl && rate !== undefined) rateEl.innerText = rate.toFixed(1);
    }

    public showGameOver(reason: string, score: number) {
        if (document.getElementById('game-over-screen')) return;
        const screen = document.createElement('div');
        screen.id = 'game-over-screen';
        screen.style.position = 'absolute';
        screen.style.top = '0'; screen.style.left = '0';
        screen.style.width = '100%'; screen.style.height = '100%';
        screen.style.background = 'rgba(192, 57, 43, 0.9)';
        screen.style.display = 'flex'; screen.style.flexDirection = 'column';
        screen.style.justifyContent = 'center'; screen.style.alignItems = 'center';
        screen.style.zIndex = '1000'; screen.style.color = 'white';
        screen.style.fontFamily = 'monospace';
        screen.innerHTML = `<h1 style="font-size: 4rem; margin-bottom: 10px;">GAME OVER</h1><p style="font-size: 1.5rem; margin-bottom: 20px;">${reason}</p><h2 style="font-size: 2rem; margin-bottom: 30px;">Final Score: ${score}</h2><button id="restart-btn" style="padding: 15px 40px; font-size: 1.5rem; background: #ecf0f1; color: #2c3e50; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">TRY AGAIN</button>`;
        this.container.appendChild(screen);
        document.getElementById('restart-btn')?.addEventListener('click', () => {
            screen.remove(); this.simulation.reset();
            if ((window as any).renderer) (window as any).renderer.clearCache();
            this.renderIntersections(); this.updateScore(0, 0, 0); this.simulation.timeScale = 1.0;
        });
    }

    public log(msg: string) {
        if (this.logEl) {
            const div = document.createElement('div'); div.innerText = `> ${msg}`;
            this.logEl.insertBefore(div, this.logEl.firstChild);
            if (this.logEl.childNodes.length > 50) this.logEl.removeChild(this.logEl.lastChild!);
        }
    }
}