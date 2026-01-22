import type { GridCell } from './types';

export class MapHelper {
    public static create4WayIntersection(width: number, height: number): GridCell[][] {
        const grid: GridCell[][] = [];
        for (let y = 0; y < height; y++) {
            grid[y] = [];
            for (let x = 0; x < width; x++) {
                grid[y][x] = { type: 'empty', allowedDirections: [] };
            }
        }

        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);

        // Vertical road (2 lanes each way)
        for (let y = 0; y < height; y++) {
            // Southbound lanes (left of center)
            grid[y][centerX - 1].type = 'road';
            grid[y][centerX - 2].type = 'road';
            // Northbound lanes (right of center)
            grid[y][centerX].type = 'road';
            grid[y][centerX + 1].type = 'road';
        }

        // Horizontal road (2 lanes each way)
        for (let x = 0; x < width; x++) {
            // Westbound lanes (above center)
            grid[centerY - 1][x].type = 'road';
            grid[centerY - 2][x].type = 'road';
            // Eastbound lanes (below center)
            grid[centerY][x].type = 'road';
            grid[centerY + 1][x].type = 'road';
        }

        // Intersection (where roads overlap)
        for (let y = centerY - 2; y <= centerY + 1; y++) {
            for (let x = centerX - 2; x <= centerX + 1; x++) {
                grid[y][x].type = 'intersection';
            }
        }

        // Entry points (edges)
        grid[0][centerX].type = 'entry';
        grid[0][centerX + 1].type = 'entry';
        grid[height - 1][centerX - 1].type = 'entry';
        grid[height - 1][centerX - 2].type = 'entry';
        grid[centerY][0].type = 'entry';
        grid[centerY + 1][0].type = 'entry';
        grid[centerY - 1][width - 1].type = 'entry';
        grid[centerY - 2][width - 1].type = 'entry';

        // Exit points (edges)
        grid[0][centerX - 1].type = 'exit';
        grid[0][centerX - 2].type = 'exit';
        grid[height - 1][centerX].type = 'exit';
        grid[height - 1][centerX + 1].type = 'exit';
        grid[centerY - 1][0].type = 'exit';
        grid[centerY - 2][0].type = 'exit';
        grid[centerY][width - 1].type = 'exit';
        grid[centerY + 1][width - 1].type = 'exit';

        return grid;
    }
}
