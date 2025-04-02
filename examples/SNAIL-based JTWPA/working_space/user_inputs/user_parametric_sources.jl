using ..Config

cfg=config()
path = joinpath(cfg.user_inputs_dir, "flux_curve.txt") 
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
