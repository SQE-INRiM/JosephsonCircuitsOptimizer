# Run from the repository root:
#   julia --project=. test/optimizer_constrained_srbf.jl
#
# No circuit simulation is needed. Verify that masked points train only the
# constraint classifier, never the Kriging metric surrogate.
using Test, Random, DataFrames, JosephsonCircuitsOptimizer

const JCO = JosephsonCircuitsOptimizer

@testset "Feasibility labels preserve explicit user masks" begin
    df = DataFrame(
        metric = [-12.0, 1e8, -20.0, NaN],
        feasible = [1.0, 0.0, 0.0, 1.0],
    )
    @test JCO._optimizer_feasible_flags(df) == [true, false, false, false]
    @test JCO._optimizer_feasible_flags(select(df, Not(:feasible))) ==
          [true, false, true, false]
end

@testset "All points inform the feasibility classifier" begin
    points = [(0.0, 0.0), (0.25, 0.25), (0.75, 0.75), (1.0, 1.0)]
    labels = Bool[true, true, false, false]
    @test JCO._optimizer_feasibility_probability(points[1], points, labels) == 1.0
    @test JCO._optimizer_feasibility_probability(points[end], points, labels) == 0.0
    @test JCO._optimizer_feasibility_probability((0.10, 0.10), points, labels) > 0.5
    @test JCO._optimizer_feasibility_probability((0.90, 0.90), points, labels) < 0.5
    @test_throws DimensionMismatch JCO._optimizer_feasibility_probability((0.5, 0.5), points, Bool[true])
end

@testset "SRBF surrogate only learns feasible objective values" begin
    Random.seed!(20261106)
    # Dense enough to identify feasible regions, sparse enough for fast tests.
    points = [(x, y) for x in 0.0:0.2:1.0 for y in 0.0:0.2:1.0]
    flags = Bool[p[1] <= 0.6 for p in points]
    objective = p -> (p[1] - 0.31)^2 + 2 * (p[2] - 0.37)^2
    metric = [flag ? objective(p) : 1e8 for (p, flag) in zip(points, flags)]
    trained_points = points[flags]
    trained_metrics = metric[flags]

    surrogate = JCO.Kriging(trained_points, trained_metrics, [0.0, 0.0], [1.0, 1.0])
    @test length(surrogate.x) == count(identity, flags)
    @test maximum(surrogate.y) < 1e8

    new_evaluations = Tuple{Tuple{Float64,Float64},Bool}[]
    evaluator = function (p)
        feasible = p[1] <= 0.6
        push!(new_evaluations, (p, feasible))
        return (feasible ? objective(p) : 1e8, feasible)
    end

    best_point, best_value = JCO._optimizer_constrained_srbf!(
        evaluator, surrogate, points, flags, [0.0, 0.0], [1.0, 1.0],
        JCO.RandomSample(); maxiters=6, num_new_samples=32
    )

    # An "iteration" means one real objective evaluation, not 32.
    @test length(new_evaluations) == 6
    # First candidate must be inside the initial local neighborhood of
    # the best FEASIBLE uniform-grid point, rather than anywhere in the box.
    original_best = trained_points[argmin(trained_metrics)]
    @test all(abs.(collect(new_evaluations[1][1]) .- collect(original_best)) .<= 0.15 .+ 1e-12)
    @test best_value <= minimum(trained_metrics) + 1e-10
    @test best_point[1] <= 0.6
    @test maximum(surrogate.y) < 1e8
    @test length(surrogate.x) ==
          length(trained_points) + count(last, new_evaluations)

    bad_surrogate = JCO.Kriging(trained_points, trained_metrics,
                                [0.0, 0.0], [1.0, 1.0])
    @test_throws ArgumentError JCO._optimizer_constrained_srbf!(
        evaluator, bad_surrogate, points, falses(length(points)),
        [0.0, 0.0], [1.0, 1.0], JCO.RandomSample();
        maxiters=1, num_new_samples=10
    )
end
