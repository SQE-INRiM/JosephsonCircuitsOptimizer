# Minimal JosephsonCircuits example: 1-port pumped JPA-like circuit
# Transposed from the user's standalone script into JCO working_space format.

function create_user_circuit(device_params_set::Dict)

    @variables R Cc Lj Cj

    circuit = [
        ("P1",  "1", "0", 1),
        ("R1",  "1", "0", R),
        ("C1",  "1", "2", Cc),
        ("Lj1", "2", "0", Lj),
        ("C2",  "2", "0", Cj)
    ]

    circuitdefs = Dict(
        Lj => device_params_set[:Lj],
        Cc => 100.0e-15,
        Cj => 1000.0e-15,
        R  => 50.0
    )

    return circuit, circuitdefs
end
