# src/JosephsonCircuitsOptimizer.jl
module JosephsonCircuitsOptimizer

using JosephsonCircuits
using DataFrames, Symbolics, LaTeXStrings
using DSP, JSON, HDF5, GaussianProcesses, Surrogates
using Makie, Colors, StatsBase, KernelDensity
using Statistics, LinearAlgebra, Dates, Logging, Interpolations
using Pkg, QuasiMonteCarlo, Random
import Plots as P
import Plots: savefig
import GLMakie as M
using FileIO

export plot, mplot, run

const plot = P.plot
const mplot = M.plot

# Import the Config module
include("Config.jl")
using .Config

# Include other module files
include("utils.jl")
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

    # Build configuration *now* (not at package import time)
    global config = get_configuration(; workspace=workspace, create=create_workspace)

    # Initialize all modules
    modules_setup(config)

    # Validate workspace
    initialize_workspace(config)

    # Define paths
    user_input_path = config.user_inputs_dir
    base_output_path = config.outputs_dir
    global plot_path = config.plot_dir
    global corr_path = config.corr_dir
    
    # Generate timestamp for unique run folder
    timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS")
    output_path = joinpath(base_output_path, "output_" * timestamp)
    mkpath(output_path)  # Ensure output directory exists

    @info "📂 Results will be saved in: $output_path"

    # Load user-defined parameters
    device_params_file = joinpath(user_input_path, "device_parameters_space.json")
    global device_parameters_space = load_params(device_params_file)
    @info "Loaded device parameters space from: $device_params_file"

    # Run simulations
    @info "Running linear simulations with device parameters space: $device_parameters_space"
    GC.gc()
    global delta_correction = 0.0
    df, filtered_df = run_linear_simulations_sweep(device_parameters_space, filter_df=true)
    save_dataset(df, output_path)
    @info "Saving uniform dataset from the linear simulation run."

    # Launch GUI
    #create_gui(df, filtered_df)
    create_corr_figure(df)

    # Run optimizer
    @info "\nRunning optimization process on the dataset."
    optimal_params, optimal_metric = run_optimization(df)

    # Save optimal device parameters
    header = Dict(
        "optimal_metric" => optimal_metric,
        "description" => "Optimal parameters for the model"
    )
    optimal_params_file = joinpath(output_path, "optimal_device_parameters.json")
    @info "Saving optimal device parameters to: $optimal_params_file from the optimization process."
    save_output_file(header, optimal_params, optimal_params_file)
    @debug "Optimal parameters: $optimal_params with metric $optimal_metric"


    ## Perform nonlinear simulation sweep on optimal parameters
    @info "Running nonlinear simulations with optimal parameters."
    results = run_nonlinear_simulations_sweep(optimal_params)
    @debug "Results from nonlinear simulations: $(results)"

    p = plot_delta_vs_amplitude(results)
    if p !== nothing
        @info "Plotting Delta vs Amplitude."
        plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="delta_vs_amplitude")
    else
        @info "Skipping Delta vs Amplitude plot (no sweep / not enough points)."
    end
    
    p = plot_performance_vs_amplitude(results)
    if p !== nothing
        @info "Plotting Performance vs Amplitude."
        plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="performance_vs_amplitude")
    else
        @info "Skipping Performance vs Amplitude plot (no sweep / not enough points)."
    end
    

    #display(p)
    
    
    # # Pick best
    # best_idx = findmax(r -> r.performance, results)[2]
    # @debug "Best result index: $best_idx with performance $(results[best_idx].performance)"
    # best_amplitudes = results[best_idx].amps
    # @debug "Best amplitudes: $best_amplitudes"
    # optimal_physical_quantities = update_physical_quantities(best_amplitudes)
    # @debug "Optimal physical quantities: $optimal_physical_quantities"

    # # Save optimal physical quantities
    # header = Dict(
    #     "description" => "Optimal physical quantities (working point) of the circuit"
    # )
    # optimal_quantities_file = joinpath(output_path, "optimal_physical_quantities.json")
    # @info "Saving optimal physical quantities to: $optimal_quantities_file from the nonlinear simulation."
    # save_output_file(header, optimal_physical_quantities, optimal_quantities_file)

    # @info "✅ Simulation and optimization processes completed! Results saved in '$output_path'."


    # Nonlinear correction if specified
    if sim_vars[:n_iterations_nonlinear_correction] != 0

        lin_deltas = []
        nonlin_deltas = []
        reference_amplitudes = get_delta_correction_amplitudes()

        for i in 1:sim_vars[:n_iterations_nonlinear_correction]

            println("\n-----------------------------------------------------")
            println("Implementing nonlinear correction: iteration number ", i)

            deltas = delta_quantity(optimal_params, reference_amplitudes)
            global delta_correction = deltas[1]
            println("Delta k (nonlinear correction): ", delta_correction)

            push!(lin_deltas, deltas[2])
            @debug "Linear delta quantity: $(deltas[2])"
            push!(nonlin_deltas, deltas[3])
            @debug "Nonlinear delta quantity: $(deltas[3])"
            
            global device_parameters_space = load_params(device_params_file; optimal=optimal_params)
            @debug "Reloading device parameters space considering the tagged subspace: $device_parameters_space"
            df, filtered_df = run_linear_simulations_sweep(device_parameters_space, filter_df=true)
            @debug "Linear simulations with nonlinear correction"
            optimal_params, optimal_metric = run_optimization(df)
            @debug "Optimal parameters after nonlinear correction: $optimal_params with metric $optimal_metric"

            results = run_nonlinear_simulations_sweep(optimal_params)
            @debug "Results from nonlinear simulations after correction: $(results)"

            p=plot_delta_vs_amplitude(results)
            @info "Plotting Delta vs Amplitude."
            plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="delta_vs_amplitude")
        
            p=plot_performance_vs_amplitude(results)
            @info "Plotting Performance vs Amplitude."
            plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="performance_vs_amplitude")


        end

        @debug "Linear delta quantities: $(lin_deltas)"
        @debug "Nonlinear delta quantities: $(nonlin_deltas)"

        
        p = P.plot(collect(1:sim_vars[:n_iterations_nonlinear_correction]), nonlin_deltas, 
            xlabel="Iteration",
            ylabel="Nonlinear Delta Quantity",
            title="Nonlinear Correction Convergence",
            color=:blue,
            label="",
            markershape=:circle,
            markersize=2,
            framestyle=:box,
            size=(800, 600),
            xticks=1:sim_vars[:n_iterations_nonlinear_correction]
        )

        plot_update(p; params=optimal_params, metric=optimal_metric, plot_type="nonlinear_correction_convergence")
        #display(p)

        header = Dict(
            "optimal_metric" => optimal_metric,
            "description" => "Optimal parameters for the model after the nonlinear correction"
        )
        optimal_params_file = joinpath(output_path, "optimal_device_parameters_corrected.json")
        @info "Saving optimal device parameters to: $optimal_params_file from the optimization process."
        save_output_file(header, optimal_params, optimal_params_file)
        @debug "Optimal parameters: $optimal_params with metric $optimal_metric"

        # header = Dict(
        #     "description" => "Optimal physical quantities (working point) of the circuit"
        # )
        # optimal_quantities_file = joinpath(output_path, "optimal_physical_quantities.json")
        # @info "Saving optimal physical quantities to: $optimal_quantities_file from the nonlinear simulation."
        # save_output_file(header, optimal_physical_quantities, optimal_quantities_file)

        
    # --- Reproducibility bookkeeping (run_config.json, versions.txt, LATEST.txt) ---
    metric_history = (isdefined(@__MODULE__, :cost_history) ? cost_history : Dict())
    try
        write_run_bookkeeping(output_path;
            config=config,
            parameter_space=device_parameters_space,
            best_device_parameters=optimal_params,
            best_metric=optimal_metric,
            metric_history=metric_history,
            sim_settings=sim_vars,
            optimizer_settings=optimizer_config
        )
    catch e
        @warn "Bookkeeping step failed (run still OK): $e"
    end

    @info "✅ Simulation and optimization processes with nonlinear correction completed! Results saved in '$output_path'."

    
    end


    best_idx = findmax(r -> r.performance, results)[2]
    @debug "Best result index: $best_idx with performance $(results[best_idx].performance)"
    best_amplitudes = results[best_idx].amps
    @debug "Best amplitudes: $best_amplitudes"
    optimal_physical_quantities = update_physical_quantities(best_amplitudes)
    @debug "Optimal physical quantities: $optimal_physical_quantities"

    header = Dict(
            "description" => "Optimal physical quantities (working point) of the circuit"
        )
    optimal_quantities_file = joinpath(output_path, "optimal_physical_quantities.json")
    @info "Saving optimal physical quantities to: $optimal_quantities_file from the nonlinear simulation."
    save_output_file(header, optimal_physical_quantities, optimal_quantities_file)

    
        # --- Reproducibility bookkeeping (run_config.json, versions.txt, LATEST.txt) ---
        metric_history = (isdefined(@__MODULE__, :cost_history) ? cost_history : Dict())
    try
        write_run_bookkeeping(output_path;
            config=config,
            parameter_space=device_parameters_space,
            best_device_parameters=optimal_params,
            best_metric=optimal_metric,
            metric_history=metric_history,
            sim_settings=sim_vars,
            optimizer_settings=optimizer_config
        )
    catch e
        @warn "Bookkeeping step failed (run still OK): $e"
    end

@info "✅ Simulation and optimization processes with nonlinear correction completed! Results saved in '$output_path'."


end

end  # End of module
