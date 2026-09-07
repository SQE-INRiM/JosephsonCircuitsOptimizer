# WI_20260828_005 — Linear Results MVP

## Goal

Replace the preview-only Linear Results view with a real, point-addressable viewer driven by the compact Linear summary HDF5 data already stored in each run.

## User requirements

- Work on the Linear stage first. Optimization and nonlinear-feedback/cross-stage comparison remain deferred.
- Do not expose HDF5 filenames or storage mechanics as the primary user workflow.
- Use the summary table as the canonical configuration index.
- Treat the metric mask sentinel (`metric >= 1e8`) as excluded from plots so masked points do not distort the color scale; keep the underlying row visible for traceability.
- Selecting a plotted configuration must expose its device parameters, all scalar metrics saved on that row, and the catalogue of user-selected arrays retained for the same `point_id`.
- Do not eagerly transfer every saved frequency-resolved array into the renderer.

## Acceptance criteria

1. A real Linear run with one varied device parameter is shown as a 1D metric curve.
2. A real Linear run with two varied device parameters is shown as a 2D heatmap.
3. Masked points are rendered as empty/white cells and are excluded from heatmap min/max scaling.
4. Clicking a valid heatmap cell selects the exact summary row by `point_id`.
5. The selected-point inspector shows parameters separately from scalar metrics.
6. If `saved_data/linear.h5` exists, the inspector shows which quantities/arrays were retained for that exact point without loading their full numerical payload.
7. More-than-2D Linear sweeps are not silently collapsed; the UI explains that slicing/filtering is required before plotting.
8. Existing Optimization and Harmonic Balance views remain functionally unchanged for now.

## Scope note

Plotting the contents of a selected saved array is intentionally the next Results sub-step. This MVP establishes the scalable catalogue and exact point-selection path first, without reintroducing eager loading of large traces.

## Verification

Targeted TypeScript/build checks should be run when a local repository/runtime is available. A real `.jco` Linear run remains the consequential end-to-end validation for HDF5 point correspondence and masked-cell behaviour.
