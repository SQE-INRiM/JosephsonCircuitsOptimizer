# Run from repository root:
#   julia --project=. test/feedback_reuse.jl
#
# Pure tests: no JosephsonCircuits solver is needed.
using Test
include(joinpath(@__DIR__, "..", "src", "FeedbackReuse.jl"))

make_point(; amps=[1.0e-6, 125.0e-6], freqs=[7.0e9, 0.0],
            correction=4.2, converged=true) =
    (amps=amps, freqs=freqs, delta_quantity=correction, converged=converged)

@testset "Reuse feedback from exactly matching, converged nonlinear HB point" begin
    ref_amps = [1.0e-6, 125.0e-6]
    ref_freqs = [7.0e9, 0.0]

    @test feedback_correction_from_sweep(nothing, ref_amps, ref_freqs) === nothing
    @test feedback_correction_from_sweep([], ref_amps, ref_freqs) === nothing

    points = [
        make_point(amps=[0.8e-6, 125.0e-6], correction=1.0),
        make_point(amps=ref_amps, correction=9.5),
        make_point(amps=[1.2e-6, 125.0e-6], correction=3.0),
    ]
    @test feedback_correction_from_sweep(points, ref_amps, ref_freqs) == 9.5
    @test feedback_correction_from_sweep(reverse(points), ref_amps, ref_freqs) == 9.5

    # A different DC bias is a different HB working point, even if RF matches.
    @test feedback_correction_from_sweep(points, [1.0e-6, 126.0e-6], ref_freqs) === nothing
    # A different pump frequency or reversed source order must never hit cache.
    @test feedback_correction_from_sweep(points, ref_amps, [7.01e9, 0.0]) === nothing
    @test feedback_correction_from_sweep(points, reverse(ref_amps), ref_freqs) === nothing
    @test feedback_correction_from_sweep(points, [1.0e-6], [7.0e9]) === nothing
    @test feedback_correction_from_sweep(points, ref_amps, [0.0, 7.0e9]) === nothing

    # Minor floating-point noise from generating the range grid is acceptable;
    # a measurable change in RF current is not.
    @test feedback_correction_from_sweep([
        make_point(amps=[1.0e-6 * (1 + 1e-13), 125.0e-6])
    ], ref_amps, ref_freqs) == 4.2
    @test feedback_correction_from_sweep([
        make_point(amps=[1.0e-6 * (1 + 1e-7), 125.0e-6])
    ], ref_amps, ref_freqs) === nothing

    # An exact point that did not converge cannot be reused; another converged
    # point at the same source configuration is allowed.
    failed = make_point(correction=31.0, converged=false)
    @test feedback_correction_from_sweep([failed], ref_amps, ref_freqs) === nothing
    @test feedback_correction_from_sweep([failed, make_point()], ref_amps, ref_freqs) == 4.2

    @test feedback_correction_from_sweep([
        make_point(correction=NaN)
    ], ref_amps, ref_freqs) === nothing
    @test feedback_correction_from_sweep([
        make_point(correction=nothing)
    ], ref_amps, ref_freqs) === nothing
    @test feedback_correction_from_sweep([
        (amps=ref_amps, freqs=ref_freqs, converged=true)
    ], ref_amps, ref_freqs) === nothing
    @test feedback_correction_from_sweep([
        make_point(correction=0.0)
    ], ref_amps, ref_freqs) === 0.0

    @test feedback_correction_from_sweep(points, [Inf, 125.0e-6], ref_freqs) === nothing
    @test feedback_correction_from_sweep(points, ref_amps, [NaN, 0.0]) === nothing
end

@testset "Current cycle uses only immediately preceding sweep data" begin
    amp = [1.0e-6, 125.0e-6]
    freq = [7.0e9, 0.0]
    baseline = [make_point(correction=10.0)]
    cycle_1 = [make_point(correction=12.0)]
    @test feedback_correction_from_sweep(baseline, amp, freq) == 10.0
    @test feedback_correction_from_sweep(cycle_1, amp, freq) == 12.0
end
