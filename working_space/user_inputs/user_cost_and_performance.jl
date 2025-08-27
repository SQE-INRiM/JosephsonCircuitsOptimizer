include("user_metric_utils.jl")

#--------------------------------------------------------------------------------

# To use the S parameters the correct notation is S_ij = S[(i,j)] for the module and Sphase[(i,j)] for the phase
# All the physical quantities are inside a Dict called sim_vars

function user_cost(S, Sphase, device_params_set::Dict, delta_correction)

    # USER CONDITION-------------------------------------------------

    S11 = S_to_dB(S[(1,1)])
    S21 = S_to_dB(S[(2,1)])

    S11band = S_values(S11, [4.75e9,6.75e9])

    maxS11band = maximum(S11band)
    meanS11band = mean(S11band)

    S11pump = S_values(S11, 11.5e9)
    S21pump = S_values(S21, 11.5e9)

    S21phaseBand = S_values(Sphase[(2,1)], 5.75e9)
    S21phasePump = S_values(Sphase[(2,1)], 11.5e9)

    length = device_params_set[:N]
    deltaK = (S21phasePump-2*S21phaseBand)/length
    @debug "Delta K: $(deltaK)"
    deltaK = delta_correction + deltaK
    @debug "Delta K with correction: $(deltaK)"

    #----------------------------------------------------------------
    """
    # MASK (if necessary)

    input_mask = (
        meanS11band = meanS11band,
        S11pump     = S11pump,
        S21pump     = S21pump,
        deltaK      = deltaK
    )

    conditions_mask = x -> x.meanS11band < -15 && x.S11pump < -8 && x.S21pump > -4 && x.deltaK < 0.2

    # Apply the mask
    if mask(input_mask, conditions_mask) return 1e8 end 
    
    """
    
    #---------------------------------------------------------------

    # METRIC DEFINITION

    metric_impedance = (1e3/(abs(meanS11band)))
    println("   a. Impedance matching contibution: ", metric_impedance)

    metric_phase = 1e11*deltaK
    println("   b. Phase matching contribution: ", metric_phase)

    metric =  metric_impedance + metric_phase

    @debug "Impedance matching contribution: $(metric_impedance)"
    @debug "Phase matching contribution: $(metric_phase)"
    @debug "Metric: $(metric)"

    #plots

    p4=plot_dispersion_relation(Sphase[(2,1)], device_params_set)
    empty_plot=plot([], legend=false, grid=false, framestyle=:none)
    P.annotate!(
        empty_plot,
        0.5,
        0.5,
        "Plot number: $(plot_index)\n" *
        "Delta K: $(round(deltaK, digits=2))\n\n" *
        "a. Impedance matching contibution: $(round(metric_impedance, digits=2))\n\n" *
        "b. Phase matching contribution: $(round(metric_phase, digits=2))\n\n" *
        "Metric: $(round(metric, digits=3))\n\n" *
        "loadingpitch = $(round(device_params_set[:loadingpitch], digits=3)) \n"*
        "A_small = $(round(device_params_set[:smallJunctionArea], digits=3)) \n" *
        "alphaSNAIL = $(round(device_params_set[:alphaSNAIL], digits=3))\n"*
        "LloadingCell = $(round(device_params_set[:LloadingCell], digits=3)) \n"*
        "CgloadingCell = $(round(device_params_set[:CgloadingCell], digits=3))\n"*
        "criticalCurrentDensity = $(round(device_params_set[:criticalCurrentDensity], digits=3))\n"*
        "CgDielectricThickness = $(round(device_params_set[:CgDielectricThichness], digits=3))\n"
    )

    #sleep(2)

    p=plot(p4,empty_plot, layout=(1,2), size=(1100, 700))
    #display(p)
    #plot_update(p)

    return metric
        
end



#--------------------------------------------------------------------------------

# The first index is the frequency range, the next indeces correspond to the source in order you write it.


function user_performance(sol, device_params_set)

    S21 = sol.linearized.S((0,),2,(0,),1,:)
    gain_S21 = S_to_dB(S21)
    S21phase = S_to_phase(S21)

    gain_band = S_values(gain_S21, [4.75e9,6.75e9])
    gain_val = mean(gain_band)
    println("Gain in the band [4.75, 6.75] GHz: ", gain_val)

    p4=plot_dispersion_relation(S21phase, device_params_set)
    plot_update(p4)
    #display(p4)

    #p = plot_gain(gain_S21)
    #display(p)

    return gain_val

end



#--------------------------------------------------------------------------------

# Nonlinear correction

function user_delta_quantity(S, Sphase, device_params_set)

    S21phaseBand = S_values(Sphase[(2,1)], 5.75e9)
    S21phasePump = S_values(Sphase[(2,1)], 11.5e9)

    length = device_params_set[:N]
    deltaK = (S21phasePump-2*S21phaseBand)/length

    return deltaK
    
end