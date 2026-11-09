# Run from repository root:
#   julia --project=. test/feedback_linear_cache.jl
#
# Tests use an in-memory stand-in; no hbsolve is performed.
using Test
import JosephsonCircuitsOptimizer
const JCO = JosephsonCircuitsOptimizer

struct MockFeedbackLinearCircuit end
const feedback_linear_solve_count = Ref(0)

function JCO.linear_solution(params::Dict, ::MockFeedbackLinearCircuit)
    feedback_linear_solve_count[] += 1
    return (s21 = complex(params[:gain], params[:phase]),)
end

@testset "Feedback reuses full solutions but reevaluates arbitrary cost" begin
    @eval JCO sim_vars = Dict{Symbol,Any}(:w_range => [1.0, 2.0])
    circuit = MockFeedbackLinearCircuit()
    params = Dict(:gain => 2.0, :phase => 1.0, :derived => 42.0)
    feedback_linear_solve_count[] = 0

    # Outside feedback nothing is cached.
    JCO._feedback_linear_cache_stop!()
    JCO._feedback_linear_solution([1.0], params, circuit)
    JCO._feedback_linear_solution([1.0], params, circuit)
    @test feedback_linear_solve_count[] == 2

    JCO._feedback_linear_cache_start!()
    try
        sol1 = JCO._feedback_linear_solution([1.0], params, circuit)
        sol2 = JCO._feedback_linear_solution((1.0,), params, circuit)
        @test sol1 === sol2
        @test feedback_linear_solve_count[] == 3

        # A nonlinear correction may act inside a complex expression instead
        # of being added to the final metric.
        metric(sol, correction) = abs(sol.s21 + im * correction)
        @test metric(sol1, 0.0) != metric(sol2, 2.0)
        @test metric(sol2, 2.0) != metric(sol1, 0.0) + 2.0

        # Derived device parameters must match, not merely the sweep coordinates.
        altered_params = copy(params)
        altered_params[:derived] = 43.0
        JCO._feedback_linear_solution([1.0], altered_params, circuit)
        @test feedback_linear_solve_count[] == 4

        # A changed solver configuration bypasses this run's cached solutions.
        JCO.sim_vars[:w_range] = [1.0, 3.0]
        JCO._feedback_linear_solution([1.0], params, circuit)
        @test feedback_linear_solve_count[] == 5
    finally
        JCO._feedback_linear_cache_stop!()
    end

    @test isempty(JCO._feedback_linear_cache)
    @test !JCO._feedback_linear_cache_active[]

    # When retention is not affordable, fall back to an ordinary fresh solve.
    original_limit = JCO._feedback_linear_cache_limit_bytes[]
    JCO._feedback_linear_cache_limit_bytes[] = 0
    JCO._feedback_linear_cache_start!()
    try
        before = feedback_linear_solve_count[]
        JCO._feedback_linear_solution([1.0], params, circuit)
        JCO._feedback_linear_solution([1.0], params, circuit)
        @test feedback_linear_solve_count[] == before + 2
        @test isempty(JCO._feedback_linear_cache)
    finally
        JCO._feedback_linear_cache_limit_bytes[] = original_limit
        JCO._feedback_linear_cache_stop!()
    end
end
