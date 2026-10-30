/** CSV columns correspond to the currently plotted X samples and Y components. */
export interface PlotCsvSeries {
  label: string
  values: readonly number[]
}

export interface PlotCsvData {
  x: readonly number[]
  xLabel: string
  series: readonly PlotCsvSeries[]
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text
}

export function safePlotFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'jco_plot'
}

export function buildPlotCsv({ x, xLabel, series }: PlotCsvData): string {
  if (!x.length || !series.length || series.some((item) => item.values.length !== x.length)) {
    throw new Error('Cannot export a plot with empty data or mismatched X/Y sample counts.')
  }
  return [
    [xLabel, ...series.map((item) => item.label)].map(csvCell).join(','),
    ...x.map((value, index) => [value, ...series.map((item) => item.values[index])]
      .map(csvCell).join(',')),
  ].join('\r\n') + '\r\n'
}

export function exportPlotCsv(data: PlotCsvData, filenameStem: string): void {
  const contents = buildPlotCsv(data)
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safePlotFilename(filenameStem) + '.csv'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Defer revocation until after the browser has initiated the file download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
