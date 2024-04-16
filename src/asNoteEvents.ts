/* eslint-disable @typescript-eslint/no-explicit-any */

import { loadVerovio } from "./loadVerovio.mts";
import { Midi } from 'tonal'

const findDenominator = function (dec: number) {
    dec = Math.abs(dec);
    let done = false;
    let num = 0;
    let den = 0;
    //you can adjust the epsilon to a larger number if you don't need very high precision
    let n1 = 0, d1 = 1, n2 = 1, d2 = 0, n = 0, q = dec
    const epsilon = 1e-13;
    while (!done) {
        n++;
        if (n > 10000) {
            done = true;
        }
        const a = parseInt(q.toString())
        num = n1 + a * n2;
        den = d1 + a * d2;
        const e = (q - a);
        if (e < epsilon) {
            done = true;
        }
        q = 1 / e;
        n1 = n2;
        d1 = d2;
        n2 = num;
        d2 = den;
        if (Math.abs(num / den - dec) < epsilon || n > 30) {
            done = true;
        }
    }
    return den
};

function gcd(a: number, b: number): number {
    while (b !== 0) {
        let temp = b;
        b = a % b;
        a = temp;
    }
    return Math.abs(a);
}

function lcm(numbers: number[]): number {
    return numbers.reduce((acc, current) => {
        return (acc * current) / gcd(acc, current);
    }, 1);
}

export const asNoteEvents = async (mei: Document): Promise<any[]> => {
    const vrvToolkit = await loadVerovio()
    vrvToolkit.loadData(new XMLSerializer().serializeToString(mei))
    const timemap = vrvToolkit.renderToTimemap()

    const result: any[] = []

    for (const event of timemap) {
        if (!event.on || !event.on.length) continue

        for (const on of event.on) {
            const midiValues = vrvToolkit.getMIDIValuesForElement(on)

            // prepare the voice parameter
            const note = Array.from(mei.querySelectorAll('note')).find(el => el.getAttribute('xml:id') === on)
            if (!note) continue

            const staff = note.closest('staff')
            const layer = note.closest('layer')
            if (!staff || !layer) continue

            const voice = (Number(staff.getAttribute('n')) - 1) + Number(layer.getAttribute('n'))

            // ignore the note if its tied
            if (mei.querySelector(`tie[endid='#${on}']`)) {
                continue
            }

            const times = vrvToolkit.getTimesForElement(on)
            // console.log('times=', times)

            result.push({
                scoreTime: event.qstamp,
                staff: +(staff?.getAttribute('n') || '0'),
                voice,
                suborder: 0,
                type: 'chord',
                duration: times.scoreTimeDuration + times.scoreTimeTiedDuration,
                sitches: [Midi.midiToNoteName(midiValues.pitch)],
                notetypes: ['N..'],
                ids: [on]
            })
        }
    }

    const lowestMultiplier = lcm(result.map(n => findDenominator(n.scoreTime)))
    result.forEach((note: any) => {
        note.scoreTime *= lowestMultiplier
        note.duration *= lowestMultiplier
    })

    return result
}
