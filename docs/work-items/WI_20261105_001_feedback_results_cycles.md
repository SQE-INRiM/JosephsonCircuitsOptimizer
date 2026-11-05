# WI 2026-11-05 — Cycle-aware nonlinear feedback Results (parallel)

## Scope and isolation
This branch is a snapshot of `feat/nonlinear-feedback-v0.4.2` (draft PR #24), extending its **Results and persistence** only. It is **not** a release or a substitute for integrating PR #24. Keep Setup/Metrics, Julia-function editor and correction API changes on the original branch; reconcile changes only after both parts have been independently reviewed.

## User interface
- Preserve the existing top-level **Run** selector and toolbar.
- Place **Cycle 0 (baseline) / Cycle N** in the **same row as Linear / Optimization / Harmonic balance tabs**, right aligned. No extra horizontal row or separator.
- Add a subtly colored **Nonlinear feedback** tab only when the selected run contains feedback outputs. The tab has a full-run convergence view, independent of which cycle is selected.
- The convergence view shows best evaluated HB performance per completed cycle and compact raw parameter-history charts. Clicking a mark or a Cycle button opens that cycle in Harmonic balance.
- Linear, Optimization and HB each display the exact dataset for the selected cycle. Retained arrays, A/B comparisons and CSV exports request that same cycle; cycle 0 and legacy runs keep their previous behavior.

## On-disk contract
- Cycle 0 continues to write the original run-level HDF5 files and optimal-parameters JSON without duplication.
- Corrected cycles save `feedback/cycle_NNN/df_uniform_analysis.h5`, `df_optimization_analysis.h5`, `df_nonlinear_analysis.h5`, `optimal_device_parameters.json`, `optimal_physical_quantities.json` (when there is a working point), and any `saved_data/` arrays.
- `feedback/summary.json` (schema `jco.feedback/1`) is written atomically after baseline and after every completed corrected cycle, with cycle index, correction, optimized metric, best evaluated performance and device parameters. Incomplete cycle folders may be indexed, but are never represented as converged, complete history points.
- During a corrected cycle, `CURRENT_OUTPUT_PATH[]` is switched to the cycle folder so the existing GUI optimization-history writer and `save_datas` do not overwrite Cycle 0; it is restored using `finally`.
- Fix corrected-cycle best working-point selection by indexing `cycle_best_idx`, not stale `best_idx`.

## Limitations and validation
- Numerical feedback scientific correctness and zero-correction equivalence have **not** yet been validated with a real Julia HB reference run. The draft should remain unmerged until this is done.
- The new Julia indexing fixture is runnable with `julia --project=. gui/runtime/bridge/feedback-results-test.jl`. The normal GUI `npm test` / TypeScript build and Windows/Linux packaging checks should run on this branch.
- A/B comparisons remain limited to two points **within a selected cycle**; cross-cycle point overlays are not supported.
- A performance value is the best **evaluated** HB performance for that cycle, not proof of a globally optimal operating point.
- The project `.jco` archive packer includes nested feedback folders recursively, preserving the datasets across save/reopen.
