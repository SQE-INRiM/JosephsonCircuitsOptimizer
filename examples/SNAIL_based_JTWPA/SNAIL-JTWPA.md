# SNAIL-JTWPA example

## Use case: A SNAIL-based JTWPA
To test the framework’s capabilities, we focus on optimizing Josephson Traveling-Wave Parametric Amplifiers (JTWPAs), nonlinear superconducting devices that amplify weak quantum signals with near-quantum-limited noise by exploiting parametric gain through Josephson junctions. Specifically, we consider a **Superconducting Nonlinear Asymmetric Inductive eLement (SNAIL)-based JTWPA** [5] operating in the three-wave mixing (3WM) regime [6]. The SNAIL-based design consists of unit cells, each containing a loop with multiple Josephson junctions and characterized by a rich set of device parameters.

A scheme of the circuit with the device parameters is presented below.

<p align="center">
    <img src="/images/SchemeSNAIL.png" alt="Scheme of the SNAIL-based JTWPA" width="800">
</p>

The SNAIL-based JTWPA consists of *N* macrocells. Each macrocell is composed of multiple single cells, collectively referred to as the *loading pitch*. Specifically, each macrocell contains *loading pitch*-1 identical cells, known as unloaded cells, and a single distinct cell, called the loaded cell. This structured design enables 3WM through dispersive engineering techniques.
Each individual cell of the SNAIL-based JTWPA consists of two parallel branches. The branches of the loaded cell are
1. The first branch contains a single small Josephson junction (JJ) characterized by a *small junction area* $A_{\text{J}}$ and a *critical current density* $ρ_{\text{Ic}}$, that toghether define the critical current $I_{\text{c}}$ of the junction.
2. The second branch consists of three larger Josephson junctions, whose areas areas are scaled according to the *alpha* α parameter of the SNAIL. Specifically, these JJs have an area of $A_{\text{J}}/α$.

Additionally, the cell is connected to ground through a gate capacitance, which value is given by the *dielectric thickness* $t$ between the capacitor plates.
The distinction between the loaded and unloaded cells is determined by two key parameters: the loading inductance $L_{\text{l}}$ and the loading capacitance $C_{\text{l}}$, which define the inductance ratio (or equivalently the $A_{\text{J}}$ ratio) and capacitance ratio between the loaded and unloaded cells.
The phase differences across the small junction and the large junctions are related to an external magnetic flux. This is given by a flux line that delivers a DC current.  

## **Running the example**

The `working_space` directory of the SNAIL-based JTWPA specifics is inside the examples/my_exp_SNAIL-JTWPA folder.
The structure is the following:

```plaintext
my_exp_SNAIL-JTWPA/
├── user_inputs/
│   ├── device_parameters_space.json
│   ├── drive_physical_quantities.json
│   ├── optimizer_config.json
│   ├── simulation_config.json
|   |
│   ├── user_circuit.jl
│   ├── user_cost_and_performance.jl
│   ├── user_parametric_sources.jl 
│   |── user_metric_utils.jl
|   |── flux_curve.txt
```

### **User inputs**

The user_inputs are presented below.

- *device_parameters_space.json*

The SNAIL parameters are defined inside specific range given by the fab constraints, including lithography resolution and deposition, and growth of thin films (e.g., Al-AlOx). The space formed by these parameters is defined insede the  `device_parameters_space.json`. An example of this file is shown below.

```plaintext
{
    "loadingpitch": { "values": [3]},
    "nMacrocells": { "values": [40] },
    "smallJunctionArea":  [0.2],
    "alphaSNAIL": { "values": [0.25, 0.23]},
    "LloadingCell": [1.5],
    "CgloadingCell": { "values": [1] },
    "criticalCurrentDensity": { "start": 1, "step": 0.5, "stop": 2},
    "CgDielectricThichness": { "start": 10, "step": 1, "stop": 11 }
}
```

- *drive_physical_quantities.json*

The frequency range in which the device is investigated and the sources are set inside the `drive_physical_quantities.json` file. The frequency range is set between 0.1 and 20 GHz. The sources are two, the first one works as the flux line, it is a CW sources ("source_1_frequency": 0) passing through the port number 3 of the circuit. The amplitude of the current of this sources depends on a device parameter which is define in the *calculate_source_1_amplitude* inside the `user_parametric_sources.jl` file.
The second source is a pump signal at 14 GHz with a small amplitude for the linear simulation, to keep it low time consuming.

```plaintext
{
    "frequency_range": { "start": 0.05e9, "step": 0.05e9, "stop": 15.0e9 },

    "source_1_on_port": 3,
    "source_1_frequency": 0,
    "source_1_linear_amplitude": "calculate_source_1_amplitude",
    "source_1_non_linear_amplitude": 212.8e-6,


    "source_2_on_port": 1,
    "source_2_frequency": 11.5e9,
    "source_2_linear_amplitude": 0.00001e-6,
    "source_2_non_linear_amplitude": { "start": 0.2e-6, "step": 0.05e-6, "stop": 0.3e-6 }

}
```

- *simulation_config.json*

In this file some functionaliity of the hbsolver function of the JosephsonCircuits.jl library are set. For the linear simulation the strong tone strong tone harmonics and the modulation harmonics are keept small to reduce the time consumption.

```plaintext
{
    "linear_strong_tone_harmonics": 1,
    "linear_modulation_harmonics": 1,
    "nonlinear_strong_tone_harmonics": 16,
    "nonlinear_modulation_harmonics": 8,
    "max_simulator_iterations": 300,
    "n_iterations_nonlinear_correction": 0
}
```

- *optimizer_config.json*

In this file the maximum number of the optimizer iterations and the sample created for every iteration in the optimization process are set.

```plaintext
{
    "max_optimizer_iterations": 3,
    "new_samples_per_optimizer_iteration": 5,
    
    "surrogate_model": "Kriging",
    "optimizer_strategy": "SRBF",
    "sampling_strategy": "random"
}

```

- *user_circuit.jl* 

The schematic of the circuit is implemented in the `user_circuit.jl` file with a lumped-element approach, following the structure presented in the JosephsonCircuits.jl library.
The *circuit* Tuple is the definition of the structure of the circuit. The *circuitdefs* is a Dict with the values of the variables used inside the circuit.
<details>

<summary>create_user_circuit</summary>

```julia
function create_user_circuit(device_params_set::Dict)

    CgDielectricK = 9.6

    #Adding important parameters
    device_params_set[:N] = device_params_set[:nMacrocells]*device_params_set[:loadingpitch] 
    device_params_set[:CgDensity] = (CgDielectricK * 8.854e-12) / (1e12 * device_params_set[:CgDielectricThichness] * 1e-9)
    device_params_set[:CgAreaUNLoaded] = 150 + 20 * (device_params_set[:smallJunctionArea] / device_params_set[:alphaSNAIL])
    
    #CIRCUIT DEFINITIONS----------------------------------------------------

    JJSmallStd = 0.0            #Tra 0.05 e 0.2             # =0 -> perfect fab , 0.1 -> 10% spread
    JJBigStd = 0.0              #Tra 0.05 e 0.2             # =0 -> perfect fab , 0.1 -> 10% spread

    nodePerCell = 4                   # Nodes per cell
    JosephsonCapacitanceDensity = 45  
    tandeltaCgDielectric = 2.1e-3     # Loss tangent of dielectric

    @variables Rleft Rright Cg Lj Cj alpha Lloading Cgloading M Ladd Lf Cf Lg

    circuitdefs = Dict(
        alpha => device_params_set[:alphaSNAIL],                       
        Lloading => device_params_set[:LloadingCell],                  
        Cgloading => device_params_set[:CgloadingCell],               
        
        Lj => IctoLj(device_params_set[:smallJunctionArea] * device_params_set[:criticalCurrentDensity] * 1e-6),  # H
        Cg => device_params_set[:CgAreaUNLoaded] * device_params_set[:CgDensity] / (1 + im * tandeltaCgDielectric),  # F
        Cj => device_params_set[:smallJunctionArea] * JosephsonCapacitanceDensity * 1e-15,  # F

        #circut parameters
        Rleft => 50.0,            # Ohm
        Rright => 50.0,           # Ohm
        Ladd => 70.0e-15,         # Henry - loop inductance
        Lg => 20.0e-9,            # Henry - geometrical inductance
        Lf => 190.0e-12,          # Henry - Flux line inductors
        Cf => 0.076e-12,          # Farad - Flux line capacitors
        M => 0.999                # inverse inductance matrix with K<1.0
    )


    #CIRCUIT STRUCTURE-------------------------------------------------------------

    circuit = Tuple{String,String,String,Num}[]

    # Port on the input side of the AC line
    push!(circuit,("P$(1)_$(0)","1","0", 1))
    push!(circuit,("R$(1)_$(0)","1","0",Rleft))

    rngSmall1 = MersenneTwister(1);
    randomSeedSmall1 = 1 + JJSmallStd*randn(rngSmall1, Float64)
    rngBig1 = MersenneTwister(1);
    randomSeedBig1 = 1 + JJBigStd*randn(rngBig1, Float64)

    #AC line---------------------------------------------------
    #first cell------------------------------------------------

    #first half capacitance to ground
    push!(circuit,("C$(0)_$(1)","0","1",Cg/2))
    push!(circuit,("Lj$(1)_$(2)","1","2",alpha*Lj*randomSeedBig1))                          # First big JJ inductance 
    push!(circuit,("C$(1)_$(2)","1","2",Cj/(alpha*randomSeedBig1)))                         # First big JJ capacitance 
    push!(circuit,("Lj$(2)_$(3)","2","3",alpha*Lj*randomSeedBig1))                          # Second big JJ inductance 
    push!(circuit,("C$(2)_$(3)","2","3",Cj/(alpha*randomSeedBig1)))                         # Second big JJ capacitance 
    push!(circuit,("Lj$(3)_$(5)","3","5",alpha*Lj*randomSeedBig1))                          # Third big JJ inductance 
    push!(circuit,("C$(3)_$(5)","3","5",Cj/(alpha*randomSeedBig1)))                         # Third big JJ capacitance 

    push!(circuit,("Lj$(1)_$(4)","1","4",Lj*randomSeedSmall1))                              # Small JJ inductance 
    push!(circuit,("C$(1)_$(4)","1","4",Cj/(randomSeedSmall1)))                             # Small JJ capacitance 

    push!(circuit,("L$(4)_$(5)","4","5",Ladd))                                              # Loop inductance for flux bias

    N=round(Int, device_params_set[:N])
    loadingpitch=round(Int, device_params_set[:loadingpitch])

    j=nodePerCell+1

    for i = 2:N
        
        local rngSmall = MersenneTwister(i+1);
        local randomSeedSmall1 = 1+JJSmallStd*randn(rngSmall, Float64)
        local rngBig1 = MersenneTwister((i+1)*j+1);
        local randomSeedBig1 = 1+JJBigStd*randn(rngBig1, Float64)

        if mod(i,loadingpitch)+1 == loadingpitch÷2            

            #make the loaded cell
            push!(circuit,("C$(0)_$(j)","$(0)","$(j)",Cgloading*Cg))                                                    # Capacitance to ground
            push!(circuit,("Lj$(j+0)_$(j+1)","$(j+0)","$(j+1)",Lloading*alpha*Lj*randomSeedBig1))                           # First big JJ inductance 
            push!(circuit,("C$(j+0)_$(j+1)","$(j+0)","$(j+1)",((1/Lloading)*Cj)/(alpha*randomSeedBig1)))                    # First big JJ capacitance 
            push!(circuit,("Lj$(j+1)_$(j+2)","$(j+1)","$(j+2)",Lloading*alpha*Lj*randomSeedBig1))                       # Second big JJ inductance 
            push!(circuit,("C$(j+1)_$(j+2)","$(j+1)","$(j+2)",((1/Lloading)*Cj)/(alpha*randomSeedBig1)))                # Second big JJ capacitance 
            push!(circuit,("Lj$(j+2)_$(j+4)","$(j+2)","$(j+4)",Lloading*alpha*Lj*randomSeedBig1))                       # Third big JJ inductance 
            push!(circuit,("C$(j+2)_$(j+4)","$(j+2)","$(j+4)",((1/Lloading)*Cj)/(alpha*randomSeedBig1)))                # Third big JJ capacitance 

            push!(circuit,("Lj$(j)_$(j+3)","$(j)","$(j+3)",Lloading*Lj*randomSeedSmall1))                               # Small JJ inductance 
            push!(circuit,("C$(j)_$(j+3)","$(j)","$(j+3)",((1/Lloading)*Cj)/randomSeedSmall1))                          # Small JJ capacitance 
        
            push!(circuit,("L$(j+3)_$(j+4)","$(j+3)","$(j+4)",Ladd))                                                    # Loop inductance for flux bias

        else

            # make the unloaded cell
            push!(circuit,("C$(0)_$(j)","$(0)","$(j)",Cg))                                                              #capacitance to ground
            push!(circuit,("Lj$(j+0)_$(j+1)","$(j+0)","$(j+1)",alpha*Lj*randomSeedBig1))                                    # First big JJ inductance 
            push!(circuit,("C$(j+0)_$(j+1)","$(j+0)","$(j+1)",Cj/(alpha*randomSeedBig1)))                                   # First big JJ capacitance 
            push!(circuit,("Lj$(j+1)_$(j+2)","$(j+1)","$(j+2)",alpha*Lj*randomSeedBig1))                                # Second big JJ inductance 
            push!(circuit,("C$(j+1)_$(j+2)","$(j+1)","$(j+2)",Cj/(alpha*randomSeedBig1)))                               # Second big JJ capacitance 
            push!(circuit,("Lj$(j+2)_$(j+4)","$(j+2)","$(j+4)",alpha*Lj*randomSeedBig1))                                # Third big JJ inductance 
            push!(circuit,("C$(j+2)_$(j+4)","$(j+2)","$(j+4)",Cj/(alpha*randomSeedBig1)))                               # Third big JJ capacitance 

            push!(circuit,("Lj$(j)_$(j+3)","$(j)","$(j+3)",Lj*randomSeedSmall1))                                        # Small JJ inductance 
            push!(circuit,("C$(j)_$(j+3)","$(j)","$(j+3)",Cj/randomSeedSmall1))                                         # Small JJ capacitance 
        
            push!(circuit,("L$(j+3)_$(j+4)","$(j+3)","$(j+4)",Ladd))                                                    # Loop inductance for flux bias

        end

        # increment the index
        j = j+nodePerCell

    end

    #last cell
    push!(circuit,("C$(0)_$(j)","$(0)","$(j)",Cg/2))
    push!(circuit,("R$(0)_$(j)","$(0)","$(j)",Rright))

    #AC port on the output side
    push!(circuit,("P$(0)_$(j)","$(0)","$(j)", 2))
    
    #END AC line--------------------------------------------------------------------------------------

    #DC line------------------------------------------------------------------------------------------

    # port on the input side of the DC line
    dcOffs = nodePerCell*N+2+1
    push!(circuit,("P$(dcOffs+1)_$(0)","$(dcOffs+1)","$(0)",3))
    push!(circuit,("R$(dcOffs+1)_$(0)","$(dcOffs+1)","$(0)",Rleft))

    #first cell---------------------------------------------------------------------------------------
    push!(circuit,("C$(dcOffs+1)_$(0)","$(dcOffs+1)","$(0)",Cf/2))                                          #DC line capacitance in the first cell
    push!(circuit,("L$(dcOffs+1)_$(dcOffs+2)","$(dcOffs+1)","$(dcOffs+2)",Lf))                              #DC line inductance in the first cell
    push!(circuit,("K$(1)_$(1)","L$(4)_$(5)","L$(dcOffs+1)_$(dcOffs+2)",M))                          #mutual inductance between loop inductance and DC line
    
    for i = 2:N
        #DC line
        push!(circuit,("C$(dcOffs+i)_$(0)","$(dcOffs+i)","$(0)",Cf))                                        #DC line capacitance
        push!(circuit,("L$(dcOffs+i)_$(dcOffs+i+1)","$(dcOffs+i)","$(dcOffs+i+1)",Lf))                      #DC line inductance
        #AC-DC mutual coupling
        push!(circuit,("K$(i)_$(i)","L$(i*nodePerCell)_$(i*nodePerCell+1)","L$(dcOffs+i)_$(dcOffs+i+1)",M)) #mutual inductance between loop inductance and DC line (equal for each cell)    
    end

    #DC port on the output side
    push!(circuit,("P$(dcOffs+1+N)_$(0)","$(dcOffs+1+N)","$(0)",4))
    push!(circuit,("L$(dcOffs+1+N)_$(0)","$(dcOffs+1+N)","$(0)",Lg))
    push!(circuit,("C$(dcOffs+1+N)_$(0)","$(dcOffs+1+N)","$(0)",Cf/2))    
    push!(circuit,("R$(dcOffs+1+N)_$(0)","$(dcOffs+1+N)","$(0)",Rright))

    #END DC line--------------------------------------------------------------------------------------
 
    return circuit, circuitdefs

end
```
</details>


- *user_cost_and_performance.jl*

The **device-specific metric** is defined inside the *user_cost* function and depends on the S-parameters of the linear simulation. It is possible to implement a mask to exclude some configurations. In this example the metric is defined to ensures impedance and phase matching based on the dispersion relation.

<details>

<summary>user_cost</summary>

```julia
function user_cost(S, Sphase, device_params_set::Dict, delta_correction)

    println("-----------------------------------------------------")

    # USER CONDITION-------------------------------------------------

    maxS11band, meanS11band = S_values(S[(1,1)], [6e9,8e9])

    S11pump = S_values(S[(1,1)], 14e9)
    S21pump = S_values(S[(2,1)], 14e9)

    S21phaseBand = S_values(Sphase[(2,1)], 7e9; phase=true)
    S21phasePump = S_values(Sphase[(2,1)], 14e9; phase=true)

    deltaK = abs((S21phasePump-2*S21phaseBand)/device_params_set[:N])

    #----------------------------------------------------------------
    
    # MASK (if necessary)

    input_mask = (
        meanS11band = meanS11band,
        S11pump     = S11pump,
        S21pump     = S21pump,
        deltaK      = deltaK
    )

    conditions_mask = x -> x.meanS11band < -20 && x.S11pump < -10 && x.S21pump > -4 && x.deltaK < 0.15

    # Apply the mask
    if mask(input_mask, conditions_mask) return 1e8 end 
    
    #---------------------------------------------------------------

    # METRIC DEFINITION
    
    metric = (1e2/(abs(maxS11band)))
    
    return metric
        
end
```

</details>
#di anche di plot_update()
Some functions useful for the metric and performance definitions are implemented inside the `user_metric_utils.jl` file. In this case the function *S_values* that extract the value of the S parameters at a define frequency is define there. 

The **targeted performance** is defined inside the *user_performance* function and depends on the solution of the hbsolve function of the nonlinear simulation.
In our case the performance is define to achieve a broadband gain profile.

<details>

<summary>user_performance</summary>

```julia
function user_performance(sol, device_params_set)

    S21 = sol.linearized.S((0,),2,(0,),1,:)
    gain_S21 = S_to_dB(S21)

    gain_band = S_values(gain_S21, [4.75e9,6.75e9])
    gain_val = mean(gain_band)
    println("Gain in the band [4.75, 6.75] GHz: ", gain_val)

    p = plot_gain(gain_S21)
    plot_update(p)
    
    return gain_val

end
```
</details>

The code allows to iteratively compute the simulation and optimization process to compensate for dynamic effects such as Kerr nonlinearity.
Inside the *user_delta_correction* function you can define this quantity.

<details>

<summary>user_delta_quantity</summary>

```julia
function user_delta_quantity(S, Sphase, device_params_set)

    S21phaseBand = S_values(Sphase[(2,1)], 5.75e9)
    S21phasePump = S_values(Sphase[(2,1)], 11.5e9)

    length = device_params_set[:N]
    deltaK = (S21phasePump-2*S21phaseBand)/length

    return deltaK
    
end
```
</details>

- *user_parametric_sources.jl*

In this case the amplitude of the source 1, that represent the flux line of the JTWPA, depends on the alpha value of the SNAIL to achieve the optimal 3WM of the device. The relation between the alpha and the flux values is reported inside the `flux_curve.txt` file. In this file is defined this parametric value from the txt file.

<details>

<summary>user_parametric_sources</summary>

```julia
using ..Config

path = joinpath(config.user_inputs_dir, "flux_curve.txt") 
lines = readlines(path)
alpha_flux_map = map(line -> round(parse(Float64, split(line, ",")[1]), digits=2), lines)
flux_map = map(line -> round(parse(Float64, split(line, ",")[2]), digits=2), lines)
global interp_alpha_flux = linear_interpolation(alpha_flux_map, flux_map, extrapolation_bc=Flat())

function find_flux_from_alpha(alpha)
    return interp_alpha_flux(alpha)
end

function calculate_source_1_amplitude(device_params_set::Dict)
    phidc = find_flux_from_alpha(device_params_set[:alphaSNAIL]) 
    source_1_amplitude = phidc * (2 * 280 * 1e-6)
    return source_1_amplitude
end
```
</details>

Note that to join the correct path you have to import the correct directory: config.user_inputs_dir.


### **Outputs**

The outputs are presented below.

- *optimal_device_parameters.json*

This file contains the optimal parameters of the device, selected after the optimization process. The structure of the file is the following.

```plaintext
{
    "header": {
        "optimal_metric": 7.283064829606954,
        "description": "Optimal parameters for the model"
    },
    "data": {
        "CgloadingCell": 1.0,
        "loadingpitch": 3.0,
        "smallJunctionArea": 1.0,
        "criticalCurrentDensity": 0.9,
        "nMacrocells": 40.0,
        "CgDielectricThichness": 80.0,
        "LloadingCell": 2.0,
        "alphaSNAIL": 0.25
    }
}
```

- *optimal_physical_quantities.json*

In this file there are the optimal physical quantities for the choosen device after the nonlinear simulation. The stucture is shown below.

```plaintext
{
    "header": {
        "description": "Optimal physical quantities (working point) of the circuit"
    },
    "data": {
        "source_1_on_port": 3,
        "source_1_frequency": 0,
        "source_1_amplitude": 5.6e-6, 
        "source_2_on_port": 1,
        "source_2_frequency": 1.4e10,
        "source_2_amplitude": 0.1e-6
    }
}
```
