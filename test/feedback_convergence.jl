using Test

# No JosephsonCircuits dependency is required to test the stopping rule.
include(joinpath(@__DIR__, "..", "src", "FeedbackConvergence.jl"))

@testset "Nonlinear feedback observed values" begin
    @test feedback_observed_value("cost", -12.0, 20.0, 3.0) == -12.0
    @test feedback_observed_value("performance", -12.0, 20.0, 3.0) == 20.0
    @test feedback_observed_value("correction", -12.0, 20.0, 3.0) == 3.0
    @test_throws ArgumentError feedback_observed_value("bad", -12.0, 20.0, 3.0)
    @test_throws ArgumentError feedback_observed_value("performance", 1.0, NaN, 0.0)
end

@testset "Nonlinear feedback absolute stopping" begin
    @test !feedback_has_converged(nothing, 5.0, "absolute", 0.01)
    @test feedback_has_converged(5.0, 5.005, "absolute", 0.01)
    @test !feedback_has_converged(5.0, 5.05, "absolute", 0.01)
    @test feedback_has_converged(0.0, 0.0, "absolute", 1e-8)
    @test_throws ArgumentError feedback_has_converged(1.0, 2.0, "absolute", 0.0)
    @test_throws ArgumentError feedback_has_converged(1.0, Inf, "absolute", 1e-3)
    @test_throws ArgumentError feedback_has_converged(NaN, 1.0, "absolute", 1e-3)
end

@testset "Nonlinear feedback relative stopping" begin
    # Differences are percentages of the larger of two magnitudes.
    @test feedback_has_converged(100.0, 100.5, "relative", 1.0)
    @test !feedback_has_converged(100.0, 110.0, "relative", 1.0)
    @test feedback_has_converged(0.0, 0.0, "relative", 1.0)
    @test !feedback_has_converged(0.0, 1e-6, "relative", 1.0)
    @test feedback_has_converged(-10.0, -10.05, "relative", 1.0)
    @test_throws ArgumentError feedback_has_converged(1.0, 2.0, "percent", 1.0)
end
