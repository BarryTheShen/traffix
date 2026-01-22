import { Intersection } from './Intersection';

export class TrafficLightController {
    private intersections: Intersection[];

    constructor(intersections: Intersection[]) {
        this.intersections = intersections;
    }

    public update() {
        this.intersections.forEach(intersection => {
            intersection.update();
        });
    }
}
