import { test, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Car } from './entities/Car';
import { TrafficLight } from './entities/TrafficLight';

test('reproduce: car sliding and queue issues', async () => {
    const sim = new Simulation(80, 40);
    const state = sim.getState();
    
    // --- 1. REPRODUCE LIGHT SLIDING ---
    console.log('--- 1. LIGHT SLIDING TEST ---');
    state.vehicles = [];
    state.trafficLights.forEach(l => l.state = 'RED');
    
    // Setup a road at X=20 (Southbound lanes at X=18, 19; Northbound at X=20, 21)
    // We'll place cars in the Northbound lanes (X=20, 21) heading NORTH
    // Level 1 intersections are at { x: 20, y: 10 }, etc.
    // Let's find lights at Y=10 for Northbound traffic (dir 's' in the ID)
    const northboundLights = state.trafficLights.filter(l => l.id.includes('_s') && l.position.y === 12);
    console.log(`Found ${northboundLights.length} lights at Y=12 for NB traffic`);
    northboundLights.forEach(l => console.log(` - ${l.id} at (${l.position.x}, ${l.position.y})`));

    // Car 1 in Inner Lane (X=20)
    const car1 = new Car('inner_lane', {x: 20, y: 20});
    car1.path = [{x: 20, y: 15}, {x: 20, y: 5}];
    car1.velocity = 0.4;
    
    // Car 2 in Outer Lane (X=21)
    const car2 = new Car('outer_lane', {x: 21, y: 20});
    car2.path = [{x: 21, y: 15}, {x: 21, y: 5}];
    car2.velocity = 0.4;
    
    state.vehicles = [car1, car2];
    
    let car1Slipped = false;
    let car2Slipped = false;
    
    for (let i = 0; i < 200; i++) {
        state.trafficLights.forEach(l => l.state = 'RED');
        sim.tick();
        
        if (car1.position.y < 11) car1Slipped = true;
        if (car2.position.y < 11) car2Slipped = true;
        
        if (i % 20 === 0) {
            console.log(`Tick ${i}: Car1 Y=${car1.position.y.toFixed(2)}, Car2 Y=${car2.position.y.toFixed(2)}, State1=${car1.debugState}, State2=${car2.debugState}`);
        }
        if (car1.velocity === 0 && car2.velocity === 0 && i > 100) break;
    }
    
    console.log(`Results: Inner Slipped=${car1Slipped}, Outer Slipped=${car2Slipped}`);
    console.log(`Final Positions: Inner=${car1.position.y.toFixed(2)}, Outer=${car2.position.y.toFixed(2)}`);

    // --- 2. REPRODUCE QUEUE ISSUE ---
    console.log('--- 2. QUEUE TEST ---');
    sim.reset();
    sim.spawnEnabled = true;
    sim.spawnRate = 10.0; // High spawn rate to force queues
    
    // Block ALL spawn points by placing cars on them
    const entries: {x: number, y: number}[] = [];
    state.grid.forEach((row, y) => row.forEach((cell, x) => {
        if (cell.type === 'entry') entries.push({x, y});
    }));
    
    entries.forEach((e, idx) => {
        const blocker = new Car(`blocker_${idx}`, {x: e.x, y: e.y});
        blocker.velocity = 0;
        state.vehicles.push(blocker);
    });
    
    // Tick a few times to accumulate queues
    for (let i = 0; i < 10; i++) {
        sim.tick();
    }
    
    console.log('Lane Queues state:', state.laneQueues);
    const totalQueued = Object.values(state.laneQueues).reduce((a, b) => a + b, 0);
    console.log(`Total queued vehicles: ${totalQueued}`);
    
    // We expect queues to be > 0
    expect(totalQueued).toBeGreaterThan(0);
});
