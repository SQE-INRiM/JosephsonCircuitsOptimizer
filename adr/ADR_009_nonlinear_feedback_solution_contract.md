# ADR_009 — Full HB solution inputs for nonlinear feedback

- Status: proposed (draft PR #24)
- Date: 2026-11-04
- Scope: JCO user-defined nonlinear correction API and GUI bridge

## Context

JCO already supplies the full JosephsonCircuits harmonic-balance solution to
`user_cost(sol, device_params_set, nonlinear_correction)` and
`user_performance(sol, device_params_set, source_amps, source_freqs)`.
Historically, the feedback hook instead received a reduced linear S-parameter
dictionary and the full nonlinear solution:

```julia
user_nonlinear_correction(S_linear, sol, device_params_set)
```

This mixed contract makes the two evaluations harder to compare and hides
linear solution information other than the extracted zero-mode S-parameters.

## Decision

Pass the **complete linear and nonlinear `hbsolve` solutions** to the
user-defined feedback hook:

```julia
function user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)
    S11_linear = sol_linear.linearized.S((0,), 1, (0,), 1, :)
    S11_pumped = sol_nonlinear.linearized.S((0,), 1, (0,), 1, :)
    return 0.0  # User defines a physically meaningful correction.
end
```

The engine obtains `sol_linear` through `linear_solution(...)`, which returns
the full solution without performing an S-parameter extraction, and obtains
`sol_nonlinear` from `nonlinear_simulation(...).sol`. The full Julia pipeline,
ordinary HB sweep, and GUI runtime override use the same positional contract.
For each fixed device configuration and combination of source frequencies,
the HB sweep can reuse one linear solution across its nonlinear amplitude grid.

No change is made to `user_cost`, `user_performance`, the interpretation of
the returned scalar correction, optimization objective, output names, or the
`.jco` project serialization schema. `linear_simulation` remains available
as the explicit reduced-S-dictionary convenience function.

## Compatibility and migration

The Julia *argument names* themselves do not matter. Existing functions that
ignore their first argument (e.g. return `0.0`) continue to work positionally.

Existing user-authored functions that index the first argument as a dictionary
(e.g. `S_linear[(1, 1)]`) **must be updated**. New projects use the new
signature. JCO must not silently rewrite arbitrary Julia code or attempt an
exception-based fallback to the old representation. For example:

```julia
# Old:
S11_linear = S_linear[(1, 1)]

# New:
S11_linear = sol_linear.linearized.S((0,), 1, (0,), 1, :)
```

The nonlinear solution uses the matching
`sol_nonlinear.linearized.S((0,), 1, (0,), 1, :)` accessor for the pumped,
small-signal linearized scattering response.

## Verification and limitations

- Review call sites in the Julia feedback helper, standalone HB sweep, and GUI
  runtime override; check that each supplies two full solutions.
- Verify that GUI editor navigation preserves the full Julia source in the same
  `user_cost_and_performance.jl` file.
- On a representative circuit, compare the zero-mode S-parameters extracted
  from `linear_solution` with the previous `linear_simulation` output, within
  numerical solver tolerance.
- Validate correction values and HB convergence at selected pump amplitudes
  and source-frequency configurations, including multi-source/DC setups.
- The existing feedback-cycle algorithm, global scalar correction, and
  nonlinear convergence handling have separate known limitations; this
  decision does not claim to validate or repair the iterative optimization.

Real Julia/HB scientific reference runs are **pending**, not implied by GUI
or static tests.
