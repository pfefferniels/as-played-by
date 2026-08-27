import { PMXLine } from "./PMX";

export enum CueSize {
    On = 100
}

export enum ClefType {
    Treble = 0,
    Bass = 1,
    Alto = 2,
    Tenor = 3,
}

export class Clef extends PMXLine<
    {
        'staff-no': number,
        'horizontal': number,
        'vertical': number,
        'cue-size': CueSize,
        'type': ClefType,
        'horizontal-size-factor': number,
        'vertical-size-factor': number
    }> {
    constructor() {
        super(3, [
            ['staff-no', 2],
            ['horizontal', 3],
            ['vertical', 4],
            ['cue-size', 4],
            ['type', 5],
            ['horizontal-size-factor', 6],
            ['vertical-size-factor', 7]
        ]);
    }
}

