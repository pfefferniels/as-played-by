/**
 * Shared types for the MLign aligner port.
 *
 * The reference implementation is Python/NumPy (`MLign/src/mlign/infer.py`).
 * Where a type here looks over-specified — plain `number[]` rather than a typed
 * array, for instance — it is because the Python it mirrors is float64 there and
 * narrowing to float32 would change the arithmetic. Those spots are called out.
 */

/** A score note. Onset and duration are in quarter notes. */
export interface ScoreNote {
    id: string;
    onset: number;
    duration: number;
    pitch: number;
    voice: number;
}

/** A performed note. Onset and duration are in seconds. */
export interface PerfNote {
    id: string;
    onset: number;
    duration: number;
    pitch: number;
    velocity: number;
}

/** `[onset_ticks, duration_ticks, pitch, voice % 5]`, PPQ 720. */
export type ScoreRow = [number, number, number, number];

/** `[onset_ms, duration_ms, pitch, velocity]`. */
export type PerfRow = [number, number, number, number];

/**
 * Both note tables in the units the model was trained on: score time in PPQ-720
 * ticks, performance time in milliseconds.
 *
 * These stay float64 (`number[]`, not `Float32Array`) on purpose. The decode
 * recovers seconds by dividing back down — `s_onset = row.score[i][0] / 720`,
 * `p_onset = row.perf[j][0] / 1000` — and NumPy does that in float64. Rounding
 * the ticks to float32 first perturbs the onsets, and onset equality is what
 * decides cluster boundaries in the DTW.
 */
export interface MlignRow {
    score: ScoreRow[];
    perf: PerfRow[];
}

/** A model window over the two tables: score `[s0, s1)` against perf `[p0, p1)`. */
export type Window = readonly [s0: number, s1: number, p0: number, p1: number];

/**
 * The model's accumulated output for a whole piece.
 *
 * `sim` is row-major `(n, m)`. Cells no window covered hold `UNCOVERED_SIM`, and
 * the matching entries of `nullS` / `nullP` hold `UNCOVERED_NULL`, which is what
 * drives those notes to a deletion / insertion in the decode.
 *
 * `attr` is the ornament-attribution head, present only when it was asked for.
 * It is row-major `(m, n)` — the other way round from `sim`, because it is a
 * distribution over written notes for each played one — and `attrNone` is its
 * "not an ornament" column, kept beside it rather than as an `n + 1`th entry so
 * that the matrix stays a plain transpose of the score/performance grid.
 */
export interface SimBundle {
    n: number;
    m: number;
    sim: Float32Array;
    nullS: Float32Array;
    nullP: Float32Array;
    attr?: Float32Array;
    attrNone?: Float32Array;
}

/** An alignment triple over table indices, as `decode` emits them. */
export type IndexTriple =
    | { label: "match"; scoreIdx: number; perfIdx: number; confidence: number }
    | { label: "deletion"; scoreIdx: number; confidence: number }
    | { label: "insertion"; perfIdx: number; confidence: number };

/** An alignment triple over note ids, as the caller wants them. */
export type AlignmentTriple =
    | { label: "match"; scoreId: string; perfId: string; confidence: number }
    | { label: "deletion"; scoreId: string; confidence: number }
    | { label: "insertion"; perfId: string; confidence: number };

/**
 * Constants shared with the Python. Names match `meta.constants` in the golden
 * manifests, which is the contract these are checked against.
 */
export const PPQ = 720.0;
export const PERF_MS_PER_SEC = 1000.0;
export const MARKER_PITCH = 128;
export const MAX_SINGLE_TOKENS = 2000;
export const WIN_SCORE = 384;
/**
 * Derived, not independent: `coarse_windows` computes `stride = WIN_SCORE // 2`
 * in its own body, so this is that value at the default window size and nothing
 * more. The manifests record it because they record what a run used, not because
 * it is settable — a window plan with a stride that is not half its window size
 * is one no Python run could produce. Never expose it as an option; derive it.
 */
export const WIN_STRIDE = WIN_SCORE >> 1;
export const MARGIN_SEC = 3.0;
export const UNCOVERED_SIM = -1e9;
export const UNCOVERED_NULL = 1e9;
export const ANCHOR_CONF = 0.35;
export const TOL_SEC = 1.0;
export const SKIP_FACTOR = 0.6;
export const ASSIGN_INF = 1e18;
export const CONF_BONUS_FACTOR = 0.5;
export const RESCUE_SEC = 0.35;
export const DTW_GAP_DECODE = 0.6;
export const DTW_GAP_BASELINE = 0.75;
export const DTW_CONF_GAIN = 20.0;
export const SCORE_CLUSTER_EPS = 1e-9;
export const PERF_CLUSTER_EPS = 0.05;
