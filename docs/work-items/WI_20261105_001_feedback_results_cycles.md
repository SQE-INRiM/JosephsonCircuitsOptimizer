# WI 2026-11-05 — Cycle-aware nonlinear feedback Results (parallel)

## Scope and isolation
This branch originated as a snapshot of `feat/nonlinear-feedback-v0.4.2` (PR #24), extending its **Results and persistence**. PR #24 has since been merged into `main`, and this feature branch now contains a two-parent merge of that main commit and its prior Results work. Setup/Metrics and the Julia correction API come from `main`; the corrected-cycle Julia loop preserves its fixed-cycle/convergence stopping behavior while saving per-cycle datasets and summaries. The branch remains a draft until real multi-cycle Julia/HB validation.

## User interface
- Preserve the existing top-level **Run** selector and toolbar.
- Place **Cycle 0 (baseline) / Cycle N** in the **same row as Linear / Optimization / Harmonic balance tabs**, right aligned. No extra horizontal row or separator.
- Add a subtly colored **Nonlinear feedback** tab only when the selected run contains feedback outputs. The tab has a full-run convergence view, independent of which cycle is selected.
- The convergence view shows best evaluated HB performance per completed cycle, an unobtrusive convergence/limit status badge, and compact raw parameter-history charts. Clicking a mark or a Cycle button opens that cycle in Harmonic balance.
- Linear, Optimization and HB each display the exact dataset for the selected cycle. Retained arrays, A/B comparisons and CSV exports request that same cycle; cycle 0 and legacy runs keep their previous behavior.

## On-disk contract
- Cycle 0 continues to write the original run-level HDF5 files and optimal-parameters JSON without duplication.
- Corrected cycles save `feedback/cycle_NNN/df_uniform_analysis.h5`, `df_optimization_analysis.h5`, `df_nonlinear_analysis.h5`, `optimal_device_parameters.json`, `optimal_physical_quantities.json` (when there is a working point), and any `saved_data/` arrays.
- `feedback/summary.json` (schema `jco.feedback/1`) is written atomically after baseline and after every completed corrected cycle, with cycle index, correction, optimized metric, best evaluated performance and device parameters. At normal completion the summary also includes the stopping criterion, cycle count, and whether convergence was reached before the limit; the existing `nonlinear_feedback_stopping.json` remains available. Incomplete cycle folders may be indexed, but are never represented as converged, complete history points.
- During a corrected cycle, `CURRENT_OUTPUT_PATH[]` is switched to the cycle folder so the existing GUI optimization-history writer and `save_datas` do not overwrite Cycle 0; it is restored using `finally`.
- The main-branch stopping controller remains active: completed corrected cycles are recorded before convergence assessment, a convergence-triggered `break` restores `CURRENT_OUTPUT_PATH[]` via `finally`, and the existing `nonlinear_feedback_stopping.json` is still written.
- Fix corrected-cycle best working-point selection by indexing `cycle_best_idx`, not stale `best_idx`.

## Limitations and validation
- Numerical feedback scientific correctness and zero-correction equivalence have **not** yet been validated with a real Julia HB reference run. The draft should remain unmerged until this is done.
- The new Julia indexing fixture is runnable with `julia --project=. gui/runtime/bridge/feedback-results-test.jl`. The normal GUI `npm test` / TypeScript build and Windows/Linux packaging checks should run on this branch.
- A/B comparisons remain limited to two points **within a selected cycle**; cross-cycle point overlays are not supported.
- A performance value is the best **evaluated** HB performance for that cycle, not proof of a globally optimal operating point.
- The project `.jco` archive packer includes nested feedback folders recursively, preserving the datasets across save/reopen.
