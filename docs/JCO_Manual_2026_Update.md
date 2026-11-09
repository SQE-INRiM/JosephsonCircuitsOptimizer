# JCO User Manual — November 2026 update

*Supplement to the original 19-page JCO User Manual. The original chapters, figures and formatting are preserved in the PDF. This supplement updates the desktop GUI, project handling, saved Results and nonlinear feedback. Where an older GUI instruction conflicts with this update, follow this section.*

## 1. Current desktop application

The desktop GUI has three work areas: **Setup**, **Run**, and **Results**. The project-name control and application menu give access to **New**, **Open**, **Save**, **Save As**, bundled examples, **Julia settings**, **About JCO**, and the theme. A single `.jco` file can be opened through **Open** or by dragging and dropping it onto the application. Save the project before running; completed numerical runs are retained inside the portable project.

The latest Setup is arranged as **Model & inputs**, **Computation**, and **Metrics & constraints**:

- **Circuit**: write or edit `create_user_circuit(device_params_set)`; generate a resolved lumped-element preview on demand. Opening a project does not execute its Julia code.
- **Device parameters**: for each model key, choose **Fixed**, **Range** (start/stop/step), or **List**. These values define the linear sweep. A fixed-only model can be analyzed, but its Optimization and nonlinear feedback loops are unavailable.
- **Sources**: assign source ports, AC/DC type, frequencies, linear amplitudes, and nonlinear amplitudes. Source values can be Fixed, Range, List or user-defined Parametric. The AC interface supports A/dBm display; the solver uses physical current amplitudes in A, including DC sources.
- **Computation**: configure probe-frequency range, surrogate optimizer settings, separate harmonic limits for linear and nonlinear simulation, and common `hbsolve` controls. The nonlinear feedback card is located after the harmonic and solver controls.
- **Metrics & constraints**: open distinct editors for **Cost**, **Performance**, and **Nonlinear correction**. Other helper functions remain in their shared Julia source file; a full-file editor is available when needed.

**Run** starts the complete Linear → Optimization → Harmonic balance workflow or a compatible stage-only run. Its numerical stage cards show progress and logs; feedback cycles add a separate status card and cycle indicator. The first three numerical stages are reused or recomputed according to the selected run and current inputs. When feedback is enabled, it operates only during a **full** run.

**Results** is organized by one selected saved **Run**, followed by Linear, Optimization and Harmonic balance views. **Manage runs**, **Export CSV**, **Simulation info**, and **Delete run** operate on the selected stored run. Saved numerical output is independent of the currently edited Setup.

## 2. Defining nonlinear feedback

Nonlinear feedback is **optional and disabled by default**. It evaluates a user-defined scalar correction from two JosephsonCircuits harmonic-balance solutions at a reference working point and uses that value in subsequent device-parameter optimization cycles.

The three Julia functions have different responsibilities:

```julia
function user_cost(sol, device_params_set, nonlinear_correction)
    s11 = sol.linearized.S((0,), 1, (0,), 1, :)
    metric = mean(10 .* log10.(abs2.(s11))) + nonlinear_correction
    return (metric = metric,)
end

function user_performance(sol, device_params_set, source_amps, source_freqs)
    s21 = sol.linearized.S((0,), 2, (0,), 1, :)
    gain_db = 10 .* log10.(abs2.(s21))
    return (performance = mean(gain_db), peak_gain_db = maximum(gain_db))
end

function user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)
    s_off = sol_linear.linearized.S((0,), 1, (0,), 1, :)
    s_on  = sol_nonlinear.linearized.S((0,), 1, (0,), 1, :)
    db(x) = 10 .* log10.(abs2.(x))
    return mean(db(s_on)) - mean(db(s_off))
end
```

Here **`sol`, `sol_linear`, and `sol_nonlinear` are full `hbsolve` solution objects**, not precomputed dictionaries of S-parameters. The `(0,)` selector accesses the zero-sideband (fundamental) linearized scattering response. Port numbers in the example must be adapted to the user circuit. The correction function returns a finite scalar; its numerical meaning and units are chosen by the user.

**Important:** JCO does not add the feedback term automatically to your objective. The third argument of `user_cost` must be used explicitly when feedback is intended to affect the cost. An identical additive scalar at all candidate points shifts all costs by the same amount and does not by itself change the minimizer.

If an older feedback function expects an S-parameter dictionary (for example, `S_linear[(1,1)]`), update it to use `sol_linear.linearized.S(...)`; JCO does not silently rewrite existing Julia code.

## 3. Reference currents and stopping settings

Enable feedback in **Setup → Computation → Nonlinear feedback**. For **each source, including DC sources**, provide a finite **reference current in A**. A positive, zero or negative value is valid where physically appropriate. The feedback reference is a single operating current per source, distinct from the nonlinear amplitude sweep grid. Missing or nonfinite reference currents are invalid when feedback is enabled.

The selected reference currents and source frequencies define the operating point for the correction. If the preceding nonlinear HB sweep already contains a **converged** point with the matching complete current **and** frequency vectors, JCO reuses its calculated correction. Otherwise it performs a separate linear and nonlinear simulation at that reference point.

Choose one stopping mode:

| GUI setting | Meaning |
| --- | --- |
| **Fixed cycles** | Run the requested number of corrected cycles after the baseline run. |
| **Metric convergence** | Compare one selected scalar quantity between successive *completed corrected cycles*; stop when the requested tolerance is met or the maximum number of cycles is reached. |
| **Monitor** | Choose **Cost**, **Performance**, or **Correction**. |
| **Change** | **Absolute** difference in the selected metric's units, or **Relative** difference in percent. |
| **Tolerance** | Positive, finite threshold. |
| **Maximum cycles** | Safety limit for convergence mode; at least **two** corrected cycles. |

The current code uses these comparisons for successive corrected values \(a\) and \(b\):

```text
Absolute:  abs(b - a) <= tolerance
Relative:  100 * abs(b - a) / max(abs(a), abs(b), eps) <= tolerance
```

For relative mode, `tolerance` is given as a **percentage**. Cost is the corrected optimizer objective that JCO **minimizes**; Performance is the best **evaluated** HB performance of that cycle that JCO **maximizes**; Correction is the scalar returned by the user feedback function. A nonfinite metric is an error, not successful convergence.

**Cycle 0** is the original uncorrected Linear/Optimization/HB run. It is **not a corrected cycle**, and convergence comparisons begin only after two corrected cycles have completed. Convergence is a stopping criterion, not evidence that the circuit is globally optimal or that the HB solution is physically validated.

## 4. Following feedback during Run and Results

For a full feedback run, **Run** displays the current Cycle N relative to the configured maximum, and counts **completed** corrected cycles. The Linear, Optimization and Harmonic balance stage cards show the current cycle's computations. A dedicated feedback card reports the loop status and completion; convergence may terminate the run before the maximum. Cancellation or failure is not displayed as successful convergence.

The **Results** page offers a compact **Cycle 0 / Cycle N** selector above the Linear, Optimization and Harmonic balance tabs. The selected cycle determines the numerical dataset, retained arrays, point comparisons and stage CSV exports. Each corrected cycle has its own saved Linear, Optimization and HB data, so the original Cycle 0 is not overwritten.

Selecting **Nonlinear feedback** opens the overall summary: the best evaluated nonlinear HB performance versus cycle and the history of optimized device parameters, with convergence or cycle-limit status when available. The summary describes completed cycles; a partially written or failed cycle is not treated as a converged history point. To see the numerical details for a particular cycle, select that cycle and return to one of the three stage tabs.

Per-cycle data are stored under `feedback/cycle_NNN/` in the run's output directory, with the baseline data at the normal run root. JCO also stores `feedback/summary.json`. Saved cycle datasets are included in the portable `.jco` archive.

## 5. Results and compatibility notes

The current Results interface includes:

- **Linear**: the parameter-space landscape, masks and fixed-parameter slices; retained frequency-resolved data can be displayed for selected points. One-point studies still show their sampled point.
- **Optimization**: an aligned Linear slice or an all-point projection, markers for sampled-optimum and stored Linear values, an optional evaluation trajectory, and a separate History view. History is disabled when fewer than two usable evaluations exist.
- **Harmonic balance**: working-point performance, amplitudes/frequencies, convergence and selected saved traces. The amplitude-response view is not enabled for a single HB operating point.
- **Exports and retention**: Export CSV operates on the selected run and cycle. `@save_data` explicitly retains arrays for plotting; the default `selected` trace policy saves selected arrays, while `all` also keeps diagnostic fundamental S-parameter traces and `none` keeps numerical summary tables only.

A `.jco` file is a versioned ZIP package of editable user inputs and numerical results. Older projects remain importable. The feedback settings live in `simulation_config.json`:

```json
{
  "n_iterations_nonlinear_correction": 0,
  "nonlinear_feedback_stop_mode": "cycles",
  "nonlinear_feedback_metric": "correction",
  "nonlinear_feedback_tolerance_type": "absolute",
  "nonlinear_feedback_tolerance": 0.01
}
```

The integer count is 0 when feedback is disabled, a **fixed number of cycles** in fixed mode, or the **maximum number of cycles** in convergence mode. Reference currents are saved with the per-source settings as `source_i_non_linear_amplitude_for_delta_correction`. Projects without the newer stopping keys retain the fixed-cycle behavior.

Before relying on a feedback result scientifically, verify the physical meaning of the cost and correction, source units and matching reference currents, S-parameter port indices, mask feasibility, and HB convergence of the selected working points.

---

*This supplement documents features present in the repository at the time of writing (November 2026). A tagged desktop release may contain an earlier GUI; check the release notes when comparing screenshots and controls.*
