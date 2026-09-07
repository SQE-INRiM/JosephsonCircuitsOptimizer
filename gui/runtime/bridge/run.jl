using Pkg
Pkg.activate(ENV["JCO_PROJECT"])
push!(LOAD_PATH, joinpath(ENV["JCO_PROJECT"], "src"))
using JosephsonCircuitsOptimizer
const JCO = JosephsonCircuitsOptimizer

# Desktop-specific storage/UI policy. Keep the embedded JCO engine source intact and
# apply the GUI persistence contract only to runs launched through this bridge.
Base.include(JCO, joinpath(@__DIR__, "gui_runtime_overrides.jl"))
Base.include(JCO, joinpath(@__DIR__, "gui_runtime_fixes.jl"))
Base.include(JCO, joinpath(@__DIR__, "gui_runtime_bookkeeping_fixes.jl"))
Base.include(JCO, joinpath(@__DIR__, "gui_results_fixes.jl"))
Base.include(JCO, joinpath(@__DIR__, "gui_output_path_fixes.jl"))
Base.include(JCO, joinpath(@__DIR__, "gui_cost_history_fix.jl"))
Base.include(JCO, joinpath(@__DIR__, "gui_optimizer_persistence_diagnostics.jl"))

workspace = ENV["JCO_WORKSPACE"]
mode = get(ENV, "JCO_MODE", "run")

if mode == "run"
    JCO.run(; workspace)
elseif mode == "sweep_only"
    JCO.run_sweep_only(; workspace)
elseif mode == "optimization_only"
    JCO.run_optimization_only(; workspace)
elseif mode == "nonlinear_only"
    JCO.run_nonlinear_only(; workspace)
elseif mode == "from_latest"
    JCO.run_from_latest_dataset_only(; workspace)
else
    error("Unknown JCO mode: $mode")
end
