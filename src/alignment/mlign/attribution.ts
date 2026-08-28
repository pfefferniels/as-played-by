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
 *
 * And on real playing it behaves differently again, which is why this returns
 * two numbers rather than one. Measured against the two trills Chopin's op. 9
 * no. 1 actually notates, on a recording of it: of the twelve played notes those
 * two figures come to, the head ranks the right written note first for six, and
 * on all but one of those it still puts most of its mass on the note not being
 * an ornament at all. The ranking is worth having; the "not an ornament" column,
 * on this material, is not what it was on the corpus.
 */

import type { SimBundle } from "./types";
import { UNCOVERED_SIM } from "./types";

/**
 * What the head says about one played note.
 *
 * Two numbers, because the head is answering two questions at once and they come
 * apart badly in practice. `confidence` is the softmax over the whole row, so it
 * is "this is an ornament, and it is that note's". `share` conditions on the
 * first half: of the mass the head did put on ornamenting *something*, how much
 * sits on this one written note.
 *
 * They come apart because the head's "not an ornament" column is the confident
 * one. On a real recording it can rank the right principal first, decisively,
 * and still put four fifths of its mass on the note not being an ornament at all.
 * Collapsing that into one number throws away the half that was right, so both
 * are handed on and the caller decides what each is worth.
 */
export interface Attributed {
    /** Index into the score table of the note it most likely ornaments. */
    scoreIdx: number;
    /** Softmax over the whole row, "not an ornament" included. */
    confidence: number;
    /** That note's share of the mass on ornamenting anything at all. */
    share: number;
}

/**
 * Read the head for every played note it was asked about.
 *
 * Nothing is filtered here, deliberately. What counts as sure enough is an
 * editorial question, not a model one, and it is answered in
 * `../divergences` where the rest of the evidence about a note is - not least
 * whether the score writes an ornament sign on the very note the head named.
 *
 * A played note no window covered is absent: no window looked at it, so the head
 * did not decline to attribute it, it was never asked.
 */
export function attributionsOf(bundle: SimBundle): Map<number, Attributed> {
    const { n, m, attr, attrNone } = bundle;
    const found = new Map<number, Attributed>();
    if (!attr || !attrNone) return found;

    for (let j = 0; j < m; j++) {
        const off = j * n;
        const none = attrNone[j];
        if (none <= UNCOVERED_SIM) continue;

        let best = -1;
        let bestLogit = -Infinity;
        for (let i = 0; i < n; i++) {
            const logit = attr[off + i];
            if (logit > UNCOVERED_SIM && logit > bestLogit) {
                bestLogit = logit;
                best = i;
            }
        }

        if (best < 0) continue;

        // Softmaxed against the largest logit in the row, which is what keeps
        // the sum from overflowing on a long piece.
        const top = Math.max(bestLogit, none);
        let overScore = 0;
        for (let i = 0; i < n; i++) {
            const logit = attr[off + i];
            if (logit > UNCOVERED_SIM) overScore += Math.exp(logit - top);
        }
        const noneWeight = Math.exp(none - top);
        const bestWeight = Math.exp(bestLogit - top);

        found.set(j, {
            scoreIdx: best,
            confidence: bestWeight / (overScore + noneWeight),
            share: bestWeight / overScore,
        });
    }

    return found;
}
