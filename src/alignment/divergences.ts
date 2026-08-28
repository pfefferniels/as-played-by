/**
 * What the score and the performance disagree about, grouped into things a
 * reader can act on.
 *
 * The aligner hands back three flat lists, and two of them - the score notes
 * nothing answered to, and the played notes that answered to nothing - are the
 * interesting ones. Presented flat they are unusable: a trill alone contributes a
 * dozen unmatched played notes, and a reader shown twelve rows of time and pitch
 * has no way to see that they are one event, let alone one the score already
 * writes as a sign.
 *
 * The families below are the whole point of this module. "A note was added" and
 * "a note is missing" are each several different things, and what should be done
 * about one is nothing like what should be done about another. Naming the
 * families is what turns a list into a review.
 *
 * Nothing here is decided on the reader's behalf: every divergence carries a
 * proposed reading and the reason for it, and the reader confirms or overrules.
 */

import type { NoteSpan } from "../performance/midiSpans";
import type { ScoreNote } from "../score/scoreNotes";
import type { OrnamentSign } from "../mei/ornamentSigns";
import type { DeletedNote, InsertedNote, MatchedNote } from "./mlign";

/** Why a played note has no note in the score. */
export type AddedReading =
    /** The score writes the ornament as a sign; this is the performer playing it */
    | "written-ornament"
    /** An ornamental figure the score does not write */
    | "ornamentation"
    /** Doubling a written note at the octave */
    | "added-octave"
    /** Another tone of the chord that is sounding */
    | "fuller-chord"
    /** A single note of its own, between written ones */
    | "added-note"
    /** A repeat the engraving shows once and the performer played twice */
    | "repeat-pass"
    /** Outside the music: lead-in, a tail, applause, a stray key */
    | "outside";

/** Why a written note was never played. */
export type MissingReading =
    /** Other notes of the same chord were played; this one thinned it */
    | "thinned-chord"
    /** A stretch of the score the recording passes over */
    | "omitted-passage"
    /** One note, on its own */
    | "omitted-note"
    /** Beyond where the recording reaches - not something the performer did */
    | "outside";

export interface AddedDivergence {
    kind: "added";
    id: string;
    /** The played notes making up this one event, in the order they sound */
    perfIds: string[];
    /** Their pitches, so the figure can be shown without looking the spans up again */
    pitches: number[];
    /** The score note this event decorates or belongs to, where there is one */
    anchorId: string | null;
    /** The sign already on the anchor, which is what `written-ornament` rests on */
    signs: OrnamentSign[];
    reading: AddedReading;
    /** The sentence shown to the reader saying how the reading was arrived at */
    because: string;
    onsetMs: number;
    /** Lowest confidence the model gave any note of the group */
    confidence: number;
}

export interface MissingDivergence {
    kind: "missing";
    id: string;
    /** The score notes, in sounding order */
    scoreIds: string[];
    reading: MissingReading;
    because: string;
    /** Where in the score it falls, in quarter notes */
    onset: number;
    confidence: number;
}

export type Divergence = AddedDivergence | MissingDivergence;

export interface DivergenceOptions {
    /**
     * How long a silence ends a figure, in milliseconds. Notes of one ornament
     * follow each other far faster than this; separate events do not.
     */
    gapMs?: number;
    /** How close two notes must be to count as struck together */
    simultaneousMs?: number;
    /** How many notes a figure needs before it reads as ornamentation */
    figureNotes?: number;
    /** Whether the score writes a repeat with signs rather than writing it out */
    hasRepeats?: boolean;
}

const DEFAULTS = {
    gapMs: 250,
    simultaneousMs: 50,
    figureNotes: 3,
    hasRepeats: false,
};

export interface DivergenceInput {
    matches: readonly MatchedNote[];
    deletions: readonly DeletedNote[];
    insertions: readonly InsertedNote[];
    scoreNotes: readonly ScoreNote[];
    spans: readonly NoteSpan[];
    signs: ReadonlyMap<string, OrnamentSign[]>;
}

/**
 * Group, anchor and read every disagreement.
 *
 * The order is deliberate: the played notes are grouped into events first, then
 * each event is anchored to the score note it belongs to, and only then is it
 * read. Reading needs both - a group of three notes a semitone apart is a trill
 * only once you know which written note they surround.
 */
export function divergencesOf(
    input: DivergenceInput,
    options: DivergenceOptions = {}
): Divergence[] {
    const { gapMs, simultaneousMs, figureNotes, hasRepeats } = { ...DEFAULTS, ...options };

    const spanById = new Map(input.spans.map((span) => [span.id, span]));
    const scoreById = new Map(input.scoreNotes.map((note) => [note.note, note]));

    // The time map: what each matched score note turned into when it was played.
    const anchors: { scoreId: string; onsetMs: number; pitch: number }[] = [];
    for (const match of input.matches) {
        const span = spanById.get(match.performanceId);
        const note = scoreById.get(match.scoreId);
        if (span && note) {
            anchors.push({ scoreId: match.scoreId, onsetMs: span.onsetMs, pitch: note.pitch });
        }
    }
    anchors.sort((a, b) => a.onsetMs - b.onsetMs);

    // Where the recording actually reaches. A score note before the first matched
    // note or after the last was not left out by the performer - the recording
    // simply does not cover it, and saying otherwise invents a musical fact.
    const firstMs = anchors.length > 0 ? anchors[0].onsetMs : Infinity;
    const lastMs = anchors.length > 0 ? anchors[anchors.length - 1].onsetMs : -Infinity;

    return [
        ...addedDivergences(input, {
            spanById,
            anchors,
            firstMs,
            lastMs,
            gapMs,
            simultaneousMs,
            figureNotes,
            hasRepeats,
        }),
        ...missingDivergences(input, { scoreById, anchors, firstMs, lastMs }),
    ];
}

interface AddedContext {
    spanById: Map<string, NoteSpan>;
    anchors: { scoreId: string; onsetMs: number; pitch: number }[];
    firstMs: number;
    lastMs: number;
    gapMs: number;
    simultaneousMs: number;
    figureNotes: number;
    hasRepeats: boolean;
}

function addedDivergences(input: DivergenceInput, ctx: AddedContext): AddedDivergence[] {
    const played = input.insertions
        .map((insertion) => ({
            insertion,
            span: ctx.spanById.get(insertion.performanceId),
        }))
        .filter((entry): entry is { insertion: InsertedNote; span: NoteSpan } => !!entry.span)
        .sort((a, b) => a.span.onsetMs - b.span.onsetMs);

    // Group first: a run of played notes with no real silence between them, all
    // leaning on the same written note, is one event however many notes it holds.
    const groups: { insertion: InsertedNote; span: NoteSpan }[][] = [];
    for (const entry of played) {
        const current = groups[groups.length - 1];
        const previous = current?.[current.length - 1];

        const sameEvent =
            previous !== undefined &&
            entry.span.onsetMs - previous.span.onsetMs <= ctx.gapMs &&
            anchorFor(previous.span.onsetMs, ctx.anchors)?.scoreId ===
                anchorFor(entry.span.onsetMs, ctx.anchors)?.scoreId;

        if (sameEvent) current.push(entry);
        else groups.push([entry]);
    }

    return groups.map((group, index) => {
        const spans = group.map((entry) => entry.span);
        const onsetMs = spans[0].onsetMs;
        const anchor = anchorFor(onsetMs, ctx.anchors);
        const signs = anchor ? input.signs.get(anchor.scoreId) ?? [] : [];

        const { reading, because } = readAdded(spans, anchor, signs, ctx);

        return {
            kind: "added" as const,
            id: `added-${index}`,
            perfIds: spans.map((span) => span.id),
            pitches: spans.map((span) => span.pitch),
            anchorId: anchor?.scoreId ?? null,
            signs,
            reading,
            because,
            onsetMs,
            confidence: Math.min(...group.map((entry) => entry.insertion.confidence)),
        };
    });
}

/**
 * The written note a played note leans on: the last one struck at or before it.
 *
 * A figure that leans on the *following* note - a turn played just before the
 * beat it decorates - is left anchored to the note before it. The reader can see
 * both in the score and move it; guessing between the two on timing alone is
 * less honest than showing where the sound actually sits.
 */
function anchorFor(
    onsetMs: number,
    anchors: { scoreId: string; onsetMs: number; pitch: number }[]
): { scoreId: string; onsetMs: number; pitch: number } | undefined {
    let low = 0;
    let high = anchors.length - 1;
    let found: { scoreId: string; onsetMs: number; pitch: number } | undefined;

    while (low <= high) {
        const mid = (low + high) >> 1;
        if (anchors[mid].onsetMs <= onsetMs) {
            found = anchors[mid];
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return found;
}

function readAdded(
    spans: NoteSpan[],
    anchor: { scoreId: string; onsetMs: number; pitch: number } | undefined,
    signs: OrnamentSign[],
    ctx: AddedContext
): { reading: AddedReading; because: string } {
    const onsetMs = spans[0].onsetMs;

    if (onsetMs < ctx.firstMs || onsetMs > ctx.lastMs) {
        return {
            reading: "outside",
            because: "Played before the first or after the last note the score accounts for.",
        };
    }

    if (anchor && signs.length > 0) {
        const names = [...new Set(signs.map((sign) => sign.name))].join(" and ");
        return {
            reading: "written-ornament",
            because:
                `The score writes a ${names} on this note. Verovio reads an ornament sign as ` +
                `the single note it is written on, so the rest of what was played has no note ` +
                `to match - these are that ornament, performed.`,
        };
    }

    if (spans.length >= ctx.figureNotes && anchor && nearAnchor(spans, anchor)) {
        return {
            reading: "ornamentation",
            because:
                `${spans.length} notes played quickly around a written note, none more than a ` +
                `few semitones from it, and the score writes no ornament here.`,
        };
    }

    if (anchor && Math.abs(onsetMs - anchor.onsetMs) <= ctx.simultaneousMs) {
        const interval = spans[0].pitch - anchor.pitch;
        if (Math.abs(interval) % 12 === 0 && interval !== 0) {
            const octaves = Math.abs(interval) / 12;
            return {
                reading: "added-octave",
                because:
                    `Struck with a written note, ` +
                    `${octaves === 1 ? "an octave" : `${octaves} octaves`} ` +
                    `${interval > 0 ? "above" : "below"} it.`,
            };
        }
        return {
            reading: "fuller-chord",
            because: "Struck with a written note, at another tone of the chord.",
        };
    }

    if (ctx.hasRepeats) {
        return {
            reading: "repeat-pass",
            because:
                "The score writes its repeats with repeat signs rather than writing them out, " +
                "so everything played on a second pass has no note of its own to match.",
        };
    }

    return {
        reading: "added-note",
        because: "A note of its own, between written ones.",
    };
}

/** Whether a figure stays within a few semitones of the note it surrounds. */
function nearAnchor(
    spans: NoteSpan[],
    anchor: { scoreId: string; onsetMs: number; pitch: number }
): boolean {
    return spans.every((span) => Math.abs(span.pitch - anchor.pitch) <= 4);
}

interface MissingContext {
    scoreById: Map<string, ScoreNote>;
    anchors: { scoreId: string; onsetMs: number; pitch: number }[];
    firstMs: number;
    lastMs: number;
}

function missingDivergences(input: DivergenceInput, ctx: MissingContext): MissingDivergence[] {
    const matchedOnsets = new Set<number>();
    for (const match of input.matches) {
        const note = ctx.scoreById.get(match.scoreId);
        if (note) matchedOnsets.add(note.onset);
    }

    const unplayed = input.deletions
        .map((deletion) => ({ deletion, note: ctx.scoreById.get(deletion.scoreId) }))
        .filter((entry): entry is { deletion: DeletedNote; note: ScoreNote } => !!entry.note)
        .sort((a, b) => a.note.onset - b.note.onset || a.note.pitch - b.note.pitch);

    // A note whose own moment was otherwise played thinned a chord; one whose
    // moment went unplayed altogether belongs with its neighbours in a passage.
    const groups: { deletion: DeletedNote; note: ScoreNote }[][] = [];
    for (const entry of unplayed) {
        const current = groups[groups.length - 1];
        const previous = current?.[current.length - 1];
        const thinning = matchedOnsets.has(entry.note.onset);
        const previousThinning = previous ? matchedOnsets.has(previous.note.onset) : false;

        const sameEvent =
            previous !== undefined &&
            thinning === previousThinning &&
            (thinning ? previous.note.onset === entry.note.onset : true);

        if (sameEvent) current.push(entry);
        else groups.push([entry]);
    }

    // Whether the recording covers a moment at all, judged from the written notes
    // around it that were played.
    const coveredFrom = ctx.anchors.length > 0 ? firstMatchedOnset(input, ctx) : Infinity;
    const coveredTo = ctx.anchors.length > 0 ? lastMatchedOnset(input, ctx) : -Infinity;

    return groups.map((group, index) => {
        const notes = group.map((entry) => entry.note);
        const onset = notes[0].onset;
        const thinning = matchedOnsets.has(onset);

        let reading: MissingReading;
        let because: string;

        if (onset < coveredFrom || onset > coveredTo) {
            reading = "outside";
            because =
                "Beyond where the recording reaches - the performer did not leave this out, " +
                "the recording does not cover it.";
        } else if (thinning) {
            reading = "thinned-chord";
            because = `Other notes sounding at this moment were played; ${notes.length} ${
                notes.length === 1 ? "was" : "were"
            } not.`;
        } else if (notes.length > 1) {
            reading = "omitted-passage";
            because = `${notes.length} notes in a row that the recording passes over.`;
        } else {
            reading = "omitted-note";
            because = "One written note that nothing in the recording answers to.";
        }

        return {
            kind: "missing" as const,
            id: `missing-${index}`,
            scoreIds: notes.map((note) => note.note),
            reading,
            because,
            onset,
            confidence: Math.min(...group.map((entry) => entry.deletion.confidence)),
        };
    });
}

function firstMatchedOnset(input: DivergenceInput, ctx: MissingContext): number {
    let earliest = Infinity;
    for (const match of input.matches) {
        const note = ctx.scoreById.get(match.scoreId);
        if (note && note.onset < earliest) earliest = note.onset;
    }
    return earliest;
}

function lastMatchedOnset(input: DivergenceInput, ctx: MissingContext): number {
    let latest = -Infinity;
    for (const match of input.matches) {
        const note = ctx.scoreById.get(match.scoreId);
        if (note && note.onset > latest) latest = note.onset;
    }
    return latest;
}
