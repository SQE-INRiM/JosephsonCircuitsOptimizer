# Desktop-only bookkeeping fixes loaded after the storage/optimizer overrides.
#
# User circuit definitions may derive additional device parameters by mutating the
# device parameter dictionary passed to create_user_circuit (for example Cj_small or
# Ic_density). The optimizer returns only the explicit optimization coordinates, so
# optimal_device_parameters*.json must materialize those derived values before writing.

function _gui_materialize_device_parameters_for_output(data_dict, filename::AbstractString)
    base = basename(String(filename))
    if !(startswith(base, "optimal_device_parameters") && endswith(lowercase(base), ".json"))
        return data_dict
    end

    data_dict isa AbstractDict || return data_dict

    materialized = deepcopy(data_dict)
    try
        # create_user_circuit is the authoritative place where model-specific derived
        # parameters are populated. Build the circuit on the copy only; the optimized
        # coordinates and the caller's dictionary remain unchanged.
        create_circuit(materialized)
    catch err
        @warn "Could not materialize derived optimal device parameters before saving; writing available values" exception=(err, catch_backtrace()) filename=filename
    end

    return materialized
end

# Preserve the existing save_output_file contract while ensuring all optimal device
# parameter JSON files contain the same fully evaluated parameter set used by the circuit.
function save_output_file(header, data_dict, filename; indent=4)
    output_data = _gui_materialize_device_parameters_for_output(data_dict, filename)
    combined_data = Dict(
        "header" => header,
        "data" => output_data,
    )

    open(filename, "w") do f
        JSON.print(f, combined_data, indent)
    end

    @info "Data saved to $filename"
    return nothing
end
