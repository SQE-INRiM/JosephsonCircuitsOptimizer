# metric useful functions or files

# S parameters calculations-------------------------------

S_to_dB(S) = 10 * log10.(abs2.(vec(Array(S))))

function S_values(S, frequency)

    """
    S values for the selected frequecies.
    """

    S = vec(Array(S))

    if length(frequency) == 2
        
        a, b = frequency
        w_lb = 2*pi*a
        w_ub = 2*pi*b
        w_lb_index = argmin(abs.(sim_vars[:w_range] .- w_lb))
        w_ub_index = argmin(abs.(sim_vars[:w_range] .- w_ub))
        
        return S[w_lb_index:w_ub_index]
    
    else
        w = frequency*2*pi
        w_index = argmin(abs.(sim_vars[:w_range] .- w))

        return S[w_index]
        
    end
    
end




function angles_calculations(Sphase, len)

    #alpha lin
    y_lin = -S_values(Sphase[(2,1)], [0.05e9, 0.5e9]) / len

    x1_idx = findfirst(x -> x == 0.05e9, sim_vars[:frequency_range])
    x2_idx = findfirst(x -> x == 0.5e9, sim_vars[:frequency_range])
    x_lin = sim_vars[:frequency_range][x1_idx:x2_idx]

    n = length(x_lin)
    X = [ones(n) x_lin] # Add a column of ones for the intercept

    beta = X \ y_lin # Solves for [intercept, slope]
    m_lin = beta[2]
    alpha_lin = atan(m_lin) 


    #alpha nonlin
    y_nonlin = -S_values(Sphase[(2,1)], [11.5e9, 12e9]) / len

    x1_idx = findfirst(x -> x == 11.5e9, sim_vars[:frequency_range])
    x2_idx = findfirst(x -> x == 12e9, sim_vars[:frequency_range])
    x_nonlin = sim_vars[:frequency_range][x1_idx:x2_idx]

    n = length(x_nonlin)
    X = [ones(n) x_nonlin] # Add a column of ones for the intercept

    beta = X \ y_nonlin # Solves for [intercept, slope]
    m_nonlin = beta[2]
    alpha_nonlin = atan(m_nonlin) 
    

    #stopband line
    y_stopband = -S_values(Sphase[(2,1)], [10.7e9, 11.45e9]) / len

    x1_idx = findfirst(x -> x == 10.7e9, sim_vars[:frequency_range])
    x2_idx = findfirst(x -> x == 11.45e9, sim_vars[:frequency_range])
    x_stopband = sim_vars[:frequency_range][x1_idx:x2_idx]

    n = length(x_stopband)
    X = [ones(n) x_stopband] # Add a column of ones for the intercept

    beta = X \ y_stopband # Solves for [intercept, slope]
    m_stopband = beta[2]
    alpha_stopband = atan(m_stopband) 
    
    return alpha_lin, alpha_nonlin, alpha_stopband

end


function plot_dispersion_relation(S21phase, device_params_set)


    p = plot(
        sim_vars[:frequency_range]/1e9,
        -S21phase / device_params_set[:N],
        xlabel=L"f / GHz",
        ylabel= L"k / \mathrm{rad} \cdot \mathrm{cells}^{-1}",
        title="Dispersion relation",
        ylim=(0.0, 1.5),
        legend=true,
        colorbar=true,
        label="",
        framestyle=:box,
        size = (800, 600)
    )

    P.vline!(p, [sim_vars[:source_2_frequency]/1e9], width=2, color=:black, label="")
    P.vline!(p, [(1 / 2) * sim_vars[:source_2_frequency]/1e9], width=2, style=:dash, color=:gray, label="")
    P.vline!(p, [((sim_vars[:source_2_frequency]/2)-1e9)/1e9], width=2, color=:darkblue, label="")
    P.vline!(p, [((sim_vars[:source_2_frequency]/2)+1e9)/1e9], width=2, color=:darkblue, label="")

    return p

end

function plot_gain(gain)

    p = plot(
        sim_vars[:frequency_range]/1e9,
        gain,
        xlabel=L"f / GHz",
        ylabel= L"dB",
        title="Gain (S21)",
        label="",
        framestyle=:box,
        size = (800, 600)
    )
    
    P.vline!(p, [sim_vars[:source_2_frequency]/1e9], width=2, color=:black, label="")
    P.vline!(p, [(1 / 2) * sim_vars[:source_2_frequency]/1e9], width=2, style=:dash, color=:gray, label="")
    P.vline!(p, [((sim_vars[:source_2_frequency]/2)-1e9)/1e9], width=2, color=:darkblue, label="")
    P.vline!(p, [((sim_vars[:source_2_frequency]/2)+1e9)/1e9], width=2, color=:darkblue, label="")

    return p

end


"""
function derivative_low_pump(Sphase, len)    

    y = - Sphase[(2,1)] / len
    x = sim_vars[:frequency_range]

    window_size = 27 #27 # Must be odd
    poly_order = 3
    y_der2_sg = savitzky_golay(y[:,1], window_size, poly_order, deriv=2, rate=100)

    #---------------------------------------------------------------------------

    # Finding max peaks

    y = y_der2_sg.y

    
    #Finding min --> ci interessa il max ma il primo min è piu sensibile

    pkindices, properties = findpeaks1d(-y; 
    height=1,             # Minimum peak height
    prominence=0.01,        # Minimum prominence of peaks
    width=1.0,             # Minimum width of peaks
    relheight=0.5           # Relative height to determine peak edges
    )

    x_mins = x[pkindices]
    y_mins = y[pkindices]
    scatter!(p_sg_der2, x_mins, y_mins, color="blue", markersize=2, label="Min")

    #println("xmins: ", x_mins)
    first_x_min = isempty(x_mins) ? 0 : x_mins[1]
    #println("first_x_min ", first_x_min)

    # Finding max
    pkindices, properties = findpeaks1d(y; 
    height=2,             # Minimum peak height
    prominence=0.01,        # Minimum prominence of peaks
    width=1.0,             # Minimum width of peaks
    relheight=0.5           # Relative height to determine peak edges
    )

    x_maxs = x[pkindices]
    y_maxs = y[pkindices]


    function find_first_peak(x_maxs, y_maxs, first_x_min)
        if first_x_min == 0
            return 0, 0
        end
        for (x_max, y_max) in zip(x_maxs, y_maxs)
            if x_max > first_x_min 
                return x_max, y_max
            end
        end
        return 0,0  # Return nothing if no peak is found
    end

    x_peak_sb, y_peak_sb = find_first_peak(x_maxs, y_maxs, first_x_min)
    #println(x_peak_sb)
    #println(y_peak_sb)

    x_pump = findfirst(x -> x == 11.5e9, sim_vars[:frequency_range])
    #println("x_pump", x_pump)

    return x_peak_sb, x_pump

end
"""