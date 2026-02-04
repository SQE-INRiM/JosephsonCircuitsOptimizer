module Resume

export restore_latest_inputs_snapshot_config

using Dates

# small helpers (Windows-safe)
_cleanpath(s::AbstractString) = normpath(strip(String(s)))

function latest_run_folder(workspace::AbstractString)
    workspace = _cleanpath(workspace)
    latest_txt = joinpath(workspace, "outputs", "LATEST.txt")
    isfile(latest_txt) || error("LATEST.txt not found at: $latest_txt")
    return _cleanpath(read(latest_txt, String))
end

"""
Restore the latest run's inputs_snapshot into the active user_inputs directory.

- Copies files from: <LATEST_RUN>/inputs_snapshot/*
- Into: <workspace>/user_inputs/*   (or whatever user_inputs_dir points to)

Returns a NamedTuple with run_folder and files_copied.
"""
function restore_latest_inputs_snapshot_config(; workspace::AbstractString,
                                              user_inputs_dir::AbstractString=joinpath(workspace, "user_inputs"),
                                              overwrite::Bool=true)

    workspace = _cleanpath(workspace)
    user_inputs_dir = _cleanpath(user_inputs_dir)

    run_folder = latest_run_folder(workspace)
    snap = joinpath(run_folder, "inputs_snapshot")
    isdir(snap) || error("inputs_snapshot folder not found at: $snap")

    mkpath(user_inputs_dir)

    files = readdir(snap)
    isempty(files) && error("inputs_snapshot is empty at: $snap")

    copied = String[]
    skipped = String[]

    for f in files
        src = joinpath(snap, f)
        dst = joinpath(user_inputs_dir, f)

        if isfile(dst) && !overwrite
            push!(skipped, f)
            continue
        end

        # copy bytes (simple + reliable)
        open(src, "r"; lock=false) do i
            open(dst, "w"; lock=false) do o
                write(o, read(i))
            end
        end
        push!(copied, f)
    end

    return (run_folder=run_folder, user_inputs_dir=user_inputs_dir, files_copied=copied, files_skipped=skipped)
end

end # module