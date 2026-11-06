# JCO-owned, feasibility-aware SRBF step for normalized surrogate coordinates.
#
# The metric surrogate is fitted ONLY on feasible points. A transparent local
# classifier sees ALL evaluated points, including masked ones. Neither the
# physical cost function nor its objective/penalty values are modified.

"Derive Boolean feasibility from an explicit column or the legacy mask threshold."
function _optimizer_feasible_flags(df::DataFrame)
    if :feasible in propertynames(df)
        return Bool[isfinite(Float64(row.metric)) && row.feasible == 1.0
                    for row in eachrow(df)]
    end
    return Bool[isfinite(Float64(v)) && v < LEGACY_MASK_THRESHOLD for v in df[!, :metric]]
end

"""
    _optimizer_feasibility_probability(z, points, feasible; neighbors=8)

Inverse-distance weighted k-nearest-neighbor estimate in normalized coordinates.
This is a simple, inspectable *classifier*, not an additional physics model and
not a calibrated statistical probability. All masked points inform the boundary.
"""
function _optimizer_feasibility_probability(z, points, feasible; neighbors::Int=8)
    length(points) == length(feasible) ||
        throw(DimensionMismatch("Feasibility labels do not match sampled points."))
    isempty(points) && return 0.0
    neighbors >= 1 || throw(ArgumentError("neighbors must be positive."))
    distances = [norm(Float64.(collect(p)) .- Float64.(collect(z))) for p in points]
    nearest = partialsortperm(distances, 1:min(neighbors, length(points)))
    # At a known point the observed label takes precedence over interpolation.
    distances[nearest[1]] < 1e-12 && return feasible[nearest[1]] ? 1.0 : 0.0
    weights = [inv((distances[i] + 1e-6)^2) for i in nearest]
    return sum(weights[j] * Float64(feasible[i]) for (j, i) in enumerate(nearest)) /
           sum(weights)
end

"Map candidate values into [0,1] without dividing by zero for constant sets."
function _optimizer_unit_scores(values)
    lo, hi = extrema(values)
    hi > lo || return fill(0.5, length(values))
    return (values .- lo) ./ (hi - lo)
end

"""
    _optimizer_constrained_srbf!(evaluate, surrogate, points, feasible, lb, ub, sampler;
                                 maxiters, num_new_samples)

Use the metric surrogate for the feasible region only. Each iteration proposes
`num_new_samples` candidates near the best *feasible* measured point, screens
them using the classifier, scores them by surrogate prediction, distance from
already evaluated points and estimated feasibility, and evaluates one candidate.

`evaluate(z)` returns `(metric, feasible)`; both the original metric and label
are stored in the calling cost function. Masked evaluations update the
classifier, but NEVER the metric surrogate. An iteration budget counts actual
new evaluations (not the number of cheap surrogate candidates).
"""
function _optimizer_constrained_srbf!(evaluate::Function, surrogate,
        points, feasible::AbstractVector{Bool}, lb, ub, sampler;
        maxiters::Int, num_new_samples::Int)

    maxiters >= 1 || throw(ArgumentError("Optimizer iterations must be positive."))
    num_new_samples >= 1 || throw(ArgumentError("Samples per iteration must be positive."))
    length(points) == length(feasible) ||
        throw(DimensionMismatch("Feasibility labels do not match sampled points."))

    all_points = collect(points)
    all_feasible = collect(feasible)
    any(all_feasible) ||
        throw(ArgumentError("No feasible linear points: cannot fit the metric surrogate."))

    # The surrogate was built exclusively from the feasible initial points.
    best_idx = argmin(surrogate.y)
    best_x = surrogate.x[best_idx]
    best_y = Float64(surrogate.y[best_idx])
    scale = 0.15
    no_improvement = 0
    cutoff = 1e-3 * norm(ub .- lb)
    weights = (0.95, 0.7, 0.5, 0.3)

    @info "Feasibility-aware SRBF started" training_points=length(surrogate.y) all_points=length(all_points) masked_points=count(!, all_feasible)

    for iteration in 1:maxiters
        # Search locally first: the initial uniform grid already identifies
        # promising regions. Expand the neighborhood after repeated failures.
        local_lb = max.(lb, collect(best_x) .- scale .* (ub .- lb))
        local_ub = min.(ub, collect(best_x) .+ scale .* (ub .- lb))
        candidates = sample(num_new_samples, local_lb, local_ub, sampler)

        viable_points = Tuple[]
        probabilities = Float64[]
        distances = Float64[]
        predictions = Float64[]
        for point in candidates
            z = Tuple(Float64.(collect(point)))
            d = minimum(norm(collect(p) .- collect(z)) for p in all_points)
            d <= cutoff && continue
            p_feasible = _optimizer_feasibility_probability(z, all_points, all_feasible)
            predicted = Float64(surrogate(z))
            isfinite(predicted) || continue
            push!(viable_points, z)
            push!(probabilities, p_feasible)
            push!(distances, d)
            push!(predictions, predicted)
        end
        if isempty(viable_points)
            @warn "Constrained SRBF: no distinct candidates; returning best evaluated feasible point." iteration
            break
        end

        # Prefer predicted-feasible candidates. If all are uncertain, evaluate
        # the most likely feasible candidate so new data can refine the boundary.
        eligible = findall(>=(0.5), probabilities)
        if isempty(eligible)
            eligible = [argmax(probabilities)]
        end
        prediction_scores = _optimizer_unit_scores(predictions[eligible])
        distance_scores = _optimizer_unit_scores(distances[eligible])
        w = weights[mod1(iteration, length(weights))]
        merits = [w * prediction_scores[i] + (1 - w) * (1 - distance_scores[i]) +
                  0.25 * (1 - probabilities[eligible[i]]) for i in eachindex(eligible)]
        chosen = eligible[argmin(merits)]
        z = viable_points[chosen]

        metric, is_feasible = evaluate(z)
        observed_metric = Float64(metric)
        actual_feasible = Bool(is_feasible) && isfinite(observed_metric)

        # Every evaluated point informs the classifier and duplicate rejection.
        push!(all_points, z)
        push!(all_feasible, actual_feasible)
        if actual_feasible
            # Update ONLY with real, feasible physics results.
            update!(surrogate, z, observed_metric)
            if observed_metric < best_y
                best_y = observed_metric
                best_x = z
                no_improvement = 0
                scale = max(0.06, scale * 0.85)
            else
                no_improvement += 1
            end
        else
            no_improvement += 1
        end

        if no_improvement >= 4
            scale = min(0.40, scale * 1.35)
            no_improvement = 0
        end
        @info "Constrained SRBF evaluation" iteration metric=observed_metric feasible=actual_feasible best_metric=best_y search_scale=scale
    end
    @info "Feasibility-aware SRBF completed" best_metric=best_y evaluations=length(all_points)-length(points)
    return (best_x, best_y)
end
