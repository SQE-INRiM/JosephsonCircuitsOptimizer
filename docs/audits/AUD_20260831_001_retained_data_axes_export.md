# AUD_20260831_001 — Retained-data axes and export

Status: qualified
Date: 2026-08-31
Related work item: `WI_20260831_001_retained_data_axes_export.md`

## Scope reviewed

- `runtime/bridge/gui_results_fixes.jl`
- `src/components/ConnectedResults.tsx`

## Findings

- The source-name capture is confined to GUI-loaded user metric expressions and only augments simple one-variable `save_data`/`save_datas` calls when `filename` is absent.
- Explicit `filename` and `prefix` behavior is preserved.
- Stored historical HDF5 data are not mutated.
- Custom X selection uses only retained arrays belonging to the currently selected point.
- Only equal-length Y vectors are paired with a custom retained X vector; incompatible traces keep their automatic axis and are disclosed to the user.
- Automatic frequency plots continue to display GHz while numerical CSV export uses the stored raw Hz vector.
- Graph export is renderer-side SVG; numerical export is renderer-side CSV and does not modify the project workspace.
- Cross-point overlays remain intentionally deferred.

## Validation limitation

No claim is made that the TypeScript/Vite build or Julia/HDF5 execution passed. The agent environment does not provide the repository runtime needed for those checks. Validate locally with a new Linear run containing at least two `save_data(...)` vectors and one candidate custom-X vector.
