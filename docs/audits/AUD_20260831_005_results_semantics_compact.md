# AUD_20260831_005 — Results semantics and compactness

## Status
Qualified

## Scope
Review and implementation of the Results redesign tracked by WI_20260831_005, ADR_002 and GitHub issue #22.

## Finding
The previous Optimization view computed both the Pearson parameter-correlation matrix and the 1D density heatmaps directly from `run.optimization`. This made those visualizations reflect optimizer sampling behavior rather than only the underlying uniformly sampled circuit landscape.

## Decision
- Treat `run.linear` as the source for uniform-space circuit-analysis views.
- Treat `run.optimization` only as the source for optimizer diagnostics.
- Keep optimization values raw in parameter-history plots; do not metric-weight parameter values.
- Reduce scrolling by showing one principal analysis panel at a time per stage.

## Implemented
- Linear: compact `Landscape`, `Correlation`, `1D profiles`, and `Point data` views.
- Correlation includes the selected metric and is fed by the Linear table.
- 1D profiles aggregate the selected metric by parameter value using an unweighted arithmetic mean over the supplied uniform table.
- Optimization: compact `Best objective` and `Parameter history` views.
- Parameter history plots raw sampled parameter values versus evaluation number.
- Existing point inspection, retained-array loading, complex-component selection, custom X vectors and CSV trace export remain available under `Point data`.
- No storage-schema or optimizer-mathematics change was introduced.

## Checks actually performed
- Added Vitest coverage for unweighted metric-profile aggregation and metric-inclusive correlation dimensions.
- GitHub `Governance check` completed successfully on PR #24 before the ADR/audit follow-up commit.
- PR #24 was confirmed mergeable by GitHub at that point.

## Pending validation
- `npm run build` and the full Vitest suite have not been executed in a build-capable checkout during this change.
- A local GUI smoke test should switch through all Linear/Optimization views and verify retained-array interaction.
- A fresh scientific run should confirm that the persisted Linear table presented to the GUI is the intended uniform dataset for the selected project.

The change is therefore recorded as `qualified`: the semantic source separation is explicit in code and documentation, while local build/runtime validation remains pending.
