# Run remaining and guided nonlinear-feedback execution

**Status:** Draft implementation on `gui/run-remaining-feedback` (2026-11-09); Julia/HB and installed-desktop verification pending.  
**Risk:** T2 execution orchestration; no numerical algorithm or persisted project schema changes.

## Contract

- `Run` always starts a fresh full run and preserves its existing automatic feedback behavior.
- When a feedback parameter sweep is configured, `Run next step` starts a **new guided full run**, pausing the same Julia process after Linear, Optimization and HB. At each pause, `Run next step` advances one more stage; after baseline/corrected HB, this includes the next cycle's correction followed by Linear. `Run remaining` removes subsequent pauses while using the same in-memory Julia state.
- The last corrected cycle and an early convergence finish without another pause. During a pause, the ordinary Stop action remains available.
- Without feedback, the existing contextual stage button remains. `Run remaining` selects only stages from the first unfinished one, skips disabled Optimization, and relies on saved input-snapshot validation before any partial dataset is used.
- For combined Optimization + HB, the bridge now supplies the same provenance-validated Linear dataset required by Optimization-only mode; it does not trust a potentially stale `LATEST.txt` pointer.
- Guided-mode control uses a short-lived, atomically written signal in the output folder, removed at exit. Only a paused stepped run may accept continuation. An edited setup never silently resumes an unrelated run.

## Limitations / pending acceptance

- Guided execution is an **active-process** continuation, not a checkpoint/restart feature: after Stop, process exit or desktop restart, starting another guided run begins at Linear. Separate historical stage-only runs cannot be imported into an existing feedback process.
- A paused process holds its Julia memory until continued/stopped.
- Unit tests cover stage selection, feedback progress parsing/store state, screen callbacks and validated combined-stage dataset selection, but the full npm suite and Julia calculations have **not** yet been executed from this environment.
- Manual desktop acceptance: 2-cycle fixed feedback, convergence-stopped feedback, resume from each pause, Run remaining after baseline HB, cancellation during a pause, changed settings, Results selection/partial files, and a non-feedback Linear → Run remaining Optimization + HB.
