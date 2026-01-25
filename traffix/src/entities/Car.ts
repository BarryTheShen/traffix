import type { GridCell, Vector2D, Direction } from '../core/types';
import type { TrafficLight } from './TrafficLight';

/**
 * Vehicle configuration - can be extended for bikes, trucks etc.
 */
export interface VehicleConfig {
    width: number;      // Vehicle width in cells
    length: number;     // Vehicle length in cells
    maxVelocity: number;
    acceleration: number;
    deceleration: number;
    reactionTime: number;  // Ticks before responding to changes
}

// Default car configuration - exposed for debug menu
export const DEFAULT_CAR_CONFIG: VehicleConfig = {
    width: 0.5,
    length: 0.7,
    maxVelocity: 0.4,
    acceleration: 0.008,      // ~0.48 cells/sec² at 60fps (realistic)
    deceleration: 0.025,      // ~1.5 cells/sec² at 60fps (comfortable braking)
    reactionTime: 20          // ~0.33 seconds at 60fps
};

// Global config that can be modified from debug menu
export const carConfig = { ...DEFAULT_CAR_CONFIG };

export class Car {
    public id: string;
    public position: Vector2D;
    public destination: Vector2D | null = null;
    public velocity: number = 0;
    public heading: Vector2D = { x: 0, y: 1 };  // Unit vector of travel direction
    public path: Vector2D[] = [];
    public currentTargetIndex: number = 0;
    public debugState: string = 'IDLE';
    public limitReason: string = 'NONE';
    public stuckTimer: number = 0;
    public spawnStuckTimer: number = 0;
    public startPos: Vector2D;

    public isCollided: boolean = false;
    public collisionTimer: number = 0;
    public violatesRules: boolean = false;
    public lifeTicks: number = 0;

    // Physics properties from config
    public maxVelocity: number;
    public acceleration: number;
    public deceleration: number;
    public reactionTime: number;
    public width: number;
    public length: number;

    // Reaction state machine
    private reactionTimer: number = 0;
    private isWaitingToStart: boolean = false;
    private wasBlocked: boolean = false;

    // Collision nodes - calculated based on heading (8 nodes around the car)
    private collisionNodes: Vector2D[] = [];

    constructor(id: string, startPos: Vector2D, config: VehicleConfig = carConfig) {
        this.id = id;
        this.position = { ...startPos };
        this.startPos = { ...startPos };
        
        // Apply config with slight random variation for natural traffic
        this.maxVelocity = config.maxVelocity * (0.9 + Math.random() * 0.2);
        this.acceleration = config.acceleration;
        this.deceleration = config.deceleration;
        this.reactionTime = config.reactionTime;
        this.width = config.width;
        this.length = config.length;
        
        this.updateCollisionNodes();
    }

    /**
     * Update collision nodes based on current position and heading.
     * Nodes are at: front-left, front-center, front-right, 
     *               left-center, right-center,
     *               back-left, back-center, back-right
     */
    private updateCollisionNodes() {
        const hw = this.width / 2;   // half width
        const hl = this.length / 2;  // half length
        
        // Perpendicular vector (90° rotation of heading)
        const perpX = -this.heading.y;
        const perpY = this.heading.x;
        
        this.collisionNodes = [
            // Front row (indices 0, 1, 2)
            { x: this.position.x + this.heading.x * hl - perpX * hw, y: this.position.y + this.heading.y * hl - perpY * hw },
            { x: this.position.x + this.heading.x * hl, y: this.position.y + this.heading.y * hl },
            { x: this.position.x + this.heading.x * hl + perpX * hw, y: this.position.y + this.heading.y * hl + perpY * hw },
            // Side centers (indices 3, 4)
            { x: this.position.x - perpX * hw, y: this.position.y - perpY * hw },
            { x: this.position.x + perpX * hw, y: this.position.y + perpY * hw },
            // Back row (indices 5, 6, 7)
            { x: this.position.x - this.heading.x * hl - perpX * hw, y: this.position.y - this.heading.y * hl - perpY * hw },
            { x: this.position.x - this.heading.x * hl, y: this.position.y - this.heading.y * hl },
            { x: this.position.x - this.heading.x * hl + perpX * hw, y: this.position.y - this.heading.y * hl + perpY * hw },
        ];
    }

    /**
     * Calculate minimum distance between this car and another using edge-to-edge distance
     */
    public getEdgeDistance(other: Car): number {
        let minDist = Infinity;
        
        for (const myNode of this.collisionNodes) {
            for (const otherNode of other.collisionNodes) {
                const dx = otherNode.x - myNode.x;
                const dy = otherNode.y - myNode.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) minDist = dist;
            }
        }
        
        return minDist;
    }

    /**
     * Get the front edge distance to another car's back edge (for following distance)
     */
    public getFrontToBackDistance(other: Car): number {
        let minDist = Infinity;
        
        const myFront = [this.collisionNodes[0], this.collisionNodes[1], this.collisionNodes[2]];
        const otherBack = [other.collisionNodes[5], other.collisionNodes[6], other.collisionNodes[7]];
        
        for (const myNode of myFront) {
            for (const otherNode of otherBack) {
                const dx = otherNode.x - myNode.x;
                const dy = otherNode.y - myNode.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) minDist = dist;
            }
        }
        
        return minDist;
    }

    /**
     * Check if collision nodes overlap with another car (actual collision)
     */
    public checkNodeOverlap(other: Car): boolean {
        const overlapThreshold = 0.08;
        return this.getEdgeDistance(other) < overlapThreshold;
    }

    public update(lights: TrafficLight[], otherCars: Car[], grid: GridCell[][], timeScale: number = 1.0) {
        this.lifeTicks++;
        this.limitReason = 'CRUISING';

        if (this.isCollided) {
            this.collisionTimer++;
            this.velocity = 0;
            this.debugState = 'CRASHED';
            return;
        }

        this.advanceWaypoints();
        if (this.currentTargetIndex >= this.path.length) {
            this.debugState = 'ARRIVED';
            this.velocity = 0;
            return;
        }

        // Calculate heading from current position to target
        const target = this.path[this.currentTargetIndex];
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);
        
        if (distToTarget > 0.01) {
            this.heading = { x: dx / distToTarget, y: dy / distToTarget };
        }
        
        this.updateCollisionNodes();

        // Current cell info
        const gridX = Math.floor(this.position.x);
        const gridY = Math.floor(this.position.y);
        const currentCell = grid[gridY]?.[gridX];
        this.debugState = currentCell?.type === 'intersection' ? 'IN_INTERSECTION' : 'ON_ROAD';

        // ===== OBSTACLE DETECTION =====
        let obstacleDistance = Infinity;
        let obstacleVelocity = 0;
        let isHardBlock = false;

        // 1. Traffic Light Detection
        const light = this.getNearestLightInCorridor(lights);
        if (light && light.state !== 'GREEN') {
            const lightDist = this.getDistanceToLight(light);
            if (lightDist < obstacleDistance) {
                obstacleDistance = lightDist;
                obstacleVelocity = 0;
                this.limitReason = 'RED_LIGHT';
                if (lightDist < 0.05) isHardBlock = true;
            }
        }

        // 2. Lead Vehicle Detection (edge-to-edge, same direction)
        const leadInfo = this.getLeadVehicleInfo(otherCars);
        if (leadInfo) {
            const followGap = 0.25;  // Target gap: ~0.5 car widths
            const effectiveDist = leadInfo.distance - followGap;
            
            if (effectiveDist < obstacleDistance) {
                obstacleDistance = effectiveDist;
                obstacleVelocity = leadInfo.velocity;
                this.limitReason = 'CAR_AHEAD';
                if (effectiveDist < 0.05) isHardBlock = true;
            }
        }

        // 2b. Head-on traffic detection (oncoming vehicles)
        const headOnInfo = this.detectHeadOnTraffic(otherCars);
        if (headOnInfo) {
            // For head-on, use half the distance (both cars should stop)
            const effectiveDist = headOnInfo.distance / 2 - 0.3;
            
            if (effectiveDist < obstacleDistance) {
                obstacleDistance = effectiveDist;
                obstacleVelocity = 0;  // Treat as stopping target
                this.limitReason = 'HEAD_ON';
                if (effectiveDist < 0.1) isHardBlock = true;
            }
        }

        // 3. Cross-traffic detection at intersections
        const crossInfo = this.detectCrossTraffic(otherCars, grid, currentCell);
        if (crossInfo) {
            if (crossInfo.distance < obstacleDistance) {
                obstacleDistance = crossInfo.distance;
                obstacleVelocity = 0;
                this.limitReason = 'YIELDING';
                if (crossInfo.distance < 0.2) isHardBlock = true;
            }
        }

        // ===== KINEMATIC PHYSICS ENGINE =====
        this.applyKinematics(obstacleDistance, obstacleVelocity, isHardBlock, timeScale);

        // ===== MOVEMENT =====
        const moveDistance = Math.min(this.velocity, distToTarget);
        if (moveDistance > 0) {
            const nextX = this.position.x + this.heading.x * moveDistance;
            const nextY = this.position.y + this.heading.y * moveDistance;
            
            // Check for collision before moving
            const wouldCollide = this.wouldCollideAt(nextX, nextY, otherCars);
            
            if (!wouldCollide) {
                this.position.x = nextX;
                this.position.y = nextY;
                this.updateCollisionNodes();
            } else {
                this.velocity = 0;
                this.debugState = 'BLOCKED';
            }
        }

        // Collision detection with actual overlap check
        this.checkForCollisions(otherCars);

        // Stuck detection
        if (this.velocity < 0.01) {
            this.stuckTimer++;
            const dSq = (this.position.x - this.startPos.x) ** 2 + (this.position.y - this.startPos.y) ** 2;
            if (dSq < 1.0) this.spawnStuckTimer++;
        } else {
            this.stuckTimer = 0;
            this.spawnStuckTimer = 0;
        }
    }

    /**
     * Apply realistic kinematic physics for acceleration/deceleration
     * 
     * Uses kinematic equation: d = v² / (2a) for braking distance
     * Short distance: accelerate, then decelerate smoothly
     * Long distance: accelerate to max, cruise, then decelerate
     */
    private applyKinematics(obstacleDistance: number, obstacleVelocity: number, isHardBlock: boolean, timeScale: number) {
        const acc = this.acceleration * timeScale;
        const dec = this.deceleration * timeScale;
        const maxV = this.maxVelocity * timeScale;

        // If obstacle cleared and we were waiting, start reaction timer
        if (!isHardBlock && this.wasBlocked && this.velocity < 0.01) {
            if (!this.isWaitingToStart) {
                this.isWaitingToStart = true;
                this.reactionTimer = this.reactionTime;
            }
        }
        this.wasBlocked = isHardBlock;

        // Waiting for reaction time before starting
        if (this.isWaitingToStart && this.reactionTimer > 0) {
            this.reactionTimer--;
            this.debugState = 'REACTING';
            if (this.reactionTimer <= 0) {
                this.isWaitingToStart = false;
            }
            return;
        }

        // Hard blocked - immediate stop
        if (isHardBlock) {
            this.velocity = 0;
            this.debugState = 'STOPPED';
            return;
        }

        // No obstacle - accelerate to max
        if (obstacleDistance === Infinity) {
            this.velocity = Math.min(this.velocity + acc, maxV);
            this.debugState = 'ACCEL';
            return;
        }

        // Calculate required braking distance: d = (v² - v_target²) / (2 * decel)
        const relativeVelocity = this.velocity - obstacleVelocity;
        const brakingDistance = relativeVelocity > 0 
            ? (relativeVelocity * relativeVelocity) / (2 * dec) 
            : 0;

        // Safety margin based on reaction time
        const safetyMargin = this.velocity * (this.reactionTime / 60) * 0.3;
        const totalStoppingDistance = brakingDistance + safetyMargin;

        if (obstacleDistance <= totalStoppingDistance) {
            // Need to brake
            if (obstacleDistance <= 0.08) {
                // Very close - match obstacle velocity
                this.velocity = Math.max(0, obstacleVelocity);
            } else {
                // Calculate required deceleration: a = (v² - v_target²) / (2 * d)
                const requiredDecel = relativeVelocity > 0 
                    ? (relativeVelocity * relativeVelocity) / (2 * Math.max(0.01, obstacleDistance))
                    : dec;
                
                // Apply deceleration (capped at max comfortable decel * 3 for emergencies)
                const appliedDecel = Math.min(requiredDecel, dec * 3);
                this.velocity = Math.max(obstacleVelocity, this.velocity - appliedDecel);
            }
            this.debugState = 'BRAKING';
        } else {
            // Can accelerate or cruise
            // Max approach velocity that allows stopping in time: v = sqrt(2 * a * d)
            const maxApproachVelocity = Math.sqrt(2 * dec * obstacleDistance) + obstacleVelocity;
            const targetVelocity = Math.min(maxV, maxApproachVelocity);

            if (this.velocity < targetVelocity - 0.001) {
                this.velocity = Math.min(this.velocity + acc, targetVelocity);
                this.debugState = obstacleDistance > 5 ? 'ACCEL' : 'APPROACH';
            } else if (this.velocity > targetVelocity + 0.001) {
                this.velocity = Math.max(targetVelocity, this.velocity - dec * 0.3);
                this.debugState = 'MATCHING';
            } else {
                this.velocity = targetVelocity;
                this.debugState = 'CRUISING';
            }
        }

        if (this.velocity < 0.001) this.velocity = 0;
    }

    /**
     * Get lead vehicle info using edge-to-edge distance
     */
    private getLeadVehicleInfo(otherCars: Car[]): { distance: number; velocity: number; id: string } | null {
        let closest: { distance: number; velocity: number; id: string } | null = null;
        let minDist = 8;

        for (const other of otherCars) {
            if (other.id === this.id || other.isCollided) continue;

            // Check if other car is ahead of us
            const dx = other.position.x - this.position.x;
            const dy = other.position.y - this.position.y;
            const dot = dx * this.heading.x + dy * this.heading.y;
            
            if (dot <= 0) continue;

            // Check if in same lane (lateral distance)
            const cross = Math.abs(dx * this.heading.y - dy * this.heading.x);
            if (cross > 0.6) continue;

            // Use front-to-back edge distance
            const edgeDist = this.getFrontToBackDistance(other);
            
            if (edgeDist < minDist) {
                minDist = edgeDist;
                closest = { distance: edgeDist, velocity: other.velocity, id: other.id };
            }
        }

        return closest;
    }

    /**
     * Detect head-on (oncoming) traffic
     */
    private detectHeadOnTraffic(otherCars: Car[]): { distance: number; velocity: number; id: string } | null {
        let closest: { distance: number; velocity: number; id: string } | null = null;
        let minDist = 5;

        for (const other of otherCars) {
            if (other.id === this.id || other.isCollided) continue;

            // Check for opposing headings (head-on)
            const headingDot = this.heading.x * other.heading.x + this.heading.y * other.heading.y;
            if (headingDot > -0.8) continue;  // Not head-on

            // Check if other car is ahead of us
            const dx = other.position.x - this.position.x;
            const dy = other.position.y - this.position.y;
            const dot = dx * this.heading.x + dy * this.heading.y;
            
            if (dot <= 0) continue;  // Not ahead

            // Check if in same lane (lateral distance)
            const cross = Math.abs(dx * this.heading.y - dy * this.heading.x);
            if (cross > 0.6) continue;  // Not in our path

            // Use edge distance (front-to-front for head-on)
            const edgeDist = this.getEdgeDistance(other);
            
            if (edgeDist < minDist) {
                minDist = edgeDist;
                // Combined velocity for closing speed (both cars approaching each other)
                const closingVelocity = this.velocity + other.velocity;
                closest = { distance: edgeDist, velocity: -closingVelocity, id: other.id };
            }
        }

        return closest;
    }

    /**
     * Get distance to traffic light from front of car
     */
    private getDistanceToLight(light: TrafficLight): number {
        const frontCenter = this.collisionNodes[1];
        const dx = light.position.x - frontCenter.x;
        const dy = light.position.y - frontCenter.y;
        
        // Only consider forward distance along heading
        const forwardDist = dx * this.heading.x + dy * this.heading.y;
        return Math.max(0, forwardDist);
    }

    /**
     * Detect cross-traffic at intersections using trajectory prediction
     */
    private detectCrossTraffic(otherCars: Car[], grid: GridCell[][], currentCell: GridCell | undefined): { distance: number; id: string } | null {
        if (currentCell?.type !== 'intersection' && !this.isApproachingIntersection(grid)) {
            return null;
        }

        if (this.stuckTimer > 180) return null;

        const myHeading = this.getCardinalDirection();
        let closest: { distance: number; id: string } | null = null;
        let minDist = 5.0;

        for (const other of otherCars) {
            if (other.id === this.id || other.isCollided) continue;
            if (other.stuckTimer > 120) continue;

            const otherHeading = other.getCardinalDirection();
            
            if (!this.areHeadingsConflicting(myHeading, otherHeading)) continue;

            const edgeDist = this.getEdgeDistance(other);
            
            // Direct distance check - yield if they're close
            if (edgeDist < minDist && other.velocity > 0.015) {
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const cross = dx * this.heading.y - dy * this.heading.x;
                const dot = dx * this.heading.x + dy * this.heading.y;
                
                // Yield to cars that are ahead or beside us
                if (dot > -1.5 && dot < 4.0) {
                    // Right-of-way: yield to car on our right, or faster car
                    const shouldYield = cross < 0 || other.velocity > this.velocity * 1.05;
                    if (shouldYield) {
                        minDist = edgeDist;
                        closest = { distance: edgeDist, id: other.id };
                    }
                }
            }
            
            // Trajectory collision prediction - look ahead
            if (other.velocity > 0.01 && this.velocity > 0.01) {
                const collision = this.predictTrajectoryCollision(other);
                if (collision && collision.time < 60) {
                    // Collision imminent - yield to faster car or car on the right
                    const shouldYield = collision.otherArrives < collision.weArrive || 
                                        other.velocity > this.velocity;
                    if (shouldYield && collision.distance < minDist) {
                        minDist = collision.distance;
                        closest = { distance: collision.distance, id: other.id };
                    }
                }
            }
        }

        return closest;
    }

    /**
     * Predict if two car trajectories will intersect
     */
    private predictTrajectoryCollision(other: Car): { time: number; distance: number; weArrive: number; otherArrives: number } | null {
        // Project positions forward to find intersection point
        // Parametric line intersection: this.pos + t * this.heading = other.pos + s * other.heading
        const dx = other.position.x - this.position.x;
        const dy = other.position.y - this.position.y;
        
        // Cross product of headings
        const cross = this.heading.x * other.heading.y - this.heading.y * other.heading.x;
        
        // If parallel, no intersection
        if (Math.abs(cross) < 0.1) return null;
        
        // Time for us to reach intersection point (in distance units)
        const t = (dx * other.heading.y - dy * other.heading.x) / cross;
        // Time for other to reach intersection point
        const s = (dx * this.heading.y - dy * this.heading.x) / cross;
        
        // Only consider future intersections
        if (t < 0 || s < 0) return null;
        
        // Check if intersection is within reasonable range (5 cells)
        if (t > 5 || s > 5) return null;
        
        // Calculate time to reach intersection (ticks at current velocities)
        const ourTime = this.velocity > 0.001 ? t / this.velocity : 1000;
        const theirTime = other.velocity > 0.001 ? s / other.velocity : 1000;
        
        // Check if we'd arrive at similar times (collision risk)
        const timeDiff = Math.abs(ourTime - theirTime);
        const safetyMargin = 30; // ticks
        
        if (timeDiff < safetyMargin) {
            const currentDist = this.getEdgeDistance(other);
            return { 
                time: Math.min(ourTime, theirTime), 
                distance: currentDist,
                weArrive: ourTime,
                otherArrives: theirTime
            };
        }
        
        return null;
    }

    /**
     * Check if moving to position would cause collision
     */
    private wouldCollideAt(x: number, y: number, otherCars: Car[]): boolean {
        const oldPos = { ...this.position };
        this.position = { x, y };
        this.updateCollisionNodes();

        let collision = false;
        for (const other of otherCars) {
            if (other.id === this.id || other.isCollided) continue;
            
            if (this.checkNodeOverlap(other)) {
                collision = true;
                break;
            }
        }

        this.position = oldPos;
        this.updateCollisionNodes();
        return collision;
    }

    /**
     * Check for actual collisions with node overlap
     */
    private checkForCollisions(otherCars: Car[]) {
        for (const other of otherCars) {
            if (other.id === this.id || other.isCollided || this.isCollided) continue;
            
            // Need more time before registering collision
            if (this.lifeTicks < 100 || other.lifeTicks < 100) continue;

            const edgeDist = this.getEdgeDistance(other);
            
            // Check if headings are conflicting (collision only from different directions)
            const headingDot = this.heading.x * other.heading.x + this.heading.y * other.heading.y;
            
            // Same direction - only severe overlap counts (rear-end)
            if (headingDot > 0.7) {
                if (edgeDist < 0.02) {
                    this.isCollided = true;
                    other.isCollided = true;
                }
            }
            // Different directions - cross-traffic collision
            else {
                // Severe overlap only
                if (edgeDist < 0.04) {
                    this.isCollided = true;
                    other.isCollided = true;
                }
            }
        }
    }

    private advanceWaypoints() {
        if (this.currentTargetIndex >= this.path.length) return;
        
        const target = this.path[this.currentTargetIndex];
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const distSq = dx * dx + dy * dy;
        
        const isLast = this.currentTargetIndex === this.path.length - 1;
        const threshold = isLast ? 0.25 : 0.04;
        
        if (distSq < threshold * threshold) {
            this.currentTargetIndex++;
            return;
        }

        if (this.currentTargetIndex > 0 && distSq > 4.0) return;
        
        const prev = this.currentTargetIndex === 0 ? this.startPos : this.path[this.currentTargetIndex - 1];
        const segX = target.x - prev.x;
        const segY = target.y - prev.y;
        const toTargetX = target.x - this.position.x;
        const toTargetY = target.y - this.position.y;
        
        if (segX * toTargetX + segY * toTargetY < 0) {
            this.currentTargetIndex++;
        }
    }

    private getNearestLightInCorridor(lights: TrafficLight[]): TrafficLight | null {
        const heading = this.getCardinalDirection();
        let best: TrafficLight | null = null;
        let minDist = 6;

        for (const light of lights) {
            if (light.state === 'GREEN') continue;

            const parts = light.id.split('_');
            if (parts.length < 2) continue;
            const lightDir = parts[1].charAt(0);

            let relevant = false;
            if (lightDir === 'n' && heading === 'SOUTH') relevant = true;
            if (lightDir === 's' && heading === 'NORTH') relevant = true;
            if (lightDir === 'e' && heading === 'WEST') relevant = true;
            if (lightDir === 'w' && heading === 'EAST') relevant = true;
            if (!relevant) continue;

            const dx = light.position.x - this.position.x;
            const dy = light.position.y - this.position.y;
            const dot = dx * this.heading.x + dy * this.heading.y;
            const cross = Math.abs(dx * this.heading.y - dy * this.heading.x);

            if (dot > -0.3 && dot < minDist && cross < 1.0) {
                minDist = dot;
                best = light;
            }
        }

        return best;
    }

    private isApproachingIntersection(grid: GridCell[][]): boolean {
        for (let d = 1; d <= 3; d++) {
            const checkX = Math.floor(this.position.x + this.heading.x * d);
            const checkY = Math.floor(this.position.y + this.heading.y * d);
            const cell = grid[checkY]?.[checkX];
            if (cell?.type === 'intersection') return true;
        }
        return false;
    }

    public getCardinalDirection(): Direction {
        if (Math.abs(this.heading.x) > Math.abs(this.heading.y)) {
            return this.heading.x > 0 ? 'EAST' : 'WEST';
        }
        return this.heading.y > 0 ? 'SOUTH' : 'NORTH';
    }

    private areHeadingsConflicting(h1: Direction, h2: Direction): boolean {
        // Check for perpendicular (cross-traffic) AND head-on (opposite) conflicts
        const opposite: Record<Direction, Direction> = {
            'NORTH': 'SOUTH',
            'SOUTH': 'NORTH',
            'EAST': 'WEST',
            'WEST': 'EAST'
        };
        const perpendicular: Record<Direction, Direction[]> = {
            'NORTH': ['EAST', 'WEST'],
            'SOUTH': ['EAST', 'WEST'],
            'EAST': ['NORTH', 'SOUTH'],
            'WEST': ['NORTH', 'SOUTH']
        };
        return perpendicular[h1].includes(h2) || opposite[h1] === h2;
    }

    // Legacy compatibility
    public get isWaiting(): boolean {
        return this.isWaitingToStart || this.debugState === 'STOPPED';
    }
    
    public set isWaiting(value: boolean) {
        this.isWaitingToStart = value;
    }

    public get perceptionDelay(): number {
        return this.reactionTime;
    }

    public set perceptionDelay(value: number) {
        this.reactionTime = value;
    }

    // Lane change tracking
    public laneChangeIntent: 'LEFT' | 'RIGHT' | null = null;
    public laneChangeCooldown: number = 0;

    public canChangeLane(direction: 'LEFT' | 'RIGHT', otherCars: Car[]): boolean {
        const lateralDir = direction === 'LEFT' ? 1 : -1;
        const perpX = -this.heading.y * lateralDir;
        const perpY = this.heading.x * lateralDir;

        for (const other of otherCars) {
            if (other.id === this.id) continue;
            
            const relX = other.position.x - this.position.x;
            const relY = other.position.y - this.position.y;
            const dist = Math.sqrt(relX * relX + relY * relY);

            if (dist < 2.5) {
                const lateral = relX * perpX + relY * perpY;
                if (lateral > 0.3 && lateral < 1.5) {
                    return false;
                }
            }
        }
        return true;
    }
}
