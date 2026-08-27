import { PMXLine } from "./PMX";

export enum SpecialShapeType {
    Rect = 0,
    Ellipse = 1,
    GuitarGrid = -1
}

export class SpecialShape extends PMXLine<
    {
        'staff-no': number,
        'horizontal': number,
        'vertical': number,
        'type': SpecialShapeType,
        'horizontal-size': number,
        'size': number,
        'vertical-size': number,
        'thickness': number
        'rotation': number
    }> {
    constructor() {
        super(12, [
            ['staff-no', 2],
            ['horizontal', 3],
            ['vertical', 4],
            ['type', 5],
            ['horizontal-size', 6],
            ['size', 6],
            ['vertical-size', 7],
            ['thickness', 8],
            ['rotation', 9]
        ]);
    }
}

