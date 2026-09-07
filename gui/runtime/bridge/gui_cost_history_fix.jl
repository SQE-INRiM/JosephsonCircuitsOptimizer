# GUI-only fix for optimizer/linear evaluation history persistence.
#
# CostModule.cost_history stores parameter samples as Vector{Vector{Float64}}. The
# optimizer can call cost(...) with tuple-like coordinates; broadcasting Float64 over
# a tuple returns a tuple, which cannot be pushed into Vector{Vector{Float64}}. The
# original best-effort catch hid that conversion failure, leaving cost_history empty
# even though optimization completed successfully.
#
# Keep the engine calculation unchanged and only make the recorded coordinate an
# explicit Vector{Float64}. Also surface an unexpected history-write failure as a
# warning so persistence cannot silently disappear again.
function cost(vec)
    global plot_index
    global number_initial_points
    plot_index += 1

    println("-----------------------------------------------------")
    check_stop()

    if isdefined(@__MODULE__, :cost_progress_ctx) && plot_index > number_initial_points
        i_bo = plot_index - number_initial_points
        try
            Progress.tick!(cost_progress_ctx; i=i_bo)
        catch
        end
    end

    if plot_index < number_initial_points + 1
        println("Linear Simulation process. Point number ", plot_index, " of ", number_initial_points,
            ", that are the ", round(100 * (plot_index / number_initial_points)), " % of the total")
    else
        iter = plot_index - number_initial_points
        println("Optimization process: iteration number ", iter)
    end

    sol, device_params_temp = sim_sys(vec)

    global delta_correction
    out = Base.invokelatest(user_cost, sol, device_params_temp, delta_correction)
    metric, metrics_dict = unpack_user_metrics(out; default_name=:metric)

    global last_cost_metrics
    last_cost_metrics = metrics_dict

    try
        recorded_vec = collect(Float64.(vec))
        push!(cost_history["params_vecs"], recorded_vec)
        push!(cost_history["metrics"], Float64(metric))
        push!(cost_history["timestamps_utc"], Dates.format(Dates.now(Dates.UTC), dateformat"yyyy-mm-ddTHH:MM:SS"))
    catch err
        @warn "Could not record cost-history evaluation" exception=(err, catch_backtrace())
    end

    return metric
end
