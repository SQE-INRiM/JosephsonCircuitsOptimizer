# Run from the repository root:
#   julia --project=. test/optimizer_preprocessing.jl
#
# Regression coverage for the preprocessing boundary, independently of any
# JosephsonCircuits simulation. No user_cost code needs to be modified.
using Test, DataFrames, JosephsonCircuitsOptimizer

const JCO = JosephsonCircuitsOptimizer

@testset "Surrogate coordinates are dimensionless, physical values are not" begin
    df = DataFrame(
        "I0" => [1.0e-6, 2.0e-6],
        "Cg" => [250.0e-15, 350.0e-15],
        "Ladd" => [70.0e-12, 70.0e-12],
        "metric" => [-20.0, 1.0e8],
        "feasible" => [1.0, 0.0],
    )
    original = deepcopy(df)
    scaled = JCO._optimizer_scaled_inputs(df, ["I0", "Cg", "Ladd"])

    @test scaled.lb == [0.0, 0.0, 0.0]
    @test scaled.ub == [1.0, 1.0, 0.0]
    @test scaled.points == [(0.0, 0.0, 0.0), (1.0, 1.0, 0.0)]
    @test df == original # No edits to the dataset or its metric/feasible flags.

    middle = JCO._optimizer_physical_point((0.5, 0.25, 0.0), scaled)
    @test middle[1] ≈ 1.5e-6
    @test middle[2] ≈ 275e-15
    @test middle[3] == 70e-12

    for (scaled_point, row) in zip(scaled.points, eachrow(df))
        physical = JCO._optimizer_physical_point(scaled_point, scaled)
        @test all(isapprox.(physical, [row.I0, row.Cg, row.Ladd]; rtol=1e-12, atol=0.0))
    end
    @test_throws DimensionMismatch JCO._optimizer_physical_point((0.0,), scaled)
end

@testset "Feasibility is metadata independent of the objective" begin
    @test JCO._cost_point_feasible((metric = -20.0,), -20.0)
    @test !JCO._cost_point_feasible((metric = 1e8,), 1e8)
    @test !JCO._cost_point_feasible((metric = NaN,), NaN)
    @test !JCO._cost_point_feasible((metric = -20.0, feasible = false), -20.0)
    @test JCO._cost_point_feasible((metric = -20.0, feasible = true), -20.0)
    @test JCO._cost_point_feasible((metric = -20.0, feasible = 1), -20.0)
    @test_throws ArgumentError JCO._cost_point_feasible((metric = -20.0, feasible = 2), -20.0)

    data = DataFrame(metric = [-20.0, -19.0, 1e8], feasible = [1.0, 0.0, 0.0])
    @test filter(JCO._linear_row_feasible, data).metric == [-20.0]
    @test filter(JCO._linear_row_feasible, select(data, Not(:feasible))).metric == [-20.0, -19.0]
end

@testset "Degenerate and invalid bounds" begin
    constant = DataFrame("I0" => [1e-6, 1e-6], "Cg" => [250e-15, 250e-15])
    @test_throws ArgumentError JCO._optimizer_scaled_inputs(constant, ["I0", "Cg"])
    invalid = DataFrame("I0" => [1e-6, Inf], "Cg" => [250e-15, 350e-15])
    @test_throws ArgumentError JCO._optimizer_scaled_inputs(invalid, ["I0", "Cg"])
end

@testset "GUI bridge preserves feasibility across its later overrides" begin
    bridge_dir = joinpath(@__DIR__, "..", "gui", "runtime", "bridge")
    run_source = read(joinpath(bridge_dir, "run.jl"), String)
    cost_source = read(joinpath(bridge_dir, "gui_cost_history_fix.jl"), String)
    persistence_source = read(joinpath(bridge_dir, "gui_optimizer_persistence_diagnostics.jl"), String)

    # These GUI-specific methods are loaded after the engine methods.
    @test occursin("gui_cost_history_fix.jl", run_source)
    @test occursin("gui_optimizer_persistence_diagnostics.jl", run_source)

    # Guard against the GUI silently overriding the feasibility contract.
    @test occursin("metrics_dict[:feasible]", cost_source)
    @test occursin("push!(cost_history[\"feasible\"]", cost_source)
    @test occursin("feasible_history", persistence_source)
    @test occursin("[\"metric\", \"feasible\"]", persistence_source)
end

@testset "Bounded surrogate penalties preserve physical data" begin
    df = DataFrame(
        metric = [-12.0, -10.0, 1.0e8, -11.0],
        feasible = [1.0, 1.0, 0.0, 0.0],
    )
    original = deepcopy(df)
    training, proxy = JCO._optimizer_surrogate_training(df, "Kriging", "SRBF")
    @test proxy == -8.0 # max feasible + range, not 1e8
    @test training == [-12.0, -10.0, -8.0, -8.0]
    @test df == original # Simulation data and real mask values are untouched.

    # Metadata must override the legacy metric threshold.
    inferred, _ = JCO._optimizer_surrogate_training(select(df, Not(:feasible)), "Kriging", "SRBF")
    @test inferred[end] == -11.0

    # Other combinations retain their original objective and acquisition behavior.
    legacy, no_proxy = JCO._optimizer_surrogate_training(df, "Kriging", "EI")
    @test legacy == df.metric
    @test no_proxy === nothing

    # An all-masked dataset has no defensible optimum.
    @test_throws ArgumentError JCO._optimizer_surrogate_training(
        DataFrame(metric=[1e8, 1e8], feasible=[0.0, 0.0]), "Kriging", "SRBF"
    )
    @test all(isfinite, training)
    @test minimum(training) == minimum(df.metric)
end
