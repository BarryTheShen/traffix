import { test, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Car } from './entities/Car';

test('verify: 0.5 car sized gap (0.3 units)', () => {
    const sim = new Simulation(80, 40);
    sim.reset();
    sim.timeScale = 1.0;
    sim.spawnEnabled = false;

    const lead = new Car('lead', { x: 30, y: 10 });
    const follower = new Car('follower', { x: 25, y: 10 });
    lead.velocity = 0;
    follower.path = [{x: 40, y: 10}];
    (sim.getState() as any).vehicles = [lead, follower];
    
    // Mock road
    for(let x=0; x<80; x++) sim.getState().grid[10][x].type = 'road';

    console.log('--- START GAP VERIFICATION ---');
    console.log(`Initial: lead=${lead.position.x.toFixed(3)}, follower=${follower.position.x.toFixed(3)}`);

    for (let i = 0; i < 500; i++) {
        sim.tick();
        
        // CHECK FOR ACTUAL CRASH (Overlap > 0.15 visual car size)
        const d = Math.abs(follower.position.x - lead.position.x);
        if (d < 0.6) {
             console.log(`COLLISION Tick ${i}: dist=${d.toFixed(3)} (Overlap detected)`);
             break;
        }

        if (i % 50 === 0) {
            console.log(`Tick ${i}: lead=${lead.position.x.toFixed(3)}, follower=${follower.position.x.toFixed(3)}, v=${follower.velocity.toFixed(3)}, state=${follower.debugState}`);
        }
        if (follower.velocity === 0 && i > 100) break;
    }
    
    const centerDist = Math.abs(follower.position.x - lead.position.x);
    console.log(`Final Positions: lead=${lead.position.x.toFixed(3)}, follower=${follower.position.x.toFixed(3)}`);
    console.log(` - Center-to-Center: ${centerDist.toFixed(3)} units`);
    
    // COLLISION CHECK
    expect(centerDist).toBeGreaterThanOrEqual(0.6); 
    
    // Target centerDist is ~0.9. Allow range [0.85, 1.1]
    expect(centerDist).toBeGreaterThan(0.8);
    expect(centerDist).toBeLessThan(1.2);
    console.log('--- GAP VERIFICATION COMPLETE ---');
});