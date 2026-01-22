
import { Car } from './traffix/src/entities/Car.ts';
import { MapGenerator } from './traffix/src/core/MapGenerator.ts';
import { TrafficLight } from './traffix/src/entities/TrafficLight.ts';

async function diagnoseSimulation() {
    console.log('--- STARTING DIAGNOSTIC SIMULATION ---');
    const { grid, intersections } = MapGenerator.generateLevel('classic', 80, 40);
    const lights: TrafficLight[] = []; // All red
    
    // 1. Test Crash Condition
    console.log('\nTesting Crash Reproduction:');
    const car1 = new Car('car1', { x: 40, y: 10 });
    const car2 = new Car('car2', { x: 40, y: 10.2 }); // Very close, should overlap
    car1.velocity = 0.5;
    car2.velocity = 0.5;
    
    const otherCars = [car1, car2];
    car1.update([], otherCars, grid);
    console.log(`Car1 isCollided: ${car1.isCollided}`);
    console.log(`Car2 isCollided: ${car2.isCollided}`);

    // 2. Test Game Over Condition
    console.log('\nTesting Game Over Reproduction:');
    const spawnPos = { x: 38, y: 0 };
    const stuckCar = new Car('stuck-at-spawn', spawnPos);
    stuckCar.velocity = 0;
    
    // Simulate 1300 ticks
    for(let i=0; i<1300; i++) {
        stuckCar.update([], [], grid);
    }
    console.log(`Stuck Car spawnStuckTimer: ${stuckCar.spawnStuckTimer}`);
    
    // 3. Test Braking perfection
    console.log('\nTesting Braking Distance:');
    const fastCar = new Car('fast', { x: 38, y: 5 });
    fastCar.velocity = 0.5;
    fastCar.deceleration = 0.05;
    const redLight = new TrafficLight('l1', 38, 10);
    redLight.state = 'RED';
    
    fastCar.update([redLight], [], grid);
    console.log(`Fast car velocity after seeing light at distance 5: ${fastCar.velocity.toFixed(3)}`);
    console.log(`Debug State: ${fastCar.debugState}`);
}

diagnoseSimulation();
