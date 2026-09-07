using Pkg
Pkg.activate(dirname(Base.active_project()))
using HDF5, JSON

workspace = normpath(ARGS[1])
run_id = String(ARGS[2])
stage = String(ARGS[3])
point_id = parse(Int, ARGS[4])
quantity_key = String(ARGS[5])
array_key = String(ARGS[6])

stage in ("linear", "nonlinear", "custom") || error("Unsupported saved-data stage: $stage")
startswith(run_id, "output_") || error("Invalid run id")
basename(run_id) == run_id || error("Invalid run id")

file_path = joinpath(workspace, "outputs", run_id, "saved_data", "$(stage).h5")
isfile(file_path) || error("No saved-data file exists for run $run_id and stage $stage")

point_name = "point_$(lpad(string(point_id), 6, '0'))"

result = h5open(file_path, "r") do file
    haskey(file, point_name) || error("Saved point $point_id does not exist")
    point_group = file[point_name]
    haskey(point_group, quantity_key) || error("Saved quantity '$quantity_key' does not exist for point $point_id")
    quantity_group = point_group[quantity_key]
    haskey(quantity_group, array_key) || error("Saved array '$array_key' does not exist in '$quantity_key'")
    array_group = quantity_group[array_key]

    storage = haskey(array_group, "storage") ? String(read(array_group, "storage")) : "unknown"
    payload = Dict{String,Any}()

    if haskey(array_group, "values")
        values = vec(Float64.(read(array_group, "values")))
        payload["values"] = values
    elseif haskey(array_group, "real")
        real_values = vec(Float64.(read(array_group, "real")))
        imag_values = haskey(array_group, "imag") ? vec(Float64.(read(array_group, "imag"))) : zeros(length(real_values))
        payload["real"] = real_values
        payload["imag"] = imag_values
        payload["magnitude"] = hypot.(real_values, imag_values)
        payload["phaseRad"] = atan.(imag_values, real_values)
    else
        error("Saved array '$array_key' has no readable numerical dataset")
    end

    n = haskey(payload, "values") ? length(payload["values"]) : length(payload["real"])
    if haskey(file, "frequency_hz") && prod(size(file["frequency_hz"])) == n
        payload["x"] = vec(Float64.(read(file, "frequency_hz")))
        payload["xKind"] = "frequency_hz"
        payload["xLabel"] = "Frequency / Hz"
    else
        payload["x"] = collect(0:(n - 1))
        payload["xKind"] = "index"
        payload["xLabel"] = "Index"
    end

    payload["storage"] = storage
    payload["runId"] = run_id
    payload["stage"] = stage
    payload["pointId"] = point_id
    payload["quantityName"] = haskey(quantity_group, "quantity_name") ? String(read(quantity_group, "quantity_name")) : quantity_key
    payload["arrayName"] = array_key
    payload
end

print(JSON.json(result))
