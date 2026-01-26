import { describe, it, expect } from 'vitest';
import { Simulation } from './core/Simulation';

describe('Live simulation lane violations', () => {
    it('should track cars and detect any lane violations', () => {
        const sim = new Simulation(80, 40);
        sim.currentLevel = 'level1';
        sim.spawnEnabled = true;
        sim.spawnRate = 2.0; // Increase spawn rate
        sim.reset();
        
        const grid = sim.getState().grid;
        const carHistory: Map<string, any> = new Map();
        const violations: string[] = [];
        
        function getEffectiveSide(dir: string, lane: string): string {
            if (dir === 'SOUTH' || dir === 'NORTH') {
                return lane === 'OUTER' ? 'LEFT' : 'RIGHT';
            } else {
                return lane === 'OUTER' ? 'RIGHT' : 'LEFT';
            }
        }
        
        function getTurnType(from: string, to: string): string {
            if (from === to) return 'STRAIGHT';
            const turns: Record<string, Record<string, string>> = {
                'NORTH': { 'WEST': 'LEFT', 'EAST': 'RIGHT' },
                'SOUTH': { 'EAST': 'LEFT', 'WEST': 'RIGHT' },
                'EAST':  { 'NORTH': 'LEFT', 'SOUTH': 'RIGHT' },
                'WEST':  { 'SOUTH': 'LEFT', 'NORTH': 'RIGHT' }
            };
            return turns[from]?.[to] || 'UTURN';
        }
        
        let totalVehiclesSeen = 0;
        
        // Run 5000 ticks
        for (let tick = 0; tick < 5000; tick++) {
            sim.tick();
            const state = sim.getState();
            
            totalVehiclesSeen = Math.max(totalVehiclesSeen, state.vehicles.length);
            
            for (const car of state.vehicles) {
                if (!carHistory.has(car.id)) {
                    // Check path instead of position
                    if (car.path && car.path.length > 0) {
                        const startPos = car.path[0];
                        const x = Math.round(startPos.x);
                        const y = Math.round(startPos.y);
                        const cell = grid[y]?.[x];
                        
                        if (cell?.laneType) {
                            const dir = cell.allowedDirections[0];
                            carHistory.set(car.id, {
                                spawnDir: dir,
                                spawnLane: cell.laneType,
                                spawnEffectiveSide: getEffectiveSide(dir, cell.laneType),
                                checked: false,
                                cellType: cell.type
                            });
                        }
                    }
                }
                
                // Check for violations at exit
                const info = carHistory.get(car.id);
                if (info && !info.checked) {
                    const currX = Math.round(car.x);
                    const currY = Math.round(car.y);
                    const currCell = grid[currY]?.[currX];
                    
                    if (currCell?.type === 'exit') {
                        info.checked = true;
                        const exitDir = currCell.allowedDirections[0];
                        const turnType = getTurnType(info.spawnDir, exitDir);
                        
                        if (info.spawnEffectiveSide === 'RIGHT' && turnType === 'LEFT') {
                            violations.push(`${car.id}: ${info.spawnDir} [RIGHT] → ${exitDir} = LEFT turn from RIGHT lane!`);
                        }
                        if (info.spawnEffectiveSide === 'LEFT' && turnType === 'RIGHT') {
                            violations.push(`${car.id}: ${info.spawnDir} [LEFT] → ${exitDir} = RIGHT turn from LEFT lane!`);
                        }
                    }
                }
            }
        }
        
        console.log(`Max vehicles seen: ${totalVehiclesSeen}`);
        console.log(`Cars tracked: ${carHistory.size}`);
        console.log(`Violations: ${violations.length}`);
        
        // Log some tracked cars info
        let count = 0;
        for (const [id, info] of carHistory.entries()) {
            if (count++ < 5) {
                console.log(`  ${id}: ${info.spawnDir} ${info.spawnLane} [${info.spawnEffectiveSide}] (${info.cellType})`);
            }
        }
        
        if (violations.length > 0) {
            console.log('\nViolations found:');
            violations.slice(0, 10).forEach(v => console.log(`  ${v}`));
        }
        
        expect(violations.length).toBe(0);
    });
});
