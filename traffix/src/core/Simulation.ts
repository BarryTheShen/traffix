import type { SimulationState, GridCell, Direction } from './types';
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

    // Game Balance Config
    public stuckCleanupTimeout: number = 1800; // 30 seconds
    public collisionCleanupTimeout: number = 600; // 10 seconds
    public gameOverTimeout: number = 1200; // 20 seconds
    public crashPenalty: number = 100;
    public currentLevel: string = 'level1';
    public baseSpawnRate: number = 1.0;
    public spawnRate: number = 1.0;
    public spawnEnabled: boolean = true;
    
    // Internal State
    private totalCrashes: number = 0;
    private spawnAccumulator: number = 0;
    private lastSpawnTick: Map<string, number> = new Map();
    private countedCrashIds: Set<string> = new Set();
    
    private internalLaneQueues: { [key: string]: number } = {};
    private blockedSpawnIds: Set<string> = new Set();

    // Car Config
    public carAcceleration: number = 0.02;
    public carDeceleration: number = 0.1;
    public rebelChance: number = 0.05; 
    public rebelDebug: boolean = false;
    public collisionRecovery: boolean = true;

    public onTick?: (state: SimulationState) => void;
    public logger?: (msg: string) => void;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.totalCrashes = 0;
        this.state = this.createInitialState();
        this.lightController = new TrafficLightController(this.state.intersections as any);
    }

    public reset(keepRules: boolean = true) {
        this.stop();
        this.totalCrashes = 0;
        this.spawnAccumulator = 0;
        this.lastSpawnTick.clear();
        this.countedCrashIds.clear();
        this.internalLaneQueues = {};
        this.blockedSpawnIds.clear();
        const oldIntersections = this.state.intersections;
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
        this.start();
    }

    private createInitialState(): SimulationState {
        const { grid, intersections: intersectionsCoords } = MapGenerator.generateLevel(this.currentLevel, this.width, this.height);
        const lights: TrafficLight[] = [];
        const intersectionMap = new Map<string, TrafficLight[]>();

        const addLightsForIntersection = (cx: number, cy: number, prefix: string) => {
            const intersectionLights: TrafficLight[] = [];
            const hasIncoming = (dir: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'): boolean => {
                const checkCells: {x: number, y: number}[] = [];
                if (dir === 'NORTH') { for (let x = cx - 2; x < cx + 2; x++) checkCells.push({x, y: cy - 3}); }
                if (dir === 'SOUTH') { for (let x = cx - 2; x < cx + 2; x++) checkCells.push({x, y: cy + 2}); }
                if (dir === 'WEST') { for (let y = cy - 2; y < cy + 2; y++) checkCells.push({x: cx - 3, y}); }
                if (dir === 'EAST') { for (let y = cy - 2; y < cy + 2; y++) checkCells.push({x: cx + 2, y}); }
                const entryDir = (dir === 'NORTH') ? 'SOUTH' : (dir === 'SOUTH') ? 'NORTH' : (dir === 'WEST') ? 'EAST' : 'WEST';
                return checkCells.some(p => {
                    const c = grid[p.y]?.[p.x];
                    return c && (c.type === 'road' || c.type === 'entry') && c.allowedDirections.includes(entryDir);
                });
            };
            if (hasIncoming('NORTH')) { intersectionLights.push(new TrafficLight(`${prefix}_n1`, cx - 1, cy - 3)); intersectionLights.push(new TrafficLight(`${prefix}_n2`, cx - 2, cy - 3)); }
            if (hasIncoming('SOUTH')) { intersectionLights.push(new TrafficLight(`${prefix}_s1`, cx, cy + 2)); intersectionLights.push(new TrafficLight(`${prefix}_s2`, cx + 1, cy + 2)); }
            if (hasIncoming('WEST')) { intersectionLights.push(new TrafficLight(`${prefix}_w1`, cx - 3, cy)); intersectionLights.push(new TrafficLight(`${prefix}_w2`, cx - 3, cy + 1)); }
            if (hasIncoming('EAST')) { intersectionLights.push(new TrafficLight(`${prefix}_e1`, cx + 2, cy - 1)); intersectionLights.push(new TrafficLight(`${prefix}_e2`, cx + 2, cy - 2)); }
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
            collisionRecovery: this.collisionRecovery,
            currentSpawnRate: this.baseSpawnRate,
            laneQueues: {},
            blockedSpawnIds: []
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

    public tick() {
        if (this.timeScale === 0 || this.state.gameOver) return;
        const iterations = Math.max(1, Math.floor(this.timeScale));
        const finalScale = this.timeScale < 1 ? this.timeScale : 1.0;

        for (let i = 0; i < iterations; i++) {
            this.state.tick++;
            
            // Linear growth: 0.1/s^2 -> increase by 1 every 600 ticks
            const growth = (this.state.tick / 600);
            const targetRate = (this.baseSpawnRate * this.spawnRate) + growth;
            (this.state as any).currentSpawnRate = Math.min(targetRate, 50.0);
            
            if (this.spawnEnabled) {
                this.spawnAccumulator += targetRate / 60;
                while (this.spawnAccumulator >= 1) {
                    this.enqueueSpawn();
                    this.spawnAccumulator -= 1;
                }
                this.processLaneQueues();
            }

            this.lightController.update();
            this.updateVehicles(finalScale);
            
            // Sync state for UI/Renderer
            this.state.laneQueues = { ...this.laneQueues };
            this.state.blockedSpawnIds = Array.from(this.blockedSpawnIds);
            
            // AUTO SPEED DOWN ON WARNING
            if (this.state.spawnStuckWarning && this.timeScale > 1.0) {
                this.timeScale = 1.0;
            }

            if (this.state.gameOver) break;
        }
        this.onTick?.(this.state);
    }

    private enqueueSpawn() {
        const entries: { x: number, y: number }[] = [];
        this.state.grid.forEach((row, y) => {
            row.forEach((cell, x) => { if (cell.type === 'entry') entries.push({ x, y }); });
        });
        if (entries.length === 0) return;
        const spawn = entries[Math.floor(Math.random() * entries.length)];
        const key = `${spawn.x},${spawn.y}`;
        this.internalLaneQueues[key] = (this.internalLaneQueues[key] || 0) + 1;
    }

    private processLaneQueues() {
        this.blockedSpawnIds.clear();
        for (const key in this.internalLaneQueues) {
            const count = this.internalLaneQueues[key];
            if (count <= 0) continue;
            const [sx, sy] = key.split(',').map(Number);
            
            let spawned = 0;
            while (spawned < count) {
                if (this.trySpawnAt(sx, sy)) spawned++;
                else { this.blockedSpawnIds.add(key); break; }
            }
            if (spawned > 0) this.internalLaneQueues[key] -= spawned;
        }
    }

    private updateVehicles(timeScale: number) {
        const carsToRemove: string[] = [];
        let isAnySpawnStuck = false;
        this.state.rebelDebug = this.rebelDebug;

        this.state.vehicles.forEach(vehicle => {
            const car = vehicle as Car;
            const wasCollided = car.isCollided;
            car.update(this.state.trafficLights, this.state.vehicles as Car[], this.state.grid, timeScale);
            if (!wasCollided && car.isCollided) {
                this.totalCrashes++;
                this.countedCrashIds.add(car.id);
            }

            // Warning if within 10 seconds of game over (600 ticks remaining)
            if (car.spawnStuckTimer > 600) isAnySpawnStuck = true;

            if (car.spawnStuckTimer > this.gameOverTimeout) {
                this.state.gameOver = true;
                this.state.gameOverReason = `Entry point blocked!`;
                this.timeScale = 0;
            }
            if (car.isCollided) {
                if (car.collisionTimer > this.collisionCleanupTimeout) carsToRemove.push(car.id);
            } else if (car.stuckTimer > this.stuckCleanupTimeout) {
                carsToRemove.push(car.id);
            }
        });

        this.state.spawnStuckWarning = isAnySpawnStuck;

        if (carsToRemove.length > 0) {
            this.state.vehicles = this.state.vehicles.filter(v => !carsToRemove.includes(v.id));
        }
        this.cleanupExitedVehicles();
    }

    private cleanupExitedVehicles() {
        const before = this.state.vehicles.length;
        this.state.vehicles = this.state.vehicles.filter(v => v.currentTargetIndex < v.path.length);
        const exited = before - this.state.vehicles.length;
        if (exited > 0) { this.state.exitedCars += exited; this.state.score += exited * 30; }
    }

    private trySpawnAt(x: number, y: number): boolean {
        for (const v of this.state.vehicles) {
            if (Math.abs(v.position.x - x) < 1.1 && Math.abs(v.position.y - y) < 1.1) return false;
        }
        const possibleExits: { x: number, y: number }[] = [];
        this.state.grid.forEach((row, gy) => {
            row.forEach((cell, gx) => { if (cell.type === 'exit') { if (Math.abs(gx - x) + Math.abs(gy - y) > 15) possibleExits.push({ x: gx, y: gy }); } });
        });
        if (possibleExits.length > 0) {
            const exit = possibleExits[Math.floor(Math.random() * possibleExits.length)];
            const violates = Math.random() < this.rebelChance;
            const path = Pathfinding.findPath(this.state.grid, { x, y }, { x: exit.x, y: exit.y }, violates);
            if (path) {
                const car = new Car(`car_${this.state.tick}_${Math.random().toString(36).substr(2, 5)}`, { x, y });
                car.violatesRules = violates; car.path = path; car.destination = { x: exit.x, y: exit.y };
                this.state.vehicles.push(car); return true;
            }
        }
        return false;
    }

    public getState(): SimulationState { return this.state; }
}
