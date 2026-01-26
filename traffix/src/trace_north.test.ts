import { describe, it, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Pathfinding } from './core/Pathfinding';

describe('Trace NORTH violations', () => {
    it('NORTH INNER (20,39) to WEST should be blocked', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const grid = sim.getState().grid;

        // INNER lane entry at bottom (traveling NORTH/up)
        const startX = 20, startY = 39;
        // WEST exit
        const endX = 0, endY = 28;

        const startCell = grid[startY][startX];
        const endCell = grid[endY][endX];

        console.log(`\nStart: (${startX}, ${startY})`);
        console.log(`  type: ${startCell.type}`);
        console.log(`  laneType: ${startCell.laneType}`);
        console.log(`  directions: ${startCell.allowedDirections}`);

        console.log(`\nEnd: (${endX}, ${endY})`);
        console.log(`  type: ${endCell.type}`);
        console.log(`  laneType: ${endCell.laneType}`);
        console.log(`  directions: ${endCell.allowedDirections}`);

        console.log(`\nNORTH -> WEST = LEFT turn`);
        console.log(`INNER lane (right side) should NOT turn LEFT`);

        const path = Pathfinding.findPath(grid, 
            { x: startX, y: startY },
            { x: endX, y: endY },
            false
        );

        if (path) {
            console.log(`\n❌ PATH FOUND (BUG!):`);
            console.log(`  Length: ${path.length}`);
            // Show path
            const intPart = path.filter(p => p.y >= 8 && p.y <= 13);
            console.log(`  Near intersection: ${intPart.slice(0, 15).map(p => `(${p.x},${p.y})`).join(' -> ')}`);
        } else {
            console.log(`\n✓ Path correctly blocked`);
        }

        expect(path).toBeNull();
    });

    it('NORTH OUTER (21,39) to EAST should be blocked', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const grid = sim.getState().grid;

        // OUTER lane entry at bottom (traveling NORTH/up)
        const startX = 21, startY = 39;
        // EAST exit
        const endX = 79, endY = 10;

        const startCell = grid[startY][startX];
        const endCell = grid[endY][endX];

        console.log(`\nStart: (${startX}, ${startY})`);
        console.log(`  type: ${startCell.type}`);
        console.log(`  laneType: ${startCell.laneType}`);
        console.log(`  directions: ${startCell.allowedDirections}`);

        console.log(`\nEnd: (${endX}, ${endY})`);
        console.log(`  type: ${endCell.type}`);
        console.log(`  laneType: ${endCell.laneType}`);
        console.log(`  directions: ${endCell.allowedDirections}`);

        console.log(`\nNORTH -> EAST = RIGHT turn`);
        console.log(`OUTER lane (left side) should NOT turn RIGHT`);

        const path = Pathfinding.findPath(grid, 
            { x: startX, y: startY },
            { x: endX, y: endY },
            false
        );

        if (path) {
            console.log(`\n❌ PATH FOUND (BUG!):`);
            console.log(`  Length: ${path.length}`);
        } else {
            console.log(`\n✓ Path correctly blocked`);
        }

        expect(path).toBeNull();
    });
});
