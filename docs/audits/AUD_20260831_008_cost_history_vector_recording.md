# AUD_20260831_008 — Cost-history vector recording root-cause fix

Status: qualified
Risk tier: T2
Date: 2026-08-31

## Trigger

A user-provided exported workspace showed that a completed full `Run all` produced `optimal_device_parameters.json`, nonlinear results and `simulation_info/optimization_persistence.json`, but no `df_optimization_analysis.h5`.

The persistence diagnostic for `output_2026-08-31_10-15-44-204Z` reported zero initial, total and BO history evaluations even though optimization completed.

## Root cause

`cost_history["params_vecs"]` is typed as `Vector{Vector{Float64}}`, while `cost(vec)` recorded samples using `Float64.(vec)`. Surrogates may call `cost` with tuple-like coordinates; broadcasting preserves the tuple container, so pushing the result into `Vector{Vector{Float64}}` throws a conversion error. The engine wrapped history recording in an empty `try/catch`, so the failure was silent and the metric/timestamp pushes in the same block never executed.

## Fix

The desktop bridge now overrides only the history-recording implementation of `cost` and converts coordinates with `collect(Float64.(vec))` before pushing. Unexpected history-write failures are logged as warnings instead of being silently discarded. Simulation, user objective evaluation, progress and optimizer mathematics remain unchanged.

## Expected result

For a normal full run, Linear evaluations populate history before BO; optimizer evaluations append after them. `_gui_save_optimization_history` can therefore persist the BO-only tail to `df_optimization_analysis.h5`. Optimization-only runs also record their BO evaluations correctly.

## Validation

- Inspected the supplied workspace output and its persistence diagnostic.
- Verified the container-type mismatch against the declared `Vector{Vector{Float64}}` history storage and the tuple-preserving broadcast expression.
- Static review of the bridge override confirms only the recorded coordinate container changes (`Tuple`/other iterable -> `Vector{Float64}`).
- Local Windows/Julia end-to-end execution is unavailable in the agent environment; user validation with one small Run all remains required.
