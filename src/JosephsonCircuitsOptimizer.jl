# src/JosephsonCircuitsOptimizer.jl
module JosephsonCircuitsOptimizer

using JosephsonCircuits
using DataFrames, Symbolics, LaTeXStrings
using DSP, JSON, HDF5, GaussianProcesses, Surrogates
using Makie, Colors, StatsBase, KernelDensity
using Statistics, LinearAlgebra, Dates, Logging, LoggingExtras, Interpolations
using Pkg, QuasiMonteCarlo, Random
import Plots as P
import Plots: savefig
import GLMakie as M
using FileIO

export plot, mplot, run, run_sweep_only, run_from_latest_dataset_only, seed_next_run_from_latest!
export run_optimization_only, run_nonlinear_only

const plot = P.plot
const mplot = M.plot

# Import the Config module
include("Config.jl")
using .Config

# Include other module files
include("utils.jl")
include("Progress.jl")
using .Progress
include("Bookkeeping.jl")
using .Bookkeeping
include("CircuitModule.jl")
include("CostModule.jl")
include("simulator.jl")
include("optimizer.jl")
include("Analysis_plots.jl")
include("Resume.jl")
using .Resume

export restore_latest_inputs_snapshot_config

# using Logging
# global_logger(ConsoleLogger(stderr, Logging.Debug)) # Info

function set_plain_logger!(minlevel::LogLevel=Logging.Info)
    logger = LoggingExtras.MinLevelLogger(
        LoggingExtras.FormatLogger() do io, args
            # args.level, args.message, args._module, args.file, args.line, args.group, args.id, args.kwargs
            ts = Dates.format(Dates.now(), dateformat"HH:MM:SS")
            lvl = args.level == Logging.Error ? "ERROR" :
                  args.level == Logging.Warn  ? "WARN"  :
                  args.level == Logging.Info  ? "INFO"  : "DEBUG"
            # one line only:
            println(io, "[$ts] [$lvl] ", args.message)
        end,
        minlevel
    )
    global_logger(logger)
    return nothing
end

"""\
    check_required_files(config::Configuration)

Check that the required user input files exist in `config.user_inputs_dir`.
"""
function check_required_files(config::Configuration)
    required_files = [
        "drive_physical_quantities.json",
        "device_parameters_space.json",
        "simulation_config.json",
        "optimizer_config.json",
        "user_cost_and_performance.jl",
        "user_circuit.jl"
    ]

    missing_files = filter(f -> !isfile(joinpath(config.user_inputs_dir, f)), required_files)

    if !isempty(missing_files)
        error("Missing required files in $(config.user_inputs_dir): " * join(missing_files, ", "))
    end
end

"""\
    initialize_workspace(config::Configuration)

Ensure that the working space exists and contains all required input files.
"""
function initialize_workspace(config::Configuration)
    if !isdir(config.WORKING_SPACE)
        error("Working space directory '$(config.WORKING_SPACE)' does not exist.")
    end

    check_required_files(config)
end



"""\
    modules_setup(config::Configuration)

Initialize all dependent modules with the given configuration.

Note: The individual setup_* functions currently rely on the global `config`.
This function exists to make the initialization sequence explicit.
"""
function modules_setup(config::Configuration; stages=(:sources,:circuit,:cost,:simulator,:optimizer))

    @info "Initializing modules with configuration..."
    @info "Running with $(Threads.nthreads()) threads"
    
    setup_sources()
    setup_circuit()
    setup_cost()
    setup_simulator()
    setup_optimizer()

    @info "All modules initialized successfully."
end


function __init__()
    # Make logs GUI-friendly as soon as the module is loaded
    set_plain_logger!(Logging.Info)
end

"""\
    seed_next_run_from_latest!(; workspace=nothing)
"""
function seed_next_run_from_latest!(; workspace::Union{Nothing,AbstractString}=nothing)

    global config_1 = get_configuration(; workspace=workspace, create=false)
    
    return restore_latest_inputs_snapshot_config(; workspace=config_1.WORKING_SPACE,
        user_inputs_dir = config_1.user_inputs_dir
        )
end

    

"""\
    run(; workspace=nothing, create_workspace=true)

Run the full simulation and optimization process.

- `workspace`: path to the working space folder (defaults to `pwd()/working_space`).
- `create_workspace`: if true, create missing folders inside the workspace.
"""

function run(; workspace::Union{Nothing,AbstractString}=nothing, create_workspace::Bool=true)

    global config = get_configuration(; workspace=workspace, create=create_workspace)

    clear_stopfile!(config.WORKING_SPACE)

    modules_setup(config)
    initialize_workspace(config)

    user_input_path = config.user_inputs_dir
    base_output_path = config.outputs_dir
    global plot_path = config.plot_dir
    global corr_path = config.corr_dir

    timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS")
    output_path = joinpath(base_output_path, "output_" * timestamp)
    mkpath(output_path)

    @info "Results will be saved in: $output_path"

    # Variables we may want to use after the try (bookkeeping etc.)
    results = nothing
    optimal_params = nothing
    optimal_metric = nothing
    device_parameters_space = nothing

    write_status(output_path; status="running", stage="INIT")

    try
        # Load user-defined parameters
        device_params_file = joinpath(user_input_path, "device_parameters_space.json")
        device_parameters_space = load_params(device_params_file)
        global device_parameters_space = device_parameters_space
        @info "Loaded device parameters space from: $device_params_file"

        # If parameter space is a single point (no sweep), skip correlation + optimization and run HB directly.
        single_point_mode = is_single_point_parameter_space(device_parameters_space)
        if single_point_mode
            @info "Single-point parameter space detected: skipping sweep correlation and optimization."
        end

        # --- Linear sweep ---
        write_status(output_path; status="running", stage="LIN")
        @debug "Running linear simulations with device parameters space: $device_parameters_space"
        GC.gc()
        global delta_correction = 0.0

        df, filtered_df = run_linear_simulations_sweep(device_parameters_space, filter_df=true)
        save_dataset(df, output_path)
        @info "Saving uniform dataset from the linear simulation run."

        if single_point_mode
            # No sweep: use the single point directly, skip correlation + optimizer.
            optimal_params = single_point_params(device_parameters_space)
            optimal_metric = NaN
        
            header = Dict(
                "optimal_metric" => optimal_metric,
                "description" => "Single-point run (no optimization). Parameters used for HB."
            )
            optimal_params_file = joinpath(output_path, "optimal_device_parameters.json")
            @info "Saving single-point device parameters to: $optimal_params_file"
            save_output_file(header, optimal_params, optimal_params_file)
        
        else

            # Generate correlation + 1D plots highlighting the chosen optimum
            try
                create_corr_figure(df)
            catch e
                @warn "Could not generate correlation/1D plot: $e"
            end

            # --- Optimization ---
            write_status(output_path; status="running", stage="BO")
            @info "Running optimization process on the dataset."
            optimal_params, optimal_metric = run_optimization(df)
            
            # Re-generate correlation + 1D plots highlighting the chosen optimum
            try
                create_corr_figure(df; optimal_params=optimal_params)
            catch e
                @warn "Could not generate highlighted correlation/1D plot: $e"
            end
            
            header = Dict(
                "optimal_metric" => optimal_metric,
                "description" => "Optimal parameters for the model"
            )
            optimal_params_file = joinpath(output_path, "optimal_device_parameters.json")
            @info "Saving optimal device parameters to: $optimal_params_file"
            save_output_file(header, optimal_params, optimal_params_file)
        end

        # --- Nonlinear sweep ---
        write_status(output_path; status="running", stage="HB")
        println("-----------------------------------------------------")
        @info "Running nonlinear simulations with optimal parameters."
        results = run_nonlinear_simulations_sweep(optimal_params)

        nl_df = nonlinear_results_to_dataframe(results)
        save_nonlinear_dataset(nl_df, output_path)
        @info "Saved nonlinear sweep dataset."
        
        best_performance = NaN
        best_amplitudes = nothing

        if results !== nothing && !isempty(results)
            best_idx = findmax(r -> r.performance, results)[2]
            best_performance = results[best_idx].performance
            best_amplitudes = results[best_idx].amps
        end
        
        # Save optimal physical quantities from final results (current working point)
        if best_amplitudes !== nothing
            optimal_physical_quantities = update_physical_quantities(best_amplitudes)

            header = Dict(
                "description" => "Optimal physical quantities (working point) of the circuit",
                "optimal_metric" => optimal_metric,
                "optimal_performance" => best_performance
            )
            optimal_quantities_file = joinpath(output_path, "optimal_physical_quantities.json")
            save_output_file(header, optimal_physical_quantities, optimal_quantities_file)
        end
        
        optimal_params_dir = joinpath(output_path, "optimal_device_parameters")
        mkpath(optimal_params_dir)

        # Plots
        let p = plot_delta_vs_amplitude(results)
            if p !== nothing
                plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="delta_vs_amplitude")
            end
        end

        let p = plot_performance_vs_amplitude(results)
            if p !== nothing
                plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="performance_vs_amplitude")
            end
        end

        # --- Nonlinear correction (optional) ---
        if sim_vars[:n_iterations_nonlinear_correction] != 0 && !single_point_mode

            correction_terms = Any[]
            reference_amplitudes = get_delta_correction_amplitudes()

            for i in 1:sim_vars[:n_iterations_nonlinear_correction]

                stop_if_requested!(config.WORKING_SPACE) 
                println("-----------------------------------------------------")
                @info "Implementing nonlinear correction: iteration $i"
                println("-----------------------------------------------------")

                term = nonlinear_correction(optimal_params, reference_amplitudes)
                global delta_correction = term
                @info "Nonlinear correction term: $delta_correction"

                push!(correction_terms, delta_correction)

                device_parameters_space = load_params(device_params_file; optimal=optimal_params)
                df, filtered_df = run_linear_simulations_sweep(device_parameters_space, filter_df=true)
                optimal_params, optimal_metric = run_optimization(df)

                results = run_nonlinear_simulations_sweep(optimal_params)
                
                nl_df = nonlinear_results_to_dataframe(results)
                save_nonlinear_dataset(
                    nl_df,
                    optimal_params_dir;
                    filename="df_nonlinear_analysis_corrected_cycle_$(i).h5"
                )

                cycle_best_performance = NaN
                if results !== nothing && !isempty(results)
                    cycle_best_idx = findmax(r -> r.performance, results)[2]
                    cycle_best_performance = results[cycle_best_idx].performance
                    cycle_best_amplitudes = results[best_idx].amps
                end

                # Save corrected optimal params (cycle i)
                header = Dict(
                    "description" => "Optimal parameters after nonlinear correction (cycle $i)",
                    "optimal_metric" => optimal_metric,
                    "optimal_performance" => cycle_best_performance,
                    "nonlinear correction value" => delta_correction
                )

                optimal_params_file = joinpath(
                    optimal_params_dir,
                    "optimal_device_parameters_corrected_cycle_$(i).json"
                )
                save_output_file(header, optimal_params, optimal_params_file)

                # Save optimal physical quantities from final results (current working point)
                if best_amplitudes !== nothing
                    optimal_physical_quantities = update_physical_quantities(best_amplitudes)
        
                    header = Dict(
                        "description" => "Optimal physical quantities (working point) of the circuit",
                        "optimal_metric" => optimal_metric,
                        "optimal_performance" => cycle_best_performance,
                        "optimal amplitude" => cycle_best_amplitudes
                    )
                    
                    optimal_quantities_file = joinpath(
                        optimal_params_dir, 
                        "optimal_physical_quantities_corrected_cycle_$(i).json"
                        )
                        save_output_file(header, optimal_physical_quantities, optimal_quantities_file)
                end

                let p = plot_delta_vs_amplitude(results)
                    if p !== nothing
                        plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="delta_vs_amplitude")
                    end
                end

                let p = plot_performance_vs_amplitude(results)
                    if p !== nothing
                        plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="performance_vs_amplitude")
                    end
                end
            end

            # Convergence plot
            p = P.plot(collect(1:length(correction_terms)), correction_terms,
                xlabel="Iteration",
                ylabel="Nonlinear Correction Term",
                title="Nonlinear Correction Convergence",
                label="",
                markershape=:circle,
                markersize=2,
                framestyle=:box,
                size=(800, 600),
                xticks=1:length(correction_terms)
            )
            plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="nonlinear_correction_convergence")

        end

        write_status(output_path; status="completed", stage="DONE")
        @info "Run completed."

    catch e
        if e isa StopRequested
            write_status(output_path; status="stopped", stage="STOPPED", message="Stop requested by user.")
            try
                open(joinpath(output_path, "STOPPED.txt"), "w") do io
                    println(io, "Stopped by user at ", Dates.format(now(), dateformat"yyyy-mm-dd HH:MM:SS"))
                end
            catch
            end
            @warn "Stop requested by user. Exiting cleanly."
            return nothing
        else
            write_status(output_path; status="error", stage="ERROR", message=string(e))
            rethrow()
        end
    finally
        # --- Reproducibility bookkeeping (best-effort) ---
        metric_history = (isdefined(@__MODULE__, :cost_history) ? cost_history : Dict())
        try
            ps = (device_parameters_space === nothing) ? Dict{Symbol,Any}() : device_parameters_space
            write_run_bookkeeping(output_path;
                config=config,
                parameter_space=ps,
                best_device_parameters=optimal_params,
                best_metric=optimal_metric,
                metric_history=metric_history,
                sim_settings=sim_vars,
                optimizer_settings=optimizer_config
            )
        catch err
            @warn "Bookkeeping step failed (run still OK): $err"
        end

        GC.gc()
    end

    return nothing
end


"""\
    run_sweep_only(; workspace=nothing, create_workspace=true, filter_df=true)

Run only the sweep stage (linear simulations + dataset + correlation figure).

This is meant for quickly inspecting simulator behaviour without running the optimizer
or nonlinear (HB) simulations.
"""
function run_sweep_only(; workspace::Union{Nothing,AbstractString}=nothing,
                        create_workspace::Bool=true,
                        filter_df::Bool=true)

    global config = get_configuration(; workspace=workspace, create=create_workspace)
    clear_stopfile!(config.WORKING_SPACE)

    modules_setup(config)
    initialize_workspace(config)

    user_input_path = config.user_inputs_dir
    base_output_path = config.outputs_dir
    global plot_path = config.plot_dir
    global corr_path = config.corr_dir

    timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS")
    output_path = joinpath(base_output_path, "output_" * timestamp)
    mkpath(output_path)

    @info "Results will be saved in: $output_path"

    device_parameters_space = nothing
    df = nothing

    write_status(output_path; status="running", stage="INIT")

    try
        device_params_file = joinpath(user_input_path, "device_parameters_space.json")
        device_parameters_space = load_params(device_params_file)
        global device_parameters_space = device_parameters_space

        write_status(output_path; status="running", stage="LIN")
        @info "Running sweep-only (linear simulations)."
        global delta_correction = 0.0

        stop_if_requested!(config.WORKING_SPACE)

        df, _ = run_linear_simulations_sweep(device_parameters_space, filter_df=filter_df)
        save_dataset(df, output_path)
                
        # Generate correlation + 1D plots highlighting the chosen optimum
        try
            create_corr_figure(df)
        catch e
            @info "Could not generate correlation/1D plot: $e"
        end

        write_status(output_path; status="completed", stage="DONE")
        @info "Sweep-only run completed."

    catch e
        if e isa StopRequested
            write_status(output_path; status="stopped", stage="STOPPED", message="Stop requested by user.")
            @warn "Stop requested by user. Exiting sweep-only run cleanly."
            return nothing
        else
            write_status(output_path; status="error", stage="ERROR", message=string(e))
            rethrow()
        end
    finally
        metric_history = (isdefined(@__MODULE__, :cost_history) ? cost_history : Dict())
        try
            ps = (device_parameters_space === nothing) ? Dict{Symbol,Any}() : device_parameters_space
            write_run_bookkeeping(output_path;
                config=config,
                parameter_space=ps,
                best_device_parameters=nothing,
                best_metric=nothing,
                metric_history=metric_history,
                sim_settings=sim_vars,
                optimizer_settings=optimizer_config
            )
        catch err
            @warn "Bookkeeping step failed (run still OK): $err"
        end
        GC.gc()
    end

    return nothing
end


"""\
    run_from_latest_dataset_only(; workspace=nothing, create_workspace=true, dataset_path=nothing)

Run optimization + nonlinear simulations starting from a previously saved linear dataset.

If `dataset_path` is `nothing`, JCO will use `outputs/LATEST.txt` in the workspace to locate
the most recent run folder and read `df_uniform_analysis.h5` from it.

You may pass either a run-folder path or the `.h5` file path.
"""
function run_from_latest_dataset_only(; workspace::Union{Nothing,AbstractString}=nothing,
                                     create_workspace::Bool=true,
                                     dataset_path::Union{Nothing,AbstractString}=nothing)

    global config = get_configuration(; workspace=workspace, create=create_workspace)
    clear_stopfile!(config.WORKING_SPACE)

    modules_setup(config)
    initialize_workspace(config)

    base_output_path = config.outputs_dir
    global plot_path = config.plot_dir
    global corr_path = config.corr_dir

    device_params_file = joinpath(config.user_inputs_dir, "device_parameters_space.json")
    device_parameters_space = load_params(device_params_file)
    global device_parameters_space = device_parameters_space
    global delta_correction = 0.0

    timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS")
    output_path = joinpath(base_output_path, "output_" * timestamp)
    mkpath(output_path)

    @info "Results will be saved in: $output_path"

    results = nothing
    optimal_params = nothing
    optimal_metric = nothing
    df = nothing

    write_status(output_path; status="running", stage="INIT")

    # Resolve dataset path
    dataset_file = dataset_path
    if dataset_file === nothing
        latest_ptr = joinpath(config.outputs_dir, "LATEST.txt")
        if !isfile(latest_ptr)
            error("No LATEST.txt found in outputs. Run a sweep (or full run) first.")
        end
        latest_run = strip(read(latest_ptr, String))
        if isempty(latest_run)
            error("LATEST.txt is empty. Run a sweep (or full run) first.")
        end
        dataset_file = joinpath(latest_run, "df_uniform_analysis.h5")
    end

    # If a directory was provided, load_dataset will look for df_uniform_analysis.h5 inside it.
    try
        siminfo_dir = (basename(normpath(output_path)) == "simulation_info") ? output_path : joinpath(output_path, "simulation_info")
        mkpath(siminfo_dir)
        open(joinpath(siminfo_dir, "SOURCE_DATASET.txt"), "w") do io
            println(io, String(dataset_file))
        end
    catch
    end

    try
        write_status(output_path; status="running", stage="LOAD_DF")
        @info "Loading dataset from: $(dataset_file)"
        df, _ = load_dataset(String(dataset_file))

        stop_if_requested!(config.WORKING_SPACE)

        write_status(output_path; status="running", stage="BO")
        @info "Running optimization from saved dataset."
        optimal_params, optimal_metric = run_optimization(df)

        # Re-generate correlation + 1D plots highlighting the chosen optimum
        try
            create_corr_figure(df; optimal_params=optimal_params)
        catch e
            @warn "Could not generate highlighted correlation/1D plot: $e"
        end

        header = Dict(
            "optimal_metric" => optimal_metric,
            "description" => "Optimal parameters for the model (from saved dataset)"
        )
        optimal_params_file = joinpath(output_path, "optimal_device_parameters.json")
        save_output_file(header, optimal_params, optimal_params_file)

        stop_if_requested!(config.WORKING_SPACE)

        write_status(output_path; status="running", stage="HB")
        println("-----------------------------------------------------")
        @info "Running nonlinear simulations with optimal parameters."
        results = run_nonlinear_simulations_sweep(optimal_params)
        nl_df = nonlinear_results_to_dataframe(results)
        save_nonlinear_dataset(nl_df, output_path)
        @info "Saved nonlinear sweep dataset."

        let p = plot_delta_vs_amplitude(results)
            if p !== nothing
                plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="delta_vs_amplitude")
            end
        end
        let p = plot_performance_vs_amplitude(results)
            if p !== nothing
                plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="performance_vs_amplitude")
            end
        end

        write_status(output_path; status="completed", stage="DONE")
        save_dataset(df, output_path)
        @info "Dataset-only run completed."

    catch e
        if e isa StopRequested
            write_status(output_path; status="stopped", stage="STOPPED", message="Stop requested by user.")
            @warn "Stop requested by user. Exiting dataset-only run cleanly."
            return nothing
        else
            write_status(output_path; status="error", stage="ERROR", message=string(e))
            rethrow()
        end
    finally
        metric_history = (isdefined(@__MODULE__, :cost_history) ? cost_history : Dict())
        try
            write_run_bookkeeping(output_path;
                config=config,
                parameter_space=Dict{Symbol,Any}(),
                best_device_parameters=optimal_params,
                best_metric=optimal_metric,
                metric_history=metric_history,
                sim_settings=sim_vars,
                optimizer_settings=optimizer_config
            )
        catch err
            @warn "Bookkeeping step failed (run still OK): $err"
        end
        GC.gc()
    end

    return nothing
end


"""\
    run_optimization_only(; workspace=nothing, create_workspace=true, dataset_path=nothing)

Run *only* the optimization stage (BO), starting from a previously saved linear dataset.

This produces an `optimal_device_parameters.json` in a new output folder, but **does not**
run the nonlinear (HB) simulations.

If `dataset_path` is `nothing`, JCO will use `outputs/LATEST.txt` in the workspace to locate
the most recent run folder and read `df_uniform_analysis.h5` from it.
"""
function run_optimization_only(; workspace::Union{Nothing,AbstractString}=nothing,
                              create_workspace::Bool=true,
                              dataset_path::Union{Nothing,AbstractString}=nothing)

    global config = get_configuration(; workspace=workspace, create=create_workspace)
    clear_stopfile!(config.WORKING_SPACE)

    # BO still evaluates the cost function, so we need the optimizer too.
    modules_setup(config)
    initialize_workspace(config)

    base_output_path = config.outputs_dir
    global plot_path = config.plot_dir
    global corr_path = config.corr_dir

    device_params_file = joinpath(config.user_inputs_dir, "device_parameters_space.json")
    device_parameters_space = load_params(device_params_file)
    global device_parameters_space = device_parameters_space

    global delta_correction = 0.0

    timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS")
    output_path = joinpath(base_output_path, "output_" * timestamp)
    mkpath(output_path)

    @info "Results will be saved in: $output_path"

    optimal_params = nothing
    optimal_metric = nothing
    df = nothing

    write_status(output_path; status="running", stage="INIT")

    # Resolve dataset path
    dataset_file = dataset_path
    if dataset_file === nothing
        latest_ptr = joinpath(config.outputs_dir, "LATEST.txt")
        if !isfile(latest_ptr)
            error("No LATEST.txt found in outputs. Run a sweep (or full run) first.")
        end
        latest_run = strip(read(latest_ptr, String))
        if isempty(latest_run)
            error("LATEST.txt is empty. Run a sweep (or full run) first.")
        end
        dataset_file = joinpath(latest_run, "df_uniform_analysis.h5")
    end

    try
        siminfo_dir = (basename(normpath(output_path)) == "simulation_info") ? output_path : joinpath(output_path, "simulation_info")
        mkpath(siminfo_dir)
        open(joinpath(siminfo_dir, "SOURCE_DATASET.txt"), "w") do io
            println(io, String(dataset_file))
        end
    catch
    end

    try
        write_status(output_path; status="running", stage="LOAD_DF")
        @info "Loading dataset from: $(dataset_file)"
        df, _ = load_dataset(String(dataset_file))

        stop_if_requested!(config.WORKING_SPACE)

        write_status(output_path; status="running", stage="BO")
        @info "Running optimization from saved dataset (BO only)."
        optimal_params, optimal_metric = run_optimization(df)

        # Optional: correlation + 1D plot with optimum highlighted
        try
            create_corr_figure(df; optimal_params=optimal_params)
        catch e
            @warn "Could not generate highlighted correlation/1D plot: $e"
        end

        header = Dict(
            "optimal_metric" => optimal_metric,
            "description" => "Optimal parameters for the model (BO only, from saved dataset)"
        )
        optimal_params_file = joinpath(output_path, "optimal_device_parameters.json")
        save_output_file(header, optimal_params, optimal_params_file)

        write_status(output_path; status="completed", stage="DONE")
        save_dataset(df, output_path)
        @info "Optimization-only run completed."

    catch e
        if e isa StopRequested
            write_status(output_path; status="stopped", stage="STOPPED", message="Stop requested by user.")
            @warn "Stop requested by user. Exiting optimization-only run cleanly."
            return nothing
        else
            write_status(output_path; status="error", stage="ERROR", message=string(e))
            rethrow()
        end
    finally
        metric_history = (isdefined(@__MODULE__, :cost_history) ? cost_history : Dict())
        try
            write_run_bookkeeping(output_path;
                config=config,
                parameter_space=Dict{Symbol,Any}(),
                best_device_parameters=optimal_params,
                best_metric=optimal_metric,
                metric_history=metric_history,
                sim_settings=sim_vars,
                optimizer_settings=optimizer_config
            )
        catch err
            @warn "Bookkeeping step failed (run still OK): $err"
        end
        GC.gc()
    end

    return nothing
end


"""\
    run_nonlinear_only(; workspace=nothing, create_workspace=true, optimal_params_path=nothing)

Run *only* the nonlinear (HB) sweep starting from a saved `optimal_device_parameters.json`.

If `optimal_params_path` is `nothing`, JCO will use `outputs/LATEST.txt` in the workspace to locate
the most recent run folder and read `optimal_device_parameters.json` from it.

You may pass either a run-folder path or the `.json` file path.
"""
function run_nonlinear_only(; workspace::Union{Nothing,AbstractString}=nothing,
                        create_workspace::Bool=true,
                        optimal_params_path::Union{Nothing,AbstractString}=nothing,
                        dataset_path::Union{Nothing,AbstractString}=nothing)

    global config = get_configuration(; workspace=workspace, create=create_workspace)
    clear_stopfile!(config.WORKING_SPACE)

    # HB does not need the optimizer module.
    modules_setup(config)
    initialize_workspace(config)

    base_output_path = config.outputs_dir
    global plot_path = config.plot_dir
    global corr_path = config.corr_dir

    global delta_correction = 0.0

    timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS")
    output_path = joinpath(base_output_path, "output_" * timestamp)
    mkpath(output_path)

    @info "Results will be saved in: $output_path"

    results = nothing
    optimal_params = nothing
    optimal_metric = NaN
    df = nothing

    write_status(output_path; status="running", stage="INIT")

    # Resolve optimal params path
    opt_file = optimal_params_path
    dataset_file = dataset_path
    if opt_file === nothing
        latest_ptr = joinpath(config.outputs_dir, "LATEST.txt")
        if !isfile(latest_ptr)
            error("No LATEST.txt found in outputs. Run an optimization (or full run) first.")
        end
        latest_run = strip(read(latest_ptr, String))
        if isempty(latest_run)
            error("LATEST.txt is empty. Run an optimization (or full run) first.")
        end
        opt_file = joinpath(latest_run, "optimal_device_parameters.json")
    end
    if dataset_file === nothing
        latest_ptr = joinpath(config.outputs_dir, "LATEST.txt")
        latest_run = strip(read(latest_ptr, String))
        dataset_file = joinpath(latest_run, "df_uniform_analysis.h5")
    end
    
    

    # If a directory was provided, assume optimal_device_parameters.json inside it.
    if isdir(String(opt_file))
        opt_file = joinpath(String(opt_file), "optimal_device_parameters.json")
    end

    try
        siminfo_dir = (basename(normpath(output_path)) == "simulation_info") ? output_path : joinpath(output_path, "simulation_info")
        mkpath(siminfo_dir)
        open(joinpath(siminfo_dir, "SOURCE_OPTIMAL_PARAMS.txt"), "w") do io
            println(io, String(opt_file))
        end
    catch
    end
    try
        cp(String(opt_file), joinpath(output_path, "optimal_device_parameters.json"); force=true)
    catch
    end

    try
        write_status(output_path; status="running", stage="LOAD_OPT")
        @info "Loading optimal parameters from: $(opt_file)"
        raw = JSON.parse(read(opt_file, String))
        data = raw["data"]
        optimal_params = Dict(Symbol(k)=>v for (k,v) in data)
        hdr = raw["header"]
        optimal_metric = get(hdr, "optimal_metric", NaN)

        stop_if_requested!(config.WORKING_SPACE)

        write_status(output_path; status="running", stage="HB")
        @info "Running nonlinear simulations (HB only)."
        results = run_nonlinear_simulations_sweep(optimal_params)

        nl_df = nonlinear_results_to_dataframe(results)
        save_nonlinear_dataset(nl_df, output_path)
        @info "Saved nonlinear sweep dataset."

        let p = plot_delta_vs_amplitude(results)
            if p !== nothing
                plot_update(p; params=optimal_params, metric=NaN, plot_type="delta_vs_amplitude")
            end
        end

        let p = plot_performance_vs_amplitude(results)
            if p !== nothing
                plot_update(p; params=optimal_params, metric=NaN, plot_type="performance_vs_amplitude")
            end
        end

        # Save best physical quantities (same logic as in run)
        try
            best_idx = findmax(r -> r.performance, results)[2]
            best_amplitudes = results[best_idx].amps
            optimal_physical_quantities = update_physical_quantities(best_amplitudes)
            save_output_file(Dict("description"=>"Optimal physical quantities (HB only)"),
                             optimal_physical_quantities,
                             joinpath(output_path, "optimal_physical_quantities.json"))
        catch e
            @warn "Could not save optimal physical quantities (HB only): $e"
        end

        write_status(output_path; status="completed", stage="DONE")
        df, _ = load_dataset(String(dataset_file))
        save_dataset(df, output_path)
        @info "Nonlinear-only run completed."

    catch e
        if e isa StopRequested
            write_status(output_path; status="stopped", stage="STOPPED", message="Stop requested by user.")
            @warn "Stop requested by user. Exiting nonlinear-only run cleanly."
            return nothing
        else
            write_status(output_path; status="error", stage="ERROR", message=string(e))
            rethrow()
        end
    finally
        metric_history = (isdefined(@__MODULE__, :cost_history) ? cost_history : Dict())
        try
            write_run_bookkeeping(output_path;
                config=config,
                parameter_space=Dict{Symbol,Any}(),
                best_device_parameters=optimal_params,
                best_metric=optimal_metric,
                metric_history=metric_history,
                sim_settings=sim_vars,
                optimizer_settings=optimizer_config
            )
        catch err
            @warn "Bookkeeping step failed (run still OK): $err"
        end
        GC.gc()
    end

    return nothing
end

end  # End of module
