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
    maxVelocity: 0.25,
    acceleration: 0.008,      // ~0.48 cells/sec² at 60fps (realistic)
    deceleration: 0.025,      // ~1.5 cells/sec² at 60fps (comfortable braking)
    reactionTime: 12          // ~0.2 seconds at 60fps
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
    private wasStoppedBehindCar: boolean = false;  // Track if stopped behind another car
    private leadCarWasStopped: boolean = false;    // Track if lead car was stopped

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
            this.updateCollisionNodes();  // Still update collision nodes so other cars can see us
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
        // Add stop gap so cars stop 0.5 car-lengths before the light
        const TRAFFIC_LIGHT_STOP_GAP = 0.35;  // Gap before traffic light edge
        const light = this.getNearestLightInCorridor(lights);
        if (light && light.state !== 'GREEN') {
            const lightDist = this.getDistanceToLight(light) - TRAFFIC_LIGHT_STOP_GAP;
            if (lightDist < obstacleDistance) {
                obstacleDistance = Math.max(0, lightDist);
                obstacleVelocity = 0;
                this.limitReason = 'RED_LIGHT';
                if (lightDist < 0.05) isHardBlock = true;
            }
        }

        // 2. Lead Vehicle Detection (edge-to-edge, same direction)
        // Skip if we've been stuck too long - prevent infinite stuck chains
        const leadInfo = (this.stuckTimer < 300) ? this.getLeadVehicleInfo(otherCars) : null;
        let leadCarStopped = false;
        if (leadInfo) {
            const followGap = this.length * 0.5;  // Target gap: half car length (0.35 units)
            const effectiveDist = leadInfo.distance - followGap;
            leadCarStopped = leadInfo.velocity < 0.01;

            if (effectiveDist < obstacleDistance) {
                obstacleDistance = effectiveDist;
                obstacleVelocity = leadInfo.velocity;
                this.limitReason = 'CAR_AHEAD';
                // Emergency hard block only if about to physically overlap (< 0.05 units)
                if (effectiveDist < 0.05) isHardBlock = true;

                // Track if we're close and stopped behind a stopped car (for wave effect)
                if (this.velocity < 0.01 && leadCarStopped && effectiveDist < 2.0) {
                    this.wasStoppedBehindCar = true;
                    this.leadCarWasStopped = true;
                }
            }
        }

        // 2b. Head-on traffic detection (oncoming vehicles)
        // Skip if we've been stuck too long - prevent infinite head-on deadlocks
        const headOnInfo = (this.stuckTimer < 300) ? this.detectHeadOnTraffic(otherCars, grid) : null;
        if (headOnInfo) {
            // For head-on, both cars need to stop before they meet
            // Each car should stop at half the distance minus safety margin
            const effectiveDist = headOnInfo.distance / 2 - 0.5;

            if (effectiveDist < obstacleDistance) {
                obstacleDistance = Math.max(0, effectiveDist);
                obstacleVelocity = 0;  // Treat as stopping target
                this.limitReason = 'HEAD_ON';
                // Hard block if we're getting too close - stop immediately when < 1.5 cells
                if (headOnInfo.distance < 1.5) isHardBlock = true;
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
            // Only reset spawnStuckTimer if car has moved significantly away from spawn
            const dSq = (this.position.x - this.startPos.x) ** 2 + (this.position.y - this.startPos.y) ** 2;
            if (dSq >= 4.0) {
                this.spawnStuckTimer = 0;  // At least 2 cells from spawn
            }
        }
    }

    /**
     * Apply realistic kinematic physics for acceleration/deceleration
     *
     * Dynamic Following Distance (3-phase calculation):
     * Phase 1: Reaction distance - car travels at current velocity for reactionTime ticks
     * Phase 2: Catch-up distance - relative speed × time for lead car to stop
     * Phase 3: Own stopping distance + minimum gap (0.5 car lengths)
     *
     * If car cannot decelerate in time, it will crash (except at red lights where
     * isHardBlock=true allows instant stop since driver knew it was coming)
     */
    private applyKinematics(obstacleDistance: number, obstacleVelocity: number, isHardBlock: boolean, timeScale: number) {
        const acc = this.acceleration * timeScale;
        const dec = this.deceleration * timeScale;
        const maxV = this.maxVelocity * timeScale;
        const minGap = this.length * 0.5;  // Minimum gap: half car length (0.35 units)

        // Wave effect: If we were stopped behind a stopped car and it starts moving,
        // trigger reaction timer to create the wave/domino effect
        if (this.wasStoppedBehindCar && this.velocity < 0.01) {
            // Lead car is now moving (obstacleVelocity > 0)
            if (obstacleVelocity > 0.01 && this.leadCarWasStopped) {
                if (!this.isWaitingToStart) {
                    this.isWaitingToStart = true;
                    this.reactionTimer = this.reactionTime;
                }
                this.leadCarWasStopped = false;  // Reset so we only trigger once
            }
        }

        // Also trigger reaction timer when red light clears
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
                this.wasStoppedBehindCar = false;  // Reset after reaction complete
            }
            return;
        }

        // Hard blocked (red lights only) - driver knew it was coming, can stop instantly
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

        // ===== 3-PHASE DYNAMIC FOLLOWING DISTANCE CALCULATION =====

        // Phase 1: Reaction distance (travel during reaction time)
        // Car continues at current velocity for reactionTime ticks before reacting
        const reactionDistance = this.velocity * (this.reactionTime / 60);

        // Phase 2: Catch-up distance during lead car's braking
        // If lead car is moving and will brake, we close the gap at relative speed
        // Time for lead car to stop: t = v_lead / decel
        const relativeVelocity = this.velocity - obstacleVelocity;
        let catchUpDistance = 0;
        if (relativeVelocity > 0 && obstacleVelocity > 0) {
            const leadStopTime = obstacleVelocity / dec;
            catchUpDistance = relativeVelocity * leadStopTime * 0.5;  // Average during decel
        }

        // Phase 3: Own stopping distance after reacting
        // d = v² / (2 * decel)
        const ownStoppingDistance = (this.velocity * this.velocity) / (2 * dec);

        // Total required following distance
        const requiredFollowDist = reactionDistance + catchUpDistance + ownStoppingDistance + minGap;

        if (obstacleDistance <= requiredFollowDist) {
            // Need to brake - we're within following distance
            if (obstacleDistance <= 0.08) {
                // Very close - match obstacle velocity (no instant stop unless isHardBlock)
                // Decelerate aggressively but not instantly
                const targetV = Math.max(0, obstacleVelocity);
                this.velocity = Math.max(targetV, this.velocity - dec * 2);
            } else {
                // Calculate required deceleration to stop/match in remaining distance
                const distAfterReaction = obstacleDistance - reactionDistance;

                if (distAfterReaction > 0) {
                    // Still have distance after reaction - normal braking
                    const requiredDecel = relativeVelocity > 0
                        ? (relativeVelocity * relativeVelocity) / (2 * Math.max(0.01, distAfterReaction))
                        : dec;

                    // Apply deceleration (max 2x normal for emergencies)
                    const appliedDecel = Math.min(requiredDecel, dec * 2);
                    this.velocity = Math.max(obstacleVelocity, this.velocity - appliedDecel);
                } else {
                    // Already past reaction distance - emergency braking
                    this.velocity = Math.max(obstacleVelocity, this.velocity - dec * 2);
                }
            }
            this.debugState = 'BRAKING';
        } else {
            // Outside following distance - can accelerate or cruise
            // Calculate max safe velocity that allows stopping in time
            const maxApproachVelocity = Math.sqrt(2 * dec * (obstacleDistance - reactionDistance - minGap)) + obstacleVelocity;
            const targetVelocity = Math.min(maxV, Math.max(0, maxApproachVelocity));

            if (this.velocity < targetVelocity - 0.001) {
                this.velocity = Math.min(this.velocity + acc, targetVelocity);
                this.debugState = obstacleDistance > 5 ? 'ACCEL' : 'APPROACH';
            } else if (this.velocity > targetVelocity + 0.001) {
                this.velocity = Math.max(targetVelocity, this.velocity - dec * 0.5);
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
        let minDist = 15;  // Detection range for lead vehicles (increased for longer roads)

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
     * Note: Skip if we're in an intersection making a turn - we'll naturally
     * cross oncoming lanes momentarily and that's not a real head-on situation
     */
    private detectHeadOnTraffic(otherCars: Car[], grid?: GridCell[][]): { distance: number; velocity: number; id: string } | null {
        // Skip head-on detection if we're in an intersection (making turns)
        if (grid) {
            const myGridX = Math.floor(this.position.x);
            const myGridY = Math.floor(this.position.y);
            const myCell = grid[myGridY]?.[myGridX];
            if (myCell?.type === 'intersection') {
                return null;  // Don't detect head-on while turning in intersection
            }
        }

        let closest: { distance: number; velocity: number; id: string } | null = null;
        let minDist = 8;  // Increased detection range

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
            // On 4-lane roads, opposite lanes are 1+ cells apart, so use strict tolerance
            const cross = Math.abs(dx * this.heading.y - dy * this.heading.x);
            if (cross > 0.4) continue;  // Only trigger if truly in same lane (< half lane width)

            // Skip if the other car is in an intersection (they're turning)
            if (grid) {
                const otherGridX = Math.floor(other.position.x);
                const otherGridY = Math.floor(other.position.y);
                const otherCell = grid[otherGridY]?.[otherGridX];
                if (otherCell?.type === 'intersection') {
                    continue;  // Don't yield to cars turning in intersection
                }
            }

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
        let minDist = 3.0;  // Reduced from 5.0 - only detect closer traffic

        for (const other of otherCars) {
            if (other.id === this.id || other.isCollided) continue;
            if (other.stuckTimer > 120) continue;

            const otherHeading = other.getCardinalDirection();

            if (!this.areHeadingsConflicting(myHeading, otherHeading)) continue;

            const edgeDist = this.getEdgeDistance(other);

            // Yield if they're close - don't require them to be moving
            // Cars already in intersection have right of way
            if (edgeDist < minDist) {
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const cross = dx * this.heading.y - dy * this.heading.x;
                const dot = dx * this.heading.x + dy * this.heading.y;

                // Check if other car is actually heading towards us (closing)
                // If their heading points away from us, don't yield
                const otherToMeDot = -dx * other.heading.x - dy * other.heading.y;
                const isOtherMovingTowardsUs = otherToMeDot > 0;

                // Only yield if they're in front/beside us AND moving towards us
                if (dot > -1.5 && dot < 4.0 && (isOtherMovingTowardsUs || other.velocity < 0.01)) {
                    // Determine if we're on a turning collision course
                    // HEAD-ON in intersection: ALWAYS yield to avoid collision
                    const isHeadOn = (myHeading === 'EAST' && otherHeading === 'WEST') ||
                                     (myHeading === 'WEST' && otherHeading === 'EAST') ||
                                     (myHeading === 'NORTH' && otherHeading === 'SOUTH') ||
                                     (myHeading === 'SOUTH' && otherHeading === 'NORTH');

                    // For head-on conflicts, use deterministic yield based on id
                    // The car with "lower" id yields
                    const otherInIntersection = this.isCarInIntersection(other, grid);
                    const iAmInIntersection = currentCell?.type === 'intersection';

                    let shouldYield = false;
                    if (isHeadOn && edgeDist < 2.5) {
                        // Deterministic yield - one car always yields based on id comparison
                        shouldYield = this.id < other.id;
                    } else {
                        // Right-of-way: yield to car on our right, or car already in intersection
                        // Removed velocity comparison - don't yield just because they're faster
                        shouldYield = (cross < 0 && isOtherMovingTowardsUs) ||
                                     (otherInIntersection && !iAmInIntersection);
                    }

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
            // But if both are nearly stopped, they successfully avoided crash
            if (headingDot > 0.7) {
                const bothStopped = this.velocity < 0.02 && other.velocity < 0.02;
                if (!bothStopped && edgeDist < 0.02) {
                    this.isCollided = true;
                    other.isCollided = true;
                    console.log(`COLLISION[REAR-END]: ${this.id} <- ${other.id} | hdot=${headingDot.toFixed(2)} edgeDist=${edgeDist.toFixed(3)}`);
                    console.log(`  Car1: pos=(${this.position.x.toFixed(2)},${this.position.y.toFixed(2)}) heading=(${this.heading.x.toFixed(2)},${this.heading.y.toFixed(2)}) v=${this.velocity.toFixed(3)}`);
                    console.log(`  Car2: pos=(${other.position.x.toFixed(2)},${other.position.y.toFixed(2)}) heading=(${other.heading.x.toFixed(2)},${other.heading.y.toFixed(2)}) v=${other.velocity.toFixed(3)}`);
                }
            }
            // Different directions - cross-traffic collision
            else {
                // Check for severe overlap - but allow cars that have stopped to be close
                // If both cars are stopped (v < 0.01), they successfully avoided actual crash
                const bothStopped = this.velocity < 0.02 && other.velocity < 0.02;
                if (!bothStopped && edgeDist < 0.04) {
                    this.isCollided = true;
                    other.isCollided = true;
                    console.log(`COLLISION[HEAD-ON/CROSS]: ${this.id} X ${other.id} | headingDot=${headingDot.toFixed(2)}`);
                    console.log(`  Car1: pos=(${this.position.x.toFixed(2)},${this.position.y.toFixed(2)}) heading=(${this.heading.x.toFixed(2)},${this.heading.y.toFixed(2)}) v=${this.velocity.toFixed(3)} idx=${this.currentTargetIndex}/${this.path.length}`);
                    console.log(`  Car1 last5: ${JSON.stringify(this.path.slice(-5))}`);
                    console.log(`  Car2: pos=(${other.position.x.toFixed(2)},${other.position.y.toFixed(2)}) heading=(${other.heading.x.toFixed(2)},${other.heading.y.toFixed(2)}) v=${other.velocity.toFixed(3)} idx=${other.currentTargetIndex}/${other.path.length}`);
                    console.log(`  Car2 last5: ${JSON.stringify(other.path.slice(-5))}`);
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

    private isCarInIntersection(car: Car, grid: GridCell[][]): boolean {
        const gridX = Math.floor(car.position.x);
        const gridY = Math.floor(car.position.y);
        const cell = grid[gridY]?.[gridX];
        return cell?.type === 'intersection';
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
