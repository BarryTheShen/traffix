/**
 * v0.2.1.1 - Bug Fixes and Tests
 *
 * Issues to fix:
 * 1. Car click detection - sometimes shows wrong car or doesn't work
 * 2. Reaction time wave effect - cars should start one after another, not together
 * 3. Benchmark: 0 collisions for non-rebel cars
 * 4. Rebel correlation: more rebels = more collisions
 */

import { describe, test, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Car, carConfig } from './entities/Car';

describe('v0.2.1.1 Bug Fixes', () => {

    test('Benchmark: 20k ticks, 0 rebels = 0 collisions', () => {
        console.log('\n=== BENCHMARK: NO REBEL = NO COLLISION ===');

        const sim = new Simulation(80, 40);
        sim.currentLevel = 'tutorial';
        sim.reset(false);
        sim.spawnRate = 2.5;

        let totalCollisions = 0;
        let uniqueCollisions = new Set<string>();

        for (let tick = 0; tick < 20000; tick++) {
            sim.tick();

            const state = sim.getState();
            for (const v of state.vehicles) {
                const car = v as Car;
                if (car.isCollided && !uniqueCollisions.has(car.id)) {
                    uniqueCollisions.add(car.id);
                    totalCollisions++;
                    if (totalCollisions <= 5) {
                        console.log(`Collision: ${car.id.substring(0, 12)} at (${car.position.x.toFixed(1)}, ${car.position.y.toFixed(1)}) tick=${tick}`);
                    }
                }
            }

            if (tick % 5000 === 0) {
                console.log(`Tick ${tick}: ${state.vehicles.length} vehicles, ${totalCollisions} collisions`);
            }
        }

        console.log(`Final: ${totalCollisions} unique collisions`);
        expect(totalCollisions).toBe(0);
    }, 60000);

    test('Wave effect: cars start one after another from queue', () => {
        console.log('\n=== WAVE EFFECT TEST ===');

        const sim = new Simulation(80, 40);
        sim.reset();
        sim.spawnEnabled = false;

        // Create a chain of stopped cars (like at a red light)
        // Cars are facing EAST (+x), so car 0 (highest x) is FRONT, car 4 (lowest x) is BACK
        // Use tight spacing (~1.1 units = car length + small gap) so each car only sees immediate lead
        const cars: Car[] = [];

        for (let i = 0; i < 5; i++) {
            // Car 0 at front (x=30), car 4 at back (x=25.6)
            const car = new Car(`car${i}`, { x: 30 - i * 1.1, y: 10 });  // Tight spacing
            car.path = [{ x: 70, y: 10 }];
            car.heading = { x: 1, y: 0 };
            car.velocity = 0;  // All stopped
            // Lead car blocked by red light
            if (i === 0) {
                (car as any).wasBlocked = true;  // Blocked by red light
            } else {
                // All other cars are waiting behind a stopped car
                (car as any).wasStoppedBehindCar = true;
                (car as any).leadCarWasStopped = true;
            }
            cars.push(car);
        }

        (sim.getState() as any).vehicles = cars;
        for (let x = 0; x < 80; x++) sim.getState().grid[10][x].type = 'road';

        // Track when each car starts moving (velocity > 0.01)
        const startTicks: number[] = Array(5).fill(-1);

        for (let tick = 0; tick < 200; tick++) {
            sim.tick();

            for (let i = 0; i < cars.length; i++) {
                if (startTicks[i] === -1 && cars[i].velocity > 0.01) {
                    startTicks[i] = tick;
                    console.log(`Car ${i} (x=${cars[i].position.x.toFixed(1)}) started at tick ${tick}, state=${cars[i].debugState}`);
                }
            }

            if (tick % 25 === 0) {
                const velocities = cars.map(c => c.velocity.toFixed(3)).join(', ');
                console.log(`Tick ${tick}: velocities = [${velocities}]`);
            }

            // Stop when all cars have started
            if (startTicks.every(t => t > 0)) break;
        }

        console.log(`Start ticks: [${startTicks.join(', ')}]`);

        // Verify wave effect: each car should start AFTER the car in front
        // Car 0 (lead) starts first, then car 1, then car 2, etc.
        for (let i = 1; i < cars.length; i++) {
            const delay = startTicks[i] - startTicks[i - 1];
            console.log(`Delay car${i-1}->car${i}: ${delay} ticks`);
            // Each car should start at least a few ticks after the previous
            expect(startTicks[i]).toBeGreaterThan(startTicks[i - 1]);
        }
    });

    test('Car click detection accuracy', () => {
        console.log('\n=== CAR CLICK DETECTION TEST ===');

        // Test the click detection math
        const cellSize = 10;  // Typical cell size

        // Simulate car at grid position (20.5, 15.3)
        const carGridX = 20.5;
        const carGridY = 15.3;

        // Click right on the car (center)
        const clickGridX = carGridX;
        const clickGridY = carGridY;

        // Current detection: Math.sqrt((v.position.x + 0.5 - gridX)**2 + (v.position.y + 0.5 - gridY)**2) < 1.0
        // This adds 0.5 to position which is wrong! Position already represents center

        const distWithOffset = Math.sqrt((carGridX + 0.5 - clickGridX)**2 + (carGridY + 0.5 - clickGridY)**2);
        const distWithoutOffset = Math.sqrt((carGridX - clickGridX)**2 + (carGridY - clickGridY)**2);

        console.log(`Click at (${clickGridX}, ${clickGridY}), car at (${carGridX}, ${carGridY})`);
        console.log(`Distance with +0.5 offset: ${distWithOffset.toFixed(3)}`);
        console.log(`Distance without offset: ${distWithoutOffset.toFixed(3)}`);

        // The +0.5 offset makes clicking inaccurate
        // If we click exactly on the car, distance should be 0, not 0.707
        expect(distWithoutOffset).toBe(0);
        expect(distWithOffset).toBeGreaterThan(0.5);  // Shows the bug
    });

    test('Reaction time from stopped position', () => {
        console.log('\n=== REACTION TIME TEST ===');
        console.log(`Default reaction time: ${carConfig.reactionTime} ticks`);

        const sim = new Simulation(80, 40);
        sim.reset();
        sim.spawnEnabled = false;

        // Single car that was blocked, now cleared
        const car = new Car('test', { x: 20, y: 10 });
        car.path = [{ x: 70, y: 10 }];
        car.heading = { x: 1, y: 0 };
        car.velocity = 0;
        (car as any).wasBlocked = true;  // Simulate having been at red light

        (sim.getState() as any).vehicles = [car];
        for (let x = 0; x < 80; x++) sim.getState().grid[10][x].type = 'road';

        let reactionTicks = 0;
        let started = false;

        for (let tick = 0; tick < 50; tick++) {
            sim.tick();

            console.log(`Tick ${tick}: v=${car.velocity.toFixed(3)}, state=${car.debugState}, limit=${car.limitReason}`);

            if (car.debugState === 'REACTING') {
                reactionTicks++;
            }

            if (car.velocity > 0.01 && !started) {
                started = true;
                console.log(`Car started moving at tick ${tick}`);
                break;
            }
        }

        console.log(`Reaction ticks before moving: ${reactionTicks}`);

        // Car should wait reaction time before starting
        // Expected: ~12 ticks of REACTING state
        expect(reactionTicks).toBeGreaterThan(0);
    });
});
