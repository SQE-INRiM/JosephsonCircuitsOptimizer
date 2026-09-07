# Follow-up Results/storage behavior layered on top of gui_runtime_overrides.jl.
# Keep sweep coordinates unchanged while retaining the circuit-resolved parameter
# dictionary that exists after create_circuit(...) has run for each Linear point.

global gui_linear_resolved_params = Dict{Int,Dict{String,Float64}}()

function _gui_capture_resolved_linear_params!(params)
    if gui_active_stage == "linear" && gui_active_point_id !== nothing && params isa AbstractDict
        names_out, values_out = _gui_numeric_scalar_parameters(params)
        gui_linear_resolved_params[Int(gui_active_point_id)] = Dict(
            names_out[i] => values_out[i] for i in eachindex(names_out)
        )
        # save_data(...) is called later inside user_cost, so make its point metadata
        # reflect the circuit-resolved dictionary rather than the pre-circuit inputs.
        global gui_active_params = deepcopy(params)
    end
    return nothing
end

# Same solution-based cost contract as CostModule, with a lightweight resolved-parameter
# snapshot after create_circuit. Legacy S matrices are derived from the already-computed
# solution only when trace retention requires them; no second simulation is performed.
function sim_sys(vec)
    global device_parameters_space
    global gui_last_linear_S
    global gui_last_linear_params

    device_params_temp = vector_to_param(vec, keys(device_parameters_space))
    circuit = create_circuit(device_params_temp)
    _gui_capture_resolved_linear_params!(device_params_temp)
    @debug "Circuit created"

    sol = linear_solution(device_params_temp, circuit)
    @debug "Linear simulation completed"

    if _gui_trace_storage_mode() == "all"
        gui_last_linear_S = deepcopy(extract_S_parameters(sol, circuit.PortNumber))
        gui_last_linear_params = deepcopy(device_params_temp)
    else
        gui_last_linear_S = nothing
        gui_last_linear_params = nothing
    end

    return sol, device_params_temp
end

# Summary rows remain the canonical sweep-coordinate table. A separate HDF5 group
# stores the resolved post-create_circuit values so Results can show the resolved values.
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

        resolved_group = create_group(file, "resolved_parameters")
        for point_id in sort!(collect(keys(gui_linear_resolved_params)))
            point_group = create_group(resolved_group, "point_$(lpad(string(point_id), 6, '0'))")
            params = gui_linear_resolved_params[point_id]
            param_names = sort!(collect(keys(params)))
            write(point_group, "parameter_names", param_names)
            write(point_group, "parameter_values", [params[name] for name in param_names])
        end
    end

    if _gui_trace_storage_mode() == "all"
        save_gui_linear_traces(output_path)
    end
    return nothing
end

# A normal Julia function cannot inspect the caller's variable name. For GUI-loaded
# user metric code, however, Base.include supports an expression transform. Rewrite
# simple calls such as save_data(S21) into the explicit named equivalent before the
# user file is evaluated. Explicit filename/prefix keywords are always preserved.
function _gui_name_save_data_expr(ex)
    ex isa Expr || return ex

    args = Any[_gui_name_save_data_expr(arg) for arg in ex.args]
    rewritten = Expr(ex.head, args...)
    rewritten.head == :call || return rewritten
    isempty(rewritten.args) && return rewritten
    rewritten.args[1] in (:save_data, :save_datas) || return rewritten

    parameters_index = findfirst(arg -> arg isa Expr && arg.head == :parameters, rewritten.args)
    positional_indices = [i for i in 2:length(rewritten.args) if i != parameters_index]
    length(positional_indices) == 1 || return rewritten
    variable = rewritten.args[only(positional_indices)]
    variable isa Symbol || return rewritten

    parameters = parameters_index === nothing ? Expr(:parameters) : rewritten.args[parameters_index]
    keyword_name(kw) = kw isa Expr && kw.head in (:kw, :(=)) && !isempty(kw.args) ? kw.args[1] : nothing
    has_filename = any(keyword_name(kw) == :filename for kw in parameters.args)
    has_prefix = any(keyword_name(kw) == :prefix for kw in parameters.args)

    if !has_filename
        push!(parameters.args, Expr(:kw, :filename, String(variable)))
        has_prefix || push!(parameters.args, Expr(:kw, :prefix, String(variable)))
    end

    if parameters_index === nothing
        insert!(rewritten.args, 2, parameters)
    end
    return rewritten
end

# Override the desktop cost-module setup only to use the source-name transform above.
# The rest of the engine's history/reset semantics are unchanged.
function setup_cost()
    empty!(cost_history["params_vecs"])
    empty!(cost_history["metrics"])
    empty!(cost_history["timestamps_utc"])

    user_cost_path = joinpath(config.user_inputs_dir, "user_cost_and_performance.jl")
    isfile(user_cost_path) || error("User cost and performance file not found at: $user_cost_path")
    Base.include(_gui_name_save_data_expr, @__MODULE__, user_cost_path)
end

function save_data(vectors;
    category::AbstractString="auto",
    filename=nothing,
    prefix=nothing)

    mode = _gui_trace_storage_mode()
    mode == "none" && return nothing

    current_output_path = CURRENT_OUTPUT_PATH[]
    current_output_path === nothing && error("No active output folder found. Run a simulation first.")

    valid_categories = ("auto", "linear", "nonlinear", "custom")
    category in valid_categories || error("category must be one of: $(valid_categories)")

    if gui_active_stage === nothing || gui_active_point_id === nothing
        @debug "Ignoring save_data outside an active summary-table point" category=category filename=filename
        return nothing
    end

    target_category = category == "auto" ? String(gui_active_stage) : String(category)
    if target_category != "custom" && target_category != gui_active_stage
        @warn "Ignoring save_data because category does not match the active stage" category=category active_stage=gui_active_stage filename=filename
        return nothing
    end

    effective_filename = filename === nothing ? "saved_data" : String(filename)
    effective_prefix = prefix === nothing ? (filename === nothing ? "data" : String(filename)) : String(prefix)

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

        quantity_name = _gui_unique_child_name(point_group, effective_filename)
        quantity_group = create_group(point_group, quantity_name)
        write(quantity_group, "quantity_name", effective_filename)
        write(quantity_group, "prefix", effective_prefix)

        if vectors isa AbstractVector{<:Number}
            _gui_write_array(quantity_group, effective_prefix, vectors)
        else
            for (i, v) in enumerate(vectors)
                _gui_write_array(quantity_group, "$(effective_prefix)_$(i)", v)
            end
        end
    end

    @debug "Saved selected data" filepath=filepath point_id=gui_active_point_id quantity=effective_filename
    return filepath
end

save_datas(args...; kwargs...) = save_data(args...; kwargs...)

macro save_data(variable)
    variable isa Symbol || error("@save_data expects a variable name, for example: @save_data S21")
    label = String(variable)
    return :(save_data($(esc(variable)); filename=$label, prefix=$label))
end

macro save_datas(variable)
    variable isa Symbol || error("@save_datas expects a variable name, for example: @save_datas S21")
    label = String(variable)
    return :(save_data($(esc(variable)); filename=$label, prefix=$label))
end
