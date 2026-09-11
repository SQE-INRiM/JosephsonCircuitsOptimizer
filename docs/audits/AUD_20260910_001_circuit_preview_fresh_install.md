# AUD_20260910_001 — Circuit Preview fresh-install/runtime bootstrap follow-up

Date: 2026-09-10
Type: change
Tier: T2
Status: qualified
Related work item: `WI_20260901_005_circuit_preview`
Related ADR: `ADR_007_resolved_circuit_preview`
Integrated range: `e88f5d3..399873f`

## Objective
Record the post-v0.3.0 follow-up that made Circuit Preview and GUI startup more reliable when used from a fresh unified-repository checkout.

## Scope
- Julia environment preparation before Circuit Preview;
- runtime-readiness detection in the Electron main process;
- Windows/Linux GUI bootstrap changes;
- GUI runtime dependency declarations associated with reliable Electron startup.

## Integrated changes
- `e88f5d3` (`circuit preview fix`): Circuit Preview activates and instantiates the active Julia project before loading JosephsonCircuitsOptimizer, allowing preview to be the first Julia action after a fresh checkout.
- `69b5453` (`Update main.cjs`): added a runtime fingerprint based on the configured Julia executable and root `Project.toml` / `Manifest.toml`; Circuit Preview calls runtime setup when that environment has not yet been prepared.
- `399873f` (`Fix opening gui`): updated the Windows/Linux bootstrap/dependency path, declared Electron 43.4.1 locally, and pinned `adm-zip` to 0.6.0.

## Architectural/scientific review
- ADR 007 remains unchanged: Circuit Preview still executes only after an explicit Generate/Refresh action and continues to resolve topology through JCO.
- No `.jco` schema or persistent scientific data format is changed by this follow-up.
- No simulation, optimization, metric, unit or numerical algorithm semantics are intentionally changed.
- Runtime preparation is an execution/bootstrap concern, not a second circuit representation.

## Verification evidence
The commits are present in the unified repository history and were integrated into `main` through `399873f`.

Exact outputs from `npm test`, `npm run build`, and a scripted fresh-install Electron/Julia validation were not retained in repository evidence for this branch. This audit therefore remains `qualified`; it must not be read as claiming those checks were performed.

## Findings / limitations
- First Julia use can legitimately take substantially longer because package instantiation/precompilation may be required.
- Runtime readiness is invalidated when the configured Julia path or root Julia project/manifest changes.
- Platform bootstrap can prepare project/runtime dependencies, but a working Julia installation remains required for Julia-backed operations.
- The audit records the integrated behavior and known execution boundary; it does not certify performance on every Windows/Linux installation.
