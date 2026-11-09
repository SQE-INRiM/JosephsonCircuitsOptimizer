# Optimizer preprocessing: physical coordinates and feasibility

This branch introduces parameter normalization and feasibility metadata,
plus a small, reversible adjustment to the **Kriging + SRBF / EI / LCBS** surrogate targets.
It does **not** change `user_cost`, the original stored metric values, the
underlying Surrogates.jl SRBF algorithm, or the GUI project file format.

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

**Important:** feasibility is still recorded separately from the physical
objective. For **Kriging + SRBF, EI or LCBS**, JCO makes a *training-only* copy of the
objective values, replacing masked entries with a finite penalty:

```julia
valid_min, valid_max = extrema(values_of_feasible_points)
surrogate_mask_value = valid_max + max(1.0, valid_max - valid_min)
```

The original masked entries (often `1e8`) remain unchanged in the linear
dataset and saved history. The same proxy is supplied to the **existing**
Surrogates.jl optimizer when a newly evaluated point is masked; the physical
`cost` still executes and stores its actual result. This prevents artificial
`1e8` values from dominating Kriging without introducing a new search loop.

This is **not** a fully constrained optimizer: masked points are still present
in Kriging's training set, with bounded proxy values. SRBF still uses the
library's original sampling, weighting, and stopping rules, which are
independent issues. **In this experimental branch only**, the bounded proxy
also applies to Kriging + EI / LCBS, but their search algorithms are otherwise
unchanged. If EI / LCBS exhaust iterations without returning a result, JCO
returns the best already evaluated point, with a warning. RBF and polynomial
surrogates retain their previous behavior.

**Caution:** the LCBS implementation in Surrogates.jl v6.11.0 uses
`prediction + k * uncertainty` and an early-stop comparison involving the
signed acquisition score. It can stop immediately with negative dB metrics.
This branch does **not** correct those internal algorithms, and should not
be merged as proof that EI or LCBS converge correctly. For a
`feasible = false` return, the user may keep the original penalty convention;
the surrogate proxy is chosen internally.

## 3. Intentionally out of scope

- Optimizer stopping and `maxiters` semantics in Surrogates.jl
- Surrogate choice and acquisition algorithms
- Separate feasibility classifiers / fully constrained Bayesian optimization
- Changes to user-defined mask conditions or actual stored penalty magnitudes
- GUI plot redesign and external `.jco` file format

Previously saved linear datasets without `feasible` remain loadable.
When filtering those datasets, the legacy threshold still applies.

## 4. Regression checks

Run from repository root (with Julia and dependencies installed):

```bash
julia --project=. test/optimizer_preprocessing.jl
```

Tests cover scaling, inverse conversion, constant parameter handling, invalid
bounds, explicit and legacy feasibility, filtering, bounded surrogate training
values, and preservation of original dataset metrics. For integration
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
