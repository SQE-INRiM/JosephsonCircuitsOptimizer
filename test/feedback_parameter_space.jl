# Run from repository root:
#   julia --project=. test/feedback_parameter_space.jl
#
# Regression for the scientific distinction between the original search
# domain and the previous cycle's optimal configuration.
using Test, JSON, JosephsonCircuitsOptimizer

mktempdir() do dir
    file = joinpath(dir, "device_parameters_space.json")
    open(file, "w") do io
        JSON.print(io, Dict(
            "Cg" => Dict("start" => 200.0, "step" => 50.0, "stop" => 350.0, "tag" => "design"),
            "I0" => Dict("values" => [1.0, 1.5, 2.0], "tag" => "design"),
            "Ladd" => Dict("values" => [70.0], "tag" => "fixed"),
        ))
    end

    original = JosephsonCircuitsOptimizer.load_params(file)
    old_cycle_behavior = JosephsonCircuitsOptimizer.load_params(file; optimal=Dict(
        :Cg => 300.0, :I0 => 1.5, :Ladd => 70.0,
    ))

    @testset "Feedback cycles preserve original optimization bounds" begin
        @test original[:Cg] == [200.0, 250.0, 300.0, 350.0]
        @test original[:I0] == [1.0, 1.5, 2.0]
        @test old_cycle_behavior[:Cg] == [300.0]
        @test old_cycle_behavior[:I0] == [1.5]
        @test !JosephsonCircuitsOptimizer.is_single_point_parameter_space(original)
        @test JosephsonCircuitsOptimizer.is_single_point_parameter_space(old_cycle_behavior)

        # All corrected feedback cycles must use the original ranges. The
        # correction changes the cost evaluation, not the candidate bounds.
        for _ in 1:3
            current_domain = JosephsonCircuitsOptimizer.load_params(file)
            @test extrema(current_domain[:Cg]) == (200.0, 350.0)
            @test extrema(current_domain[:I0]) == (1.0, 2.0)
        end
    end
end
