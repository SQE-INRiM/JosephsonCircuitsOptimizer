# Feedback-cycle metadata for both Julia and GUI runs.
# Keep Cycle 0 at the normal run root; corrected cycles store their own datasets.
function _jco_feedback_number(value)
    if value isa Real
        number = Float64(value)
        return isfinite(number) ? number : nothing
    end
    return nothing
end

function _jco_feedback_parameters(params)
    params isa AbstractDict || return Dict{String,Any}()
    return Dict{String,Any}(
        string(name) => _jco_feedback_number(value)
        for (name, value) in params if value isa Real
    )
end

function _jco_feedback_cycle(cycle::Integer, params, metric, performance, correction)
    return Dict{String,Any}(
        "cycle" => Int(cycle),
        "status" => "completed",
        "metric" => _jco_feedback_number(metric),
        "performance" => _jco_feedback_number(performance),
        "correction" => _jco_feedback_number(correction),
        "parameters" => _jco_feedback_parameters(params),
    )
end

# Atomic metadata replacement: completed cycles remain readable after cancellation.
function _jco_save_feedback_summary(run_path::AbstractString, requested::Integer, cycles; stopping=nothing)
    directory = joinpath(run_path, "feedback")
    mkpath(directory)
    destination = joinpath(directory, "summary.json")
    temporary = destination * ".tmp"
    payload = Dict{String,Any}(
        "schemaVersion" => "jco.feedback/1",
        "requestedCycles" => Int(requested),
        "cycles" => cycles,
    )
    if stopping !== nothing
        payload["stopping"] = stopping
    end
    open(temporary, "w") do io
        JSON.print(io, payload)
        println(io)
    end
    mv(temporary, destination; force=true)
    return destination
end
