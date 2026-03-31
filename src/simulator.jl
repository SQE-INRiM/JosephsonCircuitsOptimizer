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

    # Build pump frequencies (fpᵢ) and angular frequencies (wpᵢ) for N strong tones
    # Add a small offset to avoid numerical instability
    offset = 0.0001e9

    n_sources = _num_sources_from_keys(physical_quantities)

    # Collect non-zero frequencies in source-index order
    non_zero_frequencies = Float64[]
    for i in 1:n_sources
        kfreq = Symbol("source_$(i)_frequency")
        if haskey(physical_quantities, kfreq) && physical_quantities[kfreq] != 0
            push!(non_zero_frequencies, float(physical_quantities[kfreq]))
        end
    end

    if isempty(non_zero_frequencies)
        error("No strong tones found.")
    end

    fps = [f + offset for f in non_zero_frequencies]
    wps = [2 * π * fp for fp in fps]

    # Store fpᵢ and wpᵢ in physical_quantities (backward compatible keys :fp1, :wp1, ...)
    for (i, (fp, wp)) in enumerate(zip(fps, wps))
        physical_quantities[Symbol("fp$(i)")] = fp
        physical_quantities[Symbol("wp$(i)")] = wp
    end

    # Store all pump angular frequencies as a tuple (used downstream)
    physical_quantities[:wp] = Tuple(wps)

    # Merge the physical quantities and simulation configuration into a single dictionary
    sim_vars = merge(physical_quantities, simulation_config)

    # Harmonic-balance / nonlinear-solver defaults
    sim_vars[:threewavemixing] = get(sim_vars, :threewavemixing, false)
    sim_vars[:fourwavemixing] = get(sim_vars, :fourwavemixing, true)
    sim_vars[:switchofflinesearchtol] = get(sim_vars, :switchofflinesearchtol, 1e-5)
    sim_vars[:alphamin] = get(sim_vars, :alphamin, 1e-4)
    sim_vars[:max_simulator_iterations] = get(sim_vars, :max_simulator_iterations, 1000)    

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

# Infer number of sources from keys like :source_1_frequency, :source_2_linear_amplitude, ...
function _num_sources_from_keys(d::AbstractDict)
    idxs = Int[]
    for k in keys(d)
        m = match(r"^source_(\d+)_", String(k))
        if m !== nothing
            push!(idxs, parse(Int, m.captures[1]))
        end
    end
    return isempty(idxs) ? 0 : maximum(idxs)
end

"""
    extract_S_parameters(sol, n_ports)

Extract the S-parameters from the solution object.

# Arguments
- `sol::Any`: The solution object from the simulation.
- `n_ports::Int`: The number of ports in the circuit.

# Returns
- `S::Dict{Tuple{Int,Int}, Vector{ComplexF64}}`: dictionary of complex S-parameter vectors.

"""

function extract_S_parameters(sol, n_ports)
    # Dictionary of complex S-parameters, keyed by (i,j) port indices
    S = Dict{Tuple{Int,Int}, Vector{ComplexF64}}()

    for i in 1:n_ports
        for j in 1:n_ports
            Sij = Array(sol.linearized.S((0,), i, (0,), j, :))
            S[(i, j)] = Sij
        end
    end

    return S
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
- `S::Dict{Tuple{Int,Int}, Vector{ComplexF64}}`: complex S-parameters keyed by (i,j).

"""
function linear_simulation(device_params_set::Dict, circuit::Circuit)

    omega = sim_vars[:w_range]
    #n_frequencies = length(omega)
    n_sources = _num_sources_from_keys(sim_vars)

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
                if e isa InterruptException
                    rethrow()
                end
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
        omega,
        sim_vars[:wp],
        sources,
        (sim_vars[:linear_modulation_harmonics],),
        (sim_vars[:linear_strong_tone_harmonics],),
        circuit.CircuitStruct,
        circuit.CircuitDefs;
        dc = dc,
        threewavemixing = sim_vars[:threewavemixing],
        fourwavemixing = sim_vars[:fourwavemixing],
        iterations = sim_vars[:max_simulator_iterations],
        switchofflinesearchtol = sim_vars[:switchofflinesearchtol],
        alphamin = sim_vars[:alphamin]
    )


    @debug "Solution calculated"

    # Extract S-parameters from the solution
    S = extract_S_parameters(sol, circuit.PortNumber)

    @debug "S parameters extracted"

    return S
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
    # Emit parseable progress for the GUI
    ctx = Progress.start!(; N=number_initial_points, stage="LIN")
    initial_values = Vector{Float64}(undef, number_initial_points)
    for (i, p) in enumerate(initial_points)
        # Graceful stop (WORKSPACE/STOP)
        check_stop()
        initial_values[i] = cost(p)
        Progress.tick!(ctx; i=i)
    end
    Progress.finish!(ctx)
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

struct NonlinearHBStatus
    converged::Bool
    message::String
    sol
end

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

    warnings = String[]
    sol = nothing
    converged = true
    message = ""

    logger = TransformerLogger(current_logger()) do log
        if log.level == Logging.Warn
            msg = sprint(show, log.message)
            push!(warnings, msg)
        end
        return log
    end

    try
        with_logger(logger) do
            @time sol = hbsolve(
                sim_vars[:w_range],
                sim_vars[:wp],
                sources,
                (sim_vars[:nonlinear_modulation_harmonics],),
                (sim_vars[:nonlinear_strong_tone_harmonics],),
                circuit.CircuitStruct,
                circuit.CircuitDefs;
                dc = dc,
                threewavemixing = sim_vars[:threewavemixing],
                fourwavemixing = sim_vars[:fourwavemixing],
                iterations = sim_vars[:max_simulator_iterations],
                switchofflinesearchtol = sim_vars[:switchofflinesearchtol],
                alphamin = sim_vars[:alphamin]
            )
        end
    catch e
        if e isa InterruptException
            rethrow()
        end
        converged = false
        message = sprint(showerror, e)
        @debug "Nonlinear simulation threw exception: $message"
        return NonlinearHBStatus(converged, message, sol)
    end

    # Detect the specific non-convergence warning
    for w in warnings
        if occursin("Solver did not converge", w)
            converged = false
            message = w
            break
        end
    end

    @debug "Nonlinear simulation completed with converged = $converged"
    return NonlinearHBStatus(converged, message, sol)
end


function create_nonlinear_amplitudes(n_sources::Int, amp_keys::Vector{Symbol}, amp_idx::NTuple, device_params_set::Dict, resolved_functions::Dict{Int, Function})
    amps = Float64[]

    for i in 1:n_sources
        amplitude_value = sim_vars[amp_keys[i]]

        if isa(amplitude_value, String)
            f = resolved_functions[i]
            amplitude = Base.invokelatest(f, device_params_set)
            @debug "Called pre-resolved function for source $i, got amplitude: $amplitude"
        elseif isa(amplitude_value, AbstractVector)
            amplitude = amplitude_value[amp_idx[i]]
            @debug "Using array amplitude for source $i, index $(amp_idx[i]): $amplitude"
        else
            amplitude = amplitude_value
            @debug "Using scalar amplitude for source $i: $amplitude"
        end

        push!(amps, amplitude)
    end

    return amps
end


function run_nonlinear_simulations_sweep(optimal_params::Dict)
    circuit = create_circuit(optimal_params)
    @debug "Circuit created once for nonlinear sweep"

    n_sources = _num_sources_from_keys(sim_vars)
    amp_keys = [Symbol("source_$(i)_non_linear_amplitude") for i in 1:n_sources]

    resolved_functions = Dict{Int, Function}()
    for i in 1:n_sources
        amplitude_value = sim_vars[amp_keys[i]]
        if isa(amplitude_value, String)
            resolved_functions[i] = eval(Symbol(amplitude_value))
        end
    end

    amp_lengths = [isa(sim_vars[key], String) ? 1 : length(sim_vars[key]) for key in amp_keys]
    amp_indices = Iterators.product((1:amp_lengths[i] for i in 1:n_sources)...)

    global number_initial_points_nl = prod(amp_lengths)
    global plot_index_nl = 0

    ctx = Progress.start!(; N=number_initial_points_nl, stage="HB")
    @debug "Running nonlinear simulations for all combinations ($number_initial_points_nl total)"

    results = []

    failed_idx_by_source2 = Dict{Int, Int}()

    for amp_idx in amp_indices
        check_stop()
        global plot_index_nl += 1
        Progress.tick!(ctx; i=plot_index_nl)
    
        source2_idx = amp_idx[2]
    
        # local threshold: only for this value of source 2
        if haskey(failed_idx_by_source2, source2_idx) &&
           amp_idx[1] >= failed_idx_by_source2[source2_idx]
            @info "Skipping point due to previous non-convergence of source 1 for this source-2 value" amp_idx=amp_idx
            continue
        end
    
        amps = create_nonlinear_amplitudes(n_sources, amp_keys, amp_idx, optimal_params, resolved_functions)
    
        println("-----------------------------------------------------")
        println("Nonlinear sweep point ", plot_index_nl, " of ", number_initial_points_nl,
                " (", round(100 * plot_index_nl / number_initial_points_nl; digits=1), "%)")
        println("Source amplitudes used: ", amps)
    
        nl = nonlinear_simulation(circuit, amps)
    
        if !nl.converged
            @info "Nonlinear solver did not converge" amp_idx=amp_idx amps=amps
    
            # store first failed source-1 index for this source-2 slice
            if !haskey(failed_idx_by_source2, source2_idx)
                failed_idx_by_source2[source2_idx] = amp_idx[1]
            end
    
            continue
        end
    
        # only if nonlinear converged
        S_lin = linear_simulation(optimal_params, circuit)
    
        perf = performance(nl.sol, optimal_params, amps)
        nonlin_correction_term = Base.invokelatest(
            user_nonlinear_correction, S_lin, nl.sol, optimal_params
        )
    
        push!(results, (
            amps = amps,
            performance = perf,
            delta_quantity = nonlin_correction_term,
            converged = true,
            message = ""
        ))
    end

    Progress.finish!(ctx)
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


"""
    load_dataset(h5_path::AbstractString)

Load a dataset previously saved by `save_dataset`.

Returns `(df, filtered_df)` where `filtered_df` may be `nothing` if not present.
"""
function load_dataset(h5_path::AbstractString)
    # Allow passing either a directory (run folder) or the .h5 file itself
    if isdir(h5_path)
        h5_path = joinpath(h5_path, "df_uniform_analysis.h5")
    end

    if !isfile(h5_path)
        error("Dataset file not found: $(h5_path)")
    end

    df = nothing
    filtered_df = nothing

    h5open(h5_path, "r") do file
        mat = read(file, "df_matrix")
        colnames = read(file, "df_column_names")
        # colnames may come back as Vector{String} or Vector{SubString{String}}
        cols = Symbol.(String.(colnames))
        df = DataFrame(mat, cols)

        if haskey(file, "df_filtered_matrix")
            fmat = read(file, "df_filtered_matrix")
            filtered_df = DataFrame(fmat, cols)
        end
    end

    return df, filtered_df
end