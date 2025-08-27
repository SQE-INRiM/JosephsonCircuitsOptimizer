function safe_standardize(column)
    # Check if the column is constant
    if length(unique(column)) == 1
        return fill(0.0, length(column))  # Set constant column to zero
    else
        return (column .- mean(column)) ./ std(column)  # Standardize otherwise
    end
end


# Define a consistent style for all plots
function apply_style!(ax)
    ax.titlesize = 24
    ax.xlabelsize = 19
    ax.ylabelsize = 19
    ax.xticklabelsize = 18
    ax.yticklabelsize = 18
end


INRIM_blue = RGB(34/256,73/256,104/256)
INRIM_yellow = RGB(224/256,195/256,33/256)


# Function to visualize the correlation matrix
function visualize_correlation_matrix(fig, df)

    if isempty(df)
        error("The input DataFrame is empty. Please provide a non-empty DataFrame.")
    end 
    
    df = select(df, Not([:metric]))

    # Remove constant columns (columns where all values are the same)
    non_constant_cols = [col for col in names(df) if length(unique(df[!, col])) > 1]
    df = df[!, non_constant_cols]

    standardized_df = mapcols(safe_standardize, df)

    # Replace NaNs with 0 after computing the correlation matrix
    cor_matrix = cor(Matrix(standardized_df))
    cor_matrix[isnan.(cor_matrix)] .= 0

    col_names = names(df)  # Column names for labeling

    ax = Axis(fig[1, 1]; 
        title = "Correlation Matrix", 
        xticks = (1:length(col_names), col_names),  # X-axis labels
        yticks = (1:length(col_names), col_names),  # Y-axis labels
        xticklabelrotation = π / 4  # Rotate labels for readability
    )
    apply_style!(ax)  # Apply consistent style

    # Create heatmap with the custom colormap
    colormap = cgrad([INRIM_blue, RGB(1,1,1),  INRIM_yellow])
    hm = heatmap!(ax, cor_matrix, colormap = colormap, colorrange = (-1, 1))

    # Add colorbar with label
    Colorbar(fig[1, 2], hm, label = "Correlation", labelsize = 22, ticklabelsize = 18, width = 20)
end


function plot_1d_density_heatmap(fig, df)

    if isempty(df)
        error("The input DataFrame is empty. Please provide a non-empty DataFrame.")
    end 

    metric = df.metric
    df = select(df, Not([:metric]))

    col_names = names(df)  # Get column names
    heatmaps = []  # Store heatmaps for colorbar reference

    # Create a grid layout for the 1D density heatmaps
    grid = fig[2, 1] = GridLayout()

    for (i, col) in enumerate(col_names)
        println("\nColumn: ", col)
        ax = Axis(grid[1, i], 
                  xlabel = "",  # Remove X-axis label
                  ylabel = col,  # Keep Y-axis label
                  xticklabelsvisible = false,  # Hide X tick labels
                  xticksize = 0,
                  title = ""  # Remove title
        )
        apply_style!(ax)  # Apply consistent style

        # Get the unique values and their counts
        values = df[:, col]
        #println("Values: ", values)
        #println("Metric ", metric)
        unique_values = unique(values)
        println("Unique Values: ", unique_values)
        unique_values = sort(unique_values)
        println("Unique Values: ", unique_values)
        
        value_counts=[]
        metric_values=[]

        for unique_val in unique_values
            mask = values .== unique_val
            counter = sum(mask)
            total_metric = sum(metric[mask])
            push!(value_counts, counter)
            push!(metric_values, total_metric / counter)
        end

        
        println("Value Counts: ", value_counts)
        println("total_metric ", metric_values)


        #value_counts = [count(==(val), values) for val in unique_values]
        #println("Value Counts: ", value_counts)

        # Normalize value_counts to [0, 1]
        weighted_values = value_counts ./ metric_values
        println("weighted_values ", weighted_values)
        normalized_counts = weighted_values ./ maximum(weighted_values)
        println("Normalized Counts: ", normalized_counts)

        # Create a 2D array by repeating the normalized counts (20 columns)
        hm_matrix = repeat(normalized_counts', outer = (2, 1))
        println("Heatmap Matrix: ", hm_matrix)
        xvals = range(0, stop = 1, length = 2)  # x-axis for heatmap
        println("X Values: ", xvals)

        # Plot the heatmap using the 2D matrix and the custom colormap
        colormap = cgrad([INRIM_blue, INRIM_yellow])
        hm = heatmap!(ax, xvals, unique_values, hm_matrix, colormap = colormap, colorrange = (0, 1))
        push!(heatmaps, hm)  # Store heatmap for colorbar

        # Set Y-axis limits and ticks based on unique discrete values
        y_min = minimum(unique_values)
        println("Y Min: ", y_min)
        y_max = maximum(unique_values)
        println("Y Max: ", y_max)

        if length(unique_values) <= 10       
            if y_min == y_max
                padding = 0.001 * abs(y_min)  # Use 1% of the value as padding
                padding = padding == 0 ? 0.001 : padding  # If y_min is 0, use a default padding of 0.1
                ylims!(ax, y_min - padding, y_max + padding)
            else
                padding = 0.5 * (y_max - y_min) / length(unique_values)
                ylims!(ax, y_min - padding, y_max + padding)
            end
            
            ax.yticks = (unique_values, string.(unique_values))  # Set y-axis ticks and labels
        else

            padding = 0.5 * (maximum(values) - minimum(values))/length(unique_values)
            ylims!(ax, minimum(values) - padding, maximum(values) + padding)

        end
    end

    # Add a colorbar to the right of the figure, using the last heatmap as a reference
    Colorbar(grid[1, end+1], heatmaps[end], label = "Weighted device counts", labelsize = 22, ticklabelsize = 18, width = 20)
end



function plot_1d_density_heatmap(fig, df, ref_df)

    metric = df.metric
    df = select(df, Not([:metric]))

    col_names = names(df)  # Get column names
    heatmaps = []  # Store heatmaps for colorbar reference

    # Create a grid layout for the 1D density heatmaps
    grid = fig[2, 1] = GridLayout()

    for (i, col) in enumerate(col_names)
        println("\nColumn: ", col)
        ax = Axis(grid[1, i], 
                  xlabel = "",  # Remove X-axis label
                  ylabel = col,  # Keep Y-axis label
                  xticklabelsvisible = false,  # Hide X tick labels
                  xticksize = 0,
                  title = ""  # Remove title
        )
        apply_style!(ax)  # Apply consistent style

        # Get the unique values from the reference dataset
        values = df[:, col]
        ref_values = ref_df[:, col]
        unique_ref_values = sort(unique(ref_values))  # Unique values from the reference dataset
        println("Unique Reference Values: ", unique_ref_values)

        # Initialize arrays to store counts and metric values
        value_counts = zeros(length(unique_ref_values))
        metric_values = zeros(length(unique_ref_values))

        # Calculate counts and metric values for each unique reference value
        for (idx, unique_val) in enumerate(unique_ref_values)
            mask = values .== unique_val
            if any(mask)
                value_counts[idx] = sum(mask)
                metric_values[idx] = sum(metric[mask]) / value_counts[idx]
            else
                value_counts[idx] = 0
                metric_values[idx] = 0
            end
        end

        println("Value Counts: ", value_counts)
        println("Metric Values: ", metric_values)

        # Normalize weighted values
        weighted_values = value_counts ./ (metric_values .+ eps())  # Add eps() to avoid division by zero
        normalized_counts = weighted_values ./ maximum(weighted_values)
        println("Normalized Counts: ", normalized_counts)

        # Create a 2D array by repeating the normalized counts (20 columns)
        hm_matrix = repeat(normalized_counts', outer = (2, 1))
        println("Heatmap Matrix: ", hm_matrix)
        xvals = range(0, stop = 1, length = 2)  # x-axis for heatmap

        # Plot the heatmap using the 2D matrix and the custom colormap
        colormap = cgrad([INRIM_blue, INRIM_yellow])
        hm = heatmap!(ax, xvals, unique_ref_values, hm_matrix, colormap = colormap, colorrange = (0, 1))
        push!(heatmaps, hm)  # Store heatmap for colorbar

        # Set Y-axis limits and ticks based on unique reference values
        y_min = minimum(unique_ref_values)
        y_max = maximum(unique_ref_values)

        if length(unique_ref_values) <= 10         
            if y_min == y_max
                padding = 0.001 * abs(y_min)  # Use 1% of the value as padding
                padding = padding == 0 ? 0.001 : padding  # If y_min is 0, use a default padding of 0.1
                ylims!(ax, y_min - padding, y_max + padding)
            else
                padding = 0.5 * (y_max - y_min) / length(unique_ref_values)
                ylims!(ax, y_min - padding, y_max + padding)
            end
            
            ax.yticks = (unique_ref_values, string.(unique_ref_values))  # Set y-axis ticks and labels
        else
            padding = 0.5 * (y_max - y_min) / length(unique_ref_values)
            ylims!(ax, y_min - padding, y_max + padding)
        end
    end

    # Add a colorbar to the right of the figure, using the last heatmap as a reference
    Colorbar(grid[1, end+1], heatmaps[end], label = "Weighted device counts", labelsize = 22, ticklabelsize = 18, width = 20)
end




# Function to create the interactive GUI
function create_gui(df)

    if isempty(df)
        error("The input DataFrame is empty. Please provide a non-empty DataFrame.")
    end 

    # Create a figure with a grid layout
    fig = Figure(size = (1400, 1200))

    # Add the correlation matrix to the first row
    visualize_correlation_matrix(fig, df)

    # Add the 1D density heatmap to the second row
    plot_1d_density_heatmap(fig, df)

    # Adjust layout spacing
    colgap!(fig.layout, 10)  # Add gap between columns
    rowgap!(fig.layout, 20)  # Add gap between rows

    # Display the figure
    display(fig)
    #save("figure.jpg",fig)

end


function create_gui(df_ref, df)

    if isempty(df)
        error("The input DataFrame is empty. Please provide a non-empty DataFrame.")
    end 

    if isempty(df_ref)
        error("The input DataFrame is empty. Please provide a non-empty DataFrame.")
    end 
    # Create a figure with a grid layout
    fig = Figure(size = (1400, 1200))

    # Add the correlation matrix to the first row
    visualize_correlation_matrix(fig, df)

    # Add the 1D density heatmap to the second row
    plot_1d_density_heatmap(fig, df, df_ref)

    # Adjust layout spacing
    colgap!(fig.layout, 10)  # Add gap between columns
    rowgap!(fig.layout, 20)  # Add gap between rows

    # Display the figure
    display(fig)
    plot_update(fig)
    #save("figure.jpg",fig)
end
