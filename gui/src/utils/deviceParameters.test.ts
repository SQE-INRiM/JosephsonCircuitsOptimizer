import { describe, expect, it } from 'vitest'
import { extractDeviceParameterNames, nextManualParameter, reconcileDeviceParameters } from './deviceParameters'

describe('device parameter discovery', () => {
  it('discovers unique device_params_set symbols in circuit order', () => {
    const code = `
      Cc = device_params_set[:Cc]
      Cg = device_params_set[ :Cg ]
      again = device_params_set[:Cc]
    `
    expect(extractDeviceParameterNames(code)).toEqual(['Cc', 'Cg'])
  })

  it('uses the actual create_user_circuit argument name', () => {
    const code = `
      function create_user_circuit(device_parameters_set::Dict)
        Cg = device_parameters_set[:Cg]
        Lj = device_parameters_set[ :Lj ]
      end
    `
    expect(extractDeviceParameterNames(code)).toEqual(['Cg', 'Lj'])
  })

  it('supports a custom function argument name', () => {
    const code = 'function create_user_circuit(parameters::Dict)\nx = parameters[:I0]\nend'
    expect(extractDeviceParameterNames(code)).toEqual(['I0'])
  })

  it('ignores parameter-like text in Julia comments', () => {
    const code = `
      function create_user_circuit(device_params_set)
        # old = device_params_set[:OldParameter]
        #= device_params_set[:AnotherOldParameter] =#
        Cg = device_params_set[:Cg]
      end
    `
    expect(extractDeviceParameterNames(code)).toEqual(['Cg'])
  })

  it('adds circuit parameters missing from the project and marks unused parameters', () => {
    const parameters = [
      { id: 'Cc', name: 'Cc', mode: 'Fixed' as const, value: '1e-13', unit: 'F', role: 'Fixed model' as const },
      { id: 'legacy', name: 'legacy', mode: 'Fixed' as const, value: '2', unit: '—', role: 'Fixed model' as const },
    ]
    const reconciled = reconcileDeviceParameters('x = device_parameters_set[:Cc]\ny = device_parameters_set[:I0]', parameters)
    expect(reconciled.map((item) => [item.name, item.circuitStatus])).toEqual([
      ['Cc', 'configured'],
      ['I0', 'missing'],
      ['legacy', 'unused'],
    ])
    expect(reconciled[1].value).toBe('')
  })

  it('creates a unique manual parameter', () => {
    const parameter = nextManualParameter([
      { id: 'one', name: 'parameter_1', mode: 'Fixed', value: '', unit: '—', role: 'Fixed model' },
    ])
    expect(parameter.name).toBe('parameter_2')
    expect(parameter.circuitStatus).toBe('unused')
  })

  it('drops template parameters after the circuit is replaced but keeps manual parameters', () => {
    const parameters = [
      { id: 'Lj', name: 'Lj', mode: 'Fixed' as const, value: '1e-9', unit: 'H', role: 'Fixed model' as const },
      { id: 'manual-note', name: 'note', mode: 'Fixed' as const, value: '2', unit: '—', role: 'Fixed model' as const },
    ]
    const reconciled = reconcileDeviceParameters('x = device_params_set[:Cg]', parameters, false)
    expect(reconciled.map((parameter) => parameter.name)).toEqual(['Cg', 'note'])
  })
})
