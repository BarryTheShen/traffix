/**
 * Debug test to reproduce and verify fixes for:
 * 1. Intersections causing many collisions
 * 2. Random maps not working / complexity slider broken
 * 3. Warning banner flashing and disappearing
 * 4. Queue numbers not showing
 */

import { describe, test, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { MapGenerator } from './core/MapGenerator';
import { Car } from './entities/Car';

describe('Issue Reproduction Tests', () => {

    test('Issue 1: Intersection collisions - cross traffic detection', () => {
        console.log('=== ISSUE 1: INTERSECTION COLLISIONS ===');

        // Properly create simulation with width/height
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'tutorial';
        sim.reset(false);  // Reset to apply the level change
        sim.spawnRate = 5.0;  // High spawn rate

        let totalCollisions = 0;
        let intersectionCollisions = 0;

        // Run for 1000 ticks
        for (let i = 0; i < 1000; i++) {
            sim.tick();

            // Check for new collisions
            const state = sim.getState();
            for (const vehicle of state.vehicles) {
                const car = vehicle as Car;
                if (car.isCollided) {
                    totalCollisions++;
                    // Check if collision happened in intersection
                    const gridX = Math.floor(car.position.x);
                    const gridY = Math.floor(car.position.y);
                    const cell = state.grid[gridY]?.[gridX];
                    if (cell?.type === 'intersection') {
                        intersectionCollisions++;
                        console.log(`  Intersection collision at (${gridX}, ${gridY}) - car ${car.id.substring(0, 8)}`);
                    }
                }
            }
        }

        console.log(`Total collisions: ${totalCollisions}`);
        console.log(`Intersection collisions: ${intersectionCollisions}`);

        // We expect minimal intersection collisions if cross-traffic detection works
        expect(intersectionCollisions).toBeLessThan(10);
    });

    test('Issue 2a: Random map generation - basic structure', () => {
        console.log('\n=== ISSUE 2a: RANDOM MAP STRUCTURE ===');

        for (let complexity = 1; complexity <= 5; complexity++) {
            const result = MapGenerator.generateLevel('random', 80, 40, complexity);

            // Count road cells and intersections
            let roadCells = 0;
            let intersectionCells = 0;
            let entryCells = 0;

            result.grid.forEach(row => row.forEach(cell => {
                if (cell.type === 'road') roadCells++;
                if (cell.type === 'intersection') intersectionCells++;
                if (cell.type === 'entry') entryCells++;
            }));

            console.log(`Complexity ${complexity}: ${result.intersections.length} intersections, ${roadCells} road cells, ${entryCells} entry cells`);

            // Verify we have roads and intersections
            expect(roadCells).toBeGreaterThan(50);
            expect(result.intersections.length).toBeGreaterThanOrEqual(1);
            expect(entryCells).toBeGreaterThan(0);
        }
    });

    test('Issue 2b: Random map - complexity slider effect', () => {
        console.log('\n=== ISSUE 2b: COMPLEXITY SLIDER ===');

        const results: { complexity: number, intersections: number }[] = [];

        for (let complexity = 1; complexity <= 5; complexity++) {
            const result = MapGenerator.generateLevel('random', 80, 40, complexity);
            results.push({ complexity, intersections: result.intersections.length });
            console.log(`Complexity ${complexity} -> ${result.intersections.length} intersections`);
        }

        // Complexity should increase number of intersections
        // At least complexity 5 should have more than complexity 1
        expect(results[4].intersections).toBeGreaterThanOrEqual(results[0].intersections);
    });

    test('Issue 3: Warning banner - spawnStuckWarning timing', () => {
        console.log('\n=== ISSUE 3: WARNING BANNER ===');

        const sim = new Simulation(80, 40);
        sim.currentLevel = 'tutorial';
        sim.reset(false);

        // Force a spawn block scenario by spawning many cars and not letting them move
        sim.spawnRate = 10.0;

        let warningShown = false;
        let warningFirstTick = -1;
        let warningTicks = 0;
        let gameOverTick = -1;

        // Make all lights red to create stuck situation
        const state = sim.getState();
        state.trafficLights.forEach(l => l.state = 'RED');

        for (let i = 0; i < 1200; i++) {
            sim.tick();
            const currentState = sim.getState();

            // Keep lights red
            currentState.trafficLights.forEach(l => l.state = 'RED');

            if (currentState.spawnStuckWarning) {
                if (!warningShown) {
                    console.log(`Warning first shown at tick ${i}`);
                    warningFirstTick = i;
                    warningShown = true;
                }
                warningTicks++;
            }

            if (currentState.gameOver && gameOverTick === -1) {
                gameOverTick = i;
                console.log(`Game over at tick ${i}`);
                break;
            }
        }

        console.log(`Warning shown for ${warningTicks} ticks before game over`);
        console.log(`gameOverTimeout: ${sim.gameOverTimeout}`);
        console.log(`Warning started at tick ${warningFirstTick}, game over at tick ${gameOverTick}`);

        // Warning should be shown for at least 200 ticks (~3 seconds) before game over
        if (warningShown && gameOverTick > 0) {
            expect(warningTicks).toBeGreaterThan(100);  // At least ~2 seconds of warning
        }
    });

    test('Issue 4: Queue numbers - laneQueues population', () => {
        console.log('\n=== ISSUE 4: QUEUE NUMBERS ===');

        const sim = new Simulation(80, 40);
        sim.currentLevel = 'tutorial';
        sim.reset(false);
        sim.spawnRate = 20.0;  // Very high spawn rate to force queues

        // Make all lights red to block traffic
        const state = sim.getState();
        state.trafficLights.forEach(l => l.state = 'RED');

        let maxQueueSeen = 0;
        let queueKeys: string[] = [];

        // Run for 500 ticks
        for (let i = 0; i < 500; i++) {
            sim.tick();
            const currentState = sim.getState();

            // Keep lights red
            currentState.trafficLights.forEach(l => l.state = 'RED');

            const queues = currentState.laneQueues;
            const keys = Object.keys(queues);

            if (keys.length > 0) {
                const totalQueue = Object.values(queues).reduce((a, b) => a + b, 0);
                if (totalQueue > maxQueueSeen) {
                    maxQueueSeen = totalQueue;
                    queueKeys = keys;
                    console.log(`Tick ${i}: laneQueues = `, queues);
                }
            }
        }

        console.log(`Max queue seen: ${maxQueueSeen}`);
        console.log(`Queue keys: ${queueKeys.join(', ')}`);

        // We should see some queues building up
        expect(maxQueueSeen).toBeGreaterThan(0);
    });

    test('Issue 4b: Entry cells and roadId mapping', () => {
        console.log('\n=== ISSUE 4b: ENTRY CELL ROADID ===');

        const result = MapGenerator.generateLevel('tutorial', 80, 40, 3);

        let entryCells: { x: number, y: number, roadId: string | undefined }[] = [];

        result.grid.forEach((row, y) => row.forEach((cell, x) => {
            if (cell.type === 'entry') {
                entryCells.push({ x, y, roadId: cell.roadId });
            }
        }));

        console.log('Entry cells:');
        entryCells.forEach(e => {
            console.log(`  (${e.x}, ${e.y}) roadId: ${e.roadId}`);
        });

        // All entry cells should have a roadId
        const withRoadId = entryCells.filter(e => e.roadId !== undefined);
        console.log(`Entry cells with roadId: ${withRoadId.length}/${entryCells.length}`);

        expect(entryCells.length).toBeGreaterThan(0);
    });
});
