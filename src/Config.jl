# src/Config.jl
module Config
    export Configuration, get_configuration, config

    struct Configuration
        WORKING_SPACE::String
        user_inputs_dir::String
        outputs_dir::String
    end

    # Store the configuration as a Ref instead of const
    const _config = Ref{Configuration}()

    # Modified get_configuration that only creates directories when first called
    function get_configuration()
        if !isassigned(_config)
            WORKING_SPACE = set_working_space()
            
            # Create directories only when first accessed
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
            
            _config[] = Configuration(WORKING_SPACE, user_inputs_dir, outputs_dir)
        end
        return _config[]
    end

    # Helper function
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

    # This will now initialize only when first accessed
    config() = get_configuration()
end