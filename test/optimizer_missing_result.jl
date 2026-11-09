# Run from the repository root:
#   julia --project=. test/optimizer_missing_result.jl
#
# Exercises the optimizer's missing-result fallback without running simulations.
using Test, DataFrames
import JosephsonCircuitsOptimizer
const JCO = JosephsonCircuitsOptimizer

@testset "Optimizer uses the best physically evaluated feasible point when result is nothing" begin
    original_history = deepcopy(JCO.cost_history)
    try
        for values in values(JCO.cost_history)
            empty!(values)
        end

        df = DataFrame(
            point_id = [1, 2, 3],
            x = [1.0, 2.0, 3.0],
            y = [10.0, 10.0, 10.0],
            metric = [-7.0, -100.0, -8.0],
            feasible = [1.0, 0.0, 1.0],
        )
        param_cols = ["x", "y"]
        scaling = JCO._optimizer_scaled_inputs(df, param_cols)

        # With no optimization evaluations, retain the best feasible sweep point.
        point, value = JCO._optimizer_finalize_result(nothing, df, param_cols, scaling, 0)
        @test point == [3.0, 10.0]
        @test value == -8.0

        # The optimizer's measured objective and feasibility are authoritative,
        # not its surrogate-only penalty and not a masked lower objective.
        push!(JCO.cost_history["params_vecs"], [2.5, 10.0])
        push!(JCO.cost_history["metrics"], -11.0)
        push!(JCO.cost_history["feasible"], true)
        push!(JCO.cost_history["params_vecs"], [1.5, 10.0])
        push!(JCO.cost_history["metrics"], -500.0)
        push!(JCO.cost_history["feasible"], false)
        point, value = JCO._optimizer_finalize_result(nothing, df, param_cols, scaling, 0)
        @test point == [2.5, 10.0]
        @test value == -11.0

        # Even a normal surrogate result is not authoritative: it can be an
        # unevaluated candidate or represent a masked/proxy-valued objective.
        point, value = JCO._optimizer_finalize_result(((0.5, 0.0), -999.0),
                                                       df, param_cols, scaling, 0)
        @test point == [2.5, 10.0]
        @test value == -11.0

        # A better feasible seed beats every optimizer-requested evaluation.
        seed_best = copy(df)
        seed_best.metric[1] = -20.0
        point, value = JCO._optimizer_finalize_result(((0.5, 0.0), -999.0),
                                                       seed_best, param_cols, scaling, 0)
        @test point == [1.0, 10.0]
        @test value == -20.0

        # No feasible observations must not silently produce a masked optimum,
        # even when Surrogates returned a non-nothing candidate.
        all_masked = copy(df)
        all_masked.feasible .= 0.0
        @test_throws ArgumentError JCO._optimizer_finalize_result(
            nothing, all_masked, param_cols, scaling, 2)
        @test_throws ArgumentError JCO._optimizer_finalize_result(
            ((0.5, 0.0), -999.0), all_masked, param_cols, scaling, 2)
    finally
        empty!(JCO.cost_history)
        merge!(JCO.cost_history, original_history)
    end
end
