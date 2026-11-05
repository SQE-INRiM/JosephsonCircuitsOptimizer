import { describe, expect, it } from 'vitest'
import {
  defaultMetricFunction, isolateMetricFunction, replaceMetricFunction,
} from './juliaFunctionSections'

const source = `# Imported project with helpers, comments and special characters 🧪
function mean_db(xs)
    return sum(xs) / length(xs)
end

function user_cost(sol, device_params_set, nonlinear_correction)
    # Opening words in comments do not count: if for function end
    if nonlinear_correction > 0
        for i in 1:2
            println("The words end and if must not close the function")
        end
    else
        println("""Julia triple strings can contain end, function, and if""")
    end
    return (metric = mean_db([1, 2]),)
end

# Preserve this standalone comment between functions.
function user_performance(sol, device_params_set, source_amps, source_freqs)
    return (performance = 1.0,)
end

function local_helper(x)
    return x + 42
end

function user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)
    return 0.0
end

# Custom text after the last function stays byte-for-byte unchanged.
`

describe('isolated Julia function editor', () => {
  it.each(['user_cost', 'user_performance', 'user_nonlinear_correction'] as const)(
    'isolates only %s without capturing helpers or adjacent comments', (name) => {
      const part = isolateMetricFunction(source, name)
      expect(part.kind).toBe('found')
      if (part.kind !== 'found') return
      expect(part.text.startsWith('function ' + name + '(')).toBe(true)
      expect(part.text.endsWith('\nend')).toBe(true)
      expect(part.text).not.toContain('function local_helper')
      expect(part.text).not.toContain('Preserve this standalone comment')
    },
  )

  it('preserves the entire source except the edited function', () => {
    const old = isolateMetricFunction(source, 'user_cost')
    expect(old.kind).toBe('found')
    if (old.kind !== 'found') return
    const modified = old.text.replace('return (metric = mean_db([1, 2]),)', 'return (metric = 42.0,)')
    const outcome = replaceMetricFunction(source, 'user_cost', modified)
    expect('code' in outcome).toBe(true)
    if (!('code' in outcome)) return
    expect(outcome.code).toBe(source.slice(0, old.start) + modified + source.slice(old.end))
    expect(outcome.code).toContain('Custom text after the last function stays byte-for-byte')
    expect(outcome.code).toContain('function local_helper(x)')
  })

  it('ignores nested Julia block comments, quoted strings and index end', () => {
    const complex = `function user_cost(sol, p, d)
    #= multiline comment if
       #= nested for end =#
    =#
    message = "quoted function end if"
    a = [1, 2, 3]
    val = a[end]
    if val > 0
        val += 1
    end
    return (metric = val,)
end
function user_performance(sol, p, a, f)
    return (performance = 1.0,)
end`
    const part = isolateMetricFunction(complex, 'user_cost')
    expect(part.kind).toBe('found')
    if (part.kind !== 'found') return
    expect(part.text).toContain('return (metric = val,)\nend')
    expect(part.text).not.toContain('function user_performance')
  })

  it('supports a missing function without rewriting existing definitions', () => {
    const original = source.replace(
      'function user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)\n    return 0.0\nend\n',
      '',
    )
    expect(isolateMetricFunction(original, 'user_nonlinear_correction').kind).toBe('missing')
    const outcome = replaceMetricFunction(original, 'user_nonlinear_correction', defaultMetricFunction('user_nonlinear_correction'))
    expect('code' in outcome).toBe(true)
    if (!('code' in outcome)) return
    expect(outcome.code.startsWith(original)).toBe(true)
    expect(outcome.code).toContain(defaultMetricFunction('user_nonlinear_correction'))
  })

  it('refuses duplicate function definitions and ambiguous short-form code', () => {
    const duplicate = source + '\n' + defaultMetricFunction('user_cost')
    expect(isolateMetricFunction(duplicate, 'user_cost').kind).toBe('unsupported')
    const shortForm = 'user_cost(sol, p, d) = 1.0'
    expect(isolateMetricFunction(shortForm, 'user_cost').kind).toBe('unsupported')
    expect(replaceMetricFunction(duplicate, 'user_cost', defaultMetricFunction('user_cost'))).toHaveProperty('error')
  })

  it('rejects saving a broken or different function, leaving the source untouched', () => {
    expect(replaceMetricFunction(source, 'user_cost', 'function user_cost(sol, p, d)\n  return 0')).toHaveProperty('error')
    expect(replaceMetricFunction(source, 'user_cost', defaultMetricFunction('user_performance'))).toHaveProperty('error')
  })

  it('preserves UTF-16 offsets with non-BMP characters before the function', () => {
    const input = 'println("👋")\n' + defaultMetricFunction('user_cost') + '\n'
    const part = isolateMetricFunction(input, 'user_cost')
    expect(part.kind).toBe('found')
    if (part.kind !== 'found') return
    expect(part.start).toBe('println("👋")\n'.length)
    expect(part.text).toBe(defaultMetricFunction('user_cost'))
    expect(replaceMetricFunction(input, 'user_cost', part.text)).toEqual({ code: input })
  })
})
