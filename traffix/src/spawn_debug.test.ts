import { describe, it, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Car } from './entities/Car';

describe('Spawn Debug', () => {
    it('track what spawnVehicle really does', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.spawnEnabled = false;
        sim.reset();

        const state = sim.getState();
        const grid = state.grid;

        // Track ALL spawns and destinations
        const results: {entry: string, dest: string, entryLane: string, exitDir: string, violation: boolean}[] = [];

        for (let i = 0; i < 200; i++) {
            // Clear vehicles before each spawn
            state.vehicles.length = 0;
            
            sim.spawnVehicle();
            
            if (state.vehicles.length > 0) {
                const car = state.vehicles[0] as Car;
                const startCell = grid[car.path[0].y]?.[car.path[0].x];
                const endCell = grid[car.destination.y]?.[car.destination.x];
                
                const entryDir = startCell?.allowedDirections?.[0];
                const exitDir = endCell?.allowedDirections?.[0];
                const entryLane = startCell?.laneType;

                // Check for SOUTH entries
                if (entryDir === 'SOUTH') {
                    let violation = false;
                    // INNER should not go EAST (left turn)
                    // OUTER should not go WEST (right turn)
                    if (entryLane === 'INNER' && exitDir === 'EAST') violation = true;
                    if (entryLane === 'OUTER' && exitDir === 'WEST') violation = true;

                    results.push({
                        entry: `(${car.path[0].x},${car.path[0].y})`,
                        dest: `(${car.destination.x},${car.destination.y})`,
                        entryLane,
                        exitDir,
                        violation
                    });
                }
            }
        }

        // Print summary
        const violations = results.filter(r => r.violation);
        console.log(`\nTotal SOUTH spawns: ${results.length}`);
        console.log(`Violations: ${violations.length}`);

        if (violations.length > 0) {
            console.log('\n❌ VIOLATIONS:');
            violations.forEach(v => {
                console.log(`  ${v.entry} ${v.entryLane} → ${v.dest} ${v.exitDir}`);
            });
        }

        // Also check what entries we're spawning from
        const entryCounts: Record<string, number> = {};
        results.forEach(r => {
            entryCounts[r.entry] = (entryCounts[r.entry] || 0) + 1;
        });
        console.log('\nEntry distribution:');
        Object.entries(entryCounts).forEach(([e, c]) => {
            const cell = grid[parseInt(e.match(/\d+,(\d+)/)?.[1] || '0')][parseInt(e.match(/(\d+),/)?.[1] || '0')];
            console.log(`  ${e} ${cell?.laneType}: ${c}x`);
        });

        expect(violations.length).toBe(0);
    });
});
