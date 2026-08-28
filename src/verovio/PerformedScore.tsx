import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { VerovioToolkit } from "verovio/esm";
import { loadVerovio, renderPerformance, type ScoreOptions } from "./toolkit";
import { clearExtenders, drawExtenders } from "./extenders";
import { readPerformedNote, type PerformedNote } from "./performedNote";

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
    /** What the pages currently in state were rendered from */
    const [rendered, setRendered] = useState<{ mei: string; optionsKey: string }>();

    const toolkit = useRef<Promise<VerovioToolkit>>(undefined);
    const container = useRef<HTMLDivElement>(null);

    // The options are an object literal at every call site, so the render is keyed
    // on their content rather than on their identity
    const optionsKey = JSON.stringify(options ?? {});

    // Dimmed while what is on screen is not yet what the props ask for. Read off
    // the props rather than set from the effect, so that a score dims on the very
    // render that receives it instead of one paint of stale music later
    const rendering = rendered?.mei !== mei || rendered.optionsKey !== optionsKey;

    useEffect(() => {
        let current = true;

        toolkit.current ??= loadVerovio();
        toolkit.current
            .then((toolkit) => {
                if (!current) return;
                setPages(renderPerformance(toolkit, mei, JSON.parse(optionsKey)));
                setError(undefined);
            })
            .catch((reason: unknown) => current && setError(String(reason)))
            .finally(() => current && setRendered({ mei, optionsKey }));

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
