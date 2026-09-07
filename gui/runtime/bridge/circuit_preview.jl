using Pkg
Pkg.activate(dirname(Base.active_project()))
push!(LOAD_PATH, joinpath(dirname(Base.active_project()), "src"))
using JosephsonCircuitsOptimizer
using JSON
using Symbolics

const JCO = JosephsonCircuitsOptimizer
workspace = normpath(ARGS[1])

function representative_value(value)
    if value isa AbstractVector || value isa Tuple
        isempty(value) && error("Cannot preview an empty parameter sweep.")
        return representative_value(first(value))
    end
    return value
end

function json_scalar(value)
    if value isa Bool || value isa Integer || value isa AbstractString
        return value
    elseif value isa AbstractFloat
        return isfinite(value) ? value : string(value)
    elseif value isa Real
        try
            return Float64(value)
        catch
            return string(value)
        end
    elseif value isa Complex
        return string(value)
    elseif value === nothing
        return nothing
    end
    return string(value)
end

function resolve_component_value(value, definitions)
    if value isa Number
        return json_scalar(value)
    end
    try
        if haskey(definitions, value)
            return json_scalar(definitions[value])
        end
    catch
    end
    try
        substituted = Symbolics.substitute(value, definitions)
        result = json_scalar(substituted)
        if result isa AbstractString
            parsed = tryparse(Float64, result)
            return parsed === nothing ? result : parsed
        end
        return result
    catch
    end
    return string(value)
end

function component_kind(name::String)
    lname = lowercase(name)
    startswith(lname, "lj") && return "Lj"
    isempty(name) && return "Unknown"
    first_char = uppercase(string(first(name)))
    return first_char in ("P", "R", "C", "L", "K", "I", "V") ? first_char : "Unknown"
end

configuration = JCO.get_configuration(; workspace=workspace, create=false)
Core.eval(JCO, :(global config = get_configuration(; workspace=$workspace, create=false)))

parameter_space = JCO.load_params(joinpath(configuration.user_inputs_dir, "device_parameters_space.json"))
preview_parameters = Dict{Symbol,Any}(Symbol(key) => representative_value(value) for (key, value) in parameter_space)
input_parameters = deepcopy(preview_parameters)

circuit = redirect_stdout(devnull) do
    JCO.setup_circuit()
    JCO.create_circuit(preview_parameters)
end

components = Any[]
electrical_nodes = Set{String}()
for element in circuit.CircuitStruct
    length(element) >= 4 || continue
    name = string(element[1])
    kind = component_kind(name)
    endpoint1 = string(element[2])
    endpoint2 = string(element[3])
    value = element[4]
    resolved = resolve_component_value(value, circuit.CircuitDefs)

    if kind != "K"
        push!(electrical_nodes, endpoint1)
        push!(electrical_nodes, endpoint2)
    end

    push!(components, Dict(
        "name" => name,
        "kind" => kind,
        "node1" => endpoint1,
        "node2" => endpoint2,
        "valueExpression" => string(value),
        "resolvedValue" => resolved,
    ))
end

nodes = sort!(collect(electrical_nodes); by=x -> begin
    parsed = tryparse(Int, x)
    parsed === nothing ? (1, 0, x) : (0, parsed, x)
end)

payload = Dict(
    "schemaVersion" => "jco.circuit-preview/1",
    "parameterPolicy" => "first_value",
    "parameters" => Dict(string(key) => json_scalar(value) for (key, value) in input_parameters),
    "portCount" => circuit.PortNumber,
    "nodes" => nodes,
    "components" => components,
)

JSON.print(stdout, payload)
