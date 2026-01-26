import type { SimulationState, Vector2D } from './types';
import { MapGenerator } from './MapGenerator';
import { Car } from '../entities/Car';
import { TrafficLight } from '../entities/TrafficLight';
import { Pathfinding } from './Pathfinding';
import { TrafficLightController } from './TrafficLightController';
import { Intersection } from './Intersection';

// Version constant
export const GAME_VERSION = 'v0.2.2';

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
    public gameOverTimeout: number = 600;
    public crashPenalty: number = 1000;
    public currentLevel: string = 'level1';
    public mapComplexity: number = 3;  // 1-5 for random maps
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
    public carReactionTime: number = 12;
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
        const { grid, intersections: intersectionsCoords } = MapGenerator.generateLevel(this.currentLevel, this.width, this.height, this.mapComplexity);
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
            // GROWTH RATE: Slower growth (tick/6000 = ~0.01 car/s² at 60fps)
            const growth = (this.state.tick / 6000);
            const baseTargetRate = (this.baseSpawnRate * this.spawnRate) + growth;

            // Display the THEORETICAL spawn rate (no cap - allow complete gridlock)
            (this.state as any).currentSpawnRate = baseTargetRate;

            // Adaptive spawn rate: reduce when queues are building up
            const totalQueued = Object.values(this.internalLaneQueues).reduce((a, b) => a + b, 0);
            const blockedFraction = this.blockedSpawnIds.size > 0 ? this.blockedSpawnIds.size / Math.max(1, Object.keys(this.internalLaneQueues).length) : 0;
            const queuePenalty = Math.min(1.0, totalQueued * 0.1 + blockedFraction * 0.5);
            const targetRate = Math.max(0.1, baseTargetRate * (1.0 - queuePenalty));

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
                    // Use coordinate-based key (must match enqueueSpawn format)
                    const cellKey = `entry_${x}_${y}`;
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
        // Collect ALL entry cells
        const entries: { x: number, y: number, key: string }[] = [];
        this.state.grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.type === 'entry') {
                    // Always use coordinate-based key for consistent parsing
                    const key = `entry_${x}_${y}`;
                    entries.push({ x, y, key });
                }
            });
        });
        if (entries.length === 0) return;

        // Pick random entry cell directly (uniform distribution)
        const entry = entries[Math.floor(Math.random() * entries.length)];
        this.internalLaneQueues[entry.key] = (this.internalLaneQueues[entry.key] || 0) + 1;
    }

    private processLaneQueues() {
        this.blockedSpawnIds.clear();
        for (const queueKey in this.internalLaneQueues) {
            const count = this.internalLaneQueues[queueKey];
            if (count <= 0) continue;

            // Parse coordinates from key (format: entry_X_Y)
            const parts = queueKey.split('_');
            if (parts.length < 3) continue;
            const x = parseInt(parts[1]);
            const y = parseInt(parts[2]);

            if (this.trySpawnAt(x, y)) {
                this.internalLaneQueues[queueKey] = count - 1;
            } else {
                this.blockedSpawnIds.add(queueKey);
            }
        }
    }

    private updateVehicles(timeScale: number) {
        const carsToRemove: string[] = [];
        let isAnySpawnStuck = false;
        this.state.rebelDebug = this.rebelDebug;

        // Warning threshold: show warning 5 seconds before game over
        const warningThreshold = Math.max(60, this.gameOverTimeout - 300);

        this.state.vehicles.forEach(vehicle => {
            const car = vehicle as Car;
            const wasCollided = car.isCollided;
            car.update(this.state.trafficLights, this.state.vehicles as Car[], this.state.grid, timeScale);
            if (!wasCollided && car.isCollided) {
                this.totalCrashes++;
                this.countedCrashIds.add(car.id);
                this.state.score -= this.crashPenalty; // Apply crash penalty to score
            }
            // Show warning 5 seconds before game over
            if (car.spawnStuckTimer > warningThreshold) isAnySpawnStuck = true;
            if (car.spawnStuckTimer > this.gameOverTimeout) {
                this.state.gameOver = true;
                this.state.gameOverReason = `Entry point blocked!`;
            }

            // Reroute stuck cars (not at spawn) - try to find a new path
            if (!car.isCollided && car.stuckTimer > 0 && car.stuckTimer % 120 === 0 && car.spawnStuckTimer === 0) {
                this.tryRerouteCar(car);
            }

            // Smart lane change for moving cars going straight - check every 60 ticks
            if (!car.isCollided && car.velocity > 0.05 && car.lifeTicks % 60 === 0) {
                this.trySmartLaneChange(car);
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

    /**
     * Attempt to reroute a stuck car.
     * First tries to recalculate path to SAME destination from current position.
     * This handles cases where car is in wrong lane for its intended turn.
     * If that fails, try finding path to same road (different lane exit).
     */
    private tryRerouteCar(car: Car): boolean {
        const gridX = Math.floor(car.position.x);
        const gridY = Math.floor(car.position.y);
        const currentCell = this.state.grid[gridY]?.[gridX];

        // Only reroute from road or intersection cells
        if (!currentCell || currentCell.type === 'empty' || currentCell.type === 'entry') return false;
        if (!car.destination) return false;

        // First: Try to recalculate path to SAME destination from current position
        // This handles "wrong lane" situations - find a new route to same exit
        const newPath = Pathfinding.findPath(
            this.state.grid,
            { x: gridX, y: gridY },
            { x: car.destination.x, y: car.destination.y },
            car.violatesRules,
            currentCell.laneType
        );

        if (newPath && newPath.length > 1) {
            car.path = newPath;
            car.currentTargetIndex = 0;
            car.stuckTimer = 0;
            return true;
        }

        // Second: Try to find an alternative exit on the SAME ROAD as original destination
        // This keeps the car going roughly the same direction
        const destCell = this.state.grid[car.destination.y]?.[car.destination.x];
        if (destCell && destCell.roadId) {
            const sameRoadExits = this.exitsByRoad.get(destCell.roadId) || [];
            for (const exit of sameRoadExits) {
                if (exit.x === car.destination.x && exit.y === car.destination.y) continue;
                const altPath = Pathfinding.findPath(
                    this.state.grid,
                    { x: gridX, y: gridY },
                    { x: exit.x, y: exit.y },
                    car.violatesRules,
                    currentCell.laneType
                );
                if (altPath && altPath.length > 1) {
                    car.path = altPath;
                    car.destination = { x: exit.x, y: exit.y };
                    car.currentTargetIndex = 0;
                    car.stuckTimer = 0;
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Smart lane change for cars going straight.
     * If a car is going straight and the other lane has significantly fewer cars,
     * recalculate path to use the faster lane.
     */
    private trySmartLaneChange(car: Car): boolean {
        if (!car.destination) return false;

        const gridX = Math.floor(car.position.x);
        const gridY = Math.floor(car.position.y);
        const currentCell = this.state.grid[gridY]?.[gridX];

        // Only on road cells, not intersections or entry/exit
        if (!currentCell || currentCell.type !== 'road') return false;

        const currentDir = currentCell.allowedDirections[0];
        if (!currentDir) return false;

        // Check if car is going straight (current direction matches exit direction)
        const destCell = this.state.grid[car.destination.y]?.[car.destination.x];
        if (!destCell) return false;
        const destDir = destCell.allowedDirections[0];
        if (!destDir) return false;

        const turnType = this.getTurnType(currentDir, destDir);
        if (turnType !== 'STRAIGHT') return false;  // Only change lanes for straight routes

        // Find the adjacent lane cell
        const partnerLane = this.findAdjacentLaneCell(gridX, gridY, currentDir);
        if (!partnerLane) return false;

        // Count cars ahead in current lane vs partner lane
        const currentLaneCars = this.countCarsInLane(gridX, gridY, currentDir);
        const partnerLaneCars = this.countCarsInLane(partnerLane.x, partnerLane.y, currentDir);

        // Only change if partner lane has significantly fewer cars (at least 2 fewer)
        if (partnerLaneCars >= currentLaneCars - 1) return false;

        // Check if partner lane is clear for lane change (no car right next to us)
        for (const v of this.state.vehicles) {
            if (v.id === car.id) continue;
            const dx = Math.abs(v.position.x - partnerLane.x);
            const dy = Math.abs(v.position.y - partnerLane.y);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1.5) return false;  // Partner lane blocked
        }

        // Try to find path from partner lane position to same destination
        const partnerCell = this.state.grid[partnerLane.y]?.[partnerLane.x];
        if (!partnerCell) return false;

        const newPath = Pathfinding.findPath(
            this.state.grid,
            { x: partnerLane.x, y: partnerLane.y },
            { x: car.destination.x, y: car.destination.y },
            car.violatesRules,
            partnerCell.laneType
        );

        if (newPath && newPath.length > 1) {
            // Lane change successful - update path
            car.path = newPath;
            car.currentTargetIndex = 0;
            // Move car to partner lane
            car.position.x = partnerLane.x + 0.5;
            car.position.y = partnerLane.y + 0.5;
            return true;
        }

        return false;
    }

    /**
     * Find the adjacent lane cell (same road, opposite lane type)
     */
    private findAdjacentLaneCell(x: number, y: number, direction: string): { x: number, y: number } | null {
        const cell = this.state.grid[y]?.[x];
        if (!cell) return null;

        const targetLaneType = cell.laneType === 'INNER' ? 'OUTER' : 'INNER';

        // Search adjacent cells based on road direction
        // For N/S roads, adjacent lane is left/right (x +/- 1)
        // For E/W roads, adjacent lane is up/down (y +/- 1)
        const offsets = (direction === 'NORTH' || direction === 'SOUTH')
            ? [[-1, 0], [1, 0]]
            : [[0, -1], [0, 1]];

        for (const [dx, dy] of offsets) {
            const nx = x + dx;
            const ny = y + dy;
            const neighbor = this.state.grid[ny]?.[nx];
            if (neighbor &&
                neighbor.type === 'road' &&
                neighbor.laneType === targetLaneType &&
                neighbor.allowedDirections.includes(direction as any)) {
                return { x: nx, y: ny };
            }
        }
        return null;
    }

    private cleanupExitedVehicles() {
        const before = this.state.vehicles.length;
        this.state.vehicles = this.state.vehicles.filter(v => v.currentTargetIndex < v.path.length);
        const exited = before - this.state.vehicles.length;
        if (exited > 0) { this.state.exitedCars += exited; this.state.score += exited * 30; }
    }

    /**
     * Determine the turn type from entry to exit direction.
     */
    private getTurnType(entryDir: string, exitDir: string): 'STRAIGHT' | 'LEFT' | 'RIGHT' | 'UTURN' {
        if (entryDir === exitDir) return 'STRAIGHT';
        const turnMap: Record<string, Record<string, 'LEFT' | 'RIGHT' | 'UTURN'>> = {
            'NORTH': { 'WEST': 'LEFT', 'EAST': 'RIGHT', 'SOUTH': 'UTURN' },
            'SOUTH': { 'EAST': 'LEFT', 'WEST': 'RIGHT', 'NORTH': 'UTURN' },
            'EAST':  { 'NORTH': 'LEFT', 'SOUTH': 'RIGHT', 'WEST': 'UTURN' },
            'WEST':  { 'SOUTH': 'LEFT', 'NORTH': 'RIGHT', 'EAST': 'UTURN' }
        };
        return turnMap[entryDir]?.[exitDir] || 'STRAIGHT';
    }

    /**
     * Count cars in a lane ahead of a given position.
     * Uses the road direction to determine what "ahead" means.
     */
    private countCarsInLane(laneX: number, laneY: number, direction: string): number {
        let count = 0;
        for (const v of this.state.vehicles) {
            const carX = Math.floor(v.position.x);
            const carY = Math.floor(v.position.y);
            const cell = this.state.grid[carY]?.[carX];

            // Only count cars on the same road direction
            if (!cell || !cell.allowedDirections.includes(direction as any)) continue;

            // Check if car is "ahead" based on direction
            switch (direction) {
                case 'NORTH': if (carY < laneY && Math.abs(carX - laneX) < 2) count++; break;
                case 'SOUTH': if (carY > laneY && Math.abs(carX - laneX) < 2) count++; break;
                case 'EAST': if (carX > laneX && Math.abs(carY - laneY) < 2) count++; break;
                case 'WEST': if (carX < laneX && Math.abs(carY - laneY) < 2) count++; break;
            }
        }
        return count;
    }

    /**
     * Find the partner lane entry for a given entry cell.
     * Partner lane is the other lane (INNER<->OUTER) on the same road with same direction.
     */
    private findPartnerLaneEntry(x: number, y: number): { x: number, y: number } | null {
        const cell = this.state.grid[y]?.[x];
        if (!cell || cell.type !== 'entry') return null;

        const direction = cell.allowedDirections[0];
        const targetLaneType = cell.laneType === 'INNER' ? 'OUTER' : 'INNER';

        // Search adjacent cells for the partner lane
        const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of offsets) {
            const nx = x + dx;
            const ny = y + dy;
            const neighbor = this.state.grid[ny]?.[nx];
            if (neighbor &&
                neighbor.type === 'entry' &&
                neighbor.laneType === targetLaneType &&
                neighbor.allowedDirections.includes(direction)) {
                return { x: nx, y: ny };
            }
        }
        return null;
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

        // Determine the entry direction and exit direction to calculate turn type
        const entryDir = entryCell.allowedDirections[0];

        for (const exitPos of shuffledExits) {
            const exitCell = this.state.grid[exitPos.y]?.[exitPos.x];
            if (!exitCell) continue;

            // Exit direction is where the car will be heading when it exits
            const exitDir = exitCell.allowedDirections[0];
            const turnType = this.getTurnType(entryDir, exitDir);

            // Smart Lane Selection for STRAIGHT routes
            let spawnX = x;
            let spawnY = y;
            let spawnCell = entryCell;

            if (turnType === 'STRAIGHT') {
                // For straight routes, either lane works - pick the less congested one
                const partnerEntry = this.findPartnerLaneEntry(x, y);
                if (partnerEntry) {
                    const currentLaneCars = this.countCarsInLane(x, y, entryDir);
                    const partnerLaneCars = this.countCarsInLane(partnerEntry.x, partnerEntry.y, entryDir);

                    // Check if partner lane is clear for spawning
                    let partnerClear = true;
                    for (const v of this.state.vehicles) {
                        const dx = Math.abs(v.position.x - partnerEntry.x);
                        const dy = Math.abs(v.position.y - partnerEntry.y);
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < SPAWN_CLEARANCE) { partnerClear = false; break; }
                    }

                    // Switch to partner lane if it has fewer cars and is clear
                    if (partnerClear && partnerLaneCars < currentLaneCars) {
                        spawnX = partnerEntry.x;
                        spawnY = partnerEntry.y;
                        spawnCell = this.state.grid[spawnY][spawnX];
                    }
                }
            }

            // Determine if car should be a rebel
            const isRebel = Math.random() < this.rebelChance;

            // Find path using appropriate lane preference
            const path = Pathfinding.findPath(
                this.state.grid,
                { x: spawnX, y: spawnY },
                { x: exitPos.x, y: exitPos.y },
                isRebel,  // Rebels ignore lane rules
                spawnCell.laneType  // Prefer starting lane type
            );

            if (path && path.length > 1) {
                const car = new Car(
                    `car_${this.state.tick}_${Math.random().toString(36).substr(2, 5)}`,
                    { x: spawnX, y: spawnY }
                );
                car.path = path;
                car.destination = { x: exitPos.x, y: exitPos.y };
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