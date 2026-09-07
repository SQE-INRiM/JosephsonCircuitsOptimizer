# GUI output-path policy.
#
# The embedded JCO stage-only entry points create their own output folders but do not
# consistently update CURRENT_OUTPUT_PATH. GUI-only persistence (optimizer history,
# save_data, etc.) relies on that reference, so make create_output_path authoritative
# for every desktop-launched mode.
function create_output_path(base_output_path::AbstractString)
    requested_run_id = strip(get(ENV, "JCO_RUN_ID", ""))
    if !isempty(requested_run_id) && !occursin(r"^output_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}Z$", requested_run_id)
        error("Invalid JCO_RUN_ID: $requested_run_id")
    end

    timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS")
    output_id = isempty(requested_run_id) ? "output_" * timestamp : requested_run_id
    output_path = joinpath(base_output_path, output_id)
    mkpath(output_path)
    CURRENT_OUTPUT_PATH[] = output_path
    return output_path
end
