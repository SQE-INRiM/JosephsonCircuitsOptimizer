# CostModule.jl
# This module contains functions related to the cost calculation, simulation, and masking for optimization.

using ..Config  # Access WORKING_SPACE


function setup_cost()

    user_cost_path = joinpath(config.user_inputs_dir, "user_cost_and_performance.jl")
    
    if isfile(user_cost_path)
        include(user_cost_path)  # This loads and executes the file
    else
        error("User cost and performance file not found at: $user_cost_path")
    end

end


"""
    sim_sys(vec)

Simulates the system given a vector of parameters. The vector is converted into a set of device parameters, 
a circuit is created, and the simulation is run to get the scattering parameters.

# Arguments
- `vec::Vector`: A vector containing the device parameters.

# Returns
- `S`: Scattering parameter.
- `Sphase`: Phase of the scattering parameter.
- `device_params_temp`: The device parameters corresponding to the input vector.

"""
function sim_sys(vec)
    # Convert vector to parameters and add extra parameters.
    global device_parameters_space
    device_params_temp = vector_to_param(vec, keys(device_parameters_space))

    # Create circuit and run simulation.
    circuit = create_circuit(device_params_temp)
    @info "Circuit created"

    S, Sphase = linear_simulation(device_params_temp, circuit)
    @info "Linear simulation completed"

    return S, Sphase, device_params_temp
end

"""
    mask(input_mask, conditions_mask)

Applies a mask based on user-defined conditions. If the conditions are met, the mask returns `false` (indicating no exclusion). 
If the conditions are not met, it increments the exclusion counter and returns `true`, indicating that the point is excluded.

# Arguments
- `input_mask::Any`: The input data to be masked.
- `conditions_mask::Function`: A function that defines the conditions for masking.

# Returns
- `Bool`: Whether the input should be excluded (`true`) or not (`false`).

"""
function mask(input_mask, conditions_mask)
    # If the conditions are met, compute and return the user-defined metric.
    if conditions_mask(input_mask)
        return false
    else
        global point_exluded
        global number_initial_points
        point_exluded += 1
        println("Points excluded: ", point_exluded, " that are the ", round(100 * (point_exluded / number_initial_points)), " % of the total")
        return true  # or some other default/penalty value
    end
end

"""
    cost(vec)

Computes the cost based on the system simulation and user-defined metric. The function simulates the system, 
calculates the scattering parameters, and evaluates the cost based on the user-defined `user_cost` function.

# Arguments
- `vec::Vector`: A vector of parameters for the device.

# Returns
- `metric`: The user-defined metric computed using the scattering parameters.

"""
function cost(vec)

    global plot_index
    global number_initial_points
    plot_index += 1
    println("Point number ", plot_index, " of ", number_initial_points, ", that are the ", round(100*(plot_index/number_initial_points))," % of the total" )

    # Get simulation results for the given parameters.
    S, Sphase, device_params_temp = sim_sys(vec)

    # Calculate the user-defined metric based on the simulation results.
    metric = Base.invokelatest(user_cost, S, Sphase, device_params_temp)

    # Add additional conditions or checks for the cost if needed.
    return metric
end


function performance(sol)

    return Base.invokelatest(user_performance, sol)
    
end