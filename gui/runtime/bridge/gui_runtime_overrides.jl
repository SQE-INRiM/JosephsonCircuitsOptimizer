# GUI-specific runtime policy loaded by runtime/bridge/run.jl after JCO is imported.
#
# Storage contract:
# - df_*_analysis.h5 always stores compact scalar summaries, including a stable point_id.
# - save_datas(...) stores only user-selected arrays in saved_data/<stage>.h5, keyed by point_id.
# - full fundamental S-matrix capture is diagnostic-only (trace_storage_mode = "all").
# - automatic PNG/sidecar persistence remains disabled for GUI-launched runs.

# Context of the summary-table point currently executing user_cost/user_performance.
global gui_active_stage = nothing
global gui_active_point_id = nothing
global gui_active_params = nothing
global gui_active_source_freqs = nothing
global gui_active_source_amps = nothing

# Diagnostic full-trace state. This remains empty in the default "selected" mode.
global gui_last_linear_S = nothing
global gui_last_linear_params = nothing
global gui_linear_trace_records = Any[]
global gui_last_nonlinear_results = Any[]

function _gui_trace_storage_mode()
    raw = lowercase(strip(string(get(sim_vars, :trace_storage_mode, "selected"))))
    raw in ("selected", "all", "none") || error(
        "trace_storage_mode must be one of: selected, all, none (got '$raw')"
    )
    return raw
end

function _gui_begin_point!(stage::AbstractString, point_id::Integer;
    params=nothing, source_freqs=nothing, source_amps=nothing)
    global gui_active_stage = String(stage)
    global gui_active_point_id = Int(point_id)
    global gui_active_params = params === nothing ? nothing : deepcopy(params)
    global gui_active_source_freqs = source_freqs === nothing ? nothing : Float64.(source_freqs)
    global gui_active_source_amps = source_amps === nothing ? nothing : Float64.(source_amps)
    return nothing
end

function _gui_end_point!()
    global gui_active_stage = nothing
    global gui_active_point_id = nothing
    global gui_active_params = nothing
    global gui_active_source_freqs = nothing
    global gui_active_source_amps = nothing
    return nothing
end

# Keep extraction valid for one or multiple pump axes. The engine implementation
# historically hard-coded (0,), which only represents a one-pump zero mode.
function extract_S_parameters(sol, n_ports)
    S = Dict{Tuple{Int,Int}, Vector{ComplexF64}}()
    mode0 = zero_mode(length(sim_vars[:wp]))

    for i in 1:n_ports
        for j in 1:n_ports
            Sij = Array(sol.linearized.S(mode0, i, mode0, j, :))
            S[(i, j)] = Sij
        end
    end

    return S
end

# Preserve the engine sim_sys contract. Full S matrices are retained only when
# explicitly requested for diagnostics; selected-mode arrays are streamed by save_datas.
function sim_sys(vec)
    global device_parameters_space
    global gui_last_linear_S
    global gui_last_linear_params

    device_params_temp = vector_to_param(vec, keys(device_parameters_space))
    circuit = create_circuit(device_params_temp)
    @debug "Circuit created"

    S = linear_simulation(device_params_temp, circuit)
    @debug "Linear simulation completed"

    if _gui_trace_storage_mode() == "all"
        gui_last_linear_S = deepcopy(S)
        gui_last_linear_params = deepcopy(device_params_temp)
    else
        gui_last_linear_S = nothing
        gui_last_linear_params = nothing
    end

    return S, device_params_temp
end

# Linear sweep with a stable point_id shared by the summary row and save_datas calls.
function run_linear_simulations_sweep(device_parameters_space::Dict; filter_df::Bool=false)
    global point_exluded = 0
    global gui_linear_trace_records

    empty!(gui_linear_trace_records)

    column_names = collect(keys(device_parameters_space))
    initial_points = generate_all_initial_points(device_parameters_space)

    global number_initial_points = size(initial_points)[1]
    global plot_index = 0

    println("\nStarting points calculations")
    ctx = Progress.start!(; N=number_initial_points, stage="LIN")
    initial_values = Vector{Float64}(undef, number_initial_points)
    extra_metrics = Dict{Symbol, Vector{Float64}}()

    for (i, p) in enumerate(initial_points)
        check_stop()
        params_for_point = vector_to_param(p, keys(device_parameters_space))

        _gui_begin_point!("linear", i; params=params_for_point)
        try
            initial_values[i] = cost(p)
        finally
            _gui_end_point!()
        end

        if _gui_trace_storage_mode() == "all" &&
           gui_last_linear_S !== nothing && gui_last_linear_params !== nothing
            push!(gui_linear_trace_records, (
                point_id = i,
                params = deepcopy(gui_last_linear_params),
                S = deepcopy(gui_last_linear_S),
            ))
        end

        for (name, value) in last_cost_metrics
            if !haskey(extra_metrics, name)
                extra_metrics[name] = Float64[]
            end
            push!(extra_metrics[name], Float64(value))
        end

        Progress.tick!(ctx; i=i)
    end
    Progress.finish!(ctx)
    println("Total points excluded: ", point_exluded)

    df = DataFrame(initial_points)
    rename!(df, Symbol.(string.(column_names)))
    insertcols!(df, 1, :point_id => collect(1:number_initial_points))
    df.metric = initial_values
    for (name, values) in extra_metrics
        if name != :metric
            df[!, name] = values
        end
    end

    if filter_df
        filtered_df = filter(row -> row.metric < 9e7, df)
        return df, filtered_df
    else
        return df
    end
end

# HB sweep with point IDs assigned in the exact order in which rows are appended to
# df_nonlinear_analysis.h5. save_datas calls inside user_performance therefore map 1:1.
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

    freq_values_by_source = [sim_vars[:source_frequency_specs][i] for i in 1:n_sources]
    freq_lengths = [length(v) for v in freq_values_by_source]
    freq_indices = Iterators.product((1:freq_lengths[i] for i in 1:n_sources)...)

    amp_lengths = [
        isa(sim_vars[key], String) ? 1 : length(normalize_sweep_values(sim_vars[key]; name=String(key)))
        for key in amp_keys
    ]
    amp_indices = collect(Iterators.product((1:amp_lengths[i] for i in 1:n_sources)...))

    n_freq_points = prod(freq_lengths)
    n_amp_points = prod(amp_lengths)

    global number_initial_points_nl = n_freq_points * n_amp_points
    global plot_index_nl = 0

    ctx = Progress.start!(; N=number_initial_points_nl, stage="HB")

    results = []
    skip_on_nonconvergence = sim_vars[:skip_higher_pump_on_nonconvergence]
    store_all = _gui_trace_storage_mode() == "all"

    for freq_idx in freq_indices
        check_stop()

        current_source_freqs = Float64[
            freq_values_by_source[i][freq_idx[i]] for i in 1:n_sources
        ]
        local_sim_vars = sim_vars_with_frequencies(sim_vars, current_source_freqs)

        println("=====================================================")
        println("Frequency sweep point:")
        println("Source frequencies used: ", current_source_freqs)

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
            point_id = length(results) + 1

            _gui_begin_point!("nonlinear", point_id;
                params=optimal_params, source_freqs=current_source_freqs, source_amps=amps)
            try
                perf = performance(nl.sol, optimal_params, amps, current_source_freqs)
                nonlin_correction_term = Base.invokelatest(
                    user_nonlinear_correction, S_lin, nl.sol, optimal_params
                )

                nonlinear_S = store_all && nl.sol !== nothing ?
                    extract_S_parameters(nl.sol, circuit.PortNumber) : nothing

                push!(results, (
                    point_id = point_id,
                    freqs = current_source_freqs,
                    amps = amps,
                    S = nonlinear_S,
                    performance = perf,
                    performance_metrics = copy(last_performance_metrics),
                    delta_quantity = nonlin_correction_term,
                    converged = nl.converged,
                    message = nl.message,
                ))
            finally
                _gui_end_point!()
            end
        end
    end

    Progress.finish!(ctx)
    global gui_last_nonlinear_results = results
    return results
end

function _gui_numeric_scalar_parameters(params::AbstractDict)
    names_out = String[]
    values_out = Float64[]
    for key in sort!(collect(keys(params)); by=x -> String(x))
        value = params[key]
        if value isa Number
            push!(names_out, String(key))
            push!(values_out, Float64(value))
        end
    end
    return names_out, values_out
end

function _gui_safe_hdf5_name(name::AbstractString)
    cleaned = replace(strip(String(name)), r"[^A-Za-z0-9_.-]+" => "_")
    return isempty(cleaned) ? "data" : cleaned
end

function _gui_unique_child_name(parent, requested::AbstractString)
    base = _gui_safe_hdf5_name(requested)
    !haskey(parent, base) && return base
    i = 2
    while haskey(parent, "$(base)_$(i)")
        i += 1
    end
    return "$(base)_$(i)"
end

function _gui_write_array(parent, requested_name::AbstractString, values)
    arr = collect(values)
    group_name = _gui_unique_child_name(parent, requested_name)
    g = create_group(parent, group_name)
    is_complex = eltype(arr) <: Complex || any(x -> x isa Complex, arr)
    if is_complex
        write(g, "storage", "complex_split_real_imag")
        write(g, "real", Float64.(real.(arr)))
        write(g, "imag", Float64.(imag.(arr)))
    else
        write(g, "storage", "real")
        write(g, "values", arr)
    end
    return group_name
end

function _gui_write_point_metadata(point_group)
    if !haskey(point_group, "point_id")
        write(point_group, "point_id", Int(gui_active_point_id))
    end
    if gui_active_params isa AbstractDict && !haskey(point_group, "parameter_names")
        names_out, values_out = _gui_numeric_scalar_parameters(gui_active_params)
        write(point_group, "parameter_names", names_out)
        write(point_group, "parameter_values", values_out)
    end
    if gui_active_source_freqs !== nothing && !haskey(point_group, "source_frequencies_hz")
        write(point_group, "source_frequencies_hz", Float64.(gui_active_source_freqs))
    end
    if gui_active_source_amps !== nothing && !haskey(point_group, "source_amplitudes_a")
        write(point_group, "source_amplitudes_a", Float64.(gui_active_source_amps))
    end
    return nothing
end

"""
    save_datas(vectors; category="custom", filename="saved_datas", prefix="vec")

Store user-selected numerical arrays for the summary-table point that is currently
being evaluated. GUI runs consolidate these arrays into `saved_data/<stage>.h5`.

For `category="linear"` and `category="nonlinear"`, the HDF5 group name is the same
stable `point_id` stored in df_uniform_analysis.h5 / df_nonlinear_analysis.h5.
Calls made outside an active summary-table point (for example optimizer evaluations)
are intentionally ignored so optimizer samples cannot be mistaken for Linear rows.
"""
function save_datas(vectors;
    category::AbstractString="custom",
    filename::AbstractString="saved_datas",
    prefix::AbstractString="vec")

    mode = _gui_trace_storage_mode()
    mode == "none" && return nothing

    current_output_path = CURRENT_OUTPUT_PATH[]
    current_output_path === nothing && error("No active output folder found. Run a simulation first.")

    valid_categories = ("linear", "nonlinear", "custom")
    category in valid_categories || error("category must be one of: $(valid_categories)")

    if gui_active_stage === nothing || gui_active_point_id === nothing
        @debug "Ignoring save_datas outside an active summary-table point" category=category filename=filename
        return nothing
    end

    if category != "custom" && category != gui_active_stage
        @warn "Ignoring save_datas because category does not match the active stage" category=category active_stage=gui_active_stage filename=filename
        return nothing
    end

    target_category = category == "custom" ? "custom" : String(category)
    data_dir = joinpath(current_output_path, "saved_data")
    mkpath(data_dir)
    filepath = joinpath(data_dir, "$(target_category).h5")

    h5open(filepath, isfile(filepath) ? "r+" : "w") do file
        if !haskey(file, "schema_version")
            write(file, "schema_version", "jco.saved-data/1")
            write(file, "stage", target_category)
            if isdefined(@__MODULE__, :sim_vars) && haskey(sim_vars, :frequency_range)
                write(file, "frequency_hz", Float64.(sim_vars[:frequency_range]))
            end
        end

        point_name = "point_$(lpad(string(gui_active_point_id), 6, '0'))"
        point_group = haskey(file, point_name) ? file[point_name] : create_group(file, point_name)
        _gui_write_point_metadata(point_group)

        quantity_name = _gui_unique_child_name(point_group, filename)
        quantity_group = create_group(point_group, quantity_name)
        write(quantity_group, "quantity_name", String(filename))
        write(quantity_group, "prefix", String(prefix))

        if vectors isa AbstractVector{<:Number}
            _gui_write_array(quantity_group, prefix, vectors)
        else
            for (i, v) in enumerate(vectors)
                _gui_write_array(quantity_group, "$(prefix)_$(i)", v)
            end
        end
    end

    @debug "Saved selected data" filepath=filepath point_id=gui_active_point_id quantity=filename
    return filepath
end

function _gui_write_sparameter_group(parent, S)
    for ((i, j), values) in sort!(collect(S); by=x -> x[1])
        g = create_group(parent, "S$(i)$(j)")
        write(g, "real", real.(values))
        write(g, "imag", imag.(values))
    end
end

# Diagnostic-only full fundamental S matrices.
function save_gui_linear_traces(output_path; filename="linear_traces.h5")
    isempty(gui_linear_trace_records) && return nothing

    output_file = joinpath(output_path, filename)
    h5open(output_file, "w") do file
        write(file, "frequency_hz", Float64.(sim_vars[:frequency_range]))
        write(file, "trace_format", "complex_split_real_imag")
        write(file, "trace_storage_mode", "all")
        write(file, "point_count", length(gui_linear_trace_records))

        for record in gui_linear_trace_records
            idx = record.point_id
            g = create_group(file, "point_$(lpad(string(idx), 6, '0'))")
            write(g, "point_id", idx)
            names_out, values_out = _gui_numeric_scalar_parameters(record.params)
            write(g, "parameter_names", names_out)
            write(g, "parameter_values", values_out)
            _gui_write_sparameter_group(g, record.S)
        end
    end

    @info "Saved diagnostic linear S-parameter traces to $output_file"
    return output_file
end

function save_gui_nonlinear_traces(output_path; filename="nonlinear_traces.h5")
    trace_results = [r for r in gui_last_nonlinear_results if hasproperty(r, :S) && r.S !== nothing]
    isempty(trace_results) && return nothing

    output_file = joinpath(output_path, filename)
    h5open(output_file, "w") do file
        write(file, "frequency_hz", Float64.(sim_vars[:frequency_range]))
        write(file, "trace_format", "complex_split_real_imag")
        write(file, "trace_storage_mode", "all")
        write(file, "point_count", length(trace_results))

        for r in trace_results
            idx = r.point_id
            g = create_group(file, "point_$(lpad(string(idx), 6, '0'))")
            write(g, "point_id", idx)
            write(g, "source_frequencies_hz", Float64.(r.freqs))
            write(g, "source_amplitudes_a", Float64.(r.amps))
            write(g, "converged", r.converged ? 1 : 0)
            _gui_write_sparameter_group(g, r.S)
        end
    end

    @info "Saved diagnostic nonlinear S-parameter traces to $output_file"
    return output_file
end

# Summary tables remain the canonical low-cost index of every simulated point.
function save_dataset(df::DataFrame, output_path)
    filtered_df = filter(row -> row.metric < 9e7, df)
    output_file = joinpath(output_path, "df_uniform_analysis.h5")

    h5open(output_file, "w") do file
        mat = Matrix(df)
        filtered_mat = Matrix(filtered_df)

        write(file, "df_matrix", mat)
        if !isempty(filtered_df)
            write(file, "df_filtered_matrix", filtered_mat)
        end
        write(file, "df_column_names", names(df))
    end

    if _gui_trace_storage_mode() == "all"
        save_gui_linear_traces(output_path)
    end
    return nothing
end

function save_nonlinear_dataset(df::DataFrame, output_path; filename="df_nonlinear_analysis.h5")
    if !(:point_id in propertynames(df))
        insertcols!(df, 1, :point_id => collect(1:nrow(df)))
    end

    output_file = joinpath(output_path, filename)
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

    if _gui_trace_storage_mode() == "all"
        save_gui_nonlinear_traces(output_path)
    end
    return nothing
end

# GUI runs retain numerical data only. Plot functions may still construct figures in
# memory, but automatic PNG/sidecar persistence is deliberately disabled.
function plot_update(p; params=nothing, metric=nothing, plot_type::AbstractString="plot", run_id=nothing, extra=Dict())
    @debug "Skipping automatic plot save; regenerate from HDF5 data" plot_type=plot_type
    return nothing
end

function plot_update(p, params, metric; plot_type::AbstractString="plot", run_id=nothing, extra=Dict())
    return plot_update(p; params=params, metric=metric, plot_type=plot_type, run_id=run_id, extra=extra)
end

function plot_update(p, params; metric=nothing, plot_type::AbstractString="plot", run_id=nothing, extra=Dict())
    return plot_update(p; params=params, metric=metric, plot_type=plot_type, run_id=run_id, extra=extra)
end

function correlation_update(fig::Figure;
    params=nothing, metric=nothing, plot_type::AbstractString="correlation", run_id=nothing, extra::Dict=Dict())
    @debug "Skipping automatic correlation figure save; regenerate from HDF5 data" plot_type=plot_type
    return nothing
end
