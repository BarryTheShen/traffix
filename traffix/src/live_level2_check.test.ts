import { describe, it, expect } from 'vitest';
import { Simulation } from './core/Simulation';

describe('Live Level2 Violation Check', () => {
    it('run level2 simulation and check for violations', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level2';
        sim.reset();
        sim.spawnRate = 5.0;
        sim.rebelChance = 0.0;

        const violations: any[] = [];

        function getTurnType(from: string, to: string): string {
            if (from === to) return 'STRAIGHT';
            const turnMap: any = {
                'NORTH': { 'WEST': 'LEFT', 'EAST': 'RIGHT', 'SOUTH': 'UTURN' },
                'SOUTH': { 'EAST': 'LEFT', 'WEST': 'RIGHT', 'NORTH': 'UTURN' },
                'EAST':  { 'NORTH': 'LEFT', 'SOUTH': 'RIGHT', 'WEST': 'UTURN' },
                'WEST':  { 'SOUTH': 'LEFT', 'NORTH': 'RIGHT', 'EAST': 'UTURN' }
            };
            return turnMap[from]?.[to] || 'STRAIGHT';
        }

        function getEffectiveLanePosition(travelDir: string, laneType: string): string {
            // OUTER is always RIGHT side in right-hand traffic
            return laneType === 'OUTER' ? 'RIGHT' : 'LEFT';
        }

        const seenCars = new Set<string>();

        // Run for 600 ticks
        for (let tick = 0; tick < 600; tick++) {
            sim.tick();
            const state = sim.getState();

            for (const vehicle of state.vehicles) {
                if (seenCars.has(vehicle.id)) continue;
                seenCars.add(vehicle.id);

                const car = vehicle as any;
                const path = car.path;
                if (!path || path.length < 2) continue;

                // Get entry cell info
                const entryCell = state.grid[path[0].y]?.[path[0].x];
                if (!entryCell || !entryCell.laneType) continue;

                const entryDir = entryCell.allowedDirections[0];
                const entryLane = entryCell.laneType;

                // Find first intersection exit
                for (let i = 1; i < path.length; i++) {
                    const prevCell = state.grid[path[i-1].y]?.[path[i-1].x];
                    const currCell = state.grid[path[i].y]?.[path[i].x];

                    if (prevCell?.type === 'intersection' && currCell?.type === 'road') {
                        const dx = path[i].x - path[i-1].x;
                        const dy = path[i].y - path[i-1].y;
                        const exitDir = dx > 0 ? 'EAST' : dx < 0 ? 'WEST' : dy > 0 ? 'SOUTH' : 'NORTH';

                        const turnType = getTurnType(entryDir, exitDir);
                        const effectiveLane = getEffectiveLanePosition(entryDir, entryLane);

                        const isViolation =
                            (effectiveLane === 'LEFT' && turnType === 'RIGHT') ||
                            (effectiveLane === 'RIGHT' && turnType === 'LEFT');

                        if (isViolation && !car.violatesRules) {
                            violations.push({
                                carId: car.id,
                                tick,
                                entryDir,
                                entryLane,
                                effectiveLane,
                                exitDir,
                                turnType,
                                startPos: path[0],
                                pathSample: path.slice(0, 8)
                            });
                        }
                        break;
                    }
                }
            }
        }

        console.log(`\n=== LEVEL2 VIOLATION CHECK ===`);
        console.log(`Total cars checked: ${seenCars.size}`);
        console.log(`Violations found: ${violations.length}`);

        if (violations.length > 0) {
            console.log('\nVIOLATIONS:');
            violations.slice(0, 5).forEach(v => {
                console.log(`  ${v.carId}:`);
                console.log(`    Entry: ${v.entryDir} ${v.entryLane} at (${v.startPos.x},${v.startPos.y})`);
                console.log(`    Effective lane: ${v.effectiveLane}`);
                console.log(`    Exit: ${v.exitDir} (${v.turnType} turn)`);
                console.log(`    Path: ${v.pathSample.map((p:any) => `(${p.x},${p.y})`).join(' -> ')}`);
            });
        }

        expect(violations.length).toBe(0);
    });
});
