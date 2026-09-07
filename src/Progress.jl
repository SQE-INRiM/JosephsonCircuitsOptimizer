module Progress

using Dates
using Statistics

# ----------------------------
# Internal state (per stage)
# ----------------------------
mutable struct ProgressState
    last_time::Float64
    samples::Vector{Float64}
    tick_count::Int
end

const STATES = Dict{String,ProgressState}()

# Linear/optimization runs need a few representative samples because Julia/JIT
# warm-up can dominate their first configuration. Harmonic Balance is different:
# users need an early estimate because one configuration can already be expensive,
# so HB publishes an estimate immediately after the first completed configuration.
const DEFAULT_WARMUP_INTERVALS = 1
const DEFAULT_MIN_TIMED_SAMPLES_FOR_ETA = 3
const HB_WARMUP_INTERVALS = 0
const HB_MIN_TIMED_SAMPLES_FOR_ETA = 1
const ROLLING_WINDOW = 7

_now() = time()
_warmup_intervals(stage::String) = stage == "HB" ? HB_WARMUP_INTERVALS : DEFAULT_WARMUP_INTERVALS
_min_samples(stage::String) = stage == "HB" ? HB_MIN_TIMED_SAMPLES_FOR_ETA : DEFAULT_MIN_TIMED_SAMPLES_FOR_ETA

function _reset_state!(stage::String)
    STATES[stage] = ProgressState(_now(), Float64[], 0)
end

function _get_state(stage::String)
    get!(STATES, stage) do
        ProgressState(_now(), Float64[], 0)
    end
end

function _representative_dt(st::ProgressState)
    isempty(st.samples) && return nothing
    first_index = max(1, length(st.samples) - ROLLING_WINDOW + 1)
    median(@view st.samples[first_index:end])
end

"""
Emit a stage-only message and reset the timing state for that stage.
GUI should use indeterminate timing until representative samples exist.
"""
function emit_stage(stage::String)
    _reset_state!(stage)
    println("STAGE name=$stage")
end

"""
Emit a progress tick.

Linear/optimization ETA ignores the warm-up interval and waits for several
representative point durations. HB emits ETA after the first completed point,
then all stages use a rolling median to keep the estimate stable.
"""
function tick_progress!(i::Int, N::Int; stage::String)
    st = _get_state(stage)
    t = _now()
    dt = max(t - st.last_time, 0.0)
    st.last_time = t
    st.tick_count += 1

    if st.tick_count > _warmup_intervals(stage) && isfinite(dt) && dt > 0
        push!(st.samples, dt)
    end

    if length(st.samples) < _min_samples(stage)
        println("PROGRESS i=$i N=$N stage=$stage")
        return
    end

    representative_dt = _representative_dt(st)
    eta = representative_dt === nothing ? 0.0 : max(representative_dt * (N - i), 0.0)
    println("PROGRESS i=$i N=$N ETA=$(round(eta, digits=1))s stage=$stage")
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

function start!(; N::Int, stage::String)
    emit_stage(stage)
    ProgressCtx(N, stage)
end

function tick!(ctx::ProgressCtx; i::Int)
    tick_progress!(i, ctx.N; stage=ctx.stage)
    nothing
end

function finish!(ctx::ProgressCtx)
    emit_done(ctx.stage)
    nothing
end

end # module
