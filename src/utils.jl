#-------------------------------------UTILS-------------------------------------------

"""
    vector_to_param(vec::Vector{Float64}, keys::Vector{Symbol})

This function converts a vector of parameter values into a dictionary using the provided keys.

# Arguments:
- `vec::Vector{Float64}`: A vector of parameter values.
- `keys::Vector{Symbol}`: A vector of keys (symbols) to associate with each parameter value.

# Returns:
- A dictionary where the keys are the provided symbols and the values are the corresponding elements from the vector.
"""
function vector_to_param(vec, keys)
    keys_array = collect(keys)  # Convert KeySet to an array
    Dict(keys_array[i] => vec[i] for i in 1:length(keys_array))
end

"""
    generate_all_initial_points(params_space)

This function generates all possible combinations of parameter values from a dictionary representing the parameter space.

# Arguments:
- `params_space`: A dictionary where the keys are parameter names and the values are lists of parameter values.

# Returns:
- A list of tuples, where each tuple represents a combination of parameter values.
"""
function generate_all_initial_points(params_space)
    # Extract the parameter value lists from the dictionary
    value_lists = values(params_space)
    
    # Initialize an empty set to store the generated points (sets do not allow duplicates)
    points_set = Set{Tuple{Float64, Vararg{Float64}}}()
    
    # Generate all combinations using nested for loops (generalized)
    for values in Iterators.product(value_lists...)
        # Convert each combination into a tuple of floats and add it to the set
        push!(points_set, tuple(map(float, values)...))
    end

    # Convert the set back to a list (array)
    return collect(points_set)
end

"""
    save_output_file(header, data_dict, filename; indent=4)

This function saves a dictionary (`data_dict`) with a header to a JSON file.

# Arguments:
- `header`: A dictionary or named tuple containing header information.
- `data_dict`: The main dictionary to save.
- `filename`: The name of the output JSON file.
- `indent`: The number of spaces for indentation in the JSON file (default is 4).

# Returns:
- Nothing. The data is saved to the specified JSON file.
"""
function save_output_file(header, data_dict, filename; indent=4)
    # Combine the header and data into a single dictionary
    combined_data = Dict(
        "header" => header,
        "data" => data_dict
    )

    # Save the combined dictionary to a JSON file
    open(filename, "w") do f
        JSON.print(f, combined_data, indent)
    end

    @info "Data saved to $filename"
end

"""
    save_output_file(data_dict, filename; indent=4)

This function saves a dictionary (`data_dict`) to a JSON file.

# Arguments:
- `data_dict`: The main dictionary to save.
- `filename`: The name of the output JSON file.
- `indent`: The number of spaces for indentation in the JSON file (default is 4).

# Returns:
- Nothing. The data is saved to the specified JSON file.
"""
function save_output_file(data_dict, filename; indent=4)
    # Save the combined dictionary to a JSON file
    open(filename, "w") do f
        JSON.print(f, data_dict, indent)
    end

    @info "Data saved to $filename"
end

"""
    simulation_time_estimation(n_initial_points, n_maxiters, n_num_new_samples)

This function estimates the total time required for the simulation and calculates the finish time.

# Arguments:
- `n_initial_points`: The number of initial points in the simulation.
- `n_maxiters`: The number of iterations for optimization.
- `n_num_new_samples`: The number of new samples to generate per iteration.

# Returns:
- A tuple with two strings: the estimated simulation time and the estimated finish time.
"""
function simulation_time_estimation(n_initial_points, n_maxiters, n_num_new_samples)
    # Define the time per point in seconds
    time_per_point = 5.0 # seconds
    
    # Calculate total time for the simulation
    total_points = n_initial_points + n_maxiters * n_num_new_samples
    time_estimated = total_points * time_per_point  # in seconds
    
    # Breakdown time into days, hours, minutes, and seconds
    total_seconds = round(Int, time_estimated)
    days = div(total_seconds, 86400)
    hours = div(total_seconds % 86400, 3600)
    minutes = div(total_seconds % 3600, 60)
    seconds = total_seconds % 60
    
    # Calculate the finishing time
    current_time = Dates.now()  # Current date and time
    finish_time = current_time + Dates.Second(total_seconds)
    
    # Create formatted time strings
    formatted_estimation = "$(days)d $(hours)h $(minutes)m $(seconds)s"
    formatted_finish_time = string(finish_time) 
    
    return formatted_estimation, formatted_finish_time
end

"""
    simulation_time(start_time)

This function calculates the total time elapsed since `start_time` and returns it in a formatted string.

# Arguments:
- `start_time`: The start time for the simulation (in seconds).

# Returns:
- A string representing the total elapsed time in days, hours, minutes, and seconds.
"""
function simulation_time(start_time)
    total_time = time() - start_time

    total_seconds = round(Int, total_time)
    days = div(total_seconds, 86400)
    hours = div(total_seconds % 86400, 3600)
    minutes = div(total_seconds % 3600, 60)
    seconds = total_seconds % 60

    formatted_time = "$(days)d $(hours)h $(minutes)m $(seconds)s"
    
    return formatted_time
end

"""
    parse_value(value)

This function parses a value, which could be a dictionary (defining a range), a string (to be evaluated), 
or a simple non-string value.

# Arguments:
- `value`: The value to parse.

# Returns:
- A parsed value, which could be a range, an evaluated expression, or the original value.
"""

function parse_value(value)
    if isa(value, Dict) && all(k -> k in keys(value), ["start", "step", "stop"])
        # Handle range dictionaries
        start = value["start"]
        step  = value["step"]
        stop  = value["stop"]
        return collect(start:step:stop)
    elseif isa(value, String)
        # Handle strings as expressions or numbers
        @debug "Parsing string value: $value"
        try
            # Attempt to parse as a number or expression
            parsed_value = Meta.parse(value)
            if isa(parsed_value, Symbol)
                # If the parsed value is a Symbol, return the original string
                @debug "Parsed value is a Symbol, returning original string: $value"
                return value
            else
                # Otherwise, return the parsed value
                @debug "Parsed value: $parsed_value"
                return parsed_value
            end
        catch
            # If parsing fails, return the string as-is
            @debug "Failed to parse string value: $value"
            return value
        end
    else
        # Return non-dictionary and non-string values as-is
        @debug "Returning non-string value: $value"
        return value
    end
end


"""
    evaluate_expr(value, params::Dict{Symbol,Any})

This function evaluates an expression using the provided parameter values from `params`.

# Arguments:
- `value`: The expression to evaluate.
- `params::Dict{Symbol,Any}`: A dictionary of parameter values to be used in the evaluation.

# Returns:
- The evaluated result of the expression.
"""
function evaluate_expr(value, params::Dict{Symbol, Any})
    if isa(value, Expr)
        @debug "Evaluating expression: $value"
        assignments = [:(const $(k) = $(params[k])) for k in keys(params)]
        block = Expr(:block, assignments..., value)
        evaluated_value = eval(block)
        @info "Evaluated value: $evaluated_value"
        return evaluated_value
    else
        # Do not evaluate strings here; they will be handled in linear_simulation
        @debug "Returning non-expression value: $value"
        return value
    end
end

"""
    load_params(filename)

This function loads parameters from a JSON file, parses them, and evaluates any expressions in the parameter values.

# Arguments:
- `filename`: The path to the JSON file containing the parameters.

# Returns:
- A dictionary containing the parsed and evaluated parameters.
"""


function load_params(filename; optimal::Union{Dict,Nothing}=nothing)
    # --- Robust JSON loading ---
    raw_str = read(filename, String)
    if startswith(raw_str, '\ufeff')
        raw_str = raw_str[2:end]
    end
    clean_str = filter(c -> isprint(c) || c in ['\n','\r','\t'], raw_str)
    raw_params = JSON.parse(clean_str)
    @debug "Raw parameters from JSON file: $raw_params"

    params = Dict{Symbol,Any}()

    for (k, v) in raw_params
        key = Symbol(k)
        values = nothing
        has_tag = false

        if isa(v, Dict)
            # Determine values
            if all(haskey(v, fld) for fld in ("start","step","stop"))
                values = collect(v["start"]:v["step"]:v["stop"])
            elseif haskey(v, "values")
                values = v["values"]
            else
                error("Unsupported dictionary format for key: $k")
            end

            # Just check if "tag" exists
            if haskey(v, "tag")
                has_tag = true
            end
        else
            values = v
        end

        # Override if optimal dict is given AND this param is tagged AND present in optimal
        if optimal !== nothing && has_tag && haskey(optimal, key)
            @debug "Overriding $key with optimal value $(optimal[key])"
            params[key] = [optimal[key]]
        else
            params[key] = values
        end
    end

    @debug "Final parsed parameters: $params"
    return params
    
end




"""
    load_dataset(path)

This function loads a dataset from an HDF5 file and returns two DataFrames: one with the full dataset and one with a filtered dataset.

# Arguments:
- `path`: The path to the HDF5 file.

# Returns:
- A tuple of two DataFrames: the full dataset and the filtered dataset.
"""
function load_dataset(path)
    df = h5open(path, "r") do file
        # Read the matrix and column names
        mat = read(file, "df_matrix")
        col_names = read(file, "df_column_names")
        
        # Recreate the DataFrame with the column names
        DataFrame(mat, col_names)
    end

    filtered_df = h5open(path, "r") do file
        # Read the matrix and column names
        filtered_mat = read(file, "df_filtered_matrix")
        col_names = read(file, "df_column_names")
        
        # Recreate the DataFrame with the column names
        DataFrame(filtered_mat, col_names)
    end

    return df, filtered_df
end

# Read the function definition from the source file
function copy_function(source_file, dest_file)
    content = read(source_file, String)  # Read the whole file as a string
    open(dest_file, "w") do io
        write(io, content)  # Write the content to the new file
    end
end


