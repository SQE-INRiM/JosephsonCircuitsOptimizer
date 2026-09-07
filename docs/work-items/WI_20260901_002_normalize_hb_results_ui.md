# WI_20260901_002 — Normalize Harmonic Balance Results UI

Tier: T2

## Goal
Make Harmonic Balance Results visually and behaviorally consistent with the validated Linear Results workflow while preserving HB-specific semantics.

## Acceptance criteria
- Landscape controls follow Linear ordering: metric first, then X/Y axes, then fixed coordinates.
- Selected configuration uses the same section naming and numeric formatting style as Linear.
- Multiple compatible retained arrays share one plot; complex-component selectors remain available.
- Retained-array X vector behavior matches Linear semantics.
- HB exposes `Show stored configurations` below the point inspector.
- Convergence filtering remains explicit and unchanged scientifically.
- Multi-run management no longer consumes vertical Results space; it opens from the compact stored-runs header control.
- No numerical, HDF5, or `.jco` schema changes.
