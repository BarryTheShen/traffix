import { describe, it, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Car } from './entities/Car';

describe('Run Simulation', () => {
    it('run 1000 ticks and check all spawned cars for violations', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.spawnEnabled = true;
        sim.spawnRate = 5.0; // High spawn rate
        sim.reset();

        const violations: string[] = [];
        const grid = sim.getState().grid;

        // Track all cars we've seen
        const checkedCars = new Set<string>();

        // Run 1000 ticks
        for (let tick = 0; tick < 1000; tick++) {
            sim.tick();
            
            // Check all new vehicles
            sim.getState().vehicles.forEach(v => {
                const car = v as Car;
                if (checkedCars.has(car.id)) return;
                checkedCars.add(car.id);

                if (!car.path || car.path.length < 2) return;

                const start = car.path[0];
                const end = car.path[car.path.length - 1];
                const startCell = grid[start.y]?.[start.x];
                const endCell = grid[end.y]?.[end.x];

                if (!startCell || !endCell) return;

                const entryDir = startCell.allowedDirections?.[0];
                const exitDir = endCell.allowedDirections?.[0];
                const entryLane = startCell.laneType;

                // Check for violations based on entry direction
                let violation = false;
                let turnType = '';

                if (entryDir === 'SOUTH') {
                    if (exitDir === 'EAST') turnType = 'LEFT';
                    else if (exitDir === 'WEST') turnType = 'RIGHT';
                    
                    if (entryLane === 'INNER' && turnType === 'LEFT') violation = true;
                    if (entryLane === 'OUTER' && turnType === 'RIGHT') violation = true;
                }
                else if (entryDir === 'NORTH') {
                    if (exitDir === 'WEST') turnType = 'LEFT';
                    else if (exitDir === 'EAST') turnType = 'RIGHT';
                    
                    if (entryLane === 'INNER' && turnType === 'LEFT') violation = true;
                    if (entryLane === 'OUTER' && turnType === 'RIGHT') violation = true;
                }
                else if (entryDir === 'EAST') {
                    if (exitDir === 'SOUTH') turnType = 'LEFT';
                    else if (exitDir === 'NORTH') turnType = 'RIGHT';
                    
                    if (entryLane === 'INNER' && turnType === 'LEFT') violation = true;
                    if (entryLane === 'OUTER' && turnType === 'RIGHT') violation = true;
                }
                else if (entryDir === 'WEST') {
                    if (exitDir === 'NORTH') turnType = 'LEFT';
                    else if (exitDir === 'SOUTH') turnType = 'RIGHT';
                    
                    if (entryLane === 'INNER' && turnType === 'LEFT') violation = true;
                    if (entryLane === 'OUTER' && turnType === 'RIGHT') violation = true;
                }

                if (violation) {
                    const msg = `${car.id}: ${entryLane} ${entryDir} (${start.x},${start.y}) → ${exitDir} (${end.x},${end.y}) = ${turnType} turn`;
                    violations.push(msg);
                }
            });
        }

        console.log(`\nTotal cars checked: ${checkedCars.size}`);
        console.log(`Violations: ${violations.length}`);

        if (violations.length > 0) {
            console.log('\n❌ SAMPLE VIOLATIONS:');
            violations.slice(0, 20).forEach(v => console.log(`  ${v}`));
        } else {
            console.log('\n✓ No violations found!');
        }

        expect(violations.length).toBe(0);
    });
});
