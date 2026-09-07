# AUD_20260828_005 — Optimizer and metric regression fixes

## Status
Qualified pending a fresh maintainer-side Julia run.

## Evidence inspected
Uploaded project archive `chalmers_3wm(3).jco` produced with the point-addressable saved-data implementation.

Observed failures:
- `InexactError: Int64(3.492464806373876)` during Optimization.
- `ArgumentError: New columns must have the same length as old columns` when `user_cost` returned `(metric, S21_band, S21_band_std)` only for unmasked points.

Observed saved-data behavior before the optimizer failure:
- `df_uniform_analysis.h5` contained four rows with stable point IDs 1–4.
- Points 1 and 2 were masked (`metric = 1e8`).
- Points 3 and 4 were unmasked and reached `save_datas(S21)`.
- `saved_data/custom.h5` contained point groups 000003 and 000004, each with the matching device parameters and an 1800-sample saved array.
- Absence of saved arrays for points 1 and 2 is expected because `user_cost` returns at the mask before `save_datas` is reached.

## Root cause 1 — Optimization
The legacy optimizer inferred design variables with `names(df)[1:end-1]` and inferred the objective from the last DataFrame column. After `point_id` and arbitrary analysis metrics were added to the summary schema, this assumption became invalid. `point_id` entered the surrogate search domain (1–4); generated samples such as 3.492464806... later reached integer point-ID handling and raised `InexactError`.

Fix: desktop GUI optimization now selects parameter columns explicitly from `device_parameters_space` and selects `df.metric` explicitly as the optimization objective. `point_id` and analysis metrics are excluded by construction.

## Root cause 2 — Sparse named metrics
Masked points returned only scalar `metric`, while unmasked points returned additional named metrics. The accumulator created extra-metric vectors only when those metrics appeared, making them shorter than the DataFrame row count.

Fix: unavailable analysis metrics are padded with `NaN` on earlier/masked rows, preserving a rectangular summary table and exact point-ID alignment.

## Saved-data usability refinement
Bare `save_datas(array)` now follows the active stage automatically (`linear` in `user_cost`, `nonlinear` in `user_performance`). Explicit `category="custom"` remains supported.

## Validation limitation
Julia is unavailable in the assistant execution environment. The uploaded `.jco` is strong evidence for both diagnosed root causes and for point-addressed selected-data persistence, but the fixes require one fresh user-side run before this audit can be upgraded from qualified.
