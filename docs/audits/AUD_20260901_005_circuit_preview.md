# AUD_20260901_005 — Resolved circuit preview

Date: 2026-09-01
Work item: `WI_20260901_005_circuit_preview`
ADR: `ADR_007_resolved_circuit_preview`

## Outcome
Implemented a dependency-free Setup circuit preview based on the actual `CircuitStruct` returned by JCO after explicit execution of `create_user_circuit`.

## Changes reviewed
- Added a Julia preview bridge that resolves a representative device-parameter point and serializes the created circuit.
- Added Electron IPC/preload/renderer adapter support for explicit preview generation.
- Added a native SVG schematic renderer with common component symbols, node/port/component counts, Fit/zoom, internal scrolling, component inspection, and stale detection.
- Integrated the preview into Setup → Circuit without adding a separate circuit data model or changing simulation inputs.
- Added a renderer regression test for a representative JPA-style circuit.

## Scientific fidelity checks by inspection
- Topology comes from `JCO.create_circuit`, not source-text inference.
- Component endpoints and names are preserved from `CircuitStruct`.
- `CircuitDefs` are used only to resolve display values; unresolved expressions are retained.
- `K` components are not added as electrical nodes because their tuple endpoints are component references.
- User-selected preview inputs are copied before `create_user_circuit` can add derived keys, so the displayed preview configuration remains the original representative input point.
- No simulation, optimization, HDF5, or result-generation code was changed.

## Execution boundary
The feature intentionally does not auto-generate a circuit on project open. `Generate preview` / `Refresh` explicitly executes user circuit code. This preserves the existing rule that opening a `.jco` alone does not execute Julia.

## Validation status
Qualified / pending local validation. Repository connector access cannot run the Electron/Julia application.

Required before merge:
- `npm run build`
- `npm test`
- manual default JPA preview
- manual Chalmers 3WM and long JTWPA preview
- explicit-execution and stale-state checks
- mutual-inductance check when a suitable example is available

## Known limitations
- Initial preview configuration uses the first value of each parameter sweep; there is no point selector yet.
- Automatic schematic placement reflects connectivity, not physical chip geometry.
- Very large circuits remain complete and therefore require zoom/scroll for detailed inspection.
- Julia bridge behavior has been reviewed but not executed by the assistant in a local Julia runtime.
