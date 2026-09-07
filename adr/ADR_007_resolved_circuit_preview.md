# ADR 007 — Resolve circuit topology through JCO before visualization

Status: Accepted
Date: 2026-09-01

## Context
`user_circuit.jl` is executable Julia. A circuit can be built with loops, conditions, helper functions, derived device parameters, and hundreds of generated cells. A static parser of the source text would therefore produce only a guess and could silently diverge from the circuit JosephsonCircuits actually receives.

JCO already defines the authoritative boundary: `create_user_circuit(device_params_set)` returns a circuit vector and definitions, and `create_circuit` wraps them as `CircuitStruct`, `CircuitDefs`, and `PortNumber`.

## Decision
Circuit visualization will be generated from the resolved JCO circuit, not from static parsing of `user_circuit.jl`.

1. The desktop GUI synchronizes the current project into its active workspace.
2. Only after an explicit Generate/Refresh action, a Julia bridge loads JCO and executes the active `create_user_circuit` through JCO's normal `create_circuit` path.
3. The bridge serializes the actual component tuples, their endpoints, original value expressions, best-effort resolved values, nodes, ports, and the representative input parameter point.
4. The renderer lays out that topology as a native SVG schematic. Layout coordinates are presentation-only and never fed back to JCO.
5. For long chain-like topologies, the renderer may visually condense the middle: retain the first 15 cell transitions, show an explicit ellipsis, then render the final transition and output node/port. The complete resolved component list remains in the preview payload and in JCO; only the drawing is condensed.
6. For sweep parameters, the first configured value is the initial representative preview point. The UI states this policy.

## Safety / execution boundary
Opening, importing, or merely viewing a `.jco` must continue to avoid executing user Julia. Preview execution is an explicit action with the same trust implication as running the project's circuit code, but it does not start HB, optimization, or result generation.

## Element handling
Standard JosephsonCircuits two-terminal elements are rendered from their returned endpoints. Multiple elements sharing the same two nodes are routed as separate parallel lanes that reconnect to the same electrical endpoints. Shunt elements are routed with short horizontal branches and vertical drops to ground to reduce crossings. `K` mutual-inductance entries are treated specially because their second and third fields reference inductor component names, not electrical nodes. Unknown names remain present as generic components rather than being discarded.

## Consequences
### Positive
- Faithful to generated and parameter-dependent circuits at the data boundary.
- Works for compact devices and long JTWPA chains without a second circuit representation.
- Long repetitive devices remain readable without rendering hundreds of nearly identical cells at once.
- No new frontend dependency.
- Existing `.jco` files need no schema change.
- Diagram rendering can evolve independently of scientific topology.

### Tradeoffs
- Generating a preview executes user circuit code and therefore cannot happen silently on project open.
- Preview generation requires a working Julia/JCO runtime.
- Automatic schematic placement is heuristic; visual geometry is not a claim about physical layout.
- For long chains the SVG is intentionally a condensed structural view, identified by the ellipsis; it is not a literal full expansion of every middle cell.

## Rejected alternatives
- **Regex/source parsing:** not reliable for loops, branches, helper functions, or generated cells.
- **Require users to define a second graphical circuit:** duplicates scientific truth and can drift from `create_user_circuit`.
- **Store rendered images:** conflicts with the project policy of regenerating visualizations from source/numerical data and adds stale artifacts.
