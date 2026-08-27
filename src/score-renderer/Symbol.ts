import { PMXLine } from "./PMX";

export enum LibraryNumber {
    Pedal = 70,
    PedalOff = 71
}

export class Symbol extends PMXLine<
    {
        'staff-no': number,
        'horizontal': number,
        'vertical': number,
        'symbol': LibraryNumber,
        'size': number,
        'horizontal-size': number,
        'vertical-size': number,


    }> {
    constructor() {
        super(9, [
            ['staff-no', 2],
            ['horizontal', 3],
            ['vertical', 4],
            ['symbol', 5],
            ['size', 6],
            ['horizontal-size', 6],
            ['vertical-size', 7]
        ]);
    }
}

