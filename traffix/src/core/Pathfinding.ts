import type { Direction, GridCell, Vector2D } from './types';

/**
 * A* Pathfinding with strict lane discipline for traffic simulation.
 *
 * Lane Rules (driving on the right):
 * - OUTER lane (left side of travel): Can turn LEFT or go STRAIGHT
 * - INNER lane (right side of travel): Can turn RIGHT or go STRAIGHT
 * - Cars CANNOT cross into the other lane type at intersections
 * - Lane changes only occur on regular roads (handled in Car.ts)
 */
export class Pathfinding {

    public static findPath(
        grid: GridCell[][],
        start: Vector2D,
        end: Vector2D,
        ignoreLaneRules: boolean = false,
        preferredLaneType?: 'INNER' | 'OUTER'
    ): Vector2D[] | null {
        const rows = grid.length;
        const cols = grid[0].length;
        const openSet: Node[] = [];
        const closedSet: Set<string> = new Set();

        const startCell = grid[start.y]?.[start.x];
        const startLaneType = startCell?.laneType;

        const startNode = new Node(start.x, start.y, 0, this.heuristic(start, end), undefined, startLaneType);
        openSet.push(startNode);

        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift()!;

            if (current.x === end.x && current.y === end.y) {
                return this.reconstructPath(current);
            }

            closedSet.add(`${current.x},${current.y}`);

            const neighbors = this.getNeighbors(current, grid, rows, cols, ignoreLaneRules);
            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y}`;
                if (closedSet.has(key)) continue;

                let moveCost = 1;
                const neighborCell = grid[neighbor.y][neighbor.x];
                if (preferredLaneType && neighborCell.laneType && neighborCell.laneType !== preferredLaneType) {
                    moveCost += 0.1;
                }

                const gScore = current.g + moveCost;
                let neighborNode = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);

                if (!neighborNode) {
                    neighborNode = new Node(
                        neighbor.x, neighbor.y, gScore,
                        this.heuristic(neighbor, end), current, neighbor.laneType
                    );
                    openSet.push(neighborNode);
                } else if (gScore < neighborNode.g) {
                    neighborNode.g = gScore;
                    neighborNode.f = neighborNode.g + neighborNode.h;
                    neighborNode.parent = current;
                }
            }
        }
        return null;
    }

    private static heuristic(a: Vector2D, b: Vector2D): number {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    private static getNeighbors(
        node: Node, grid: GridCell[][], rows: number, cols: number, ignoreLaneRules: boolean = false
    ): (Vector2D & { laneType?: 'INNER' | 'OUTER' })[] {
        const neighbors: (Vector2D & { laneType?: 'INNER' | 'OUTER' })[] = [];
        const dirs = [
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 }
        ];

        const currentCell = grid[node.y][node.x];

        for (const dir of dirs) {
            const nx = node.x + dir.dx;
            const ny = node.y + dir.dy;

            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

            const targetCell = grid[ny][nx];
            if (targetCell.type === 'empty') continue;

            const moveDir: Direction =
                dir.dx === 1 ? 'EAST' : dir.dx === -1 ? 'WEST' :
                dir.dy === 1 ? 'SOUTH' : 'NORTH';

            const canMove = this.canMoveToCell(node, currentCell, targetCell, moveDir, grid, ignoreLaneRules);

            if (canMove) {
                neighbors.push({ x: nx, y: ny, laneType: targetCell.laneType });
            }
        }
        return neighbors;
    }

    private static canMoveToCell(
        node: Node, currentCell: GridCell, targetCell: GridCell,
        moveDir: Direction, grid: GridCell[][], ignoreLaneRules: boolean
    ): boolean {
        const roadTypes = ['road', 'entry', 'exit'];

        if (targetCell.type === 'empty') return false;

        // Moving on regular roads
        if (roadTypes.includes(currentCell.type) && roadTypes.includes(targetCell.type)) {
            if (!currentCell.allowedDirections.includes(moveDir)) {
                return ignoreLaneRules;
            }
            // Pathfinding stays in same lane - lane changes are dynamic in Car.ts
            if (currentCell.laneType && targetCell.laneType && currentCell.laneType !== targetCell.laneType) {
                return false; // No lane changes during pathfinding
            }
            return true;
        }

        // Entering intersection
        if (roadTypes.includes(currentCell.type) && targetCell.type === 'intersection') {
            if (!currentCell.allowedDirections.includes(moveDir)) {
                return ignoreLaneRules;
            }
            return true;
        }

        // Within intersection
        if (currentCell.type === 'intersection' && targetCell.type === 'intersection') {
            return true;
        }

        // Exiting intersection - STRICT LANE RULES
        if (currentCell.type === 'intersection' && roadTypes.includes(targetCell.type)) {
            if (!targetCell.allowedDirections.includes(moveDir)) {
                return false;
            }

            if (!ignoreLaneRules) {
                const entryInfo = this.findIntersectionEntry(node, grid);

                if (entryInfo) {
                    const turnType = this.getTurnType(entryInfo.direction, moveDir);

                    // OUTER lane (left): LEFT or STRAIGHT only
                    if (entryInfo.laneType === 'OUTER' && turnType === 'RIGHT') {
                        return false;
                    }
                    // INNER lane (right): RIGHT or STRAIGHT only
                    if (entryInfo.laneType === 'INNER' && turnType === 'LEFT') {
                        return false;
                    }

                    // Must exit to correct lane after turn
                    if (targetCell.laneType) {
                        if (turnType === 'STRAIGHT') {
                            // Stay in same relative lane
                            if (targetCell.laneType !== entryInfo.laneType) return false;
                        } else if (turnType === 'LEFT') {
                            // Left turn exits to INNER lane (right side of new road)
                            if (targetCell.laneType !== 'INNER') return false;
                        } else if (turnType === 'RIGHT') {
                            // Right turn exits to OUTER lane (left side of new road)
                            if (targetCell.laneType !== 'OUTER') return false;
                        }
                    }
                }
            }
            return true;
        }

        // Fallback - already handled 'empty' earlier, so return true for other cases
        return true;
    }

    private static findIntersectionEntry(node: Node, grid: GridCell[][]): { direction: Direction; laneType: 'INNER' | 'OUTER' } | null {
        let current: Node | undefined = node;
        while (current && current.parent) {
            const parentCell = grid[current.parent.y]?.[current.parent.x];
            const currentCell = grid[current.y]?.[current.x];
            if (parentCell && currentCell &&
                (parentCell.type === 'road' || parentCell.type === 'entry') &&
                currentCell.type === 'intersection') {
                const direction = parentCell.allowedDirections[0];
                const laneType = parentCell.laneType;
                if (direction && laneType) return { direction, laneType };
            }
            current = current.parent;
        }
        return null;
    }

    private static getTurnType(from: Direction, to: Direction): 'STRAIGHT' | 'LEFT' | 'RIGHT' | 'UTURN' {
        if (from === to) return 'STRAIGHT';
        const turnMap: Record<Direction, Record<Direction, 'LEFT' | 'RIGHT' | 'UTURN'>> = {
            'NORTH': { 'WEST': 'LEFT', 'EAST': 'RIGHT', 'SOUTH': 'UTURN', 'NORTH': 'STRAIGHT' as any },
            'SOUTH': { 'EAST': 'LEFT', 'WEST': 'RIGHT', 'NORTH': 'UTURN', 'SOUTH': 'STRAIGHT' as any },
            'EAST':  { 'NORTH': 'LEFT', 'SOUTH': 'RIGHT', 'WEST': 'UTURN', 'EAST': 'STRAIGHT' as any },
            'WEST':  { 'SOUTH': 'LEFT', 'NORTH': 'RIGHT', 'EAST': 'UTURN', 'WEST': 'STRAIGHT' as any }
        };
        return turnMap[from][to] || 'STRAIGHT';
    }

    private static reconstructPath(node: Node): Vector2D[] {
        const path: Vector2D[] = [];
        let curr: Node | undefined = node;
        while (curr) {
            path.push({ x: curr.x, y: curr.y });
            curr = curr.parent;
        }
        return path.reverse();
    }

    /**
     * Find all reachable exits grouped by roadId for homogeneous exit selection.
     */
    public static findExitsByRoad(grid: GridCell[][]): Map<string, Vector2D[]> {
        const exitsByRoad = new Map<string, Vector2D[]>();
        grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.type === 'exit' && cell.roadId) {
                    if (!exitsByRoad.has(cell.roadId)) {
                        exitsByRoad.set(cell.roadId, []);
                    }
                    exitsByRoad.get(cell.roadId)!.push({ x, y });
                }
            });
        });
        return exitsByRoad;
    }
}

class Node {
    public x: number;
    public y: number;
    public g: number;
    public h: number;
    public f: number;
    public parent?: Node;
    public laneType?: 'INNER' | 'OUTER';

    constructor(x: number, y: number, g: number, h: number, parent?: Node, laneType?: 'INNER' | 'OUTER') {
        this.x = x; this.y = y; this.g = g; this.h = h; this.f = g + h;
        this.parent = parent; this.laneType = laneType;
    }
}