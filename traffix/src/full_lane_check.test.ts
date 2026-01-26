import { describe, it, expect } from 'vitest';
import { Simulation } from './core/Simulation';
import { Pathfinding } from './core/Pathfinding';

describe('Full Lane Check - All Directions', () => {
    it('Check ALL entry->exit with correct exit lane enforcement', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.reset();
        const grid = sim.getState().grid;

        // Find all entries and exits grouped by direction
        const entries: {x: number, y: number, dir: string, lane: string}[] = [];
        const exitsByDir: Map<string, {x: number, y: number, dir: string, lane: string}[]> = new Map();

        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[0].length; x++) {
                const cell = grid[y][x];
                if (cell.type === 'entry' && cell.laneType) {
                    entries.push({x, y, dir: cell.allowedDirections[0], lane: cell.laneType});
                }
                if (cell.type === 'exit' && cell.laneType) {
                    const dir = cell.allowedDirections[0];
                    if (!exitsByDir.has(dir)) exitsByDir.set(dir, []);
                    exitsByDir.get(dir)!.push({x, y, dir, lane: cell.laneType});
                }
            }
        }

        console.log(`\nFound ${entries.length} entries\n`);

        // Turn type determination
        function getTurnType(fromDir: string, toDir: string): string {
            if (fromDir === toDir) return 'STRAIGHT';
            const turnMap: Record<string, Record<string, string>> = {
                'NORTH': { 'WEST': 'LEFT', 'EAST': 'RIGHT', 'SOUTH': 'UTURN' },
                'SOUTH': { 'EAST': 'LEFT', 'WEST': 'RIGHT', 'NORTH': 'UTURN' },
                'EAST':  { 'NORTH': 'LEFT', 'SOUTH': 'RIGHT', 'WEST': 'UTURN' },
                'WEST':  { 'SOUTH': 'LEFT', 'NORTH': 'RIGHT', 'EAST': 'UTURN' }
            };
            return turnMap[fromDir]?.[toDir] || 'UNKNOWN';
        }

        // Effective lane position (should match Pathfinding.ts)
        function getEffectiveLanePosition(travelDir: string, laneType: string): string {
            if (travelDir === 'SOUTH' || travelDir === 'NORTH') {
                return laneType === 'OUTER' ? 'LEFT' : 'RIGHT';
            } else {
                return laneType === 'OUTER' ? 'RIGHT' : 'LEFT';
            }
        }

        // Get the correct exit lane for a turn
        function getCorrectExitLane(turnType: string, entryEffectivePos: string): string {
            if (turnType === 'STRAIGHT') return entryEffectivePos; // Same side
            if (turnType === 'LEFT') return 'RIGHT';  // Left turn → exit to right side
            if (turnType === 'RIGHT') return 'LEFT';  // Right turn → exit to left side
            return 'UNKNOWN';
        }

        const violations: string[] = [];
        const incorrectBlocks: string[] = [];
        let checked = 0;

        for (const entry of entries) {
            const entryEffectivePos = getEffectiveLanePosition(entry.dir, entry.lane);

            // Check each exit direction
            for (const [exitDir, exits] of exitsByDir.entries()) {
                if (exitDir === entry.dir) continue; // Skip same direction (U-turn not allowed)
                
                const turnType = getTurnType(entry.dir, exitDir);
                if (turnType === 'UTURN') continue;

                // Is this turn type allowed from this lane?
                const turnAllowed = 
                    (entryEffectivePos === 'LEFT' && (turnType === 'LEFT' || turnType === 'STRAIGHT')) ||
                    (entryEffectivePos === 'RIGHT' && (turnType === 'RIGHT' || turnType === 'STRAIGHT'));

                if (!turnAllowed) continue; // Skip - this turn type not allowed from this lane

                // Find the correct exit for this turn
                const correctExitEffectivePos = getCorrectExitLane(turnType, entryEffectivePos);

                // Find an exit with the correct effective position
                const correctExit = exits.find(e => 
                    getEffectiveLanePosition(e.dir, e.lane) === correctExitEffectivePos
                );

                if (!correctExit) continue; // No matching exit found

                checked++;

                const path = Pathfinding.findPath(grid, 
                    {x: entry.x, y: entry.y},
                    {x: correctExit.x, y: correctExit.y},
                    false
                );

                if (!path) {
                    incorrectBlocks.push(
                        `${entry.dir} ${entry.lane} (${entry.x},${entry.y}) → ${correctExit.dir} ${correctExit.lane} (${correctExit.x},${correctExit.y}): ${turnType} turn`
                    );
                }
            }

            // Also check that wrong turns ARE blocked
            for (const [exitDir, exits] of exitsByDir.entries()) {
                if (exitDir === entry.dir) continue;
                
                const turnType = getTurnType(entry.dir, exitDir);
                if (turnType === 'UTURN') continue;

                // Is this turn type DISALLOWED from this lane?
                const turnAllowed = 
                    (entryEffectivePos === 'LEFT' && (turnType === 'LEFT' || turnType === 'STRAIGHT')) ||
                    (entryEffectivePos === 'RIGHT' && (turnType === 'RIGHT' || turnType === 'STRAIGHT'));

                if (turnAllowed) continue; // This turn is allowed, skip

                // This turn should be blocked - check all exits of this direction
                for (const exit of exits) {
                    const path = Pathfinding.findPath(grid, 
                        {x: entry.x, y: entry.y},
                        {x: exit.x, y: exit.y},
                        false
                    );

                    if (path) {
                        violations.push(
                            `${entry.dir} ${entry.lane} (${entry.x},${entry.y}) → ${exit.dir} ${exit.lane} (${exit.x},${exit.y}): ${turnType} turn SHOULD BE BLOCKED (${entryEffectivePos} side cannot turn ${turnType})`
                        );
                    }
                }
            }
        }

        console.log(`Checked ${checked} valid turn combinations\n`);

        console.log('=== VIOLATIONS (illegal turns that are allowed) ===');
        if (violations.length === 0) {
            console.log('None!');
        } else {
            violations.forEach(v => console.log(`  ❌ ${v}`));
        }

        console.log('\n=== INCORRECT BLOCKS (legal turns that are blocked) ===');
        if (incorrectBlocks.length === 0) {
            console.log('None!');
        } else {
            incorrectBlocks.forEach(v => console.log(`  ⚠️ ${v}`));
        }

        console.log(`\nTotal violations: ${violations.length}`);
        console.log(`Total incorrect blocks: ${incorrectBlocks.length}`);

        expect(violations.length).toBe(0);
        expect(incorrectBlocks.length).toBe(0);
    });
});
