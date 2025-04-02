# CircuitModule.jl
# This module contains functions related to the creation of the user-defined circuit,
# and includes the necessary user circuit definitions from an external file.

using ..Config  # Import the Config module


# Define a placeholder for the create_user_circuit function

"""
    setup_circuit(config::Configuration)

Set up the user-defined circuit using the provided configuration.
This function loads the `user_circuit.jl` file dynamically and assigns the `create_user_circuit` function.
"""
function setup_circuit(config)
    # Path to the user-defined circuit file
    user_circuit_path = joinpath(config.user_inputs_dir, "user_circuit.jl")

    if isfile(user_circuit_path)
        include(user_circuit_path)  # This loads and executes the file
    else
        error("User circuit file not found at: $user_circuit_path")
    end
end


"""
    struct Circuit

The `Circuit` struct holds information about the circuit:
- `CircuitStruct`: A vector containing the list of circuit components.
- `CircuitDefs`: A dictionary containing definitions for each component.
- `PortNumber`: An integer representing the number of ports in the circuit.

"""
struct Circuit
    CircuitStruct::Vector   # Holds the list of circuit elements (components)
    CircuitDefs::Dict       # Holds definitions of each component in the circuit
    PortNumber::Int         # The number of ports in the circuit
end

"""
    count_ports(circuitstruct)

Counts the number of ports in the given circuit structure.
Ports are defined as components whose names start with the letter "P".

# Arguments
- `circuitstruct::Vector`: The circuit structure containing the components.

# Returns
- `Int`: The number of ports in the circuit.

"""

function count_ports(circuitstruct)
    count(element -> startswith(element[1], "P"), circuitstruct)
end

"""
    create_circuit(device_params_set::Dict)

Creates a circuit object based on the user-defined circuit structure and device parameters.
This function loads the user circuit using the provided device parameters and counts the ports.

# Arguments
- `device_params_set::Dict`: A dictionary containing the device parameters for the circuit.

# Returns
- `Circuit`: A Circuit object containing the circuit structure, definitions, and port number.

"""
function create_circuit(device_params_set::Dict)
    # Load the user circuit and its definitions based on the device parameter set.
    circuitstruct, circuitdefs = Base.invokelatest(create_user_circuit, device_params_set)
    
    # Count the number of ports in the circuit structure.
    port_number = count_ports(circuitstruct)
    
    # Additional constraints or checks can be added here to validate the circuit.

    # Return the created Circuit object containing the circuit structure, definitions, and port number.
    return Circuit(circuitstruct, circuitdefs, port_number)
end

