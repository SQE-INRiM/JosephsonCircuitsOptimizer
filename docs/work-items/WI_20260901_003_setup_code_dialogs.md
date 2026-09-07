# WI_20260901_003 — Setup code dialogs

## Classification
T1 — presentation / GUI-only change.

## Goal
Reduce Setup clutter and scrolling by moving the two primary Julia code editors into modal dialogs that behave like the existing Simulation log window.

## Scope
- Circuit tab: replace the permanently visible `user_circuit.jl` editor with a `Circuit definition` button and dialog.
- Metrics & constraints: replace the permanently visible `user_cost_and_performance.jl` editor with a `Cost & performance` button and dialog.
- Keep editing connected to the existing project store so changes remain part of the same `.jco` project state.
- Reuse the existing MUI `Dialog` and `TextField` stack; add no editor library and no npm dependency.

## Out of scope
- External editor integration.
- File watching or conflict resolution.
- Parametric-source editor redesign.
- Scientific/runtime behavior changes.

## Acceptance checks
- `npm run build`.
- `npm test`.
- Circuit definition dialog opens, edits project code, and closes normally.
- Cost & performance dialog opens, updates the returned-metric table through the existing store parsing path, and closes normally.
- Setup no longer reserves large vertical regions for those two code editors.
