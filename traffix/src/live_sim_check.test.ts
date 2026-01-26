import { describe, it, expect } from 'vitest';
import { Simulation } from './core/Simulation';

describe('Live Simulation Lane Check', () => {
    it('run simulation and check for lane violations in spawned cars', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();

        // Turn type determination
        function getTurnType(fromDir: string, toDir: string): string {
            if (fromDir === toDir) return 'STRAIGHT';
            const turnMap: Record<string, Record<string, string>> = {
                'NORTH': { 'WEST': 'LEFT', 'EAST': 'RIGHT', 'SOUTH': 'UTURN' },
                'SOUTH': { 'EAST': 'LEFT', 'WEST': 'RIGHT', 'NORTH': 'UTURN' },
                'EAST':  { 'NORTH': 'LEFT', 'SOUTH': 'RIGHT', 'WEST': 'UTURN' },
                'WEST':  { 'SOUTH': 'LEFT', 'NORTH': 'RIGHT', 'EAST': 'UTURN' }
            };
            return turnMap[fromDir]?.[toDir] || 'UNKNOWN';
        }

        // Effective lane position (should match Pathfinding.ts)
        function getEffectiveLanePosition(travelDir: string, laneType: string): string {
            if (travelDir === 'SOUTH' || travelDir === 'NORTH') {
                return laneType === 'OUTER' ? 'LEFT' : 'RIGHT';
            } else {
                return laneType === 'OUTER' ? 'RIGHT' : 'LEFT';
            }
        }

        const violations: string[] = [];
        const allCars: Map<string, any> = new Map();

        // Run 2000 ticks
        for (let tick = 0; tick < 2000; tick++) {
            sim.tick();

            const state = sim.getState();

            // Track all cars and their entry info
            for (const car of state.vehicles) {
                if (!allCars.has(car.id)) {
                    const entryCell = state.grid[Math.round(car.path[0]?.y)]?.[Math.round(car.path[0]?.x)];
                    const exitCell = state.grid[Math.round(car.destination.y)]?.[Math.round(car.destination.x)];
                    
                    if (entryCell && exitCell && entryCell.laneType && exitCell.allowedDirections?.[0]) {
                        const entryDir = entryCell.allowedDirections[0];
                        const entryLane = entryCell.laneType;
                        const exitDir = exitCell.allowedDirections[0];

                        const turnType = getTurnType(entryDir, exitDir);
                        const effectivePos = getEffectiveLanePosition(entryDir, entryLane);

                        // Check if this is a violation
                        const isViolation = 
                            (effectivePos === 'LEFT' && turnType === 'RIGHT') ||
                            (effectivePos === 'RIGHT' && turnType === 'LEFT');

                        allCars.set(car.id, {
                            entryDir,
                            entryLane,
                            exitDir,
                            turnType,
                            effectivePos,
                            isViolation,
                            entry: car.path[0],
                            exit: car.destination
                        });

                        if (isViolation) {
                            violations.push(
                                `${car.id}: ${entryDir} ${entryLane} (${effectivePos} side) → ${exitDir}: ${turnType} turn`
                            );
                        }
                    }
                }
            }
        }

        console.log(`\nTotal cars spawned: ${allCars.size}`);
        console.log(`Violations: ${violations.length}\n`);

        if (violations.length > 0) {
            console.log('=== VIOLATIONS ===');
            violations.slice(0, 20).forEach(v => console.log(`  ❌ ${v}`));
            if (violations.length > 20) {
                console.log(`  ... and ${violations.length - 20} more`);
            }
        }

        // Show distribution
        const byDir: Record<string, number> = {};
        const byTurn: Record<string, number> = {};
        for (const [_, info] of allCars) {
            byDir[info.entryDir] = (byDir[info.entryDir] || 0) + 1;
            byTurn[info.turnType] = (byTurn[info.turnType] || 0) + 1;
        }
        console.log('\nBy entry direction:', byDir);
        console.log('By turn type:', byTurn);

        expect(violations.length).toBe(0);
    });
});
