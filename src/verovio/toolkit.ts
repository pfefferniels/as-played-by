import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import type { VerovioOptions } from "verovio";

/**
 * The options of the vendored verovio fork, which lays a score out along the
 * performed time of a <recording> instead of along notated durations. They are
 * not part of @types/verovio; see vendor/verovio/README.md.
 */
export interface PerformanceOptions {
    /** Take the position of each note from <performance> rather than from its duration */
    performanceAlignment?: boolean;
    /** The <recording> to lay out: a 1-based index, an @xml:id or a @source */
    performanceRecording?: string;
    /** The width given to one second of performed time, in MEI units */
    performanceScale?: number;
    /** The performed duration of one system in seconds; 0 puts everything on one system */
    performanceSystemDuration?: number;
    /** What to do with notes the recording has no <when> for */
    performanceUnmatched?: "mark" | "plain" | "hide";
    /** Render the velocity of each note as ink density */
    performanceVelocityOpacity?: boolean;
    /** The velocity rendered faintest, or -1 to take it from the recording */
    performanceVelocityMin?: number;
    /** The velocity rendered fully opaque, or -1 to take it from the recording */
    performanceVelocityMax?: number;
    /** Draw a ruler of the performed time below each system */
    performanceRuler?: boolean;
    /** The spacing of the ruler ticks, in seconds */
    performanceRulerInterval?: number;
}

export type ScoreOptions = VerovioOptions & PerformanceOptions;

/**
 * The MEI units given to one second of performed time.
 *
 * Every view that offers a zoom starts here, so that a score opens at the same
 * size everywhere and the slider only ever moves away from one known default.
 */
export const DEFAULT_PERFORMANCE_SCALE = 16;

/**
 * How a performance is rendered unless a caller says otherwise. Everything a
 * component wants to vary is passed as an override of these, so that the option
 * names stay the ones verovio itself uses.
 */
export const defaultOptions: ScoreOptions = {
    adjustPageHeight: true,
    // Without this the page keeps its default width while the music runs on past
    // it, which a system holding a whole performance does by a long way
    adjustPageWidth: true,
    // The page is trimmed to the music, which does not know about the ruler drawn
    // below it - this keeps its labels on the page
    pageMarginBottom: 150,
    pageMarginRight: 100,
    header: "none",
    scale: 70,
    // The data-* attributes carrying the performed time are only emitted for HTML5 SVG
    svgHtml5: true,
    svgAdditionalAttribute: [
        "note@pname",
        "note@oct",
        "note@accid",
        "note@accid.ges",
        "measure@n",
    ],
    appXPathQuery: ['./rdg[contains(@source, "performance")]'],
    performanceAlignment: true,
    performanceScale: DEFAULT_PERFORMANCE_SCALE,
    performanceSystemDuration: 10,
    performanceUnmatched: "mark",
    performanceVelocityOpacity: true,
    performanceRuler: true,
};

/**
 * The WebAssembly module is several megabytes, so it is instantiated once and
 * shared; a toolkit on top of it is cheap and is what callers hold on to.
 */
let modulePromise: ReturnType<typeof createVerovioModule> | undefined;

export async function loadVerovio(): Promise<VerovioToolkit> {
    modulePromise ??= createVerovioModule();
    return new VerovioToolkit(await modulePromise);
}

/** Render the whole performance: one SVG per page, in the order they are laid out. */
export function renderPerformance(
    toolkit: VerovioToolkit,
    mei: string,
    options?: Partial<ScoreOptions>
): string[] {
    // setOptions only adds to what the toolkit already holds, so an option a
    // previous render set would otherwise linger into this one
    toolkit.resetOptions();
    toolkit.setOptions({ ...defaultOptions, ...options });
    if (!toolkit.loadData(mei)) {
        throw new Error("Verovio could not read the MEI");
    }

    const pages: string[] = [];
    for (let page = 1; page <= toolkit.getPageCount(); page++) {
        pages.push(toolkit.renderToSVG(page));
    }
    return pages;
}

/**
 * How many MEI units one second of performed time covers, i.e. the scale of the
 * horizontal axis everything drawn into the score has to follow.
 */
export function unitsPerSecond(options?: Partial<ScoreOptions>): number {
    const { performanceScale = 16, unit = 9 } = { ...defaultOptions, ...options };

    // verovio spaces the staff at `unit` MEI units, which are ten of the units the
    // SVG is drawn in
    return performanceScale * unit * 10;
}

/**
 * How many pixels one second covers once the page has been scaled down for the
 * SVG. Anything drawn next to the score - a piano roll of the recording, say -
 * has to follow the same axis.
 */
export function pixelsPerSecond(options?: Partial<ScoreOptions>): number {
    const { scale = 100 } = { ...defaultOptions, ...options };

    return (unitsPerSecond(options) * scale) / 1000;
}

/** The distance between two staff lines, in the units the SVG is drawn in */
export function staffSpace(options?: Partial<ScoreOptions>): number {
    const { unit = 9 } = { ...defaultOptions, ...options };

    return unit * 20;
}
