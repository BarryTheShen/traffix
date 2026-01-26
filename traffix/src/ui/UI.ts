import { Simulation, GAME_VERSION } from '../core/Simulation';
import type { SimulationState } from '../core/types';
import { Intersection } from '../core/Intersection';
import type { TrafficLightPreset } from '../core/Intersection';

export class UI {
    private container: HTMLElement;
    private simulation: Simulation;
    private logEl: HTMLElement | null = null;
    private scoreEl: HTMLElement | null = null;
    private intersectionPopup: HTMLElement | null = null;

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
        overlay.style.width = '320px';
        overlay.style.background = 'rgba(0, 0, 0, 0.85)';
        overlay.style.color = '#fff';
        overlay.style.padding = '12px';
        overlay.style.fontFamily = 'monospace';
        overlay.style.borderRadius = '8px';
        overlay.style.pointerEvents = 'auto';
        overlay.style.maxHeight = '90vh';
        overlay.style.overflowY = 'auto';

        overlay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #555; padding-bottom: 5px;">
                <h3 style="margin: 0; color: #3498db;">Traffix Controls</h3>
                <span id="version-display" style="color: #7f8c8d; font-size: 0.8rem;">${GAME_VERSION}</span>
            </div>

            <div id="spawn-stuck-warning" style="display: none; position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(231, 76, 60, 0.95); color: white; padding: 15px 30px; font-size: 1.2rem; border-radius: 8px; font-weight: bold; text-align: center; box-shadow: 0 0 20px rgba(0,0,0,0.7); z-index: 9999;">
                SPAWN BLOCKED!
                <span style="font-size: 0.85rem; margin-left: 10px;">Clear traffic or Game Over!</span>
                <span id="countdown-timer" style="font-size: 1.5rem; margin-left: 15px; color: #f1c40f;">10</span>
            </div>

            <div class="stats-panel">
                <div>Score: <span id="score-val" style="color: #2ecc71; font-weight: bold;">0</span></div>
                <div style="font-size: 0.8rem; color: #aaa;">Exited: <span id="exited-val">0</span> | Vehicles: <span id="vehicle-count">0</span></div>
                <div style="font-size: 0.8rem; color: #aaa; margin-top: 2px;">Spawn Rate: <span id="current-spawn-val" style="color: #3498db;">0.0</span>/s</div>
            </div>

            <div class="control-panel" style="margin-top: 10px;">
                <div class="input-group">
                    <label>Sim Speed: <span id="speed-val">1.0x</span></label>
                    <input type="range" id="sim-speed" min="0.1" max="5.0" step="0.1" value="1.0" style="width: 100%;">
                    <div style="font-size: 0.7rem; color: #888;">Tip: Arrow keys or Space to pause</div>
                </div>

                <div style="display: flex; gap: 5px; margin-top: 8px;">
                    <button id="pause-sim" style="flex: 1; padding: 6px; background: #f39c12; border: none; color: white; border-radius: 4px; cursor: pointer;">Pause</button>
                    <button id="reset-sim" style="flex: 1; padding: 6px; background: #95a5a6; border: none; color: white; border-radius: 4px; cursor: pointer;">Reset</button>
                    <button id="back-menu" style="flex: 1; padding: 6px; background: #34495e; border: none; color: white; border-radius: 4px; cursor: pointer;">Menu</button>
                </div>

                <div style="margin-top: 8px;">
                     <button id="reset-rules" style="width: 100%; padding: 5px; background: #7f8c8d; border: 1px dashed #aaa; color: #ddd; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Reset Light Rules to Default</button>
                </div>

                <div style="margin-top: 12px;">
                    <label style="display: flex; align-items: center; color: white; gap: 5px; font-size: 0.9rem; cursor: pointer;">
                        <input type="checkbox" id="debug-toggle"> Enable Debug / Cheats
                    </label>
                </div>

                <div id="debug-panel" style="display: none; margin-top: 10px; padding: 10px; border: 1px solid #c0392b; border-radius: 4px; background: rgba(192, 57, 43, 0.1);">
                    <div style="color: #e74c3c; font-weight: bold; margin-bottom: 8px;">Debug Panel</div>

                    <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="font-size: 0.8rem; color: #3498db; margin-bottom: 5px;">Spawn Controls:</div>
                        <div class="input-group">
                            <label style="font-size: 0.75rem;">Base Rate:</label>
                            <input type="range" id="spawn-rate" min="0.0" max="5.0" step="0.1" value="1.0" style="width: 65%;">
                            <span id="spawn-rate-val" style="font-size: 0.75rem;">1.0x</span>
                        </div>
                        <div style="display: flex; gap: 5px; margin-top: 5px;">
                            <button id="spawn-manual" style="flex: 1; padding: 4px; background: #27ae60; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">+ Spawn Car</button>
                            <button id="clear-cars" style="flex: 1; padding: 4px; background: #c0392b; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Clear All Cars</button>
                        </div>
                    </div>

                    <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="font-size: 0.8rem; color: #f1c40f; margin-bottom: 5px;">Car Physics:</div>
                        <div class="input-group">
                            <label style="font-size: 0.7rem;">Accel:</label>
                            <input type="range" id="car-accel" min="0.001" max="0.05" step="0.001" value="0.008" style="width: 60%;">
                            <span id="accel-val" style="font-size: 0.7rem;">0.008</span>
                        </div>
                        <div class="input-group" style="margin-top: 3px;">
                            <label style="font-size: 0.7rem;">Decel:</label>
                            <input type="range" id="car-decel" min="0.005" max="0.1" step="0.001" value="0.025" style="width: 60%;">
                            <span id="decel-val" style="font-size: 0.7rem;">0.025</span>
                        </div>
                        <div class="input-group" style="margin-top: 3px;">
                            <label style="font-size: 0.7rem;">React:</label>
                            <input type="range" id="car-reaction" min="5" max="60" step="1" value="12" style="width: 60%;">
                            <span id="reaction-val" style="font-size: 0.7rem;">12 ticks</span>
                        </div>
                    </div>

                    <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="font-size: 0.8rem; color: #9b59b6; margin-bottom: 5px;">Behavior:</div>
                        <div class="input-group">
                            <label style="font-size: 0.7rem;">Rebel%:</label>
                            <input type="range" id="rebel-chance" min="0" max="10" step="0.1" value="0" style="width: 65%;">
                            <span id="rebel-val" style="font-size: 0.7rem;">0%</span>
                        </div>
                        <div style="margin-top: 5px; display: flex; flex-direction: column; gap: 3px;">
                            <label style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #ff00ff; cursor: pointer;">
                                <input type="checkbox" id="rebel-debug"> Color Rebels
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #e67e22; cursor: pointer;">
                                <input type="checkbox" id="unstuck-timer-toggle"> Enable Unstuck Timer
                            </label>
                        </div>
                    </div>

                    <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="font-size: 0.8rem; color: #e74c3c; margin-bottom: 5px;">Timeouts (ticks):</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 0.7rem;">
                            <div>
                                <label>Crash Cleanup:</label>
                                <input type="number" id="crash-timeout" value="300" step="60" style="width: 50px; background: #333; color: white; border: 1px solid #555; border-radius: 2px;">
                            </div>
                            <div>
                                <label>Game Over:</label>
                                <input type="number" id="gameover-timeout" value="600" step="100" style="width: 50px; background: #333; color: white; border: 1px solid #555; border-radius: 2px;">
                            </div>
                        </div>
                        <div style="margin-top: 5px; font-size: 0.7rem;">
                            <label>Crash Penalty:</label>
                            <input type="number" id="crash-penalty" value="1000" step="100" style="width: 60px; background: #333; color: white; border: 1px solid #555; border-radius: 2px;">
                        </div>
                    </div>

                    <div>
                        <div style="font-size: 0.8rem; color: #2ecc71; margin-bottom: 5px;">Visual Debug:</div>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; cursor: pointer;">
                            <input type="checkbox" id="debug-draw" checked> Show Paths & Debug Info
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; cursor: pointer; margin-top: 3px;">
                            <input type="checkbox" id="show-queues" checked> Show Spawn Queues
                        </label>
                    </div>
                </div>
            </div>

            <div style="margin-top: 15px; border-top: 1px solid #555; padding-top: 8px;">
                <h4 style="margin: 0 0 5px 0; color: #aaa;">Legend</h4>
                <div style="font-size: 0.75rem; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#f1c40f;"></span> Moving</div>
                    <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#e67e22;"></span> Stuck</div>
                    <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#e74c3c;"></span> Blocked</div>
                    <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#8e44ad;"></span> Crashed</div>
                    <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#3498db;"></span> Selected</div>
                    <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#ff00ff;"></span> Rebel</div>
                </div>
            </div>

            <div id="selection-info" style="margin-top: 12px; padding: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; min-height: 50px;">
                <div style="color: #888; font-size: 0.85rem;">Click a car to track its path</div>
            </div>

            <div style="margin-top: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #f1c40f;">Traffic Lights</h4>
                <div style="font-size: 0.75rem; color: #888; margin-bottom: 8px;">Click intersections on map or configure below</div>
                <div id="lights-list" style="max-height: 300px; overflow-y: auto;"></div>
            </div>

            <div style="margin-top: 15px; border-top: 1px solid #555; padding-top: 8px;">
                <h4 style="margin: 0 0 5px 0;">Log</h4>
                <div id="sim-log" style="height: 80px; overflow-y: auto; font-size: 0.75rem; color: #aaa; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 4px;"></div>
            </div>
        `;

        this.container.appendChild(overlay);
        this.logEl = document.getElementById('sim-log');
        this.scoreEl = document.getElementById('score-val');

        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.showStartScreen();
    }

    private setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;

            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePause();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.adjustSpeed(0.5);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.adjustSpeed(-0.5);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.adjustSpeed(1.0);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.adjustSpeed(-1.0);
                    break;
            }
        });
    }

    private togglePause() {
        const speedSlider = document.getElementById('sim-speed') as HTMLInputElement;
        const pauseBtn = document.getElementById('pause-sim');

        if (this.simulation.timeScale === 0) {
            const val = parseFloat(speedSlider?.value || '1.0');
            this.simulation.timeScale = val;
            if (pauseBtn) pauseBtn.innerText = 'Pause';
        } else {
            this.simulation.timeScale = 0;
            if (pauseBtn) pauseBtn.innerText = 'Resume';
        }
        this.updateSpeedDisplay();
    }

    private adjustSpeed(delta: number) {
        const speedSlider = document.getElementById('sim-speed') as HTMLInputElement;
        if (!speedSlider) return;

        let newVal = parseFloat(speedSlider.value) + delta;
        newVal = Math.max(0.1, Math.min(5.0, newVal));
        speedSlider.value = newVal.toString();
        this.simulation.timeScale = newVal;
        this.updateSpeedDisplay();
    }

    private updateSpeedDisplay() {
        const speedVal = document.getElementById('speed-val');
        if (speedVal) {
            speedVal.innerText = this.simulation.timeScale.toFixed(1) + 'x';
        }
    }

    private setupEventListeners() {
        const speedSlider = document.getElementById('sim-speed') as HTMLInputElement;
        speedSlider?.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.simulation.timeScale = val;
            this.updateSpeedDisplay();
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
            document.getElementById('decel-val')!.innerText = val.toFixed(3);
        });

        document.getElementById('car-reaction')?.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value);
            this.simulation.carReactionTime = val;
            document.getElementById('reaction-val')!.innerText = val + ' ticks';
        });

        document.getElementById('rebel-chance')?.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.simulation.rebelChance = val / 100;
            document.getElementById('rebel-val')!.innerText = val.toFixed(1) + "%";
        });

        document.getElementById('rebel-debug')?.addEventListener('change', (e) => {
            this.simulation.rebelDebug = (e.target as HTMLInputElement).checked;
        });

        document.getElementById('unstuck-timer-toggle')?.addEventListener('change', (e) => {
            this.simulation.unstuckTimerEnabled = (e.target as HTMLInputElement).checked;
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

        document.getElementById('pause-sim')?.addEventListener('click', () => this.togglePause());

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
        this.updateSpeedDisplay();

        (document.getElementById('spawn-rate') as HTMLInputElement).value = "1.0";
        this.simulation.spawnRate = 1.0;
        document.getElementById('spawn-rate-val')!.innerText = "1.0x";

        (document.getElementById('car-accel') as HTMLInputElement).value = "0.006";
        this.simulation.carAcceleration = 0.006;
        document.getElementById('accel-val')!.innerText = "0.006";

        (document.getElementById('car-decel') as HTMLInputElement).value = "0.05";
        this.simulation.carDeceleration = 0.05;
        document.getElementById('decel-val')!.innerText = "0.05";

        (document.getElementById('rebel-chance') as HTMLInputElement).value = "0";
        this.simulation.rebelChance = 0;
        document.getElementById('rebel-val')!.innerText = "0%";

        (document.getElementById('crash-penalty') as HTMLInputElement).value = "1000";
        this.simulation.crashPenalty = 1000;

        (document.getElementById('crash-timeout') as HTMLInputElement).value = "300";
        this.simulation.collisionCleanupTimeout = 300;

        (document.getElementById('gameover-timeout') as HTMLInputElement).value = "600";
        this.simulation.gameOverTimeout = 600;

        document.getElementById('pause-sim')!.innerText = 'Pause';
    }

    private showStartScreen() {
        const startScreen = document.createElement('div');
        startScreen.id = 'start-screen';
        startScreen.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:1000;color:white;font-family:monospace;';

        startScreen.innerHTML = `
            <h1 style="font-size: 4rem; color: #3498db; margin-bottom: 10px; text-shadow: 0 0 20px rgba(52,152,219,0.5);">TRAFFIX</h1>
            <div style="color: #7f8c8d; margin-bottom: 20px;">${GAME_VERSION}</div>
            <div style="max-width: 600px; text-align: center; margin-bottom: 30px; line-height: 1.6;">
                <p>Welcome to <strong>Traffix</strong>, the traffic optimization simulator.</p>
                <p><strong>Goal:</strong> Manage traffic lights to ensure smooth flow. Cars exiting correctly give points.</p>
                <div style="text-align: left; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-top: 15px;">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #f1c40f;">Controls:</div>
                    <div style="font-size: 0.9rem; color: #bdc3c7;">
                        Space - Pause/Resume<br>
                        Left/Right - Adjust speed<br>
                        Click car - Track path<br>
                        Click intersection - Configure lights
                    </div>
                </div>
            </div>
            <h3 style="margin-bottom: 15px; color: #ecf0f1;">Select Level</h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                <button class="level-btn" data-level="tutorial" style="padding: 12px 24px; font-size: 1.1rem; background: #e67e22; color: white; border: none; border-radius: 8px; cursor: pointer;">Tutorial</button>
                <button class="level-btn" data-level="classic" style="padding: 12px 24px; font-size: 1.1rem; background: #27ae60; color: white; border: none; border-radius: 8px; cursor: pointer;">Classic</button>
                <button class="level-btn" data-level="level1" style="padding: 12px 24px; font-size: 1.1rem; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer;">Level 1</button>
                <button class="level-btn" data-level="level2" style="padding: 12px 24px; font-size: 1.1rem; background: #9b59b6; color: white; border: none; border-radius: 8px; cursor: pointer;">Level 2</button>
                <button class="level-btn" data-level="random" style="padding: 12px 24px; font-size: 1.1rem; background: #c0392b; color: white; border: none; border-radius: 8px; cursor: pointer;">Random</button>
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
                this.updateSpeedDisplay();
            });
        });
    }

    private getStateColor(state: string) {
        if (state === 'GREEN') return '#2ecc71';
        if (state === 'YELLOW') return '#f1c40f';
        return '#e74c3c';
    }

    private renderIntersections() {
        if (!this.simulation) return;
        const intersections = this.simulation.getState().intersections as Intersection[];
        const list = document.getElementById('lights-list');
        if (!list) return;
        list.innerHTML = '';

        intersections.forEach((intersection, intIdx) => {
            const div = document.createElement('div');
            div.className = 'intersection-control';
            div.style.cssText = 'margin-bottom:15px;padding:10px;border:1px solid #555;background:rgba(255,255,255,0.03);border-radius:6px;';

            let headerHtml = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <strong style="color:#3498db;font-size:0.95rem;">${intersection.id}</strong>
                    <div style="display:flex;gap:5px;align-items:center;">
                        <select id="preset-${intIdx}" data-int="${intIdx}" class="preset-select" style="font-size:0.7rem;background:#333;color:white;border:1px solid #555;border-radius:3px;padding:2px 5px;">
                            <option value="opposite-phasing" ${intersection.currentPreset === 'opposite-phasing' ? 'selected' : ''}>Opposite</option>
                            <option value="round-robin" ${intersection.currentPreset === 'round-robin' ? 'selected' : ''}>Round-Robin</option>
                            <option value="all-way-stop" ${intersection.currentPreset === 'all-way-stop' ? 'selected' : ''}>All-Way Stop</option>
                            <option value="manual" ${intersection.currentPreset === 'manual' ? 'selected' : ''}>Manual</option>
                        </select>
                        <button class="toggle-phases" data-int="${intIdx}" style="font-size:0.65rem;background:#444;color:white;border:1px solid #555;border-radius:3px;padding:2px 6px;cursor:pointer;">▼</button>
                    </div>
                </div>
                <div class="timing-section" data-int="${intIdx}" style="display:none;">
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:8px;font-size:0.7rem;">
                        <div>
                            <label style="color:#888;">Green:</label>
                            <input type="number" class="timing-input" data-int="${intIdx}" data-timing="green" value="${intersection.presetConfig?.greenDuration || 180}" style="width:40px;background:#333;color:white;border:1px solid #555;border-radius:2px;">
                        </div>
                        <div>
                            <label style="color:#888;">Yellow:</label>
                            <input type="number" class="timing-input" data-int="${intIdx}" data-timing="yellow" value="${intersection.presetConfig?.yellowDuration || 30}" style="width:40px;background:#333;color:white;border:1px solid #555;border-radius:2px;">
                        </div>
                        <div>
                            <label style="color:#888;">All-Red:</label>
                            <input type="number" class="timing-input" data-int="${intIdx}" data-timing="allRed" value="${intersection.presetConfig?.allRedDuration || 30}" style="width:40px;background:#333;color:white;border:1px solid #555;border-radius:2px;">
                        </div>
                    </div>
                </div>
            `;

            let phasesHtml = '<div class="phases-container" data-int="' + intIdx + '" style="max-height:200px;overflow-y:auto;display:none;">';
            intersection.phases.forEach((phase, phaseIdx) => {
                const isCurrent = intersection.currentPhaseIndex === phaseIdx;
                phasesHtml += `
                    <div style="margin-top:4px;padding:5px;border:1px solid ${isCurrent ? '#2ecc71' : '#444'};background:${isCurrent ? 'rgba(46,204,113,0.1)' : 'transparent'};border-radius:3px;">
                        <div style="display:flex;justify-content:space-between;font-size:0.7rem;align-items:center;">
                            <span style="color:${isCurrent ? '#2ecc71' : '#888'};">${phase.name}</span>
                            <span style="color:#666;">${phase.duration}t</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-top:4px;">
                            ${['n','s','e','w'].map(dir => `
                                <div style="text-align:center;">
                                    <div style="font-size:0.6rem;color:#666;">${dir.toUpperCase()}</div>
                                    <div style="width:12px;height:12px;border-radius:50%;margin:0 auto;background:${this.getStateColor(phase.lightStates[dir])};"></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            });
            phasesHtml += '</div>';

            div.innerHTML = headerHtml + phasesHtml;
            list.appendChild(div);
        });

        list.querySelectorAll('.toggle-phases').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const intIdx = (e.target as HTMLButtonElement).getAttribute('data-int')!;
                const phasesContainer = list.querySelector(`.phases-container[data-int="${intIdx}"]`) as HTMLElement;
                const timingSection = list.querySelector(`.timing-section[data-int="${intIdx}"]`) as HTMLElement;
                const button = e.target as HTMLButtonElement;

                if (phasesContainer.style.display === 'none') {
                    phasesContainer.style.display = 'block';
                    timingSection.style.display = 'block';
                    button.innerText = '▲';
                } else {
                    phasesContainer.style.display = 'none';
                    timingSection.style.display = 'none';
                    button.innerText = '▼';
                }
            });
        });

        list.querySelectorAll('.preset-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const intIdx = parseInt((e.target as HTMLSelectElement).getAttribute('data-int')!);
                const preset = (e.target as HTMLSelectElement).value as TrafficLightPreset;
                const intersection = this.simulation.getState().intersections[intIdx] as Intersection;
                intersection.applyPreset(preset);
                this.renderIntersections();
            });
        });

        list.querySelectorAll('.timing-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const intIdx = parseInt((e.target as HTMLInputElement).getAttribute('data-int')!);
                const timing = (e.target as HTMLInputElement).getAttribute('data-timing')!;
                const value = parseInt((e.target as HTMLInputElement).value);
                const intersection = this.simulation.getState().intersections[intIdx] as Intersection;

                if (timing === 'green') intersection.presetConfig.greenDuration = value;
                if (timing === 'yellow') intersection.presetConfig.yellowDuration = value;
                if (timing === 'allRed') intersection.presetConfig.allRedDuration = value;

                if (intersection.currentPreset !== 'manual') {
                    intersection.applyPreset(intersection.currentPreset);
                    this.renderIntersections();
                }
            });
        });
    }

    public update(state: SimulationState) {
        if (state.gameOver) {
            this.showGameOver(state.gameOverReason || "Game Over", state.score);
            return;
        }

        const warningEl = document.getElementById('spawn-stuck-warning');
        const countdownEl = document.getElementById('countdown-timer');
        if (warningEl) {
            const isWarning = state.spawnStuckWarning;
            warningEl.style.display = isWarning ? 'block' : 'none';
            if (isWarning) {
                const speedSlider = document.getElementById('sim-speed') as HTMLInputElement;
                if (speedSlider && this.simulation.timeScale > 1.0) {
                    this.simulation.timeScale = 1.0;
                    speedSlider.value = "1.0";
                    this.updateSpeedDisplay();
                }
                const maxStuck = Math.max(0, ...state.vehicles.map(v => v.spawnStuckTimer || 0));
                const remaining = Math.ceil((this.simulation.gameOverTimeout - maxStuck) / 60);
                if (countdownEl) {
                    countdownEl.innerText = remaining > 0 ? remaining.toString() : "!";
                }
            }
        }

        this.updateScore(state.score, state.exitedCars, state.currentSpawnRate);

        const vehicleCountEl = document.getElementById('vehicle-count');
        if (vehicleCountEl) vehicleCountEl.innerText = state.vehicles.length.toString();

        const selInfo = document.getElementById('selection-info');
        if (selInfo) {
            const selId = this.simulation.selectedVehicleId;
            const vehicle = state.vehicles.find((v: any) => v.id === selId);
            if (vehicle) {
                const isStuck = vehicle.stuckTimer > 600;
                const pathInfo = vehicle.path ? `Path: ${vehicle.currentTargetIndex}/${vehicle.path.length}` : 'No path';
                const destInfo = vehicle.destination ? ` -> (${vehicle.destination.x}, ${vehicle.destination.y})` : '';

                const limitColor = vehicle.limitReason === 'CRUISING' ? '#2ecc71' :
                                   vehicle.limitReason === 'RED_LIGHT' ? '#e74c3c' :
                                   vehicle.limitReason === 'YIELDING' ? '#e67e22' : '#f1c40f';
                selInfo.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                        <strong style="color:#3498db;">${vehicle.id.substring(0,15)}...</strong>
                        <button id="del-veh" data-id="${vehicle.id}" style="padding:2px 8px;font-size:0.7rem;background:#c0392b;color:white;border:none;border-radius:3px;cursor:pointer;">X Delete</button>
                    </div>
                    <div style="font-size:0.8rem;">
                        <div>Pos: (${vehicle.position.x.toFixed(1)}, ${vehicle.position.y.toFixed(1)})${destInfo}</div>
                        <div>Vel: ${vehicle.velocity.toFixed(3)} | State: <span style="color:${isStuck ? '#e74c3c' : '#f1c40f'}">${vehicle.debugState}</span></div>
                        <div>${pathInfo} | Stuck: ${(vehicle.stuckTimer / 60).toFixed(1)}s</div>
                        <div>Reason: <span style="color:${limitColor}">${vehicle.limitReason}</span> | Rebel: ${vehicle.violatesRules ? 'YES' : 'No'}</div>
                    </div>
                `;
            } else {
                selInfo.innerHTML = '<div style="color:#888;font-size:0.85rem;">Click a car to track its path</div>';
                this.simulation.selectedVehicleId = null;
            }
        }

        const list = document.getElementById('lights-list');
        if (list) {
             const intersectionControls = list.querySelectorAll('.intersection-control');
             state.intersections.forEach((intersection: any, i: number) => {
                 const ctrl = intersectionControls[i];
                 if (ctrl) {
                     const phaseContainers = ctrl.querySelectorAll('.phases-container > div');
                     phaseContainers.forEach((pDiv: any, pIdx: number) => {
                         const isCurrent = intersection.currentPhaseIndex === pIdx;
                         pDiv.style.border = `1px solid ${isCurrent ? '#2ecc71' : '#444'}`;
                         pDiv.style.background = isCurrent ? 'rgba(46,204,113,0.1)' : 'transparent';
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
        screen.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(192,57,43,0.95);color:white;padding:40px 60px;border-radius:16px;text-align:center;z-index:10000;font-family:monospace;box-shadow:0 0 50px rgba(0,0,0,0.8);';

        screen.innerHTML = `
            <h1 style="font-size:3rem;margin-bottom:15px;">GAME OVER</h1>
            <p style="font-size:1.2rem;margin-bottom:20px;color:#f5b7b1;">${reason}</p>
            <h2 style="font-size:2rem;margin-bottom:25px;">Final Score: <span style="color:#f1c40f;">${score}</span></h2>
            <div style="font-size:0.9rem;margin-bottom:20px;color:#fadbd8;">
                Total Crashes: ${this.simulation.getTotalCrashes()}
            </div>
            <button id="restart-btn" style="padding:15px 40px;font-size:1.3rem;background:#ecf0f1;color:#2c3e50;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">TRY AGAIN</button>
        `;

        document.body.appendChild(screen);

        document.getElementById('restart-btn')?.addEventListener('click', () => {
            screen.remove();
            this.simulation.reset();
            if ((window as any).renderer) (window as any).renderer.clearCache();
            this.renderIntersections();
            this.updateScore(0, 0, 0);
            this.resetControls();
        });
    }

    public log(msg: string) {
        if (this.logEl) {
            const div = document.createElement('div');
            div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            div.style.padding = '2px 0';
            div.innerText = `> ${msg}`;
            this.logEl.insertBefore(div, this.logEl.firstChild);
            if (this.logEl.childNodes.length > 50) this.logEl.removeChild(this.logEl.lastChild!);
        }
    }

    public showIntersectionPopup(intersectionId: string, screenX: number, screenY: number) {
        this.closeIntersectionPopup();

        const intersections = this.simulation.getState().intersections as Intersection[];
        const intersection = intersections.find(i => i.id === intersectionId);
        if (!intersection) return;

        const popup = document.createElement('div');
        popup.id = 'intersection-popup';
        popup.style.cssText = `position:fixed;left:${screenX}px;top:${screenY}px;background:rgba(0,0,0,0.95);color:white;padding:12px;border-radius:8px;font-family:monospace;z-index:10000;width:200px;box-shadow:0 0 20px rgba(0,0,0,0.5);border:1px solid #3498db;`;

        popup.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <strong style="color:#3498db;font-size:0.9rem;">${intersection.id}</strong>
                <button id="close-popup" style="background:none;border:none;color:#888;cursor:pointer;font-size:1rem;padding:0;line-height:1;">✕</button>
            </div>
            <div style="margin-bottom:8px;">
                <select id="popup-preset" style="width:100%;background:#333;color:white;border:1px solid #555;border-radius:4px;padding:4px;font-size:0.8rem;">
                    <option value="opposite-phasing" ${intersection.currentPreset === 'opposite-phasing' ? 'selected' : ''}>Opposite (N-S / E-W)</option>
                    <option value="round-robin" ${intersection.currentPreset === 'round-robin' ? 'selected' : ''}>Round-Robin</option>
                    <option value="all-way-stop" ${intersection.currentPreset === 'all-way-stop' ? 'selected' : ''}>All-Way Stop</option>
                    <option value="manual" ${intersection.currentPreset === 'manual' ? 'selected' : ''}>Manual</option>
                </select>
            </div>
            <details style="margin-bottom:8px;">
                <summary style="cursor:pointer;color:#888;font-size:0.75rem;">Timing Settings</summary>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:6px;">
                    <div>
                        <label style="font-size:0.65rem;color:#666;">Green</label>
                        <input type="number" id="popup-green" value="${intersection.presetConfig.greenDuration}" style="width:100%;background:#333;color:white;border:1px solid #555;border-radius:3px;padding:2px;font-size:0.75rem;">
                    </div>
                    <div>
                        <label style="font-size:0.65rem;color:#666;">Yellow</label>
                        <input type="number" id="popup-yellow" value="${intersection.presetConfig.yellowDuration}" style="width:100%;background:#333;color:white;border:1px solid #555;border-radius:3px;padding:2px;font-size:0.75rem;">
                    </div>
                    <div>
                        <label style="font-size:0.65rem;color:#666;">All-Red</label>
                        <input type="number" id="popup-allred" value="${intersection.presetConfig.allRedDuration}" style="width:100%;background:#333;color:white;border:1px solid #555;border-radius:3px;padding:2px;font-size:0.75rem;">
                    </div>
                </div>
            </details>
            <button id="apply-popup" style="width:100%;padding:6px;background:#27ae60;color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.8rem;">Apply</button>
        `;

        document.body.appendChild(popup);
        this.intersectionPopup = popup;

        popup.querySelector('#close-popup')?.addEventListener('click', () => this.closeIntersectionPopup());

        popup.querySelector('#apply-popup')?.addEventListener('click', () => {
            const preset = (popup.querySelector('#popup-preset') as HTMLSelectElement).value as TrafficLightPreset;
            const green = parseInt((popup.querySelector('#popup-green') as HTMLInputElement).value);
            const yellow = parseInt((popup.querySelector('#popup-yellow') as HTMLInputElement).value);
            const allRed = parseInt((popup.querySelector('#popup-allred') as HTMLInputElement).value);

            intersection.presetConfig = { greenDuration: green, yellowDuration: yellow, allRedDuration: allRed };
            intersection.applyPreset(preset);
            this.renderIntersections();
            this.closeIntersectionPopup();
        });

        setTimeout(() => {
            document.addEventListener('click', this.handlePopupOutsideClick);
        }, 100);
    }

    private handlePopupOutsideClick = (e: MouseEvent) => {
        if (this.intersectionPopup && !this.intersectionPopup.contains(e.target as Node)) {
            this.closeIntersectionPopup();
        }
    };

    public closeIntersectionPopup() {
        if (this.intersectionPopup) {
            this.intersectionPopup.remove();
            this.intersectionPopup = null;
            document.removeEventListener('click', this.handlePopupOutsideClick);
        }
    }
}
