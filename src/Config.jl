# src/Config.jl
module Config
    export Configuration, get_configuration, config

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
            candidate = joinpath(pwd(), "working_space")
            if isdir(candidate)
                @info "Using working space from current directory: $candidate"
                return candidate
            end

            # Create a new working space in the current directory if none exists
            @info "No working space found. Creating new one at: $candidate"
            mkpath(candidate)
            return candidate
        end

        WORKING_SPACE = set_working_space()

        # Ensure the user_inputs and outputs directories exist
        user_inputs_dir = joinpath(WORKING_SPACE, "user_inputs")
        outputs_dir = joinpath(WORKING_SPACE, "outputs")
        
        if !isdir(user_inputs_dir)
            @info "Creating user_inputs directory: $user_inputs_dir"
            mkpath(user_inputs_dir)
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