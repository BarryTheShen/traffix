import { describe, it, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Pathfinding } from './core/Pathfinding';

/**
 * Correct lane rule tests based on proper understanding:
 *
 * For driving on the RIGHT (US/continental rules):
 * - OUTER lane = edge of road (assigned by MapGenerator)
 * - INNER lane = center of road (assigned by MapGenerator)
 *
 * MapGenerator lane assignment:
 * - Vertical road at pos=20: x=18 SOUTH/OUTER, x=19 SOUTH/INNER, x=20 NORTH/INNER, x=21 NORTH/OUTER
 * - Horizontal road at pos=10: y=8 WEST/OUTER, y=9 WEST/INNER, y=10 EAST/INNER, y=11 EAST/OUTER
 *
 * Driver's perspective (facing travel direction, in right-hand traffic):
 * - SOUTH (facing down): OUTER (x=18) is LEFT, INNER (x=19) is RIGHT
 * - NORTH (facing up): OUTER (x=21) is LEFT, INNER (x=20) is RIGHT
 * - EAST (facing right): OUTER (y=11) is RIGHT, INNER (y=10) is LEFT
 * - WEST (facing left): OUTER (y=8) is RIGHT, INNER (y=9) is LEFT
 *
 * Turn rules:
 * - LEFT side of travel → can turn LEFT or go STRAIGHT
 * - RIGHT side of travel → can turn RIGHT or go STRAIGHT
 * - LEFT turn exits to RIGHT side of exit road
 * - RIGHT turn exits to LEFT side of exit road
 */
describe('Correct Lane Rule Tests', () => {

    it('SOUTH OUTER (left side) can turn LEFT (east)', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const state = sim.getState();

        // Entry (18, 0) = SOUTH OUTER = LEFT side
        // Should be able to turn LEFT to EAST
        // LEFT turn exits to RIGHT side of new road
        // EAST: OUTER (y=11) = RIGHT side
        const path = Pathfinding.findPath(
            state.grid,
            {x: 18, y: 0},
            {x: 79, y: 11},  // EAST exit - OUTER lane (RIGHT side for EAST)
            false,
            'OUTER'
        );

        console.log(`SOUTH OUTER → LEFT turn (EAST): ${path ? 'SUCCESS' : 'FAILED'}`);
        expect(path).not.toBeNull();
    });

    it('SOUTH INNER (right side) can turn RIGHT (west)', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const state = sim.getState();

        // Entry (19, 0) = SOUTH INNER = RIGHT side
        // Should be able to turn RIGHT to WEST
        // RIGHT turn exits to LEFT side of new road
        // WEST road: INNER (y=9) = LEFT side
        const path = Pathfinding.findPath(
            state.grid,
            {x: 19, y: 0},
            {x: 0, y: 9},  // WEST exit - INNER lane (LEFT side for WEST)
            false,
            'INNER'
        );

        console.log(`SOUTH INNER → RIGHT turn (WEST/INNER): ${path ? 'SUCCESS' : 'FAILED'}`);
        expect(path).not.toBeNull();
    });

    it('NORTH OUTER (left side) can turn LEFT (west)', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const state = sim.getState();

        // Entry (21, 39) = NORTH OUTER = LEFT side
        // Should be able to turn LEFT to WEST
        // LEFT turn exits to RIGHT side of new road
        // WEST road: OUTER (y=8) = RIGHT side
        const path = Pathfinding.findPath(
            state.grid,
            {x: 21, y: 39},
            {x: 0, y: 8},  // WEST exit - OUTER lane (RIGHT side for WEST)
            false,
            'OUTER'
        );

        console.log(`NORTH OUTER → LEFT turn (WEST/OUTER): ${path ? 'SUCCESS' : 'FAILED'}`);
        expect(path).not.toBeNull();
    });

    it('NORTH INNER (right side) can turn RIGHT (east)', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const state = sim.getState();

        // Entry (20, 39) = NORTH INNER = RIGHT side
        // Should be able to turn RIGHT to EAST
        // RIGHT turn exits to LEFT side of new road
        // EAST road: INNER (y=10) = LEFT side
        const path = Pathfinding.findPath(
            state.grid,
            {x: 20, y: 39},
            {x: 79, y: 10},  // EAST exit - INNER lane (LEFT side for EAST)
            false,
            'INNER'
        );

        console.log(`NORTH INNER → RIGHT turn (EAST/INNER): ${path ? 'SUCCESS' : 'FAILED'}`);
        expect(path).not.toBeNull();
    });

    it('EAST OUTER (right side) can turn RIGHT (south)', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const state = sim.getState();

        // Find EAST OUTER entry
        // EAST: OUTER (y=11) = RIGHT side, INNER (y=10) = LEFT side
        let entry: {x: number, y: number} | null = null;
        for (let y = 0; y < state.grid.length; y++) {
            const cell = state.grid[y][0];
            if (cell?.type === 'entry' && cell.allowedDirections.includes('EAST') && cell.laneType === 'OUTER') {
                entry = {x: 0, y};
                break;
            }
        }

        console.log(`EAST OUTER entry: ${entry ? `(${entry.x}, ${entry.y})` : 'NOT FOUND'}`);

        if (entry) {
            // EAST OUTER = RIGHT side → can turn RIGHT to SOUTH
            // RIGHT turn exits to LEFT side of new road
            // SOUTH road: OUTER (x=18) = LEFT side
            const path = Pathfinding.findPath(
                state.grid,
                entry,
                {x: 18, y: 39},  // SOUTH exit - OUTER lane (LEFT side for SOUTH)
                false,
                'OUTER'
            );

            console.log(`EAST OUTER → RIGHT turn (SOUTH/OUTER): ${path ? 'SUCCESS' : 'FAILED'}`);
            expect(path).not.toBeNull();
        }
    });

    it('WEST OUTER (right side) can turn RIGHT (north)', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const state = sim.getState();

        // Find WEST OUTER entry
        // For WEST travel: OUTER (y=8) is on the RIGHT side (lower y = right when facing west)
        let entry: {x: number, y: number} | null = null;
        for (let y = 0; y < state.grid.length; y++) {
            const cell = state.grid[y][79];
            if (cell?.type === 'entry' && cell.allowedDirections.includes('WEST') && cell.laneType === 'OUTER') {
                entry = {x: 79, y};
                break;
            }
        }

        console.log(`WEST OUTER entry: ${entry ? `(${entry.x}, ${entry.y})` : 'NOT FOUND'}`);

        if (entry) {
            // WEST OUTER = RIGHT side = can turn RIGHT to NORTH
            // RIGHT turn exits to LEFT side of new road
            // NORTH road: OUTER (x=21) = LEFT side
            const path = Pathfinding.findPath(
                state.grid,
                entry,
                {x: 21, y: 0},  // NORTH exit - OUTER lane (LEFT side for NORTH)
                false,
                'OUTER'
            );

            console.log(`WEST OUTER → RIGHT turn (NORTH/OUTER): ${path ? 'SUCCESS' : 'FAILED'}`);
            expect(path).not.toBeNull();
        }
    });

    it('WEST INNER (left side) can turn LEFT (south)', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const state = sim.getState();

        // Find WEST INNER entry
        // For WEST travel: INNER (y=9) is on the LEFT side (higher y = left when facing west)
        let entry: {x: number, y: number} | null = null;
        for (let y = 0; y < state.grid.length; y++) {
            const cell = state.grid[y][79];
            if (cell?.type === 'entry' && cell.allowedDirections.includes('WEST') && cell.laneType === 'INNER') {
                entry = {x: 79, y};
                break;
            }
        }

        console.log(`WEST INNER entry: ${entry ? `(${entry.x}, ${entry.y})` : 'NOT FOUND'}`);

        if (entry) {
            // WEST INNER = LEFT side = can turn LEFT to SOUTH
            // LEFT turn exits to RIGHT side of new road
            // SOUTH road: INNER (x=19) = RIGHT side
            const path = Pathfinding.findPath(
                state.grid,
                entry,
                {x: 19, y: 39},  // SOUTH exit - INNER lane (RIGHT side for SOUTH)
                false,
                'INNER'
            );

            console.log(`WEST INNER → LEFT turn (SOUTH/INNER): ${path ? 'SUCCESS' : 'FAILED'}`);
            expect(path).not.toBeNull();
        }
    });

    it('check all entry and exit laneTypes', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const state = sim.getState();

        console.log('\n=== ALL ENTRIES ===');
        for (let y = 0; y < state.grid.length; y++) {
            for (let x = 0; x < state.grid[y].length; x++) {
                const cell = state.grid[y][x];
                if (cell.type === 'entry') {
                    console.log(`  (${x}, ${y}): dir=${cell.allowedDirections[0]} lane=${cell.laneType}`);
                }
            }
        }

        console.log('\n=== ALL EXITS ===');
        for (let y = 0; y < state.grid.length; y++) {
            for (let x = 0; x < state.grid[y].length; x++) {
                const cell = state.grid[y][x];
                if (cell.type === 'exit') {
                    console.log(`  (${x}, ${y}): dir=${cell.allowedDirections[0]} lane=${cell.laneType}`);
                }
            }
        }

        expect(true).toBe(true);
    });
});
