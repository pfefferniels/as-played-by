import { AnySpan } from "./MidiSpans";
import { ScoreEvent } from "./ScoreEvents";

export class PairQueue {
    scoreEvents: ScoreEvent[] = []
    midiEvents: AnySpan[] = []

    alignedPairs: [ScoreEvent, AnySpan][] = []

    get nextPair(): [ScoreEvent, AnySpan] | null {
        if (this.scoreEvents.length === 0 || this.midiEvents.length === 0) return null

        const reference = this.midiEvents.shift()!
        const corresp =
            reference.type === 'note'
                ? this.scoreEvents.find(e => e.type === 'note' && e.pitch === reference.pitch)
                : this.scoreEvents.find(e => e.type === reference.type)
        
        if (!corresp) return this.nextPair

        this.scoreEvents.splice(this.scoreEvents.indexOf(corresp), 1)

        const pair: [ScoreEvent, AnySpan] = [corresp, reference]
        this.alignedPairs.push(pair)

        return pair
    }

    ignoreScoreEvent() {
        this.scoreEvents.shift()
    }
}

