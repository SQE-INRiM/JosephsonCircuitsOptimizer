# Pure, unit-independent convergence rules for iterative nonlinear feedback.
# This code has no solver dependencies, so its numerical convention can be
# verified independently of Julia/JC harmonic-balance simulations.

function feedback_observed_value(metric::AbstractString, optimized_cost, best_hb_performance, correction)
    value = if metric == "cost"
        optimized_cost
    elseif metric == "performance"
        best_hb_performance
    elseif metric == "correction"
        correction
    else
        throw(ArgumentError("Unknown nonlinear feedback convergence metric: $metric"))
    end
    value isa Real || throw(ArgumentError("Feedback convergence metric '$metric' must be a real scalar."))
    result = Float64(value)
    isfinite(result) || throw(ArgumentError("Feedback convergence metric '$metric' must be finite; received $result."))
    return result
end

"""
    feedback_has_converged(previous, current, tolerance_type, tolerance)

Convergence between *two completed corrected cycles*. The very first value
has no previous corrected cycle and cannot converge.

- absolute: |current - previous| <= tolerance, in the selected metric's units
- relative: 100*|current - previous| / max(|previous|, |current|, eps()) <= tolerance

The denominator uses both magnitudes and eps() to remain defined near zero.
The caller must always enforce a finite maximum number of correction cycles.
"""
function feedback_has_converged(previous::Union{Nothing,Real}, current::Real,
                                 tolerance_type::AbstractString, tolerance::Real)
    tolerance_type in ("absolute", "relative") ||
        throw(ArgumentError("Unknown nonlinear feedback tolerance type: $tolerance_type"))
    isfinite(tolerance) && tolerance > 0 ||
        throw(ArgumentError("Nonlinear feedback tolerance must be positive and finite."))

    isfinite(current) || throw(ArgumentError("Nonlinear feedback convergence value is not finite."))
    previous === nothing && return false
    isfinite(previous) || throw(ArgumentError("Previous nonlinear feedback convergence value is not finite."))

    difference = abs(Float64(current) - Float64(previous))
    if tolerance_type == "absolute"
        return difference <= tolerance
    end
    scale = max(abs(Float64(previous)), abs(Float64(current)), eps(Float64))
    return 100 * difference / scale <= tolerance
end
