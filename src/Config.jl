# src/Config.jl
module Config
    export Configuration, get_configuration , config

    # Define a struct to hold configuration values
    struct Configuration
        WORKING_SPACE::String
        user_inputs_dir::String
        outputs_dir::String
    end

    # Function to initialize and return the Configuration struct
    function get_configuration()
        # Dynamically set the working space
        function set_working_space()
            candidate_1 = joinpath(pwd(), "working_space")
            if isdir(candidate_1)
                @info "Using working space from current directory: $candidate_1"
                return candidate_1
            end

            # Fallback to a default location in the user's home directory
            script_dir = dirname(@__FILE__)
            default_working_space = joinpath(dirname(script_dir), "working_space")
            @warn "⚠️ WORKING_SPACE not specified. Using default: $default_working_space"
            return default_working_space
        end

        WORKING_SPACE = set_working_space()

        # Ensure the user_inputs and outputs directories exist
        user_inputs_dir = joinpath(WORKING_SPACE, "user_inputs")
        outputs_dir = joinpath(WORKING_SPACE, "outputs")
        if !isdir(user_inputs_dir)
            @error "user_input does not exist."
        end
        if !isdir(outputs_dir)
            @info "Creating outputs directory: $outputs_dir"
            mkpath(outputs_dir)
        end

        # Return the Configuration struct
        return Configuration(WORKING_SPACE, user_inputs_dir, outputs_dir)
    end

    const config = get_configuration()

end