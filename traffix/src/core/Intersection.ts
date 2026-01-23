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
        // Individual Direction Round Robin (Maximize safety, minimize lane-changing panic)
        this.phases = [
            // North
            {
                id: 'p1', name: 'N Green', duration: 150,
                lightStates: { 'n': 'GREEN', 's': 'RED', 'e': 'RED', 'w': 'RED' }
            },
            {
                id: 'p2', name: 'N Yellow', duration: 30,
                lightStates: { 'n': 'YELLOW', 's': 'RED', 'e': 'RED', 'w': 'RED' }
            },
            {
                id: 'p3', name: 'All Red', duration: 30,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' }
            },
            // South
            {
                id: 'p4', name: 'S Green', duration: 150,
                lightStates: { 'n': 'RED', 's': 'GREEN', 'e': 'RED', 'w': 'RED' }
            },
            {
                id: 'p5', name: 'S Yellow', duration: 30,
                lightStates: { 'n': 'RED', 's': 'YELLOW', 'e': 'RED', 'w': 'RED' }
            },
            {
                id: 'p6', name: 'All Red', duration: 30,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' }
            },
            // East
            {
                id: 'p7', name: 'E Green', duration: 150,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'GREEN', 'w': 'RED' }
            },
            {
                id: 'p8', name: 'E Yellow', duration: 30,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'YELLOW', 'w': 'RED' }
            },
            {
                id: 'p9', name: 'All Red', duration: 30,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' }
            },
            // West
            {
                id: 'p10', name: 'W Green', duration: 150,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'GREEN' }
            },
            {
                id: 'p11', name: 'W Yellow', duration: 30,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'YELLOW' }
            },
            {
                id: 'p12', name: 'All Red', duration: 30,
                lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' }
            }
        ];
    }

    public update() {
        if (!this.phases || this.phases.length === 0) return;
        this.timer++;
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
            const dirPart = parts[1]; 
            const dir = dirPart.charAt(0); 
            const state = currentPhase.lightStates[dir];
            if (state) light.state = state;
            else light.state = 'RED';
        });
    }
}
