/**
 * Test to reproduce and verify:
 * 1. "Bouncy ball" problem - cars miscalculate speed, hit car in front, stop abruptly
 * 2. 20k ticks, 0 rebels, 2.5 cars/sec = should have 0 collisions
 * 3. Collisions should correlate with rebel count, not stuck count
 * 4. Following gap should be ~0.5 car length (0.35 units edge-to-edge)
 */

import { describe, test, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Car, carConfig } from './entities/Car';

describe('Bouncy Ball and Following Distance Tests', () => {

    test('Diagnose current following behavior in detail', () => {
        console.log('=== DETAILED FOLLOWING DIAGNOSIS ===');
        console.log(`Car length: ${carConfig.length}`);
        console.log(`Target edge-to-edge gap: ${carConfig.length * 0.5} (0.5 car-length)`);
        console.log(`Target center-to-center: ${carConfig.length + carConfig.length * 0.5}`);

        const sim = new Simulation(80, 40);
        sim.reset();
        sim.spawnEnabled = false;

        // Two cars - follower approaches stopped lead
        const lead = new Car('lead', { x: 30, y: 10 });
        lead.path = [{ x: 40, y: 10 }];
        lead.heading = { x: 1, y: 0 };
        lead.velocity = 0;

        const follower = new Car('follower', { x: 15, y: 10 });  // Start further back
        follower.path = [{ x: 40, y: 10 }];
        follower.heading = { x: 1, y: 0 };

        // Keep lead stopped
        const origUpdate = lead.update.bind(lead);
        lead.update = function(...args: any[]) {
            origUpdate(...(args as [any, any, any, any]));
            this.velocity = 0;
            this.currentTargetIndex = 0;
        };

        (sim.getState() as any).vehicles = [lead, follower];
        for (let x = 0; x < 80; x++) sim.getState().grid[10][x].type = 'road';

        let lastV = 0;
        let peakV = 0;
        let bouncyEvents: string[] = [];

        for (let i = 0; i < 300; i++) {
            sim.tick();

            const v = follower.velocity;
            peakV = Math.max(peakV, v);

            const gapCtoC = lead.position.x - follower.position.x;
            const edgeDist = follower.getFrontToBackDistance(lead);

            // Detect bouncy ball: velocity changes suddenly
            const vDelta = Math.abs(v - lastV);
            if (vDelta > 0.03 && lastV > 0.02) {
                const msg = `Tick ${i}: vDelta=${vDelta.toFixed(4)} (${lastV.toFixed(3)} -> ${v.toFixed(3)}), gap=${gapCtoC.toFixed(2)}, edge=${edgeDist.toFixed(3)}`;
                bouncyEvents.push(msg);
            }

            // Log every 15 ticks and when stopping
            if (i % 15 === 0 || (v === 0 && lastV > 0)) {
                console.log(`Tick ${i}: gapC2C=${gapCtoC.toFixed(3)}, edge=${edgeDist.toFixed(3)}, v=${v.toFixed(3)}, state=${follower.debugState}, limit=${follower.limitReason}`);
            }

            lastV = v;

            if (v === 0 && i > 80) break;
        }

        const finalGapC2C = lead.position.x - follower.position.x;
        const finalEdge = follower.getFrontToBackDistance(lead);

        console.log('\n=== BOUNCY EVENTS ===');
        for (const e of bouncyEvents) console.log(e);

        console.log(`\n=== FINAL RESULT ===`);
        console.log(`Peak velocity: ${peakV.toFixed(3)}`);
        console.log(`Final gap C-to-C: ${finalGapC2C.toFixed(3)} (target: ~${(carConfig.length * 1.5).toFixed(3)})`);
        console.log(`Final edge-to-edge: ${finalEdge.toFixed(3)} (target: ~${(carConfig.length * 0.5).toFixed(3)})`);

        // Test: edge-to-edge gap should be ~0.35 (half car length)
        expect(finalEdge).toBeGreaterThan(0.25);
        expect(finalEdge).toBeLessThan(0.55);  // Allow some margin
    });

    test('20k ticks, 0 rebels, 2.5 cars/sec = 0 collisions', () => {
        console.log('\n=== NO REBEL COLLISION TEST ===');

        const sim = new Simulation(80, 40);
        sim.currentLevel = 'tutorial';
        sim.reset(false);
        sim.spawnRate = 2.5;

        let totalCollisions = 0;
        let maxStuckTimer = 0;
        let collisionDetails: string[] = [];

        for (let tick = 0; tick < 20000; tick++) {
            sim.tick();

            const state = sim.getState();
            for (const v of state.vehicles) {
                const car = v as Car;
                if (car.isCollided && !collisionDetails.some(d => d.includes(car.id.substring(0, 12)))) {
                    totalCollisions++;
                    const detail = `Tick ${tick}: ${car.id.substring(0, 12)} at (${car.position.x.toFixed(1)}, ${car.position.y.toFixed(1)}) state=${car.debugState}`;
                    collisionDetails.push(detail);
                    if (collisionDetails.length <= 10) console.log(detail);
                }
                if (car.stuckTimer > maxStuckTimer) {
                    maxStuckTimer = car.stuckTimer;
                }
            }

            if (tick % 5000 === 0) {
                console.log(`Tick ${tick}: ${state.vehicles.length} vehicles, ${totalCollisions} unique collisions, maxStuck=${maxStuckTimer}`);
            }
        }

        console.log(`Final: ${totalCollisions} unique collisions, maxStuckTimer=${maxStuckTimer}`);
        if (collisionDetails.length > 10) console.log(`(${collisionDetails.length - 10} more collisions omitted)`);

        // With no rebels and proper physics, should have 0 collisions
        expect(totalCollisions).toBe(0);
    }, 30000);  // 30 second timeout

    test('Multi-car chain following behavior', () => {
        console.log('\n=== CHAIN FOLLOWING TEST ===');

        const sim = new Simulation(80, 40);
        sim.reset();
        sim.spawnEnabled = false;

        // Create a chain of 5 cars
        const cars: Car[] = [];

        // Lead car at front, will stay stopped
        const lead = new Car('car0-lead', { x: 50, y: 10 });
        lead.path = [{ x: 60, y: 10 }];
        lead.heading = { x: 1, y: 0 };
        const origUpdate = lead.update.bind(lead);
        lead.update = function(...args: any[]) {
            origUpdate(...(args as [any, any, any, any]));
            this.velocity = 0;
            this.currentTargetIndex = 0;
        };
        cars.push(lead);

        // Follower cars spaced out behind
        for (let i = 1; i < 5; i++) {
            const car = new Car(`car${i}`, { x: 50 - i * 4, y: 10 });
            car.path = [{ x: 60, y: 10 }];
            car.heading = { x: 1, y: 0 };
            cars.push(car);
        }

        (sim.getState() as any).vehicles = cars;
        for (let x = 0; x < 80; x++) sim.getState().grid[10][x].type = 'road';

        // Run until all stop
        for (let tick = 0; tick < 400; tick++) {
            sim.tick();

            if (tick % 50 === 0) {
                const positions = cars.map(c => c.position.x.toFixed(2)).join(', ');
                console.log(`Tick ${tick}: positions = [${positions}]`);
            }

            const allStopped = cars.slice(1).every(c => c.velocity < 0.001);
            if (allStopped && tick > 150) break;
        }

        // Measure final gaps
        console.log('\n=== FINAL GAPS ===');
        const targetEdge = carConfig.length * 0.5;  // 0.35
        let allGapsGood = true;

        for (let i = 0; i < cars.length - 1; i++) {
            const edge = cars[i + 1].getFrontToBackDistance(cars[i]);
            // Lead car (index 0) may have larger gap due to test setup
            // Other gaps should be within tolerance
            const tolerance = i === 0 ? 0.80 : 0.55;
            const gapOk = edge >= 0.25 && edge <= tolerance;
            console.log(`Gap ${i}-${i+1}: edge=${edge.toFixed(3)} (target: ${targetEdge.toFixed(3)}) ${gapOk ? '✓' : 'X'}`);
            if (!gapOk) allGapsGood = false;
        }

        expect(allGapsGood).toBe(true);
    });
});
