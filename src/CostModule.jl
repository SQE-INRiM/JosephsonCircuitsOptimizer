# CostModule.jl
# This module contains functions related to the cost calculation, simulation, and masking for optimization.

using ..Config  # Access WORKING_SPACE

# History of metric evaluations (for reproducibility / post-mortem)
global cost_history = Dict{String,Any}(
    "params_vecs" => Vector{Vector{Float64}}(),
    "metrics"     => Float64[],
    "timestamps_utc" => String[]
)

global last_cost_metrics = Dict{Symbol, Float64}()
global last_performance_metrics = Dict{Symbol, Float64}()

function unpack_user_metrics(out; default_name::Symbol)
    if out isa NamedTuple
        names_out = keys(out)
        objective = Float64(out[first(names_out)])
        metrics = Dict(Symbol(k) => Float64(out[k]) for k in names_out)
        return objective, metrics
    elseif out isa Tuple
        objective = Float64(out[1])
        metrics = Dict(Symbol("$(default_name)_$i") => Float64(v) for (i, v) in enumerate(out))
        return objective, metrics
    else
        objective = Float64(out)
        metrics = Dict(default_name => objective)
        return objective, metrics
    end
end

function setup_cost()

    # reset history for a fresh run
    empty!(cost_history["params_vecs"])
    empty!(cost_history["metrics"])
    empty!(cost_history["timestamps_utc"])

    user_cost_path = joinpath(config.user_inputs_dir, "user_cost_and_performance.jl")
    
    if isfile(user_cost_path)
        include(user_cost_path)  # This loads and executes the file
    else
        error("User cost and performance file not found at: $user_cost_path")
    end

end


"""
    linear_solution(device_params_set::Dict, circuit::Circuit, local_sim_vars::AbstractDict=sim_vars)

Run the same linear harmonic-balance solve used by `linear_simulation`, but return the
full JosephsonCircuits solution object. `linear_simulation(...)` is intentionally kept
unchanged as the legacy convenience API that extracts the zero-mode S-parameter Dict.

This helper exists so `user_cost` can access the same JC solution surface already exposed
to `user_performance`, without performing a second simulation.
"""
function linear_solution(device_params_set::Dict, circuit::Circuit, local_sim_vars::AbstractDict=sim_vars)
    omega = local_sim_vars[:w_range]
    n_sources = _num_sources_from_keys(local_sim_vars)

    println("   1. Linear simulation")

    sources = []
    for i in 1:n_sources
        amplitude_key = Symbol("source_$(i)_linear_amplitude")
        amplitude_value = local_sim_vars[amplitude_key]

        if isa(amplitude_value, String)
            function_name = amplitude_value
            try
                amplitude = Base.invokelatest(eval(Symbol(amplitude_value)), device_params_set)
            catch e
                if e isa InterruptException
                    rethrow()
                end
                error("Failed to call function '$function_name': $e")
            end
        else
            amplitude = amplitude_value
        end

        source = (
            mode = source_mode(local_sim_vars, i),
            port = local_sim_vars[Symbol("source_$(i)_on_port")],
            current = amplitude
        )
        push!(sources, source)
    end

    dc = any(local_sim_vars[Symbol("source_$(i)_frequency")] == 0 for i in 1:n_sources)

    @time sol = hbsolve(
        omega,
        local_sim_vars[:wp],
        sources,
        local_sim_vars[:linear_modulation_harmonics],
        local_sim_vars[:linear_strong_tone_harmonics],
        circuit.CircuitStruct,
        circuit.CircuitDefs;
        dc = dc,
        threewavemixing = local_sim_vars[:threewavemixing],
        fourwavemixing = local_sim_vars[:fourwavemixing],
        maxintermodorder = local_sim_vars[:maxintermodorder],
        iterations = local_sim_vars[:max_simulator_iterations],
        ftol = local_sim_vars[:ftol],
        switchofflinesearchtol = local_sim_vars[:switchofflinesearchtol],
        alphamin = local_sim_vars[:alphamin],
        nbatches = local_sim_vars[:nbatches],
        sorting = local_sim_vars[:sorting]
    )

    return sol
end


"""
    sim_sys(vec)

Simulates the system given a vector of parameters. The vector is converted into a set of device parameters,
a circuit is created, and the linear harmonic-balance simulation is run.

# Arguments
- `vec::Vector`: A vector containing the device parameters.

# Returns
- `sol`: Full JosephsonCircuits solution object from the linear HB solve.
- `device_params_temp`: The device parameters corresponding to the input vector.

"""
function sim_sys(vec)
    # Convert vector to parameters and add extra parameters.
    global device_parameters_space
    device_params_temp = vector_to_param(vec, keys(device_parameters_space))

    # Create circuit and run simulation.
    circuit = create_circuit(device_params_temp)
    @debug "Circuit created"

    sol = linear_solution(device_params_temp, circuit)
    @debug "Linear simulation completed"

    return sol, device_params_temp
end

"""
    mask(input_mask, conditions_mask)

Applies a mask based on user-defined conditions. If the conditions are met, the mask returns `false` (indicating no exclusion). 
If the conditions are not met, it increments the exclusion counter and returns `true`.

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
passes the full JosephsonCircuits solution to the user-defined `user_cost` function, and evaluates the cost.

# Arguments
- `vec::Vector`: A vector of parameters for the device.

# Returns
- `metric`: The user-defined metric computed from the simulation solution.

"""
function cost(vec)

    global plot_index
    global number_initial_points
    plot_index += 1

    println("-----------------------------------------------------")

    # Graceful stop (WORKSPACE/STOP)
    check_stop()

    # If a BO progress context exists, emit parseable progress lines for GUI
    # (we count only evaluations performed after the initial dataset)
    if isdefined(@__MODULE__, :cost_progress_ctx) && plot_index > number_initial_points
        i_bo = plot_index - number_initial_points
        try
            Progress.tick!(cost_progress_ctx; i=i_bo)
        catch
        end
    end

    if plot_index < number_initial_points+1
        println("Linear Simulation process. Point number ", plot_index, " of ", number_initial_points, ", that are the ", round(100*(plot_index/number_initial_points))," % of the total" )
    else
        iter = plot_index - number_initial_points
        println("Optimization process: iteration number ", iter)
    end
    
    # Get the full linear solution for the given parameters.
    sol, device_params_temp = sim_sys(vec)

    global delta_correction
    # Calculate the user-defined metric from the same JC solution object used by the solver.
    out = Base.invokelatest(user_cost, sol, device_params_temp, delta_correction)

    metric, metrics_dict = unpack_user_metrics(out; default_name=:metric)
    
    global last_cost_metrics
    last_cost_metrics = metrics_dict


    # Save history (best-effort)
    try
        push!(cost_history["params_vecs"], Float64.(vec))
        push!(cost_history["metrics"], Float64(metric))
        push!(cost_history["timestamps_utc"], Dates.format(Dates.now(Dates.UTC), dateformat"yyyy-mm-ddTHH:MM:SS"))
    catch
    end

    # Add additional conditions or checks for the cost if needed.
    return metric
end


function performance(sol, device_params_set, source_amps, source_freqs)
    
    check_stop()
    out = Base.invokelatest(
        user_performance,
        sol,
        device_params_set,
        source_amps,
        source_freqs
    )
    
    perf, metrics_dict = unpack_user_metrics(out; default_name=:performance)
    
    global last_performance_metrics
    last_performance_metrics = metrics_dict
    
    return perf

end



function nonlinear_correction(optimal_params, best_amplitudes)

    circuit = create_circuit(optimal_params)

    S_lin = linear_simulation(optimal_params, circuit, sim_vars)

    sol_nonlin = nonlinear_simulation(circuit, best_amplitudes, sim_vars)

    nonlin_correction_term = Base.invokelatest(
        user_nonlinear_correction,
        S_lin,
        sol_nonlin.sol,
        optimal_params
    )

    println("Nonlinear correction term: ", nonlin_correction_term)

    return nonlin_correction_term
end