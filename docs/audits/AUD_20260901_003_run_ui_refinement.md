# AUD_20260901_003 — Run UI refinement

Status: qualified pending PR CI and Windows/Electron interaction check.

## Scope
WI_20260901_003.

## Review
- Stored-run deletion no longer performs recursive deletion or `.jco` repacking on the Electron main thread; a Node worker owns both operations.
- The renderer closes the run-manager dialog after confirmation and keeps the deletion promise alive, updating Results after each completed run deletion.
- Active runs remain protected from deletion and project-switch races are checked before applying returned archive metadata.
- Run-card summaries are derived from current parameter/source sweep specs. Runtime `PROGRESS` events remain authoritative while a stage is executing.
- The Simulation log is retained unchanged as data but rendered only in an on-demand dialog.
- No scientific metric, solver, HDF5, or `.jco` schema semantics are changed.

## Validation
- Targeted sweep-count unit tests added.
- PR CI must run `npm test`, Electron desktop syntax checks, and `npm run build`.
- Final responsiveness and dialog behavior require manual Windows/Electron confirmation on the maintainer machine.
