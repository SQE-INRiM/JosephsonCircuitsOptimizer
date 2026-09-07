# Desktop-only optimizer persistence diagnostics.
# Loaded after the Results/runtime overrides so the existing run_optimization(...) call
# uses this more defensive writer without changing the scientific optimizer itself.

function _gui_write_optimizer_persistence_diagnostic(output_path, payload)
    output_path === nothing && return nothing
    siminfo_dir = joinpath(output_path, "simulation_info")
    mkpath(siminfo_dir)
    path = joinpath(siminfo_dir, "optimization_persistence.json")
    open(path, "w") do io
        JSON.print(io, payload)
        println(io)
    end
    return path
end

function _gui_save_optimization_history(param_cols::Vector{String}, initial_count::Int)
    output_path = CURRENT_OUTPUT_PATH[]
    if output_path === nothing
        @warn "Optimization history could not be persisted because CURRENT_OUTPUT_PATH is not set."
        return nothing
    end

    params_history = get(cost_history, "params_vecs", Vector{Vector{Float64}}())
    metric_history = get(cost_history, "metrics", Float64[])
    total = min(length(params_history), length(metric_history))
    first_bo = min(total + 1, max(1, initial_count + 1))
    bo_count = max(0, total - initial_count)

    diagnostic = Dict{String,Any}(
        "output_path" => output_path,
        "initial_evaluations" => initial_count,
        "total_cost_evaluations" => total,
        "bo_evaluations" => bo_count,
        "parameter_columns" => param_cols,
        "hdf5_written" => false,
    )

    if bo_count == 0
        diagnostic["message"] = "No optimizer-requested cost evaluations were recorded after the seed dataset."
        _gui_write_optimizer_persistence_diagnostic(output_path, diagnostic)
        @warn "No BO evaluations found to persist" initial_count=initial_count total=total
        return nothing
    end

    bo_params = params_history[first_bo:total]
    bo_metrics = Float64.(metric_history[first_bo:total])
    matrix = Matrix{Float64}(undef, bo_count, length(param_cols) + 2)

    try
        for i in 1:bo_count
            length(bo_params[i]) >= length(param_cols) || error("Optimizer parameter vector $(i) has length $(length(bo_params[i])) but $(length(param_cols)) columns are required.")
            matrix[i, 1] = i
            for j in eachindex(param_cols)
                matrix[i, j + 1] = Float64(bo_params[i][j])
            end
            matrix[i, end] = bo_metrics[i]
        end

        filepath = joinpath(output_path, "df_optimization_analysis.h5")
        h5open(filepath, "w") do file
            write(file, "df_optimization_matrix", matrix)
            write(file, "df_optimization_column_names", vcat(["evaluation"], param_cols, ["metric"]))
        end

        diagnostic["hdf5_written"] = true
        diagnostic["hdf5_file"] = filepath
        diagnostic["message"] = "Optimization evaluation history persisted successfully."
        _gui_write_optimizer_persistence_diagnostic(output_path, diagnostic)
        @info "Saved optimization evaluation history" filepath=filepath evaluations=bo_count
        return filepath
    catch err
        diagnostic["message"] = "Optimization history persistence failed: $(sprint(showerror, err))"
        _gui_write_optimizer_persistence_diagnostic(output_path, diagnostic)
        @error "Optimization history persistence failed" exception=(err, catch_backtrace())
        return nothing
    end
end
