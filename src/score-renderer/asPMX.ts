import { JSDOM } from 'jsdom';
import { BarLine, BarLineType } from "./BarLine";
import { Clef, ClefType } from "./Clef";
import { KeySig } from "./KeySig";
import { Accid, ExtenderLine, NoteHeadType, Note as PMXNote, } from "./Note";
import { LineContainer, Group, TextData } from "./PMX";
import { Staff } from "./Staff";
import { InlineText, Font } from "./Text";
import { LibraryNumber, Symbol } from './Symbol';

const scale = (value: number, r1: [number, number], r2: [number, number]) => {
    return (value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0];
}

const generateNotePos = (pname: string, oct: number, clef: 'G' | 'F') => {
    const pnames = ['c', 'd', 'e', 'f', 'g', 'a', 'b']
    const shift = clef === 'G' ? 1 : 13
    return pnames.indexOf(pname) + ((oct - 4) * 7) + shift;
}

/**
 * Inserts a note with extender line (indicating the duration)
 * Both objects will be wrapped in a group of class 'note'.
 */
const insertNote = (
    pmx: LineContainer,
    note: RollNote,
    opacity: number
) => {
    // Keep the SVG directive short — pmx-to-eps truncates long text lines.
    // Skip data-id (long UUID) to stay within the line length limit.
    const attrs: [string, string][] = [
        ['opacity', opacity.toString()],
        ['class', 'note'],
    ]
    if (note.meiNoteId) {
        attrs.push(['data-mei-id', note.meiNoteId])
    }
    const group = new Group(attrs)
    pmx.insert(group)

    const clef = note.staff === 2 ? 'G' : 'F'
    const verticalPos = generateNotePos(note.pname, note.oct, clef)

    let accid: Accid = Accid.Normal
    if (note.accid === 'f') accid = Accid.Flat
    else if (note.accid === 's') accid = Accid.Sharp
    else if (note.accid === 'bb') accid = Accid.DoubelFlat
    else if (note.accid === 'x') accid = Accid.DoubleSharp

    group.insert(
        new PMXNote()
            .with('staff-no', note.staff)
            .with('horizontal', note.from)
            .with('vertical', verticalPos)
            .with('accid', accid)
            .with('notehead', NoteHeadType.Solid)
            .with('stem-length', -7)
            .with('extender-line', ExtenderLine.ExtenderLine)
            .with('extender-line-start', 0.001)
            .with('extender-line-end', note.to - note.from)
    )
}

/**
 * Inserts a tick every second
 */
const insertTicks = (pmx: LineContainer, highestStaff: number, stretch: number) => {
    // insert a tick every half second (500 ms)
    for (let x = 0; x <= 200; x += 500 * stretch) {
        const end = x % (1000 * stretch) === 0 ? 13 : 12;

        pmx.insert(
            new BarLine()
                .with('staff-no', highestStaff)
                .with('horizontal', x)
                .with('type', BarLineType.Normal)
                .with('thickness', 4)
                .with('origin', 11)
                .with('end', end)
        )
    }
}

const insertTickLabels = (
    container: LineContainer,
    staffNo: number,
    systemNo: number,
    stretch: number
) => {
    const positions = [
        { x: 0, label: `${(systemNo * 200) / stretch / 1000} s` },
    ]

    for (const { x, label } of positions) {
        container.insert(
            new InlineText()
                .with('staff-no', staffNo)
                .with('horizontal', x)
                .with('vertical', 13)
                .with('size', 0.8),
            new TextData(label, Font.TimesRoman)
        )
    }
}

interface RollNote {
    id: string
    meiNoteId?: string
    from: number
    to: number
    staff: number
    accid?: string
    pname: string
    oct: number
    velocity: number
}

interface Pedal {
    type: 'sustain' | 'soft'
    id: string
    from: number
    to: number
}

type AnyEvent = RollNote | Pedal

const parseAlignedMEI = (meiDoc: Document, stretch: number, padding: number = 0, recordingIndex: number = 0): AnyEvent[] => {
    const recordings = meiDoc.querySelectorAll('recording')
    const recording = recordings[recordingIndex] || recordings[0]
    const whens = recording
        ? Array.from(recording.querySelectorAll('when'))
        : Array.from(meiDoc.querySelectorAll('when'))
    const scoreNotes = Array.from(meiDoc.querySelectorAll('note'))

    const result: AnyEvent[] = []
    for (const when of whens) {
        // use the aligned MEI to determine the 
        // note's correct staff, pitch name and accidentals
        const from = when.getAttribute('absolute')?.replace('ms', '')
        const duration = when.querySelector('extData[type="duration"]')?.textContent?.replace('ms', '')
        const id = when.getAttribute('corresp')
        const vel = when.querySelector('extData[type="velocity"]')?.textContent

        if (!from || !duration || !id) continue

        const noteId = when.getAttribute('data')?.slice(1)
        if (!noteId) {
            const type = when.getAttribute('type')
            if (type === 'sustain' || type === 'soft') {
                const to = +from + +duration
                result.push({
                    type,
                    id,
                    from: +from * stretch + padding,
                    to: to * stretch + padding,
                })
            }
            continue
        }

        if (!vel) continue

        const noteEl = scoreNotes.find(note => note.getAttribute('xml:id') === noteId)
        if (!noteEl) continue

        const pname = noteEl.getAttribute('pname')
        const oct = noteEl.getAttribute('oct')
        if (!pname || !oct) continue

        const nAttr = noteEl.closest("staff")?.getAttribute("n")
        const staff = nAttr ? 2 - Number(nAttr) + 1 : 1
        const accid = noteEl.getAttribute('accid') || noteEl.querySelector('accid')?.getAttribute('accid') || undefined

        const to = +from + +duration

        result.push({
            id,
            meiNoteId: noteId,
            from: +from * stretch + padding,
            to: to * stretch + padding,
            pname,
            oct: +oct,
            accid,
            staff,
            velocity: +vel,
        })
    }

    result.sort((a, b) => a.from - b.from)

    return result
}

type System = AnyEvent[]

const splitEventsIntoSystems = (events: AnyEvent[]): System[] => {
    const result: System[] = []

    const appendTo = (systemNo: number, note: AnyEvent) => {
        // console.log('system no', systemNo, note)
        if (systemNo > result.length - 1) {
            for (let i = result.length - 1; i <= systemNo; i++) {
                result.push([])
            }
        }
        result[systemNo].push(note)
    }

    const interval = 200
    for (const note of events) {
        const systemStart = Math.floor(note.from / interval)
        const systemEnd = Math.floor(note.to / interval)

        note.from %= interval
        note.to %= interval

        if (systemStart === systemEnd) {
            appendTo(systemStart, note)
        }
        else {
            // split 
            const left = { ...note }
            left.to = 200

            const right = { ...note }
            right.from = 0

            appendTo(systemStart, left)
            appendTo(systemEnd, right)
        }
    }

    return result
}

/** Count the number of <recording> elements in an MEI string. */
export const countRecordings = (alignedMEI: string): number => {
    const meiDOM = new JSDOM(alignedMEI, { contentType: "text/xml" })
    return meiDOM.window.document.querySelectorAll('recording').length
}

export const asPMX = (
    alignedMEI: string,
    recordingIndex: number = 0
) => {
    const meiDOM = new JSDOM(alignedMEI, { contentType: "text/xml" })
    const meiDoc = meiDOM.window.document

    // mm on role => x position in score
    const stretch = 0.02
    const padding = 20

    const notes = parseAlignedMEI(
        meiDoc,
        stretch,
        padding,
        recordingIndex
    )

    const staffDef = meiDoc.querySelector('staffDef[keysig]')
    let keySig = 0
    if (staffDef) {
        const attr = staffDef.getAttribute('keysig')
        if (attr) {
            if (attr.endsWith('f')) keySig = -Number(attr.replace('f', ''))
            else if (attr.endsWith('s')) keySig = Number(attr.replace('s', ''))
        }
    }

    const systems = splitEventsIntoSystems([
        ...notes,
    ])

    const pmxs: LineContainer[] = []

    enum Staves {
        UpperMusic = 2,
        LowerMusic = 1
    }

    for (let i = 0; i < systems.length; i++) {
        const pmx = new LineContainer()

        // insert the two staves
        pmx.insert(
            new Staff()
                .with('staff-no', Staves.UpperMusic)
                .with('right-horizontal', 200)
                .with('lines', 5),
            new Staff()
                .with('staff-no', Staves.LowerMusic)
                .with('right-horizontal', 200)
                .with('lines', 5),
        )

        // only on the first staff, insert clefs and key signatures
        if (i === 0) {
            pmx.insert(
                new Clef()
                    .with('staff-no', Staves.UpperMusic)
                    .with('type', ClefType.Treble),
                new KeySig()
                    .with('staff-no', Staves.UpperMusic)
                    .with('number-accidentals', keySig)
                    .with('clef-type', ClefType.Treble)
                    .with('horizontal', 13)
            )

            pmx.insert(
                new Clef()
                    .with('staff-no', Staves.LowerMusic)
                    .with('type', ClefType.Bass),
                new KeySig()
                    .with('staff-no', Staves.LowerMusic)
                    .with('number-accidentals', keySig)
                    .with('clef-type', ClefType.Bass)
                    .with('horizontal', 13)
            )
        }

        // Insert a barline through all the systems right  at the 
        // beginning of each stave and a brace for the musical staves
        pmx.insert(
            new BarLine()
                .with('staff-no', Staves.LowerMusic)
                .with('staves', 2),

            new BarLine()
                .with('staff-no', Staves.LowerMusic)
                .with('staves', 2)
                .with('type', BarLineType.Brace)
        )

        for (const note of systems[i]) {
            if ('pname' in note) {
                // calculate the opacity based on the velocity
                const velocity = note.velocity
                const opacity = scale(velocity, [10, 70], [0.1, 1])
                insertNote(
                    pmx,
                    note as RollNote,
                    opacity
                )
            }
        }

        // Draw orientation ticks and labels above the staves
        {
            const group = new Group([
                ['class', 'orientation']
            ])

            insertTicks(group, Staves.UpperMusic, stretch)
            insertTickLabels(group, Staves.UpperMusic, i, stretch)

            pmx.insert(group)
        }

        const pedalEvents = systems[i]
            .filter((e): e is Pedal => 'type' in e && (e.type === 'sustain' || e.type === 'soft'))

        for (const pedalEvent of pedalEvents.filter(e => e.type === 'sustain')) {
            // TODO: link corresponding on and off events. 
            // Note that putting them into a group will not work,
            // pedal groups can occur across system boundaries.
            pmx.insert(
                new Symbol()
                    .with('staff-no', Staves.LowerMusic)
                    .with('horizontal', pedalEvent.from % 200)
                    .with('vertical', -3)
                    .with('symbol', LibraryNumber.Pedal)
                    .with('size', 0.8)
            )

            pmx.insert(
                new Symbol()
                    .with('staff-no', Staves.LowerMusic)
                    .with('horizontal', pedalEvent.to % 200)
                    .with('vertical', -3)
                    .with('symbol', LibraryNumber.PedalOff)
                    .with('size', 0.8)
            )
        }

        pmxs.push(pmx)
    }

    return pmxs
}
