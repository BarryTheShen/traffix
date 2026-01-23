export type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

export type CellType = 'empty' | 'road' | 'intersection' | 'entry' | 'exit';

export interface Vector2D {
    x: number;
    y: number;
}

export interface GridCell {
    type: CellType;
    allowedDirections: Direction[]; // Allowed directions to move from this cell
    laneType?: 'INNER' | 'OUTER';
}

export interface TrafficPhase {
    id: string;
    name: string;
    duration: number; // Ticks
    lightStates: { [groupId: string]: 'RED' | 'YELLOW' | 'GREEN' }; // Group ID (e.g., 'north', 'south') to state
}

export interface IntersectionState {
    id: string;
    phases: TrafficPhase[];
    currentPhaseIndex: number;
    timer: number;
    lights: any[]; // TrafficLight instances
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
    laneQueues: { [laneId: string]: number }; // Maps "x,y" to count
    blockedSpawnIds: string[]; 
}
