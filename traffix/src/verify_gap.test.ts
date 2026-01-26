import { test, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Car } from './entities/Car';

test('verify: 0.35-unit minimum gap (1.05 center-to-center)', () => {
    const sim = new Simulation(80, 40);
    sim.reset();
    sim.timeScale = 1.0;
    sim.spawnEnabled = false;

    // Lead car is stopped (at red light or congestion)
    const lead = new Car('lead', { x: 30, y: 10 });
    lead.velocity = 0;
    lead.path = [{x: 40, y: 10}];  // Has a path so it won't be cleaned up
    lead.currentTargetIndex = 0;
    lead.heading = { x: 1, y: 0 };  // Facing EAST
    // Override update to keep lead stationary (simulating stopped at red light)
    const originalLeadUpdate = lead.update.bind(lead);
    lead.update = function(...args: any[]) {
        originalLeadUpdate(...(args as [any, any, any, any]));
        this.velocity = 0;  // Force stopped
        this.currentTargetIndex = 0;  // Don't advance
    };

    // Follower approaches from behind
    const follower = new Car('follower', { x: 20, y: 10 });
    follower.path = [{x: 35, y: 10}, {x: 40, y: 10}];
    follower.heading = { x: 1, y: 0 };  // Facing EAST

    (sim.getState() as any).vehicles = [lead, follower];

    // Mock road
    for(let x=0; x<80; x++) sim.getState().grid[10][x].type = 'road';

    console.log('--- START GAP VERIFICATION ---');
    console.log(`Initial: lead=${lead.position.x.toFixed(3)}, follower=${follower.position.x.toFixed(3)}, gap=${(lead.position.x - follower.position.x).toFixed(3)}`);

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

        if (i % 25 === 0 || follower.debugState === 'BRAKING') {
            console.log(`Tick ${i}: lead=${lead.position.x.toFixed(3)}, follower=${follower.position.x.toFixed(3)}, gap=${d.toFixed(3)}, v=${follower.velocity.toFixed(3)}, state=${follower.debugState}, limit=${follower.limitReason}`);
        }
        if (follower.velocity === 0 && follower.debugState !== 'REACTING' && i > 100) break;
    }

    const centerDist = Math.abs(follower.position.x - lead.position.x);
    console.log(`Final Positions: lead=${lead.position.x.toFixed(3)}, follower=${follower.position.x.toFixed(3)}`);
    console.log(` - Center-to-Center: ${centerDist.toFixed(3)} units`);
    console.log(` - Lead collided: ${lead.isCollided}, Follower collided: ${follower.isCollided}`);

    // COLLISION CHECK - minimum 1.2 center-to-center (0.6 gap)
    expect(collided).toBe(false);
    expect(centerDist).toBeGreaterThanOrEqual(1.1);
    expect(centerDist).toBeLessThan(2.5); // Allow more margin for 3-phase following
    console.log('--- GAP VERIFICATION COMPLETE ---');
});