# AUD_20260831_002 — Persistent Results runs and point trace selection

Status: qualified
Date: 2026-08-31
Related work item: `WI_20260831_002_results_persistent_runs.md`

## Scope reviewed

- `desktop/main.cjs`
- `desktop/preload.cjs`
- `src/services/jcoAdapter.ts`
- `src/screens/ResultsScreen.tsx`
- `src/components/ConnectedResults.tsx`

## Findings

- Results refreshes from durable workspace outputs when the Results screen is entered and periodically while a run is active, without clearing the last successfully indexed bundle on refresh failure.
- Previously completed runs therefore remain selectable independently of the currently edited setup and while a new run is executing.
- Stored-run deletion is constrained to validated `output_...` directories under the current workspace `outputs` root and refuses the active run ID.
- Deletion repacks the `.jco` immediately when Julia is idle; during an active run it modifies the session workspace only and relies on the normal end-of-run autosave to persist the deletion, avoiding concurrent archive packing while Julia writes.
- Retained-array selection is preserved as a point-independent template within the selected run. Changing `point_id` reloads matching arrays for the new point and preserves component choices; unavailable arrays are reported without discarding the template.
- Custom retained X-vector choice is restored when the same saved vector exists at the new point; otherwise the displayed point falls back to automatic frequency/index.
- SVG export was removed; numerical CSV export remains.

## Validation limitation

Static repository review only. A local TypeScript/Vite build and a Windows/Electron/Julia end-to-end test are still required, especially for deletion persistence during an active run and automatic retained-trace reload after heatmap point changes.
