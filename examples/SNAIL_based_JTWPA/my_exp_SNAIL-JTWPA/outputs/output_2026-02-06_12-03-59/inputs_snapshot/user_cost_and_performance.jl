include("user_metric_utils.jl")

#--------------------------------------------------------------------------------


# To use the S parameters the correct notation is S_ij = S[(i,j)] for the module and Sphase[(i,j)] for the phase

function user_cost(S, Sphase, device_params_set::Dict, delta_correction::Float64)

    println("-----------------------------------------------------")

    # USER CONDITION-------------------------------------------------

    maxS11band, meanS11band = S_values(S[(1,1)], [6e9,8e9])

    S11pump = S_values(S[(1,1)], 14e9)
    S21pump = S_values(S[(2,1)], 14e9)

    S21phaseBand = S_values(Sphase[(2,1)], 7e9; phase=true)
    S21phasePump = S_values(Sphase[(2,1)], 14e9; phase=true)

    deltaK = abs((S21phasePump-2*S21phaseBand)/device_params_set[:N])

    #----------------------------------------------------------------
    """
    # MASK (if necessary)

    input_mask = (
        meanS11band = meanS11band,
        S11pump     = S11pump,
        S21pump     = S21pump,
        deltaK      = deltaK
    )

    conditions_mask = x -> x.meanS11band < -20 && x.S11pump < -10 && x.S21pump > -4 && x.deltaK < 0.35

    # Apply the mask
    if mask(input_mask, conditions_mask) return 1e8 end 
    """    
    #---------------------------------------------------------------

    # METRIC DEFINITION
    
    metric = (1e2/(abs(maxS11band)))
    
    return metric
        
end


function user_performance(sol, device_params_set)

    S21 = sol.linearized.S((0,),2,(0,),1,:)
    gain_S21 = S_to_dB(S21)

    gain_band = S_values(gain_S21, [4.75e9,6.75e9])
    gain_val = mean(gain_band)
    println("Gain in the band [4.75, 6.75] GHz: ", gain_val)

    p = plot_gain(gain_S21)
    plot_update(p)
    
    return gain_val
end


function user_delta_quantity(S, Sphase, optimal_params)
    return 0.0
end