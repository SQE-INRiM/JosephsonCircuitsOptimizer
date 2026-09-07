# WI_20260827_002 — Real linear simulation bridge

- Status: in_progress
- Audit tier: T3
- Branch: `fix/linear-simulation-bridge`
- Started: 2026-08-27

## Objective

Make the Run screen start the real Julia/JCO linear sweep and validate the scientific input boundary with the supplied Carthago loss-and-spread workspace.

## Scope

- remove the Run screen's accidental use of the demo timer in the desktop application;
- allow an explicit linear-only request;
- map that request to `JCO.run_sweep_only`;
- ensure stage-only linear runs expose the active output folder to user metric save helpers;
- retain explicit browser-preview behavior when no desktop bridge exists;
- add automated regression coverage and record actual verification limits.
- make cancellation observable and ensure a requested cancellation is reported as
  `cancelled`, including when the GUI must terminate a non-responsive Julia
  process tree;
- require a durable `.jco` path before a real run so generated datasets cannot
  remain only in the temporary session workspace;
- make the Current Run panel explain run identity, output contents and automatic
  project saving;
- stop producing a correlation image during the linear-only workflow. The HDF5
  dataset is the authoritative result and visualizations will be regenerated
  from it.

## Non-goals

- no change to JosephsonCircuits numerical algorithms;
- no change to metric definitions or units;
- no claim of numerical validation without a Julia execution environment;
- no nonlinear/HB workflow redesign.
- no redesign of optimization/nonlinear datasets or visualization controls in
  this work item;
- no deletion or migration of historical plot artifacts already present in a
  project.

## Reference case

Input: user-supplied `my_exp_JTWPA_CARTHAGO_withLOSSandSPREAD(2).zip`, with a single fixed device configuration, 0.001–10 GHz frequency grid, a 7 GHz pump source, and a DC-bias source.

Expected bridge behavior: selecting Linear simulation writes the current model to `user_inputs/`, starts `JCO.run_sweep_only`, emits LIN progress, and writes a new linear dataset under one timestamped output folder. Scientific numerical agreement requires execution with the compatible Julia/JCO environment and comparison with the retained reference inputs/outputs; no numerical tolerance is asserted yet.

## Acceptance criteria

1. Desktop Run-screen controls never invoke the demo timer. — met by code inspection and build
2. A linear-only request maps to `sweep_only`. — met by automated Node test
3. The active output folder is available to `save_datas` during a stage-only linear run. — met by source-level bridge verification; live Julia run pending
4. Browser preview remains explicitly identified as simulated. — met
5. Existing automated tests/build and governance check pass. — met
6. A real Carthago linear run is attempted on a compatible Julia environment; any error and its inputs are retained. — blocked in current Linux workspace: Julia executable unavailable
7. Cancellation produces immediate GUI feedback, writes the graceful STOP
   request, and falls back to terminating the Julia process tree; the terminal
   outcome remains `cancelled`. — implementation and process-policy tests pass;
   real Windows cancellation pending
8. A real run cannot start from an unsaved temporary project; the user is told
   to use Save As first. — met by automated policy test
9. The linear-only workflow stores its HDF5 result and metadata but does not
   generate a correlation PNG. — met by source-level regression test; real HDF5
   generation pending

## Windows observations received after the initial audit

The maintainer tested the current Windows application and reported:

- the floating run control starts a real linear sweep;
- the Run screen's **Run selected stage** control does nothing in the tested
  build;
- the real linear sweep cannot be cancelled from the GUI;
- the Current Run panel and the relationship between outputs and project saving
  are unclear.

These observations are user-reported evidence about the tested build. They do
not yet prove the behavior of the unmerged `fix/linear-simulation-bridge`
changes and must be rechecked against the next Windows build.

## Output-storage decision

Each project may contain multiple immutable timestamped output folders. For new
runs, numerical datasets and run metadata are authoritative. Plot and heatmap
images are derived artifacts and should not be produced by the linear-only
execution path; the GUI will generate them later from HDF5 tables such as the
uniform analysis, nonlinear analysis and correlation data.

## Recovery

Last verified remote commit recorded for this branch:
`4c713d765836fec6566fdfeea1965783f687295c`. The current local snapshot has
additional uncommitted follow-up changes and cannot verify ancestry because its
Git metadata was reconstructed as an unborn `master` branch.

Current state: selected-stage wiring, explicit cancellation policy, durable-run
guard, shared GUI/output run ID, Current Run explanations, and HDF5-only linear
artifact policy are implemented. Automated checks pass. Audit
`AUD_20260827_002` remains qualified pending the real Windows/Julia checks.

Next safe action: implement and test the cancellation/storage/UI clarification
changes, then open the rebuilt draft PR on Windows, Save As the supplied
Carthago workspace, run only Linear sweep, cancel one run, complete another,
and retain the resulting status/HDF5 evidence.

Checks already run and results: 20 Vitest tests passed; 14 Node
desktop/archive/process tests passed; TypeScript and Vite production build
passed with the existing bundle-size warning; governance check passed; the
earlier supplied Carthago GUI input round trip passed. Julia is not present in
the current environment.

Open assumptions/findings: the supplied user metric calls `save_datas`;
`run_sweep_only` did not previously set `CURRENT_OUTPUT_PATH`, which would cause
a linear-stage failure after solver output was produced. A STOP file cannot
interrupt a single long `hbsolve` call, so GUI cancellation needs a documented
forced-termination fallback.

Files intentionally not changed: user-supplied metric/circuit definitions, persistent `.jco` schema, JosephsonCircuits algorithms.
