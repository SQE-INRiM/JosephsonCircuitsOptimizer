# WI_20260831_006 — Results stage output path and performance

## Scope

Fix missing Optimization Results for stage-only runs and remove expensive repeated Results re-indexing during simulations.

## Findings

- `run_optimization_only` and other stage-only entry points create an output folder without updating `CURRENT_OUTPUT_PATH[]`. GUI optimizer-history persistence therefore has no destination and silently skips `df_optimization_analysis.h5`.
- `ResultsScreen` calls `readResults()` every 4 s while a simulation is running.
- Each `readResults()` spawns a fresh Julia process and `results.jl` reopens/catalogues all stored run datasets, so cost grows with the number/size of runs and competes with the active simulation.

## Acceptance criteria

- Every GUI-launched output folder becomes `CURRENT_OUTPUT_PATH[]`, including stage-only modes.
- A selected Optimization-stage run writes `df_optimization_analysis.h5` into its own output folder.
- Results keeps prior runs visible during an active simulation without 4-second full-catalogue polling.
- Results refreshes when entered and when the global run state changes, so completed output is picked up after the run finishes.
- Existing storage/data semantics remain unchanged.

## Validation

Repository/static validation plus governance CI. Local Windows/Julia execution remains required for end-to-end verification.
