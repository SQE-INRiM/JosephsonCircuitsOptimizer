# HOW TO BUILT YOUR CIRCUIT: AN EXAMPLE

# Definition of a SNAIL-based TWPA circuit

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