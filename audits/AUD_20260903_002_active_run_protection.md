# AUD_20260903_002 — Active run project-session protection

Date: 2026-09-03
Work item: `WI_20260903_002_active_run_protection`

## Classification

T2 — Electron project/run lifecycle safety.

## Reviewed implementation

This recovery change selectively reuses the already-tested active-session implementation from historical PR #48:

- `desktop/run-session.cjs` provides the process-idle guard and immutable run-session capture.
- `desktop/main.cjs` blocks project/workspace mutations while Julia is active and binds run spawn, cancellation, STOP cleanup, and run-finish auto-save to the captured run session.
- `src/App.tsx` disables the matching project/settings menu actions while the renderer reports a run in progress.
- `desktop/run-session.node-test.cjs` verifies the idle guard and that a captured session does not follow later changes to the global project session.
- `package.json` includes that Node regression test in the desktop test commands.

## Recovery boundary

Base: `24ee7426dd3b4df48b7b970bdddb83411842745b`, the current recovery baseline after the manually validated run-setup dialog.

Only the active-run/session-safety portion of PR #48 is being reintroduced. The dependency and Circuit Preview test-harness corrections from #48 were already accepted with the prior recovery step.

## Scientific/runtime boundary

No Julia source or simulation bridge file is changed by this work. In particular there is no intentional change to:

- solver or optimizer behavior;
- circuit construction;
- source generation or source units;
- user cost/performance functions;
- linear/HB sweep logic;
- HDF5 schemas or saved numerical data;
- `.jco` persistent project format.

The Electron process lifecycle changes only determine which already-existing workspace a run reads/writes and prevent the GUI from replacing that workspace mid-run.

## Required verification before merge

- repository test/build CI green;
- governance CI green;
- user Windows simulation remains near the known ~2 s Linear baseline;
- project-changing menu actions are disabled during the run;
- cancellation acts on the active run and completes normally;
- project actions become available again after the run.

No merge is authorized by this audit until the manual Windows check is reported successful.
