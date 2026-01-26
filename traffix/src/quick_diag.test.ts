/**
 * Quick diagnostic test - runs at high speed to identify collision patterns
 */
import { describe, it, expect } from 'vitest';
import { Simulation } from './core/Simulation';

describe('Quick Collision Diagnostics', () => {
    it('check map layout and traffic lights', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();

        const state = sim.getState();

        // Check specific grid cells
        console.log('y=7 at x=38:', JSON.stringify(state.grid[7][38]));
        console.log('y=8 at x=38:', JSON.stringify(state.grid[8][38]));
        console.log('y=7 at x=18:', JSON.stringify(state.grid[7][18]));
        console.log('y=8 at x=18:', JSON.stringify(state.grid[8][18]));
        console.log('y=7 at x=58:', JSON.stringify(state.grid[7][58]));
        console.log('y=8 at x=58:', JSON.stringify(state.grid[8][58]));

        const lights = state.trafficLights;

        console.log(`\n=== TRAFFIC LIGHTS: ${lights.length} ===`);
        for (const light of lights.slice(0, 10)) {
            console.log(`Light ${light.id} at (${light.position.x}, ${light.position.y}): state=${light.state}`);
        }

        expect(lights.length).toBeGreaterThan(0);
    });

    it('verify all paths follow lane rules', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();

        sim.spawnRate = 2.5;
        sim.rebelChance = 0.0;
        sim.unstuckTimerEnabled = false;
        sim.timeScale = 20.0;

        const state = sim.getState();
        let positionViolations = 0;

        for (let tick = 0; tick < 5000; tick++) {
            sim.tick();

            const currentState = sim.getState();

            // Check each car's CURRENT position against lane rules
            for (const v of currentState.vehicles) {
                if (v.isCollided) continue;

                const cx = Math.floor(v.position.x);
                const cy = Math.floor(v.position.y);
                const cell = state.grid[cy]?.[cx];

                if (!cell || cell.type === 'empty' || cell.type === 'intersection') continue;

                // Get car's direction
                let carDir: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | null = null;
                if (v.heading.x > 0.5) carDir = 'EAST';
                if (v.heading.x < -0.5) carDir = 'WEST';
                if (v.heading.y > 0.5) carDir = 'SOUTH';
                if (v.heading.y < -0.5) carDir = 'NORTH';

                // Skip if car is near an intersection - heading can point toward intersection
                // even when still technically on road cell
                if (carDir && v.currentTargetIndex < v.path.length) {
                    const target = v.path[v.currentTargetIndex];
                    const targetCell = state.grid[target.y]?.[target.x];
                    if (targetCell?.type === 'intersection') continue;
                }

                if (carDir && !cell.allowedDirections.includes(carDir)) {
                    positionViolations++;
                    if (positionViolations <= 5) {
                        console.log(`POSITION VIOLATION at tick ${tick}: ${v.id} at (${v.position.x.toFixed(2)}, ${v.position.y.toFixed(2)}) heading ${carDir} on cell allowing ${cell.allowedDirections.join(',')}`);
                        console.log(`  Path idx: ${v.currentTargetIndex}/${v.path.length}`);
                        if (v.currentTargetIndex < v.path.length) {
                            console.log(`  Target: (${v.path[v.currentTargetIndex].x}, ${v.path[v.currentTargetIndex].y})`);
                        }
                    }
                }
            }

            if (positionViolations > 10) break;
        }

        console.log(`\nTotal position violations: ${positionViolations}`);
        expect(positionViolations).toBe(0);
    }, 60000);

    it('trace collision and traffic light states', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();

        sim.spawnRate = 2.0;
        sim.rebelChance = 0.0;
        sim.unstuckTimerEnabled = false;
        sim.timeScale = 20.0;

        let collisionFound = false;

        for (let tick = 0; tick < 10000 && !collisionFound; tick++) {
            sim.tick();

            const state = sim.getState();

            // Look for cars approaching the intersection at (20, 10) area on y=8
            const nearIntersection = state.vehicles.filter(v =>
                v.position.x >= 16 && v.position.x <= 24 &&
                v.position.y >= 6 && v.position.y <= 14
            );

            const eastbound = nearIntersection.filter(v => v.heading.x > 0.5);
            const westbound = nearIntersection.filter(v => v.heading.x < -0.5);

            // If both eastbound and westbound cars near intersection
            if (eastbound.length > 0 && westbound.length > 0) {
                const lights = state.trafficLights.filter(l =>
                    l.position.x >= 16 && l.position.x <= 24 &&
                    l.position.y >= 6 && l.position.y <= 14
                );

                // Check if lights should block one direction
                console.log(`\nTick ${tick}: Opposing traffic near intersection (20,10)`);
                console.log(`  ${eastbound.length} eastbound, ${westbound.length} westbound`);
                console.log(`  ${lights.length} traffic lights nearby:`);
                for (const l of lights) {
                    console.log(`    ${l.id} at (${l.position.x}, ${l.position.y}): ${l.state}`);
                }
            }

            // Stop if collision
            for (const v of state.vehicles) {
                if (v.isCollided) {
                    console.log(`\n!!! COLLISION at tick ${tick}`);
                    console.log(`  Collided car ${v.id} at (${v.position.x.toFixed(2)}, ${v.position.y.toFixed(2)})`);
                    console.log(`  Heading: (${v.heading.x.toFixed(2)}, ${v.heading.y.toFixed(2)}) idx=${v.currentTargetIndex}/${v.path.length}`);
                    console.log(`  FULL PATH: ${JSON.stringify(v.path)}`);
                    // Find where y changes significantly
                    let yChanges: string[] = [];
                    for (let i = 1; i < v.path.length; i++) {
                        if (v.path[i].y !== v.path[i-1].y) {
                            yChanges.push(`${i}: (${v.path[i-1].x},${v.path[i-1].y})->(${v.path[i].x},${v.path[i].y})`);
                        }
                    }
                    console.log(`  Y-CHANGES: ${yChanges.join(', ')}`);
                    collisionFound = true;
                }
            }

            // Log cars that are BOTH in intersection at (60,30) area heading opposite directions
            const inInt = state.vehicles.filter(v =>
                v.position.x >= 56 && v.position.x <= 64 &&
                v.position.y >= 26 && v.position.y <= 34 &&
                !v.isCollided
            );
            const eastCars = inInt.filter(v => v.heading.x > 0.5);
            const westCars = inInt.filter(v => v.heading.x < -0.5);
            if (eastCars.length > 0 && westCars.length > 0) {
                // Check if any are close to each other
                for (const e of eastCars) {
                    for (const w of westCars) {
                        const dist = Math.sqrt((e.position.x - w.position.x)**2 + (e.position.y - w.position.y)**2);
                        if (dist < 3) {
                            console.log(`Tick ${tick}: HEAD-ON DANGER dist=${dist.toFixed(2)}`);
                            console.log(`  E: ${e.id} at (${e.position.x.toFixed(2)}, ${e.position.y.toFixed(2)}) v=${e.velocity.toFixed(3)}`);
                            console.log(`  W: ${w.id} at (${w.position.x.toFixed(2)}, ${w.position.y.toFixed(2)}) v=${w.velocity.toFixed(3)}`);
                        }
                    }
                }
            }
        }

        expect(sim.getTotalCrashes()).toBe(0);
    }, 120000);
});
