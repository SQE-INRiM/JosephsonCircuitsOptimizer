# metric useful functions or files

# S parameters calculations-------------------------------

function S_values(S, frequency; phase::Bool=false)

    """
    S values for the frequecy. For a frequency band give the mean and the max value.
    """

    if phase == false
        S = 10 * log10.(abs2.(S))
    end

    if length(frequency) == 2
        
        a, b = frequency
        w_lb = 2*pi*a
        w_ub = 2*pi*b
        w_lb_index = argmin(abs.(sim_vars[:w_range] .- w_lb))
        w_ub_index = argmin(abs.(sim_vars[:w_range] .- w_ub))
        S_new=S[w_lb_index:w_ub_index]
        
        return maximum(S_new), mean(S_new)
    
    else
        w = frequency*2*pi
        w_index = argmin(abs.(sim_vars[:w_range] .- w))

        return S[w_index]
        
    end
    
end


