import { describe, it, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Pathfinding } from './core/Pathfinding';

describe('Comprehensive Lane Check - 20000 ticks', () => {
    it('track all cars and verify their paths are legal', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const grid = sim.getState().grid;

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

        const violations: {id: string, details: string, path: any[], entry: any, exit: any}[] = [];
        const allCars: Map<string, any> = new Map();

        // Run 20000 ticks
        for (let tick = 0; tick < 20000; tick++) {
            sim.tick();

            const state = sim.getState();

            // Track all cars
            for (const car of state.vehicles) {
                if (!allCars.has(car.id) && car.path && car.path.length > 0) {
                    const entryPoint = car.path[0];
                    const exitPoint = car.destination;
                    
                    if (!entryPoint || !exitPoint) continue;
                    
                    const entryX = Math.round(entryPoint.x);
                    const entryY = Math.round(entryPoint.y);
                    const exitX = Math.round(exitPoint.x);
                    const exitY = Math.round(exitPoint.y);
                    
                    const entryCell = grid[entryY]?.[entryX];
                    const exitCell = grid[exitY]?.[exitX];
                    
                    if (!entryCell || !exitCell) continue;
                    if (!entryCell.laneType || !entryCell.allowedDirections?.[0]) continue;
                    if (!exitCell.allowedDirections?.[0]) continue;

                    const entryDir = entryCell.allowedDirections[0];
                    const entryLane = entryCell.laneType;
                    const exitDir = exitCell.allowedDirections[0];
                    const exitLane = exitCell.laneType;

                    const turnType = getTurnType(entryDir, exitDir);
                    const effectivePos = getEffectiveLanePosition(entryDir, entryLane);

                    // Check if this is a lane rule violation
                    const isLaneViolation = 
                        (effectivePos === 'LEFT' && turnType === 'RIGHT') ||
                        (effectivePos === 'RIGHT' && turnType === 'LEFT');

                    // Also verify the path using Pathfinding directly
                    const verifyPath = Pathfinding.findPath(grid, 
                        {x: entryX, y: entryY},
                        {x: exitX, y: exitY},
                        false
                    );

                    const pathMismatch = verifyPath === null;

                    allCars.set(car.id, {
                        entryDir,
                        entryLane,
                        exitDir,
                        exitLane,
                        turnType,
                        effectivePos,
                        isLaneViolation,
                        pathMismatch,
                        entry: {x: entryX, y: entryY},
                        exit: {x: exitX, y: exitY},
                        carPath: car.path
                    });

                    if (isLaneViolation) {
                        violations.push({
                            id: car.id,
                            details: `LANE RULE: ${entryDir} ${entryLane} (${effectivePos} side) → ${exitDir}: ${turnType} turn not allowed`,
                            path: car.path,
                            entry: {x: entryX, y: entryY, dir: entryDir, lane: entryLane},
                            exit: {x: exitX, y: exitY, dir: exitDir, lane: exitLane}
                        });
                    }

                    if (pathMismatch) {
                        violations.push({
                            id: car.id,
                            details: `PATH MISMATCH: Car has path but Pathfinding.findPath returns null for (${entryX},${entryY}) → (${exitX},${exitY})`,
                            path: car.path,
                            entry: {x: entryX, y: entryY, dir: entryDir, lane: entryLane},
                            exit: {x: exitX, y: exitY, dir: exitDir, lane: exitLane}
                        });
                    }
                }
            }
        }

        console.log(`\n========================================`);
        console.log(`Total cars spawned: ${allCars.size}`);
        console.log(`Total violations: ${violations.length}`);
        console.log(`========================================\n`);

        if (violations.length > 0) {
            console.log('=== VIOLATIONS ===\n');
            
            // Group by type
            const laneViolations = violations.filter(v => v.details.startsWith('LANE RULE'));
            const pathMismatches = violations.filter(v => v.details.startsWith('PATH MISMATCH'));
            
            console.log(`Lane Rule Violations: ${laneViolations.length}`);
            console.log(`Path Mismatches: ${pathMismatches.length}\n`);
            
            // Show samples
            console.log('Sample violations:');
            violations.slice(0, 30).forEach(v => {
                console.log(`  ❌ ${v.id}: ${v.details}`);
                console.log(`     Entry: (${v.entry.x},${v.entry.y}) ${v.entry.dir} ${v.entry.lane}`);
                console.log(`     Exit: (${v.exit.x},${v.exit.y}) ${v.exit.dir} ${v.exit.lane || 'N/A'}`);
            });
        }

        // Show distribution
        const byDir: Record<string, number> = {};
        const byTurn: Record<string, number> = {};
        const byLane: Record<string, number> = {};
        for (const [_, info] of allCars) {
            byDir[info.entryDir] = (byDir[info.entryDir] || 0) + 1;
            byTurn[info.turnType] = (byTurn[info.turnType] || 0) + 1;
            byLane[`${info.entryDir}_${info.entryLane}`] = (byLane[`${info.entryDir}_${info.entryLane}`] || 0) + 1;
        }
        console.log('\nBy entry direction:', byDir);
        console.log('By turn type:', byTurn);
        console.log('By entry lane:', byLane);

        expect(violations.length).toBe(0);
    });
});
