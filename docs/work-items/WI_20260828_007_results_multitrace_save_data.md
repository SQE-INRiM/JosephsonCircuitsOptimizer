# WI_20260828_007 — Selected-point multi-trace Results and `save_data`

## Goal

Refine the Linear selected-configuration workflow after real GUI use.

## Requested behavior

- Do not repeat sweep-coordinate parameters when circuit-resolved values are available.
- Prefer the singular `save_data` name while preserving existing `save_datas` projects.
- Allow multiple retained arrays from one selected point to remain plotted at the same time.
- Overlay arrays only when their x-axis coordinates are compatible; otherwise keep separate charts.
- Preserve frequency-vs-index automatic x-axis behavior from the previous Results increment.
- Defer comparison/overlay across different configuration points.

## Julia naming constraint

An ordinary Julia function call such as `save_data(S21)` receives the value of `S21`, not the source-code variable name. Therefore automatic source-name capture cannot be implemented reliably with ordinary function-call syntax.

The concise name-preserving form is `@save_data S21`. The explicit function equivalent is `save_data(S21; filename="S21")`. `save_datas(...)` and `@save_datas` remain compatibility aliases.

## Acceptance criteria

- Selected configuration renders one parameter set: resolved values when present, sweep values only as fallback for historical runs.
- More than one retained array can be selected concurrently for a point.
- Compatible retained arrays share a chart; incompatible x axes do not.
- Complex arrays retain independent magnitude/real/imag/phase selection.
- Changing point clears the selected trace set.
- No changes are made to Optimization/HB result semantics or cross-point comparison.
