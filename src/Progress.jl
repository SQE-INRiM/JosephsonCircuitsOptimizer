module Progress

using Dates

# ----------------------------
# Internal state (per stage)
# ----------------------------
mutable struct ProgressState
    last_time::Float64
    ema_dt::Float64
    n_samples::Int
end

const STATES = Dict{String,ProgressState}()

const EMA_ALPHA = 0.2        # strong smoothing
const MIN_SAMPLES_FOR_ETA = 3

# ----------------------------
# Utilities
# ----------------------------
_now() = time()

function _get_state(stage::String)
    if !haskey(STATES, stage)
        STATES[stage] = ProgressState(_now(), 0.0, 0)
    end
    return STATES[stage]
end

# ----------------------------
# Public API
# ----------------------------

"""
Emit a stage-only message (no progress, no ETA).
GUI should switch to indeterminate mode.
"""
function emit_stage(stage::String)
    println("STAGE name=$stage")
end

"""
Emit a progress tick.
ETA is emitted only if enough samples exist and N >= 5.
"""
function tick_progress!(i::Int, N::Int; stage::String)
    st = _get_state(stage)
    t = _now()
    dt = t - st.last_time
    st.last_time = t

    # update EMA (ignore first tick)
    if st.n_samples > 0
        st.ema_dt = st.n_samples == 1 ? dt :
                    EMA_ALPHA * dt + (1 - EMA_ALPHA) * st.ema_dt
    end
    st.n_samples += 1

    if N < MIN_SAMPLES_FOR_ETA || st.n_samples < MIN_SAMPLES_FOR_ETA
        println("PROGRESS i=$i N=$N stage=$stage")
    else
        eta = max(st.ema_dt * (N - i), 0.0)
        println("PROGRESS i=$i N=$N ETA=$(round(eta, digits=1))s stage=$stage")
    end
end

"""
Signal end of a stage.
"""
function emit_done(stage::String)
    println("PROGRESS_DONE stage=$stage")
end


# ----------------------------
# Compatibility API (older callers)
# ----------------------------

struct ProgressCtx
    N::Int
    stage::String
end

"""
Start a stage progress context (compatibility shim).
Existing code may call: ctx = Progress.start!(; N=..., stage="LIN")
"""
function start!(; N::Int, stage::String)
    emit_stage(stage)
    return ProgressCtx(N, stage)
end

"""
Tick the progress context (compatibility shim).
Existing code may call: Progress.tick!(ctx; i=...)
"""
function tick!(ctx::ProgressCtx; i::Int)
    tick_progress!(i, ctx.N; stage=ctx.stage)
    return nothing
end

"""
Finish the progress context (compatibility shim).
Existing code may call: Progress.finish!(ctx)
"""
function finish!(ctx::ProgressCtx)
    emit_done(ctx.stage)
    return nothing
end

end # module
