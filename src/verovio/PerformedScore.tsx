import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { VerovioToolkit } from "verovio/esm";
import { loadVerovio, renderPerformance, type ScoreOptions } from "./toolkit";
import { clearExtenders, drawExtenders } from "./extenders";
import { midiPitch } from "../pitch";

/** What the rendered SVG says about one note of the performance */
export interface PerformedNote {
    /** The xml:id of the note in the MEI */
    id: string;
    /** Onset in milliseconds from the start of the recording */
    onsetMs?: number;
    offsetMs?: number;
    velocity?: number;
    /** True when the recording has no <when> for this note and it was interpolated */
    unaligned: boolean;
    pitch?: number;
}

/**
 * Read a note back out of the rendered score. The performed values come from the
 * data-perf-* attributes the toolkit writes, the pitch from the notated one.
 */
export function readPerformedNote(element: Element): PerformedNote | undefined {
    const id = element.getAttribute("data-id");
    if (!id) return undefined;

    const number = (name: string) => {
        const value = element.getAttribute(name);
        return value === null ? undefined : Number(value);
    };

    return {
        id,
        onsetMs: number("data-perf-onset"),
        offsetMs: number("data-perf-offset"),
        velocity: number("data-perf-velocity"),
        unaligned: element.hasAttribute("data-perf-unaligned"),
        pitch: midiPitch(
            element.getAttribute("data-pname"),
            element.getAttribute("data-oct"),
            element.getAttribute("data-accid") ?? element.getAttribute("data-accid.ges")
        ),
    };
}

interface PerformedScoreProps {
    mei: string;
    /** Overrides of the defaults in ./toolkit */
    options?: Partial<ScoreOptions>;
    onNoteClick?: (note: PerformedNote, element: SVGElement) => void;
    onNoteHover?: (note: PerformedNote, element: SVGElement) => void;
    /** Draw a line from each notehead to the point the note was released at */
    extenders?: boolean;
    className?: string;
}

/**
 * The score of a <recording>, laid out along the time it was performed in. All
 * of that happens inside verovio (see vendor/verovio/README.md); this only feeds
 * it the MEI and hands the rendered notes back to the caller.
 */
export const PerformedScore = ({
    mei,
    options,
    onNoteClick,
    onNoteHover,
    extenders,
    className,
}: PerformedScoreProps) => {
    const [pages, setPages] = useState<string[]>([]);
    const [error, setError] = useState<string>();
    const [rendering, setRendering] = useState(true);

    const toolkit = useRef<Promise<VerovioToolkit>>(undefined);
    const container = useRef<HTMLDivElement>(null);

    // The options are an object literal at every call site, so the render is keyed
    // on their content rather than on their identity
    const optionsKey = JSON.stringify(options ?? {});

    useEffect(() => {
        let current = true;
        setRendering(true);

        toolkit.current ??= loadVerovio();
        toolkit.current
            .then((toolkit) => {
                if (!current) return;
                setPages(renderPerformance(toolkit, mei, JSON.parse(optionsKey)));
                setError(undefined);
            })
            .catch((reason: unknown) => current && setError(String(reason)))
            .finally(() => current && setRendering(false));

        return () => {
            current = false;
        };
    }, [mei, optionsKey]);

    // The extenders are drawn from what the rendered notes say about themselves,
    // so they are added once the pages are in the document
    useLayoutEffect(() => {
        if (!container.current) return;

        if (extenders) drawExtenders(container.current, JSON.parse(optionsKey));
        else clearExtenders(container.current);
    }, [pages, extenders, optionsKey]);

    const noteHandler = (
        handler?: (note: PerformedNote, element: SVGElement) => void
    ) => {
        if (!handler) return undefined;

        return (event: React.MouseEvent<HTMLDivElement>) => {
            const element = (event.target as Element).closest?.(".note");
            if (!element) return;

            const note = readPerformedNote(element);
            if (note) handler(note, element as SVGElement);
        };
    };

    if (error) return <p style={{ color: "red" }}>{error}</p>;

    return (
        <div
            ref={container}
            className={className}
            // Sized to the music rather than to the viewport, so that a score wider
            // than the window is scrolled to rather than cut off
            style={{ width: "max-content", opacity: rendering ? 0.5 : 1 }}
            onClick={noteHandler(onNoteClick)}
            onMouseOver={noteHandler(onNoteHover)}
        >
            {pages.map((page, index) => (
                <div key={index} dangerouslySetInnerHTML={{ __html: page }} />
            ))}
        </div>
    );
};
