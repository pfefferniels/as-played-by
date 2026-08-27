import { ClefType, CueSize } from "./Clef";
import { PMXLine } from "./PMX";

export class KeySig extends PMXLine<
    {
        'staff-no': number,
        'horizontal': number,
        'vertical': number,
        'number-accidentals': number,
        'clef-type': ClefType,
        'cue-size': CueSize
    }> {
    constructor() {
        super(17, [
            ['staff-no', 2],
            ['horizontal', 3],
            ['vertical', 4],
            ['number-accidentals', 5],
            ['clef-type', 6],
            ['cue-size', 6]
        ]);
    }
}

