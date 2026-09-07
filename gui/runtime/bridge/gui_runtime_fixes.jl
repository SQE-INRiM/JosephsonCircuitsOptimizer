# Follow-up fixes for the GUI point-addressable result contract.
# Loaded after gui_runtime_overrides.jl so these definitions refine the desktop-only policy
# without modifying the embedded JCO engine source.

function _gui_save_optimization_history(param_cols::Vector{String}, initial_count::Int)
    output_path = CURRENT_OUTPUT_PATH[]
    output_path === nothing && return nothing

    params_history = cost_history["params_vecs"]
    metric_history = cost_history["metrics"]
    first_bo = initial_count + 1
    first_bo > length(metric_history) && return nothing

    bo_params = params_history[first_bo:end]
    bo_metrics = Float64.(metric_history[first_bo:end])
    n = length(bo_metrics)
    n == 0 && return nothing

    matrix = Matrix{Float64}(undef, n, length(param_cols) + 2)
    for i in 1:n
        matrix[i, 1] = i
        for (j, _) in enumerate(param_cols)
            matrix[i, j + 1] = Float64(bo_params[i][j])
        end
        matrix[i, end] = bo_metrics[i]
    end

    filepath = joinpath(output_path, "df_optimization_analysis.h5")
    h5open(filepath, "w") do file
        write(file, "df_optimization_matrix", matrix)
        write(file, "df_optimization_column_names", vcat(["evaluation"], param_cols, ["metric"]))
    end
    @info "Saved optimization evaluation history" filepath=filepath evaluations=n
    return filepath
end

# The summary DataFrame now contains point_id and may contain arbitrary analysis metrics.
# Optimization must therefore select its inputs explicitly instead of assuming that every
# column except the last one is a design variable and that the last column is the objective.
function run_optimization(df::DataFrame)
    isempty(df) && error("The input DataFrame in the optimizer is empty. Please provide a non-empty DataFrame.")
    hasproperty(df, :metric) || error("The optimization dataset does not contain the required metric column.")

    global device_parameters_space
    param_cols = String.(collect(keys(device_parameters_space)))
    missing_cols = [name for name in param_cols if !(name in names(df))]
    isempty(missing_cols) || error("Optimization dataset is missing device parameter columns: $(join(missing_cols, ", "))")

    d = length(param_cols)
    if d < 2
        error("""
    Surrogate optimization is disabled for d < 2.

    Reason:
        The current Surrogates.jl backend is unstable in 1D.

    What to do instead:
        Add a second free parameter, with also a constant value.

    Detected parameters: $(param_cols)
    """)
    end

    bounds = [(minimum(df[!, col]), maximum(df[!, col])) for col in param_cols]
    println("Optimization parameter columns: ", param_cols)
    println("Bounds: ", bounds)

    lb = Float64[b[1] for b in bounds]
    ub = Float64[b[2] for b in bounds]

    initial_points = [Tuple(Float64(row[col]) for col in param_cols) for row in eachrow(df)]
    initial_values = Float64.(df[!, :metric])

    global number_initial_points = length(initial_points)
    global plot_index = number_initial_points

    # cost_history already contains the Linear sweep evaluations. Record its length here
    # so Results can persist only evaluations genuinely requested by the optimizer.
    history_before_bo = length(cost_history["metrics"])

    n_maxiters = optimizer_config[:max_optimizer_iterations]
    n_num_new_samples = optimizer_config[:new_samples_per_optimizer_iteration]

    sur_name = string(get(optimizer_config, :surrogate_model, "Kriging"))
    surrogate = _make_surrogate_model(sur_name, initial_points, initial_values, lb, ub)
    opt_name = string(get(optimizer_config, :optimizer_strategy, "SRBF"))
    strategy = _make_optimizer_strategy(opt_name)
    samp_name = string(get(optimizer_config, :sampling_strategy, "RandomSample"))
    sampler = _make_sampling_strategy(samp_name)

    global cost_progress_ctx = Progress.start!(; N=n_maxiters * n_num_new_samples, stage="BO")

    result = surrogate_optimize!(
        cost,
        strategy,
        lb,
        ub,
        surrogate,
        sampler,
        maxiters=n_maxiters,
        num_new_samples=n_num_new_samples,
    )

    try
        Progress.finish!(cost_progress_ctx)
    catch
    end

    _gui_save_optimization_history(param_cols, history_before_bo)

    optimal_vec = result[1]
    optimal_metric = result[2]
    optimal_params = vector_to_param(optimal_vec, Symbol.(param_cols))

    return optimal_params, optimal_metric
end

# Linear summary metrics are allowed to be sparse. A masked/early-return point may only
# produce `metric`, while later points may additionally return S21_band, ripple, etc.
# Missing analysis values are represented by NaN so every DataFrame column retains the
# same length and the row/point_id relationship stays exact.
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
                point_id=i,
                params=deepcopy(gui_last_linear_params),
                S=deepcopy(gui_last_linear_S),
            ))
        end

        # First extend every already-known analysis column for this row.
        for values in values(extra_metrics)
            push!(values, NaN)
        end

        # Then write the metrics that actually exist for this point. If a metric appears
        # for the first time at row i, backfill all preceding rows with NaN.
        for (name, value) in last_cost_metrics
            name == :metric && continue
            if !haskey(extra_metrics, name)
                extra_metrics[name] = fill(NaN, i)
            end
            extra_metrics[name][i] = Float64(value)
        end

        Progress.tick!(ctx; i=i)
    end
    Progress.finish!(ctx)
    println("Total points excluded: ", point_exluded)

    df = DataFrame(initial_points)
    rename!(df, Symbol.(string.(column_names)))
    insertcols!(df, 1, :point_id => collect(1:number_initial_points))
    df.metric = initial_values

    for (name, metric_values) in extra_metrics
        df[!, name] = metric_values
    end

    if filter_df
        filtered_df = filter(row -> row.metric < 9e7, df)
        return df, filtered_df
    else
        return df
    end
end

"""
    save_datas(vectors; category="auto", filename="saved_datas", prefix="vec")

Store selected numerical arrays for the active summary-table point. With the default
`category="auto"`, data follow the stage currently executing: calls from `user_cost`
go to `saved_data/linear.h5`, and calls from `user_performance` go to
`saved_data/nonlinear.h5`. Use `category="custom"` explicitly for stage-independent data.
"""
function save_datas(vectors;
    category::AbstractString="auto",
    filename::AbstractString="saved_datas",
    prefix::AbstractString="vec")

    mode = _gui_trace_storage_mode()
    mode == "none" && return nothing

    current_output_path = CURRENT_OUTPUT_PATH[]
    current_output_path === nothing && error("No active output folder found. Run a simulation first.")

    valid_categories = ("auto", "linear", "nonlinear", "custom")
    category in valid_categories || error("category must be one of: $(valid_categories)")

    if gui_active_stage === nothing || gui_active_point_id === nothing
        @debug "Ignoring save_datas outside an active summary-table point" category=category filename=filename
        return nothing
    end

    target_category = category == "auto" ? String(gui_active_stage) : String(category)

    if target_category != "custom" && target_category != gui_active_stage
        @warn "Ignoring save_datas because category does not match the active stage" category=category active_stage=gui_active_stage filename=filename
        return nothing
    end

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