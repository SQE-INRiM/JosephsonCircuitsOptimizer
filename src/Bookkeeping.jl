
#-------------------------------------BOOKKEEPING-------------------------------------------
module Bookkeeping

using Dates
using JSON
using Pkg

export write_run_bookkeeping

"Recursively convert Julia values into JSON-friendly values (string keys, arrays, numbers, strings)."
function _jsonify(x)
    if x isa Dict
        out = Dict{String,Any}()
        for (k,v) in x
            out[string(k)] = _jsonify(v)
        end
        return out
    elseif x isa NamedTuple
        return _jsonify(Dict(pairs(x)))
    elseif x isa Symbol
        return string(x)
    elseif x isa Tuple
        return [_jsonify(y) for y in x]
    elseif x isa AbstractVector
        return [_jsonify(y) for y in x]
    else
        return x
    end
end

"Capture `Pkg.status()` as a string."
function _pkg_status_string()
    io = IOBuffer()
    try
        Pkg.status(io=io)
        println(io)  # newline
        Pkg.status(io=io; mode=Pkg.PKGMODE_MANIFEST)
    catch
        # best-effort
        Pkg.status(io=io)
    end
    return String(take!(io))
end

"Best-effort git commit hash for a repo root. Returns `nothing` if not available."
function _git_commit_hash(repo_root::AbstractString)
    git = Sys.which("git")
    if !isnothing(git)
        try
            return chomp(read(`$git -C $repo_root rev-parse HEAD`, String))
        catch
        end
    end

    # Fallback: parse .git/HEAD (works for non-worktrees)
    head_path = joinpath(repo_root, ".git", "HEAD")
    if !isfile(head_path)
        return nothing
    end
    head = strip(read(head_path, String))
    if startswith(head, "ref:")
        ref = strip(replace(head, "ref:" => ""))
        ref_path = joinpath(repo_root, ".git", split(ref, '/')...)
        return isfile(ref_path) ? strip(read(ref_path, String)) : nothing
    else
        return head
    end
end

"Write versions.txt inside the run folder."
function _write_versions_txt(output_path::AbstractString; repo_root::AbstractString)
    io = IOBuffer()
    println(io, "date_utc: ", Dates.format(Dates.now(Dates.UTC), dateformat"yyyy-mm-ddTHH:MM:SS"))
    println(io, "julia_version: ", VERSION)
    commit = _git_commit_hash(repo_root)
    println(io, "git_commit: ", isnothing(commit) ? "n/a" : commit)
    println(io, "\n--- Pkg.status() ---\n")
    print(io, _pkg_status_string())

    open(joinpath(output_path, "versions.txt"), "w") do f
        write(f, String(take!(io)))
    end
    return nothing
end

"Write run_config.json inside the run folder."
function _write_run_config_json(
    output_path::AbstractString;
    workspace::AbstractString,
    parameter_space::Dict,
    best_device_parameters,
    best_metric,
    metric_history,
    sim_settings,
    optimizer_settings
)
    payload = Dict(
        "created_at_utc" => Dates.format(Dates.now(Dates.UTC), dateformat"yyyy-mm-ddTHH:MM:SS"),
        "workspace" => workspace,
        "parameter_space" => _jsonify(parameter_space),
        "best_device_parameters" => _jsonify(best_device_parameters),
        "best_metric" => best_metric,
        "metric_history" => _jsonify(metric_history),
        "simulation_settings" => _jsonify(sim_settings),
        "optimizer_settings" => _jsonify(optimizer_settings),
    )

    open(joinpath(output_path, "run_config.json"), "w") do f
        JSON.print(f, payload)
        println(f)
    end
    return nothing
end

"Write outputs/LATEST.txt with the path to the most recent run folder."
function _write_latest_pointer(outputs_dir::AbstractString, output_path::AbstractString)
    mkpath(outputs_dir)
    open(joinpath(outputs_dir, "LATEST.txt"), "w") do f
        println(f, output_path)
    end
    return nothing
end

"""
    write_run_bookkeeping(output_path; config, parameter_space, best_device_parameters, best_metric,
                          metric_history=Dict(), sim_settings=Dict(), optimizer_settings=Dict())

Creates:
- `run_config.json` in `output_path`
- `versions.txt` in `output_path`
- `LATEST.txt` in `config.outputs_dir`
"""
function write_run_bookkeeping(
    output_path::AbstractString;
    config,
    parameter_space::Dict,
    best_device_parameters,
    best_metric,
    metric_history=Dict(),
    sim_settings=Dict(),
    optimizer_settings=Dict()
)
    # repo root = package root (src/..)
    repo_root = normpath(joinpath(@__DIR__, ".."))

    _write_run_config_json(
        output_path;
        workspace=config.WORKING_SPACE,
        parameter_space=parameter_space,
        best_device_parameters=best_device_parameters,
        best_metric=best_metric,
        metric_history=metric_history,
        sim_settings=sim_settings,
        optimizer_settings=optimizer_settings
    )

    _write_versions_txt(output_path; repo_root=repo_root)
    _write_latest_pointer(config.outputs_dir, output_path)
    return nothing
end

end # module
