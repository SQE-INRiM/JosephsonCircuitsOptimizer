# AUD_20260831_005 — Results optimization/status recovery

## Status
Qualified.

## Reviewed
- `src/screens/ResultsScreen.tsx`
- `runtime/bridge/results.jl`
- existing `cost_history` bookkeeping contract in `Bookkeeping.jl`
- existing optimizer-history HDF5 persistence in `gui_runtime_fixes.jl`

## Findings
1. The `· running` suffix was UI-derived from `currentRunId`, not from the stored run status. `currentRunId` intentionally persists as the identity of the last run, so Results must combine it with the live `running` boolean before treating a run as active.
2. Completed runs persist `cost_history` in `simulation_info/run_config.json`, including parameter vectors and objective values.
3. The Linear summary table preserves the exact device-parameter column order and gives the count of initial sweep evaluations. These two facts are sufficient to recover the first BO evaluation block without relying on JSON dictionary ordering.
4. The dedicated `df_optimization_analysis.h5` remains preferred; bookkeeping reconstruction is a fallback only.

## Static checks
- Recovery excludes the first `length(linear.rows)` cost-history entries.
- Recovery limits the BO block using configured `max_optimizer_iterations × new_samples_per_optimizer_iteration` when available.
- Results active-run identity is now passed only while `running == true`.
- No Linear/HB plotting code was changed.

## Qualification
A local Julia/HDF5 execution and Electron/TypeScript build were not available in this environment. The next local validation should reopen the just-completed run and confirm that Optimization Results are reconstructed and that the run selector no longer shows `· running` after completion.
