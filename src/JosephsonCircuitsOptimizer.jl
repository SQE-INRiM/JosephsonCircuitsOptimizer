# src/JosephsonCircuitsOptimizer.jl
module JosephsonCircuitsOptimizer

using JosephsonCircuits
using DataFrames, Symbolics, LaTeXStrings
using DSP, JSON, HDF5, GaussianProcesses, Surrogates
using Makie, Colors, StatsBase, KernelDensity
using Statistics, LinearAlgebra, Dates, Logging, Interpolations
using Pkg, QuasiMonteCarlo, Random
import Plots as P
import GLMakie as M

export plot, mplot, run

const plot = P.plot
const mplot = M.plot

# Import the Config module
include("Config.jl")
using .Config


# Include other module files
include("utils.jl")
include("CircuitModule.jl")
include("CostModule.jl")
include("simulator.jl")
include("optimizer.jl")
include("gui.jl")



"""
    check_required_files(config::Configuration)

Check if the required input files exist in the given working space.
"""

function check_required_files()
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

"""
    initialize_workspace(config::Configuration)

Ensure that the given working space is set up correctly.
"""
function initialize_workspace()
    if !isdir(config.WORKING_SPACE)
        error("Working space directory '$(config.WORKING_SPACE)' does not exist.")
    end

    check_required_files()
end




"""
    modules_setup(config::Configuration)

Initialize all dependent modules with the given configuration.
"""

function modules_setup()

    @info "Initializing modules with configuration..."
    
    setup_sources()
    setup_circuit()
    setup_cost()
    setup_simulator()
    setup_optimizer()

    @info "All modules initialized successfully."
end


function test_modification()

    println("\n\nMODIFICANDO IN LOCALE\n14\n")

end

"""
    run()

Run the full simulation and optimization process.
"""
function run()

    # Initialize all modules
    modules_setup()

    # Initialize workspace
    initialize_workspace()

    # Define paths
    user_input_path = config.user_inputs_dir
    base_output_path = config.outputs_dir

    # Generate timestamp for unique run folder
    timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS")
    output_path = joinpath(base_output_path, "output_" * timestamp)
    mkpath(output_path)  # Ensure output directory exists

    @info "📂 Results will be saved in: $output_path"

    # Load user-defined parameters
    device_params_file = joinpath(user_input_path, "device_parameters_space.json")
    global device_parameters_space = load_params(device_params_file)

    # Run simulations
    @info "Running linear simulations with device parameters space from: $device_params_file"
    GC.gc()
    df, filtered_df = run_linear_simulations_sweep(device_parameters_space, filter_df=true)
    save_dataset(df, output_path)
    @info "Saving uniform dataset from the linear simulation run."

    # Launch GUI
    create_gui(df, filtered_df)

    # Run optimizer
    @info "Running optimization process on the dataset."
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

    # Pick best
    best_idx = findmax(r -> r.performance, results)[2]
    @debug "Best result index: $best_idx with performance $(results[best_idx].performance)"
    best_amplitudes = results[best_idx].amps
    @debug "Best amplitudes: $best_amplitudes"
    optimal_physical_quantities = update_physical_quantities(best_amplitudes)
    @debug "Optimal physical quantities: $optimal_physical_quantities"


    # Save optimal physical quantities
    header = Dict(
        "description" => "Optimal physical quantities (working point) of the circuit"
    )
    optimal_quantities_file = joinpath(output_path, "optimal_physical_quantities.json")
    @info "Saving optimal physical quantities to: $optimal_quantities_file from the nonlinear simulation."
    save_output_file(header, optimal_physical_quantities, optimal_quantities_file)

    @info "✅ Simulation and optimization processes completed! Results saved in '$output_path'."

end

end  # End of module