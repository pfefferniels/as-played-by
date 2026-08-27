import { PMXLine } from "./PMX";

export enum Hairpin {
    Hairpin = 999
}

export enum LineType {
    Dashed = 1,
    Wavy = -1,
    // PMX overloads P7 by line kind, so a wavy line and a diminuendo
    // hairpin legitimately share the same parameter value.
    // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
    DiminuendoHairpin = -1,
    CrescendoHairpin = 0
}

export class Line extends PMXLine<
    {
        'staff-no': number,
        'left-horizontal': number,
        'left-vertical': number, 
        'right-vertical': number | Hairpin, 
        'right-horizontal': number,
        'type': LineType,
        'hairpin-spread': number
        'dash-length': number
        'wave-width': number
        'wave-height': number
        'dash-space': number
        'rotation': number
        'thickness': number
    }> {
    constructor() {
        super(4, [
            ['staff-no', 2],
            ['left-horizontal', 3],
            ['left-vertical', 4],
            ['right-vertical', 5],
            ['right-horizontal', 6],
            ['type', 7],
            ['hairpin-spread', 7],
            ['dash-length', 8],
            ['wave-width', 8],
            ['dash-space', 9],
            ['rotation', 9],
            ['wave-height', 9],
            ['thickness', 10],
        ]);
    }
}

