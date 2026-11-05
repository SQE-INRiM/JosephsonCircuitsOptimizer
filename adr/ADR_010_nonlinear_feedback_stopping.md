# ADR_010 — Nonlinear feedback stopping criteria

- Status: proposed (draft PR #24)
- Date: 2026-11-05
- Scope: full-run nonlinear feedback settings, Julia engine and .jco inputs

## Context

JCO's existing full-workflow nonlinear feedback uses the integer
`n_iterations_nonlinear_correction` to run a fixed number of correction
cycles. It already computes three observable values per completed corrected
cycle: optimized cost, best HB performance, and the user-defined nonlinear
correction. A user may want to stop when the value of interest stabilizes,
rather than unconditionally executing the full number of costly HB cycles.

## Decision

Provide two exclusive stopping modes:

1. **Fixed cycles**: execute the configured positive count of feedback cycles,
   preserving the existing behavior for previously saved projects.
2. **Metric convergence**: execute up to a configured positive *maximum* of at
   least two cycles; after each completed corrected cycle, compare one of:
   - `cost`: the corrected optimized objective `optimal_metric` (minimized);
   - `performance`: the best nonlinear HB performance across the cycle's
     working-point sweep (maximized);
   - `correction`: the scalar returned by
     `user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)`.

The comparison is made **between successive completed corrected cycles**,
not between an uncorrected baseline and the first corrected result. The user
chooses a strictly positive, finite threshold and comparison convention:

- `absolute`: `abs(x_current - x_previous) <= tolerance`, in the metric's own units;
- `relative`: `100 * abs(x_current - x_previous) / max(abs(x_current), abs(x_previous), eps(Float64)) <= tolerance`,
  where tolerance is specified as a percentage.

A nonfinite or non-real selected metric is an explicit error, never evidence
of convergence. A finite maximum cycle count protects runs that cannot
converge. There is no stability-window requirement beyond two successive
corrected values; more conservative criteria may be considered separately.

## Persistence and compatibility

Retain the existing integer `n_iterations_nonlinear_correction`; interpret
it as the maximum cycle count for either stopping mode. Add optional keys to
`simulation_config.json`:

- `nonlinear_feedback_stop_mode`: `cycles` (default) or `convergence`
- `nonlinear_feedback_metric`: `cost`, `performance`, or `correction`
- `nonlinear_feedback_tolerance_type`: `absolute` or `relative`
- `nonlinear_feedback_tolerance`: positive numeric threshold

Legacy projects without these keys load with fixed-cycle stopping, preserving
their previous behavior. The new settings are stored inside the existing
`.jco` project format; no archive structure change is required. They do
not change the provenance requirements for reusing prior linear-stage results.

The GUI offers one stopping-mode selector. With convergence selected, it
shows **Monitor**, **Change**, **Tolerance**, and **Maximum cycles**. It
continues to request per-source reference currents in amperes.

## Scientific limitations

This is a *stopping rule*, not proof of correctness or optimality. In
particular, a global scalar correction added uniformly to a linear
objective does not shift its minimizer. Stabilization of an objective or
feedback term must not be interpreted as independent physical validation.

Cost and performance need not be expressed in dB; the absolute tolerance
inherits whichever units the user's Julia code returns. The performance
observable is the best returned HB metric, not the performance evaluated
solely at the linear optimum, and the correction term is sampled at the
preceding device optimum within each feedback iteration. Results depend on
the user's cost/performance definitions and HB convergence.

The existing corrected-cycle working-point saving bug (using the initial
cycle's index or amplitudes) is corrected as part of this change so that
cycle JSON outputs correspond to the actual corrected-cycle HB optimum.

## Verification

- GUI tests for stopping mode, metric, threshold type, tolerance, maximum
  cycles and re-enabling feedback.
- JSON round-trip and validation tests, plus linear stage reuse tests.
- Pure Julia tests in `test/feedback_convergence.jl` for metric selection,
  absolute/relative thresholds, nonfinite values and insufficient history.
- Full Julia/JC simulations exercising actual correction-cycle termination
  and comparing outputs with fixed-cycle runs remain **pending**.
