# WI_20260903_002 — Active run project-session protection

## Classification

T2 — Electron project/run lifecycle safety and user-visible action availability.

## Goal

Keep a running Julia process tied to the exact project workspace that started it, and prevent project/session mutations while that process is active.

## Scope

- Capture the active workspace, durable `.jco` path, and manifest when a run starts.
- Use that captured session for Julia `JCO_WORKSPACE`, cancellation STOP handling, run-finish cleanup, and run-finish auto-save.
- Block New/Open/Import/example/Save/Save As/editable-workspace export/project validation while a Julia simulation or runtime setup process is active.
- Disable the corresponding renderer menu actions while a run is active.
- Add focused Node tests for the idle guard and immutable session capture.

## Recovery policy

This work selectively reintroduces only the active-run/session-safety portion of historical PR #48 onto the experimentally validated recovery baseline `24ee7426dd3b4df48b7b970bdddb83411842745b`.

The dependency and Circuit Preview test-harness fixes from #48 are already present in the recovery baseline and are not reintroduced here as separate changes.

## Scientific contract

- No Julia bridge/runtime simulation file is modified.
- No solver, optimizer, circuit, source construction, metric, unit conversion, sweep, HDF5 schema, or numerical result transformation is modified.
- No `.jco` persistent format change is introduced.

## Validation

- Repository test/build CI.
- Governance CI.
- Manual Windows check before merge:
  - rerun the known project and confirm Linear remains near the verified ~2 s baseline;
  - confirm New/Open/Import/examples/Save/Save As/editable-workspace export/Julia settings cannot change the project during a run;
  - confirm cancellation still works;
  - confirm normal project actions work again after the run finishes.
