# Cost + performance definitions for the minimal 1-port example.
# JCO calls: user_cost(S, Sphase, device_params_set, delta_correction)
# Update plot on the GUI: plot_update(p, device_params_set, metric)


"""Return gain (dB) from S11 for a 1-port circuit."""
function gain_db_from_S11(S::Dict{Tuple{Int,Int}, Vector{ComplexF64}})
    s11 = S[(1,1)]
    return 10 .* log10.(abs2.(s11))
end

function user_cost(S, Sphase, device_params_set::Dict, delta_correction::Float64)

    # frequency axis is available through global sim_vars in the current JCO setup
    # (compat layer). It contains w_range in rad/s.
    f_GHz = sim_vars[:frequency_range]

    gain_db = gain_db_from_S11(S)

    p = plot(
        f_GHz,
        -gain_db,
        label="",
        xlabel="Frequency (GHz)",
        ylabel="Gain (dB)",
        legend=:bottomleft,
    )
    metric = -maximum(gain_db)
    #plot_update(p, device_params_set, metric)
    
    return metric
end

# Optional hooks (used by the optimizer/nonlinear pipeline). Keep them defined for completeness.
function user_performance(sol, optimal_params, device_parameters_set)
    # frequency axis is available through global sim_vars in the current JCO setup
    # (compat layer). It contains w_range in rad/s.

    s11 = sol.linearized.S((0,),1,(0,),1,:)
    f_GHz = sim_vars[:frequency_range]

    S11 = 10 .* log10.(abs2.(s11))

    p = plot(
        f_GHz,
        -S11,
        label="",
        xlabel="Frequency (GHz)",
        ylabel="Gain (dB)",
        legend=:bottomleft,
    )
    metric = -maximum(S11)
    plot_update(p, optimal_params, metric)
    return metric
end

function user_delta_quantity(S, Sphase, optimal_params)
    return 0.0
end