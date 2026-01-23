export type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

export type CellType = 'empty' | 'road' | 'intersection' | 'entry' | 'exit';

export interface Vector2D {
    x: number;
    y: number;
}

export interface GridCell {
    type: CellType;
    allowedDirections: Direction[]; 
    laneType?: 'INNER' | 'OUTER';
    roadId?: string; // Unified road identifier
}

export interface TrafficPhase {
    id: string;
    name: string;
    duration: number; 
    lightStates: { [groupId: string]: 'RED' | 'YELLOW' | 'GREEN' }; 
}

export interface IntersectionState {
    id: string;
    phases: TrafficPhase[];
    currentPhaseIndex: number;
    timer: number;
    lights: any[]; 
}

export interface SimulationState {
    tick: number;
    grid: GridCell[][];
    vehicles: any[]; 
    trafficLights: any[];
    intersections: IntersectionState[];
    exitedCars: number;
    score: number;
    gameOver: boolean;
    gameOverReason: string | null;
    rebelDebug: boolean;
    collisionRecovery: boolean;
    currentSpawnRate: number;
    spawnStuckWarning: boolean;
    laneQueues: { [laneId: string]: number }; 
    blockedSpawnIds: string[]; 
}