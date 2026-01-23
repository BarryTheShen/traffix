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
    public stuckCleanupTimeout: number = 1800; 
    public collisionCleanupTimeout: number = 600; 
    public gameOverTimeout: number = 1200; 
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
    public carAcceleration: number = 0.006;
    public carDeceleration: number = 0.05;
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
            
            // Map internal roadId queues back to grid cells for UI
            this.state.laneQueues = {};
            const blockedIds: string[] = [];
            this.state.grid.forEach((row, y) => row.forEach((cell, x) => {
                if (cell.type === 'entry' && cell.roadId) {
                    const key = `${x},${y}`;
                    const count = this.internalLaneQueues[cell.roadId] || 0;
                    if (count > 0) this.state.laneQueues[key] = count;
                    if (this.blockedSpawnIds.has(cell.roadId)) blockedIds.push(key);
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
        const entries: { x: number, y: number, roadId: string }[] = [];
        this.state.grid.forEach((row, y) => {
            row.forEach((cell, x) => { 
                if (cell.type === 'entry' && cell.roadId) {
                    entries.push({ x, y, roadId: cell.roadId });
                }
            });
        });
        if (entries.length === 0) return;
        
        const uniqueRoadIds = Array.from(new Set(entries.map(e => e.roadId)));
        const targetRoadId = uniqueRoadIds[Math.floor(Math.random() * uniqueRoadIds.length)];
        this.internalLaneQueues[targetRoadId] = (this.internalLaneQueues[targetRoadId] || 0) + 1;
    }

    private processLaneQueues() {
        this.blockedSpawnIds.clear();
        for (const roadId in this.internalLaneQueues) {
            const count = this.internalLaneQueues[roadId];
            if (count <= 0) continue;
            
            const laneCells: {x: number, y: number}[] = [];
            this.state.grid.forEach((row, y) => {
                row.forEach((cell, x) => {
                    if (cell.type === 'entry' && cell.roadId === roadId) laneCells.push({x, y});
                });
            });

            let spawned = false;
            for (const cell of laneCells) {
                if (this.trySpawnAt(cell.x, cell.y)) {
                    this.internalLaneQueues[roadId] = count - 1;
                    spawned = true;
                    break;
                }
            }

            if (!spawned) {
                this.blockedSpawnIds.add(roadId);
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
        // High-precision collision zone check (1.1 units center-to-center)
        for (const v of this.state.vehicles) {
            const dx = Math.abs(v.position.x - x);
            const dy = Math.abs(v.position.y - y);
            if (dx < 0.5 && dy < 1.1) return false; 
            if (dy < 0.5 && dx < 1.1) return false; 
        }
        
        const exitRoads = new Map<string, {x: number, y: number}[]>();
        this.state.grid.forEach((row, gy) => {
            row.forEach((cell, gx) => { 
                if (cell.type === 'exit' && cell.roadId) {
                    if (!exitRoads.has(cell.roadId)) exitRoads.set(cell.roadId, []);
                    exitRoads.get(cell.roadId)!.push({x: gx, y: gy});
                }
            });
        });

        const roadIds = Array.from(exitRoads.keys());
        if (roadIds.length > 0) {
            const targetRoadId = roadIds[Math.floor(Math.random() * roadIds.length)];
            const targetLanes = exitRoads.get(targetRoadId)!;
            
            // Prefer exit in SAME LANE alignment to minimize crossing
            targetLanes.sort((a, b) => {
                const distA = Math.min(Math.abs(a.x - x), Math.abs(a.y - y));
                const distB = Math.min(Math.abs(b.x - x), Math.abs(b.y - y));
                return distA - distB;
            });

            const exitCell = targetLanes[0];
            const path = Pathfinding.findPath(this.state.grid, { x, y }, { x: exitCell.x, y: exitCell.y }, false);
            if (path) {
                const car = new Car(`car_${this.state.tick}_${Math.random().toString(36).substr(2, 5)}`, { x, y });
                car.path = path; car.destination = { x: exitCell.x, y: exitCell.y };
                this.state.vehicles.push(car); return true;
            }
        }
        return false;
    }

    public getState(): SimulationState { return this.state; }
}