import { describe, it, expect } from 'vitest';
import { Simulation } from './core/Simulation';

describe('Trace Car Paths', () => {
    it('track car paths through intersections', { timeout: 120000 }, () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const grid = sim.getState().grid;

        // Get effective lane position
        function getEffectiveLanePosition(travelDir: string, laneType: string): string {
            if (travelDir === 'SOUTH' || travelDir === 'NORTH') {
                return laneType === 'OUTER' ? 'LEFT' : 'RIGHT';
            } else {
                return laneType === 'OUTER' ? 'RIGHT' : 'LEFT';
            }
        }

        // Turn type
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

        const trackedCars: any[] = [];
        const seenIds = new Set<string>();

        // Run 5000 ticks
        for (let tick = 0; tick < 5000; tick++) {
            sim.tick();
            const state = sim.getState();

            for (const car of state.vehicles) {
                if (!seenIds.has(car.id) && car.path && car.path.length > 5) {
                    seenIds.add(car.id);
                    
                    // Get entry info
                    const entryPoint = car.path[0];
                    const entryX = Math.round(entryPoint.x);
                    const entryY = Math.round(entryPoint.y);
                    const entryCell = grid[entryY]?.[entryX];
                    
                    if (!entryCell?.laneType) continue;
                    
                    const entryDir = entryCell.allowedDirections[0];
                    const entryLane = entryCell.laneType;

                    // Get exit info
                    const exitPoint = car.destination;
                    const exitX = Math.round(exitPoint.x);
                    const exitY = Math.round(exitPoint.y);
                    const exitCell = grid[exitY]?.[exitX];
                    
                    if (!exitCell) continue;
                    
                    const exitDir = exitCell.allowedDirections?.[0];

                    // Trace path - check each cell
                    const pathIssues: string[] = [];
                    let prevLane: string | null = null;
                    let prevDir: string | null = null;
                    
                    for (let i = 0; i < car.path.length; i++) {
                        const p = car.path[i];
                        const px = Math.round(p.x);
                        const py = Math.round(p.y);
                        const cell = grid[py]?.[px];
                        
                        if (!cell) continue;
                        
                        if (cell.type === 'road' || cell.type === 'entry' || cell.type === 'exit') {
                            const cellDir = cell.allowedDirections[0];
                            const cellLane = cell.laneType;
                            
                            // Check for lane changes on straight road
                            if (prevLane && cellLane && cellLane !== prevLane && cellDir === prevDir) {
                                pathIssues.push(`Lane change at (${px},${py}): ${prevLane} → ${cellLane}`);
                            }
                            
                            prevLane = cellLane || prevLane;
                            prevDir = cellDir || prevDir;
                        }
                    }

                    const turnType = getTurnType(entryDir, exitDir || 'UNKNOWN');
                    const effectivePos = getEffectiveLanePosition(entryDir, entryLane);
                    
                    // Is this a legal turn?
                    const isLegal = 
                        (effectivePos === 'LEFT' && (turnType === 'LEFT' || turnType === 'STRAIGHT')) ||
                        (effectivePos === 'RIGHT' && (turnType === 'RIGHT' || turnType === 'STRAIGHT'));

                    trackedCars.push({
                        id: car.id,
                        entry: `(${entryX},${entryY}) ${entryDir} ${entryLane} [${effectivePos}]`,
                        exit: `(${exitX},${exitY}) ${exitDir}`,
                        turnType,
                        isLegal,
                        pathLength: car.path.length,
                        pathIssues
                    });
                }
            }
        }

        console.log(`\nTracked ${trackedCars.length} cars\n`);

        // Show illegal paths
        const illegal = trackedCars.filter(c => !c.isLegal);
        console.log(`Illegal turns: ${illegal.length}`);
        if (illegal.length > 0) {
            console.log('\n=== ILLEGAL TURNS ===');
            illegal.slice(0, 20).forEach(c => {
                console.log(`  ❌ ${c.id}: ${c.entry} → ${c.exit} = ${c.turnType}`);
            });
        }

        // Show path issues
        const withIssues = trackedCars.filter(c => c.pathIssues.length > 0);
        console.log(`\nCars with path issues: ${withIssues.length}`);
        if (withIssues.length > 0) {
            console.log('\n=== PATH ISSUES ===');
            withIssues.slice(0, 20).forEach(c => {
                console.log(`  ⚠️ ${c.id}: ${c.entry} → ${c.exit}`);
                c.pathIssues.forEach((issue: string) => console.log(`     ${issue}`));
            });
        }

        // Show a sample of legal paths
        console.log('\n=== SAMPLE LEGAL PATHS ===');
        trackedCars.filter(c => c.isLegal).slice(0, 10).forEach(c => {
            console.log(`  ✓ ${c.entry} → ${c.exit} = ${c.turnType}`);
        });

        expect(illegal.length).toBe(0);
    });
});
