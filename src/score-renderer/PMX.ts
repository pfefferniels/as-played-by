import { BarLine } from './BarLine';
import { Clef } from './Clef';
import { KeySig } from './KeySig';
import { Line } from './Line';
import { Note } from './Note';
import { Staff } from './Staff';
import { Symbol } from './Symbol'
import { Font, InlineText } from './Text';

/**
 * Represents a single line in a PMX file.
 */
export class PMXLine<TFields> {
    /**
     * Represents the type of the object, e. g. '0' represents a note, '1' a line etc.
     */
    protected code: number | string

    /**
     * Maps parameter names to their index in the data array.
     * The horizontal position e. g. is usually P3, so the
     * map would contain ['horizontal', 3]. 
     */
    protected map: Map<keyof TFields, number> = new Map() // [name, parameter index]

    /**
     * The actual data of the line: [P1, P2, P3, ...]
     */
    private data: number[] = []

    constructor(code: number | string, entries: [keyof TFields, number][]) {
        this.code = code;
        this.map = new Map(entries);
    }

    /**
     * Used to set a parameter of the line, e.g. `with('horizontal', 100)` 
     * will set the horizontal position of the line to 100. Returns itself, 
     * so you can chain calls.
     */
    public with<K extends keyof TFields>(name: K, value: TFields[K]) {
        if (!this.map.has(name)) {
            throw new Error(`Parameter ${String(name)} not found`)
        }

        const index = this.map.get(name)! - 1

        if (index >= this.data.length) {
            while (this.data.length <= index) {
                this.data.push(0)
            }
        }

        if (isNaN(value as number)) {
            throw new Error(`Value for ${String(name)} (${String(value)}) is not a number`)
        }

        this.data[index - 1] += value as number

        return this
    }

    public flat() {
        return `${this.code} ${this.data.join(' ')}`
    }
}

export class TextData {
    public text: string
    public font: Font

    // Cf. p. 158 of the reference manual
    private replaceSpecialChars(value: string) {
        value = value.replace(/ä/g, '%%a');
        value = value.replace(/Ä/g, '%%A');
        value = value.replace(/ö/g, '%%o');
        value = value.replace(/Ö/g, '%%O');
        value = value.replace(/ü/g, '%%u');
        value = value.replace(/Ü/g, '%%U');
        value = value.replace(/ß/g, '?s');

        let on = false
        for (let i = 0; i < value.length; i++) {
            if (value[i] === '"') {
                value = value.substring(0, i) + (on ? '!g' : '!h') + value.substring(i + 1)
                on = !on
                i += 2
            }
        }

        return value;
    }

    constructor(text: string, font: Font, replaceSpecialChars = true) {
        this.text = replaceSpecialChars ? this.replaceSpecialChars(text) : text
        this.font = font
    }

    public flat() {
        // Cf. SCORE reference manual, p. 143
        return `_${this.font.toString().padStart(2, '0')}${this.text}`
    }
}

type AnyEntry = 
    | Note
    | Clef
    | KeySig
    | Staff
    | BarLine
    | InlineText
    | Symbol
    | Line

export class LineContainer {
    public lines: (AnyEntry | TextData | Group)[] = []

    public insert(...toInsert: (AnyEntry | TextData | Group)[]) {
        this.lines.push(...toInsert)
    }

    /**
     * Returns the lines and possible subgroups as a flat array.
     * 
     * @returns {string[]} Flattened lines
     */
    public flat() {
        return this.lines.map(line => line.flat()).flat()
    }

    public append(container: LineContainer) {
        this.lines.push(...container.lines)
    }
}

export class Group extends LineContainer {
    public attributes: Map<string, string> = new Map([])

    constructor(entries: [string, string][]) {
        super()
        this.attributes = new Map(entries)
    }

    public with(name: string, value: string) {
        this.attributes.set(name, value)
    }

    public flat() {
        const pairs = []
        for (const [k, v] of this.attributes) {
            pairs.push(`${k}="${v}"`)
        }
    
        const result: string[] = []
        result.push(`t 1 1\n_99%svg%<g ${pairs.join(' ')}>`)
        result.push(...this.lines.map(l => l.flat()).flat())
        result.push(`t 1 1\n_99%svg%<\\g>`)

        return result
    }
}

export const serialize = (pmx: LineContainer) => {
    return pmx.flat().join('\n')
}