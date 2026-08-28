/**
 * The MIDI pitch of a notated note. Used both when reading the score out of the
 * MEI and when reading it back out of the rendered SVG.
 */
const PITCH_CLASS: Record<string, number> = {
    c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
};

const ACCIDENTAL: Record<string, number> = {
    n: 0, f: -1, s: 1, ff: -2, ss: 2, x: 2, xs: 3, ts: 3, tf: -3,
};

export function midiPitch(
    pname: string | null | undefined,
    oct: string | number | null | undefined,
    accid?: string | null
): number | undefined {
    if (!pname || oct === null || oct === undefined || oct === "") return undefined;

    const pitchClass = PITCH_CLASS[pname.toLowerCase()];
    if (pitchClass === undefined) return undefined;

    const octave = typeof oct === "number" ? oct : parseInt(oct, 10);
    if (Number.isNaN(octave)) return undefined;

    return (octave + 1) * 12 + pitchClass + (accid ? (ACCIDENTAL[accid] ?? 0) : 0);
}
