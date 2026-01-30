# src/Config.jl
module Config
    export Configuration, get_configuration

    # Define a struct to hold configuration values
    struct Configuration
        WORKING_SPACE::String
        user_inputs_dir::String
        outputs_dir::String
        plot_dir::String
        corr_dir::String
    end

    """
        get_configuration(; workspace=nothing, create=true)

    Build a `Configuration` without causing side effects at `using JosephsonCircuitsOptimizer` time.

    - `workspace`: path to the working space folder. If `nothing`, defaults to `joinpath(pwd(), "working_space")`.
    - `create`: if `true`, missing folders are created.
    """
    function get_configuration(; workspace::Union{Nothing,AbstractString}=nothing, create::Bool=true)
        # Choose workspace
        WORKING_SPACE = isnothing(workspace) ? joinpath(pwd(), "working_space") : String(workspace)

        # Derived folders (kept *inside* workspace)
        user_inputs_dir = joinpath(WORKING_SPACE, "user_inputs")
        outputs_dir     = joinpath(WORKING_SPACE, "outputs")
        plot_dir        = joinpath(WORKING_SPACE, "plots")
        corr_dir        = joinpath(WORKING_SPACE, "correlation_matrix")

        if create
            mkpath(user_inputs_dir)
            mkpath(outputs_dir)
            mkpath(plot_dir)
            mkpath(corr_dir)
        end

        # Return the Configuration struct
        return Configuration(WORKING_SPACE, user_inputs_dir, outputs_dir, plot_dir, corr_dir)
    end
end