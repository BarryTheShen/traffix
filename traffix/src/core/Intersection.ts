import { TrafficLight } from '../entities/TrafficLight';
import type { TrafficPhase, IntersectionState } from './types';

export type TrafficLightPreset = 'round-robin' | 'opposite-phasing' | 'all-way-stop' | 'manual';

export interface PresetConfig {
    greenDuration: number;
    yellowDuration: number;
    allRedDuration: number;
}

export class Intersection implements IntersectionState {
    public id: string;
    public phases: TrafficPhase[] = [];
    public currentPhaseIndex: number = 0;
    public timer: number = 0;
    public lights: TrafficLight[] = [];
    public currentPreset: TrafficLightPreset = 'opposite-phasing';
    public presetConfig: PresetConfig = {
        greenDuration: 180,
        yellowDuration: 30,
        allRedDuration: 30
    };

    constructor(id: string, lights: TrafficLight[]) {
        this.id = id;
        this.lights = lights;
        this.applyPreset('round-robin'); // Round-robin prevents all turn conflicts
    }

    /**
     * Apply a traffic light preset configuration
     */
    public applyPreset(preset: TrafficLightPreset, config?: Partial<PresetConfig>) {
        this.currentPreset = preset;
        if (config) {
            this.presetConfig = { ...this.presetConfig, ...config };
        }

        const { greenDuration, yellowDuration, allRedDuration } = this.presetConfig;

        switch (preset) {
            case 'round-robin':
                this.setRoundRobinPhases(greenDuration, yellowDuration, allRedDuration);
                break;
            case 'opposite-phasing':
                this.setOppositePhases(greenDuration, yellowDuration, allRedDuration);
                break;
            case 'all-way-stop':
                this.setAllWayStop();
                break;
            case 'manual':
                // Keep current phases, don't change anything
                break;
        }

        this.currentPhaseIndex = 0;
        this.timer = 0;
        this.applyPhase();
    }

    /**
     * Round-robin: Each direction gets its own green phase
     * Order: North -> South -> East -> West
     */
    private setRoundRobinPhases(green: number, yellow: number, allRed: number) {
        this.phases = [
            { id: 'p1', name: 'N Green', duration: green, lightStates: { 'n': 'GREEN', 's': 'RED', 'e': 'RED', 'w': 'RED' } },
            { id: 'p2', name: 'N Yellow', duration: yellow, lightStates: { 'n': 'YELLOW', 's': 'RED', 'e': 'RED', 'w': 'RED' } },
            { id: 'p3', name: 'All Red', duration: allRed, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' } },
            { id: 'p4', name: 'S Green', duration: green, lightStates: { 'n': 'RED', 's': 'GREEN', 'e': 'RED', 'w': 'RED' } },
            { id: 'p5', name: 'S Yellow', duration: yellow, lightStates: { 'n': 'RED', 's': 'YELLOW', 'e': 'RED', 'w': 'RED' } },
            { id: 'p6', name: 'All Red', duration: allRed, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' } },
            { id: 'p7', name: 'E Green', duration: green, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'GREEN', 'w': 'RED' } },
            { id: 'p8', name: 'E Yellow', duration: yellow, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'YELLOW', 'w': 'RED' } },
            { id: 'p9', name: 'All Red', duration: allRed, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' } },
            { id: 'p10', name: 'W Green', duration: green, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'GREEN' } },
            { id: 'p11', name: 'W Yellow', duration: yellow, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'YELLOW' } },
            { id: 'p12', name: 'All Red', duration: allRed, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' } }
        ];
    }

    /**
     * Opposite phasing: N+S together, then E+W together
     * More efficient for through traffic
     */
    private setOppositePhases(green: number, yellow: number, allRed: number) {
        this.phases = [
            { id: 'p1', name: 'N-S Green', duration: green, lightStates: { 'n': 'GREEN', 's': 'GREEN', 'e': 'RED', 'w': 'RED' } },
            { id: 'p2', name: 'N-S Yellow', duration: yellow, lightStates: { 'n': 'YELLOW', 's': 'YELLOW', 'e': 'RED', 'w': 'RED' } },
            { id: 'p3', name: 'All Red', duration: allRed, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' } },
            { id: 'p4', name: 'E-W Green', duration: green, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'GREEN', 'w': 'GREEN' } },
            { id: 'p5', name: 'E-W Yellow', duration: yellow, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'YELLOW', 'w': 'YELLOW' } },
            { id: 'p6', name: 'All Red', duration: allRed, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' } }
        ];
    }

    /**
     * All-way stop: All lights blink red (simulated with short all-red phases)
     */
    private setAllWayStop() {
        this.phases = [
            { id: 'p1', name: 'All Red', duration: 60, lightStates: { 'n': 'RED', 's': 'RED', 'e': 'RED', 'w': 'RED' } }
        ];
    }

    public resetToDefault() {
        this.setOppositePhases(180, 30, 30);
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

    /**
     * Update timing configuration for current preset
     */
    public updateTiming(green: number, yellow: number, allRed: number) {
        this.presetConfig = { greenDuration: green, yellowDuration: yellow, allRedDuration: allRed };
        if (this.currentPreset !== 'manual') {
            this.applyPreset(this.currentPreset);
        }
    }
}
