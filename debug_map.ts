import { MapGenerator } from './traffix/src/core/MapGenerator.ts';

function debug() {
    const { grid, intersections } = MapGenerator.generateLevel('random', 80, 40);
    
    // Print Map ASCII
    console.log('--- Random Map ---');
    const typeChars: Record<string, string> = {
        'empty': ' ',
        'road': '.',
        'intersection': '+',
        'entry': 'E',
        'exit': 'X'
    };

    for (let y = 0; y < 40; y+=2) { // Skip lines for brevity
        let row = '';
        for (let x = 0; x < 80; x++) {
            const cell = grid[y][x];
            row += typeChars[cell.type] || '?';
        }
        console.log(row);
    }
    
    console.log('Intersections:', intersections);
}

debug();