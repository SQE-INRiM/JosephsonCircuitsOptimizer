# Include other files if necessary

"""
include("user_metric_utils.jl")
include("user_parametric_sources.jl")
"""

#--------------------------------------------------------------------------------


# To use the S parameters the correct notation is S_ij = S[(i,j)] for the module and Sphase[(i,j)] for the phase

function user_cost(S, Sphase, device_params_temp)

    @warn "Using default cost function! Please define `user_cost()` in user_inputs/user_cost_and_performance.jl"

    metric = 0

    return metric
        
end



#--------------------------------------------------------------------------------

# The first index is the frequency range, the next indeces correspond to the source in order you write it.
# All the physical quantities are inside a Dict called sim_vars



function user_performance(sol)

    @warn "Using default performance function! Please define `user_performance()` in user_inputs/user_cost_and_performance.jl"
    best_source_1_amplitude = 0

    return [best_source_1_amplitude]

end