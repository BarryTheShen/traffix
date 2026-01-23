import type { GridCell, Vector2D, Direction } from '../core/types';
import type { TrafficLight } from './TrafficLight';
import { Pathfinding } from '../core/Pathfinding';

export class Car {
    public id: string;
    public position: Vector2D;
    public destination: Vector2D | null = null;
    public velocity: number = 0;
    public maxVelocity: number = 0.5;
    public acceleration: number = 0.02;
    public deceleration: number = 0.1;
    public path: Vector2D[] = [];
    public currentTargetIndex: number = 0;
    public debugState: string = 'IDLE';
    public limitReason: string = 'NONE';
    public stuckTimer: number = 0;
    public spawnStuckTimer: number = 0;
    public reactionTimer: number = 0;
    public perceptionDelay: number = 0;
    public laneChangeCooldown: number = 0;
    public startPos: Vector2D;
    
    public isCollided: boolean = false;
    public collisionTimer: number = 0;
    public violatesRules: boolean = false;
    public isWaiting: boolean = false;
    public lifeTicks: number = 0;

    public lastObstacleId: string | null = null;

    constructor(id: string, startPos: Vector2D) {
        this.id = id;
        this.position = { ...startPos };
        this.startPos = { ...startPos };
        this.maxVelocity = 0.4 + Math.random() * 0.1;
        this.perceptionDelay = 10;
    }

    public update(lights: TrafficLight[], otherCars: Car[], grid: GridCell[][], timeScale: number = 1.0) {
        this.isWaiting = false;
        this.limitReason = 'CRUISING';
        this.lifeTicks++;
        
        if (this.isCollided) {
            this.collisionTimer++;
            this.velocity = 0;
            this.debugState = 'CRASHED';
            return;
        }

        if (this.laneChangeCooldown > 0) this.laneChangeCooldown--;

        this.advanceWaypointsStrict();
        if (this.currentTargetIndex >= this.path.length) {
            this.debugState = 'ARRIVED';
            this.velocity = 0;
            return;
        }

        const target = this.path[this.currentTargetIndex];
        const dxT = target.x - this.position.x, dyT = target.y - this.position.y;
        const distToT = Math.sqrt(dxT*dxT + dyT*dyT);
        const ux = distToT > 0.01 ? dxT / distToT : 0;
        const uy = distToT > 0.01 ? dyT / distToT : 0;

        let limitDist = Infinity;
        let obstacleVel = 0;
        let obstacleId: string | null = null;

        const gx = Math.floor(this.position.x);
        const gy = Math.floor(this.position.y);
        const currentCell = grid[gy]?.[gx];

        if (currentCell?.type !== 'intersection') {
            const light = this.getNearestLight(lights, ux, uy);
            if (light && light.state !== 'GREEN') {
                const dToL = Math.sqrt((light.position.x - this.position.x)**2 + (light.position.y - this.position.y)**2);
                limitDist = dToL - 0.8; 
                this.limitReason = 'RED_LIGHT';
                obstacleId = light.id;
                this.isWaiting = true;
            }
        }

        const leadCar = this.getLeadVehicleAdvanced(otherCars);
        if (leadCar && leadCar.dist < limitDist) {
            limitDist = leadCar.dist - 1.5; 
            this.limitReason = 'CAR_AHEAD';
            obstacleVel = leadCar.velocity;
            obstacleId = leadCar.id;
            const other = otherCars.find(c => c.id === leadCar.id);
            if (other && (other.isWaiting || other.velocity < 0.05 || other.isCollided)) this.isWaiting = true;
        }

        if (obstacleId !== this.lastObstacleId) {
            if (this.velocity < 0.01 && this.lastObstacleId !== null && obstacleId === null) {
                this.reactionTimer = this.perceptionDelay;
            }
            this.lastObstacleId = obstacleId;
        }

        const baseAcc = this.acceleration * timeScale;
        const baseDecel = this.deceleration * timeScale;

        if (this.reactionTimer > 0) {
            this.reactionTimer--;
            this.velocity = Math.max(0, this.velocity - baseDecel);
            this.debugState = 'REACTING';
        } else if (limitDist < Infinity) {
            const targetGap = 0.5;
            if (limitDist <= 0.01) {
                this.velocity = 0;
                this.debugState = 'STOPPED';
            } else {
                const v_diff = this.velocity - obstacleVel;
                const brakingDist = v_diff > 0 ? (v_diff * v_diff) / (2 * baseDecel) : 0;
                const safetyBuffer = (this.velocity * 5); 
                
                if (limitDist < brakingDist + safetyBuffer + 0.05) {
                    const neededDecel = v_diff > 0 ? (v_diff * v_diff) / (2 * Math.max(0.01, limitDist)) : baseDecel;
                    const applied = Math.min(Math.max(neededDecel * 1.1, baseDecel), baseDecel * 10);
                    this.velocity = Math.max(obstacleVel, this.velocity - applied);
                    this.debugState = 'BRAKING';
                } else {
                    const targetVel = Math.min(this.maxVelocity * timeScale, obstacleVel + (limitDist * 0.5));
                    if (this.velocity < targetVel) {
                        this.velocity = Math.min(this.velocity + baseAcc, targetVel);
                        this.debugState = 'FOLLOWING';
                    } else {
                        this.velocity = Math.max(targetVel, this.velocity - baseDecel * 0.5);
                        this.debugState = 'MATCHING';
                    }
                }
            }
        } else {
            this.velocity = Math.min(this.velocity + baseAcc, this.maxVelocity * timeScale);
            this.debugState = 'ACCEL';
        }

        if (this.velocity < 0.001) this.velocity = 0;

        const moveDist = Math.min(this.velocity, distToT);
        if (moveDist > 0) {
            const nextX = this.position.x + ux * moveDist;
            const nextY = this.position.y + uy * moveDist;
            let blocked = false;
            for (const other of otherCars) {
                if (other.id === this.id) continue;
                const dSq = (other.position.x - nextX)**2 + (other.position.y - nextY)**2;
                if (dSq < 0.81) { 
                    blocked = true;
                    if (this.velocity > 0.1 && other.lifeTicks > 40) { this.isCollided = true; other.isCollided = true; }
                    break;
                }
            }
            if (!blocked) { this.position.x = nextX; this.position.y = nextY; }
            else { this.velocity = 0; }
        }

        // --- SPAWN STUCK TRACKING ---
        if (this.velocity < 0.01) {
            this.stuckTimer++;
            const dSq = (this.position.x - this.startPos.x)**2 + (this.position.y - this.startPos.y)**2;
            if (dSq < 4.0) { // Within 2.0 units
                this.spawnStuckTimer++;
            }
        } else {
            this.stuckTimer = 0;
            this.spawnStuckTimer = 0;
        }
    }

    private getLeadVehicleAdvanced(others: Car[]): { dist: number, velocity: number, id: string } | null {
        let dAccum = 0;
        for (let i = this.currentTargetIndex; i < Math.min(this.path.length, this.currentTargetIndex + 10); i++) {
            const p = this.path[i];
            const prev = (i === this.currentTargetIndex) ? this.position : this.path[i-1];
            dAccum += Math.sqrt((p.x - prev.x)**2 + (p.y - prev.y)**2);
            if (dAccum > 15) break;
            for (const other of others) {
                if (other.id === this.id) continue;
                const dx = other.position.x - p.x, dy = other.position.y - p.y;
                if (dx*dx + dy*dy < 0.64) return { dist: dAccum, velocity: other.velocity, id: other.id };
            }
        }
        return null;
    }

    private advanceWaypointsStrict() {
        if (this.currentTargetIndex >= this.path.length) return;
        const target = this.path[this.currentTargetIndex];
        const dx = target.x - this.position.x, dy = target.y - this.position.y;
        if (dx*dx + dy*dy < 0.04) { this.currentTargetIndex++; return; }
        if (dx*dx + dy*dy > 9.0) return;
        const prev = (this.currentTargetIndex === 0) ? this.startPos : this.path[this.currentTargetIndex - 1];
        const segX = target.x - prev.x, segY = target.y - prev.y;
        const carToTargetX = target.x - this.position.x, carToTargetY = target.y - this.position.y;
        if (segX * carToTargetX + segY * carToTargetY < 0) this.currentTargetIndex++;
    }

    private getNearestLight(lights: TrafficLight[], ux: number, uy: number): TrafficLight | null {
        const heading = this.getHeading(ux, uy);
        let best: TrafficLight | null = null;
        let minDist = 10;
        for (const l of lights) {
            if (l.state === 'GREEN') continue;
            const lParts = l.id.split('_');
            const lDir = lParts[1].charAt(0); 
            let relevant = false;
            if (lDir === 'n' && heading === 'SOUTH') relevant = true;
            if (lDir === 's' && heading === 'NORTH') relevant = true;
            if (lDir === 'e' && heading === 'WEST') relevant = true;
            if (lDir === 'w' && heading === 'EAST') relevant = true;
            if (!relevant) continue;
            const ldx = l.position.x - this.position.x, ldy = l.position.y - this.position.y;
            const dot = ldx * ux + ldy * uy;
            const cross = Math.abs(ldx * uy - ldy * ux);
            if (dot > -0.2 && dot < minDist && cross < 1.0) { minDist = dot; best = l; }
        }
        return best;
    }

    private getHeading(dx: number, dy: number): Direction {
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'EAST' : 'WEST';
        return dy > 0 ? 'SOUTH' : 'NORTH';
    }
}
