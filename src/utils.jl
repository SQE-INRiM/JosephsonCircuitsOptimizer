#-------------------------------------UTILS-------------------------------------------

"""
    vector_to_param(vec::Vector{Float64}, keys::Vector{Symbol})

This function converts a vector of parameter values into a dictionary using the provided keys.

# Arguments:
- `vec::Vector{Float64}`: A vector of parameter values.
- `keys::Vector{Symbol}`: A vector of keys (symbols) to associate with each parameter value.

# Returns:
- A dictionary where the keys are the provided symbols and the values are the corresponding elements from the vector.
"""
function vector_to_param(vec, keys)
    keys_array = collect(keys)  # Convert KeySet to an array
    Dict(keys_array[i] => vec[i] for i in 1:length(keys_array))
end

"""
    generate_all_initial_points(params_space)

This function generates all possible combinations of parameter values from a dictionary representing the parameter space.

# Arguments:
- `params_space`: A dictionary where the keys are parameter names and the values are lists of parameter values.

# Returns:
- A list of tuples, where each tuple represents a combination of parameter values.
"""
function generate_all_initial_points(params_space)
    # Extract the parameter value lists from the dictionary
    value_lists = values(params_space)
    
    # Initialize an empty set to store the generated points (sets do not allow duplicates)
    points_set = Set{Tuple{Float64, Vararg{Float64}}}()
    
    # Generate all combinations using nested for loops (generalized)
    for values in Iterators.product(value_lists...)
        # Convert each combination into a tuple of floats and add it to the set
        push!(points_set, tuple(map(float, values)...))
    end

    # Convert the set back to a list (array)
    return collect(points_set)
end

"""
    save_output_file(header, data_dict, filename; indent=4)

This function saves a dictionary (`data_dict`) with a header to a JSON file.

# Arguments:
- `header`: A dictionary or named tuple containing header information.
- `data_dict`: The main dictionary to save.
- `filename`: The name of the output JSON file.
- `indent`: The number of spaces for indentation in the JSON file (default is 4).

# Returns:
- Nothing. The data is saved to the specified JSON file.
"""
function save_output_file(header, data_dict, filename; indent=4)
    # Combine the header and data into a single dictionary
    combined_data = Dict(
        "header" => header,
        "data" => data_dict
    )

    # Save the combined dictionary to a JSON file
    open(filename, "w") do f
        JSON.print(f, combined_data, indent)
    end

    @info "Data saved to $filename"
end

"""
    save_output_file(data_dict, filename; indent=4)

This function saves a dictionary (`data_dict`) to a JSON file.

# Arguments:
- `data_dict`: The main dictionary to save.
- `filename`: The name of the output JSON file.
- `indent`: The number of spaces for indentation in the JSON file (default is 4).

# Returns:
- Nothing. The data is saved to the specified JSON file.
"""
function save_output_file(data_dict, filename; indent=4)
    # Save the combined dictionary to a JSON file
    open(filename, "w") do f
        JSON.print(f, data_dict, indent)
    end

    @info "Data saved to $filename"
end

"""
    simulation_time_estimation(n_initial_points, n_maxiters, n_num_new_samples)

This function estimates the total time required for the simulation and calculates the finish time.

# Arguments:
- `n_initial_points`: The number of initial points in the simulation.
- `n_maxiters`: The number of iterations for optimization.
- `n_num_new_samples`: The number of new samples to generate per iteration.

# Returns:
- A tuple with two strings: the estimated simulation time and the estimated finish time.
"""
function simulation_time_estimation(n_initial_points, n_maxiters, n_num_new_samples)
    # Define the time per point in seconds
    time_per_point = 5.0 # seconds
    
    # Calculate total time for the simulation
    total_points = n_initial_points + n_maxiters * n_num_new_samples
    time_estimated = total_points * time_per_point  # in seconds
    
    # Breakdown time into days, hours, minutes, and seconds
    total_seconds = round(Int, time_estimated)
    days = div(total_seconds, 86400)
    hours = div(total_seconds % 86400, 3600)
    minutes = div(total_seconds % 3600, 60)
    seconds = total_seconds % 60
    
    # Calculate the finishing time
    current_time = Dates.now()  # Current date and time
    finish_time = current_time + Dates.Second(total_seconds)
    
    # Create formatted time strings
    formatted_estimation = "$(days)d $(hours)h $(minutes)m $(seconds)s"
    formatted_finish_time = string(finish_time) 
    
    return formatted_estimation, formatted_finish_time
end

"""
    simulation_time(start_time)

This function calculates the total time elapsed since `start_time` and returns it in a formatted string.

# Arguments:
- `start_time`: The start time for the simulation (in seconds).

# Returns:
- A string representing the total elapsed time in days, hours, minutes, and seconds.
"""
function simulation_time(start_time)
    total_time = time() - start_time

    total_seconds = round(Int, total_time)
    days = div(total_seconds, 86400)
    hours = div(total_seconds % 86400, 3600)
    minutes = div(total_seconds % 3600, 60)
    seconds = total_seconds % 60

    formatted_time = "$(days)d_$(hours)h_$(minutes)m_$(seconds)s"
    
    return formatted_time
end

"""
    parse_value(value)

This function parses a value, which could be a dictionary (defining a range), a string (to be evaluated), 
or a simple non-string value.

# Arguments:
- `value`: The value to parse.

# Returns:
- A parsed value, which could be a range, an evaluated expression, or the original value.
"""

function parse_value(value)
    if isa(value, Dict) && all(k -> k in keys(value), ["start", "step", "stop"])
        # Handle range dictionaries
        start = value["start"]
        step  = value["step"]
        stop  = value["stop"]
        return collect(start:step:stop)
    elseif isa(value, String)
        # Handle strings as expressions or numbers
        @debug "Parsing string value: $value"
        try
            # Attempt to parse as a number or expression
            parsed_value = Meta.parse(value)
            if isa(parsed_value, Symbol)
                # If the parsed value is a Symbol, return the original string
                @debug "Parsed value is a Symbol, returning original string: $value"
                return value
            else
                # Otherwise, return the parsed value
                @debug "Parsed value: $parsed_value"
                return parsed_value
            end
        catch
            # If parsing fails, return the string as-is
            @debug "Failed to parse string value: $value"
            return value
        end
    else
        # Return non-dictionary and non-string values as-is
        @debug "Returning non-string value: $value"
        return value
    end
end


"""
    evaluate_expr(value, params::Dict{Symbol,Any})

This function evaluates an expression using the provided parameter values from `params`.

# Arguments:
- `value`: The expression to evaluate.
- `params::Dict{Symbol,Any}`: A dictionary of parameter values to be used in the evaluation.

# Returns:
- The evaluated result of the expression.
"""
function evaluate_expr(value, params::Dict{Symbol, Any})
    if isa(value, Expr)
        @debug "Evaluating expression: $value"
        assignments = [:(const $(k) = $(params[k])) for k in keys(params)]
        block = Expr(:block, assignments..., value)
        evaluated_value = eval(block)
        @info "Evaluated value: $evaluated_value"
        return evaluated_value
    else
        # Do not evaluate strings here; they will be handled in linear_simulation
        @debug "Returning non-expression value: $value"
        return value
    end
end

"""
    load_params(filename)

This function loads parameters from a JSON file, parses them, and evaluates any expressions in the parameter values.

# Arguments:
- `filename`: The path to the JSON file containing the parameters.

# Returns:
- A dictionary containing the parsed and evaluated parameters.
"""

function load_params(filename; optimal::Union{Dict,Nothing}=nothing)
    # --- Robust JSON loading ---
    raw_str = read(filename, String)
    if startswith(raw_str, '\ufeff')
        raw_str = raw_str[2:end]
    end
    clean_str = filter(c -> isprint(c) || c in ['\n','\r','\t'], raw_str)
    raw_params = JSON.parse(clean_str)
    @debug "Raw parameters from JSON file: $raw_params"

    params = Dict{Symbol,Any}()

    for (k, v) in raw_params
        key = Symbol(k)
        values = nothing
        has_tag = false

        if isa(v, Dict)
            # Determine values
            if all(haskey(v, fld) for fld in ("start","step","stop"))
                values = collect(v["start"]:v["step"]:v["stop"])
            elseif haskey(v, "values")
                values = v["values"]
            else
                error("Unsupported dictionary format for key: $k")
            end

            # Just check if "tag" exists
            if haskey(v, "tag")
                has_tag = true
            end
        else
            values = v
        end

        # Override if optimal dict is given AND this param is tagged AND present in optimal
        if optimal !== nothing && has_tag && haskey(optimal, key)
            @debug "Overriding $key with optimal value $(optimal[key])"
            params[key] = [optimal[key]]
        else
            params[key] = values
        end
    end

    @debug "Final parsed parameters: $params"
    return params
    
end




"""
    load_dataset(path)

This function loads a dataset from an HDF5 file and returns two DataFrames: one with the full dataset and one with a filtered dataset.

# Arguments:
- `path`: The path to the HDF5 file.

# Returns:
- A tuple of two DataFrames: the full dataset and the filtered dataset.
"""
function load_dataset(path)
    df = h5open(path, "r") do file
        # Read the matrix and column names
        mat = read(file, "df_matrix")
        col_names = read(file, "df_column_names")
        
        # Recreate the DataFrame with the column names
        DataFrame(mat, col_names)
    end

    filtered_df = h5open(path, "r") do file
        # Read the matrix and column names
        filtered_mat = read(file, "df_filtered_matrix")
        col_names = read(file, "df_column_names")
        
        # Recreate the DataFrame with the column names
        DataFrame(filtered_mat, col_names)
    end

    return df, filtered_df
end

# Read the function definition from the source file
function copy_function(source_file, dest_file)
    content = read(source_file, String)  # Read the whole file as a string
    open(dest_file, "w") do io
        write(io, content)  # Write the content to the new file
    end
end



function _meta_summary(params, metric; max_params::Int=4)
    parts = String[]
    if metric !== nothing
        try
            push!(parts, "metric=$(round(Float64(metric), sigdigits=6))")
        catch
            push!(parts, "metric=$(metric)")
        end
    end
    if params isa AbstractDict
        ks = sort(collect(keys(params)); by=string)
        shown = first(ks, min(length(ks), max_params))
        for k in shown
            v = params[k]
            if v isa Number
                push!(parts, "$(k)=$(round(v, sigdigits=6))")
            else
                push!(parts, "$(k)=$(v)")
            end
        end
        if length(ks) > max_params
            push!(parts, "…")
        end
    end
    return join(parts, " | ")
end


function _write_sidecar_json(png_path::AbstractString; params=nothing, metric=nothing,
    plot_type::AbstractString="plot", run_id=nothing, extra=Dict())
    meta = Dict{String,Any}(
    "png" => basename(png_path),
    "timestamp" => string(Dates.now()),
    "plot_type" => plot_type
    )
    run_id !== nothing && (meta["run_id"] = run_id)
    metric !== nothing && (meta["metric"] = metric)

    if params isa AbstractDict
        meta["params"] = Dict(string(k)=>v for (k,v) in params)
    elseif params !== nothing
        meta["params"] = params
    end

    if extra isa AbstractDict && !isempty(extra)
        meta["extra"] = Dict(string(k)=>v for (k,v) in extra)
    elseif extra !== nothing && !(isempty(extra))
        meta["extra"] = extra
    end

    json_path = replace(String(png_path), r"\.png$" => ".json")
    write(json_path, JSON.json(meta, 4))

    return json_path
end

function plot_update(p; params=nothing, metric=nothing, plot_type::AbstractString="plot", run_id=nothing, extra=Dict())
    mkpath(plot_path)
    timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS-sss")
    filepath = joinpath(plot_path, "plot_$timestamp.png")

    summary = _meta_summary(params, metric)
    
    if !isempty(summary)
        try
            P.plot!(p; subtitle=summary)
        catch
        end
    end
    
    savefig(p, filepath)
    _write_sidecar_json(filepath; params=params, metric=metric, plot_type=plot_type, run_id=run_id, extra=extra)

    @info "Saved plot to $filepath"
    return filepath
end

function plot_update(p, params, metric; plot_type::AbstractString="plot", run_id=nothing, extra=Dict())
    return plot_update(p; params=params, metric=metric, plot_type=plot_type, run_id=run_id, extra=extra)
end
function plot_update(p, params; metric=nothing, plot_type::AbstractString="plot", run_id=nothing, extra=Dict())
    return plot_update(p; params=params, metric=metric, plot_type=plot_type, run_id=run_id, extra=extra)
end
"""
    correlation_update(fig::Figure; params=nothing, metric=nothing, plot_type="correlation", run_id=nothing, extra=Dict())

Save a Makie `Figure` into `corr_path` safely (write to .part then move),
and write a sidecar JSON metadata file with the same basename.
"""
function correlation_update(fig::Figure;
    params=nothing,
    metric=nothing,  # will be skipped if array (by your sidecar writer)
    plot_type::AbstractString="correlation",
    run_id=nothing,
    extra::Dict=Dict()
    )
    
    isdir(corr_path) || mkpath(corr_path)

    timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS-sss")
    rid = isnothing(run_id) ? "" : "_run$(run_id)"

    filename  = "corr_$(timestamp)$(rid).png"
    filepath  = joinpath(corr_path, filename)
    tmpfile   = filepath * ".part.png"

    save(tmpfile, fig)
    mv(tmpfile, filepath; force=true)

    _write_sidecar_json(filepath; params=params, metric=metric, plot_type=plot_type, run_id=run_id, extra=extra)

    @info "Saved correlation figure → $filepath"
    return filepath
end



function plot_delta_vs_amplitude(results)
    
    if length(results) < 2
        @info "Not enough points for amplitude sweep (need ≥ 2)."
        return nothing
    end
    
    # Extract amplitudes as matrix (N x M, where N points, M sources)
    amps_mat = reduce(vcat, [r.amps' for r in results])
    @debug "Amplitudes: $amps_mat"
    delta_vals = [r.delta_quantity for r in results]
    @debug "Delta: $delta_vals"

    # Find which column actually varies
    amp_vars = [maximum(amps_mat[:, j]) - minimum(amps_mat[:, j]) for j in 1:size(amps_mat, 2)]
    changing_idx = findall(!=(0.0), amp_vars)

    if length(changing_idx) == 0
        @info "No amplitude sweep detected (all amplitudes constant). Skipping plot."
        return nothing
    elseif length(changing_idx) > 1
        @warn "Multiple amplitudes vary, plotting the first varying one only"
    end

    idx = changing_idx[1]  # pick the first varying amplitude
    sweep_amps = amps_mat[:, idx]

    # Plot scatter
    plt = plot(
        sweep_amps, delta_vals,
        xlabel = "Signal amplitude (source $idx)",
        ylabel = "Δ quantity (nonlinear - linear)",
        title = "Nonlinear correction vs. amplitude (source $idx)",
        legend = true,
        markersize = 4,
        grid = true,
        label = ""
    )

    # Build key dynamically for the vertical line
    key = Symbol("source_$(idx)_non_linear_amplitude_for_delta_correction")
    if haskey(sim_vars, key)
        P.vline!(
            plt,
            [sim_vars[key]],
            color = :darkblue,
            linewidth = 1,
            linestyle = :dash,
            label = "Source $idx amplitude used = $(sim_vars[key])"
        )
    else
        @warn "No amplitude-for-delta-correction found for source $idx"
    end

    return plt
end


function plot_performance_vs_amplitude(results)

    if length(results) < 2
        @info "Not enough points for amplitude sweep (need ≥ 2)."
        return nothing
    end

    amps_mat = reduce(vcat, [r.amps' for r in results])
    @debug "Results: $results"
    performances = [r.performance for r in results]
    @debug "Performances: $performances"

    # Find which column actually varies
    amp_vars = [maximum(amps_mat[:, j]) - minimum(amps_mat[:, j]) for j in 1:size(amps_mat, 2)]
    changing_idx = findall(!=(0.0), amp_vars)

    if length(changing_idx) == 0
        @info "No amplitude sweep detected: all amplitudes are constant"
        return nothing
    elseif length(changing_idx) > 1
        @warn "Multiple amplitudes vary, plotting the first varying one only"
    end

    idx = changing_idx[1]  # pick the first varying amplitude
    sweep_amps = amps_mat[:, idx]

    # Plot scatter
    plt = plot(
        sweep_amps, performances,
        xlabel = "Signal amplitude (source $idx)",
        ylabel = "Performance",
        title = "Performance vs. amplitude (source $idx)",
        legend = true,
        markersize = 4,
        grid = true,
        label = ""
    )

    # Build key dynamically for the vertical line
    key = Symbol("source_$(idx)_non_linear_amplitude_for_delta_correction")
    if haskey(sim_vars, key)
        P.vline!(
            plt,
            [sim_vars[key]],
            color = :darkblue,
            linewidth = 1,
            linestyle = :dash,
            label = "Source $idx amplitude used = $(sim_vars[key])"
        )
    else
        @warn "No amplitude-for-delta-correction found for source $idx"
    end

    return plt

end

function get_delta_correction_amplitudes()
    # Detect all delta correction amplitude keys
    amp_keys = filter(k -> occursin("_non_linear_amplitude_for_delta_correction", String(k)), keys(sim_vars))
    
    # Convert to Vector before sorting
    amp_keys_vec = collect(amp_keys)
    
    # Order them by source number
    sorted_keys = sort(amp_keys_vec, by = k -> parse(Int, match(r"source_(\d+)", String(k)).captures[1]))
    
    # Return amplitudes in order
    return [sim_vars[k] for k in sorted_keys]
end


#---------------------- STOP / STATUS HELPERS ----------------------
# NOTE: StopRequested/stop_requested/stop_if_requested!/clear_stopfile! are defined at the top of this file.

struct StopRequested <: Exception end

stop_requested(workspace::AbstractString) = isfile(joinpath(workspace, "STOP"))

function stop_if_requested!(workspace::AbstractString)
    if stop_requested(workspace)
        throw(StopRequested())
    end
    return nothing
end

function clear_stopfile!(workspace::AbstractString)
    stopfile = joinpath(workspace, "STOP")
    if isfile(stopfile)
        try rm(stopfile; force=true) catch end
    end
    return nothing
end

"""Return the path of the STOP request file inside a workspace."""
stopfile_path(workspace::AbstractString) = joinpath(workspace, "STOP")

"""Backwards-compatible alias (older code calls `check_stop`)."""
function check_stop(; workspace::AbstractString = (isdefined(@__MODULE__, :config) ? config.WORKING_SPACE : pwd()))
    stop_if_requested!(workspace)
end

function atomic_write_json(path::AbstractString, obj; indent::Int=4)
    tmp = path * ".tmp"
    open(tmp, "w") do io
        JSON.print(io, obj, indent)
    end
    mv(tmp, path; force=true)
    return nothing
end

"""
    write_status(output_path; status, stage=nothing, message=nothing, extra=Dict())

Write / update a status.json file in the current output folder.
"""
function write_status(output_path::AbstractString; status::AbstractString, stage=nothing, message=nothing, extra=Dict{String,Any}())
    status_path = joinpath(output_path, "status.json")
    d = Dict{String,Any}(
        "status" => status,
        "timestamp_utc" => Dates.format(Dates.now(Dates.UTC), dateformat"yyyy-mm-ddTHH:MM:SSZ"),
    )
    if stage !== nothing
        d["stage"] = stage
    end
    if message !== nothing
        d["message"] = message
    end
    for (k,v) in extra
        d[k] = v
    end
    try
        atomic_write_json(status_path, d; indent=4)
    catch
        # best-effort
    end
    return status_path
end
