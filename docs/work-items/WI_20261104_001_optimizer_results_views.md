# WI 2026-11-04 — Results Optimization landscape and history polish

## Scope
Refine the GUI Results explorer on `gui/results-optimizer` (PR #35) without changing numerical simulation, optimization or the saved `.jco`/HDF5 data schema.

## User-facing requirements
- Keep the common Run in progress header chip; remove the redundant full-width informational alert.
- Present Optimization in two views, **Landscape** and **History**, following the compact Linear Results navigation pattern.
- Landscape retains **Projection** (all samples) and **Slice · Linear** (exact Linear values with explicit fixed coordinates). Display optimization samples in evaluation order with an optional straight-segment trajectory, sparse direction arrows and Start/Latest labels. The line represents order between discrete samples, not a continuous physical or surrogate descent.
- Mark the best *evaluated optimizer* sample with a ring. Remove the separate dark diamond marking the lowest stored Linear grid cell to prevent confusion.
- History shows evaluated and best-so-far objective first, then a subtle divider and every stored parameter history. Avoid long introductory instructions; expose scientific distinctions in compact legends/controls and point tooltips.

## Scientific guardrails
- Never claim that a sampled point or Linear cell is the global minimum.
- A 2D projection of a higher-dimensional optimizer history is not the same thing as an exact 2D Linear slice. Off-slice projected points remain visually subdued.
- Show the objective and parameter histories over all saved evaluations, independently of the Landscape evaluation slider.
- Do not interpolate unsampled coordinates or invent optimizer paths between evaluations.

## Verification
- Extend component tests for view switching, trajectory visibility, slice behavior and complete History plots.
- Keep helper regression tests for exact Linear slicing, masking, chronological metric history and near-equality of small physical quantities.
- Require PR build, governance and desktop packaging checks; verify visual clarity with a saved multi-parameter run before merge.
