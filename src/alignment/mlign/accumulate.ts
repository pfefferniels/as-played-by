/**
 * The match head, and the accumulation of it over windows.
 *
 * The exported graph stops at the encoder, so the bilinear match, the null
 * logits and the overlap bookkeeping all live here. Reference implementation:
 * `MLign/src/mlign/infer.py::accumulate_logits`; the head itself is the `head`
 * block of `mlign-v2-fp16.onnx.json`.
 *
 * Only *types* are imported from `session.ts`, and `featurize.ts` is pure, so
 * this module pulls in no onnxruntime code: the one thing here that needs a
 * WASM runtime is the session the caller hands in.
 */

import { featurizeWindow } from "./featurize";
import type { MlignRow, SimBundle, Window } from "./types";
import { UNCOVERED_NULL, UNCOVERED_SIM } from "./types";
import type { EncoderOutput, MlignSession } from "./session";

/**
 * `sim`, `null_col` and `null_row` for a single window, read out of one forward
 * pass.
 *
 * Three things about this are easy to get wrong:
 *
 * The graph emits every token, markers included, so score note `i` lives at
 * token `1 + i` and performed note `j` at token `2 + n + j`.
 *
 * The null logits come from `match_s` / `match_p`, which the graph derives from
 * the encoder output *before* the `out_s` / `out_p` projections. They are not
 * recoverable from `s` and `p`, so they must be read out, never re-derived.
 *
 * `sim` is rounded to float32 because the reference's `sim` is a float32 torch
 * tensor and everything downstream — the doubling, the accumulation, the
 * division — happens at that width. The dot itself accumulates in float64,
 * which is if anything more accurate than the float32 matmul it mirrors: with
 * fp32 weights the whole pipeline lands 2.3e-4 from the Python reference on
 * `schubert-d783-15`, i.e. float32 accumulation-order noise and nothing else.
 */
function windowHead(out: EncoderOutput): {
    sim: Float32Array;
    nullCol: Float32Array;
    nullRow: Float32Array;
} {
    const { n, m, T, s, p, matchS, matchP, scale } = out;
    const d = s.length / T;

    const sim = new Float32Array(n * m);
    for (let i = 0; i < n; i++) {
        const sOff = (1 + i) * d;
        const rowOff = i * m;
        for (let j = 0; j < m; j++) {
            const pOff = (2 + n + j) * d;
            let dot = 0;
            for (let k = 0; k < d; k++) dot += s[sOff + k] * p[pOff + k];
            sim[rowOff + j] = Math.fround(dot * scale);
        }
    }

    const nullCol = new Float32Array(n);
    for (let i = 0; i < n; i++) nullCol[i] = matchS[1 + i];

    const nullRow = new Float32Array(m);
    for (let j = 0; j < m; j++) nullRow[j] = matchP[2 + n + j];

    return { sim, nullCol, nullRow };
}

/**
 * Run every window through the model and accumulate the head into one
 * `(n, m)` similarity matrix plus the two null vectors.
 *
 * The one subtlety worth stating plainly, because a softmax is not
 * scale-invariant and getting it wrong silently changes every confidence
 * downstream: the reference adds `logits_s2p[:n, :m] + logits_p2s[:m, :n].T`
 * per window. Both of those are the *same* `sim` tensor — the model builds
 * `logits_p2s` from `sim.transpose(1, 2)` — so every covered cell ends up
 * holding exactly twice the raw similarity before the division by the window
 * count. That factor of two is part of the contract, not an artefact, so it is
 * reproduced here as an explicit double rather than folded away.
 *
 * Cells and notes that no window covered keep their sentinels, which is what
 * pushes those notes to a deletion or an insertion in the decode.
 *
 * `windows` normally comes from `planWindows(row)`, which already collapses a
 * short enough piece to a single whole-piece window.
 */
export async function accumulateLogits(
    session: MlignSession,
    row: MlignRow,
    windows: readonly Window[],
    onWindow?: (done: number, total: number) => void
): Promise<SimBundle> {
    const n = row.score.length;
    const m = row.perf.length;

    const sim = new Float32Array(n * m).fill(UNCOVERED_SIM);
    const cnt = new Float32Array(n * m);
    const nullS = new Float32Array(n);
    const nullSCnt = new Float32Array(n);
    const nullP = new Float32Array(m);
    const nullPCnt = new Float32Array(m);

    for (let w = 0; w < windows.length; w++) {
        const win = windows[w];
        const [s0, s1, p0, p1] = win;
        const ns = s1 - s0;
        const mp = p1 - p0;

        const out = await session.run(featurizeWindow(row, win));
        if (out.n !== ns || out.m !== mp) {
            throw new Error(
                `MLign: window [${s0},${s1})x[${p0},${p1}) featurized as ` +
                    `${out.n}x${out.m}, expected ${ns}x${mp}`
            );
        }
        const { sim: block, nullCol, nullRow } = windowHead(out);

        for (let i = 0; i < ns; i++) {
            const blockOff = i * mp;
            const simOff = (s0 + i) * m + p0;
            for (let j = 0; j < mp; j++) {
                const k = simOff + j;
                // First window to reach this cell replaces the sentinel; the
                // rest add to what is already there.
                if (cnt[k] === 0) sim[k] = 0;
                const raw = block[blockOff + j];
                sim[k] += raw + raw;
                cnt[k] += 1;
            }
        }

        for (let i = 0; i < ns; i++) {
            nullS[s0 + i] += nullCol[i];
            nullSCnt[s0 + i] += 1;
        }
        for (let j = 0; j < mp; j++) {
            nullP[p0 + j] += nullRow[j];
            nullPCnt[p0 + j] += 1;
        }

        onWindow?.(w + 1, windows.length);
    }

    for (let k = 0; k < sim.length; k++) {
        if (cnt[k] !== 0) sim[k] /= cnt[k];
    }
    for (let i = 0; i < n; i++) {
        nullS[i] = nullSCnt[i] === 0 ? UNCOVERED_NULL : nullS[i] / nullSCnt[i];
    }
    for (let j = 0; j < m; j++) {
        nullP[j] = nullPCnt[j] === 0 ? UNCOVERED_NULL : nullP[j] / nullPCnt[j];
    }

    return { n, m, sim, nullS, nullP };
}
