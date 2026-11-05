# Run from the repository root:
#   julia --project=. gui/runtime/bridge/feedback-results-test.jl
#
# Tests indexing completed and partially saved feedback cycles without numerics.
using Test, HDF5, JSON

mktempdir() do workspace
    run_id = "output_2026-11-05_12-00-00-000Z"
    root = joinpath(workspace, "outputs", run_id)
    mkpath(root)

    function sample_table(directory, filename, values, columns, matrix_key, names_key)
        mkpath(directory)
        h5open(joinpath(directory, filename), "w") do file
            write(file, matrix_key, reshape(Float64.(values), 1, length(values)))
            write(file, names_key, columns)
        end
    end

    sample_table(root, "df_uniform_analysis.h5", [1, 250, -15],
        ["point_id", "Cg", "metric"], "df_matrix", "df_column_names")

    feedback_root = joinpath(root, "feedback")
    cycle_one = joinpath(feedback_root, "cycle_001")
    cycle_two = joinpath(feedback_root, "cycle_002")

    sample_table(cycle_one, "df_uniform_analysis.h5", [1, 300, -18],
        ["point_id", "Cg", "metric"], "df_matrix", "df_column_names")
    sample_table(cycle_one, "df_optimization_analysis.h5", [1, 300, -18],
        ["evaluation", "Cg", "metric"], "df_optimization_matrix", "df_optimization_column_names")
    sample_table(cycle_one, "df_nonlinear_analysis.h5", [1, 24],
        ["point_id", "performance"], "df_nonlinear_matrix", "df_nonlinear_column_names")
    sample_table(cycle_two, "df_uniform_analysis.h5", [1, 310, -19],
        ["point_id", "Cg", "metric"], "df_matrix", "df_column_names")

    mkpath(feedback_root)
    write(joinpath(feedback_root, "summary.json"), JSON.json(Dict(
        "schemaVersion" => "jco.feedback/1",
        "requestedCycles" => 2,
        "cycles" => [
            Dict("cycle" => 0, "status" => "completed", "metric" => -15,
                 "performance" => 18, "correction" => 0, "parameters" => Dict("Cg" => 250)),
            Dict("cycle" => 1, "status" => "completed", "metric" => -18,
                 "performance" => 24, "correction" => 2, "parameters" => Dict("Cg" => 300)),
        ],
    )))

    push!(ARGS, workspace)
    try
        redirect_stdout(devnull) do
            Base.include(Main, joinpath(@__DIR__, "results.jl"))
        end
    finally
        pop!(ARGS)
    end

    @testset "Feedback cycle indexing remains cycle-specific" begin
        runs = read_result_runs(joinpath(workspace, "outputs"))
        @test length(runs) == 1
        run = only(runs)
        @test run["linear"]["rows"][1][2] == 250
        @test run["feedback"]["schemaVersion"] == "jco.feedback/1"
        @test length(run["feedback"]["cycles"]) == 2
        @test length(run["cycles"]) == 2

        first_cycle = only(filter(c -> c["cycle"] == 1, run["cycles"]))
        @test first_cycle["status"] == "completed"
        @test first_cycle["linear"]["rows"][1][2] == 300
        @test first_cycle["optimization"]["rows"][1][3] == -18
        @test first_cycle["nonlinear"]["rows"][1][2] == 24

        partial = only(filter(c -> c["cycle"] == 2, run["cycles"]))
        @test partial["status"] == "incomplete"
        @test partial["linear"]["rows"][1][2] == 310
        @test partial["optimization"] === nothing
        @test partial["nonlinear"] === nothing
    end
end
