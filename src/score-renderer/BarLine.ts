import { PMXLine } from "./PMX";

/**
 * Bar line styles defined by the PMX format. The full vocabulary is
 * modelled here even where the renderer does not emit every member yet.
 *
 * @public
 */
export enum BarLineType {
    Normal = 0,
    Double = 1,
    HeavyDouble = 2,
    RepeatRight = 3,
    RepeatLeft = 4,
    RepeatBoth = 5,
    RepeatBothAlt = 6,
    Dashed = 7,
    Brace  = 8,
    Bracket = 9,
    SubBracket = 10
}

export enum PartialBracketType {
    Closed = 0,
    OpenBottom = 1,
    OpenTop = 2,
    OpenBoth = 3
}

export class BarLine extends PMXLine<
    {
        'staff-no': number,
        'horizontal': number,
        'staves': number,
        'type': BarLineType,
        'thickness': number,
        'horizontal-displacement': number,
        'partial-bracket': PartialBracketType,
        'dash-size': number,
        'dash-space': number,
        'origin': number,
        'end': number
    }> {
    constructor() {
        super(14, [
            ['staff-no', 2],
            ['horizontal', 3],
            ['staves', 4],
            ['type', 5],
            ['thickness', 6],
            ['horizontal-displacement', 7],
            ['partial-bracket', 8],
            ['dash-size', 8],
            ['dash-space', 9],
            ['origin', 10],
            ['end', 11]
        ]);
    }
}

