import { TrafficLight } from '../entities/TrafficLight';
import type { TrafficPhase, IntersectionState } from './types';

export class Intersection implements IntersectionState {
    public id: string;
    public phases: TrafficPhase[] = [];
    public currentPhaseIndex: number = 0;
    public timer: number = 0;
    public lights: TrafficLight[] = [];

    constructor(id: string, lights: TrafficLight[]) {
        this.id = id;
        this.lights = lights;
        this.setDefaultPhases();
    }

    private setDefaultPhases() {
        // Standard Round Robin default
        this.phases = [
            {
                id: 'p1',
                name: 'NS Green',
                duration: 300,
                lightStates: { 'n': 'GREEN', 's': 'GREEN', 'e': 'RED', 'w': 'RED' }
            },
            {
                id: 'p2',
                name: 'NS Yellow',
                duration: 60,
                lightStates: { 'n': 'YELLOW', 's': 'YELLOW', 'e': 'RED', 'w': 'RED' }
            },
            {
                id: 'p3',
                name: 'All Red',
                duration: 60,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' }
            },
            {
                id: 'p4',
                name: 'EW Green',
                duration: 300,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'GREEN', 'w': 'GREEN' }
            },
            {
                id: 'p5',
                name: 'EW Yellow',
                duration: 60,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'YELLOW', 'w': 'YELLOW' }
            },
             {
                id: 'p6',
                name: 'All Red',
                duration: 60,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' }
            }
        ];
    }

    public update() {
        if (!this.phases || this.phases.length === 0) return;

        this.timer++;
        
        // Safety check for index out of bounds
        if (this.currentPhaseIndex >= this.phases.length) {
            this.currentPhaseIndex = 0;
            this.timer = 0;
        }

        const currentPhase = this.phases[this.currentPhaseIndex];

        if (this.timer >= currentPhase.duration) {
            this.timer = 0;
            this.currentPhaseIndex = (this.currentPhaseIndex + 1) % this.phases.length;
        }

        this.applyPhase();
    }

    public applyPhase() {
        if (this.phases.length === 0) return;
        const currentPhase = this.phases[this.currentPhaseIndex];
        this.lights.forEach(light => {
            const parts = light.id.split('_');
            const dirPart = parts[1]; // "n1", "s2", etc.
            const dir = dirPart.charAt(0); // "n", "s", "e", "w"
            
            const state = currentPhase.lightStates[dir];
            if (state) {
                light.state = state;
            } else {
                light.state = 'RED';
            }
        });
    }
}
