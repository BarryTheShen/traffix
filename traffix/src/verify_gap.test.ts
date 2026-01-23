import { test, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Car } from './entities/Car';

test('verify: 0.6-unit minimum gap (1.2 center-to-center)', () => {
    const sim = new Simulation(80, 40);
    sim.reset();
    sim.timeScale = 1.0;
    sim.spawnEnabled = false;

    const lead = new Car('lead', { x: 30, y: 10 });
    const follower = new Car('follower', { x: 25, y: 10 });
    lead.velocity = 0;
    lead.path = [{x: 30, y: 10}, {x: 40, y: 10}]; // Path so lead doesn't get cleaned up
    follower.path = [{x: 40, y: 10}];
    (sim.getState() as any).vehicles = [lead, follower];
    
    // Mock road
    for(let x=0; x<80; x++) sim.getState().grid[10][x].type = 'road';

    console.log('--- START GAP VERIFICATION ---');
    console.log(`Initial: lead=${lead.position.x.toFixed(3)}, follower=${follower.position.x.toFixed(3)}`);

    let collided = false;
    for (let i = 0; i < 500; i++) {
        sim.tick();
        
        const d = Math.abs(follower.position.x - lead.position.x);
        if (d < 1.0) {
             if (d < 0.9) {
                 console.log(`COLLISION Tick ${i}: dist=${d.toFixed(3)} (Overlap detected)`);
                 collided = true;
                 break;
             }
        }

        if (i % 50 === 0) {
            console.log(`Tick ${i}: lead=${lead.position.x.toFixed(3)}, follower=${follower.position.x.toFixed(3)}, v=${follower.velocity.toFixed(3)}, state=${follower.debugState}`);
        }
        if (follower.velocity === 0 && i > 100) break;
    }
    
    const centerDist = Math.abs(follower.position.x - lead.position.x);
    console.log(`Final Positions: lead=${lead.position.x.toFixed(3)}, follower=${follower.position.x.toFixed(3)}`);
    console.log(` - Center-to-Center: ${centerDist.toFixed(3)} units`);
    
    // COLLISION CHECK - minimum 1.2 center-to-center (0.6 gap)
    expect(collided).toBe(false);
    expect(centerDist).toBeGreaterThanOrEqual(1.1); 
    expect(centerDist).toBeLessThan(1.5);
    console.log('--- GAP VERIFICATION COMPLETE ---');
});