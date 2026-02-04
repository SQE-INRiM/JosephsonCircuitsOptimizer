module Progress

"""A small progress + ETA emitter (stdout).

This module is intentionally dependency-free so it can be used anywhere.

It emits parseable single-line messages for the Python GUI:

    PROGRESS i=12 N=40 ETA=183.5s stage=HB

The ETA is computed from an exponential moving average of seconds/step.
"""

mutable struct ProgressCtx
    N::Int
    stage::String
    t0::Float64
    last_t::Float64
    ema_s_per_step::Float64
    alpha::Float64
end

_now_s() = time()

"""Create and announce a new progress context."""
function start!(; N::Integer, stage::AbstractString, alpha::Real=0.20)
    t = _now_s()
    ctx = ProgressCtx(Int(N), String(stage), t, t, 0.0, float(alpha))
    # Initial line (i=0) so GUI can set max and stage immediately
    println("PROGRESS i=0 N=$(ctx.N) ETA=NaNs stage=$(ctx.stage)")
    flush(stdout)
    return ctx
end

"""Emit a progress update for step i (1-based)."""
function tick!(ctx::ProgressCtx; i::Integer)
    i = Int(i)
    t = _now_s()
    dt = max(t - ctx.last_t, 1e-6)
    ctx.last_t = t

    # Update EMA seconds/step once we have at least one step
    if i >= 1
        sps = dt
        ctx.ema_s_per_step = ctx.ema_s_per_step == 0.0 ? sps : (ctx.alpha*sps + (1-ctx.alpha)*ctx.ema_s_per_step)
    end

    remaining = max(ctx.N - i, 0)
    eta = (ctx.ema_s_per_step == 0.0) ? NaN : ctx.ema_s_per_step * remaining

    println("PROGRESS i=$(i) N=$(ctx.N) ETA=$(round(eta; digits=3))s stage=$(ctx.stage)")
    flush(stdout)
    return nothing
end

"""Mark progress finished (emits a final line)."""
function finish!(ctx::ProgressCtx)
    println("PROGRESS i=$(ctx.N) N=$(ctx.N) ETA=0.0s stage=$(ctx.stage)")
    println("PROGRESS_DONE stage=$(ctx.stage)")
    flush(stdout)
    return nothing
end

end # module
