import * as PIXI from 'pixi.js';
import type { SimulationState } from '../core/types';
import { Car } from '../entities/Car';

export class Renderer {
    private app: PIXI.Application;
    private cellSize: number = 20;
    private gridContainer: PIXI.Container;
    private gridGraphics: PIXI.Graphics;
    private entityGraphics: PIXI.Graphics;
    private labelContainer: PIXI.Container;
    private gridRendered: boolean = false;
    private container: HTMLElement;
    public debugMode: boolean = true;

    constructor(container: HTMLElement) {
        this.container = container;
        this.app = new PIXI.Application();
        this.gridContainer = new PIXI.Container();
        this.gridGraphics = new PIXI.Graphics();
        this.entityGraphics = new PIXI.Graphics();
        this.labelContainer = new PIXI.Container();
    }

    public async init() {
        await this.app.init({ background: '#1a1a1a', resizeTo: this.container, antialias: true });
        this.container.appendChild(this.app.canvas);
        this.gridContainer.addChild(this.gridGraphics);
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
        this.labelContainer.removeChildren();

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
                .fill(color)
                .stroke({ color: color, width: 2, alpha: 0.3 });
        });

        state.vehicles.forEach(vehicle => {
            if (!(vehicle instanceof Car)) return;
            const car = vehicle as Car;
            const isSelected = car.id === (state as any).selectedVehicleId;
            let color = 0xf1c40f;
            
            if (car.isCollided) color = 0x8e44ad;
            else if (car.spawnStuckTimer > 60) color = (Math.floor(Date.now() / 200) % 2) === 0 ? 0xe74c3c : 0xf1c40f;
            else if (car.stuckTimer > 1200) color = 0xe67e22;
            else if (isSelected) color = 0x3498db;
            else if (state.rebelDebug && car.violatesRules) color = 0xff00ff;

            this.entityGraphics.beginPath()
                .rect(vehicle.position.x * this.cellSize + 4, vehicle.position.y * this.cellSize + 4, this.cellSize - 8, this.cellSize - 8)
                .fill(color);

            // Labels & Countdowns
            let timerSeconds: number | null = null;
            if (car.isCollided) {
                this.entityGraphics.beginPath()
                    .moveTo(vehicle.position.x * this.cellSize + 4, vehicle.position.y * this.cellSize + 4)
                    .lineTo(vehicle.position.x * this.cellSize + 16, vehicle.position.y * this.cellSize + 16)
                    .moveTo(vehicle.position.x * this.cellSize + 16, vehicle.position.y * this.cellSize + 4)
                    .lineTo(vehicle.position.x * this.cellSize + 4, vehicle.position.y * this.cellSize + 16)
                    .stroke({ width: 2, color: 0xffffff });
                
                // Crashed car countdown (clears after 600 ticks)
                timerSeconds = Math.ceil((600 - car.collisionTimer) / 60);
            } else if (car.spawnStuckTimer > 60) {
                // Stuck at spawn countdown (ends game after 1200 ticks)
                timerSeconds = Math.ceil((1200 - car.spawnStuckTimer) / 60);
            }

            if (timerSeconds !== null && timerSeconds >= 0) {
                const text = new PIXI.Text({
                    text: timerSeconds.toString(),
                    style: {
                        fontFamily: 'monospace',
                        fontSize: 14,
                        fill: 0xffffff,
                        stroke: { color: 0x000000, width: 2 }
                    }
                });
                text.anchor.set(0.5);
                text.position.set(vehicle.position.x * this.cellSize + this.cellSize / 2, vehicle.position.y * this.cellSize - 10);
                this.labelContainer.addChild(text);
            }

            if (isSelected && this.debugMode) {
                const points = (vehicle as Car).path.slice(vehicle.currentTargetIndex).map(p => ({ x: p.x * this.cellSize + this.cellSize / 2, y: p.y * this.cellSize + this.cellSize / 2 }));
                if (points.length > 1) {
                    this.entityGraphics.beginPath()
                        .poly(points, false)
                        .stroke({ color: 0xffffff, width: 3, alpha: 0.9 });
                    
                    this.entityGraphics.beginPath()
                        .circle(points[0].x, points[0].y, 4)
                        .fill(0xff0000);
                }
            }
        });
    }

    public getVehicleAt(x: number, y: number, state: SimulationState): string | null {
        const worldX = (x - this.gridContainer.x) / this.gridContainer.scale.x;
        const worldY = (y - this.gridContainer.y) / this.gridContainer.scale.y;
        const gridX = worldX / this.cellSize;
        const gridY = worldY / this.cellSize;
        const found = state.vehicles.find(v => Math.sqrt((v.position.x + 0.5 - gridX)**2 + (v.position.y + 0.5 - gridY)**2) < 1.0);
        return found ? found.id : null;
    }

    public clearCache() { this.gridRendered = false; }
}