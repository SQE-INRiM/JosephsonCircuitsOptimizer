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
    
    # Determine the number of parameters (dimensions) from the DataFrame
    param_cols = names(df)[1:end-1]
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

    global plot_index = 0

    # Determine the bounds for the optimization variables from the DataFrame
    bounds = [(minimum(df[:, col]), maximum(df[:, col])) for col in names(df)[1:end-1]]

    println("Bounds: ", bounds)

    # Extract lower and upper bounds as Float64
    lb = [b[1] for b in bounds]
    ub = [b[2] for b in bounds]
    println("Lower bounds:", lb)
    println("Upper bounds:", ub)
    lb = Float64.(lb)  # Ensure bounds are of type Float64
    ub = Float64.(ub)

    # Extract initial points from the DataFrame (all columns except the last one)
    initial_points = [Tuple(row[1:end-1]) for row in eachrow(df)]

    # Extract initial values (the last column of the DataFrame)
    initial_values = df[:, end]

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

    global number_initial_points = 0   # n_maxiters*n_num_new_samples

    # Perform surrogate optimization using the surrogate optimizer function
    result = surrogate_optimize!(
        cost,              # The cost function to optimize
        strategy,            # The surrogate model type (SRBF)
        lb,                # Lower bounds
        ub,                # Upper bounds
        surrogate,        # The surrogate model instance
        sampler,    # Sampling strategy (random sampling)
        maxiters = n_maxiters,                  # Maximum number of iterations
        num_new_samples = n_num_new_samples     # Number of new points to generate for each iteration
    )

    # Extract the optimized vector and its corresponding metric
    optimal_vec = result[1]                # Optimized vector
    optimal_metric = result[2]             # Optimal metric value

    # Extract column names (excluding the last column) and convert them to symbols
    column_names = names(df)[1:end-1]  
    column_symbols = Symbol.(column_names)  # Convert to Vector{Symbol}
    
    # Convert the optimized vector to a dictionary of parameters
    optimal_params = vector_to_param(optimal_vec, column_symbols)

    #!! To add the value for the dynamical correction of the metric !! (e.g., if you have a dynamic correction here)

    return optimal_params, optimal_metric
end
