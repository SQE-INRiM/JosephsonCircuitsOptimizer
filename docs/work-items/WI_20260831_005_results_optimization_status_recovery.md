# WI_20260831_005 — Results optimization/status recovery

## Type
T2 — GUI/results bookkeeping fix.

## Problem
A newly completed run can still appear as `running` in the Results selector because `currentRunId` survives the `run-finished` event. In addition, some completed runs do not expose Optimization Results because `df_optimization_analysis.h5` is absent even though the run bookkeeping contains the complete cost history.

## Scope
- Do not mark `currentRunId` as active in Results when the application `running` state is false.
- Prefer the dedicated optimizer HDF5 table when present.
- For completed full runs where that file is missing, recover the BO-only table from `simulation_info/run_config.json`.
- Use the Linear table to recover parameter order and initial sweep length; do not infer vector ordering from JSON dictionary key order.
- Keep the existing Optimization visualization layer unchanged.

## Acceptance criteria
1. A completed run no longer carries the UI-only `· running` suffix.
2. A completed run with optimizer `cost_history` but no dedicated optimization HDF5 exposes Optimization Results.
3. Initial Linear sweep evaluations are excluded from the recovered optimization table.
4. A valid `df_optimization_analysis.h5` remains authoritative when present.
5. Existing Linear/HB Results behavior is unchanged.
