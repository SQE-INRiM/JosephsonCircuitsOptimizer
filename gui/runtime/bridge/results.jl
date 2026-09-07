using Pkg
Pkg.activate(dirname(Base.active_project()))
using HDF5, JSON, Dates

workspace = normpath(ARGS[1])

json_safe(x) = x isa AbstractFloat && !isfinite(x) ? string(x) : x

function resolved_parameter_catalog(file)
    haskey(file, "resolved_parameters") || return Dict{String,Any}()
    root = file["resolved_parameters"]
    catalog = Dict{String,Any}()
    for point_key in String.(collect(keys(root)))
        point_group = root[point_key]
        haskey(point_group, "parameter_names") && haskey(point_group, "parameter_values") || continue
        names = String.(read(point_group, "parameter_names"))
        values = read(point_group, "parameter_values")
        catalog[point_key] = Dict(name => json_safe(value) for (name, value) in zip(names, values))
    end
    catalog
end

function matrix_table(file_path, matrix_key, names_key; filtered_key=nothing)
    isfile(file_path) || return nothing
    return h5open(file_path, "r") do file
        haskey(file, matrix_key) || return nothing
        matrix = read(file, matrix_key)
        names = String.(read(file, names_key))
        rows = [[json_safe(matrix[row, col]) for col in axes(matrix, 2)] for row in axes(matrix, 1)]
        filtered = nothing
        if filtered_key !== nothing && haskey(file, filtered_key)
            selected = read(file, filtered_key)
            filtered = [[json_safe(selected[row, col]) for col in axes(selected, 2)] for row in axes(selected, 1)]
        end
        Dict(
            "columns" => names,
            "rows" => rows,
            "filteredRows" => filtered,
            "resolvedParameters" => resolved_parameter_catalog(file),
            "file" => basename(file_path),
        )
    end
end

function read_json(path)
    isfile(path) || return nothing
    try JSON.parsefile(path) catch; nothing end
end

function read_text(path)
    isfile(path) || return nothing
    try read(path, String) catch; nothing end
end

function julia_snapshot_files(root)
    files = Dict{String,String}()
    isdir(root) || return files
    for name in sort(readdir(root))
        endswith(lowercase(name), ".jl") || continue
        content = read_text(joinpath(root, name))
        content === nothing || (files[name] = content)
    end
    files
end

# Each completed run already contains an immutable copy of user_inputs. Results reads
# those files directly so the displayed setup is the setup that produced that run,
# independent of whatever is currently being edited in Setup.
function setup_snapshot(run_path)
    root = joinpath(run_path, "inputs_snapshot")
    isdir(root) || return nothing
    return Dict(
        "parameters" => read_json(joinpath(root, "device_parameters_space.json")),
        "sources" => read_json(joinpath(root, "drive_physical_quantities.json")),
        "simulation" => read_json(joinpath(root, "simulation_config.json")),
        "optimizer" => read_json(joinpath(root, "optimizer_config.json")),
        "juliaFiles" => julia_snapshot_files(root),
    )
end

# Completed runs always keep cost_history in run_config.json. If the dedicated
# optimization HDF5 was not written, reconstruct the BO block from that history.
#
# Full runs contain Linear + BO evaluations in cost_history. Optimization-only runs
# call setup_cost() before loading the seed dataset, so their history contains BO only.
# Bookkeeping writes an empty parameter_space for stage-only optimization runs; use that
# explicit distinction instead of guessing from history length.
function optimization_from_bookkeeping(metadata, linear)
    metadata isa AbstractDict || return nothing
    linear isa AbstractDict || return nothing
    results = get(metadata, "results", nothing)
    results isa AbstractDict || return nothing
    history = get(results, "metric_history", nothing)
    history isa AbstractDict || return nothing
    params_history = get(history, "params_vecs", nothing)
    metric_history = get(history, "metrics", nothing)
    params_history isa AbstractVector || return nothing
    metric_history isa AbstractVector || return nothing

    columns = String.(get(linear, "columns", String[]))
    point_index = findfirst(==("point_id"), columns)
    metric_index = findfirst(==("metric"), columns)
    point_index === nothing && return nothing
    metric_index === nothing && return nothing
    metric_index > point_index + 1 || return nothing
    param_names = columns[(point_index + 1):(metric_index - 1)]

    initial_count = length(get(linear, "rows", Any[]))
    total = min(length(params_history), length(metric_history))
    total > 0 || return nothing

    parameter_space = get(metadata, "parameter_space", nothing)
    history_is_bo_only = parameter_space isa AbstractDict && isempty(parameter_space)
    first_bo = history_is_bo_only ? 1 : initial_count + 1
    available = history_is_bo_only ? total : total - initial_count
    available > 0 || return nothing

    optimizer_settings = get(metadata, "optimizer_settings", Dict{String,Any}())
    maxiters = try Int(get(optimizer_settings, "max_optimizer_iterations", available)) catch; available end
    per_iteration = try Int(get(optimizer_settings, "new_samples_per_optimizer_iteration", 1)) catch; 1 end
    expected = max(1, maxiters * per_iteration)
    bo_count = min(available, expected)

    rows = Any[]
    for i in 1:bo_count
        history_index = first_bo + i - 1
        vec = params_history[history_index]
        vec isa AbstractVector || return nothing
        length(vec) >= length(param_names) || return nothing
        push!(rows, Any[i, [json_safe(vec[j]) for j in eachindex(param_names)]..., json_safe(metric_history[history_index])])
    end
    isempty(rows) && return nothing

    return Dict(
        "columns" => vcat(["evaluation"], param_names, ["metric"]),
        "rows" => rows,
        "filteredRows" => nothing,
        "resolvedParameters" => Dict{String,Any}(),
        "file" => "simulation_info/run_config.json · recovered optimizer history",
    )
end

function dataset_length(group, key)
    haskey(group, key) || return nothing
    return prod(size(group[key]))
end

function saved_data_catalog(file_path)
    isfile(file_path) || return nothing
    return try
        h5open(file_path, "r") do file
            frequency_point_count = haskey(file, "frequency_hz") ? prod(size(file["frequency_hz"])) : nothing
            points = Any[]
            for point_key in sort(String.(collect(keys(file))))
                startswith(point_key, "point_") || continue
                point_group = file[point_key]
                point_group isa HDF5.Group || continue
                point_id = haskey(point_group, "point_id") ? Int(read(point_group, "point_id")) : tryparse(Int, replace(point_key, "point_" => ""))
                parameters = Dict{String,Any}()
                if haskey(point_group, "parameter_names") && haskey(point_group, "parameter_values")
                    names = String.(read(point_group, "parameter_names"))
                    values = read(point_group, "parameter_values")
                    for (name, value) in zip(names, values)
                        parameters[name] = json_safe(value)
                    end
                end
                quantities = Any[]
                metadata_keys = Set(["point_id", "parameter_names", "parameter_values", "source_frequencies_hz", "source_amplitudes_a"])
                for quantity_key in sort(String.(collect(keys(point_group))))
                    quantity_key in metadata_keys && continue
                    quantity_group = point_group[quantity_key]
                    quantity_group isa HDF5.Group || continue
                    arrays = Any[]
                    for array_key in sort(String.(collect(keys(quantity_group))))
                        array_key in ("quantity_name", "prefix") && continue
                        array_group = quantity_group[array_key]
                        array_group isa HDF5.Group || continue
                        storage = haskey(array_group, "storage") ? String(read(array_group, "storage")) : "unknown"
                        point_count = something(dataset_length(array_group, "values"), dataset_length(array_group, "real"), 0)
                        push!(arrays, Dict("name" => array_key, "storage" => storage, "length" => point_count))
                    end
                    push!(quantities, Dict(
                        "name" => quantity_key,
                        "quantityName" => haskey(quantity_group, "quantity_name") ? String(read(quantity_group, "quantity_name")) : quantity_key,
                        "prefix" => haskey(quantity_group, "prefix") ? String(read(quantity_group, "prefix")) : "",
                        "arrays" => arrays,
                    ))
                end
                push!(points, Dict("pointId" => point_id, "parameters" => parameters, "quantities" => quantities))
            end
            Dict(
                "schemaVersion" => haskey(file, "schema_version") ? String(read(file, "schema_version")) : "unknown",
                "stage" => haskey(file, "stage") ? String(read(file, "stage")) : "unknown",
                "frequencyPointCount" => frequency_point_count,
                "points" => points,
            )
        end
    catch
        nothing
    end
end

function trace_files(run_path; max_files=24, max_points=2000)
    root = joinpath(run_path, "data_saved_by_user")
    isdir(root) || return Any[]
    files = filter(path -> endswith(lowercase(path), ".h5"), [joinpath(dir, file) for (dir, _, files) in walkdir(root) for file in files])
    traces = Any[]
    for file_path in Iterators.take(sort(files), max_files)
        datasets = Dict{String,Any}()
        try
            h5open(file_path, "r") do file
                for key in keys(file)
                    value = read(file, key)
                    if value isa AbstractArray && eltype(value) <: Number
                        flat = vec(value)
                        stride = max(1, cld(length(flat), max_points))
                        sampled = flat[1:stride:end]
                        datasets[String(key)] = [json_safe(real(x)) for x in sampled]
                        if eltype(flat) <: Complex
                            datasets[String(key) * "_imag"] = [json_safe(imag(x)) for x in sampled]
                        end
                    end
                end
            end
        catch
        end
        isempty(datasets) || push!(traces, Dict("name" => splitext(basename(file_path))[1], "relativePath" => relpath(file_path, run_path), "datasets" => datasets))
    end
    traces
end

outputs = joinpath(workspace, "outputs")
runs = Any[]
first_file(paths) = begin
    selected = filter(isfile, paths)
    isempty(selected) ? "" : first(selected)
end
if isdir(outputs)
    for run_path in sort(filter(isdir, [joinpath(outputs, entry) for entry in readdir(outputs)]), rev=true)
        startswith(basename(run_path), "output_") || continue
        linear_file = first_file([joinpath(run_path, name) for name in ["df_uniform_analysis.h5", "df_uniform_analysis_lin.h5"]])
        optimization_file = first_file([joinpath(run_path, "df_optimization_analysis.h5")])
        nonlinear_file = first_file([joinpath(run_path, name) for name in ["df_nonlinear_analysis.h5", "df_uniform_analysis_nonlin.h5"]])
        if isempty(linear_file)
            candidates = filter(path -> occursin("lin", lowercase(basename(path))), [joinpath(run_path, f) for f in readdir(run_path) if endswith(lowercase(f), ".h5")])
            linear_file = isempty(candidates) ? "" : first(candidates)
        end
        if isempty(nonlinear_file)
            candidates = filter(path -> occursin("nonlin", lowercase(basename(path))) || occursin("gain", lowercase(basename(path))), [joinpath(run_path, f) for f in readdir(run_path) if endswith(lowercase(f), ".h5")])
            nonlinear_file = isempty(candidates) ? "" : first(candidates)
        end
        metadata = read_json(joinpath(run_path, "simulation_info", "run_config.json"))
        status = read_json(joinpath(run_path, "simulation_info", "status.json"))
        linear = isempty(linear_file) ? nothing : matrix_table(linear_file, "df_matrix", "df_column_names"; filtered_key="df_filtered_matrix")
        optimization = isempty(optimization_file) ? nothing : matrix_table(optimization_file, "df_optimization_matrix", "df_optimization_column_names")
        if optimization === nothing && get(status isa AbstractDict ? status : Dict{String,Any}(), "status", "") != "running"
            optimization = optimization_from_bookkeeping(metadata, linear)
        end
        nonlinear = isempty(nonlinear_file) ? nothing : matrix_table(nonlinear_file, "df_nonlinear_matrix", "df_nonlinear_column_names"; filtered_key="df_nonlinear_conveging_results_matrix")
        if nonlinear === nothing && !isempty(nonlinear_file)
            nonlinear = matrix_table(nonlinear_file, "df_matrix", "df_column_names"; filtered_key="df_filtered_matrix")
        end
        push!(runs, Dict(
            "id" => basename(run_path),
            "status" => status,
            "metadata" => metadata,
            "optimalParameters" => read_json(joinpath(run_path, "optimal_device_parameters.json")),
            "setupSnapshot" => setup_snapshot(run_path),
            "linear" => linear,
            "optimization" => optimization,
            "nonlinear" => nonlinear,
            "savedLinear" => saved_data_catalog(joinpath(run_path, "saved_data", "linear.h5")),
            "savedNonlinear" => saved_data_catalog(joinpath(run_path, "saved_data", "nonlinear.h5")),
            "traces" => trace_files(run_path),
        ))
    end
end

print(JSON.json(Dict("schemaVersion" => "jco.results/4", "workspace" => workspace, "runs" => runs)))