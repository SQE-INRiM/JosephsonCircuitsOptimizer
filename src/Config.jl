module Config
    export Configuration, get_configuration, config

    # 1. Configuration struct remains the same
    struct Configuration
        WORKING_SPACE::String
        user_inputs_dir::String
        outputs_dir::String
    end

    # 2. Use a Ref instead of direct constant
    const _config = Ref{Configuration}()  # Starts as uninitialized

    # 3. Modified get_configuration that initializes only when needed
    function get_configuration()
        if !isassigned(_config)  # Only run if not initialized
            WORKING_SPACE = set_working_space()
            
            # Create directories only now, when first accessed
            user_inputs_dir = joinpath(WORKING_SPACE, "user_inputs")
            outputs_dir = joinpath(WORKING_SPACE, "outputs")
            
            mkpath(user_inputs_dir)  # Now creates dirs
            mkpath(outputs_dir)
            
            _config[] = Configuration(WORKING_SPACE, user_inputs_dir, outputs_dir)
        end
        return _config[]  # Return the stored configuration
    end

    # 4. Private helper function
    function set_working_space()
        candidate = joinpath(pwd(), "working_space")
        isdir(candidate) || mkpath(candidate)  # Create if doesn't exist
        return candidate
    end

    # 5. Accessor function (recommended interface)
    config() = get_configuration()
end