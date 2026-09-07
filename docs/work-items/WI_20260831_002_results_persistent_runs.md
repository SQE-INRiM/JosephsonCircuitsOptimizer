# WI_20260831_002 — Persistent Results runs and trace selection

Status: implemented, validation qualified
Risk tier: T2

## Goal

Keep completed simulations usable from Results independently of the currently edited setup or an active new run, while making selected-point retained plots persistent across point changes.

## Requested behavior

- Completed runs remain visible/selectable in Results while a new run is executing.
- Editing the current setup does not hide previously completed runs.
- A completed run can be deleted directly from Results after confirmation.
- Retained-array plot selections persist when the selected point changes; the same quantity/array selections are loaded automatically for the new point when available.
- Remove SVG graph export; keep CSV numerical export.

## Implementation

- Results refreshes from durable workspace outputs whenever the screen is entered and every few seconds while a run is active; refresh failures leave the last successful bundle visible.
- The desktop bridge exposes deletion of a validated stored `output_...` directory and refuses deletion of the active run.
- Deleted runs are repacked into the `.jco` immediately while idle, or by the normal end-of-run autosave when deletion occurs during another active run.
- Retained-array selections and complex-component choices are preserved across `point_id` changes and automatically reloaded for matching quantities at the new point.
- Missing retained arrays at a point are omitted with a warning while the selection template is retained for later points.
- SVG export was removed; CSV export remains.

## Acceptance criteria

1. Results run list is built from durable stored project outputs, not only current setup/run state.
2. Starting a run or editing inputs does not remove older completed runs from the Results selector.
3. Deleting a run removes its persisted output from the project and refreshes Results without deleting the active running output.
4. Selecting S21/S11 at point A and clicking point B automatically reloads S21/S11 for point B when those arrays exist.
5. Missing quantities on a new point are reported/omitted without clearing the remaining selection template.
6. SVG export controls are removed; CSV remains.

## Validation

Static repository/diff review only in the agent environment. A local TypeScript/Vite build and a Windows/Electron/Julia end-to-end test are still required.
