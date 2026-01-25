import type { SimulationState, Vector2D } from './types';
import { MapGenerator } from './MapGenerator';
import { Car } from '../entities/Car';
import { TrafficLight } from '../entities/TrafficLight';
import { Pathfinding } from './Pathfinding';
import { TrafficLightController } from './TrafficLightController';
import { Intersection } from './Intersection';

// Version constant
export const GAME_VERSION = 'v0.2.0.1';

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
    public stuckCleanupTimeout: number = 2700;
    public collisionCleanupTimeout: number = 300;
    public gameOverTimeout: number = 3000;
    public crashPenalty: number = 1000;
    public currentLevel: string = 'level1';
    public baseSpawnRate: number = 1.0;
    public spawnRate: number = 1.0;
    public spawnEnabled: boolean = true;

    // Internal State
    private totalCrashes: number = 0;
    private spawnAccumulator: number = 0;
    private lastSpawnTick: Map<string, number> = new Map();
    private countedCrashIds: Set<string> = new Set();
    public totalSpawned: number = 0;

    private internalLaneQueues: { [key: string]: number } = {};
    private blockedSpawnIds: Set<string> = new Set();

    // Cached exit data for homogeneous exits
    private exitsByRoad: Map<string, Vector2D[]> = new Map();

    // Car Config (synced to carConfig global)
    public carAcceleration: number = 0.008;
    public carDeceleration: number = 0.025;
    public carReactionTime: number = 20;
    public rebelChance: number = 0.0; // Default 0% for benchmark
    public rebelDebug: boolean = false;
    public collisionRecovery: boolean = true;
    public unstuckTimerEnabled: boolean = false; // Disabled by default for benchmark

    public onTick?: (state: SimulationState) => void;
    public logger?: (msg: string) => void;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.totalCrashes = 0;
        this.state = this.createInitialState();
        this.lightController = new TrafficLightController(this.state.intersections as any);
        this.cacheExitData();
    }

    private cacheExitData() {
        // Build exit cache for homogeneous exit selection
        this.exitsByRoad = Pathfinding.findExitsByRoad(this.state.grid);
    }

    public reset(keepRules: boolean = true) {
        this.stop();
        this.totalCrashes = 0;
        this.totalSpawned = 0;
        this.spawnAccumulator = 0;
        this.lastSpawnTick.clear();
        this.countedCrashIds.clear();
        this.internalLaneQueues = {};
        this.blockedSpawnIds.clear();
        const oldIntersections = this.state.intersections;
        this.state = this.createInitialState();
        this.cacheExitData();
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
            blockedSpawnIds: [],
            spawnStuckWarning: false
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
            // GROWTH RATE FIX: 0.02 car/s^2 -> tick / 3000
            const growth = (this.state.tick / 3000);
            const baseTargetRate = (this.baseSpawnRate * this.spawnRate) + growth;

            // Adaptive spawn rate: reduce when queues are building up
            const totalQueued = Object.values(this.internalLaneQueues).reduce((a, b) => a + b, 0);
            const blockedFraction = this.blockedSpawnIds.size > 0 ? this.blockedSpawnIds.size / Math.max(1, Object.keys(this.internalLaneQueues).length) : 0;
            const queuePenalty = Math.min(1.0, totalQueued * 0.1 + blockedFraction * 0.5);
            const targetRate = Math.max(0.1, baseTargetRate * (1.0 - queuePenalty));

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

            // Map internal queue keys back to grid cells for UI
            this.state.laneQueues = {};
            const blockedIds: string[] = [];
            this.state.grid.forEach((row, y) => row.forEach((cell, x) => {
                if (cell.type === 'entry') {
                    const cellKey = cell.roadId || `entry_${x}_${y}`;
                    const coordKey = `${x},${y}`;
                    const count = this.internalLaneQueues[cellKey] || 0;
                    if (count > 0) this.state.laneQueues[coordKey] = count;
                    if (this.blockedSpawnIds.has(cellKey)) blockedIds.push(coordKey);
                }
            }));
            this.state.blockedSpawnIds = blockedIds;

            if (this.state.spawnStuckWarning && this.timeScale > 1.0) {
                this.timeScale = 1.0;
            }
            if (this.state.gameOver) break;
        }
        this.onTick?.(this.state);
    }

    private enqueueSpawn() {
        const entries: { x: number, y: number, key: string }[] = [];
        this.state.grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.type === 'entry') {
                    // Use roadId if available, otherwise use coordinate-based key
                    const key = cell.roadId || `entry_${x}_${y}`;
                    entries.push({ x, y, key });
                }
            });
        });
        if (entries.length === 0) return;

        // Get unique queue keys and pick one randomly
        const uniqueKeys = Array.from(new Set(entries.map(e => e.key)));
        const targetKey = uniqueKeys[Math.floor(Math.random() * uniqueKeys.length)];
        this.internalLaneQueues[targetKey] = (this.internalLaneQueues[targetKey] || 0) + 1;
    }

    private processLaneQueues() {
        this.blockedSpawnIds.clear();
        for (const queueKey in this.internalLaneQueues) {
            const count = this.internalLaneQueues[queueKey];
            if (count <= 0) continue;

            const laneCells: {x: number, y: number}[] = [];
            this.state.grid.forEach((row, y) => {
                row.forEach((cell, x) => {
                    if (cell.type === 'entry') {
                        const cellKey = cell.roadId || `entry_${x}_${y}`;
                        if (cellKey === queueKey) laneCells.push({x, y});
                    }
                });
            });

            let spawned = false;
            for (const cell of laneCells) {
                if (this.trySpawnAt(cell.x, cell.y)) {
                    this.internalLaneQueues[queueKey] = count - 1;
                    spawned = true;
                    break;
                }
            }

            if (!spawned) {
                this.blockedSpawnIds.add(queueKey);
            }
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
                this.state.score -= this.crashPenalty; // Apply crash penalty to score
            }
            if (car.spawnStuckTimer > 600) isAnySpawnStuck = true;
            if (car.spawnStuckTimer > this.gameOverTimeout) {
                this.state.gameOver = true;
                this.state.gameOverReason = `Entry point blocked!`;
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
        // Enhanced collision zone check - ensure no overlap with existing vehicles
        const SPAWN_CLEARANCE = 1.5; // Minimum center-to-center distance for spawning
        for (const v of this.state.vehicles) {
            const dx = Math.abs(v.position.x - x);
            const dy = Math.abs(v.position.y - y);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < SPAWN_CLEARANCE) return false;
        }

        // Get the entry cell to determine which exits are valid based on lane type
        const entryCell = this.state.grid[y]?.[x];
        if (!entryCell) return false;

        // Use cached exits grouped by road for homogeneous exit selection
        const roadIds = Array.from(this.exitsByRoad.keys());
        if (roadIds.length === 0) return false;

        // Filter to roads that DON'T contain this entry (can't exit where you entered)
        const entryRoadId = entryCell.roadId;
        const validRoadIds = roadIds.filter(rid => rid !== entryRoadId);
        if (validRoadIds.length === 0) return false;

        // Pick a random destination road
        const targetRoadId = validRoadIds[Math.floor(Math.random() * validRoadIds.length)];
        const targetExits = this.exitsByRoad.get(targetRoadId)!;

        // Try each exit lane on the target road (homogeneous - any lane works)
        // Shuffle to avoid always picking the same one
        const shuffledExits = [...targetExits].sort(() => Math.random() - 0.5);

        for (const exitCell of shuffledExits) {
            // Determine if car should be a rebel
            const isRebel = Math.random() < this.rebelChance;

            // Find path using appropriate lane preference
            const path = Pathfinding.findPath(
                this.state.grid,
                { x, y },
                { x: exitCell.x, y: exitCell.y },
                isRebel,  // Rebels ignore lane rules
                entryCell.laneType  // Prefer starting lane type
            );

            if (path && path.length > 1) {
                const car = new Car(
                    `car_${this.state.tick}_${Math.random().toString(36).substr(2, 5)}`,
                    { x, y }
                );
                car.path = path;
                car.destination = { x: exitCell.x, y: exitCell.y };
                car.violatesRules = isRebel;
                car.acceleration = this.carAcceleration;
                car.deceleration = this.carDeceleration;
                car.reactionTime = this.carReactionTime;
                this.state.vehicles.push(car);
                this.totalSpawned++;
                return true;
            }
        }

        return false;
    }

    public spawnVehicle() {
        // Manual spawn - pick random entry and spawn
        const entries: { x: number, y: number }[] = [];
        this.state.grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.type === 'entry') entries.push({ x, y });
            });
        });
        if (entries.length === 0) return;
        const entry = entries[Math.floor(Math.random() * entries.length)];
        this.trySpawnAt(entry.x, entry.y);
    }

    public getState(): SimulationState {
        this.state.selectedVehicleId = this.selectedVehicleId;
        return this.state;
    }

    public getTotalCrashes(): number { return this.totalCrashes; }
}