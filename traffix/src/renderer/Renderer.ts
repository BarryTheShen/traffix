import * as PIXI from 'pixi.js';
import type { SimulationState } from '../core/types';
import { Car } from '../entities/Car';

export class Renderer {
    private app: PIXI.Application;
    private cellSize: number = 20;
    private gridContainer: PIXI.Container;
    private gridGraphics: PIXI.Graphics;
    private entityGraphics: PIXI.Graphics;
    private pathGraphics: PIXI.Graphics;
    private labelContainer: PIXI.Container;
    private gridRendered: boolean = false;
    private container: HTMLElement;
    public debugMode: boolean = true;
    private intersectionBounds: Map<string, {x: number, y: number, width: number, height: number}> = new Map();

    constructor(container: HTMLElement) {
        this.container = container;
        this.app = new PIXI.Application();
        this.gridContainer = new PIXI.Container();
        this.gridGraphics = new PIXI.Graphics();
        this.entityGraphics = new PIXI.Graphics();
        this.pathGraphics = new PIXI.Graphics();
        this.labelContainer = new PIXI.Container();
    }

    public async init() {
        await this.app.init({ background: '#1a1a1a', resizeTo: this.container, antialias: true });
        this.container.appendChild(this.app.canvas);
        this.gridContainer.addChild(this.gridGraphics);
        this.gridContainer.addChild(this.pathGraphics);
        this.gridContainer.addChild(this.entityGraphics);
        this.gridContainer.addChild(this.labelContainer);
        this.app.stage.addChild(this.gridContainer);

        let dragging = false;
        let lastPos = { x: 0, y: 0 };
        this.app.canvas.addEventListener('mousedown', (e) => { dragging = true; lastPos = { x: e.clientX, y: e.clientY }; });
        window.addEventListener('mouseup', () => dragging = false);
        window.addEventListener('mousemove', (e) => {
            if (dragging) {
                this.gridContainer.x += e.clientX - lastPos.x;
                this.gridContainer.y += e.clientY - lastPos.y;
                lastPos = { x: e.clientX, y: e.clientY };
            }
        });
        this.app.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            const newScale = Math.max(0.1, Math.min(5, this.gridContainer.scale.x + delta));
            const worldPos = { x: (e.clientX - this.gridContainer.x) / this.gridContainer.scale.x, y: (e.clientY - this.gridContainer.y) / this.gridContainer.scale.y };
            this.gridContainer.scale.set(newScale);
            this.gridContainer.x = e.clientX - worldPos.x * newScale;
            this.gridContainer.y = e.clientY - worldPos.y * newScale;
        }, { passive: false });
        window.addEventListener('resize', () => this.fitToScreen());
    }

    private fitToScreen() {
        if (!this.gridRendered) return;
        const scale = Math.min(this.app.screen.width / (80 * this.cellSize), this.app.screen.height / (40 * this.cellSize), 1.0) * 0.8;
        this.gridContainer.scale.set(scale);
        this.gridContainer.x = (this.app.screen.width - 80 * this.cellSize * scale) / 2;
        this.gridContainer.y = (this.app.screen.height - 40 * this.cellSize * scale) / 2;
    }

    private getColorForCell(cell: any): number {
        if (cell.type === 'intersection') return 0x34495e;
        if (cell.type === 'entry') return 0x2980b9;
        if (cell.type === 'exit') return 0x7f8c8d;
        return 0x2c3e50;
    }

    private renderStaticGrid(state: SimulationState) {
        this.gridGraphics.clear();
        this.intersectionBounds.clear();

        // First pass: find intersection cell groups
        const intersectionCells: Map<string, {minX: number, minY: number, maxX: number, maxY: number}> = new Map();
        state.grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.type === 'intersection' && cell.intersectionId) {
                    const id = cell.intersectionId;
                    if (!intersectionCells.has(id)) {
                        intersectionCells.set(id, {minX: x, minY: y, maxX: x, maxY: y});
                    } else {
                        const bounds = intersectionCells.get(id)!;
                        bounds.minX = Math.min(bounds.minX, x);
                        bounds.minY = Math.min(bounds.minY, y);
                        bounds.maxX = Math.max(bounds.maxX, x);
                        bounds.maxY = Math.max(bounds.maxY, y);
                    }
                }
            });
        });

        // Store intersection bounds for click detection
        intersectionCells.forEach((bounds, id) => {
            this.intersectionBounds.set(id, {
                x: bounds.minX * this.cellSize,
                y: bounds.minY * this.cellSize,
                width: (bounds.maxX - bounds.minX + 1) * this.cellSize,
                height: (bounds.maxY - bounds.minY + 1) * this.cellSize
            });
        });

        state.grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.type === 'empty') return;

                this.gridGraphics.beginPath()
                    .rect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize)
                    .fill(this.getColorForCell(cell));

                if (cell.type === 'road') {
                    const dir = cell.allowedDirections[0];
                    let dotColor = 0x555555;
                    if (dir === 'NORTH') dotColor = 0x3498db;
                    if (dir === 'SOUTH') dotColor = 0xe74c3c;
                    if (dir === 'EAST') dotColor = 0xf1c40f;
                    if (dir === 'WEST') dotColor = 0x9b59b6;

                    this.gridGraphics.beginPath()
                        .rect(x * this.cellSize + 8, y * this.cellSize + 8, 4, 4)
                        .fill(dotColor);
                }
            });
        });
        this.gridRendered = true;
        this.fitToScreen();
    }

    public render(state: SimulationState) {
        if (!this.gridRendered) this.renderStaticGrid(state);
        this.entityGraphics.clear();
        this.pathGraphics.clear();
        this.labelContainer.removeChildren();

        // Draw path for selected vehicle (works even when paused)
        this.renderSelectedPath(state);

        // Traffic Lights
        state.trafficLights.forEach(light => {
            this.entityGraphics.beginPath()
                .roundRect(light.position.x * this.cellSize + 4, light.position.y * this.cellSize + 2, this.cellSize - 8, this.cellSize - 4, 4)
                .fill(0x333333);

            let color = 0x1a1a1a;
            if (light.state === 'GREEN') color = 0x2ecc71;
            else if (light.state === 'YELLOW') color = 0xf1c40f;
            else if (light.state === 'RED') color = 0xe74c3c;

            this.entityGraphics.beginPath()
                .circle(light.position.x * this.cellSize + this.cellSize / 2, light.position.y * this.cellSize + this.cellSize / 2, this.cellSize / 4)
                .fill(color);
        });

        // Blocked Spawns (Flashing Red) & Per-lane Queues
        const flash = (Math.floor(Date.now() / 250) % 2) === 0;
        state.grid.forEach((row, y) => row.forEach((cell, x) => {
            if (cell.type === 'entry') {
                const key = `${x},${y}`;
                const queue = state.laneQueues[key] || 0;

                // Red flash if blocked
                if (state.blockedSpawnIds.includes(key) && flash) {
                    this.entityGraphics.beginPath()
                        .rect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize)
                        .fill({ color: 0xe74c3c, alpha: 0.5 });
                }

                // Show per-lane queue number
                if (queue > 0) {
                    const text = new PIXI.Text({
                        text: queue.toString(),
                        style: { fontFamily: 'monospace', fontSize: 12, fill: 0xffffff, fontWeight: 'bold' }
                    });
                    text.anchor.set(0.5);
                    text.position.set(x * this.cellSize + this.cellSize/2, y * this.cellSize + this.cellSize/2);
                    this.labelContainer.addChild(text);
                }
            }
        }));

        // Vehicles
        state.vehicles.forEach(vehicle => {
            const car = vehicle as Car;
            const isSelected = car.id === state.selectedVehicleId;
            let color = 0xf1c40f;

            if (car.isCollided) color = 0x8e44ad;
            else if (isSelected) color = 0x3498db;
            else if (state.rebelDebug && car.violatesRules) color = 0xff00ff; // MAGENTA

            this.entityGraphics.beginPath()
                .rect(vehicle.position.x * this.cellSize + 4, vehicle.position.y * this.cellSize + 4, this.cellSize - 8, this.cellSize - 8)
                .fill(color);

            // Crash Countdown
            if (car.isCollided) {
                this.entityGraphics.beginPath()
                    .moveTo(vehicle.position.x * this.cellSize + 4, vehicle.position.y * this.cellSize + 4)
                    .lineTo(vehicle.position.x * this.cellSize + 16, vehicle.position.y * this.cellSize + 16)
                    .moveTo(vehicle.position.x * this.cellSize + 16, vehicle.position.y * this.cellSize + 4)
                    .lineTo(vehicle.position.x * this.cellSize + 4, vehicle.position.y * this.cellSize + 16)
                    .stroke({ width: 2, color: 0xffffff });

                // Use 300 ticks (5 seconds at 60fps) to match collisionCleanupTimeout
                const timerSeconds = Math.ceil((300 - car.collisionTimer) / 60);
                if (timerSeconds >= 0) {
                    const text = new PIXI.Text({
                        text: timerSeconds.toString(),
                        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff, stroke: { color: 0x000000, width: 2 } }
                    });
                    text.anchor.set(0.5);
                    text.position.set(vehicle.position.x * this.cellSize + this.cellSize / 2, vehicle.position.y * this.cellSize - 10);
                    this.labelContainer.addChild(text);
                }
            }
        });
    }

    public getVehicleAt(x: number, y: number, state: SimulationState): string | null {
        const worldX = (x - this.gridContainer.x) / this.gridContainer.scale.x;
        const worldY = (y - this.gridContainer.y) / this.gridContainer.scale.y;
        const gridX = worldX / this.cellSize;
        const gridY = worldY / this.cellSize;

        // Find the closest vehicle within click range
        // Vehicle position is already the center, no offset needed
        let closest: { id: string; dist: number } | null = null;
        for (const v of state.vehicles) {
            const dist = Math.sqrt((v.position.x - gridX)**2 + (v.position.y - gridY)**2);
            if (dist < 0.8 && (!closest || dist < closest.dist)) {
                closest = { id: v.id, dist };
            }
        }
        return closest ? closest.id : null;
    }

    /**
     * Check if a click is on an intersection and return its ID
     */
    public getIntersectionAt(x: number, y: number): string | null {
        const worldX = (x - this.gridContainer.x) / this.gridContainer.scale.x;
        const worldY = (y - this.gridContainer.y) / this.gridContainer.scale.y;

        for (const [id, bounds] of this.intersectionBounds) {
            if (worldX >= bounds.x && worldX <= bounds.x + bounds.width &&
                worldY >= bounds.y && worldY <= bounds.y + bounds.height) {
                return id;
            }
        }
        return null;
    }

    /**
     * Render the path of the selected vehicle
     */
    private renderSelectedPath(state: SimulationState) {
        const selectedId = state.selectedVehicleId;
        if (!selectedId) return;

        const vehicle = state.vehicles.find(v => v.id === selectedId) as Car;
        if (!vehicle || !vehicle.path || vehicle.path.length === 0) return;

        const path = vehicle.path;
        const currentIdx = vehicle.currentTargetIndex || 0;

        // Draw full path as semi-transparent line
        this.pathGraphics.beginPath();
        this.pathGraphics.moveTo(
            vehicle.position.x * this.cellSize + this.cellSize / 2,
            vehicle.position.y * this.cellSize + this.cellSize / 2
        );

        for (let i = currentIdx; i < path.length; i++) {
            this.pathGraphics.lineTo(
                path[i].x * this.cellSize + this.cellSize / 2,
                path[i].y * this.cellSize + this.cellSize / 2
            );
        }
        this.pathGraphics.stroke({ width: 3, color: 0x3498db, alpha: 0.6 });

        // Draw waypoint markers
        for (let i = currentIdx; i < path.length; i++) {
            const isTarget = i === currentIdx;
            const isDestination = i === path.length - 1;

            let markerColor = 0x3498db;
            let markerSize = 3;

            if (isDestination) {
                markerColor = 0x2ecc71;
                markerSize = 6;
            } else if (isTarget) {
                markerColor = 0xf1c40f;
                markerSize = 5;
            }

            this.pathGraphics.beginPath()
                .circle(
                    path[i].x * this.cellSize + this.cellSize / 2,
                    path[i].y * this.cellSize + this.cellSize / 2,
                    markerSize
                )
                .fill(markerColor);
        }

        // Draw destination marker with special styling
        if (vehicle.destination) {
            this.pathGraphics.beginPath()
                .circle(
                    vehicle.destination.x * this.cellSize + this.cellSize / 2,
                    vehicle.destination.y * this.cellSize + this.cellSize / 2,
                    8
                )
                .stroke({ width: 2, color: 0x2ecc71 });
        }

        // Debug: Show lane info for selected car
        if (state.rebelDebug && path.length > 0) {
            const entryCell = state.grid[path[0].y]?.[path[0].x];
            if (entryCell) {
                const dir = entryCell.allowedDirections?.[0] || '?';
                const lane = entryCell.laneType || '?';

                // Determine effective side - OUTER is always RIGHT side in right-hand traffic
                const effectiveSide = lane === 'OUTER' ? 'RIGHT' : 'LEFT';

                // Find first turn
                let turnInfo = 'STRAIGHT';
                for (let i = 1; i < path.length; i++) {
                    const prevCell = state.grid[path[i-1].y]?.[path[i-1].x];
                    const currCell = state.grid[path[i].y]?.[path[i].x];
                    if (prevCell?.type === 'intersection' && currCell?.type === 'road') {
                        const dx = path[i].x - path[i-1].x;
                        const dy = path[i].y - path[i-1].y;
                        const exitDir = dx > 0 ? 'EAST' : dx < 0 ? 'WEST' : dy > 0 ? 'SOUTH' : 'NORTH';

                        if (dir !== exitDir) {
                            const turnMap: Record<string, Record<string, string>> = {
                                'NORTH': { 'WEST': 'LEFT', 'EAST': 'RIGHT' },
                                'SOUTH': { 'EAST': 'LEFT', 'WEST': 'RIGHT' },
                                'EAST':  { 'NORTH': 'LEFT', 'SOUTH': 'RIGHT' },
                                'WEST':  { 'SOUTH': 'LEFT', 'NORTH': 'RIGHT' }
                            };
                            turnInfo = turnMap[dir]?.[exitDir] || 'STRAIGHT';
                        }
                        break;
                    }
                }

                const isViolation =
                    (effectiveSide === 'LEFT' && turnInfo === 'RIGHT') ||
                    (effectiveSide === 'RIGHT' && turnInfo === 'LEFT');

                const debugText = new PIXI.Text({
                    text: `${dir} ${lane}\n${effectiveSide} side\n${turnInfo} turn\n${isViolation ? 'VIOLATION!' : 'OK'}`,
                    style: {
                        fontFamily: 'monospace',
                        fontSize: 10,
                        fill: isViolation ? 0xff0000 : 0x00ff00,
                        stroke: { color: 0x000000, width: 2 }
                    }
                });
                debugText.anchor.set(0, 0);
                debugText.position.set(
                    vehicle.position.x * this.cellSize + this.cellSize,
                    vehicle.position.y * this.cellSize - 40
                );
                this.labelContainer.addChild(debugText);
            }
        }
    }

    public clearCache() { this.gridRendered = false; this.intersectionBounds.clear(); }
}