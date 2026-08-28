/**
 * What each kind of disagreement is called, and what may be done about it.
 *
 * Kept apart from any component because the score is now the only place these
 * are decided: the popover that opens on a notehead needs them, and so does the
 * pass that carries the decisions into the document.
 */

import type { AddedReading, Divergence, MissingReading } from "../alignment/divergences";

/** What the reader wants done about a divergence. */
export type Action =
    /** Keep it in the recording and leave the notation alone */
    | "record"
    /** Write the played notes into the score, as a performance reading */
    | "write-notes"
    /** Put an ornament sign on the note that was decorated */
    | "add-sign"
    /** Mark the unplayed notes as a simplification */
    | "mark-simplification"
    /** Not about the music at all */
    | "ignore";

export interface Resolution {
    reading: string;
    action: Action;
}

export interface Attribution {
    resp: string;
    certainty: string;
}

export const CERTAINTIES = ["high", "medium", "low", "unknown"];

/** The name each family goes by, in the score and in the popover. */
export const ADDED_LABELS: Record<AddedReading, string> = {
    "written-ornament": "An ornament the score already writes",
    ornamentation: "Ornamentation the score does not write",
    "added-octave": "An octave doubled",
    "fuller-chord": "The chord filled out",
    "added-note": "A note added",
    "repeat-pass": "Played on a repeat the engraving shows once",
    outside: "Outside the music",
};

export const MISSING_LABELS: Record<MissingReading, string> = {
    "thinned-chord": "The chord thinned",
    "omitted-passage": "A passage passed over",
    "omitted-note": "A note not played",
    outside: "Beyond where the recording reaches",
};

export const labelOf = (divergence: Divergence): string =>
    divergence.kind === "added"
        ? ADDED_LABELS[divergence.reading]
        : MISSING_LABELS[divergence.reading];

/**
 * What may be done about each family, first entry first.
 *
 * A written ornament offers nothing but `record`: the score already says the
 * note is ornamented, and the only new fact is how it was played this time,
 * which belongs in the recording. Offering to "add" those notes would invite
 * writing a trill out as notation, which is not what the sign means.
 */
export const ACTIONS: Record<string, Action[]> = {
    "written-ornament": ["record"],
    ornamentation: ["record", "add-sign", "write-notes"],
    "added-octave": ["record", "write-notes"],
    "fuller-chord": ["record", "write-notes"],
    "added-note": ["record", "write-notes"],
    "repeat-pass": ["record", "ignore"],
    "thinned-chord": ["record", "mark-simplification"],
    "omitted-note": ["record", "mark-simplification"],
    "omitted-passage": ["record", "mark-simplification"],
    outside: ["ignore", "record"],
};

export const ACTION_LABELS: Record<Action, string> = {
    record: "Record only",
    "write-notes": "Write into the score",
    "add-sign": "Add an ornament sign",
    "mark-simplification": "Mark as a simplification",
    ignore: "Ignore",
};

/**
 * What a divergence does if nobody says otherwise.
 *
 * Everything is recorded and nothing is written, except what is not about the
 * music at all. An edition is not changed because an aligner proposed something.
 */
export const defaultAction = (divergence: Divergence): Action =>
    divergence.reading === "outside" ? "ignore" : "record";

/** Whether a decision would change the notation, rather than only the recording. */
export const changesNotation = (action: Action): boolean =>
    action !== "record" && action !== "ignore";

export function timestamp(ms: number): string {
    const seconds = ms / 1000;
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}
