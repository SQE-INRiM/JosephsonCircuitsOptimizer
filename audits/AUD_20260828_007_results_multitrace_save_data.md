# AUD_20260828_007 — Selected-point multi-trace Results and `save_data`

Status: **qualified**

## Scope reviewed

- `runtime/bridge/gui_results_fixes.jl`
- `src/components/ConnectedResults.tsx`
- `WI_20260828_007`

## Checks actually performed

- Reviewed branch diff against `main`; the change is limited to the Results selected-point UI and the desktop-only save helper layer.
- Confirmed `save_data` preserves the existing `category="auto"` / explicit `category="custom"` behavior and `save_datas` remains a compatibility alias.
- Confirmed the selected-point UI prefers resolved circuit parameters and falls back to sweep values only when resolved values are unavailable.
- Confirmed multiple retained arrays remain selected simultaneously and are grouped by compatible x-axis kind/shape; point changes clear the selection.
- Confirmed complex traces retain per-trace component selection.

## Not executed

- `npm run build` / TypeScript compiler.
- Desktop Electron runtime interaction.
- Julia execution and HDF5 round trip.

These checks remain local follow-up because the connected repository has no available CI run for this branch and this execution environment does not provide the project's Julia/private-repository runtime.

## Important limitation

`save_data(S21)` cannot infer the caller's source variable name in ordinary Julia function syntax. The supported automatic-name form is `@save_data S21`; explicit `filename=` remains available. This is a Julia language/API constraint, not a storage limitation.
