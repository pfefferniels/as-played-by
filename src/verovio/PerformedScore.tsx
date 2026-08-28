import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { VerovioToolkit } from "verovio/esm";
import { loadVerovio, renderPerformance, type ScoreOptions } from "./toolkit";
import { clearExtenders, drawExtenders } from "./extenders";
import { clearExtraNotes, drawExtraNotes, type ExtraNote } from "./extraNotes";
import { clearOmissionMarks, drawOmissionMarks, type OmittedGroup } from "./omissionMarks";
import { readPerformedNote, type PerformedNote } from "./performedNote";

/** The classes this component draws with, which its observer must not react to. */
const DRAWN = ["performanceExtender", "performanceExtraNote", "performanceOmission"];

const isOurs = (node: Node) =>
    node.nodeType === 1 && DRAWN.some((name) => (node as Element).classList?.contains(name));

/** Whether a mutation is the drawing's own work rather than a new render. */
const isDrawing = (record: MutationRecord) =>
    [...record.addedNodes].every(isOurs) && [...record.removedNodes].every(isOurs);

interface PerformedScoreProps {
    mei: string;
    /** Overrides of the defaults in ./toolkit */
    options?: Partial<ScoreOptions>;
    onNoteClick?: (note: PerformedNote, element: SVGElement) => void;
    onNoteHover?: (note: PerformedNote, element: SVGElement) => void;
    /** Draw a line from each notehead to the point the note was released at */
    extenders?: boolean;
    /** Played notes with no note in the score, drawn where they were played */
    extraNotes?: readonly ExtraNote[];
    /** Written notes the recording passes over, bracketed where they are crowded */
    omissions?: readonly OmittedGroup[];
    /** The key the extra notes are spelled in */
    tonic?: string;
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
    extraNotes,
    omissions,
    tonic,
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

    /**
     * Everything drawn on top of verovio's own markup: the extender lines, and
     * the played notes that have no note in the score. Both are measured from
     * notes verovio has placed, so neither can be drawn until it has.
     *
     * They are also redrawn whenever that markup is replaced. React re-inserts
     * the rendered SVG whole when the document changes, which silently detaches
     * anything drawn into it; keying this on the props alone left a score whose
     * lines and crosses had simply disappeared, with nothing to say they ever
     * existed. The observer ignores the drawing's own mutations, or it would
     * trigger itself for ever.
     */
    useLayoutEffect(() => {
        const root = container.current;
        if (!root) return;

        const options = JSON.parse(optionsKey);
        const draw = () => {
            if (extenders) drawExtenders(root, options);
            else clearExtenders(root);

            // Before the crosses, which measure against the notes verovio placed:
            // a bracketed group is taken out of sight but not out of the layout,
            // so it still has a position to measure from
            if (omissions?.length) drawOmissionMarks(root, omissions, options);
            else clearOmissionMarks(root);

            if (extraNotes?.length) drawExtraNotes(root, extraNotes, { ...options, tonic });
            else clearExtraNotes(root);
        };

        draw();

        const observer = new MutationObserver((records) => {
            if (records.every(isDrawing)) return;
            draw();
        });
        observer.observe(root, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [pages, extenders, extraNotes, omissions, tonic, optionsKey]);

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
