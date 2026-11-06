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
    _optimizer_search(df, scaling)

Single search entry point used by both Julia and GUI. Feasibility-aware
Kriging+SRBF uses an objective surrogate trained only on feasible linear
points, plus a separate all-point classifier. Other combinations preserve
their existing Surrogates.jl behavior until their acquisition is adapted.
"""
function _optimizer_search(df::DataFrame, scaling)
    initial_values = Float64.(df[!, :metric])
    initial_points = scaling.points
    flags = _optimizer_feasible_flags(df)
    n_maxiters = Int(optimizer_config[:max_optimizer_iterations])
    n_num_new_samples = Int(optimizer_config[:new_samples_per_optimizer_iteration])
    sur_name = string(get(optimizer_config, :surrogate_model, "Kriging"))
    opt_name = string(get(optimizer_config, :optimizer_strategy, "SRBF"))
    samp_name = string(get(optimizer_config, :sampling_strategy, "RandomSample"))
    sampler = _make_sampling_strategy(samp_name)

    constrained = lowercase(strip(sur_name)) == "kriging" &&
                  lowercase(strip(opt_name)) == "srbf"
    global cost_progress_ctx = Progress.start!(;
        N=constrained ? n_maxiters : n_maxiters * n_num_new_samples,
        stage="BO"
    )
    try
        if constrained
            feasible_indices = findall(identity, flags)
            isempty(feasible_indices) &&
                throw(ArgumentError("All linear grid points are masked; no feasible metric surrogate can be fitted."))
            feasible_points = initial_points[feasible_indices]
            feasible_values = initial_values[feasible_indices]
            surrogate = _make_surrogate_model(sur_name, feasible_points, feasible_values,
                                              scaling.lb, scaling.ub)

            evaluate = function (z)
                metric = cost(_optimizer_physical_point(z, scaling))
                # cost records the exact user-defined flag (or legacy threshold).
                flag = get(last_cost_metrics, :feasible,
                           isfinite(metric) && metric < LEGACY_MASK_THRESHOLD ? 1.0 : 0.0)
                return (metric, flag == 1.0)
            end
            return _optimizer_constrained_srbf!(evaluate, surrogate,
                initial_points, flags, scaling.lb, scaling.ub, sampler;
                maxiters=n_maxiters, num_new_samples=n_num_new_samples)
        else
            if any(!, flags)
                @warn "Feasibility-aware acquisition currently supports Kriging + SRBF only; using legacy penalties for this optimizer combination." surrogate=sur_name strategy=opt_name
            end
            surrogate = _make_surrogate_model(sur_name, initial_points, initial_values,
                                              scaling.lb, scaling.ub)
            return surrogate_optimize!(
                z -> cost(_optimizer_physical_point(z, scaling)),
                _make_optimizer_strategy(opt_name),
                scaling.lb, scaling.ub, surrogate, sampler;
                maxiters=n_maxiters, num_new_samples=n_num_new_samples,
            )
        end
    finally
        try
            Progress.finish!(cost_progress_ctx)
        catch
        end
    end
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

    # Shared with the GUI runtime: the scientific search logic lives in one place.
    result = _optimizer_search(df, scaling)

    # Extract the optimized vector and its corresponding metric
    optimal_vec = _optimizer_physical_point(result[1], scaling) # Return physical units
    optimal_metric = result[2]             # Optimal metric value

    # Map the physical optimal vector back to the device-parameter names.
    column_names = param_cols  
    column_symbols = Symbol.(column_names)  # Convert to Vector{Symbol}
    
    # Convert the optimized vector to a dictionary of parameters
    optimal_params = vector_to_param(optimal_vec, column_symbols)


    return optimal_params, optimal_metric
end
