# WI_20260901_005 — Resolved circuit preview

## Classification
T2 — GUI/runtime inspection feature. It executes the user's existing circuit-construction function only after an explicit preview request, but does not alter the scientific simulation contract.

## Goal
Visualize the actual circuit created by `create_user_circuit(device_params_set)` in Setup → Circuit without statically guessing topology from Julia source.

## Scientific contract
- `create_user_circuit` remains the sole source of circuit topology and component definitions.
- JCO's returned `CircuitStruct`, `CircuitDefs`, and port count are authoritative.
- The complete resolved circuit remains in preview data. The renderer may choose positions and may visually condense a long repetitive middle section with an explicit ellipsis, but must not change the underlying resolved topology or feed the condensed drawing back into simulation.
- Preview generation does not run harmonic balance or optimization.
- Opening a project must not execute user Julia code; preview execution is explicit.

## Representative configuration
For parameter sweeps the first configured value of each device parameter is used to generate the initial preview. The GUI must label this policy. A future configuration selector can extend this without changing the bridge contract.

## UX
- Keep the preview inside the existing Circuit section.
- Preserve the compact Setup page: large circuits use an internally scrollable/zoomable SVG viewport.
- For long chain-like circuits, show the first 15 cell transitions, an explicit `…`, then the final cell transition and output node/port.
- Route multiple elements between the same two nodes as separated parallel lanes sharing the real endpoints.
- Route multiple shunt elements with short horizontal branches and vertical drops to ground rather than long diagonal connections.
- Provide Fit, zoom, Refresh, stale state, component count, node count, and port count.
- Clicking a component shows its name, endpoints, resolved value, and original value expression when useful.
- Render common JosephsonCircuits elements (`P`, `R`, `C`, `L`, `Lj`) with schematic-like symbols; handle `K` mutual coupling as a relation between referenced inductors and retain unknown element types generically.

## Implementation
- Add `runtime/bridge/circuit_preview.jl` to execute the active `user_circuit.jl` with the representative parameter point and emit JSON.
- Add desktop IPC `previewCircuit(project)` which first synchronizes current GUI state into the active workspace.
- Add dependency-free native SVG rendering in the React UI.
- Track a fingerprint of circuit code and parameter specifications and mark an existing preview stale when they change.
- Keep long-chain condensation entirely inside the renderer; no component is removed from the Julia/IPC preview payload.

## Validation before merge
- `npm run build`
- `npm test`
- Generate the default JPA preview and verify P/R/C/Lj topology and values.
- Generate the Chalmers 3WM preview and verify a loop-generated long circuit is returned rather than a static-source approximation.
- Generate at least one large JTWPA circuit and verify the first 15 cells, ellipsis, final cell and output port remain readable.
- Verify parallel components fan into separate lanes and shunts reach ground through orthogonal branches without the previous triangular crossings.
- Confirm opening a `.jco` does not execute `user_circuit.jl`; only Generate/Refresh does.
- Change circuit code and a device parameter and verify the preview is marked out of date until refreshed.
- If a mutual-inductance `K` example is available, verify it is drawn between the referenced inductors rather than interpreted as electrical nodes.

## Non-goals
- Persisting rendered diagrams in `.jco`.
- Editing circuit topology graphically.
- Showing every sweep configuration simultaneously.
- Replacing the Julia circuit definition with a second GUI-owned circuit model.
