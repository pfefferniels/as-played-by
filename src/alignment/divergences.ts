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
 * The third family is the one the aligner cannot see at all. It labels every
 * note either matched or unmatched, so a written note played as a different note
 * comes back as two independent facts - a note missing here, a note added there -
 * when it is one: the performer played *this* instead of *that*. Pairing them
 * back up is done here, before anything is read, because a pair is a strictly
 * better account of both halves than either half has on its own.
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

/** What was played in place of a written note. */
export type ReplacedReading =
    /** The written note itself, which the aligner failed to pair with it */
    | "unmatched-pair"
    /** A neighbour: the slip of a semitone or a tone that every pianist makes */
    | "neighbour-slip"
    /** The written note, taken in another octave */
    | "octave-displaced"
    /** Some other note in its place */
    | "different-note";

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

/**
 * One written note and the played note that stood in for it.
 *
 * It carries both halves, because both are true and the edition needs both: the
 * score says one note, the recording says another, at the moment the first was
 * due. Written into the MEI it becomes a single <when> carrying `@data` and
 * `@absolute` at once - the written note, sounding, at a pitch of its own.
 */
export interface ReplacedDivergence {
    kind: "replaced";
    id: string;
    /** The written note, which the recording did not play as written */
    scoreId: string;
    /** What was played in its place */
    perfId: string;
    /** The written pitch and the played one, in that order */
    pitches: [written: number, played: number];
    reading: ReplacedReading;
    because: string;
    /** Where in the score it falls, in quarter notes */
    onset: number;
    /** When the substitute was struck */
    onsetMs: number;
    /** How far the played note fell from where the written one was due */
    lateMs: number;
    confidence: number;
}

export type Divergence = AddedDivergence | MissingDivergence | ReplacedDivergence;

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
    /**
     * How far from where a written note was due a played note may fall and still
     * be read as standing in for it. Wider than `simultaneousMs`, because the
     * moment is not measured but interpolated from the notes around it, and
     * narrow enough that it stays inside the beat at any reasonable tempo.
     */
    replacementMs?: number;
    /**
     * How far a substitute may lie from the note it replaced. An octave: beyond
     * that the two are more readily two things that happened than one thing that
     * went differently.
     */
    replacementSemitones?: number;
}

const DEFAULTS = {
    gapMs: 250,
    simultaneousMs: 50,
    figureNotes: 3,
    hasRepeats: false,
    replacementMs: 200,
    replacementSemitones: 12,
};

export interface DivergenceInput {
    matches: readonly MatchedNote[];
    deletions: readonly DeletedNote[];
    insertions: readonly InsertedNote[];
    scoreNotes: readonly ScoreNote[];
    spans: readonly NoteSpan[];
    signs: ReadonlyMap<string, OrnamentSign[]>;
}

/** A matched note, as both a moment in the score and a moment in the recording. */
interface Anchor {
    scoreId: string;
    /** Where the score puts it, in quarter notes */
    onset: number;
    /** When it was played */
    onsetMs: number;
    pitch: number;
}

interface PlayedGroup {
    id: string;
    entries: { insertion: InsertedNote; span: NoteSpan }[];
}

interface UnplayedGroup {
    id: string;
    entries: { deletion: DeletedNote; note: ScoreNote }[];
}

/**
 * Group, pair, anchor and read every disagreement.
 *
 * The order is deliberate. The two sides are grouped into events first, because
 * only whole events can be compared. Then the events that are two halves of one
 * substitution are paired off and taken out of both lists - a pair explains both
 * halves, and leaving either behind would report the same moment twice, once as
 * a note nobody played and once as a note nobody wrote. Only what is left is
 * anchored and read: a group of three notes a semitone apart is a trill only once
 * you know which written note they surround.
 */
export function divergencesOf(
    input: DivergenceInput,
    options: DivergenceOptions = {}
): Divergence[] {
    const settings = { ...DEFAULTS, ...options };

    const spanById = new Map(input.spans.map((span) => [span.id, span]));
    const scoreById = new Map(input.scoreNotes.map((note) => [note.note, note]));

    // The time map: what each matched score note turned into when it was played.
    const anchors: Anchor[] = [];
    for (const match of input.matches) {
        const span = spanById.get(match.performanceId);
        const note = scoreById.get(match.scoreId);
        if (span && note) {
            anchors.push({
                scoreId: match.scoreId,
                onset: note.onset,
                onsetMs: span.onsetMs,
                pitch: note.pitch,
            });
        }
    }
    anchors.sort((a, b) => a.onsetMs - b.onsetMs);

    // Where the recording actually reaches. A score note before the first matched
    // note or after the last was not left out by the performer - the recording
    // simply does not cover it, and saying otherwise invents a musical fact.
    const firstMs = anchors.length > 0 ? anchors[0].onsetMs : Infinity;
    const lastMs = anchors.length > 0 ? anchors[anchors.length - 1].onsetMs : -Infinity;

    const played = groupPlayed(input, spanById, anchors, settings.gapMs);
    const unplayed = groupUnplayed(input, scoreById);

    const { replaced, playedLeft, unplayedLeft } = pairReplacements(
        played,
        unplayed,
        timeMapOf(anchors),
        settings
    );

    const ctx: AddedContext = {
        anchors,
        firstMs,
        lastMs,
        simultaneousMs: settings.simultaneousMs,
        figureNotes: settings.figureNotes,
        hasRepeats: settings.hasRepeats,
    };

    const missingCtx = missingContextOf(input, scoreById, anchors.length > 0);

    return [
        ...replaced,
        ...playedLeft.map((group) => readPlayed(group, input, ctx)),
        ...unplayedLeft.map((group) => readUnplayed(group, missingCtx)),
    ];
}

/* -------------------------------------------------------------------------- */
/* Grouping                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Played notes with no score note, gathered into events.
 *
 * A run with no real silence between its notes, all leaning on the same written
 * note, is one event however many notes it holds.
 */
function groupPlayed(
    input: DivergenceInput,
    spanById: Map<string, NoteSpan>,
    anchors: Anchor[],
    gapMs: number
): PlayedGroup[] {
    const played = input.insertions
        .map((insertion) => ({ insertion, span: spanById.get(insertion.performanceId) }))
        .filter((entry): entry is { insertion: InsertedNote; span: NoteSpan } => !!entry.span)
        .sort((a, b) => a.span.onsetMs - b.span.onsetMs);

    const groups: PlayedGroup[] = [];
    for (const entry of played) {
        const current = groups[groups.length - 1];
        const previous = current?.entries[current.entries.length - 1];

        const sameEvent =
            previous !== undefined &&
            entry.span.onsetMs - previous.span.onsetMs <= gapMs &&
            anchorFor(previous.span.onsetMs, anchors)?.scoreId ===
                anchorFor(entry.span.onsetMs, anchors)?.scoreId;

        if (sameEvent) current.entries.push(entry);
        else groups.push({ id: `added-${groups.length}`, entries: [entry] });
    }

    return groups;
}

/**
 * Written notes nothing answered to, gathered into events.
 *
 * A note whose own moment was otherwise played thinned a chord; one whose moment
 * went unplayed altogether belongs with its neighbours in a passage.
 */
function groupUnplayed(
    input: DivergenceInput,
    scoreById: Map<string, ScoreNote>
): UnplayedGroup[] {
    const matchedOnsets = new Set<number>();
    for (const match of input.matches) {
        const note = scoreById.get(match.scoreId);
        if (note) matchedOnsets.add(note.onset);
    }

    const unplayed = input.deletions
        .map((deletion) => ({ deletion, note: scoreById.get(deletion.scoreId) }))
        .filter((entry): entry is { deletion: DeletedNote; note: ScoreNote } => !!entry.note)
        .sort((a, b) => a.note.onset - b.note.onset || a.note.pitch - b.note.pitch);

    const groups: UnplayedGroup[] = [];
    for (const entry of unplayed) {
        const current = groups[groups.length - 1];
        const previous = current?.entries[current.entries.length - 1];
        const thinning = matchedOnsets.has(entry.note.onset);
        const previousThinning = previous ? matchedOnsets.has(previous.note.onset) : false;

        const sameEvent =
            previous !== undefined &&
            thinning === previousThinning &&
            (thinning ? previous.note.onset === entry.note.onset : true);

        if (sameEvent) current.entries.push(entry);
        else groups.push({ id: `missing-${groups.length}`, entries: [entry] });
    }

    return groups;
}

/* -------------------------------------------------------------------------- */
/* Pairing                                                                     */
/* -------------------------------------------------------------------------- */

/** Matched notes as (score time, performed time), for reading between them. */
function timeMapOf(anchors: Anchor[]): { onset: number; ms: number }[] {
    return anchors
        .map((anchor) => ({ onset: anchor.onset, ms: anchor.onsetMs }))
        .sort((a, b) => a.onset - b.onset);
}

/**
 * When a written note was due, in the recording's own time.
 *
 * Read off the matched notes on either side of it. A moment the matched notes do
 * not bracket has no answer: the recording says nothing about it, and a guess
 * extrapolated past the last note it does cover would be an invention.
 */
function expectedMs(
    onset: number,
    map: readonly { onset: number; ms: number }[]
): number | undefined {
    if (map.length === 0) return undefined;
    if (onset < map[0].onset || onset > map[map.length - 1].onset) return undefined;

    let low = 0;
    let high = map.length - 1;
    while (low < high - 1) {
        const mid = (low + high) >> 1;
        if (map[mid].onset <= onset) low = mid;
        else high = mid;
    }

    const before = map[low];
    const after = map[high];
    if (after.onset === before.onset) return before.ms;

    const t = (onset - before.onset) / (after.onset - before.onset);
    return before.ms + t * (after.ms - before.ms);
}

/**
 * Match up the halves of a substitution.
 *
 * A written note that went unplayed and a played note that answered to nothing
 * are one event when the second falls where the first was due. Only single notes
 * are paired: a run of played notes against a run of written ones is a passage
 * played differently, which is a larger claim than this should make on its own.
 *
 * Pairs are taken cheapest first, and each half may be used once, so the closest
 * reading wins and nothing is counted twice.
 */
function pairReplacements(
    played: PlayedGroup[],
    unplayed: UnplayedGroup[],
    map: { onset: number; ms: number }[],
    settings: typeof DEFAULTS
): { replaced: ReplacedDivergence[]; playedLeft: PlayedGroup[]; unplayedLeft: UnplayedGroup[] } {
    const candidates: {
        playedIndex: number;
        unplayedIndex: number;
        lateMs: number;
        semitones: number;
        cost: number;
    }[] = [];

    const singles = played
        .map((group, index) => ({ group, index }))
        .filter((entry) => entry.group.entries.length === 1);

    unplayed.forEach((group, unplayedIndex) => {
        if (group.entries.length !== 1) return;

        const written = group.entries[0].note;
        const due = expectedMs(written.onset, map);
        if (due === undefined) return;

        for (const { group: candidate, index: playedIndex } of singles) {
            const span = candidate.entries[0].span;
            const lateMs = span.onsetMs - due;
            const semitones = span.pitch - written.pitch;

            if (Math.abs(lateMs) > settings.replacementMs) continue;
            if (Math.abs(semitones) > settings.replacementSemitones) continue;

            candidates.push({
                playedIndex,
                unplayedIndex,
                lateMs,
                semitones,
                cost:
                    Math.abs(lateMs) / settings.replacementMs +
                    Math.abs(semitones) / (settings.replacementSemitones + 1),
            });
        }
    });

    candidates.sort((a, b) => a.cost - b.cost);

    const usedPlayed = new Set<number>();
    const usedUnplayed = new Set<number>();
    const replaced: ReplacedDivergence[] = [];

    for (const candidate of candidates) {
        if (usedPlayed.has(candidate.playedIndex)) continue;
        if (usedUnplayed.has(candidate.unplayedIndex)) continue;
        usedPlayed.add(candidate.playedIndex);
        usedUnplayed.add(candidate.unplayedIndex);

        const { insertion, span } = played[candidate.playedIndex].entries[0];
        const { deletion, note } = unplayed[candidate.unplayedIndex].entries[0];
        const { reading, because } = readReplaced(candidate.semitones, candidate.lateMs);

        replaced.push({
            kind: "replaced",
            id: `replaced-${unplayed[candidate.unplayedIndex].id}`,
            scoreId: note.note,
            perfId: span.id,
            pitches: [note.pitch, span.pitch],
            reading,
            because,
            onset: note.onset,
            onsetMs: span.onsetMs,
            lateMs: candidate.lateMs,
            confidence: Math.min(insertion.confidence, deletion.confidence),
        });
    }

    replaced.sort((a, b) => a.onsetMs - b.onsetMs);

    return {
        replaced,
        playedLeft: played.filter((_, index) => !usedPlayed.has(index)),
        unplayedLeft: unplayed.filter((_, index) => !usedUnplayed.has(index)),
    };
}

function readReplaced(
    semitones: number,
    lateMs: number
): { reading: ReplacedReading; because: string } {
    const where = `where the score writes it${
        Math.abs(lateMs) < 20 ? "" : `, ${Math.abs(lateMs).toFixed(0)} ms ${lateMs > 0 ? "late" : "early"}`
    }`;

    if (semitones === 0) {
        return {
            reading: "unmatched-pair",
            because:
                `The written note itself, played ${where}, which the aligner did not ` +
                `pair with it. Nothing was added and nothing left out; the alignment ` +
                `simply has a hole here.`,
        };
    }

    if (semitones % 12 === 0) {
        const octaves = Math.abs(semitones) / 12;
        return {
            reading: "octave-displaced",
            because:
                `The written note taken ${octaves === 1 ? "an octave" : `${octaves} octaves`} ` +
                `${semitones > 0 ? "higher" : "lower"}, played ${where}.`,
        };
    }

    if (Math.abs(semitones) <= 2) {
        return {
            reading: "neighbour-slip",
            because:
                `${intervalWords(semitones)} the written note, played ${where}. ` +
                `A neighbour struck instead of the note itself is the commonest slip there is.`,
        };
    }

    return {
        reading: "different-note",
        because: `${intervalWords(semitones)} the written note, played ${where}.`,
    };
}

/** How far off a substitute was, said in words rather than in semitones. */
function intervalWords(semitones: number): string {
    const distance = Math.abs(semitones);
    const size =
        distance === 1
            ? "A semitone"
            : distance === 2
              ? "A tone"
              : `${distance} semitones`;
    return `${size} ${semitones > 0 ? "above" : "below"}`;
}

/* -------------------------------------------------------------------------- */
/* Reading what is left                                                        */
/* -------------------------------------------------------------------------- */

interface AddedContext {
    anchors: Anchor[];
    firstMs: number;
    lastMs: number;
    simultaneousMs: number;
    figureNotes: number;
    hasRepeats: boolean;
}

function readPlayed(
    group: PlayedGroup,
    input: DivergenceInput,
    ctx: AddedContext
): AddedDivergence {
    const spans = group.entries.map((entry) => entry.span);
    const onsetMs = spans[0].onsetMs;
    const anchor = anchorFor(onsetMs, ctx.anchors);
    const signs = anchor ? input.signs.get(anchor.scoreId) ?? [] : [];

    const { reading, because } = readAdded(spans, anchor, signs, ctx);

    return {
        kind: "added",
        id: group.id,
        perfIds: spans.map((span) => span.id),
        pitches: spans.map((span) => span.pitch),
        anchorId: anchor?.scoreId ?? null,
        signs,
        reading,
        because,
        onsetMs,
        confidence: Math.min(...group.entries.map((entry) => entry.insertion.confidence)),
    };
}

/**
 * The written note a played note leans on: the last one struck at or before it.
 *
 * A figure that leans on the *following* note - a turn played just before the
 * beat it decorates - is left anchored to the note before it. The reader can see
 * both in the score and move it; guessing between the two on timing alone is
 * less honest than showing where the sound actually sits.
 */
function anchorFor(onsetMs: number, anchors: Anchor[]): Anchor | undefined {
    let low = 0;
    let high = anchors.length - 1;
    let found: Anchor | undefined;

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
    anchor: Anchor | undefined,
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
function nearAnchor(spans: NoteSpan[], anchor: Anchor): boolean {
    return spans.every((span) => Math.abs(span.pitch - anchor.pitch) <= 4);
}

interface MissingContext {
    /** Score moments the recording answered to at all */
    matchedOnsets: Set<number>;
    /** Whether the recording covers a moment, judged from the notes around it */
    coveredFrom: number;
    coveredTo: number;
}

function missingContextOf(
    input: DivergenceInput,
    scoreById: Map<string, ScoreNote>,
    covered: boolean
): MissingContext {
    const matchedOnsets = new Set<number>();
    let coveredFrom = Infinity;
    let coveredTo = -Infinity;

    for (const match of input.matches) {
        const note = scoreById.get(match.scoreId);
        if (!note) continue;
        matchedOnsets.add(note.onset);
        if (note.onset < coveredFrom) coveredFrom = note.onset;
        if (note.onset > coveredTo) coveredTo = note.onset;
    }

    return covered
        ? { matchedOnsets, coveredFrom, coveredTo }
        : { matchedOnsets, coveredFrom: Infinity, coveredTo: -Infinity };
}

function readUnplayed(group: UnplayedGroup, ctx: MissingContext): MissingDivergence {
    const notes = group.entries.map((entry) => entry.note);
    const onset = notes[0].onset;

    let reading: MissingReading;
    let because: string;

    if (onset < ctx.coveredFrom || onset > ctx.coveredTo) {
        reading = "outside";
        because =
            "Beyond where the recording reaches - the performer did not leave this out, " +
            "the recording does not cover it.";
    } else if (ctx.matchedOnsets.has(onset)) {
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
        kind: "missing",
        id: group.id,
        scoreIds: notes.map((note) => note.note),
        reading,
        because,
        onset,
        confidence: Math.min(...group.entries.map((entry) => entry.deletion.confidence)),
    };
}
