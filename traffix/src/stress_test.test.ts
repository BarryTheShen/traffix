
import { Simulation } from './core/Simulation';
import { test, expect } from 'vitest';

test('Headless Stress Test', async () => {
    console.log('--- STARTING STRESS TEST ---');
    const sim = new Simulation(80, 40);
    sim.currentLevel = 'random';
    sim.reset();
    sim.timeScale = 1.0; // Tick manually

    let totalCrashes = 0;
    let maxVehicles = 0;

    for (let tick = 0; tick < 20000; tick++) {
        const state = sim.getState();
        
        state.vehicles.forEach(v => {
            if (v.isCollided && v.collisionTimer === 1) {
                totalCrashes++;
            }
        });

        if (state.vehicles.length > maxVehicles) maxVehicles = state.vehicles.length;
        
        // @ts-ignore
        sim.tick();

        if (state.gameOver) {
            console.log(`Game Over at tick ${tick}: ${state.gameOverReason}`);
            break;
        }

        if (tick % 2000 === 0) {
            const rebelCount = state.vehicles.filter(v => v.violatesRules).length;
            console.log(`Tick ${tick}: Vehicles: ${state.vehicles.length}, Exited: ${state.exitedCars}, Crashes: ${totalCrashes}, Rebels: ${rebelCount}`);
        }
    }

    const finalState = sim.getState();
    console.log('\n--- TEST RESULTS ---');
    console.log(`Total Ticks: ${finalState.tick}`);
    console.log(`Total Exited: ${finalState.exitedCars}`);
    console.log(`Total Crashes: ${totalCrashes}`);
    console.log(`Max Concurrent Vehicles: ${maxVehicles}`);
    console.log(`Final Score: ${finalState.score}`);
    
    expect(finalState.gameOver).toBe(false);
}, 300000);
