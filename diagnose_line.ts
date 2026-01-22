import { Car } from './traffix/src/entities/Car.ts';
import { MapGenerator } from './traffix/src/core/MapGenerator.ts';
import { TrafficLight } from './traffix/src/entities/TrafficLight.ts';

async function diagnoseLineFollowing() {
    console.log('--- STARTING LINE-FOLLOWING DIAGNOSTIC ---');
    const { grid } = MapGenerator.generateLevel('classic', 80, 40);
    
    // Create a line of 3 cars
    const car1 = new Car('lead', { x: 40, y: 10 });
    const car2 = new Car('follower', { x: 40, y: 8.5 });
    const car3 = new Car('follower-2', { x: 40, y: 7 });
    
    car1.velocity = 0.5;
    car2.velocity = 0.5;
    car3.velocity = 0.5;
    
    const cars = [car1, car2, car3];
    
    console.log('Initial positions:', cars.map(c => c.position.y.toFixed(2)));

    // Lead car hits a red light (instantly stops or brakes hard)
    console.log('\nSimulating lead car braking for red light...');
    const redLight = new TrafficLight('l1', 40, 11);
    redLight.state = 'RED';

    for (let t = 0; t < 60; t++) {
        cars.forEach(c => c.update([redLight], cars, grid));
        
        const crashed = cars.some(c => c.isCollided);
        if (crashed) {
            console.log(`!!! CRASH DETECTED at tick ${t}`);
            cars.forEach(c => {
                if (c.isCollided) console.log(`  ${c.id} is crashed at y=${c.position.y.toFixed(2)}`);
            });
            return;
        }
    }
    
    console.log('Final positions after 60 ticks:', cars.map(c => c.position.y.toFixed(2)));
    console.log('Velocities:', cars.map(c => c.velocity.toFixed(3)));
    console.log('End test.');
}

diagnoseLineFollowing();