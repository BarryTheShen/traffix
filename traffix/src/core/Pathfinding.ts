import type { Direction, GridCell, Vector2D } from './types';

export class Pathfinding {
    public static findPath(grid: GridCell[][], start: Vector2D, end: Vector2D, ignoreLaneRules: boolean = false): Vector2D[] | null {
        const rows = grid.length;
        const cols = grid[0].length;
        const openSet: Node[] = [];
        const closedSet: Set<string> = new Set();
        const startNode = new Node(start.x, start.y, 0, this.heuristic(start, end));
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
                if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;

                const gScore = current.g + 1;
                let neighborNode = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);

                if (!neighborNode) {
                    neighborNode = new Node(neighbor.x, neighbor.y, gScore, this.heuristic(neighbor, end), current);
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

    private static getNeighbors(node: Node, grid: GridCell[][], rows: number, cols: number, ignoreLaneRules: boolean = false): Vector2D[] {
        const neighbors: Vector2D[] = [];
        const dirs = [
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 }
        ];

        for (const dir of dirs) {
            const nx = node.x + dir.dx;
            const ny = node.y + dir.dy;

            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                const currentCell = grid[node.y][node.x];
                const targetCell = grid[ny][nx];

                if (targetCell.type !== 'empty') {
                    let canMove = true;
                    const moveDir: Direction =
                        dir.dx === 1 ? 'EAST' :
                            dir.dx === -1 ? 'WEST' :
                                dir.dy === 1 ? 'SOUTH' : 'NORTH';

                    const roadTypes = ['road', 'entry', 'exit'];
                    
                    if (roadTypes.includes(currentCell.type) && roadTypes.includes(targetCell.type)) {
                        if (currentCell.allowedDirections.includes(moveDir)) {
                            canMove = true;
                        } else {
                            canMove = ignoreLaneRules;
                        }
                    }

                    if (canMove && !ignoreLaneRules && currentCell.type === 'intersection' && roadTypes.includes(targetCell.type)) {
                        const exitDir = targetCell.allowedDirections[0];
                        const entryInfo = this.findIntersectionEntry(node, grid);

                        if (entryInfo) {
                            const turn = this.getTurnType(entryInfo.direction, exitDir);
                            if (entryInfo.laneType === 'OUTER') {
                                if (turn === 'LEFT') canMove = false;
                            } else if (entryInfo.laneType === 'INNER') {
                                if (turn === 'RIGHT') canMove = false;
                            }
                        }
                    }

                    if (canMove) {
                        neighbors.push({ x: nx, y: ny });
                    }
                }
            }
        }
        return neighbors;
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
        if (from === 'NORTH') return to === 'WEST' ? 'LEFT' : to === 'EAST' ? 'RIGHT' : 'UTURN';
        if (from === 'SOUTH') return to === 'EAST' ? 'LEFT' : to === 'WEST' ? 'RIGHT' : 'UTURN';
        if (from === 'EAST') return to === 'NORTH' ? 'LEFT' : to === 'SOUTH' ? 'RIGHT' : 'UTURN';
        if (from === 'WEST') return to === 'SOUTH' ? 'LEFT' : to === 'NORTH' ? 'RIGHT' : 'UTURN';
        return 'STRAIGHT';
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
}

class Node {
    public x: number;
    public y: number;
    public g: number;
    public h: number;
    public f: number;
    public parent?: Node;
    constructor(x: number, y: number, g: number, h: number, parent?: Node) {
        this.x = x; this.y = y; this.g = g; this.h = h; this.f = g + h; this.parent = parent;
    }
}