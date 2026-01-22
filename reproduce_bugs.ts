
import { Car } from './traffix/src/entities/Car.ts';
import { MapGenerator } from './traffix/src/core/MapGenerator.ts';

function testCarStuckLogic() {
    console.log('--- Testing Car Stuck Logic ---');
    const { grid } = MapGenerator.generateLevel('classic', 80, 40);
    
    // Simulate a car at spawn
    const spawnPos = { x: 38, y: 0 }; // An entry point
    const car = new Car('test-car', spawnPos);
    
    console.log('Car at spawn, velocity 0:');
    car.velocity = 0;
    car.update([], [], grid);
    console.log(`spawnStuckTimer: ${car.spawnStuckTimer} (Expected: 1)`);

    console.log('\nCar moving away from spawn (x=38, y=1), velocity 0:');
    car.position = { x: 38, y: 1 };
    car.update([], [], grid);
    console.log(`spawnStuckTimer: ${car.spawnStuckTimer} (Expected: 0 because not at startPos)`);

    console.log('\nCar at spawn, velocity 0.1:');
    car.position = { x: 38, y: 0 };
    car.velocity = 0.1;
    car.update([], [], grid);
    console.log(`spawnStuckTimer: ${car.spawnStuckTimer} (Expected: 0 because moving)`);
    
    // Test distToStartSq bug (if any)
    console.log('\nCar slightly away from spawn (x=38.05, y=0.05), velocity 0:');
    car.position = { x: 38.05, y: 0.05 };
    car.velocity = 0;
    car.update([], [], grid);
    console.log(`spawnStuckTimer: ${car.spawnStuckTimer} (Expected: 1 because within 0.1 tolerance)`);
}

testCarStuckLogic();
