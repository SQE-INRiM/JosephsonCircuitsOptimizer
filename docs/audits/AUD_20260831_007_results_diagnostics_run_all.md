# AUD_20260831_007 — Results diagnostics and Run all

Status: qualified
Risk tier: T2

## Scope

Review the explicit full-pipeline control, Results refresh behavior, and optimizer-history persistence diagnostics added after continued local difficulty visualizing Optimization Results.

## Review

- `Run all` requests all non-skipped stages, which maps to the full JCO run mode; it does not change the existing `Run remaining` reuse behavior.
- The Results screen retains non-polling behavior and adds only an explicit manual refresh.
- The latest-run Optimization diagnostic reads existing Results/bookkeeping state only; it does not mutate numerical data.
- The optimizer persistence diagnostic redefines only the GUI-only `_gui_save_optimization_history` writer. It does not change `cost`, `surrogate_optimize!`, parameter bounds, objective values, or sampling strategy.
- The persistence writer records failure details in `simulation_info/optimization_persistence.json` and returns without turning a successful optimizer run into a simulation failure.

## Checks performed

- Static repository review of the changed TypeScript and Julia bridge files.
- Branch diff reviewed to confirm changes are limited to Run/Results UI and GUI-only persistence diagnostics.
- No repeated Results polling was reintroduced.

## Pending local verification

- TypeScript/Vite desktop build was not executed in the agent environment.
- A Windows/Electron + Julia optimization run is required to confirm whether `df_optimization_analysis.h5` is written and whether the new diagnostic identifies any remaining persistence failure.

## Result

Qualified for integration pending the local desktop round trip above.
