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
        @info "Column: $col"

        ax = Axis(grid[1, i],
            xlabel = "",
            ylabel = col,
            xticklabelsvisible = false,
            xticksize = 0,
            title = ""
        )
        apply_style!(ax)

        values = df[:, col]
        unique_values = unique(values)
        @info "Unique Values (unsorted): $unique_values"
        unique_values = sort(unique_values)
        @info "Unique Values (sorted): $unique_values"

        value_counts = []
        metric_values = []

        for unique_val in unique_values
            mask = values .== unique_val
            counter = sum(mask)
            total_metric = sum(metric[mask])
            push!(value_counts, counter)
            push!(metric_values, total_metric / counter)
        end

        @info "Value Counts: $value_counts"
        @info "total_metric (mean per value): $metric_values"

        weighted_values = value_counts ./ metric_values
        @info "weighted_values: $weighted_values"

        normalized_counts = weighted_values ./ maximum(weighted_values)
        @info "Normalized Counts: $normalized_counts"

        hm_matrix = repeat(normalized_counts', outer = (2, 1))
        @info "Heatmap Matrix: $hm_matrix"

        xvals = range(0, stop = 1, length = 2)
        @info "X Values: $xvals"

        colormap = cgrad([INRIM_blue, INRIM_yellow])
        hm = heatmap!(ax, xvals, unique_values, hm_matrix, colormap = colormap, colorrange = (0, 1))
        push!(heatmaps, hm)

        y_min = minimum(unique_values)
        @info "Y Min: $y_min"
        y_max = maximum(unique_values)
        @info "Y Max: $y_max"

        if length(unique_values) <= 10
            if y_min == y_max
                padding = 0.001 * abs(y_min)
                padding = padding == 0 ? 0.001 : padding
                ylims!(ax, y_min - padding, y_max + padding)
            else
                padding = 0.5 * (y_max - y_min) / length(unique_values)
                ylims!(ax, y_min - padding, y_max + padding)
            end
            ax.yticks = (unique_values, string.(unique_values))
        else
            padding = 0.5 * (maximum(values) - minimum(values)) / length(unique_values)
            ylims!(ax, minimum(values) - padding, maximum(values) + padding)
        end
    end

    Colorbar(grid[1, end+1], heatmaps[end], label = "Weighted device counts",
             labelsize = 22, ticklabelsize = 18, width = 20)
end


function plot_1d_density_heatmap(fig, df, ref_df)

    metric = df.metric
    df = select(df, Not([:metric]))

    col_names = names(df)
    heatmaps = []

    grid = fig[2, 1] = GridLayout()

    for (i, col) in enumerate(col_names)
        @info "Column: $col"

        ax = Axis(grid[1, i],
            xlabel = "",
            ylabel = col,
            xticklabelsvisible = false,
            xticksize = 0,
            title = ""
        )
        apply_style!(ax)

        values = df[:, col]
        ref_values = ref_df[:, col]
        unique_ref_values = sort(unique(ref_values))
        @info "Unique Reference Values: $unique_ref_values"

        value_counts = zeros(length(unique_ref_values))
        metric_values = zeros(length(unique_ref_values))

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

        @info "Value Counts: $value_counts"
        @info "Metric Values: $metric_values"

        weighted_values = value_counts ./ (metric_values .+ eps())
        normalized_counts = weighted_values ./ maximum(weighted_values)
        @info "Normalized Counts: $normalized_counts"

        hm_matrix = repeat(normalized_counts', outer = (2, 1))
        @info "Heatmap Matrix: $hm_matrix"

        xvals = range(0, stop = 1, length = 2)

        colormap = cgrad([INRIM_blue, INRIM_yellow])
        hm = heatmap!(ax, xvals, unique_ref_values, hm_matrix, colormap = colormap, colorrange = (0, 1))
        push!(heatmaps, hm)

        y_min = minimum(unique_ref_values)
        y_max = maximum(unique_ref_values)

        if length(unique_ref_values) <= 10
            if y_min == y_max
                padding = 0.001 * abs(y_min)
                padding = padding == 0 ? 0.001 : padding
                ylims!(ax, y_min - padding, y_max + padding)
            else
                padding = 0.5 * (y_max - y_min) / length(unique_ref_values)
                ylims!(ax, y_min - padding, y_max + padding)
            end
            ax.yticks = (unique_ref_values, string.(unique_ref_values))
        else
            padding = 0.5 * (y_max - y_min) / length(unique_ref_values)
            ylims!(ax, y_min - padding, y_max + padding)
        end
    end

    Colorbar(grid[1, end+1], heatmaps[end], label = "Weighted device counts",
             labelsize = 22, ticklabelsize = 18, width = 20)
end



"""
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
"""

function create_corr_figure(df; df_ref=nothing)

    if isempty(df)
        error("The input DataFrame is empty. Please provide a non-empty DataFrame.")
    end 

    # Ensure folder exists
    isdir(corr_path) || mkpath(corr_path)

    # Make one big figure
    fig = Figure(size = (1400, 1200))

    # Left: correlation matrix
    ax1 = Axis(fig[1, 1])
    visualize_correlation_matrix(fig, df)  # assumes it plots into fig[1,1]

    # Right: 1D density heatmap
    ax2 = Axis(fig[1, 2])
    if isnothing(df_ref)
        plot_1d_density_heatmap(fig, df)
    else
        plot_1d_density_heatmap(fig, df, df_ref)
    end

    # Adjust layout spacing
    colgap!(fig.layout, 10)  # Add gap between columns
    rowgap!(fig.layout, 20)  # Add gap between rows

    # Build filename with timestamp
    timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS-sss")
    filename  = "corr_$timestamp.png"
    filepath  = joinpath(corr_path, filename)
    tmpfile   = filepath * ".part.png"

    # Safe save
    save(tmpfile, fig)
    mv(tmpfile, filepath; force = true)

    extra = Dict(
        "n_points" => nrow(df),
        "n_columns" => ncol(df)
    )

    correlation_update(fig; plot_type="correlation", run_id=nothing, extra=extra)

    @info "Saved correlation figure → $filepath"
    return filepath
end