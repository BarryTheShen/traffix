export type LightState = 'RED' | 'YELLOW' | 'GREEN';

export class TrafficLight {
    public id: string;
    public state: LightState = 'RED';
    public timer: number = 0;
    public greenDuration: number = 300;
    public yellowDuration: number = 60; // 1 second at 60 TPS
    public redDuration: number = 300;
    public position: { x: number, y: number };
    public groupId?: string;

    constructor(id: string, x: number, y: number, groupId?: string) {
        this.id = id;
        this.position = { x, y };
        this.groupId = groupId;
    }

    public update() {
        this.timer++;
        if (this.state === 'GREEN' && this.timer >= this.greenDuration) {
            this.state = 'YELLOW';
            this.timer = 0;
        } else if (this.state === 'YELLOW' && this.timer >= this.yellowDuration) {
            this.state = 'RED';
            this.timer = 0;
        } else if (this.state === 'RED' && this.timer >= this.redDuration) {
            this.state = 'GREEN';
            this.timer = 0;
        }
    }
}
