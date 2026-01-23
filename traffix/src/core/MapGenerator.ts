import type { GridCell, Direction } from './types';

export class MapGenerator {
    public static createEmptyGrid(width: number, height: number): GridCell[][] {
        const grid: GridCell[][] = [];
        for (let y = 0; y < height; y++) {
            grid[y] = [];
            for (let x = 0; x < width; x++) {
                grid[y][x] = { type: 'empty', allowedDirections: [] };
            }
        }
        return grid;
    }

    public static addRoad(grid: GridCell[][], axis: 'x' | 'y', pos: number, lanes: number = 2, start?: number, end?: number) {
        const height = grid.length;
        const width = grid[0].length;
        const s = start !== undefined ? Math.max(0, start) : 0;
        const e = end !== undefined ? Math.min(axis === 'y' ? height : width, end) : (axis === 'y' ? height : width);

        if (axis === 'y') {
            for (let y = s; y < e; y++) {
                for (let l = 0; l < lanes * 2; l++) {
                    const lx = pos - lanes + l;
                    if (lx >= 0 && lx < width) {
                        grid[y][lx].type = 'road';
                        const dir: Direction = (l < lanes) ? 'SOUTH' : 'NORTH';
                        if (!grid[y][lx].allowedDirections.includes(dir)) {
                            grid[y][lx].allowedDirections.push(dir);
                        }
                        grid[y][lx].laneType = (l === 0 || l === lanes * 2 - 1) ? 'OUTER' : 'INNER';
                    }
                }
            }
        } else {
            for (let x = s; x < e; x++) {
                for (let l = 0; l < lanes * 2; l++) {
                    const ly = pos - lanes + l;
                    if (ly >= 0 && ly < height) {
                        grid[ly][x].type = 'road';
                        const dir: Direction = (l < lanes) ? 'WEST' : 'EAST';
                        if (!grid[ly][x].allowedDirections.includes(dir)) {
                            grid[ly][x].allowedDirections.push(dir);
                        }
                        grid[ly][x].laneType = (l === 0 || l === lanes * 2 - 1) ? 'OUTER' : 'INNER';
                    }
                }
            }
        }
    }

    public static addIntersection(grid: GridCell[][], cx: number, cy: number, radius: number = 2) {
        for (let y = cy - radius; y < cy + radius; y++) {
            for (let x = cx - radius; x < cx + radius; x++) {
                if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
                    if (grid[y][x].type === 'road' || grid[y][x].type === 'intersection') {
                        grid[y][x].type = 'intersection';
                        grid[y][x].allowedDirections = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
                    }
                }
            }
        }
    }

    public static finalizeMap(grid: GridCell[][]) {
        const height = grid.length;
        const width = grid[0].length;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = grid[y][x];
                if (cell.type === 'empty') continue;

                if (cell.type !== 'intersection') {
                    cell.type = 'road';
                }

                const isEdge = x === 0 || x === width - 1 || y === 0 || y === height - 1;
                if (!isEdge) continue;

                let isEntry = false;
                let isExit = false;

                for (const dir of cell.allowedDirections) {
                    if (y === 0 && dir === 'SOUTH') isEntry = true;
                    if (y === height - 1 && dir === 'NORTH') isEntry = true;
                    if (x === 0 && dir === 'EAST') isEntry = true;
                    if (x === width - 1 && dir === 'WEST') isEntry = true;

                    if (y === 0 && dir === 'NORTH') isExit = true;
                    if (y === height - 1 && dir === 'SOUTH') isExit = true;
                    if (x === 0 && dir === 'WEST') isExit = true;
                    if (x === width - 1 && dir === 'EAST') isExit = true;
                }

                if (isEntry) cell.type = 'entry';
                else if (isExit) cell.type = 'exit';
            }
        }
    }

    public static generateLevel(level: string, width: number, height: number): { grid: GridCell[][], intersections: { x: number, y: number }[] } {
        const grid = this.createEmptyGrid(width, height);
        let intersections: { x: number, y: number }[] = [];

        if (level === 'tutorial') {
             this.addRoad(grid, 'y', 40, 2);
             this.addRoad(grid, 'x', 20, 2);
             intersections = [{ x: 40, y: 20 }];
        } else if (level === 'classic') {
             this.addRoad(grid, 'y', 40, 2);
             this.addRoad(grid, 'x', 20, 2, 40, width);
             intersections = [{ x: 40, y: 20 }];
        } else if (level === 'level1') {
            this.addRoad(grid, 'y', 20, 2);
            this.addRoad(grid, 'y', 40, 2, 0, 22);
            this.addRoad(grid, 'y', 60, 2);
            this.addRoad(grid, 'x', 10, 2);
            this.addRoad(grid, 'x', 20, 2, 10, 50);
            this.addRoad(grid, 'x', 30, 2);
            intersections = [
                { x: 20, y: 10 }, { x: 40, y: 10 }, { x: 60, y: 10 },
                { x: 20, y: 20 }, { x: 40, y: 20 },
                { x: 20, y: 30 }, { x: 60, y: 30 }
            ];
        } else if (level === 'level2') {
             this.addRoad(grid, 'y', 20, 2);
             this.addRoad(grid, 'y', 40, 2);
             this.addRoad(grid, 'y', 60, 2);
             this.addRoad(grid, 'x', 10, 2);
             this.addRoad(grid, 'x', 20, 2);
             this.addRoad(grid, 'x', 30, 2);
             intersections = [
                 { x: 20, y: 10 }, { x: 40, y: 10 }, { x: 60, y: 10 },
                 { x: 20, y: 20 }, { x: 40, y: 20 }, { x: 60, y: 20 },
                 { x: 20, y: 30 }, { x: 40, y: 30 }, { x: 60, y: 30 }
             ];
        } else if (level === 'random') {
             return this.generateRandomLevel(width, height);
        }

        intersections.forEach(i => this.addIntersection(grid, i.x, i.y, 2));
        this.finalizeMap(grid);

        return { grid, intersections };
    }

    private static generateRandomLevel(width: number, height: number): { grid: GridCell[][], intersections: { x: number, y: number }[] } {
        const grid = this.createEmptyGrid(width, height);
        
        // Larger gaps (min 15 units between roads)
        const xAnchors = [15, 40, 65];
        const yAnchors = [10, 20, 30];
        
        const potentialEdges: {n1: any, n2: any}[] = [];
        for (let i = 0; i < xAnchors.length; i++) {
            for (let j = 0; j < yAnchors.length; j++) {
                if (i < xAnchors.length - 1) potentialEdges.push({n1: {x: xAnchors[i], y: yAnchors[j]}, n2: {x: xAnchors[i+1], y: yAnchors[j]}});
                if (j < yAnchors.length - 1) potentialEdges.push({n1: {x: xAnchors[i], y: yAnchors[j]}, n2: {x: xAnchors[i], y: yAnchors[j+1]}});
            }
        }

        potentialEdges.sort(() => Math.random() - 0.5);
        const parent = new Map<string, string>();
        const find = (s: string): string => {
            if (!parent.has(s)) parent.set(s, s);
            if (parent.get(s) === s) return s;
            const root = find(parent.get(s)!);
            parent.set(s, root);
            return root;
        };
        const union = (s1: string, s2: string) => {
            const r1 = find(s1);
            const r2 = find(s2);
            if (r1 !== r2) parent.set(r1, r2);
        };

        const activeEdges: {n1: any, n2: any}[] = [];
        potentialEdges.forEach(e => {
            const s1 = `${e.n1.x},${e.n1.y}`;
            const s2 = `${e.n2.x},${e.n2.y}`;
            if (find(s1) !== find(s2) || Math.random() < 0.3) {
                union(s1, s2);
                activeEdges.push(e);
            }
        });

        const nodes = new Set<string>();
        activeEdges.forEach(e => { nodes.add(`${e.n1.x},${e.n1.y}`); nodes.add(`${e.n2.x},${e.n2.y}`); });

        // Identify which nodes are connected to entrances
        const entranceConnections = new Map<string, number>();
        nodes.forEach(s => {
            const [x, y] = s.split(',').map(Number);
            let count = 0;
            if (x === 15 || x === 65 || y === 10 || y === 30) {
                count = 1; // Each of these is an anchor on the boundary of the internal network
            }
            entranceConnections.set(s, count);
        });

        // Add internal roads with extra length for intersection overlap
        activeEdges.forEach(e => {
            if (e.n1.x === e.n2.x) {
                this.addRoad(grid, 'y', e.n1.x, 2, Math.min(e.n1.y, e.n2.y) - 5, Math.max(e.n1.y, e.n2.y) + 5);
            } else {
                this.addRoad(grid, 'x', e.n1.y, 2, Math.min(e.n1.x, e.n2.x) - 5, Math.max(e.n1.x, e.n2.x) + 5);
            }
        });

        // Add entrance segments that overlap with internal nodes
        nodes.forEach(s => {
            const [x, y] = s.split(',').map(Number);
            if (x === 15) this.addRoad(grid, 'x', y, 2, 0, 15 + 5);
            if (x === 65) this.addRoad(grid, 'x', y, 2, 65 - 5, width);
            if (y === 10) this.addRoad(grid, 'y', x, 2, 0, 10 + 5);
            if (y === 30) this.addRoad(grid, 'y', x, 2, 30 - 5, height);
        });

        const intersections: {x: number, y: number}[] = [];
        nodes.forEach(s => {
            const [nx, ny] = s.split(',').map(Number);
            const connEdges = activeEdges.filter(e => 
                (e.n1.x === nx && e.n1.y === ny) || (e.n2.x === nx && e.n2.y === ny)
            );
            const internalConnections = connEdges.length;
            const totalConnections = internalConnections + (entranceConnections.get(s) || 0);
            
            let isJunction = totalConnections >= 3;
            if (totalConnections === 2) {
                const hasEntranceX = (nx === 15 || nx === 65);
                const hasEntranceY = (ny === 10 || ny === 30);
                
                let isStraight = false;
                if (internalConnections === 2) {
                    const e1 = connEdges[0];
                    const e2 = connEdges[1];
                    const isStraightX = e1.n1.y === e1.n2.y && e2.n1.y === e2.n2.y;
                    const isStraightY = e1.n1.x === e1.n2.x && e2.n1.x === e2.n2.x;
                    isStraight = isStraightX || isStraightY;
                } else if (internalConnections === 1) {
                    const e1 = connEdges[0];
                    if (hasEntranceX && e1.n1.y === e1.n2.y) isStraight = true;
                    if (hasEntranceY && e1.n1.x === e1.n2.x) isStraight = true;
                }

                if (!isStraight) isJunction = true;
            }

            if (isJunction) {
                intersections.push({x: nx, y: ny});
                this.addIntersection(grid, nx, ny, 2);
            }
        });

        this.finalizeMap(grid);
        return { grid, intersections };
    }
}