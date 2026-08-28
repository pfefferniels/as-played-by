/**
 * Which written note a played note ornaments, read out of the attribution head.
 *
 * The question the aligner cannot answer. A trill's eleven notes come back from
 * every aligner in this field - Nakamura, TheGlueNote, parangonar - as one match
 * and ten insertions belonging to nothing, and the notes themselves say nothing
 * about which written note they decorate. MLign v2 carries a second bilinear
 * head trained to answer exactly that, and this is the whole of reading it.
 *
 * It is deliberately its own map rather than a reuse of the match similarity:
 * the match head is trained to send an ornament note to the null column, so the
 * same score note cannot rank highly in both. Which is also why an answer here
 * is not evidence about the alignment and must never be fed back into it.
 *
 * What it was trained on bears saying plainly, because it bounds how far the
 * answer should be trusted. Supervision comes only from espressivo-rendered
 * performances, where every ornament note's provenance is known. No corpus of
 * real playing annotates ornament attribution at all - not ASAP, not Vienna
 * 4x22, not Batik - so the head has never been asked about a real trill with a
 * known answer. On held-out synthetic material it places 94% of ornament notes
 * on the right principal, and gets the whole figure exactly right 83% of the
 * time; under a distribution shift beyond its training settings that falls to
 * 89% and 70%. Good enough to propose with, nowhere near good enough to decide
 * with, which is why nothing here writes anything into a score.
 */

import type { SimBundle } from "./types";
import { UNCOVERED_SIM } from "./types";

/** What the head says about one played note. */
export interface Attributed {
    /** Index into the score table of the note it ornaments. */
    scoreIdx: number;
    /** Softmax over the row, so it is comparable across notes. */
    confidence: number;
}

/**
 * How sure the head has to be before its answer is worth showing.
 *
 * The row is a softmax over every written note plus "not an ornament", so on a
 * long piece a genuinely uncertain note spreads its mass thinly and lands well
 * below this. The threshold is not a claim about calibration; it is there so
 * that a figure the head has no opinion about falls back on the timing rather
 * than being pinned to whichever written note edged the others out.
 */
export const ATTRIBUTION_CONF = 0.35;

/**
 * Read the head for every played note.
 *
 * The last column is "not an ornament", and it wins for the overwhelming
 * majority of played notes: most notes are notes, not decoration. Those are
 * absent from the result rather than present with a null, so that the map's size
 * is the number of ornament notes found and nothing has to be filtered later.
 *
 * A played note no window covered has the sentinel across its whole row and is
 * skipped: no window looked at it, so the head did not decline to attribute it,
 * it was never asked.
 */
export function attributionsOf(
    bundle: SimBundle,
    minConfidence: number = ATTRIBUTION_CONF
): Map<number, Attributed> {
    const { n, m, attr, attrNone } = bundle;
    const found = new Map<number, Attributed>();
    if (!attr || !attrNone) return found;

    for (let j = 0; j < m; j++) {
        const off = j * n;
        const none = attrNone[j];
        if (none <= UNCOVERED_SIM) continue;

        let best = -1;
        let bestLogit = none;
        for (let i = 0; i < n; i++) {
            const logit = attr[off + i];
            if (logit > bestLogit) {
                bestLogit = logit;
                best = i;
            }
        }

        if (best < 0) continue;

        // Softmax over the row, taken against the same maximum the argmax found,
        // which is what keeps it from overflowing on a long piece.
        let total = Math.exp(none - bestLogit);
        for (let i = 0; i < n; i++) {
            const logit = attr[off + i];
            if (logit > UNCOVERED_SIM) total += Math.exp(logit - bestLogit);
        }

        const confidence = 1 / total;
        if (confidence >= minConfidence) found.set(j, { scoreIdx: best, confidence });
    }

    return found;
}
