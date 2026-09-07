# WI_20260828_004 — Point-addressable selective saved data

## Goal

Make detailed numerical persistence scale to large JCO sweeps while preserving enough structure for the future Results UI to navigate from a summary-table configuration to the arrays explicitly saved for that same configuration.

## User requirement

The compact Linear and nonlinear DataFrames must remain the primary index of all simulated configurations. Frequency-resolved or otherwise large arrays must not be saved automatically for every point. `save_datas(...)` should select the scientifically useful arrays, and the Results UI should later be able to select a DataFrame row and discover/plot the arrays saved for that point.

## Implemented contract

- `df_uniform_analysis.h5` receives a stable numeric `point_id` for every Linear sweep row.
- `df_nonlinear_analysis.h5` receives a stable numeric `point_id` for every stored HB row.
- The runtime sets an active point context immediately around `user_cost` / `user_performance` execution.
- `save_datas(...)` writes selected arrays directly to `saved_data/linear.h5`, `saved_data/nonlinear.h5`, or `saved_data/custom.h5` under `point_XXXXXX`.
- Complex arrays are split into `real` / `imag`; real arrays use `values`.
- Point metadata records device parameters and, for nonlinear points, source frequencies and amplitudes.
- A common `frequency_hz` axis is stored at the selected-data file root when available.
- `save_datas(category="linear"|"nonlinear")` outside an active summary point is ignored so optimizer evaluations cannot be mistaken for uniform/HB rows.
- The default `trace_storage_mode` is `selected`.
- `trace_storage_mode = "all"` retains the previously validated full fundamental S-matrix files as a diagnostic option.
- `trace_storage_mode = "none"` keeps only summary data/bookkeeping.
- Selected mode no longer accumulates all S matrices in memory across the sweep.

## Compatibility

Historical `.jco` archives are not rewritten. Existing summary HDF5 dataset names remain unchanged; the additional `point_id` is a normal table column. Old `data_saved_by_user/` outputs remain readable as historical artifacts. The new `saved_data/` schema is used only by new GUI-launched runs using the override layer.

## Deferred

- Results UI discovery/plotting from `saved_data/*.h5`.
- Migration helpers for old timestamped `data_saved_by_user/` files.
- A first-class GUI control for diagnostic `all`/`none` modes; the runtime/config contract exists now and defaults safely to `selected`.
- Optimal-device-parameter serialization inconsistency identified during the August 28 run audit.

## Validation status

Implementation is statically integrated and documented. Julia is not available in the agent execution environment, so a new local GUI run is required to validate the HDF5 layout and exact point-ID correspondence end to end.
