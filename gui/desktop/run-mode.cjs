function modeForStages(stages) {
  const key = [...new Set(stages)].sort().join(',')
  if (key === 'linear') return 'sweep_only'
  if (key === 'optimization') return 'optimization_only'
  if (key === 'hb') return 'nonlinear_only'
  if (key === 'hb,optimization') return 'from_latest'
  return 'run'
}

module.exports = { modeForStages }
