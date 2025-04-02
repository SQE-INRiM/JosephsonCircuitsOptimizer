include("user_metric_utils.jl")

#--------------------------------------------------------------------------------


# To use the S parameters the correct notation is S_ij = S[(i,j)] for the module and Sphase[(i,j)] for the phase

function user_cost(S, Sphase, device_params_set::Dict)

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



#--------------------------------------------------------------------------------

# The first index is the frequency range, the next indeces correspond to the source in order you write it.
# All the physical quantities are inside a Dict called sim_vars



function user_performance(sol)
    num_k = length(sim_vars[:source_1_non_linear_amplitude])
    num_j = length(sim_vars[:source_2_non_linear_amplitude])

    best_max_value = -Inf
    best_k = 0
    best_j = 0

    # Iterate over all combinations of k and j
    for (k, j) in Iterators.product(1:num_k, 1:num_j)

        # Extract solutions for all frequencies for the combination (k, j)
        sol_kj = sol[:, k, j]  # This should be an array or vector

        # Extract and convert S21 values for all frequencies
        S21_values = [s_kj.linearized.S((0,), 2, (0,), 1, :) for s_kj in sol_kj]
        
        # Debugging: Check type and values of S21_values
        println("S21_values ", typeof(S21_values))
        
        # Convert S21 values to an array and compute maximum absolute value
        max_val = maximum(abs.(reduce(vcat, S21_values)))  # Flatten and compute max

        # Update best maximum value and combination
        if max_val > best_max_value
            best_max_value = max_val
            best_k = k
            best_j = j
        end
    end

    # Extract the best amplitudes based on best_k and best_j
    best_source_1_amplitude = sim_vars[:source_1_non_linear_amplitude][best_k]
    best_source_2_amplitude = sim_vars[:source_2_non_linear_amplitude][best_j]

    # Output the results
    println("Best combination: k = $best_k, j = $best_j")
    println("Best source 1 amplitude: $best_source_1_amplitude")
    println("Best source 2 amplitude: $best_source_2_amplitude")
    println("Best max value: $best_max_value")

    return [best_source_1_amplitude, best_source_2_amplitude]

end