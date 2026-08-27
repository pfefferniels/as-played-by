import { PMXLine } from "./PMX";

export enum Font {
    TimesRoman = 0,
    TimesBold = 1,
    TimesItalics = 2,
    PalatinoRoman = 12,
    PalatinoBold = 13,
    PalatinoItalics = 14,
    Bodoni = 90,
    BodoniBold = 91,
    MusicSymbols = 94,
    Helvetica = 1004,
}

export enum FontOutline {
    FontOutline = 100
}

export class InlineText extends PMXLine<
    {
        'staff-no': number,
        'horizontal': number,
        'vertical': number,
        'letter-spacing': number,
        'size': number,
        'horizontal-size': number, 
        'vertical-size': number,
        'font': Font, 
        'font-outline': FontOutline,
        'rotation': number,
    }> {
    constructor() {
        super('t', [
            ['staff-no', 2],
            ['horizontal', 3],
            ['vertical', 4],
            ['letter-spacing', 5],
            ['size', 6],
            ['horizontal-size', 6],
            ['vertical-size', 7],
            ['font', 8],
            ['font-outline', 8],
            ['rotation', 9]
        ]);
    }


}

