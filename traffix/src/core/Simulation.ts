import type { SimulationState } from './types';
import { MapGenerator } from './MapGenerator';
import { Car } from '../entities/Car';
import { TrafficLight } from '../entities/TrafficLight';
import { Pathfinding } from './Pathfinding';
import { TrafficLightController } from './TrafficLightController';

import { Intersection } from './Intersection';

export class Simulation {
    private state: SimulationState;
    private tickInterval: number | null = null;
    private readonly TICK_MS = 1000 / 60;
    public timeScale: number = 1.0;
    public selectedVehicleId: string | null = null;
    private width: number;
    private height: number;
    private lightController: TrafficLightController;

    public onTick?: (state: SimulationState) => void;
    public logger?: (msg: string) => void;

    public stuckCleanupTimeout: number = 60000;
    public collisionCleanupTimeout: number = 600; // 10 seconds for crashed cars
    public gameOverTimeout: number = 1200;
    public crashPenalty: number = 1000;
    public currentLevel: string = 'level1';
    public baseSpawnRate: number = 2.0;
    public spawnRate: number = 1.0;
    private spawnAccumulator: number = 0;
    public spawnStuckWarning: boolean = false;
    public carAcceleration: number = 0.02;
    public carDeceleration: number = 0.05;
    public rebelChance: number = 0.005;
    public rebelDebug: boolean = false;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.state = this.createInitialState();
        this.lightController = new TrafficLightController(this.state.intersections as any);
    }

    private createInitialState(): SimulationState {
        const { grid, intersections: intersectionsCoords } = MapGenerator.generateLevel(this.currentLevel, this.width, this.height);

        const lights: TrafficLight[] = [];
        const intersectionMap = new Map<string, TrafficLight[]>();

        const addLightsForIntersection = (cx: number, cy: number, prefix: string) => {
            const intersectionLights: TrafficLight[] = [];
            
            const hasRoad = (dx: number, dy: number) => {
                // Determine stops line coordinates
                let tx = cx;
                let ty = cy;
                if (dx !== 0) tx = dx > 0 ? cx + 2 : cx - 3;
                if (dy !== 0) ty = dy > 0 ? cy + 2 : cy - 3;

                if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return false;
                
                // Check multiple lane offsets to find an incoming lane
                // Road width is 4 (2 lanes each way)
                const heading = dx > 0 ? 'WEST' : dx < 0 ? 'EAST' : dy > 0 ? 'NORTH' : 'SOUTH';
                
                const offsets = [-2, -1, 0, 1];
                for (const off of offsets) {
                    let lx = tx, ly = ty;
                    if (dx !== 0) ly = cy + off;
                    else lx = cx + off;

                    if (lx >= 0 && lx < this.width && ly >= 0 && ly < this.height) {
                        const cell = grid[ly][lx];
                        if (cell.type !== 'empty' && cell.allowedDirections.includes(heading as any)) {
                            return true;
                        }
                    }
                }
                return false;
            };

            if (hasRoad(0, -1)) { // NORTH Check
                intersectionLights.push(new TrafficLight(`${prefix}_n1`, cx - 1, cy - 3));
                intersectionLights.push(new TrafficLight(`${prefix}_n2`, cx - 2, cy - 3));
            }
            if (hasRoad(0, 1)) { // SOUTH Check
                intersectionLights.push(new TrafficLight(`${prefix}_s1`, cx, cy + 2));
                intersectionLights.push(new TrafficLight(`${prefix}_s2`, cx + 1, cy + 2));
            }
            if (hasRoad(-1, 0)) { // WEST Check
                intersectionLights.push(new TrafficLight(`${prefix}_w1`, cx - 3, cy));
                intersectionLights.push(new TrafficLight(`${prefix}_w2`, cx - 3, cy + 1));
            }
            if (hasRoad(1, 0)) { // EAST Check
                intersectionLights.push(new TrafficLight(`${prefix}_e1`, cx + 2, cy - 1));
                intersectionLights.push(new TrafficLight(`${prefix}_e2`, cx + 2, cy - 2));
            }

            intersectionMap.set(prefix, intersectionLights);
            lights.push(...intersectionLights);
        };

        intersectionsCoords.forEach((i, idx) => addLightsForIntersection(i.x, i.y, `int${idx}`));

        const intersections = Array.from(intersectionMap.entries()).map(([id, lts]) => new Intersection(id, lts));

        return {
            tick: 0,
            grid,
            vehicles: [],
            trafficLights: lights,
            intersections: intersections,
            exitedCars: 0,
            score: 0,
            gameOver: false,
            gameOverReason: null,
            rebelDebug: this.rebelDebug,
            currentSpawnRate: this.baseSpawnRate
        };
    }

    public start() {
        if (this.tickInterval) return;
        this.tickInterval = setInterval(() => this.tick(), this.TICK_MS) as any;
    }

    public stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }

    public reset(keepRules: boolean = true) {
        const oldIntersections = this.state.intersections;
        this.stop();
        this.spawnAccumulator = 0;
        this.spawnStuckWarning = false;
        this.state = this.createInitialState();
        
        if (keepRules && oldIntersections) {
             this.state.intersections.forEach(newInt => {
                 const oldInt = oldIntersections.find(old => old.id === newInt.id);
                 if (oldInt) {
                     newInt.phases = JSON.parse(JSON.stringify(oldInt.phases));
                     newInt.currentPhaseIndex = 0;
                     newInt.timer = 0;
                     (newInt as any).applyPhase();
                 }
             });
        }

        this.lightController = new TrafficLightController(this.state.intersections as any);
        this.onTick?.(this.state);
        this.logger?.("Simulation reset.");
        this.start();
    }

    private tick() {
        if (this.timeScale === 0 || this.state.gameOver) return;

        const iterations = Math.max(1, Math.floor(this.timeScale));
        const finalScale = this.timeScale < 1 ? this.timeScale : 1.0;

        for (let i = 0; i < iterations; i++) {
            this.state.tick++;

            // Dynamic Spawn Rate Logic
            // Growth is additive: +1.0 car/sec every 120 ticks
            const growth = (this.state.tick / 120) * 1.0;
            const effectiveBase = this.baseSpawnRate + (this.state.score > 500 ? 2.0 : 0);
            
            // Multiplier only affects the base difficulty, not the time-based growth
            const targetRate = (effectiveBase * this.spawnRate) + growth;
            
            (this.state as any).currentSpawnRate = targetRate;
            this.spawnAccumulator += targetRate / 60;
            
            // Allow spawning multiple vehicles per tick if rate > 60/sec
            while (this.spawnAccumulator >= 1) {
                this.spawnVehicle();
                this.spawnAccumulator -= 1;
            }

            this.lightController.update();

            const carsToRemove: string[] = [];
            let isAnySpawnStuck = false;

            this.state.vehicles.forEach(vehicle => {
                if (vehicle instanceof Car) {
                    // Update vehicle capabilities
                    vehicle.acceleration = this.carAcceleration;
                    vehicle.deceleration = this.carDeceleration;
                    
                    vehicle.update(this.state.trafficLights, this.state.vehicles as Car[], this.state.grid, finalScale);
                    
                    if (vehicle.spawnStuckTimer > 300) isAnySpawnStuck = true;

                    if (vehicle.spawnStuckTimer > this.gameOverTimeout) {
                        this.state.gameOver = true;
                        this.state.gameOverReason = `Gridlock at spawn! Game Over. Final Score: ${this.state.score}`;
                        this.timeScale = 0;
                    }

                    if (vehicle.isCollided) {
                        if (vehicle.collisionTimer > this.collisionCleanupTimeout) {
                            carsToRemove.push(vehicle.id);
                            this.state.score -= this.crashPenalty;
                        }
                    } else if (vehicle.stuckTimer > this.stuckCleanupTimeout) {
                        carsToRemove.push(vehicle.id);
                        this.state.score -= 10;
                    }
                }
            });

            if (isAnySpawnStuck && !this.spawnStuckWarning) {
                this.spawnStuckWarning = true;
                this.timeScale = 1.0;
            } else if (!isAnySpawnStuck) {
                this.spawnStuckWarning = false;
            }
            (this.state as any).spawnStuckWarning = this.spawnStuckWarning;
            this.state.rebelDebug = this.rebelDebug;

            if (carsToRemove.length > 0) {
                this.state.vehicles = this.state.vehicles.filter(v => !carsToRemove.includes(v.id));
                if (this.selectedVehicleId && carsToRemove.includes(this.selectedVehicleId)) this.selectedVehicleId = null;
            }

            this.cleanupVehicles();
            if (this.state.gameOver) break;
        }

        this.onTick?.(this.state);
    }

    private cleanupVehicles() {
        const before = this.state.vehicles.length;
        this.state.vehicles = this.state.vehicles.filter(v => v.currentTargetIndex < v.path.length);
        const exited = before - this.state.vehicles.length;
        if (exited > 0) {
            this.state.exitedCars += exited;
            this.state.score += exited * 10;
        }
    }

    public spawnVehicle() {
        const entries: { x: number, y: number }[] = [];
        this.state.grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.type === 'entry') entries.push({ x, y });
            });
        });

        if (entries.length === 0) return;
        const spawn = entries[Math.floor(Math.random() * entries.length)];

        // Check if spawn point is clear
        const isClear = !this.state.vehicles.some(v =>
            Math.abs(v.position.x - spawn.x) < 1.5 &&
            Math.abs(v.position.y - spawn.y) < 1.5
        );
        if (!isClear) return;

        const possibleExits: { x: number, y: number }[] = [];
        this.state.grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.type === 'exit') {
                    const dist = Math.abs(x - spawn.x) + Math.abs(y - spawn.y);
                    if (dist > 15) possibleExits.push({ x, y });
                }
            });
        });

        if (possibleExits.length > 0) {
            const exit = possibleExits[Math.floor(Math.random() * possibleExits.length)];
            const violates = Math.random() < this.rebelChance;
            const path = Pathfinding.findPath(this.state.grid, { x: spawn.x, y: spawn.y }, { x: exit.x, y: exit.y }, violates);

            if (path) {
                const car = new Car(`car_${this.state.tick}_${Math.random().toString(36).substr(2, 5)}`, { x: spawn.x, y: spawn.y });
                car.violatesRules = violates;
                car.path = path;
                car.destination = { x: exit.x, y: exit.y };
                this.state.vehicles.push(car);
            }
        }
    }

    public getState(): SimulationState { return this.state; }
}
