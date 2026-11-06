# Pure matching helpers for reusing a correction already evaluated by an HB sweep.
# In both CLI and GUI sweeps, each saved result has (freqs, amps, delta_quantity,
# converged). Keep at most the scalar correction: do not retain an HB solution
# for every amplitude point.

# Use a tight floating-point tolerance for sweep-grid arithmetic, without
# confusing physically distinct source configurations. Every source must match.
function _jco_feedback_valid_source_vector(values)
    return values isa AbstractVector && !isempty(values) &&
        all(x -> x isa Real && isfinite(x), values)
end

function _jco_feedback_sources_match(actual, reference)
    _jco_feedback_valid_source_vector(actual) || return false
    _jco_feedback_valid_source_vector(reference) || return false
    length(actual) == length(reference) || return false
    return all(zip(actual, reference)) do (a, b)
        isapprox(a, b; rtol=1e-12, atol=0)
    end
end

"""
    feedback_correction_from_sweep(results, reference_amplitudes, reference_frequencies)

Return the already-computed `delta_quantity` from a *converged* HB point
whose complete source-amplitude and source-frequency vectors match the
feedback reference. Return `nothing` when there is no safe match.

The sweep has already called `user_nonlinear_correction(sol_linear,
sol_nonlinear, device_params_set)` for each retained point. Thus the matching
scalar can be reused for the next correction cycle without constructing a
second circuit and running another linear and nonlinear HB solve.

The caller must pass only results from the immediately preceding nonlinear
sweep of the same optimized device. Incomplete/nonconverged points are never
reused.
"""
function feedback_correction_from_sweep(results, reference_amplitudes, reference_frequencies)
    results === nothing && return nothing
    _jco_feedback_valid_source_vector(reference_amplitudes) || return nothing
    _jco_feedback_valid_source_vector(reference_frequencies) || return nothing
    length(reference_amplitudes) == length(reference_frequencies) || return nothing
    for point in results
        hasproperty(point, :converged) && point.converged === true || continue
        hasproperty(point, :amps) && hasproperty(point, :freqs) &&
            hasproperty(point, :delta_quantity) || continue
        correction = point.delta_quantity
        correction isa Real && isfinite(correction) || continue
        _jco_feedback_sources_match(point.amps, reference_amplitudes) || continue
        _jco_feedback_sources_match(point.freqs, reference_frequencies) || continue
        return correction
    end
    return nothing
end
