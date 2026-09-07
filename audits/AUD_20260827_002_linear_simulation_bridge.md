# AUD_20260827_002 — Real linear simulation bridge

- Type: change
- Tier: T3
- Status: qualified
- Date: 2026-08-27
- Branch: `fix/linear-simulation-bridge`
- Base commit: `e4d1b1dca3e11e703e8af43157633bc721ef17e4`
- Related work item: `WI_20260827_002`

## Objective

Verify that a desktop Run-screen linear request reaches the real JCO sweep-only entry point without changing the supplied Carthago scientific inputs, and that its metric data-save path has an active output folder.

## Scope

Renderer run controls, stage-to-JCO mode selection, the linear-only output-path registration, and GUI load/save of the supplied Carthago workspace.

## Exclusions and limitation

The current Linux environment has Node.js but no Julia executable. The Julia solver was therefore not started, and no numerical equivalence, convergence, runtime, HDF5-output, or Windows/Electron system claim is made. This is why the audit is `qualified`, not `complete`.

After the initial audit, the maintainer reported a successful real linear launch
from the floating control in the tested Windows build, but also reported that
the Run screen's selected-stage control did nothing and that Stop did not cancel
the real sweep. The exact tested commit was not established. These observations
are retained as new findings, not counted as verification of this branch.

## Criteria

1. Desktop Run-screen controls call the provided real run actions rather than the demo timer.
2. `['linear']` maps to bridge mode `sweep_only`, which calls `JCO.run_sweep_only`.
3. `run_sweep_only` assigns `CURRENT_OUTPUT_PATH` before executing user metrics.
4. Carthago device parameters, drives, original simulation values, and Julia sources survive GUI load/save.
5. Existing automated tests, build, and governance check pass.
6. A compatible Windows/Julia system run produces a new readable linear dataset.
7. A cancellation request is visible immediately and the final run outcome is
   `cancelled`, whether Julia exits gracefully or is terminated after the grace
   period.
8. Real simulation is refused until the project has a durable `.jco` path, and
   a completed/cancelled run is repacked into that project.
9. The linear-only path produces HDF5/metadata outputs without generating a
   correlation image.

## Verification performed

- Inspected current `main` at `e4d1b1dca3e11e703e8af43157633bc721ef17e4` and the supplied archive with SHA-256 `f7da84341bcd6043b3ae9d5ad80f07fc5b4ceb3dce5c06c3759cee6c966a2603`.
- Confirmed the Run screen previously invoked `startDemoRun`/`stopDemoRun` even when the desktop bridge existed.
- Added and executed a Node regression test proving a linear-only stage request maps to `sweep_only`.
- Confirmed `runtime/bridge/run.jl` dispatches `sweep_only` to `JCO.run_sweep_only`.
- Confirmed the supplied `user_cost` calls `save_datas` and that the prior `run_sweep_only` path had not assigned `CURRENT_OUTPUT_PATH`; the new assignment occurs immediately after the output directory is created.
- Executed a GUI model load/save round trip on a temporary copy of the supplied workspace. Device parameters, drive values, original simulation settings, and Julia files were preserved; exact observations are retained in `audits/evidence/AUD_20260827_002_carthago_boundary.json`.
- Ran `npm test`: pass (18 Vitest tests and 9 Node tests).
- Ran `npm run build`: pass; existing bundle-size warning remains.
- Ran `python scripts/governance_check.py`: pass.
- Follow-up: added renderer regression coverage proving that **Run Linear
  sweep** invokes the selected-stage callback and that a pending cancellation
  disables duplicate Stop requests.
- Follow-up: added desktop policy tests for the shared path-safe GUI/Julia run
  ID, durable-project requirement, cancellation outcome, and Windows
  `taskkill /T /F` process-tree fallback.
- Follow-up: added a source-level check that `run_sweep_only` consumes
  `JCO_RUN_ID` and does not call `create_corr_figure`.
- Follow-up checks: 20 Vitest tests passed; 14 Node tests passed; TypeScript/Vite
  build passed with the existing bundle-size warning; governance check passed.
  Evidence is retained in
  `audits/evidence/AUD_20260827_002_linear_control_followup.json`.

## Findings

- Fixed: desktop Run-screen buttons were wired to the mock timer.
- Fixed: linear-only user data saves had no active output folder.
- Removed from the live run panel: hard-coded fake run ID, revision, thread count, and retention text. The panel now reports the actual emitted run ID and current project.
- Open: a Windows/Electron run with compatible Julia must validate process launch, package compatibility, user metric execution, HDF5 generation, and result indexing.
- Reopened from maintainer observation: cancellation and selected-stage behavior
  require validation against a build containing this branch.
- Open: forced termination during `hbsolve` can preserve already-flushed partial
  files, but cannot guarantee a graceful Julia status write. The desktop outcome
  must therefore retain the cancellation intent independently.
- Decision: plots are derived GUI artifacts; the linear-only run should retain
  HDF5 numerical data and metadata, not create a correlation PNG.
- Fixed in the follow-up working tree: GUI and Julia use the same output-folder
  run ID; unsaved projects cannot start a real simulation; completed and
  cancelled processes are repacked into the durable `.jco` file.
- Provenance limitation: this workspace is a reconstructed working tree with an
  unborn local `master` branch. The follow-up changes are not tied to a new Git
  commit and could not be pushed because GitHub credentials are unavailable.

## Conclusion

Qualified pass for the original code-level bridge mapping and Carthago input
boundary. The later Windows observations prevent treating the workflow as
complete. The change must remain unmerged until criteria 6–9 are reconciled or
a maintainer explicitly accepts each documented limitation.
