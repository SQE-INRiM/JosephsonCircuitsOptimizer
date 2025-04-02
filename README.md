# JosephsonCircuitOptimizer.jl

[JosephsonCircuitOptimizer.jl](https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer) is a Julia package that provides a simulation framework developed using the [JosephsonCircuits.jl](https://github.com/kpobrien/JosephsonCircuits.jl) library [1], which is a powerful tool enables the modeling of superconducting circuits, including Josephson junctions and other nonlinear elements, within a lumped-element approach. It leverages harmonic balance [2], a frequency-domain technique that offers a computationally efficient alternative to traditional time-domain simulations [3].

The [JosephsonCircuitOptimizer.jl](https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer) package explores a vast range of circuit designs by combining different device parameters and applying Bayesian optimization with Gaussian processes [4]. This optimization process is driven by a device-specific metric, guiding the search for optimal circuit parameters to achieve the desired performance.

## **Installation**

To install the package, run the following command in Julia:

```julia
using Pkg
Pkg.add(path="https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer")
```

This will download and install the package directly from GitHub.

The package requires an external *working space*. If a folder named *working_space* does not exist in your working directory, it will be created automatically. You **must** use this folder to run the package properly. The structure of *working_space* is shown below.

Once installed the package and the *working_space* folder is set up, you can load and use the package with:

```julia
import JosephsonCircuitOptimizer as JCO 
JCO.run()
```



## **How It Works**

To use the [JosephsonCircuitOptimizer.jl](https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer) framework, several inputs must be defined. 
- The **device parameters space** describes the physical parameters that define the circuit's design for fabrication. Each combination of these parameters represents a different circuit in the framework that toghether define a uniform sampling. This space is typically set by fabrication constrains.
- The **physical quantities** define the frequency range and the various signals within the circuit, such as the strong pump tones.
- The **device-specific metric** is a function used to weight every circuit configuration, defined by a set of device parameters. 
- The **targeted performance** is the function that set the optimal working point given by precise physical quantities.

### **Simulation and Optimization Process**
The workflow consists of three main steps:

1. **Linear Simulations:**
   - The first step provides linear simulations, in which selected circuits are analyzed at low pump power.
   - Simulations are conducted for the different circuits of the uniform sampling defined by the different sets of parameters inside the device parameters space.
   - A device-specific metric is computed for each circuit configuration.

2. **Bayesian Optimization:**
   - A Bayesian optimization process, based on Gaussian processes, is performed.
   - The parameters space is iteratively refined to minimize the device-specific metric.
   - At the end of this step, an optimal set of device parameters is determined, defining the circuit structure.

3. **Nonlinear Simulations:**
   - The final step involves nonlinear simulation, in which the circuit is driven at high pump power.
   - This step requires significant computational resources and aims to fine-tune physical quantities to maximize targeted performance (e.g., optimal gain profile).
   - The result is the optimal operating point for the fixed circuit configuration.

<p align="center">
    <img src="images/framework.png", alt = "Framework scheme">
</p>

### **Working space structure**

[JosephsonCircuitOptimizer.jl](https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer) operates within an external **working space** containing specific files. These files must be placed inside a folder named `working_space` within the working directory.
The `working_space/user_inputs` folder should contain the following files:
-  `device_parameters_space.json` which contains the device parameters space to define the circuit design. 
-  `drive_physical_quantities.json` in which you define the frequency range and sources features.
-  `optimizer_config.json` with some configuarion of the optimization process.
-  `simulation_config.json` with some configuarion of the simulation process.

-  `user_circuit.jl` in which the circuit schematic is defined with a lumped-element approach.
-  `user_cost_and_performance.jl` with the definition of the device-specific metric and the desired performan functions.
-  `user_parametric_sources.jl` (optional). Some sources can have a parametric input that depends on device parameters. It is possible to create a file which connect the sources with these parameters.

Simulation outputs are saved in `working_space/outputs/output_YYYY-MM-DD_hh-mm-ss`, where the following files are generated:

- `optimal_device_parameters.json` with the optimal set of device parameters that define the circuit structure. 
- `optimal_physical_quantities.json` with the optimal physical quantities (working point) of the circuit structure.


In summary, the structure of the **working space** is the following:
```plaintext
working_space/
├── user_inputs/
│   ├── device_parameters_space.json
│   ├── drive_physical_quantities.json
│   ├── optimizer_config.json
│   ├── simulation_config.json
|   |
│   ├── user_circuit.jl
│   ├── user_cost_and_performance.jl
│   ├── user_parametric_sources.jl 
|
├── outputs/
│   ├── output_YYYY-MM-DD_hh-mm-ss/
│   │   ├── optimal_device_parameters.json
│   │   ├── optimal_physical_quantities.json
```


# **Use case: A SNAIL-based JTWPA**
To test the framework’s capabilities, we focus on optimizing Josephson Traveling-Wave Parametric Amplifiers (JTWPAs), nonlinear superconducting devices that amplify weak quantum signals with near-quantum-limited noise by exploiting parametric gain through Josephson junctions. Specifically, we consider a **Superconducting Nonlinear Asymmetric Inductive eLement (SNAIL)-based JTWPA** [5] operating in the three-wave mixing (3WM) regime [6]. The SNAIL-based design consists of unit cells, each containing a loop with multiple Josephson junctions and characterized by a rich set of device parameters.

A scheme of the circuit with the device parameters is presented below.

<p align="center">
    <img src="images/SchemeSNAIL.png", alt = "Scheme of the SNAIL-based JTWPA">
</p>

The SNAIL-based JTWPA consists of *N* macrocells. Each macrocell is composed of multiple single cells, collectively referred to as the *loading pitch*. Specifically, each macrocell contains *loading pitch*-1 identical cells, known as unloaded cells, and a single distinct cell, called the loaded cell. This structured design enables 3WM through dispersive engineering techniques.
Each individual cell of the SNAIL-based JTWPA consists of two parallel branches. The branches of the loaded cell are
1. The first branch contains a single small Josephson junction (JJ) characterized by a *small junction area* $A_{\text{J}}$ and a *critical current density* $ρ_{\text{Ic}}$, that toghether define the critical current $I_{\text{c}}$ of the junction.
2. The second branch consists of three larger Josephson junctions, whose areas areas are scaled according to the *alpha* α parameter of the SNAIL. Specifically, these JJs have an area of $A_{\text{J}}/α$.

Additionally, the cell is connected to ground through a gate capacitance, which value is given by the *dielectric thickness* $t$ between the capacitor plates.
The distinction between the loaded and unloaded cells is determined by two key parameters: the loading inductance $L_{\text{l}}$ and the loading capacitance $C_{\text{l}}$, which define the inductance ratio (or equivalently the $A_{\text{J}}$ ratio) and capacitance ratio between the loaded and unloaded cells.
The phase differences across the small junction and the large junctions are related to an external magnetic flux. This is given by a flux line that delivers a DC current.  

## **Running the example**

To try the package, download the `working_space` folder from the repository and place it in your working directory.

To try the package, you need to use the `working_space` folder created during installation.  

You can find example scripts in the `examples/SNAIL-based JTWPA` folder. To use the provided example `working_space`, copy its contents into your existing `working_space` directory:  

```sh
cp -r examples/SNAIL-based\ JTWPA/working_space/* working_space/
```


You can find example scripts in the `examples/SNAIL-based JTWPA` folder, you can download it here: [Download working_space.zip](https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer/tree/main/examples/SNAIL-based%20JTWPA/working_space.zip?download=).
IMPORTANT: remember to use the working_space created when the package is installed.

Unzip the folder and place it in your working directory. If you have already install the package, you can run: 
```julia
import JosephsonCircuitsOptimizer as JCO 
JCO.run()
```

##  **The SNAIL-based JTWPA working space**

The **working space** is presented in the example section. It is composed by

```plaintext
working_space/
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

The user_inputs are presented below.

- *device_parameters_space.json*

The SNAIL parameters are defined inside specific range given by the fab constraints, including lithography resolution and deposition, and growth of thin films (e.g., Al-AlOx). The space formed by these parameters is defined insede the  `device_parameters_space.json`. An example of this file is shown below.

```plaintext
{
    "loadingpitch": [3],
    "nMacrocells": [40],
    "smallJunctionArea": { "start": 1, "step": 1, "stop": 2 },
    "alphaSNAIL": [0.25],
    "LloadingCell": { "start": 1.5, "step": 0.5, "stop": 2 },
    "CgloadingCell": { "start": 1, "step": 0.5, "stop": 1.5 },
    "criticalCurrentDensity": { "start": 0.9, "step": 0.1, "stop": 1 },
    "CgDielectricThickness": { "start": 79, "step": 1, "stop": 80 }
}
```

- *drive_physical_quantities.json*

The frequency range in which the device is investigated and the sources are set inside the `drive_physical_quantities.json` file. The frequency range is set between 0.1 and 20 GHz. The sources are two, the first one works as the flux line, it is a CW sources ("source_1_frequency": 0) passing through the port number 3 of the circuit. The amplitude of the current of this sources depends on a device parameter which is define in the *calculate_source_1_amplitude* inside the `user_parametric_sources.jl` file.
The second source is a pump signal at 14 GHz with a small amplitude for the linear simulation, to keep it low time consuming.

```plaintext
{
    "frequency_range": { "start": 0.1e9, "step": 0.1e9, "stop": 20.0e9 },

    "source_1_on_port": 3,
    "source_1_frequency": 0,
    "source_1_linear_amplitude": "calculate_source_1_amplitude",
    "source_1_non_linear_amplitude": { "start": 0, "step": 5.6e-6, "stop": 5.6e-6 },

    "source_2_on_port": 1,
    "source_2_frequency": 14e9,
    "source_2_linear_amplitude": 0.00001e-6,
    "source_2_non_linear_amplitude": { "start": 0, "step": 0.1e-6, "stop": 0.1e-6 }

}
```

- *simulation_config.json*

In this file some functionaliity of the hbsolver function of the JosephsonCircuit.jl library are set. For the linear simulation the strong tone strong tone harmonics and the modulation harmonics are keept small to reduce the time consumption.

```plaintext
{
    "linear_strong_tone_harmonics": 1,
    "linear_modulation_harmonics": 1,
    "nonlinear_strong_tone_harmonics": 8,
    "nonlinear_modulation_harmonics": 4,
    "max_simulator_iterations": 500
}
```

- *optimizer_config.json*

In this file the maximum number of the optimizer iterations and the sample created for every iteration in the optimization process are set.

```plaintext
{
    "max_optimizer_iterations": 3,
    "new_samples_per_optimizer_iteration": 5
}
```

- *user_circuit.jl* 

The schematic of the circuit is implemented in the `user_circuit.jl` file, following the structure presented in the JosephsonCircuit.jl library. In our case the circuit is the following.
The *circuit* Tuple is the definition of the structure of the circuit. The *circuitdefs* is a Dict with the values of the variables used inside the circuit.

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

- *user_cost_and_performance.jl*

The **device-specific metric** is defined inside the *user_cost* function and depends on the S parameters of the linear simulation. It is possible to implement a mask to exclude some configurations. In this example the metric is defined to ensures impedance and phase matching based on the dispersion relation.

```julia
function user_cost(S, Sphase, device_params_set::Dict)

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
Some functions useful for the metric and performance definitions are implemented inside the `user_metric_utils.jl` file. In this case the function *S_values* that extract the value of the S parameters at a define frequency is define there. 

The **targeted performance** is defined inside the *user_performance* function and depends on the solution of the hbsolve function of the nonlinear simulation.
In our case the performance is define to achieve a broadband gain profile.

```julia
function user_performance(sol)
    num_k = length(sim_vars[:source_1_non_linear_amplitude])
    num_j = length(sim_vars[:source_2_non_linear_amplitude])

    best_max_value = -Inf
    best_k = 0
    best_j = 0

    # Iterate over all combinations of k and j
    for (k, j) in Iterators.product(1:num_k, 1:num_j)

        # Extract solutions for all frequencies for the combination (k, j)
        sol_kj = sol[:, k, j]  # This should be an array or vector

        # Extract and convert S21 values for all frequencies
        S21_values = [s_kj.linearized.S((0,), 2, (0,), 1, :) for s_kj in sol_kj]
        
        # Debugging: Check type and values of S21_values
        println("S21_values ", typeof(S21_values))
        
        # Convert S21 values to an array and compute maximum absolute value
        max_val = maximum(abs.(reduce(vcat, S21_values)))  # Flatten and compute max

        # Update best maximum value and combination
        if max_val > best_max_value
            best_max_value = max_val
            best_k = k
            best_j = j
        end
    end

    # Extract the best amplitudes based on best_k and best_j
    best_source_1_amplitude = sim_vars[:source_1_non_linear_amplitude][best_k]
    best_source_2_amplitude = sim_vars[:source_2_non_linear_amplitude][best_j]

    # Output the results
    println("Best combination: k = $best_k, j = $best_j")
    println("Best source 1 amplitude: $best_source_1_amplitude")
    println("Best source 2 amplitude: $best_source_2_amplitude")
    println("Best max value: $best_max_value")

    return [best_source_1_amplitude, best_source_2_amplitude]

end
```
The simulation parameters inside the `drive_physical_quantities.json`, `simulation_config.json` and `optimizer_config.json` are accessible to the dictionary sim_vars.

- *user_parametric_sources.jl*

In this case the amplitude of the source 1, that represent the flux line of the JTWPA, depends on the alpha value of the SNAIL to achieve the optimal 3WM of the device. The relation between the alpha and the flux values is reported inside the `flux_curve.txt` file. In this file is defined this parametric value from the txt file.

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

Note that to join the correct path you have to import the correct directory: config.user_inputs_dir.

# **License:**
This project is licensed under the [MIT License](LICENSE.md).

# **References:**
1. K. P. O'Brien and Contributors, JosephsonCircuits.jl, GitHub, 2024. [Online]. Available: https://github.com/kpobrien/JosephsonCircuits.jl
2. S. A. Maas, "Chapter 3," in Nonlinear Microwave and RF Circuits, 2nd ed. Norwood, MA, USA: Artech House, 1997, pp. 119–212.
3. A. Yu. Levochkina et al., "Numerical simulations of Josephson traveling wave parametric amplifiers (JTWPAs): Comparative study of open-source tools," IEEE Transactions on Applied Superconductivity, vol. 34, no. 3, pp. 1–6, May 2024, doi: 10.1109/TASC.2024.3364125.
4. R. Garnett, Bayesian Optimization. Cambridge, U.K.: Cambridge University Press, 2023, pp. 15–44, doi: 10.1017/9781108348973.003.
5. N. E. Frattini et al., "Three-wave mixing Josephson dipole element," Appl. Phys. Lett., vol. 110, no. 22, p. 222603, May 2017, doi: 10.1063/1.4984142.
6. A. B. Zorin, "Josephson traveling-wave parametric amplifier with three-wave mixing," Phys. Rev. Applied, vol. 6, p. 034006, Sep. 2016, doi: 10.1103/PhysRevApplied.6.034006.
