import type { GridCell, Vector2D } from '../core/types';
import type { TrafficLight } from './TrafficLight';
import { Pathfinding } from '../core/Pathfinding';

export class Car {
    public id: string;
    public position: Vector2D;
    public destination: Vector2D | null = null;
    public velocity: number = 0;
    public maxVelocity: number = 0.5;
    public acceleration: number = 0.02;
    public deceleration: number = 0.05;
    public path: Vector2D[] = [];
    public currentTargetIndex: number = 0;
    public debugState: string = 'IDLE';
    public stuckTimer: number = 0;
    public spawnStuckTimer: number = 0;
    public reactionTimer: number = 0;
    public perceptionDelay: number = 0;
    public laneChangeCooldown: number = 0;
    public startPos: Vector2D;
    
    public isCollided: boolean = false;
    public collisionTimer: number = 0;
    public violatesRules: boolean = false;

    private lastObstacleId: string | null = null;

    constructor(id: string, startPos: Vector2D) {
        this.id = id;
        this.position = { ...startPos };
        this.startPos = { ...startPos };
        this.maxVelocity = 0.4 + Math.random() * 0.3;
        this.perceptionDelay = 10 + Math.floor(Math.random() * 10);
    }

    public update(lights: TrafficLight[], otherCars: Car[], grid: GridCell[][], timeScale: number = 1.0, instantPhysics: boolean = false) {
        if (this.isCollided) {
            this.collisionTimer++;
            this.velocity = 0;
            this.debugState = 'CRASHED';
            return;
        }

        if (this.laneChangeCooldown > 0) this.laneChangeCooldown--;

        if (this.currentTargetIndex >= this.path.length) {
            this.debugState = 'ARRIVED';
            return;
        }

        const target = this.path[this.currentTargetIndex];
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const currentMaxVel = this.maxVelocity * timeScale;
        const baseAcc = this.acceleration * timeScale;
        const baseDecel = this.deceleration * timeScale;
        
        // 0. Physical Collision Detection
        for (const other of otherCars) {
            if (other.id === this.id || other.isCollided) continue;
            const odx = other.position.x - this.position.x;
            const ody = other.position.y - this.position.y;
            const distSq = odx * odx + ody * ody;
            
            if (distSq < 0.64) { // dist < 0.8
                this.isCollided = true;
                other.isCollided = true;
                return;
            }
        }

        if (distance < Math.max(0.1, this.velocity)) {
            this.position.x = target.x;
            this.position.y = target.y;
            this.currentTargetIndex++;
            return;
        }

        const dxN = dx / distance;
        const dyN = dy / distance;

        // 2. Perception & Lookahead
        let limitDist = Infinity;
        let limitReason = 'CRUISING';
        let currentObstacleId: string | null = null;
        let obstacleVelocity = 0;

        const gx = Math.floor(this.position.x);
        const gy = Math.floor(this.position.y);
        const currentCell = grid[gy]?.[gx];

        // A. Lights Check
        if (currentCell?.type !== 'intersection') {
            const light = this.getNearestLight(lights, dxN, dyN);
            if (light) {
                const dist = Math.sqrt((light.position.x - this.position.x)**2 + (light.position.y - this.position.y)**2);
                
                if (light.state === 'RED') {
                    currentObstacleId = light.id;
                    const stopDist = Math.max(0, dist - 1.0);
                    if (stopDist < limitDist) {
                        limitDist = stopDist;
                        limitReason = 'RED_LIGHT';
                        obstacleVelocity = 0;
                    }
                } else if (light.state === 'YELLOW') {
                    // YELLOW logic: commit if stopping distance is too long
                    const requiredDecel = (this.velocity * this.velocity) / (2 * Math.max(0.1, dist - 1.0));
                    if (requiredDecel > baseDecel * 3) {
                        // Pass!
                    } else {
                        currentObstacleId = light.id;
                        limitDist = Math.max(0, dist - 1.0);
                        limitReason = 'YELLOW_LIGHT';
                        obstacleVelocity = 0;
                    }
                }
            }
        }

        // B. Cars Check (Predictive)
        const carInfo = this.getNearestCarDistance(otherCars, dxN, dyN);
        if (carInfo) {
            const stopDist = Math.max(0, carInfo.dist - 1.2);
            if (stopDist < limitDist) {
                limitDist = stopDist;
                limitReason = 'CAR_AHEAD';
                currentObstacleId = carInfo.id;
                obstacleVelocity = carInfo.velocity;
                
                if (this.laneChangeCooldown === 0 && this.velocity < 0.2 && this.destination) {
                    this.tryOvertake(grid, otherCars, dxN, dyN);
                }
            }
        }

        // 3. Reaction Timer Logic
        if (currentObstacleId !== this.lastObstacleId) {
            this.lastObstacleId = currentObstacleId;
            if (currentObstacleId !== null) {
                this.reactionTimer = this.perceptionDelay;
            }
        }

        // 4. Physics Engine
        if (instantPhysics) {
            if (limitDist < 0.5) {
                this.velocity = 0;
                this.debugState = `INSTANT_STOP (${limitReason})`;
            } else {
                this.velocity = currentMaxVel;
                this.debugState = 'INSTANT_ACCEL';
            }
        } else {
            // BRICK WALL for Red Light at close range
            if (limitReason === 'RED_LIGHT' && limitDist < 0.2) {
                this.velocity = 0;
                this.debugState = 'STOPPED (RED_WALL)';
            } else if (this.reactionTimer > 0 && limitDist < Infinity && this.velocity > 0.1 && limitReason !== 'CAR_AHEAD') {
                this.reactionTimer--;
                this.velocity = Math.min(this.velocity + baseAcc, currentMaxVel);
                this.debugState = 'REACTING...';
            } else {
                const relativeVel = this.velocity - obstacleVelocity;
                const maxNormalDecel = baseDecel * 2;
                const maxPanicDecel = baseDecel * 10;

                if (limitDist < Infinity) {
                    if (limitDist < 0.1) {
                        this.velocity = 0;
                        this.debugState = `STOPPED (${limitReason})`;
                        if (this.reactionTimer === 0) this.reactionTimer = this.perceptionDelay;
                    } else if (relativeVel > 0) {
                        const requiredDecel = (relativeVel * relativeVel) / (2 * limitDist);
                        const appliedDecel = Math.min(requiredDecel * 1.2, maxPanicDecel);
                        
                        if (requiredDecel > maxNormalDecel * 0.8) {
                            this.velocity = Math.max(0, this.velocity - appliedDecel);
                            this.debugState = `BRAKING (${limitReason})`;
                        } else {
                            this.velocity = Math.min(this.velocity + baseAcc, currentMaxVel);
                            this.debugState = 'COASTING';
                        }
                    } else {
                        this.velocity = Math.min(this.velocity + baseAcc, currentMaxVel, obstacleVelocity + 0.05);
                        this.debugState = 'FOLLOWING';
                    }
                } else {
                    this.velocity = Math.min(this.velocity + baseAcc, currentMaxVel);
                    this.debugState = 'ACCEL';
                }
            }
        }

        // Stuck Detection
        if (this.velocity < 0.05) {
            this.stuckTimer++;
            const dxStart = Math.abs(this.position.x - this.startPos.x);
            const dyStart = Math.abs(this.position.y - this.startPos.y);
            const isNearStart = dxStart < 0.5 && dyStart < 0.5;
            
            if (currentCell?.type === 'entry' && isNearStart) {
                this.spawnStuckTimer++;
            } else {
                this.spawnStuckTimer = 0;
            }
        } else {
            this.stuckTimer = 0;
            this.spawnStuckTimer = 0;
        }

        this.position.x += dxN * this.velocity;
        this.position.y += dyN * this.velocity;
    }

    private tryOvertake(grid: GridCell[][], cars: Car[], dxN: number, dyN: number) {
        let lookAheadIdx = this.currentTargetIndex;
        let distToCheck = 0;
        let approachingIntersection = false;
        while (lookAheadIdx < this.path.length && distToCheck < 5) {
            const p = this.path[lookAheadIdx];
            if (grid[p.y]?.[p.x]?.type === 'intersection') { approachingIntersection = true; break; }
            distToCheck++; lookAheadIdx++;
        }
        if (approachingIntersection) return;

        const offsets = [{ x: -dyN, y: dxN }, { x: dyN, y: -dxN }];
        for (const off of offsets) {
            const targetX = Math.round(this.position.x + off.x);
            const targetY = Math.round(this.position.y + off.y);
            if (targetX < 0 || targetX >= grid[0].length || targetY < 0 || targetY >= grid.length) continue;
            const cell = grid[targetY][targetX];
            if (cell.type !== 'road') continue;
            if (!cell.allowedDirections.includes(this.getHeading(dxN, dyN))) continue;
            const isBlocked = cars.some(c => c.id !== this.id && Math.abs(c.position.x - targetX) < 1.0 && Math.abs(c.position.y - targetY) < 1.0);
            if (!isBlocked) {
                const newPath = Pathfinding.findPath(grid, { x: targetX, y: targetY }, this.destination!, this.violatesRules);
                if (newPath) {
                    this.position.x = targetX; this.position.y = targetY;
                    this.path = newPath; this.currentTargetIndex = 0;
                    this.laneChangeCooldown = 120;
                    return;
                }
            }
        }
    }

    private getHeading(dx: number, dy: number): any {
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'EAST' : 'WEST';
        return dy > 0 ? 'SOUTH' : 'NORTH';
    }

    private getNearestLight(lights: TrafficLight[], dxN: number, dyN: number): TrafficLight | null {
        for (const light of lights) {
            if (light.state === 'GREEN') continue;
            const ldx = light.position.x - this.position.x;
            const ldy = light.position.y - this.position.y;
            const dist = Math.sqrt(ldx * ldx + ldy * ldy);
            if (dist > 15) continue; 
            if (ldx * dxN + ldy * dyN > 0.95 && Math.abs(ldx * dyN - ldy * dxN) < 0.8) return light;
        }
        return null;
    }

    private getNearestCarDistance(cars: Car[], dxN: number, dyN: number): { dist: number, id: string, velocity: number } | null {
        let minDist = Infinity;
        let foundCar: Car | null = null;
        for (const other of cars) {
            if (other.id === this.id) continue;
            const cdx = other.position.x - this.position.x;
            const cdy = other.position.y - this.position.y;
            const dist = Math.sqrt(cdx * cdx + cdy * cdy);
            if (dist > 15.0) continue;
            
            if (cdx * dxN + cdy * dyN > 0 && Math.abs(cdx * dyN - cdy * dxN) < 0.8) {
                if (dist < minDist) { minDist = dist; foundCar = other; }
            }
        }
        return foundCar ? { dist: minDist, id: foundCar.id, velocity: foundCar.isCollided ? 0 : foundCar.velocity } : null;
    }
}