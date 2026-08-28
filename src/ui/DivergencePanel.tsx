import { useMemo, useState } from "react";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Button,
    Chip,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { ExpandMore } from "@mui/icons-material";
import type { AddedReading, Divergence, MissingReading } from "../alignment/divergences";
import { pitchName } from "../performance/pitch";

/** What the reader wants done about a divergence. */
export type Action =
    /** Keep it in the recording and leave the notation alone */
    | "record"
    /** Write the played notes into the score, as a performance reading */
    | "write-notes"
    /** Put an ornament sign on the note that was decorated */
    | "add-sign"
    /** Mark the unplayed notes as a simplification */
    | "mark-simplification"
    /** Not about the music at all */
    | "ignore";

export interface Resolution {
    reading: string;
    action: Action;
}

export interface Attribution {
    resp: string;
    certainty: string;
}

interface DivergencePanelProps {
    divergences: readonly Divergence[];
    resolutions: ReadonlyMap<string, Resolution>;
    onResolve: (id: string, resolution: Resolution) => void;
    attribution: Attribution;
    onAttribution: (attribution: Attribution) => void;
    selected?: string;
    onSelect: (id: string | undefined) => void;
    /** Applies every resolution that changes the notation */
    onApply: () => void;
    applying?: boolean;
}

/** The heading each family is listed under, and the order they are shown in. */
const ADDED_LABELS: Record<AddedReading, string> = {
    "written-ornament": "Ornaments the score already writes",
    ornamentation: "Ornamentation the score does not write",
    "added-octave": "Octaves doubled",
    "fuller-chord": "Chords filled out",
    "added-note": "Notes added",
    "repeat-pass": "Played on a repeat the engraving shows once",
    outside: "Outside the music",
};

const MISSING_LABELS: Record<MissingReading, string> = {
    "thinned-chord": "Chords thinned",
    "omitted-passage": "Passages passed over",
    "omitted-note": "Single notes not played",
    outside: "Beyond where the recording reaches",
};

const ORDER = [
    "written-ornament",
    "ornamentation",
    "added-octave",
    "fuller-chord",
    "added-note",
    "thinned-chord",
    "omitted-note",
    "omitted-passage",
    "repeat-pass",
    "outside",
];

/**
 * What may be done about each family, first entry first.
 *
 * A written ornament defaults to `record` and offers nothing else: the score
 * already says the note is ornamented, and the only new fact is how it was
 * played, which belongs in the recording. Offering to "add" those notes would
 * invite writing a trill out as notation, which is not what the sign means.
 */
const ACTIONS: Record<string, Action[]> = {
    "written-ornament": ["record"],
    ornamentation: ["record", "add-sign", "write-notes"],
    "added-octave": ["record", "write-notes"],
    "fuller-chord": ["record", "write-notes"],
    "added-note": ["record", "write-notes"],
    "repeat-pass": ["record", "ignore"],
    "thinned-chord": ["record", "mark-simplification"],
    "omitted-note": ["record", "mark-simplification"],
    "omitted-passage": ["record", "mark-simplification"],
    outside: ["ignore", "record"],
};

const ACTION_LABELS: Record<Action, string> = {
    record: "Record only",
    "write-notes": "Write into the score",
    "add-sign": "Add an ornament sign",
    "mark-simplification": "Mark as a simplification",
    ignore: "Ignore",
};

const CERTAINTIES = ["high", "medium", "low", "unknown"];

const labelOf = (divergence: Divergence) =>
    divergence.kind === "added"
        ? ADDED_LABELS[divergence.reading]
        : MISSING_LABELS[divergence.reading];

function timestamp(ms: number): string {
    const seconds = ms / 1000;
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

/**
 * The disagreements between score and performance, gathered into the things they
 * actually are.
 *
 * Listed flat they are unreadable - one trill alone is a dozen rows of time and
 * pitch. Grouped by what they mean, a whole nocturne comes down to a handful of
 * headings, and the one that matters most reads "ornaments the score already
 * writes", which needs no decision at all.
 */
export const DivergencePanel = ({
    divergences,
    resolutions,
    onResolve,
    attribution,
    onAttribution,
    selected,
    onSelect,
    onApply,
    applying,
}: DivergencePanelProps) => {
    const [open, setOpen] = useState<string>();

    const families = useMemo(() => {
        const byReading = new Map<string, Divergence[]>();
        for (const divergence of divergences) {
            const existing = byReading.get(divergence.reading);
            if (existing) existing.push(divergence);
            else byReading.set(divergence.reading, [divergence]);
        }

        return [...byReading.entries()].sort(
            (a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0])
        );
    }, [divergences]);

    // Only the actions that change the notation are worth an Apply button
    const pending = divergences.filter((divergence) => {
        const action = resolutions.get(divergence.id)?.action ?? defaultAction(divergence);
        return action !== "record" && action !== "ignore";
    }).length;

    if (divergences.length === 0) return null;

    return (
        <Paper variant="outlined" sx={{ p: 2, maxWidth: "56rem" }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                    {divergences.length} places where the score and the recording differ
                </Typography>

                <TextField
                    size="small"
                    label="Decided by"
                    value={attribution.resp}
                    onChange={(event) =>
                        onAttribution({ ...attribution, resp: event.target.value })
                    }
                    sx={{ width: "9rem" }}
                />
                <TextField
                    size="small"
                    select
                    label="Certainty"
                    value={attribution.certainty}
                    onChange={(event) =>
                        onAttribution({ ...attribution, certainty: event.target.value })
                    }
                    sx={{ width: "8rem" }}
                >
                    {CERTAINTIES.map((certainty) => (
                        <MenuItem key={certainty} value={certainty}>
                            {certainty}
                        </MenuItem>
                    ))}
                </TextField>

                <Button
                    variant="contained"
                    size="small"
                    onClick={onApply}
                    disabled={pending === 0 || applying}
                >
                    Apply {pending > 0 ? `${pending} ` : ""}to the score
                </Button>
            </Stack>

            {families.map(([reading, group]) => (
                <Accordion
                    key={reading}
                    variant="outlined"
                    expanded={open === reading}
                    onChange={(_, isOpen) => setOpen(isOpen ? reading : undefined)}
                >
                    <AccordionSummary expandIcon={<ExpandMore />}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                            <Chip size="small" label={group.length} />
                            <Typography>{labelOf(group[0])}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {noteCount(group)} notes
                            </Typography>
                        </Stack>
                    </AccordionSummary>

                    <AccordionDetails sx={{ maxHeight: "24rem", overflow: "auto", pt: 0 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            {group[0].because}
                        </Typography>

                        {group.slice(0, 100).map((divergence) => (
                            <Row
                                key={divergence.id}
                                divergence={divergence}
                                resolution={resolutions.get(divergence.id)}
                                onResolve={onResolve}
                                selected={selected === divergence.id}
                                onSelect={onSelect}
                            />
                        ))}

                        {group.length > 100 && (
                            <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                                and {group.length - 100} more, all read the same way
                            </Typography>
                        )}
                    </AccordionDetails>
                </Accordion>
            ))}
        </Paper>
    );
};

const Row = ({
    divergence,
    resolution,
    onResolve,
    selected,
    onSelect,
}: {
    divergence: Divergence;
    resolution?: Resolution;
    onResolve: (id: string, resolution: Resolution) => void;
    selected: boolean;
    onSelect: (id: string | undefined) => void;
}) => {
    const action = resolution?.action ?? defaultAction(divergence);
    const actions = ACTIONS[divergence.reading] ?? ["record"];

    return (
        <Stack
            direction="row"
            spacing={1.5}
            sx={{
                alignItems: "center",
                py: 0.5,
                px: 1,
                borderRadius: 1,
                cursor: "pointer",
                backgroundColor: selected ? "#f3f4f6" : undefined,
                "&:hover": { backgroundColor: "#f3f4f6" },
            }}
            onClick={() => onSelect(selected ? undefined : divergence.id)}
        >
            <Typography variant="body2" sx={{ width: "5rem", fontVariantNumeric: "tabular-nums" }}>
                {divergence.kind === "added"
                    ? timestamp(divergence.onsetMs)
                    : `bar ~${Math.floor(divergence.onset / 4) + 1}`}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                {describe(divergence)}
            </Typography>

            <TextField
                size="small"
                select
                value={action}
                onChange={(event) => {
                    event.stopPropagation();
                    onResolve(divergence.id, {
                        reading: divergence.reading,
                        action: event.target.value as Action,
                    });
                }}
                onClick={(event) => event.stopPropagation()}
                sx={{ width: "13rem" }}
            >
                {actions.map((option) => (
                    <MenuItem key={option} value={option}>
                        {ACTION_LABELS[option]}
                    </MenuItem>
                ))}
            </TextField>
        </Stack>
    );
};

/**
 * What a divergence does by default.
 *
 * Everything is recorded and nothing is written, except the notes that are not
 * about the music at all. An edition is not changed because an aligner proposed
 * something; it is changed because a reader decided.
 */
function defaultAction(divergence: Divergence): Action {
    return divergence.reading === "outside" ? "ignore" : "record";
}

function noteCount(group: Divergence[]): number {
    return group.reduce(
        (total, divergence) =>
            total +
            (divergence.kind === "added"
                ? divergence.perfIds.length
                : divergence.scoreIds.length),
        0
    );
}

function describe(divergence: Divergence): string {
    if (divergence.kind === "added") {
        const count = divergence.perfIds.length;
        const signs = divergence.signs.map((sign) => sign.name).join(", ");
        // The figure itself, which is what says whether a reading is right - eight
        // notes alternating B flat and C read as a trill at a glance
        const figure = divergence.pitches.slice(0, 8).map(pitchName).join(" ");

        return [
            `${count} note${count === 1 ? "" : "s"} played`,
            signs ? `against a written ${signs}` : undefined,
            `— ${figure}${divergence.pitches.length > 8 ? " …" : ""}`,
        ]
            .filter(Boolean)
            .join(" ");
    }

    const count = divergence.scoreIds.length;
    return `${count} written note${count === 1 ? "" : "s"} not played`;
}
