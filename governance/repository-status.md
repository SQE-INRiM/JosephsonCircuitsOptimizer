# Repository Status

Last governance refresh: 2026-09-11

## Current development baseline

- Repository: `SQE-INRiM/JosephsonCircuitsOptimizer`
- Primary branch: `main`
- Application stack: Julia/JCO package at repository root with the Electron/React GUI under `gui/`.
- Unified-repository migration was merged by PR #1 on 2026-09-07 at `8e148a2`.
- Preliminary Linux launcher was merged by PR #2 at `75dfe0b`.
- Release `v0.3.0` was merged by PR #3 at `497ceb1` on 2026-09-08, followed by README/image-only refinements through `6e9ab98`.
- `fix/circuit-preview-fresh-install` was integrated into `main` through `399873f` on 2026-09-10.
- Current feature work: `feat/example-project-workflow`, implementation commit `aac3931`, with governance reconciliation and final local checks being recorded before integration.

The pre-migration `emanuele-palumbo/JCO-GUI` status is historical context. Git history and retained audits/work items preserve that development record; this file tracks the unified organization repository.

## Integrated history since migration

### Unified repository / release
- The GUI, runtime bridge, launchers, tests, governance material, examples and documentation live in the main JosephsonCircuitsOptimizer repository.
- Windows startup uses `START_JCO_GUI.bat`; a preliminary Linux launcher is available as `START_JCO_GUI.sh`.
- `v0.3.0` established the first documented unified-repository release baseline.

### Circuit Preview fresh-install follow-up
The three commits `e88f5d3` → `69b5453` → `399873f` hardened Circuit Preview and first-launch runtime behavior:
- Circuit Preview can materialize the Julia project environment when it is the first Julia action after a fresh checkout.
- The desktop process records a runtime-readiness fingerprint derived from the Julia path plus `Project.toml` / `Manifest.toml`, and prepares the runtime before preview execution when required.
- Windows/Linux GUI bootstrap scripts were updated so the local GUI dependency/runtime setup is prepared before Electron launch.
- Electron is declared at `43.4.1` in the GUI development dependencies and `adm-zip` is pinned to `0.6.0`.
- These changes are a runtime/bootstrap follow-up to ADR 007; they do not change circuit topology semantics or the `.jco` schema.

See `AUD_20260910_001_circuit_preview_fresh_install.md` for the scoped historical audit. It remains qualified where exact automated/manual checks were not retained in repository evidence.

## Current functional state

The unified GUI provides:
- Setup for circuit code, device parameters, sources, computation settings and metric code;
- explicit JCO-resolved Circuit Preview with stale-state tracking and condensed rendering for long circuits;
- Linear, Optimization and Harmonic Balance execution through the Julia bridge;
- run cancellation/protection and persistent `.jco` project/result storage;
- point-addressable Results views, retained-array plotting and CSV export;
- dynamic bundled examples under `gui/runtime/examples/`;
- Windows and preliminary Linux startup/bootstrap flows.

On the active `feat/example-project-workflow` change:
- desktop startup creates a neutral `New project` session rather than showing the old Carthago-specific placeholder;
- valid bundled `.jco` examples are discovered from the examples directory and may run in isolated temporary sessions without Save As;
- ordinary unsaved user projects retain the durable-project Save As guard;
- Circuit Preview generation can continue while the user configures other Setup sections, with stale-result detection if preview-relevant inputs change in flight.

## Governance state

Governance remains lightweight and advisory:
- `AGENTS.md` is the coding-agent entry point;
- ADR 007 remains authoritative for Circuit Preview execution/topology boundaries;
- `WI_20260911_001_example_project_workflow.md` and `AUD_20260911_001_example_project_workflow.md` track the current T2 workflow change;
- older qualified audits remain historical evidence and are not silently upgraded to complete without recorded validation.

No current change intentionally modifies JCO numerical algorithms, scientific metric semantics, source units, or the persistent `.jco` schema.

## Recovery rule

For multi-session work, record only what is needed to resume safely: last verified commit, current state, next safe action, checks already run and important open findings.

## Next safe action

1. Run `npm test` and `npm run build` on `feat/example-project-workflow`.
2. Manually confirm New project startup, dynamic example discovery, direct example execution, ordinary unsaved-project Save As protection, background Circuit Preview navigation and stale-state behavior.
3. Record only the checks actually performed in `AUD_20260911_001`.
4. Commit the governance reconciliation, merge the feature branch into `main`, and update this recovery point if the resulting integrated commit differs from the implementation commit recorded above.
