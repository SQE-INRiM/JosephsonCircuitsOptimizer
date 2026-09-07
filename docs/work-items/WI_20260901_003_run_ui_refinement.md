# WI_20260901_003 — Run UI refinement

## Goal
Refine the Run and Results workflow without changing scientific semantics.

## Scope
- Keep the Electron GUI responsive while stored runs are deleted and the `.jco` archive is repacked.
- Replace stale demo evaluation counts in the Run cards with summaries derived from the current project configuration; backend progress remains authoritative while a stage is running.
- Move the terminal-style simulation log out of the permanent Run layout into an on-demand dialog.

## Acceptance criteria
- Deleting stored runs performs filesystem deletion/archive repack outside the Electron main thread and the run-manager dialog may be closed while work continues.
- Linear and HB configured-point summaries reflect current parameter/source sweep specifications.
- Optimization summary reflects current optimizer configuration or explicit skip semantics for a single fixed device configuration.
- Simulation log is closed by default and available through a compact button.
- `npm test`, `npm run build`, and governance checks pass before merge.
