import { VerovioToolkit } from "verovio/esm"

export type ScoreEvent = {
    type: 'rest' | 'note' | 'sustain' | 'soft',
    tstamp: number,
    id: string
    pitch?: number
}

const isEndOfTie = (mei: Document, noteId: string) => {
    return mei.querySelector(`tie[endid="#${noteId}"]`)
}


export const prepareScoreEvents = (mei: Document, vrvToolkit: VerovioToolkit, ignorePedals = true) => {
    const timemap = vrvToolkit.renderToTimemap({ includeRests: true })

    let orderedScoreEvents: ScoreEvent[] = []

    for (const entry_ of timemap) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entry = entry_ as any
        console.log(entry)

        if (!entry.on) continue
        for (const id of entry.on) {
            orderedScoreEvents.push({
                type: 'note',
                tstamp: entry.tstamp,
                pitch: vrvToolkit.getMIDIValuesForElement(id).pitch,
                id
            })
        }

        if (!entry.restsOn) continue
        for (const id of entry.restsOn) {
            orderedScoreEvents.push({
                type: 'rest',
                tstamp: entry.tstamp,
                id
            })
        }
    }

    if (!ignorePedals) {
        const pedals = mei.querySelectorAll('pedal')
        for (const pedal of pedals) {
            const startid = pedal.getAttribute('startid')
            if (!startid) {
                console.log('Pedal without startid found', pedal)
                continue
            }

            let correspTstamp = orderedScoreEvents.find(e => e.id === startid.slice(1))?.tstamp
            if (!correspTstamp) {
                // Maybe a rest?
                correspTstamp = vrvToolkit.getTimesForElement(startid.slice(1))?.scoreTimeOnset
                if (!correspTstamp) {
                    console.log('No corresponding element found for', startid)
                    continue
                }
            }

            orderedScoreEvents.push({
                id: pedal.getAttribute('xml:id') || Math.random().toString(),
                type: (pedal.getAttribute('func') || 'sustain') as 'sustain' | 'soft',
                tstamp: correspTstamp,
            })
        }
    }

    orderedScoreEvents = orderedScoreEvents
        .filter(e => e.type !== 'rest')
        .filter(e => !(e.type === 'note' && isEndOfTie(mei, e.id)))
        .sort((a, b) => a.tstamp - b.tstamp)

    return orderedScoreEvents
}
