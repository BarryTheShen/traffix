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

        // Within intersection - enforce logical path continuity
        if (currentCell.type === 'intersection' && targetCell.type === 'intersection') {
            // Look up the entry direction to this intersection
            const entryInfo = this.findIntersectionEntry(node, grid);
            if (entryInfo && !ignoreLaneRules) {
                // Can only continue in entry direction or valid turn direction
                // NOT reverse direction (would be U-turn)
                const reverseDir = this.getOppositeDirection(entryInfo.direction);
                if (moveDir === reverseDir) {
                    return false; // No U-turns within intersection
                }
            }
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

                    // Determine effective lane position relative to travel direction
                    // OUTER/INNER is assigned by absolute road position, but lane rules
                    // depend on position relative to travel direction
                    const effectiveLanePosition = this.getEffectiveLanePosition(
                        entryInfo.direction, entryInfo.laneType
                    );

                    // LEFT side of travel: LEFT or STRAIGHT only
                    if (effectiveLanePosition === 'LEFT' && turnType === 'RIGHT') {
                        return false;
                    }
                    // RIGHT side of travel: RIGHT or STRAIGHT only
                    if (effectiveLanePosition === 'RIGHT' && turnType === 'LEFT') {
                        return false;
                    }

                    // Must exit to correct lane after turn
                    if (targetCell.laneType) {
                        // Get the effective position on the EXIT road
                        const exitEffectivePosition = this.getEffectiveLanePosition(
                            moveDir, targetCell.laneType
                        );

                        if (turnType === 'STRAIGHT') {
                            // Stay in same relative lane position (LEFT stays LEFT, RIGHT stays RIGHT)
                            if (exitEffectivePosition !== effectiveLanePosition) return false;
                        } else if (turnType === 'LEFT') {
                            // Left turn exits to RIGHT side of new road (from driver's perspective)
                            if (exitEffectivePosition !== 'RIGHT') return false;
                        } else if (turnType === 'RIGHT') {
                            // Right turn exits to LEFT side of new road (from driver's perspective)
                            if (exitEffectivePosition !== 'LEFT') return false;
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

    /**
     * Determine the effective lane position (LEFT or RIGHT) relative to travel direction.
     * OUTER/INNER is assigned by absolute road position, but lane rules depend on
     * the driver's perspective (left side = can turn left, right side = can turn right).
     *
     * MapGenerator lane assignment (with lanes=2):
     * - Vertical road at pos=20: x=18 SOUTH/OUTER, x=19 SOUTH/INNER, x=20 NORTH/INNER, x=21 NORTH/OUTER
     * - Horizontal road at pos=10: y=8 WEST/OUTER, y=9 WEST/INNER, y=10 EAST/INNER, y=11 EAST/OUTER
     *
     * Driver's perspective (facing travel direction, right-hand traffic):
     * - SOUTH (facing down): left=lower x. x=18 OUTER is leftmost → OUTER=LEFT
     * - NORTH (facing up): left=higher x. x=21 OUTER is leftmost (from driver view) → OUTER=LEFT
     * - EAST (facing right): left=lower y. y=10 INNER is at lower y → INNER=LEFT, OUTER=RIGHT
     * - WEST (facing left): left=higher y. y=8 OUTER is at lower y → OUTER=RIGHT, INNER=LEFT
     *
     * Summary: SOUTH and NORTH have OUTER=RIGHT (outer edge is driver's right).
     *          EAST and WEST have OUTER=RIGHT (outer edge is driver's right).
     *
     * In right-hand traffic, drivers stay on the RIGHT side of the road.
     * The OUTER lane (furthest from road center) is always the RIGHT lane from driver's perspective.
     */
    private static getEffectiveLanePosition(travelDir: Direction, laneType: 'INNER' | 'OUTER'): 'LEFT' | 'RIGHT' {
        // In right-hand traffic, OUTER lane is always the RIGHT side of travel
        // INNER lane is always the LEFT side of travel (closer to oncoming traffic)
        return laneType === 'OUTER' ? 'RIGHT' : 'LEFT';
    }

    private static getOppositeDirection(dir: Direction): Direction {
        const opposites: Record<Direction, Direction> = {
            'NORTH': 'SOUTH',
            'SOUTH': 'NORTH',
            'EAST': 'WEST',
            'WEST': 'EAST'
        };
        return opposites[dir];
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