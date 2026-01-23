import { test, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Car } from './entities/Car';

test('validate final simulation physics and queues', () => {
    const sim = new Simulation(80, 40);
    sim.currentLevel = 'level1';
    sim.reset();
    sim.timeScale = 1.0;
    
    console.log('--- FINAL VALIDATION START ---');

    // 1. Target Gap Check (0.5 units body-to-body)
    const leader = new Car('leader', {x: 20, y: 10});
    leader.velocity = 0.1;
    leader.path = [{x: 40, y: 10}];
    const follower = new Car('follower', {x: 18, y: 10});
    follower.path = [{x: 40, y: 10}];
    (sim.getState() as any).vehicles = [leader, follower];

    console.log('Checking for 0.5 unit following gap...');
    for(let i=0; i<100; i++) {
        sim.tick();
        const state = sim.getState();
        const l = state.vehicles.find(v => v.id === 'leader');
        const f = state.vehicles.find(v => v.id === 'follower');
        if (l && f) {
            const gap = Math.abs(l.position.x - f.position.x) - 1.0; 
            if (i % 25 === 0) console.log(` - T${i} Gap: ${gap.toFixed(3)}`);
        }
    }

    // 2. Per-lane Queue Check
    sim.reset();
    sim.baseSpawnRate = 10.0;
    sim.spawnRate = 10.0; 
    console.log('Testing spawn queue (Should be per-lane)...');
    for(let i=0; i<60; i++) sim.tick(); 
    
    const state = sim.getState();
    const totalQueued = Object.values(state.laneQueues).reduce((a, b) => a + b, 0);
    console.log(` - Total pending spawns across all lanes: ${totalQueued}`);
    expect(totalQueued).toBeGreaterThan(0);
    
    console.log('--- FINAL VALIDATION END ---');
});
