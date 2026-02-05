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

export plot, mplot, run, run_sweep_only, seed_next_run_from_latest!

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
include("gui.jl")
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
function modules_setup(config::Configuration)

    @info "Initializing modules with configuration..."
    
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

    @info "📂 Results will be saved in: $output_path"

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

        # --- Linear sweep ---
        write_status(output_path; status="running", stage="LIN")
        @debug "Running linear simulations with device parameters space: $device_parameters_space"
        GC.gc()
        global delta_correction = 0.0

        df, filtered_df = run_linear_simulations_sweep(device_parameters_space, filter_df=true)
        save_dataset(df, output_path)
        @info "Saving uniform dataset from the linear simulation run."
        create_corr_figure(df)

        # --- Optimization ---
        write_status(output_path; status="running", stage="BO")
        @info "Running optimization process on the dataset."
        optimal_params, optimal_metric = run_optimization(df)

        header = Dict(
            "optimal_metric" => optimal_metric,
            "description" => "Optimal parameters for the model"
        )
        optimal_params_file = joinpath(output_path, "optimal_device_parameters.json")
        @info "Saving optimal device parameters to: $optimal_params_file"
        save_output_file(header, optimal_params, optimal_params_file)

        # --- Nonlinear sweep ---
        write_status(output_path; status="running", stage="HB")
        @info "Running nonlinear simulations with optimal parameters."
        results = run_nonlinear_simulations_sweep(optimal_params)

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
        if sim_vars[:n_iterations_nonlinear_correction] != 0

            lin_deltas = Float64[]
            nonlin_deltas = Float64[]
            reference_amplitudes = get_delta_correction_amplitudes()

            for i in 1:sim_vars[:n_iterations_nonlinear_correction]

                stop_if_requested!(config.WORKING_SPACE)  # <-- if you added this helper

                @info "Implementing nonlinear correction: iteration $i"

                deltas = delta_quantity(optimal_params, reference_amplitudes)
                global delta_correction = deltas[1]
                @info "Delta k (nonlinear correction): $delta_correction"

                push!(lin_deltas, deltas[2])
                push!(nonlin_deltas, deltas[3])

                device_parameters_space = load_params(device_params_file; optimal=optimal_params)
                df, filtered_df = run_linear_simulations_sweep(device_parameters_space, filter_df=true)
                optimal_params, optimal_metric = run_optimization(df)

                results = run_nonlinear_simulations_sweep(optimal_params)

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
            p = P.plot(collect(1:length(nonlin_deltas)), nonlin_deltas,
                xlabel="Iteration",
                ylabel="Nonlinear Delta Quantity",
                title="Nonlinear Correction Convergence",
                label="",
                markershape=:circle,
                markersize=2,
                framestyle=:box,
                size=(800, 600),
                xticks=1:length(nonlin_deltas)
            )
            plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="nonlinear_correction_convergence")

            # Save corrected optimal params
            header = Dict(
                "optimal_metric" => optimal_metric,
                "description" => "Optimal parameters after nonlinear correction"
            )
            optimal_params_file = joinpath(output_path, "optimal_device_parameters_corrected.json")
            save_output_file(header, optimal_params, optimal_params_file)
        end

        # Save optimal physical quantities from final results
        if results !== nothing
            best_idx = findmax(r -> r.performance, results)[2]
            best_amplitudes = results[best_idx].amps
            optimal_physical_quantities = update_physical_quantities(best_amplitudes)

            header = Dict("description" => "Optimal physical quantities (working point) of the circuit")
            optimal_quantities_file = joinpath(output_path, "optimal_physical_quantities.json")
            save_output_file(header, optimal_physical_quantities, optimal_quantities_file)
        end

        write_status(output_path; status="completed", stage="DONE")
        @info "✅ Run completed."

    catch e
        if e isa StopRequested
            write_status(output_path; status="stopped", stage="STOPPED", message="Stop requested by user.")
            try
                open(joinpath(output_path, "STOPPED.txt"), "w") do io
                    println(io, "Stopped by user at ", Dates.format(now(), dateformat"yyyy-mm-dd HH:MM:SS"))
                end
            catch
            end
            @warn "⏹️ Stop requested by user. Exiting cleanly."
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



"""    run_sweep_only(; workspace=nothing, create_workspace=true, filter_df=true)

Run only the sweep stage (linear simulations + dataset + correlation figure).
This is useful to inspect how simulations vary across the parameter space without
running the Bayesian optimization or nonlinear HB stage.
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

    @info "📂 Results will be saved in: $output_path"
    @info "Running SWEEP-ONLY mode (no optimization, no nonlinear HB)."

    device_parameters_space = nothing
    df = nothing

    write_status(output_path; status="running", stage="INIT")

    try
        device_params_file = joinpath(user_input_path, "device_parameters_space.json")
        device_parameters_space = load_params(device_params_file)
        global device_parameters_space = device_parameters_space
        @info "Loaded device parameters space from: $device_params_file"

        write_status(output_path; status="running", stage="LIN")
        GC.gc()
        global delta_correction = 0.0

        df, filtered_df = run_linear_simulations_sweep(device_parameters_space, filter_df=filter_df)
        save_dataset(df, output_path)
        @info "Saved sweep dataset from linear simulations."

        create_corr_figure(df)

        write_status(output_path; status="completed", stage="DONE")
        @info "✅ Sweep-only run completed."

    catch e
        if e isa StopRequested
            write_status(output_path; status="stopped", stage="STOPPED", message="Stop requested by user.")
            try
                open(joinpath(output_path, "STOPPED.txt"), "w") do io
                    println(io, "Stopped by user at ", Dates.format(now(), dateformat"yyyy-mm-dd HH:MM:SS"))
                end
            catch
            end
            @warn "⏹️ Stop requested by user. Exiting cleanly."
            return nothing
        else
            write_status(output_path; status="error", stage="ERROR", message=string(e))
            rethrow()
        end
    finally
        metric_history = (isdefined(@__MODULE__, :cost_history) ? cost_history : Dict())
        ps = (device_parameters_space === nothing) ? Dict{Symbol,Any}() : device_parameters_space
        try
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



end  # End of module
