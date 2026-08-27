import { PMXLine } from "./PMX";

export enum StemDir {
    NoStem = 0,
    Up = 10,
    Down = 20
}

export enum Accid {
    Normal = 0,
    Flat = 1,
    Sharp = 2,
    Natural = 3,
    DoubelFlat = 4,
    DoubleSharp = 5,
}

export enum AccidParantheses {
    On = 100
}

export enum GraceNote {
    GraceNote = 100
}

export enum GraceNoteFlag {
    GraceNoteFlag = 100
}

/**
 * Note head shapes defined by the PMX format. The full vocabulary is
 * modelled here even where the renderer does not emit every member yet.
 *
 * @public
 */
export enum NoteHeadType {
    Solid = 0,
    Half = 1,
    Whole = 2,
    DoubleWhole = 3,
    OpenDiamond = 4,
    SolidDiamond = 5,
    X = 6,
    OpenX = 139,
    NoNoteHead = -1
}

export enum ExtenderLine {
    ExtenderLine = 99
}

export class Note extends PMXLine<
    {
        'staff-no': number,
        'horizontal': number,
        'vertical': number,
        'grace': GraceNote,
        'stem-dir': StemDir,
        'accid': Accid,
        'accid-parantheses': AccidParantheses,
        'notehead': NoteHeadType,
        'duration': number,
        'stem-length': number,
        'grace-note-flag': GraceNoteFlag,
        'extender-line': ExtenderLine,
        'extender-line-start': number,
        'extender-line-end': number
    }> {
    constructor() {
        super(1, [
            ['staff-no', 2],
            ['horizontal', 3],
            ['vertical', 4],
            ['grace', 4],
            ['stem-dir', 5],
            ['accid', 5],
            ['accid-parantheses', 5],
            ['notehead', 6],
            ['duration', 7],
            ['stem-length', 8],
            ['grace-note-flag', 8],
            ['extender-line', 11],
            ['extender-line-start', 13],
            ['extender-line-end', 14]
        ]);
    }
}
