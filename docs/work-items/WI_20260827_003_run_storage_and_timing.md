# WI_20260827_003 — Run storage and timing

## Goal

Use the successful Chalmers 3WM full-run evidence to make GUI-launched runs scientifically reusable and the Run screen truthful.

## Scope implemented

1. Preserve existing compact HDF5 summary tables for backward compatibility.
2. Add separate frequency-resolved trace files:
   - `linear_traces.h5`
   - `nonlinear_traces.h5`
3. Store complex fundamental S-parameters as paired `real` / `imag` datasets with a shared frequency axis and per-point coordinates.
4. Keep `save_datas(...)` available for user-defined extra quantities such as idlers or specialized traces.
5. Disable automatic PNG/plot sidecar persistence for GUI-launched simulations; figures are derived later from numerical data.
6. Replace the hard-coded Run-stage descriptions with neutral stage names and configuration-independent text.
7. Parse Julia `PROGRESS_DONE` events and calculate real per-stage elapsed duration from backend timestamps.
8. Remove permanent idle `Active stage: None`, `Stored output`, and `Saving` explanations from the Current Run panel.

## Integration approach

The embedded JCO engine source is left intact. `runtime/bridge/run.jl` loads `gui_runtime_overrides.jl` into the `JosephsonCircuitsOptimizer` module immediately before executing a GUI-launched run. This keeps the desktop-specific persistence policy localized and easy to audit or remove while preserving the existing JCO API.

## Compatibility

- `df_uniform_analysis.h5` schema is unchanged.
- `df_nonlinear_analysis.h5` schema is unchanged.
- Existing historical `.jco` projects remain readable.
- Existing plot-generation functions remain callable; only automatic file persistence is disabled in GUI-launched runs.

## Validation completed here

- Existing Run screen test updated for the neutral `Linear` label.
- Store test added for backend-provided stage duration formatting.
- Electron `desktop/main.cjs` was syntax-checked locally with Node after the parser change.
- Repository files and current SHAs were read before mutation; changes were applied directly to `main` through the connected GitHub repository.

## Validation still required on the real Julia/Windows environment

This environment does not contain Julia, so the numerical storage contract must be accepted with one real desktop run. A successful acceptance run should contain, as applicable:

- `df_uniform_analysis.h5`
- `linear_traces.h5`
- `df_nonlinear_analysis.h5`
- `nonlinear_traces.h5`
- run metadata/input snapshots
- no newly generated automatic plot PNGs

The HDF5 trace files should then be inspected for frequency length, point count, coordinates and `Sij/real` + `Sij/imag` dataset shapes. The Run screen should show elapsed durations measured from the actual Julia stage events.

## Status

Implemented on `main`; numerical acceptance remains pending a real GUI/Julia run.
