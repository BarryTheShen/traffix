
import { MapGenerator } from './traffix/src/core/MapGenerator.ts';

function testClassicMap() {
    console.log('--- Testing Classic Map ---');
    const { grid, intersections } = MapGenerator.generateLevel('classic', 80, 40);
    
    // Check North Edge (y=0) around x=40
    console.log('North Edge (y=0, x=37-43):');
    for (let x = 37; x <= 43; x++) {
        const cell = grid[0][x];
        console.log(`x=${x}: type=${cell.type}, dirs=[${cell.allowedDirections.join(',')}]`);
    }

    // Check South Edge (y=39) around x=40
    console.log('\nSouth Edge (y=39, x=37-43):');
    for (let x = 37; x <= 43; x++) {
        const cell = grid[39][x];
        console.log(`x=${x}: type=${cell.type}, dirs=[${cell.allowedDirections.join(',')}]`);
    }

    // Check if any internal cells are entry/exit
    let internalEntryCount = 0;
    for (let y = 1; y < 39; y++) {
        for (let x = 1; x < 79; x++) {
            if (grid[y][x].type === 'entry' || grid[y][x].type === 'exit') {
                internalEntryCount++;
                if (internalEntryCount < 5) console.log(`Internal artifact at (${x},${y}): ${grid[y][x].type}`);
            }
        }
    }
    console.log(`\nTotal internal Entry/Exit artifacts: ${internalEntryCount}`);

    // Check if empty cells became road
    let emptyTurnedToRoad = 0;
    for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 80; x++) {
            // In a classic map, most cells should be empty.
            // If they are 'road' but have no directions, they were likely corrupted.
            if (grid[y][x].type === 'road' && grid[y][x].allowedDirections.length === 0) {
                emptyTurnedToRoad++;
            }
        }
    }
    console.log(`Empty cells turned to road: ${emptyTurnedToRoad}`);
}

testClassicMap();
