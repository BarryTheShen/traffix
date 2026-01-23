import type { GridCell, Vector2D, Direction } from '../core/types';
import type { TrafficLight } from './TrafficLight';
import { Pathfinding } from '../core/Pathfinding';

export class Car {
    public id: string;
    public position: Vector2D;
    public destination: Vector2D | null = null;
    public velocity: number = 0;
    public maxVelocity: number = 0.5;
    public acceleration: number = 0.006; 
    public deceleration: number = 0.05; 
    public path: Vector2D[] = [];
    public currentTargetIndex: number = 0;
    public debugState: string = 'IDLE';
    public limitReason: string = 'NONE';
    public stuckTimer: number = 0;
    public spawnStuckTimer: number = 0;
    public reactionTimer: number = 0;
    public perceptionDelay: number = 30; 
    public startPos: Vector2D;
    
    public isCollided: boolean = false;
    public collisionTimer: number = 0;
    public violatesRules: boolean = false;
    public isWaiting: boolean = false; 
    public lifeTicks: number = 0;

    private wasHardBlockedLastTick: boolean = false;

    constructor(id: string, startPos: Vector2D) {
        this.id = id;
        this.position = { ...startPos };
        this.startPos = { ...startPos };
        this.maxVelocity = 0.4 + Math.random() * 0.1;
    }

    public update(lights: TrafficLight[], otherCars: Car[], grid: GridCell[][], timeScale: number = 1.0) {
        this.limitReason = 'CRUISING';
        this.lifeTicks++;
        
        if (this.isCollided) {
            this.collisionTimer++;
            this.velocity = 0;
            this.isWaiting = true;
            this.debugState = 'CRASHED';
            return;
        }

        this.advanceWaypointsStrict();
        if (this.currentTargetIndex >= this.path.length) {
            this.debugState = 'ARRIVED';
            this.velocity = 0;
            this.isWaiting = false;
            return;
        }

        const target = this.path[this.currentTargetIndex];
        const dxT = target.x - this.position.x, dyT = target.y - this.position.y;
        const distToT = Math.sqrt(dxT*dxT + dyT*dyT);
        const ux = distToT > 0.01 ? dxT / distToT : 0;
        const uy = distToT > 0.01 ? dyT / distToT : 0;

        let limitDist = Infinity;
        let obstacleVel = 0;
        let isHardBlockedNow = false;

        const baseAcc = this.acceleration * timeScale;
        const baseDecel = this.deceleration * timeScale;

        // 1. Traffic Light Detection (Wide Corridor)
        const light = this.getNearestLightInCorridor(lights, ux, uy, grid);
        if (light && light.state !== 'GREEN') {
            const dToL = Math.sqrt((light.position.x - this.position.x)**2 + (light.position.y - this.position.y)**2);
            limitDist = dToL - 1.0; // Stop 1.0 unit before light to avoid peeking past
            this.limitReason = 'RED_LIGHT';
            if (limitDist < 0.1) isHardBlockedNow = true;
        }

        // 2. Lead Vehicle Detection (Target Gap: 1.2 center-to-center = 0.6 visual gap)
        const leadInfo = this.getLeadVehicleVector(otherCars, ux, uy);
        if (leadInfo) {
            const carStopDist = leadInfo.dist - 1.2; 
            if (carStopDist < limitDist) {
                limitDist = carStopDist;
                this.limitReason = 'CAR_AHEAD';
                obstacleVel = leadInfo.velocity;
                const other = otherCars.find(c => c.id === leadInfo.id);
                if (other && leadInfo.dist < 1.6) {
                    if (other.isWaiting || other.debugState === 'REACTING' || other.velocity < 0.01) {
                        if (carStopDist < 0.15 || this.velocity < 0.01) isHardBlockedNow = true;
                    }
                }
            }
        }

        // 3. Elegant Reaction State Machine
        if (isHardBlockedNow) {
            this.isWaiting = true;
            this.wasHardBlockedLastTick = true;
            this.reactionTimer = 0;
        } else if (this.wasHardBlockedLastTick) {
            if (this.velocity < 0.01) {
                this.reactionTimer = this.perceptionDelay;
            }
            this.wasHardBlockedLastTick = false;
        }

        // 4. Physics Engine
        if (this.isWaiting && this.reactionTimer > 0) {
            this.reactionTimer--;
            this.velocity = Math.max(0, this.velocity - baseDecel);
            this.debugState = 'REACTING';
            if (this.reactionTimer === 0) this.isWaiting = false;
        } else if (isHardBlockedNow) {
            this.velocity = 0; // SNAP TO ZERO
            this.debugState = 'STOPPED';
        } else if (limitDist < Infinity) {
            const v_diff = this.velocity - obstacleVel;
            const brakingDist = v_diff > 0 ? (v_diff * v_diff) / (2 * baseDecel) : 0;
            const safetyBuffer = (this.velocity * 4); 
            
            if (limitDist < brakingDist + safetyBuffer) {
                const neededDecel = v_diff > 0 ? (v_diff * v_diff) / (2 * Math.max(0.01, limitDist)) : baseDecel;
                const applied = Math.min(Math.max(neededDecel * 1.1, baseDecel), baseDecel * 15);
                this.velocity = Math.max(obstacleVel, this.velocity - applied);
                this.debugState = 'BRAKING';
            } else {
                const catchUpSpeed = obstacleVel + (limitDist * 0.1); 
                const targetVel = Math.min(this.maxVelocity * timeScale, catchUpSpeed);
                if (this.velocity < targetVel - 0.001) {
                    this.velocity = Math.min(this.velocity + baseAcc, targetVel);
                    this.debugState = 'FOLLOWING';
                } else if (this.velocity > targetVel + 0.001) {
                    this.velocity = Math.max(targetVel, this.velocity - baseDecel * 0.5);
                    this.debugState = 'MATCHING';
                } else {
                    this.velocity = targetVel;
                    this.debugState = 'LOCKED';
                }
            }
        } else {
            this.velocity = Math.min(this.velocity + baseAcc, this.maxVelocity * timeScale);
            this.debugState = 'ACCEL';
        }

        if (this.velocity < 0.001) this.velocity = 0;

        // 5. Atomic Physical Lock - Enforces minimum 0.6-unit gap (1.2 center-to-center)
        const moveDist = Math.min(this.velocity, distToT);
        if (moveDist > 0) {
            const nextX = this.position.x + ux * moveDist;
            const nextY = this.position.y + uy * moveDist;
            let restricted = false;
            for (const other of otherCars) {
                if (other.id === this.id) continue;
                const dxO = other.position.x - nextX, dyO = other.position.y - nextY;
                const dSq = dxO*dxO + dyO*dyO;
                const crossLateral = Math.abs(dxO * uy - dyO * ux);
                
                // Same-lane following distance (1.44 = 1.2^2 for minimum 0.6-unit gap)
                if (dSq < 1.44) { 
                    const dot = dxO * ux + dyO * uy;
                    // Only restrict if car is AHEAD (dot > 0) and in same lane (cross < 0.5)
                    if (dot > 0 && crossLateral < 0.5) {
                        restricted = true;
                        // Collision only if:
                        // - Overlap is severe (< 0.64 = 0.8^2)
                        // - This car is moving fast enough to cause real impact (> 0.25)
                        // - Other car has existed long enough (not just spawned)
                        // - Both cars are in motion OR severe overlap (< 0.49 = 0.7^2)
                        const isHighSpeedImpact = this.velocity > 0.25 && dSq < 0.64;
                        const isSevereOverlap = dSq < 0.49; // Cars physically overlapping
                        if ((isHighSpeedImpact || isSevereOverlap) && other.lifeTicks > 40) {
                            this.isCollided = true;
                            other.isCollided = true;
                        }
                        break;
                    }
                }
                
                // Cross-traffic collision - only for cars going in truly DIFFERENT directions
                // Skip if we're in the same lane (already handled above)
                if (dSq < 0.36 && crossLateral > 0.3 && other.lifeTicks > 20 && this.velocity > 0.1) { // 0.6^2 = actual overlap
                    // Get other car's heading
                    const otherTarget = other.path[other.currentTargetIndex];
                    if (otherTarget) {
                        const odx = otherTarget.x - other.position.x;
                        const ody = otherTarget.y - other.position.y;
                        const oLen = Math.sqrt(odx*odx + ody*ody);
                        if (oLen > 0.01) {
                            const oux = odx / oLen, ouy = ody / oLen;
                            // Dot product of headings: 1 = same dir, -1 = opposite, 0 = perpendicular
                            const headingDot = ux * oux + uy * ouy;
                            // Only collide if going truly different directions (< 0.5 = more than 60 degrees apart)
                            // Also require they're moving toward each other, not just passing by
                            const approachDot = -(dxO * ux + dyO * uy); // Positive if we're moving toward them
                            if (headingDot < 0.5 && approachDot > 0) {
                                this.isCollided = true;
                                other.isCollided = true;
                                restricted = true;
                                break;
                            }
                        }
                    }
                }
            }
            if (!restricted) { this.position.x = nextX; this.position.y = nextY; }
            else { this.velocity = 0; }
        }

        if (this.velocity < 0.01) {
            this.stuckTimer++;
            const dSq = (this.position.x - this.startPos.x)**2 + (this.position.y - this.startPos.y)**2;
            if (dSq < 1.0) this.spawnStuckTimer++;
        } else {
            this.stuckTimer = 0;
            this.spawnStuckTimer = 0;
        }
    }

    private getLeadVehicleVector(others: Car[], ux: number, uy: number): { dist: number, velocity: number, id: string } | null {
        let bestDist = 15;
        let bestInfo: { dist: number, velocity: number, id: string } | null = null;
        for (const other of others) {
            if (other.id === this.id) continue;
            const dx = other.position.x - this.position.x;
            const dy = other.position.y - this.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > bestDist) continue;
            const dot = dx * ux + dy * uy;
            const cross = Math.abs(dx * uy - dy * ux);
            if (dot > 0 && cross < 0.4) {
                bestDist = dot;
                bestInfo = { dist: dot, velocity: other.velocity, id: other.id };
            }
        }
        return bestInfo;
    }

    private advanceWaypointsStrict() {
        if (this.currentTargetIndex >= this.path.length) return;
        const target = this.path[this.currentTargetIndex];
        const dx = target.x - this.position.x, dy = target.y - this.position.y;
        const isLast = this.currentTargetIndex === this.path.length - 1;
        const reachThreshold = isLast ? 0.5 : 0.04; 
        if (dx*dx + dy*dy < reachThreshold) { this.currentTargetIndex++; return; }
        if (dx*dx + dy*dy > 9.0) return;
        const prev = (this.currentTargetIndex === 0) ? this.startPos : this.path[this.currentTargetIndex - 1];
        const segX = target.x - prev.x, segY = target.y - prev.y;
        const carToTargetX = target.x - this.position.x, carToTargetY = target.y - this.position.y;
        if (segX * carToTargetX + segY * carToTargetY < 0) this.currentTargetIndex++;
    }

    private getNearestLightInCorridor(lights: TrafficLight[], ux: number, uy: number, grid: GridCell[][]): TrafficLight | null {
        // Determine heading from actual movement direction, not grid cell
        const heading = this.getHeading(ux, uy);

        let best: TrafficLight | null = null;
        let minDist = 10;
        for (const l of lights) {
            if (l.state === 'GREEN') continue;
            const lParts = l.id.split('_');
            if (lParts.length < 2) continue;
            const lDir = lParts[1].charAt(0); 
            let relevant = false;
            
            // Light direction indicates which traffic it controls:
            // 'n' lights control SOUTHBOUND traffic (cars heading SOUTH see 'n' lights)
            // 's' lights control NORTHBOUND traffic (cars heading NORTH see 's' lights)
            if (lDir === 'n' && heading === 'SOUTH') relevant = true;
            if (lDir === 's' && heading === 'NORTH') relevant = true;
            if (lDir === 'e' && heading === 'WEST') relevant = true;
            if (lDir === 'w' && heading === 'EAST') relevant = true;
            if (!relevant) continue;

            const ldx = l.position.x - this.position.x, ldy = l.position.y - this.position.y;
            const dot = ldx * ux + ldy * uy;
            const cross = Math.abs(ldx * uy - ldy * ux);
            
            // Wide corridor (0.8 units) to capture lights in this lane only
            if (dot > -0.5 && dot < minDist && cross < 0.8) { minDist = dot; best = l; }
        }
        return best;
    }

    private getHeading(dx: number, dy: number): Direction {
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'EAST' : 'WEST';
        return dy > 0 ? 'SOUTH' : 'NORTH';
    }
}
