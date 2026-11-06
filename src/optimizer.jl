#-------------------------------------OPTIMIZER-------------------------------------------

# Load the optimizer configuration from a JSON file

function setup_optimizer()
    global optimizer_config = nothing
    optimizer_config = load_params(joinpath(config.user_inputs_dir, "optimizer_config.json"))
end


"Map config string -> Surrogates optimizer strategy (acquisition / search loop)."
function _make_optimizer_strategy(name::AbstractString)
    name_l = lowercase(strip(name))
    if name_l == "srbf"
        return SRBF()
    elseif name_l == "ei"
        return EI()
    elseif name_l == "lcbs" || name_l == "lcb"
        return LCBS()
    else
        @warn "Unknown optimizer_strategy='$name'. Falling back to SRBF()."
        return SRBF()
    end
end

"Map config string -> sampling strategy."
function _make_sampling_strategy(name::AbstractString)
    name_l = lowercase(strip(name))
    if name_l == "randomsample" || name_l == "random"
        return RandomSample()
    elseif name_l == "sobolsample" || name_l == "sobol"
        return SobolSample()
    elseif name_l == "latinhypercubesample" || name_l == "lhs"
        return LatinHypercubeSample()
    else
        @warn "Unknown sampling_strategy='$name'. Falling back to RandomSample()."
        return RandomSample()
    end
end

"Map config string -> surrogate model constructor."
function _make_surrogate_model(name::AbstractString, initial_points, initial_values, lb, ub)
    name_l = lowercase(strip(name))
    if name_l == "kriging"
        return Kriging(initial_points, initial_values, lb, ub)
    elseif name_l == "radialbasis" || name_l == "rbf"
        return RadialBasis(initial_points, initial_values, lb, ub)
    elseif name_l == "secondorderpolynomial" || name_l == "poly2"
        return SecondOrderPolynomial(initial_points, initial_values, lb, ub)
    else
        @warn "Unknown surrogate_model='$name'. Falling back to Kriging()."
        return Kriging(initial_points, initial_values, lb, ub)
    end
end


# Only surrogate coordinates are dimensionless. The original inputs, simulations,
# histories, files and GUI values always stay in user-selected physical units.
function _optimizer_scaled_inputs(df::DataFrame, param_cols::Vector{String})
    physical_lower = Float64[minimum(df[!, col]) for col in param_cols]
    physical_upper = Float64[maximum(df[!, col]) for col in param_cols]
    all(isfinite, physical_lower) && all(isfinite, physical_upper) ||
        throw(ArgumentError("Optimizer parameter bounds must be finite."))
    spans = physical_upper .- physical_lower
    any(>(0.0), spans) ||
        throw(ArgumentError("Optimizer requires at least one varying parameter."))

    # A constant parameter is retained at coordinate zero, with bounds (0,0),
    # to preserve the current parameter-vector shape and legacy 1D workarounds.
    points = [Tuple(spans[j] == 0.0 ? 0.0 :
                    (Float64(row[col]) - physical_lower[j]) / spans[j]
                    for (j, col) in enumerate(param_cols)) for row in eachrow(df)]
    return (
        points = points,
        lb = zeros(length(param_cols)),
        ub = Float64[span > 0.0 ? 1.0 : 0.0 for span in spans],
        physical_lower = physical_lower,
        physical_spans = spans,
    )
end

"Convert an internal surrogate point back to the physical parameters used by cost."
function _optimizer_physical_point(z, scaling)
    length(z) == length(scaling.physical_lower) ||
        throw(DimensionMismatch("Optimizer point has the wrong number of parameters."))
    return Float64[scaling.physical_lower[i] + scaling.physical_spans[i] * Float64(z[i])
                   for i in eachindex(scaling.physical_lower)]
end


"""
    run_optimization(df::DataFrame)

This function performs optimization of the cost function using surrogate-based optimization. 
It uses Kriging as the surrogate model and performs the optimization by selecting new points 
based on previous results and iterating to improve the solution.

# Arguments:
- `df::DataFrame`: A DataFrame containing the input parameter space and the corresponding metric values. 
  The last column should contain the metric (objective function value).

# Returns:
- `optimal_params`: The optimized parameters as a dictionary.
- `optimal_metric`: The metric value corresponding to the optimal parameters.

"""

function run_optimization(df::DataFrame)

    # Ensure the input DataFrame is not empty
    if isempty(df)
        error("The input DataFrame in the optimizer is empty. Please provide a non-empty DataFrame.")
    end   
    
    # Select device parameters explicitly: the dataset may also contain point_id,
    # metric, feasibility and user-defined analysis columns.
    param_cols = String.(collect(keys(device_parameters_space)))
    missing_cols = setdiff(param_cols, names(df))
    isempty(missing_cols) ||
        error("Optimization dataset is missing device parameters: $(join(missing_cols, ", "))")
    :metric in propertynames(df) || error("Optimization dataset has no metric column.")
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

    scaling = _optimizer_scaled_inputs(df, param_cols)
    lb, ub = scaling.lb, scaling.ub
    initial_points = scaling.points
    println("Optimization parameters: ", param_cols)
    println("Normalized bounds: ", collect(zip(lb, ub)))
    
    global number_initial_points = length(initial_points)
    global plot_index = number_initial_points

    # Preserve the original cost and mask values in this first migration step.
    initial_values = Float64.(df[!, :metric])

    #println("initial_points: ", initial_points)
    #println("initial_values: ", initial_values)

    # Initialize a Kriging model (surrogate model) using the initial points and values
    # my_k_SRBFN = Kriging(initial_points, initial_values, lb, ub)

    # Retrieve optimization parameters such as the maximum number of iterations and the number of new samples per iteration
    n_maxiters = optimizer_config[:max_optimizer_iterations]
    n_num_new_samples = optimizer_config[:new_samples_per_optimizer_iteration]    

    sur_name  = string(get(optimizer_config, :surrogate_model, "Kriging"))
    surrogate = _make_surrogate_model(sur_name, initial_points, initial_values, lb, ub)
    opt_name  = string(get(optimizer_config, :optimizer_strategy, "SRBF"))
    strategy  = _make_optimizer_strategy(opt_name)
    samp_name = string(get(optimizer_config, :sampling_strategy, "RandomSample"))
    sampler   = _make_sampling_strategy(samp_name)

    # Used by `cost(vec)` to distinguish between the initial dataset and BO evaluations
    global number_initial_points = length(initial_points)

    # Progress lines for the GUI: BO evaluations only
    global cost_progress_ctx = Progress.start!(; N=n_maxiters*n_num_new_samples, stage="BO")

    # Perform surrogate optimization using the surrogate optimizer function
    result = surrogate_optimize!(
        z -> cost(_optimizer_physical_point(z, scaling)), # simulations use physical units
        strategy,            # The surrogate model type (SRBF)
        lb,                # Lower bounds
        ub,                # Upper bounds
        surrogate,        # The surrogate model instance
        sampler,        # Sampling strategy (random sampling)
        maxiters = n_maxiters,                  # Maximum number of iterations
        num_new_samples = n_num_new_samples     # Number of new points to generate for each iteration
    )

    # Close progress context (best-effort)
    try
        Progress.finish!(cost_progress_ctx)
    catch
    end

    # Extract the optimized vector and its corresponding metric
    optimal_vec = _optimizer_physical_point(result[1], scaling) # Return physical units
    optimal_metric = result[2]             # Optimal metric value

    # Extract column names (excluding the last column) and convert them to symbols
    column_names = param_cols  
    column_symbols = Symbol.(column_names)  # Convert to Vector{Symbol}
    
    # Convert the optimized vector to a dictionary of parameters
    optimal_params = vector_to_param(optimal_vec, column_symbols)

    #!! To add the value for the dynamical correction of the metric !! (e.g., if you have a dynamic correction here)

    return optimal_params, optimal_metric
end
