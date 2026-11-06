# Optimizer preprocessing: physical coordinates and feasibility

This branch introduces normalization, explicit feasibility, and a **second
step** for the tested Kriging + SRBF combination: feasibility-aware candidate
selection. It does **not** change `user_cost`, raw objective/penalty values,
physical units, nonlinear feedback, or the format of existing `.jco` files.

## 1. Coordinates only inside the surrogate

For every device parameter `p`, the linear dataset defines physical minimum
`lo` and maximum `hi`. The optimizer sees:

```julia
z = hi == lo ? 0.0 : (p - lo) / (hi - lo)
```

Bounds for varying parameters become `[0, 1]`. Fixed parameters remain at
`z = 0` with bounds `[0, 0]`, preserving existing parameter-vector shapes.

The surrogate is fitted on normalized coordinates; before evaluating a new
point, JCO calls the **unchanged** `cost` with:

```julia
p = lo + z * (hi - lo)
```

The saved linear dataset, optimization history, user-defined code, GUI units,
and `optimal_device_parameters.json` still use physical values (A, F, H, etc.).
The same helper in `src/optimizer.jl` is used by the native Julia engine and
the GUI's runtime override, rather than maintaining two implementations.

## 2. Feasibility is separate metadata

For every `cost` evaluation JCO now records a `feasible` value:

- `1` = feasible
- `0` = masked / infeasible

The linear and optimizer HDF5 summary tables store it as a **numeric** column
for compatibility with the existing summary matrix format. Cost history
also stores the corresponding Boolean vector under `feasible`.

Legacy projects need no edits: finite `metric < 9e7` means feasible; otherwise
the point is masked. This is the existing filtering convention, now explicit
and shared between sweep filtering and saved summary tables.

For more precise classification, `user_cost` can optionally return a
`feasible` field, keeping the objective first:

```julia
return (
    metric = mask_failed ? 1e8 : physical_metric,
    feasible = !mask_failed,
    mean_s11 = mean_s11,
)
```

The optional field accepts Bool or 0/1. An explicitly declared flag overrides
the legacy threshold when the objective is finite.

**Important:** `feasible` controls training and candidate selection for
**Kriging + SRBF**. A masked point is excluded from the Kriging metric
training set, but remains in the feasibility model. The original penalty is
still stored unmodified for reporting and backward compatibility.

The feasibility classifier is a transparent, inverse-distance weighted
8-nearest-neighbor estimator in the normalized parameter space. It uses
**all** linear evaluations and is updated with each new candidate's actual
feasibility. Its score is used to prefer likely-feasible candidates, not to
declare physical validity: `user_cost` is always the final authority.

The constrained SRBF loop is now JCO-owned (`src/ConstrainedSRBF.jl`), and
its small steps are explicit:

1. Identify the lowest-cost **feasible** measured point on the uniform grid.
2. Fit Kriging using the feasible points only.
3. Generate `Samples / iteration` inexpensive candidates around the current
   best point, in normalized coordinates.
4. Rank candidates by predicted cost, novelty, and feasibility score; select
   one for a real physical simulation.
5. Record its unchanged metric and feasibility. Update Kriging **only** for
   a feasible point; update the classifier for **every** evaluated point.

`Iterations` now means the maximum number of *new physical evaluations*
for this specific combination. The local search starts with a normalized
radius of 0.15 in each varying dimension; it shrinks after an improvement
and expands after repeated failures. This is an intentional, documented
change from the earlier external SRBF loop, and does **not** certify a
global optimum. The best **feasible measured** point is always returned.

Other surrogate / strategy combinations (RBF / polynomial or EI / LCBS)
retain the original Surrogates.jl optimization and legacy penalties for now.
A warning is emitted when these legacy paths encounter masked points;
their acquisition functions have not yet been adapted.

## 3. Intentionally out of scope

- Changes to the Surrogates.jl library itself or its EI / LCBS strategies
- Fully probabilistic or calibrated constraint modeling (current classifier is local kNN)
- Penalty magnitudes or changes to user-defined mask conditions
- Convergence certification and global-optimum guarantees
- GUI plot redesign and external `.jco` file format

Previously saved linear datasets without `feasible` remain loadable.
When filtering those datasets, the legacy threshold still applies.

## 4. Regression checks

Run from repository root (with Julia and dependencies installed):

```bash
julia --project=. test/optimizer_preprocessing.jl
julia --project=. test/optimizer_constrained_srbf.jl
```

Tests cover scaling, inverse conversion, constant parameter handling, invalid
bounds, explicit and legacy feasibility, and filtering. For integration
testing, run an existing `.jco` with an `I0` / `Cg` sweep and verify:
the saved coordinates have physical units, the new `feasible` columns match
mask results, and no masked point changes its numerical `metric`.

## 5. GUI runtime override note

The desktop bridge in `gui/runtime/bridge/run.jl` includes additional methods
**after** the package's native implementation. In particular:

- `gui_cost_history_fix.jl` replaces `cost` to ensure sampled parameter
  tuples are persisted as vectors. It must update `last_cost_metrics[:feasible]`
  and append to `cost_history["feasible"]`, just as the engine does.
- `gui_optimizer_persistence_diagnostics.jl` replaces the optimizer HDF5
  history writer. It must append `feasible` after `metric` in the
  `df_optimization_column_names` schema.

These two later overrides have been synchronized on this branch. This fixes
a GUI-specific case discovered by comparing the November 5 and 6 runs in
`JTWPA_4WM_Kerr_reversal_NL_feedback_full_grid.jco`. The original November 6
export recorded 13 new BO evaluations but had no `feasible` values because
the later overrides had not yet been updated. Previously exported runs remain
unchanged; re-run to populate this metadata.
