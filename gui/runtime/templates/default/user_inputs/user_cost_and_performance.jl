# Cost and performance definitions for the minimal 1-port example.
# The first named value is the optimization objective. Later values are saved
# as additional analysis columns by JCO.

"""Return gain in dB from S11 for a 1-port circuit."""
function gain_db_from_S11(S11)
    return 10 .* log10.(abs2.(S11))
end

function user_cost(sol, device_params_set, nonlinear_correction)
    s11 = sol.linearized.S((0,), 1, (0,), 1, :)
    gain_db = gain_db_from_S11(s11)
    peak_gain = maximum(gain_db)
    mean_gain = mean(gain_db)
    metric = -peak_gain

    return (
        metric = metric,
        peak_gain = peak_gain,
        mean_gain = mean_gain,
    )
end

function user_performance(sol, device_params_set, source_amps, source_freqs)
    s11 = sol.linearized.S((0,), 1, (0,), 1, :)
    gain_db = gain_db_from_S11(s11)
    performance = maximum(gain_db)

    return (
        performance = performance,
        mean_gain = mean(gain_db),
        gain_ripple = std(gain_db),
    )
end

# Nonlinear correction is intentionally disabled for now, but JCO expects the
# hook to exist while running the nonlinear stage.
function user_nonlinear_correction(S_linear, sol, device_params_set)
    return 0.0
end
