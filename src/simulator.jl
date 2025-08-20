#-------------------------------------SIMULATOR-------------------------------------------

# This section handles the setup and execution of both linear and nonlinear simulations.
# It includes the loading of parameters, the creation of circuits, and the running of simulations
# to compute the scattering parameters and optimize device performance.


function setup_simulator()

    global physical_quantities_init = nothing
    global sim_vars = nothing

    # Load physical quantities from a JSON file containing relevant parameters for the simulation
    physical_quantities = load_params(joinpath(config.user_inputs_dir, "drive_physical_quantities.json"))
    physical_quantities_init = load_params(joinpath(config.user_inputs_dir,"drive_physical_quantities.json"))
    simulation_config = load_params(joinpath(config.user_inputs_dir, "simulation_config.json"))

        
    # Update frequency range based on the provided values
    physical_quantities[:w_range] = 2 * pi * physical_quantities[:frequency_range]

    # Find all non-zero source frequencies
    non_zero_frequencies = []
    for key in keys(physical_quantities)
        if startswith(string(key), "source_") && endswith(string(key), "_frequency") && physical_quantities[key] != 0
            push!(non_zero_frequencies, physical_quantities[key])
        end
    end

    # Check if at least one non-zero frequency is found
    if isempty(non_zero_frequencies)
        error("No strong tones found.")
    end

    # Update fp1 and calculate wp1
    fp1 = non_zero_frequencies[1] + 0.0001e9  # Add a small offset to avoid numerical instability
    wp1 = 2 * π * fp1

    # Store fp1 and wp1 in physical_quantities for future use
    physical_quantities[:fp1] = fp1
    physical_quantities[:wp1] = wp1

    # If a second frequency is found, update fp2 and calculate wp2
    if length(non_zero_frequencies) >= 2
        fp2 = non_zero_frequencies[2] + 0.0001e9  # Add a small offset to avoid numerical instability
        wp2 = 2 * π * fp2

        # Store fp2 and wp2 in physical_quantities
        physical_quantities[:fp2] = fp2
        physical_quantities[:wp2] = wp2

        # Combine wp1 and wp2 into a tuple for wp
        physical_quantities[:wp] = (wp1, wp2)
    else
        # If only one frequency is found, store wp1 as a single-element tuple
        physical_quantities[:wp] = (wp1,)
    end

    # Merge the physical quantities and simulation configuration into a single dictionary
    sim_vars = merge(physical_quantities, simulation_config)


end

function setup_sources()

    # Path to the user-defined circuit file
    user_sources_path = joinpath(config.user_inputs_dir, "user_parametric_sources.jl")

    if isfile(user_sources_path)
        include(user_sources_path)  # This loads and executes the file
    else
        @info "No parametric sources used."
    end

end



"""
    extract_S_parameters(sol, n_ports)

Extracts the S-parameters and their phases from the solution object. The solution object contains the results
of the simulation, and this function retrieves the S-parameters for all port combinations.

# Arguments
- `sol::Any`: The solution object from the simulation.
- `n_ports::Int`: The number of ports in the circuit.

# Returns
- `S_magnitude::Dict`: A dictionary containing the magnitudes of the S-parameters.
- `S_phase::Dict`: A dictionary containing the phases of the S-parameters.

"""

function extract_S_parameters(sol, n_ports)
    # Initialize dictionaries to store the S-parameters and their phases
    S_magnitude = Dict{Tuple{Int,Int}, Vector{ComplexF64}}()
    S_phase     = Dict{Tuple{Int,Int}, Vector{Float64}}()

    # Loop over all port combinations
    for i in 1:n_ports
        for j in 1:n_ports
            # Convert the KeyedArray slice to a plain Vector
            Sij = Array(sol.linearized.S((0,), i, (0,), j, :))

            # Store directly as vector
            S_magnitude[(i, j)] = Sij
            S_phase[(i, j)]     = unwrap(angle.(Sij))
        end
    end

    return S_magnitude, S_phase
end

"""
    linear_simulation(device_params_set::Dict, circuit::Circuit)

Performs a linear simulation using the provided device parameters and circuit. This function sets up the
source amplitudes and frequencies, and then runs the harmonic balance solver (`hbsolve`) to obtain the
S-parameters for the circuit.

# Arguments
- `device_params_set::Dict`: A dictionary containing the device parameters.
- `circuit::Circuit`: The circuit object that defines the structure of the device.

# Returns
- `S::Dict`: A dictionary containing the S-parameters.
- `Sphase::Dict`: A dictionary containing the phases of the S-parameters.

"""
function linear_simulation(device_params_set::Dict, circuit::Circuit)

    omega = sim_vars[:w_range]
    #n_frequencies = length(omega)
    n_sources = Int(count(key -> startswith(string(key), "source_"), keys(sim_vars))/4)

    println("   1. Linear simulation")

    # Define sources based on parameters
    sources = []
    for i in 1:n_sources
        amplitude_key = Symbol("source_$(i)_linear_amplitude")
        amplitude_value = sim_vars[amplitude_key]
        @debug "Processing source $i with amplitude value: $amplitude_value"  # Debug print

        if isa(amplitude_value, String)
            # Dynamically call function if amplitude is a string (function name)
            function_name = amplitude_value
            try
                amplitude = Base.invokelatest(eval(Symbol(amplitude_value)), device_params_set)
                @debug "Called function '$function_name' and got amplitude: $amplitude"  # Debug print
            catch e
                error("Failed to call function '$function_name': $e")
            end
        else
            # Use direct value if amplitude is a number
            amplitude = amplitude_value
            @debug "Using direct amplitude value: $amplitude"  # Debug print
        end

        # Set source mode based on frequency
        mode = sim_vars[Symbol("source_$(i)_frequency")] == 0 ? (0,) : (1,)

        # Create source entry for the simulation
        source = (
            mode = mode,
            port = sim_vars[Symbol("source_$(i)_on_port")],
            current = amplitude
        )
        push!(sources, source)
    end

    dc = any(sim_vars[Symbol("source_$(i)_frequency")] == 0 for i in 1:n_sources)

    @debug "Sources created: $sources"

    # Perform the harmonic balance simulation and obtain solution
    @time sol = hbsolve(
        omega, sim_vars[:wp], sources, (sim_vars[:linear_modulation_harmonics],), (sim_vars[:linear_strong_tone_harmonics],),
        circuit.CircuitStruct, circuit.CircuitDefs;
        dc=dc, threewavemixing=true, fourwavemixing=true, iterations=sim_vars[:max_simulator_iterations]
    )


    @debug "Solution calculated"

    # Extract S-parameters from the solution
    S, Sphase = extract_S_parameters(sol, circuit.PortNumber)

    @debug "S parameters extracted"

    return S, Sphase
end


"""
    run_simulations(device_parameters_space::Dict; filter_df::Bool=false)

Runs simulations for all points in the parameter space and returns a DataFrame of results.
"""
function run_linear_simulations_sweep(device_parameters_space::Dict; filter_df::Bool=false)

    global point_exluded = 0

    column_names = collect(keys(device_parameters_space))
    initial_points = generate_all_initial_points(device_parameters_space)

    global number_initial_points = size(initial_points)[1]
    global plot_index = 0

    println("\nStarting points calculations")
    initial_values = [cost(p) for p in initial_points]
    println("Total points excluded: ", point_exluded)

    df = DataFrame(initial_points)
    rename!(df, Symbol.(string.(column_names)))
    df.metric = initial_values

    if filter_df
        filtered_df = filter(row -> row.metric < 9e7, df)
        return df, filtered_df
    else
        return df
    end
end


"""
    nonlinear_simulation(optimal_params::Dict)

Performs a nonlinear simulation using the provided optimal parameters and circuit. This function handles
multiple source configurations and amplitudes, and runs the harmonic balance solver for each combination.


"""

function nonlinear_simulation(circuit, amps::Vector)
    @debug "Circuit received for nonlinear simulation"

    n_sources = length(amps)
    modes = [sim_vars[Symbol("source_$(i)_frequency")] == 0 ? (0,) : (1,) for i in 1:n_sources]
    dc = any(sim_vars[Symbol("source_$(i)_frequency")] == 0 for i in 1:n_sources)

    sources = [
        (mode=modes[i], port=sim_vars[Symbol("source_$(i)_on_port")], current=amps[i])
        for i in 1:n_sources
    ]
    @debug "Sources created for nonlinear simulation: $sources"

    println("   2. Non-linear simulation")

    sol = hbsolve(
        sim_vars[:w_range], sim_vars[:wp], sources,
        (sim_vars[:nonlinear_modulation_harmonics],),
        (sim_vars[:nonlinear_strong_tone_harmonics],),
        circuit.CircuitStruct, circuit.CircuitDefs;
        dc=dc, threewavemixing=true, fourwavemixing=true,
        iterations=sim_vars[:max_simulator_iterations]
    )

    @debug "Nonlinear simulation completed"
    return sol
end


function run_nonlinear_simulations_sweep(optimal_params::Dict)
    # Create circuit once
    circuit = create_circuit(optimal_params)
    @debug "Circuit created once for nonlinear sweep"

    n_sources = Int(count(key -> startswith(string(key), "source_"), keys(sim_vars)) ÷ 4)
    amp_keys = [Symbol("source_$(i)_non_linear_amplitude") for i in 1:n_sources]
    amp_lengths = [length(sim_vars[key]) for key in amp_keys]

    results = []

    amp_indices = Iterators.product((1:length(sim_vars[key]) for key in amp_keys)...)

    global number_initial_points_nl = prod(amp_lengths)
    global plot_index_nl = 0

    @debug "Running nonlinear simulations for all combinations ($number_initial_points_nl total)"

    for amp_idx in amp_indices
        global plot_index_nl += 1
    
        println("-----------------------------------------------------")
        println("Point number ", plot_index_nl, " of ", number_initial_points_nl,
                ", that is ", round(100*(plot_index_nl/number_initial_points_nl)), "% of the total")

        amps = [sim_vars[amp_keys[i]][amp_idx[i]] for i in 1:n_sources]
        @debug "Running nonlinear simulation for amplitudes: $amps"

        sol = nonlinear_simulation(circuit, amps)
        perf = performance(sol)

        push!(results, (amps=amps, performance=perf))
    end

    return results
end



"""
    update_physical_quantities(best_amplitudes::Vector)

Updates the physical quantities by modifying the amplitude values based on `best_amplitudes`.
"""
function update_physical_quantities(best_amplitudes::Vector)
    for key in keys(physical_quantities_init)
        if startswith(string(key), "source_") && endswith(string(key), "_on_port")
            source_num = split(string(key), '_')[2]

            linear_amp_key = Symbol("source_$(source_num)_linear_amplitude")
            non_linear_amp_key = Symbol("source_$(source_num)_non_linear_amplitude")
            freq_range_key = Symbol("frequency_range")

            if haskey(physical_quantities_init, freq_range_key)
                delete!(physical_quantities_init, freq_range_key)
            end
            if haskey(physical_quantities_init, linear_amp_key)
                delete!(physical_quantities_init, linear_amp_key)
            end
            if haskey(physical_quantities_init, non_linear_amp_key)
                delete!(physical_quantities_init, non_linear_amp_key)
            end

            new_amp_key = Symbol("source_$(source_num)_amplitude")
            physical_quantities_init[new_amp_key] = best_amplitudes[parse(Int, source_num)]
        end
    end
    return physical_quantities_init
end



"""
    generate_all_initial_points(device_parameters_space::Dict)

Generates all possible parameter combinations from the given parameter space dictionary.
"""
function generate_all_initial_points(device_parameters_space::Dict)
    value_lists = values(device_parameters_space)
    points_set = Set{Tuple{Float64, Vararg{Float64}}}()
    
    for values in Iterators.product(value_lists...)
        push!(points_set, tuple(map(float, values)...))
    end

    return collect(points_set)
end



"""
    save_dataset(df::DataFrame)

Saves the simulation results into an HDF5 file with a timestamp.
"""
function save_dataset(df::DataFrame, output_path) 
    
    filtered_df = filter(row -> row.metric < 9e7, df)

    output_path = joinpath(output_path, "df_uniform_analysis.h5")

    h5open(output_path, "w") do file
        mat = Matrix(df)
        filtered_mat = Matrix(filtered_df)

        write(file, "df_matrix", mat)
        if !isempty(filtered_df)
            write(file, "df_filtered_matrix", filtered_mat)
        end
        write(file, "df_column_names", names(df))
    end
end