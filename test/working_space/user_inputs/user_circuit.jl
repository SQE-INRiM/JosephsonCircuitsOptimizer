# HOW TO BUILT YOUR CIRCUIT SCHEMATIC: AN EXAMPLE

function create_user_circuit(device_params_set)

    @warn "Using default cost function! Please define `create_user_circuit()` in user_inputs/user_circuit.jl"

    @variables R Cc Lj Cj

    circuitdefs = Dict(
        Lj => device_params_set[:Lj],
        Cj => device_params_set[:Cj],
        Cc => 100.0e-15,
        R => 50.0
    )


    circuitstruct = [
        ("P1","1","0",1),
        ("R1","1","0",R),
        ("C1","1","2",Cc),
        ("Lj1","2","0",Lj),
        ("C2","2","0",Cj)
    ]
    

    return circuitstruct, circuitdefs

end