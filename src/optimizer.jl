#-------------------------------------OPTIMIZER-------------------------------------------

# Load the optimizer configuration from a JSON file

function setup_optimizer()
    global optimizer_config = nothing
    optimizer_config = load_params(joinpath(config.user_inputs_dir, "optimizer_config.json"))
end

# Apply the seed supplied by the project before constructing/sampling the surrogate.
# Older project files without a seed keep their existing RNG behavior.
function _optimizer_apply_seed!()
    seed = get(optimizer_config, :random_seed, nothing)
    seed === nothing && return nothing
    (seed isa Real && isfinite(seed) && isinteger(seed) &&
     0 <= seed <= typemax(Int)) ||
        throw(ArgumentError("Optimizer random_seed must be a non-negative integer."))
    Random.seed!(Int(seed))
    @info "Optimizer random seed" seed=Int(seed)
    return Int(seed)
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
    _optimizer_surrogate_training(df, surrogate_name, strategy_name)

For Kriging + SRBF only, keep all seed positions but replace masked metric
penalties in the surrogate *training copy*. This is a bounded numerical proxy,
not an implementation of constrained Bayesian optimization. Actual user_cost
values and feasible flags remain unchanged in the saved datasets and history.
"""
function _optimizer_surrogate_training(df::DataFrame, surrogate_name::AbstractString,
                                        strategy_name::AbstractString)
    values = Float64.(df[!, :metric])
    if lowercase(strip(surrogate_name)) != "kriging" ||
       lowercase(strip(strategy_name)) != "srbf"
        return values, nothing
    end

    feasible = [isfinite(values[i]) && _linear_row_feasible(row)
                for (i, row) in enumerate(eachrow(df))]
    valid_values = values[feasible]
    isempty(valid_values) &&
        throw(ArgumentError("The linear dataset has no feasible points for Kriging + SRBF."))

    minimum_valid, maximum_valid = extrema(valid_values)
    # Always make masked configurations worse than any measured feasible point.
    # Use the objective's actual variation, never the arbitrary 1e8 sentinel.
    mask_proxy = maximum_valid + max(1.0, maximum_valid - minimum_valid)
    isfinite(mask_proxy) ||
        throw(ArgumentError("Cannot construct a finite surrogate mask penalty."))

    training_values = [feasible[i] ? values[i] : mask_proxy
                       for i in eachindex(values)]
    @info "Kriging + SRBF: $(count(identity, feasible)) feasible / $(count(!, feasible)) masked seed points; surrogate-only mask value = $(mask_proxy)"
    return training_values, mask_proxy
end

"Evaluate physical cost, returning only a bounded mask proxy to Kriging + SRBF."
function _optimizer_surrogate_evaluate(z, scaling, mask_proxy)
    observed = cost(_optimizer_physical_point(z, scaling))
    mask_proxy === nothing && return observed
    feasible = get(last_cost_metrics, :feasible,
                   isfinite(observed) && observed < LEGACY_MASK_THRESHOLD ? 1.0 : 0.0)
    return isfinite(observed) && feasible == 1.0 ? observed : mask_proxy
end


# Surrogates.jl may return nothing after an attempted search. In that case,
# retain only actually evaluated, feasible objectives (never surrogate proxies).
function _optimizer_best_evaluated(df::DataFrame, param_cols::Vector{String}, history_before_bo::Integer)
    best_vec = nothing
    best_metric = Inf

    for row in eachrow(df)
        value = Float64(row.metric)
        if isfinite(value) && _linear_row_feasible(row) && value < best_metric
            best_metric = value
            best_vec = Float64[row[col] for col in param_cols]
        end
    end

    vectors = cost_history["params_vecs"]
    metrics = cost_history["metrics"]
    feasible = cost_history["feasible"]
    for i in (history_before_bo + 1):min(length(vectors), length(metrics), length(feasible))
        value = metrics[i]
        if isfinite(value) && feasible[i] && value < best_metric
            best_metric = value
            best_vec = collect(Float64.(vectors[i]))
        end
    end

    best_vec === nothing && throw(ArgumentError(
        "Surrogate optimization returned no result and no feasible evaluated point is available."
    ))
    return best_vec, best_metric
end

function _optimizer_finalize_result(result, df::DataFrame, param_cols::Vector{String},
                                    scaling, history_before_bo::Integer)
    if result === nothing
        @warn "Surrogate optimizer returned nothing; selecting the best feasible evaluated point from the sweep and optimization history."
    end
    # The surrogate may report a masked or unevaluated candidate. The returned
    # optimum must always be the best *measured* feasible cost, including seeds.
    return _optimizer_best_evaluated(df, param_cols, history_before_bo)
end


"""
    run_optimization(df::DataFrame)

Optimize the cost function through a configurable surrogate and search strategy.
All surrogate coordinates are scaled to [0,1] (fixed coordinates stay zero).
The actual `cost` evaluations and returned parameters use physical units.

# Arguments:
- `df::DataFrame`: Linear results containing the named device-parameter columns,
  a `metric` column, and optionally feasibility and analysis columns.

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

    # Only the surrogate training copy is changed; the DataFrame stays physical.
    sur_name = string(get(optimizer_config, :surrogate_model, "Kriging"))
    opt_name = string(get(optimizer_config, :optimizer_strategy, "SRBF"))
    initial_values, mask_proxy = _optimizer_surrogate_training(df, sur_name, opt_name)

    # The surrogate sees normalized points and (for Kriging + SRBF) a bounded
    # training-only mask penalty. The recorded physical objective is unchanged.
    # Read the configured search budget.
    n_maxiters = optimizer_config[:max_optimizer_iterations]
    n_num_new_samples = optimizer_config[:new_samples_per_optimizer_iteration]    

    surrogate = _make_surrogate_model(sur_name, initial_points, initial_values, lb, ub)
    strategy = _make_optimizer_strategy(opt_name)
    samp_name = string(get(optimizer_config, :sampling_strategy, "RandomSample"))
    sampler   = _make_sampling_strategy(samp_name)

    history_before_bo = length(cost_history["metrics"])
    _optimizer_apply_seed!()

    # Progress lines for the GUI: BO evaluations only
    global cost_progress_ctx = Progress.start!(; N=n_maxiters*n_num_new_samples, stage="BO")

    # Perform surrogate optimization using the surrogate optimizer function
    result = surrogate_optimize!(
        z -> _optimizer_surrogate_evaluate(z, scaling, mask_proxy), # physical simulation; bounded mask only for the surrogate
        strategy,            # Acquisition / search strategy
        lb,                # Lower bounds
        ub,                # Upper bounds
        surrogate,           # Surrogate fitted on normalized coordinates
        sampler,             # Random / Sobol / Latin hypercube
        maxiters = n_maxiters,                  # Maximum number of iterations
        num_new_samples = n_num_new_samples     # Number of new points to generate for each iteration
    )

    # Close progress context (best-effort)
    try
        Progress.finish!(cost_progress_ctx)
    catch
    end

    # Extract the optimized vector and its corresponding metric
    optimal_vec, optimal_metric = _optimizer_finalize_result(
        result, df, param_cols, scaling, history_before_bo)

    # Map the physical optimal vector back to the device-parameter names.
    column_names = param_cols  
    column_symbols = Symbol.(column_names)  # Convert to Vector{Symbol}
    
    # Convert the optimized vector to a dictionary of parameters
    optimal_params = vector_to_param(optimal_vec, column_symbols)


    return optimal_params, optimal_metric
end
