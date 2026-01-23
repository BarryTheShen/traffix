
import { MapGenerator } from './traffix/src/core/MapGenerator';

function testMapGen() {
    const width = 80;
    const height = 40;
    const { grid, intersections } = MapGenerator.generateLevel('random', width, height);
    
    console.log(`Number of intersections: ${intersections.length}`);
    
    let issues = 0;
    intersections.forEach(int => {
        // Check if all 4x4 cells of the intersection are actually marked as intersection
        for (let y = int.y - 2; y < int.y + 2; y++) {
            for (let x = int.x - 2; x < int.x + 2; x++) {
                if (grid[y][x].type !== 'intersection') {
                    console.log(`Issue at intersection (${int.x}, ${int.y}): Cell (${x}, ${y}) is ${grid[y][x].type}`);
                    issues++;
                }
            }
        }
    });
    
    if (issues === 0) {
        console.log("No missing corners found in this random map.");
    } else {
        console.log(`Found ${issues} problematic cells in intersections.`);
    }
}

testMapGen();
