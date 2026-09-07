# ADR 003 — Harmonic Balance Results semantics

## Status
Accepted

## Context
The Harmonic Balance summary table is structurally different from the Linear uniform dataset. JCO persists one row per nonlinear sweep point with source coordinates (`source_i_frequency`, `source_i_amplitude`), `performance`, solver `converged` state, additional scalar user-performance metrics, and `delta_quantity` when it is numeric for all rows. User-selected nonlinear arrays are already stored separately under `saved_data/nonlinear.h5` using the same stable `point_id`.

A generic X/Y/Z viewer does not expose this structure well, especially for multi-source sweeps, convergence failures, point-level retained data, or performance/backaction trends versus pump amplitude.

## Decision
1. Harmonic Balance Results is a source-space explorer over the persisted nonlinear summary table.
2. Landscape axes are selected from stored source frequency/amplitude coordinates. Every non-axis source coordinate is fixed explicitly to a stored value. The GUI filters rows exactly and never averages, interpolates or projects hidden source coordinates.
3. Convergence is an explicit view filter with `All points`, `Converged`, and `Non-converged`. It reads the persisted numeric `converged` column directly.
4. Point data is addressed by the stable nonlinear `point_id`. The selected HB configuration consists only of the source frequency/amplitude coordinates that define that nonlinear point. Persisted device parameters remain visible in a separate `Device parameters` block because they describe the circuit used for the calculation, but they are not HB sweep coordinates.
5. Point data may load retained arrays from `saved_data/nonlinear.h5` on demand.
6. The Amplitude response view selects one stored source-amplitude coordinate for the x-axis and fixes every other source coordinate explicitly. `performance` and `delta_quantity` are plotted separately rather than normalized or forced onto one shared y-scale.
7. The GUI does not convert source current amplitude into power unless a future dataset explicitly persists a power quantity or enough information to define that conversion unambiguously.
8. Optimizer `All parameters` history uses separate raw-value charts rather than overlaying differently scaled parameters or normalizing them.

## Consequences
- Multi-source nonlinear sweeps can be inspected without losing the meaning of hidden coordinates.
- Solver convergence can be compared without deleting or rewriting non-converged rows.
- Source coordinates and device parameters are both visible without conflating the nonlinear sweep definition with the fixed/selected circuit state.
- Nonlinear retained arrays become point-addressable in the same user workflow as Linear retained arrays.
- Performance and nonlinear correction/backaction indicators remain numerically faithful to their persisted values and units.
- Existing projects remain compatible; runs without `saved_data/nonlinear.h5` simply have no retained nonlinear arrays to display.

## Validation expectations
- Automated tests cover exact source-space slicing and convergence filtering.
- Pull-request CI runs the renderer tests and TypeScript/Vite build.
- Runtime validation should cover multi-source axis/fixed selectors, convergence filters, point selection, retained nonlinear trace loading, and amplitude-response selection on Windows/Electron.
