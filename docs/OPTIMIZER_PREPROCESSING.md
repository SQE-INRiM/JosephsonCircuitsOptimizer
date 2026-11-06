# Optimizer preprocessing: physical coordinates and feasibility

This branch introduces two deliberately separate changes to the existing optimizer.
It does **not** change `user_cost`, the objective values, the optimizer strategy
(SRBF / EI / LCBS), or how constrained acquisition works.

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

**Important:** feasibility is **metadata only in this step**. The optimizer
still fits and minimizes the same metric, including any user-defined penalties.
A return value `(metric = -25.0, feasible = false)` is recorded as infeasible,
but its unpenalized `metric` still influences the surrogate. Existing numerical
penalties must therefore remain in `user_cost` until constrained acquisition
is implemented and tested in a separate change. This makes the migration
backward compatible instead of silently changing the optimization.

## 3. Intentionally out of scope

- Optimizer stopping and `maxiters` semantics in Surrogates.jl
- Surrogate choice and acquisition logic
- Separate feasibility classifiers / constrained Bayesian optimization
- Penalty magnitudes or changes to user-defined mask conditions
- GUI plot redesign and external `.jco` file format

Previously saved linear datasets without `feasible` remain loadable.
When filtering those datasets, the legacy threshold still applies.

## 4. Regression checks

Run from repository root (with Julia and dependencies installed):

```bash
julia --project=. test/optimizer_preprocessing.jl
```

Tests cover scaling, inverse conversion, constant parameter handling, invalid
bounds, explicit and legacy feasibility, and filtering. For integration
testing, run an existing `.jco` with an `I0` / `Cg` sweep and verify:
the saved coordinates have physical units, the new `feasible` columns match
mask results, and no masked point changes its numerical `metric`.
