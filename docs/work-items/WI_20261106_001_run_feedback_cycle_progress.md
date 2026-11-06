# WI 2026-11-06 — Live feedback-cycle progress in Run

Status: implementation on `gui/run-feedback-cycle-progress`; real Julia/HB desktop acceptance pending.

## UI semantics

- Keep four stage cards visible: Linear, Optimization, Harmonic balance and Nonlinear feedback.
- When Setup feedback is disabled (`nonlinearCorrectionCycles = 0`), the feedback card is disabled and the cycle banner is absent.
- Feedback requires a varying device-parameter space and the **full** Run pipeline. Single-configuration and partial-stage runs do not claim to execute feedback cycles.
- In a full run, the first three cards show Cycle 0 (baseline), then reset for each corrected cycle. Their existing Julia stage/progress/ETA reporter remains the source of numerical progress.
- The cycle banner above the cards shows the active iteration relative to the configured maximum. The feedback card counts *completed corrected cycles*, not a guessed fraction of the work. Metric-convergence runs may finish before the maximum.
- The fourth card opens a compact detail area identifying correction, Linear, Optimization, and HB phases. Failed, cancelled, complete and converged outcomes are distinguished. After corrected-cycle failure, do not offer a misleading stage-only resume button; a new full Run remains available.

## Protocol and implementation

- The existing Julia loop emits `FEEDBACK_CYCLE cycle=<N> max=<M> phase=<...> status=<...>` at correction start, numerical phase changes and committed cycle completion; a final `FEEDBACK_DONE cycles=<N> max=<M> reason=<converged|cycle_limit>` follows after saving the existing stopping metadata.
- Electron parses those markers with the pure `desktop/feedback-progress.cjs` helper and forwards typed `feedback-cycle` / `feedback-done` events to the renderer.
- Zustand maintains `feedbackRun` independently of `stages`. On the start of each corrected cycle, reset the three numerical stages and let the existing `STAGE` and `PROGRESS` markers repopulate them. All progress events are scoped to the current run ID.
- No change to the numerical correction, optimization, HB, stored results, or .jco persistence formats.

## Verification

Automated tests added for the Node protocol parser, Run-screen disabled/active states, and Zustand cycle transitions, early convergence, cancellation, and stage-only runs. Commands to run from `gui/`:

```sh
npm test
npm run build
```

Real desktop acceptance remains necessary: fixed cycles (including at least two corrected cycles), convergence stopping, disabled feedback, cancellation during correction/BO/HB, and save/reopen Results. Julia itself is not available in this integration environment and no actual long-running HB simulation has been claimed as validated.
