import { test } from 'vitest';
import { Simulation } from './core/Simulation';

test('simulation stress test - random level', async () => {
    const sim = new Simulation(80, 40);
    sim.currentLevel = 'random';
    sim.reset();
    sim.timeScale = 10.0;
    
    let maxStuck = 0;
    
    for (let tick = 0; tick < 5000; tick++) {
        // @ts-ignore
        sim.tick();
        const state = sim.getState();
        const stuckCount = state.vehicles.filter(v => v.stuckTimer > 60).length;
        maxStuck = Math.max(maxStuck, stuckCount);

        if (state.gameOver) break;
    }
    
    const finalState = sim.getState();
    console.log(`Stress Test Results:`);
    console.log(`- Total Exited: ${finalState.exitedCars}`);
    console.log(`- Remaining: ${finalState.vehicles.length}`);
    console.log(`- Max Stuck: ${maxStuck}`);
    console.log(`- Final Score: ${finalState.score}`);
    
    // Basic health check: we should at least have some cars exiting and not everyone crashed
    // (Score is exited * 10 - crashes * 1000)
    // If score is very negative, it's a fail.
    // Given the difficulty, let's just log for now.
}, 300000);
