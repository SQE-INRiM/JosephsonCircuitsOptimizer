# Run from the repository root:
#   julia --project=. gui/runtime/bridge/results-race-test.jl
#
# A deterministic regression for a run directory disappearing after discovery
# but before results indexing. No simulation or numerics are required.
using Test

mktempdir() do workspace
    outputs = joinpath(workspace, "outputs")
    kept_name = "output_2026-11-03_14-00-00-000Z"
    removed_name = "output_2026-11-03_15-00-00-000Z"
    kept_path = joinpath(outputs, kept_name)
    removed_path = joinpath(outputs, removed_name)
    mkpath(kept_path)
    mkpath(removed_path)

    push!(ARGS, workspace)
    try
        redirect_stdout(devnull) do
            Base.include(Main, joinpath(@__DIR__, "results.jl"))
        end
    finally
        pop!(ARGS)
    end

    @testset "Results survives deletion between discovery and indexing" begin
        @test length(read_result_runs(outputs)) == 2
        visited = String[]
        indexed = read_result_runs(outputs; before_index=path -> begin
            push!(visited, basename(path))
            if basename(path) == removed_name
                rm(path; recursive=true, force=true)
            end
        end)
        @test removed_name in visited
        @test length(indexed) == 1
        @test indexed[1]["id"] == kept_name
    end

    @testset "Do not suppress errors from existing run directories" begin
        open(joinpath(kept_path, "df_uniform_analysis.h5"), "w") do io
            write(io, "invalid HDF5")
        end
        @test_throws Exception read_result_runs(outputs)
    end
end
