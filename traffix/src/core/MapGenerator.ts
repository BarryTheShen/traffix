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
        const roadId = `road_${axis}_${pos}`;

        if (axis === 'y') {
            for (let y = s; y < e; y++) {
                for (let l = 0; l < lanes * 2; l++) {
                    const lx = pos - lanes + l;
                    if (lx >= 0 && lx < width) {
                        grid[y][lx].type = 'road';
                        grid[y][lx].roadId = roadId;
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
                        grid[ly][x].roadId = roadId;
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

    public static addIntersection(grid: GridCell[][], cx: number, cy: number, radius: number = 2, intersectionId?: string) {
        const intId = intersectionId || `int_${cx}_${cy}`;
        for (let y = cy - radius; y < cy + radius; y++) {
            for (let x = cx - radius; x < cx + radius; x++) {
                if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
                    if (grid[y][x].type === 'road' || grid[y][x].type === 'intersection') {
                        grid[y][x].type = 'intersection';
                        grid[y][x].allowedDirections = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
                        grid[y][x].intersectionId = intId;
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

    public static generateLevel(level: string, width: number, height: number, complexity: number = 3): { grid: GridCell[][], intersections: { x: number, y: number }[] } {
        const grid = this.createEmptyGrid(width, height);
        let intersections: { x: number, y: number }[] = [];

        // Use full map width/height with proper margins
        // Roads span edge-to-edge for maximum queuing space

        if (level === 'tutorial') {
            // Single intersection centered
            const cx = Math.floor(width / 2);
            const cy = Math.floor(height / 2);
            this.addRoad(grid, 'y', cx, 2);  // Full vertical road
            this.addRoad(grid, 'x', cy, 2);  // Full horizontal road
            intersections = [{ x: cx, y: cy }];
        } else if (level === 'classic') {
            // T-junction - vertical road with horizontal branch
            const cx = Math.floor(width / 2);
            const cy = Math.floor(height / 2);
            this.addRoad(grid, 'y', cx, 2);  // Full vertical road
            this.addRoad(grid, 'x', cy, 2, cx, width);  // Horizontal from center to right
            intersections = [{ x: cx, y: cy }];
        } else if (level === 'level1') {
            // 7 intersections in irregular pattern - spread across full map
            const x1 = Math.floor(width * 0.2);
            const x2 = Math.floor(width * 0.5);
            const x3 = Math.floor(width * 0.8);
            const y1 = Math.floor(height * 0.2);
            const y2 = Math.floor(height * 0.5);
            const y3 = Math.floor(height * 0.8);

            // Vertical roads (full length)
            this.addRoad(grid, 'y', x1, 2);
            this.addRoad(grid, 'y', x2, 2, 0, y2 + 3);  // Partial - creates T-junctions
            this.addRoad(grid, 'y', x3, 2);

            // Horizontal roads (full length)
            this.addRoad(grid, 'x', y1, 2);
            this.addRoad(grid, 'x', y2, 2, x1 - 2, x2 + 3);  // Partial segment
            this.addRoad(grid, 'x', y3, 2);

            intersections = [
                { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x3, y: y1 },
                { x: x1, y: y2 }, { x: x2, y: y2 },
                { x: x1, y: y3 }, { x: x3, y: y3 }
            ];
        } else if (level === 'level2') {
            // 9 intersections in 3x3 grid - spread across full map
            const x1 = Math.floor(width * 0.2);
            const x2 = Math.floor(width * 0.5);
            const x3 = Math.floor(width * 0.8);
            const y1 = Math.floor(height * 0.2);
            const y2 = Math.floor(height * 0.5);
            const y3 = Math.floor(height * 0.8);

            // Vertical roads (full length)
            this.addRoad(grid, 'y', x1, 2);
            this.addRoad(grid, 'y', x2, 2);
            this.addRoad(grid, 'y', x3, 2);

            // Horizontal roads (full length)
            this.addRoad(grid, 'x', y1, 2);
            this.addRoad(grid, 'x', y2, 2);
            this.addRoad(grid, 'x', y3, 2);

            intersections = [
                { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x3, y: y1 },
                { x: x1, y: y2 }, { x: x2, y: y2 }, { x: x3, y: y2 },
                { x: x1, y: y3 }, { x: x2, y: y3 }, { x: x3, y: y3 }
            ];
        } else if (level === 'random') {
             return this.generateRandomLevel(width, height, complexity);
        }

        intersections.forEach((i, idx) => this.addIntersection(grid, i.x, i.y, 2, `int${idx}`));
        this.finalizeMap(grid);

        return { grid, intersections };
    }

    /**
     * Generate a random level with a grid-based layout.
     * @param complexity 1-5, controls grid size (1=1x1, 2=2x1, 3=2x2, 4=3x2, 5=3x3)
     */
    private static generateRandomLevel(width: number, height: number, complexity: number = 3): { grid: GridCell[][], intersections: { x: number, y: number }[] } {
        const grid = this.createEmptyGrid(width, height);

        // Clamp complexity to 1-5
        complexity = Math.max(1, Math.min(5, complexity));

        // Define grid dimensions based on complexity
        // Complexity 1: 1 intersection, 2: 2 intersections, 3: 4 (2x2), 4: 6 (3x2), 5: 9 (3x3)
        const gridConfigs: { cols: number, rows: number }[] = [
            { cols: 1, rows: 1 },  // complexity 1
            { cols: 2, rows: 1 },  // complexity 2
            { cols: 2, rows: 2 },  // complexity 3
            { cols: 3, rows: 2 },  // complexity 4
            { cols: 3, rows: 3 },  // complexity 5
        ];
        const config = gridConfigs[complexity - 1];

        // Calculate evenly spaced positions
        const xPositions: number[] = [];
        const yPositions: number[] = [];

        for (let c = 0; c < config.cols; c++) {
            const x = Math.floor(width * (c + 1) / (config.cols + 1));
            xPositions.push(x);
        }
        for (let r = 0; r < config.rows; r++) {
            const y = Math.floor(height * (r + 1) / (config.rows + 1));
            yPositions.push(y);
        }

        // Draw vertical roads at each x position (full height)
        for (const x of xPositions) {
            this.addRoad(grid, 'y', x, 2);
        }

        // Draw horizontal roads at each y position (full width)
        for (const y of yPositions) {
            this.addRoad(grid, 'x', y, 2);
        }

        // Calculate intersection positions (where roads cross)
        const intersections: { x: number, y: number }[] = [];
        for (const x of xPositions) {
            for (const y of yPositions) {
                intersections.push({ x, y });
            }
        }

        // Add intersection markers
        intersections.forEach((i, idx) => this.addIntersection(grid, i.x, i.y, 2, `int${idx}`));

        this.finalizeMap(grid);
        return { grid, intersections };
    }

    /**
     * Draw a road between two nodes, optionally with a zig-zag pattern.
     */
    private static drawRoadBetween(
        grid: GridCell[][],
        n1: { x: number, y: number },
        n2: { x: number, y: number },
        width: number,
        height: number
    ) {
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;

        // Decide whether to use zig-zag (for non-axis-aligned connections)
        const useZigZag = Math.abs(dx) > 5 && Math.abs(dy) > 5 && Math.random() > 0.3;

        if (useZigZag) {
            // L-shaped connection with random bend point
            const bendRatio = 0.3 + Math.random() * 0.4;
            const horizontalFirst = Math.random() > 0.5;

            if (horizontalFirst) {
                // Horizontal then vertical
                const bendX = Math.round(n1.x + dx * bendRatio);
                this.addRoad(grid, 'x', n1.y, 2, Math.min(n1.x, bendX) - 2, Math.max(n1.x, bendX) + 2);
                this.addRoad(grid, 'y', bendX, 2, Math.min(n1.y, n2.y) - 2, Math.max(n1.y, n2.y) + 2);
                this.addRoad(grid, 'x', n2.y, 2, Math.min(bendX, n2.x) - 2, Math.max(bendX, n2.x) + 2);
            } else {
                // Vertical then horizontal
                const bendY = Math.round(n1.y + dy * bendRatio);
                this.addRoad(grid, 'y', n1.x, 2, Math.min(n1.y, bendY) - 2, Math.max(n1.y, bendY) + 2);
                this.addRoad(grid, 'x', bendY, 2, Math.min(n1.x, n2.x) - 2, Math.max(n1.x, n2.x) + 2);
                this.addRoad(grid, 'y', n2.x, 2, Math.min(bendY, n2.y) - 2, Math.max(bendY, n2.y) + 2);
            }
        } else {
            // Simple L-shaped or straight connection
            if (Math.abs(dx) > Math.abs(dy)) {
                // Mostly horizontal - go horizontal then vertical
                this.addRoad(grid, 'x', n1.y, 2, Math.min(n1.x, n2.x) - 2, Math.max(n1.x, n2.x) + 2);
                if (Math.abs(dy) > 2) {
                    this.addRoad(grid, 'y', n2.x, 2, Math.min(n1.y, n2.y) - 2, Math.max(n1.y, n2.y) + 2);
                }
            } else {
                // Mostly vertical - go vertical then horizontal
                this.addRoad(grid, 'y', n1.x, 2, Math.min(n1.y, n2.y) - 2, Math.max(n1.y, n2.y) + 2);
                if (Math.abs(dx) > 2) {
                    this.addRoad(grid, 'x', n2.y, 2, Math.min(n1.x, n2.x) - 2, Math.max(n1.x, n2.x) + 2);
                }
            }
        }
    }

    /**
     * Detect all junctions (3+ way intersections) in the grid.
     * A junction is where roads meet from 3 or more directions.
     */
    private static detectJunctions(grid: GridCell[][], nodeHints: { x: number, y: number }[]): { x: number, y: number }[] {
        const junctions: { x: number, y: number }[] = [];
        const height = grid.length;
        const width = grid[0].length;
        const checked = new Set<string>();

        // Check each node hint location and surrounding area
        for (const node of nodeHints) {
            // Scan area around node
            for (let dy = -3; dy <= 3; dy++) {
                for (let dx = -3; dx <= 3; dx++) {
                    const x = node.x + dx;
                    const y = node.y + dy;
                    const key = `${x},${y}`;

                    if (checked.has(key)) continue;
                    checked.add(key);

                    if (x < 0 || x >= width || y < 0 || y >= height) continue;
                    if (grid[y][x].type !== 'road') continue;

                    // Count incoming road directions
                    const directions = new Set<string>();

                    // Check NORTH (road coming from above going SOUTH)
                    if (y > 0 && grid[y-1][x].type === 'road' && grid[y-1][x].allowedDirections.includes('SOUTH')) {
                        directions.add('NORTH');
                    }
                    // Check SOUTH (road coming from below going NORTH)
                    if (y < height - 1 && grid[y+1][x].type === 'road' && grid[y+1][x].allowedDirections.includes('NORTH')) {
                        directions.add('SOUTH');
                    }
                    // Check WEST (road coming from left going EAST)
                    if (x > 0 && grid[y][x-1].type === 'road' && grid[y][x-1].allowedDirections.includes('EAST')) {
                        directions.add('WEST');
                    }
                    // Check EAST (road coming from right going WEST)
                    if (x < width - 1 && grid[y][x+1].type === 'road' && grid[y][x+1].allowedDirections.includes('WEST')) {
                        directions.add('EAST');
                    }

                    // 3+ directions = junction that needs traffic light
                    if (directions.size >= 3) {
                        // Check if we already have a junction nearby
                        const tooClose = junctions.some(j =>
                            Math.abs(j.x - x) < 4 && Math.abs(j.y - y) < 4
                        );
                        if (!tooClose) {
                            junctions.push({ x, y });
                        }
                    }
                }
            }
        }

        // Also scan entire grid for missed junctions
        for (let y = 2; y < height - 2; y++) {
            for (let x = 2; x < width - 2; x++) {
                if (grid[y][x].type !== 'road') continue;

                const key = `${x},${y}`;
                if (checked.has(key)) continue;

                // Count road connections
                let connections = 0;
                if (grid[y-1]?.[x]?.type === 'road') connections++;
                if (grid[y+1]?.[x]?.type === 'road') connections++;
                if (grid[y]?.[x-1]?.type === 'road') connections++;
                if (grid[y]?.[x+1]?.type === 'road') connections++;

                if (connections >= 3) {
                    const tooClose = junctions.some(j =>
                        Math.abs(j.x - x) < 4 && Math.abs(j.y - y) < 4
                    );
                    if (!tooClose) {
                        junctions.push({ x, y });
                    }
                }
            }
        }

        return junctions;
    }
}
