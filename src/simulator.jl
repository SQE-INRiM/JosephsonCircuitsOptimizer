#-------------------------------------SIMULATOR-------------------------------------------

# This section handles the setup and execution of both linear and nonlinear simulations.
# It includes the loading of parameters, the creation of circuits, and the running of simulations
# to compute the scattering parameters and optimize device performance.


function setup_simulator()

    global physical_quantities_init = nothing
    global sim_vars = nothing

    physical_quantities = load_params(joinpath(config.user_inputs_dir, "drive_physical_quantities.json"))
    physical_quantities_init = load_params(joinpath(config.user_inputs_dir, "drive_physical_quantities.json"))
    simulation_config = load_params(joinpath(config.user_inputs_dir, "simulation_config.json"))

    physical_quantities[:w_range] = 2 * pi * physical_quantities[:frequency_range]

    n_sources = _num_sources_from_keys(physical_quantities)

    # Store full frequency sweeps separately, but keep scalar working frequencies in sim_vars
    source_frequency_specs = Dict{Int, Vector{Float64}}()
    default_source_frequencies = Float64[]

    for i in 1:n_sources
        kfreq = Symbol("source_$(i)_frequency")
        haskey(physical_quantities, kfreq) || error("Missing key $kfreq")

        vals = normalize_sweep_values(physical_quantities[kfreq]; name=String(kfreq))

        # Forbid mixing DC and AC in the same source sweep
        is_dc = all(v -> v == 0.0, vals)
        is_ac = all(v -> v != 0.0, vals)
        (is_dc || is_ac) || error("$(kfreq) cannot mix 0 and non-zero values in the same sweep.")

        source_frequency_specs[i] = vals
        push!(default_source_frequencies, vals[1])

        # overwrite working value with first scalar value
        physical_quantities[kfreq] = vals[1]
        physical_quantities_init[kfreq] = vals[1]
    end

    offset = 0.0001e9
    non_zero_frequencies = [f for f in default_source_frequencies if f != 0.0]

    isempty(non_zero_frequencies) && error("No strong tones found.")

    fps = [f + offset for f in non_zero_frequencies]
    wps = [2 * π * fp for fp in fps]

    for (i, (fp, wp)) in enumerate(zip(fps, wps))
        physical_quantities[Symbol("fp$(i)")] = fp
        physical_quantities[Symbol("wp$(i)")] = wp
    end

    physical_quantities[:wp] = Tuple(wps)

    sim_vars = merge(physical_quantities, simulation_config)

    # save the full source frequency sweeps here
    sim_vars[:source_frequency_specs] = source_frequency_specs

    sim_vars[:threewavemixing] = get(sim_vars, :threewavemixing, true)
    sim_vars[:fourwavemixing] = get(sim_vars, :fourwavemixing, true)
    sim_vars[:switchofflinesearchtol] = get(sim_vars, :switchofflinesearchtol, 1e-5)
    sim_vars[:alphamin] = get(sim_vars, :alphamin, 1e-4)
    sim_vars[:max_simulator_iterations] = get(sim_vars, :max_simulator_iterations, 1000)
    sim_vars[:skip_higher_pump_on_nonconvergence] = get(sim_vars, :skip_higher_pump_on_nonconvergence, false)

    n_pumps = length(sim_vars[:wp])

    sim_vars[:linear_strong_tone_harmonics] =
        normalize_harmonics(sim_vars[:linear_strong_tone_harmonics], n_pumps)

    sim_vars[:linear_modulation_harmonics] =
        normalize_harmonics(sim_vars[:linear_modulation_harmonics], n_pumps)

    sim_vars[:nonlinear_strong_tone_harmonics] =
        normalize_harmonics(sim_vars[:nonlinear_strong_tone_harmonics], n_pumps)

    sim_vars[:nonlinear_modulation_harmonics] =
        normalize_harmonics(sim_vars[:nonlinear_modulation_harmonics], n_pumps)

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

# Count only non-zero-frequency sources, i.e. actual pumps
function _num_pumps_from_sources(d::AbstractDict)
    n_sources = _num_sources_from_keys(d)
    n_pumps = 0
    for i in 1:n_sources
        kfreq = Symbol("source_$(i)_frequency")
        if haskey(d, kfreq) && d[kfreq] != 0
            n_pumps += 1
        end
    end
    return n_pumps
end

# Normalize harmonics so the user can write:
# 1      -> (1,) for one pump, (1,1) for two pumps, ...
# [1]    -> (1,)
# [1,1]  -> (1,1)
# (1,1)  -> (1,1)
function normalize_harmonics(x, n_pumps::Int)
    n_pumps > 0 || error("normalize_harmonics: n_pumps must be > 0")

    if isa(x, Integer)
        return ntuple(_ -> Int(x), n_pumps)

    elseif isa(x, AbstractVector)
        vals = Tuple(Int.(x))
        length(vals) == n_pumps || error(
            "Expected $n_pumps harmonic values, got $(length(vals)). " *
            "Use either a scalar (e.g. 8) or a vector with one value per pump (e.g. [8,8])."
        )
        return vals

    elseif isa(x, Tuple)
        vals = Tuple(Int.(collect(x)))
        length(vals) == n_pumps || error(
            "Expected $n_pumps harmonic values, got $(length(vals)). " *
            "Use either a scalar (e.g. 8) or a tuple/vector with one value per pump."
        )
        return vals

    else
        error(
            "Unsupported harmonic specification: $x. " *
            "Use an integer like 8, or an array like [8,8]."
        )
    end
end

# Unit vector in pump space:
# pump_mode(1,2) -> (1,0)
# pump_mode(2,2) -> (0,1)
# pump_mode(3,3) -> (0,0,1)
function pump_mode(pump_index::Int, n_pumps::Int)
    return ntuple(j -> (j == pump_index ? 1 : 0), n_pumps)
end

# Zero mode for DC sources in an n-pump simulation
function zero_mode(n_pumps::Int)
    return ntuple(_ -> 0, n_pumps)
end

# Build the source mode associated with source i.
# Convention:
# - source with frequency 0  -> zero mode
# - non-zero sources are assigned pump axes in source order
function source_mode(sim_vars::AbstractDict, source_idx::Int)
    n_sources = _num_sources_from_keys(sim_vars)
    n_pumps = length(sim_vars[:wp])

    freq_key = Symbol("source_$(source_idx)_frequency")
    freq = sim_vars[freq_key]

    if freq == 0
        return zero_mode(n_pumps)
    end

    pump_counter = 0
    for j in 1:n_sources
        kfreq = Symbol("source_$(j)_frequency")
        if haskey(sim_vars, kfreq) && sim_vars[kfreq] != 0
            pump_counter += 1
            if j == source_idx
                return pump_mode(pump_counter, n_pumps)
            end
        end
    end

    error("Failed to assign pump mode for source $source_idx")
end


# Normalize already-loaded values from load_params().
# load_params() already expands:
# - {"start","step","stop"} -> Vector
# - {"values":[...]}        -> Vector
# - {"segments":[...]}      -> Vector
#
# So here we only need to handle scalar or vector.
function normalize_sweep_values(x; name::String="parameter")
    if isa(x, Number)
        return [float(x)]
    elseif isa(x, AbstractVector)
        vals = Float64.(x)
        isempty(vals) && error("Empty sweep for $name")
        return vals
    else
        error("Unsupported $name specification: $x")
    end
end

# Build wp from the scalar source frequencies of the current sweep point.
# Only non-zero frequencies are pumps.
function build_wp_from_source_freqs(source_freqs::Vector{Float64}; offset=0.0001e9)
    pump_freqs = [f + offset for f in source_freqs if f != 0.0]
    isempty(pump_freqs) && error("No strong tones found for this sweep point.")
    return Tuple(2π .* pump_freqs)
end

# Build a temporary simulation dictionary for one frequency point.
function sim_vars_with_frequencies(base_sim_vars::AbstractDict, source_freqs::Vector{Float64})
    d = deepcopy(base_sim_vars)

    n_sources = _num_sources_from_keys(d)
    length(source_freqs) == n_sources || error(
        "Expected $n_sources source frequencies, got $(length(source_freqs))"
    )

    for i in 1:n_sources
        d[Symbol("source_$(i)_frequency")] = source_freqs[i]
    end

    d[:wp] = build_wp_from_source_freqs(source_freqs)
    return d
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
function linear_simulation(device_params_set::Dict, circuit::Circuit, local_sim_vars::AbstractDict=sim_vars)

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
        iterations = local_sim_vars[:max_simulator_iterations],
        switchofflinesearchtol = local_sim_vars[:switchofflinesearchtol],
        alphamin = local_sim_vars[:alphamin]
    )

    return extract_S_parameters(sol, circuit.PortNumber)
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

function nonlinear_simulation(circuit, amps::Vector, local_sim_vars::AbstractDict)
    n_sources = length(amps)
    dc = any(local_sim_vars[Symbol("source_$(i)_frequency")] == 0 for i in 1:n_sources)

    sources = [
        (
            mode = source_mode(local_sim_vars, i),
            port = local_sim_vars[Symbol("source_$(i)_on_port")],
            current = amps[i]
        )
        for i in 1:n_sources
    ]

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
                local_sim_vars[:w_range],
                local_sim_vars[:wp],
                sources,
                local_sim_vars[:nonlinear_modulation_harmonics],
                local_sim_vars[:nonlinear_strong_tone_harmonics],
                circuit.CircuitStruct,
                circuit.CircuitDefs;
                dc = dc,
                threewavemixing = local_sim_vars[:threewavemixing],
                fourwavemixing = local_sim_vars[:fourwavemixing],
                iterations = local_sim_vars[:max_simulator_iterations],
                switchofflinesearchtol = local_sim_vars[:switchofflinesearchtol],
                alphamin = local_sim_vars[:alphamin]
            )
        end
    catch e
        if e isa InterruptException
            rethrow()
        end
        converged = false
        message = sprint(showerror, e)
        return NonlinearHBStatus(converged, message, sol)
    end

    for w in warnings
        if occursin("Solver did not converge", w)
            converged = false
            message = w
            break
        end
    end

    return NonlinearHBStatus(converged, message, sol)
end


function create_nonlinear_amplitudes(
    n_sources::Int,
    amp_keys::Vector{Symbol},
    amp_idx::NTuple,
    device_params_set::Dict,
    resolved_functions::Dict{Int, Function}
)
    amps = Float64[]

    for i in 1:n_sources
        amplitude_value = sim_vars[amp_keys[i]]

        if isa(amplitude_value, String)
            f = resolved_functions[i]
            amplitude = Base.invokelatest(f, device_params_set)

        elseif isa(amplitude_value, AbstractVector)
            amplitude = amplitude_value[amp_idx[i]]

        else
            amplitude = amplitude_value
        end

        push!(amps, float(amplitude))
    end

    return amps
end


function run_nonlinear_simulations_sweep(optimal_params::Dict)
    circuit = create_circuit(optimal_params)

    n_sources = _num_sources_from_keys(sim_vars)

    amp_keys = [Symbol("source_$(i)_non_linear_amplitude") for i in 1:n_sources]

    resolved_functions = Dict{Int, Function}()
    for i in 1:n_sources
        amplitude_value = sim_vars[amp_keys[i]]
        if isa(amplitude_value, String)
            resolved_functions[i] = eval(Symbol(amplitude_value))
        end
    end

    # Frequency sweeps are stored separately here
    freq_values_by_source = [sim_vars[:source_frequency_specs][i] for i in 1:n_sources]
    freq_lengths = [length(v) for v in freq_values_by_source]
    freq_indices = Iterators.product((1:freq_lengths[i] for i in 1:n_sources)...)

    amp_lengths = [isa(sim_vars[key], String) ? 1 : length(normalize_sweep_values(sim_vars[key]; name=String(key))) for key in amp_keys]
    amp_indices = collect(Iterators.product((1:amp_lengths[i] for i in 1:n_sources)...))

    n_freq_points = prod(freq_lengths)
    n_amp_points = prod(amp_lengths)

    global number_initial_points_nl = n_freq_points * n_amp_points
    global plot_index_nl = 0

    ctx = Progress.start!(; N=number_initial_points_nl, stage="HB")

    results = []
    skip_on_nonconvergence = sim_vars[:skip_higher_pump_on_nonconvergence]

    for freq_idx in freq_indices
        check_stop()

        current_source_freqs = Float64[
            freq_values_by_source[i][freq_idx[i]] for i in 1:n_sources
        ]

        local_sim_vars = sim_vars_with_frequencies(sim_vars, current_source_freqs)

        println("=====================================================")
        println("Frequency sweep point:")
        println("Source frequencies used: ", current_source_freqs)

        # keep old skip logic, but reset it at each frequency point
        failed_idx_by_source2 = Dict{Int, Int}()

        for amp_idx in amp_indices
            check_stop()
            global plot_index_nl += 1
            Progress.tick!(ctx; i=plot_index_nl)

            source2_idx = n_sources >= 2 ? amp_idx[2] : 1

            if skip_on_nonconvergence &&
               n_sources >= 2 &&
               haskey(failed_idx_by_source2, source2_idx) &&
               amp_idx[1] >= failed_idx_by_source2[source2_idx]
                @info "Skipping point due to previous non-convergence of source 1 for this source-2 value at current frequency point" amp_idx=amp_idx freq_idx=freq_idx
                continue
            end

            amps = create_nonlinear_amplitudes(
                n_sources, amp_keys, amp_idx, optimal_params, resolved_functions
            )

            println("-----------------------------------------------------")
            println("Nonlinear sweep point ", plot_index_nl, " of ", number_initial_points_nl,
                    " (", round(100 * plot_index_nl / number_initial_points_nl; digits=1), "%)")
            println("Source frequencies used: ", current_source_freqs)
            println("Source amplitudes used: ", amps)

            nl = nonlinear_simulation(circuit, amps, local_sim_vars)

            if skip_on_nonconvergence && !nl.converged
                @info "Nonlinear solver did not converge" amp_idx=amp_idx amps=amps freq_idx=freq_idx freqs=current_source_freqs

                if n_sources >= 2 && !haskey(failed_idx_by_source2, source2_idx)
                    failed_idx_by_source2[source2_idx] = amp_idx[1]
                end

                continue
            end

            S_lin = linear_simulation(optimal_params, circuit, local_sim_vars)

            perf = performance(nl.sol, optimal_params, amps, current_source_freqs)
            nonlin_correction_term = Base.invokelatest(
                user_nonlinear_correction, S_lin, nl.sol, optimal_params
            )

            push!(results, (
                freqs = current_source_freqs,
                amps = amps,
                performance = perf,
                delta_quantity = nonlin_correction_term,
                converged = nl.converged,
                message = nl.message
            ))
        end
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

"""
    nonlinear_results_to_dataframe(results)

Convert nonlinear sweep results into a numeric DataFrame.

Included columns:
- source_i_frequency
- source_i_amplitude
- performance
- converged   (saved as 0/1)

Optional column:
- delta_quantity   (included only if numeric for all rows)
"""
function nonlinear_results_to_dataframe(results)
    if results === nothing || isempty(results)
        return DataFrame()
    end

    n_sources = length(results[1].amps)

    cols = Dict{Symbol, Vector{Float64}}()

    for i in 1:n_sources
        cols[Symbol("source_$(i)_frequency")] = Float64[]
        cols[Symbol("source_$(i)_amplitude")] = Float64[]
    end

    cols[:performance] = Float64[]
    cols[:converged] = Float64[]

    # Include delta_quantity only if it is numeric for all rows
    save_delta_quantity = all(r -> r.delta_quantity isa Number, results)
    if save_delta_quantity
        cols[:delta_quantity] = Float64[]
    end

    for r in results
        for i in 1:n_sources
            push!(cols[Symbol("source_$(i)_frequency")], float(r.freqs[i]))
            push!(cols[Symbol("source_$(i)_amplitude")], float(r.amps[i]))
        end

        push!(cols[:performance], float(r.performance))
        push!(cols[:converged], r.converged ? 1.0 : 0.0)

        if save_delta_quantity
            push!(cols[:delta_quantity], float(r.delta_quantity))
        end
    end

    return DataFrame(cols)
end

"""
    save_nonlinear_dataset(df::DataFrame, output_path; filename="df_nonlinear_analysis.h5")

Save nonlinear sweep DataFrame in matrix form, similarly to `save_dataset`.

Saved datasets:
- df_nonlinear_matrix
- df_nonlinear_filtered_matrix   (only converged rows)
- df_nonlinear_column_names
"""
function save_nonlinear_dataset(df::DataFrame, output_path; filename="df_nonlinear_analysis.h5")
    output_file = joinpath(output_path, filename)

    # keep only converged rows in filtered_df
    filtered_df = filter(row -> row.converged == 1.0, df)

    h5open(output_file, "w") do file
        mat = Matrix(df)
        filtered_mat = Matrix(filtered_df)

        write(file, "df_nonlinear_matrix", mat)

        if !isempty(filtered_df)
            write(file, "df_nonlinear_conveging_results_matrix", filtered_mat)
        end

        write(file, "df_nonlinear_column_names", names(df))
    end
end