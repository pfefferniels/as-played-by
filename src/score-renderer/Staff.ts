import { PMXLine } from "./PMX";

export enum StaffLines {
    Invisible = -1
}

export class Staff extends PMXLine<
    {
        'staff-no': number,
        'left-horizontal': number,
        'vertical': number,
        'size': number,
        'right-horizontal': number,
        'lines': number | StaffLines,
        'bottom-line': number,
        'thickness': number
    }> {
    constructor() {
        super(8, [
            ['staff-no', 2],
            ['left-horizontal', 3],
            ['vertical', 4],
            ['size', 5],
            ['right-horizontal', 6],
            ['lines', 7],
            ['bottom-line', 7],
            ['thickness', 10]
        ]);
    }
}

