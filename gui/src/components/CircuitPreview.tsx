import { useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, Paper, Stack, Typography, useTheme } from '@mui/material'
import type { CircuitPreviewComponent, CircuitPreviewData } from '../services/jcoAdapter'

type Point = { x: number; y: number }
type DrawItem = {
  component: CircuitPreviewComponent
  start: Point
  end: Point
  leadStart?: Point
  leadEnd?: Point
  ground?: Point
  isPort?: boolean
}
type Omission = { left: Point; right: Point }
type CircuitLayout = {
  width: number
  height: number
  nodePositions: Map<string, Point>
  items: DrawItem[]
  couplings: Array<{ component: CircuitPreviewComponent; start: Point; end: Point }>
  omissions: Omission[]
  condensed: boolean
}
type ElectricalLine = {
  nodes: string[]
  nodeSet: Set<string>
  distance: Map<string, number>
  maxLayer: number
  condensed: boolean
  portY: number
  groundY: number
}

const FIRST_VISIBLE_CELLS = 15
const LAYER_SPACING = 150
const ROW_SPACING = 120
const LINE_GAP = 110

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function pairKey(a: string, b: string) {
  return naturalCompare(a, b) <= 0 ? `${a}\u0000${b}` : `${b}\u0000${a}`
}

function liveNode(component: CircuitPreviewComponent) {
  if (component.node1 === '0') return component.node2
  if (component.node2 === '0') return component.node1
  return null
}

function portNumber(component: CircuitPreviewComponent) {
  const value = Number(component.resolvedValue ?? component.valueExpression)
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER
}

function shortestPath(start: string, end: string, nodeSet: Set<string>, adjacency: Map<string, Set<string>>) {
  if (start === end) return [start]
  const previous = new Map<string, string | null>([[start, null]])
  const queue = [start]
  while (queue.length) {
    const node = queue.shift()!
    for (const neighbor of [...(adjacency.get(node) ?? [])].filter((candidate) => nodeSet.has(candidate)).sort(naturalCompare)) {
      if (previous.has(neighbor)) continue
      previous.set(neighbor, node)
      if (neighbor === end) {
        const path = [end]
        let cursor: string | null = node
        while (cursor) {
          path.push(cursor)
          cursor = previous.get(cursor) ?? null
        }
        return path.reverse()
      }
      queue.push(neighbor)
    }
  }
  return []
}

function buildLayout(data: CircuitPreviewData): CircuitLayout {
  const electrical = data.components.filter((component) => component.kind !== 'K')
  const nodes = data.nodes.filter((node) => node !== '0').sort(naturalCompare)
  const adjacency = new Map<string, Set<string>>(nodes.map((node) => [node, new Set<string>()]))

  for (const component of electrical) {
    if (component.kind === 'P' || component.node1 === '0' || component.node2 === '0') continue
    adjacency.get(component.node1)?.add(component.node2)
    adjacency.get(component.node2)?.add(component.node1)
  }

  // K entries couple inductors but do not electrically join the two networks. Build the
  // connected electrical lines without K so RF and DC-bias chains remain separate bands.
  const connectedNodeSets: string[][] = []
  const visited = new Set<string>()
  for (const start of nodes) {
    if (visited.has(start)) continue
    const queue = [start]
    const group: string[] = []
    visited.add(start)
    while (queue.length) {
      const node = queue.shift()!
      group.push(node)
      for (const neighbor of adjacency.get(node) ?? []) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
    connectedNodeSets.push(group.sort(naturalCompare))
  }

  const ports = electrical.filter((component) => component.kind === 'P')
  connectedNodeSets.sort((a, b) => {
    const aSet = new Set(a)
    const bSet = new Set(b)
    const aPort = ports.filter((port) => {
      const node = liveNode(port)
      return Boolean(node && aSet.has(node))
    }).reduce((best, port) => Math.min(best, portNumber(port)), Number.MAX_SAFE_INTEGER)
    const bPort = ports.filter((port) => {
      const node = liveNode(port)
      return Boolean(node && bSet.has(node))
    }).reduce((best, port) => Math.min(best, portNumber(port)), Number.MAX_SAFE_INTEGER)
    return aPort !== bPort ? aPort - bPort : naturalCompare(a[0] ?? '', b[0] ?? '')
  })

  const lines: ElectricalLine[] = []
  const lineByNode = new Map<string, ElectricalLine>()
  const nodePositions = new Map<string, Point>()
  const omissions: Omission[] = []
  let yCursor = 20

  for (const lineNodes of connectedNodeSets) {
    const nodeSet = new Set(lineNodes)
    const linePorts = ports
      .filter((port) => {
        const node = liveNode(port)
        return Boolean(node && nodeSet.has(node))
      })
      .sort((a, b) => portNumber(a) - portNumber(b))
    const root = liveNode(linePorts[0]) ?? lineNodes[0]
    if (!root) continue

    const distance = new Map<string, number>([[root, 0]])
    const queue = [root]
    while (queue.length) {
      const node = queue.shift()!
      const layer = distance.get(node) ?? 0
      for (const neighbor of [...(adjacency.get(node) ?? [])].filter((candidate) => nodeSet.has(candidate)).sort(naturalCompare)) {
        if (distance.has(neighbor)) continue
        distance.set(neighbor, layer + 1)
        queue.push(neighbor)
      }
    }

    const maxLayer = Math.max(0, ...distance.values())
    const condensed = maxLayer > FIRST_VISIBLE_CELLS + 1
    const isVisible = (node: string) => {
      const layer = distance.get(node) ?? 0
      return !condensed || layer <= FIRST_VISIBLE_CELLS || layer >= maxLayer - 1
    }
    const shownLayer = (layer: number) => {
      if (!condensed || layer <= FIRST_VISIBLE_CELLS) return layer
      if (layer === maxLayer - 1) return FIRST_VISIBLE_CELLS + 2
      return FIRST_VISIBLE_CELLS + 3
    }

    const shownLayers = new Map<number, string[]>()
    for (const node of lineNodes.filter(isVisible)) {
      const layer = shownLayer(distance.get(node) ?? 0)
      if (!shownLayers.has(layer)) shownLayers.set(layer, [])
      shownLayers.get(layer)!.push(node)
    }

    const maxRows = Math.max(1, ...[...shownLayers.values()].map((layerNodes) => layerNodes.length))
    const baseY = yCursor + 90
    const baselineY = baseY + (maxRows > 1 ? ROW_SPACING : 0)
    const portY = yCursor + 25
    for (const [layer, layerNodes] of [...shownLayers.entries()].sort((a, b) => a[0] - b[0])) {
      layerNodes.sort(naturalCompare).forEach((node, index) => {
        nodePositions.set(node, { x: 90 + layer * LAYER_SPACING, y: baseY + index * ROW_SPACING })
      })
    }

    // Use the shortest port-to-port path as the visible backbone. Alternate paths that leave
    // and rejoin it are schematic branches: keep their internal nodes on one horizontal lane.
    // For a SNAIL this makes the small-junction/Lloop path the backbone and the three large
    // junctions one clean upper branch, with vertical risers only at the branch endpoints.
    const endNode = liveNode(linePorts[linePorts.length - 1])
    const backbone = endNode ? shortestPath(root, endNode, nodeSet, adjacency) : []
    if (backbone.length > 1) {
      const backboneSet = new Set(backbone)
      const backboneIndex = new Map(backbone.map((node, index) => [node, index]))

      for (const node of backbone) {
        const point = nodePositions.get(node)
        if (point) point.y = baselineY
      }

      const offBackbone = new Set(lineNodes.filter((node) => isVisible(node) && !backboneSet.has(node)))
      const branchVisited = new Set<string>()
      for (const start of [...offBackbone].sort(naturalCompare)) {
        if (branchVisited.has(start)) continue
        const branchQueue = [start]
        const branchNodes: string[] = []
        branchVisited.add(start)
        while (branchQueue.length) {
          const node = branchQueue.shift()!
          branchNodes.push(node)
          for (const neighbor of adjacency.get(node) ?? []) {
            if (!offBackbone.has(neighbor) || branchVisited.has(neighbor)) continue
            branchVisited.add(neighbor)
            branchQueue.push(neighbor)
          }
        }

        const boundaries = [...new Set(branchNodes.flatMap((node) => [...(adjacency.get(node) ?? [])].filter((neighbor) => backboneSet.has(neighbor))))]
          .filter((node) => nodePositions.has(node))
          .sort((a, b) => (backboneIndex.get(a) ?? 0) - (backboneIndex.get(b) ?? 0))
        if (boundaries.length < 2) continue

        const left = nodePositions.get(boundaries[0])!
        const right = nodePositions.get(boundaries[boundaries.length - 1])!
        const orderedBranch = branchNodes.sort(naturalCompare)
        const laneY = baselineY - ROW_SPACING
        orderedBranch.forEach((node, index) => {
          const fraction = (index + 1) / (orderedBranch.length + 1)
          nodePositions.set(node, {
            x: left.x + (right.x - left.x) * fraction,
            y: laneY,
          })
        })
      }
    }

    const localMaxY = Math.max(baseY + (maxRows - 1) * ROW_SPACING, baselineY)
    const groundY = localMaxY + 165
    const line: ElectricalLine = { nodes: lineNodes, nodeSet, distance, maxLayer, condensed, portY, groundY }
    lines.push(line)
    lineNodes.forEach((node) => lineByNode.set(node, line))

    if (condensed) {
      const leading = lineNodes
        .filter((node) => distance.get(node) === FIRST_VISIBLE_CELLS)
        .map((node) => nodePositions.get(node))
        .filter((point): point is Point => Boolean(point))
        .sort((a, b) => a.y - b.y)
      const trailing = lineNodes
        .filter((node) => distance.get(node) === maxLayer - 1)
        .map((node) => nodePositions.get(node))
        .filter((point): point is Point => Boolean(point))
        .sort((a, b) => a.y - b.y)
      const count = Math.max(leading.length, trailing.length)
      for (let index = 0; index < count; index += 1) {
        const left = leading[Math.min(index, leading.length - 1)]
        const right = trailing[Math.min(index, trailing.length - 1)]
        if (left && right) omissions.push({ left, right })
      }
    }

    yCursor = groundY + LINE_GAP
  }

  const visibleNode = (node: string) => nodePositions.has(node)
  const parallelGroups = new Map<string, CircuitPreviewComponent[]>()
  const groundedGroups = new Map<string, CircuitPreviewComponent[]>()
  for (const component of electrical) {
    const grounded = component.node1 === '0' || component.node2 === '0'
    if (grounded) {
      const node = liveNode(component)
      if (!node || node === '0' || !visibleNode(node)) continue
      if (!groundedGroups.has(node)) groundedGroups.set(node, [])
      groundedGroups.get(node)!.push(component)
    } else {
      if (!visibleNode(component.node1) || !visibleNode(component.node2)) continue
      const key = pairKey(component.node1, component.node2)
      if (!parallelGroups.has(key)) parallelGroups.set(key, [])
      parallelGroups.get(key)!.push(component)
    }
  }

  const items: DrawItem[] = []
  for (const group of parallelGroups.values()) {
    group.sort((a, b) => naturalCompare(a.name, b.name)).forEach((component, index) => {
      const p1 = nodePositions.get(component.node1)
      const p2 = nodePositions.get(component.node2)
      if (!p1 || !p2) return

      // Parallel components use pure vertical lane offsets. This keeps every element body
      // horizontal and makes the first/middle/last SNAIL junction pairs visually identical.
      const offset = (index - (group.length - 1) / 2) * 38
      const baseLaneY = Math.abs(p1.y - p2.y) > 1 ? Math.min(p1.y, p2.y) : p1.y
      const laneY = baseLaneY + offset
      const start = { x: p1.x, y: laneY }
      const end = { x: p2.x, y: laneY }
      items.push({
        component,
        start,
        end,
        leadStart: Math.abs(p1.y - laneY) > 0.5 ? p1 : undefined,
        leadEnd: Math.abs(p2.y - laneY) > 0.5 ? p2 : undefined,
      })
    })
  }

  for (const [node, group] of groundedGroups.entries()) {
    const point = nodePositions.get(node)
    const line = lineByNode.get(node)
    if (!point || !line) continue
    const linePorts = group.filter((component) => component.kind === 'P').sort((a, b) => portNumber(a) - portNumber(b))
    const shuntPriority = (component: CircuitPreviewComponent) => component.kind === 'C' ? 0 : component.kind === 'R' ? 1 : 2
    const shunts = group
      .filter((component) => component.kind !== 'P')
      .sort((a, b) => shuntPriority(a) - shuntPriority(b) || naturalCompare(a.name, b.name))

    linePorts.forEach((component, index) => {
      const x = point.x + (index - (linePorts.length - 1) / 2) * 42
      const start = { x, y: point.y }
      items.push({ component, start, end: { x, y: line.portY }, leadStart: x === point.x ? undefined : point, isPort: true })
    })

    shunts.forEach((component, index) => {
      // Keep the node centre clear when a port is present. Shunts alternate left/right with
      // generous spacing so the input/output C and R symbols do not overlap the port lead.
      const offset = linePorts.length > 0
        ? (index % 2 === 0 ? -1 : 1) * (Math.floor(index / 2) + 1) * 54
        : (index - (shunts.length - 1) / 2) * 42
      const x = point.x + offset
      const start = { x, y: point.y }
      items.push({
        component,
        start,
        end: { x, y: line.groundY - 30 },
        leadStart: x === point.x ? undefined : point,
        ground: { x, y: line.groundY },
      })
    })
  }

  const midpointByName = new Map<string, Point>()
  for (const item of items) {
    midpointByName.set(item.component.name, { x: (item.start.x + item.end.x) / 2, y: (item.start.y + item.end.y) / 2 })
  }
  const couplings = data.components
    .filter((component) => component.kind === 'K')
    .map((component) => {
      const start = midpointByName.get(component.node1)
      const end = midpointByName.get(component.node2)
      return start && end ? { component, start, end } : null
    })
    .filter((item): item is { component: CircuitPreviewComponent; start: Point; end: Point } => Boolean(item))

  const allPoints = new Set<Point>(nodePositions.values())
  for (const item of items) {
    allPoints.add(item.start)
    allPoints.add(item.end)
    if (item.leadStart) allPoints.add(item.leadStart)
    if (item.leadEnd) allPoints.add(item.leadEnd)
    if (item.ground) allPoints.add(item.ground)
  }
  for (const coupling of couplings) {
    allPoints.add(coupling.start)
    allPoints.add(coupling.end)
  }
  for (const omission of omissions) {
    allPoints.add(omission.left)
    allPoints.add(omission.right)
  }

  const pointList = [...allPoints]
  const minX = Math.min(40, ...pointList.map((point) => point.x))
  const minY = Math.min(35, ...pointList.map((point) => point.y))
  const shiftX = minX < 40 ? 40 - minX : 0
  const shiftY = minY < 35 ? 35 - minY : 0
  if (shiftX || shiftY) {
    for (const point of allPoints) {
      point.x += shiftX
      point.y += shiftY
    }
  }

  const shiftedPoints = [...allPoints]
  const maxX = Math.max(560, ...shiftedPoints.map((point) => point.x))
  const maxDrawY = Math.max(280, ...shiftedPoints.map((point) => point.y))

  return {
    width: Math.max(620, maxX + 70),
    height: Math.max(340, maxDrawY + 60),
    nodePositions,
    items,
    couplings,
    omissions,
    condensed: lines.some((line) => line.condensed),
  }
}

function engineering(value: number, unit: string) {
  if (value === 0) return `0 ${unit}`
  const prefixes = [
    { factor: 1e-15, symbol: 'f' }, { factor: 1e-12, symbol: 'p' }, { factor: 1e-9, symbol: 'n' },
    { factor: 1e-6, symbol: 'µ' }, { factor: 1e-3, symbol: 'm' }, { factor: 1, symbol: '' },
    { factor: 1e3, symbol: 'k' }, { factor: 1e6, symbol: 'M' }, { factor: 1e9, symbol: 'G' },
  ]
  const abs = Math.abs(value)
  const chosen = prefixes.reduce((best, candidate) => abs >= candidate.factor ? candidate : best, prefixes[0])
  const scaled = value / chosen.factor
  return `${Number(scaled.toPrecision(4))} ${chosen.symbol}${unit}`
}

function displayValue(component: CircuitPreviewComponent) {
  const numeric = typeof component.resolvedValue === 'number' ? component.resolvedValue : Number(component.resolvedValue)
  if (component.kind === 'P') return `Port ${component.resolvedValue ?? component.valueExpression}`
  if (Number.isFinite(numeric)) {
    if (component.kind === 'C') return engineering(numeric, 'F')
    if (component.kind === 'L' || component.kind === 'Lj') return engineering(numeric, 'H')
    if (component.kind === 'R') return engineering(numeric, 'Ω')
    if (component.kind === 'K') return Number(numeric.toPrecision(5)).toString()
    return Number(numeric.toPrecision(5)).toString()
  }
  return String(component.resolvedValue ?? component.valueExpression)
}

function Glyph({ item, selected, onSelect }: { item: DrawItem; selected: boolean; onSelect: () => void }) {
  const theme = useTheme()
  const { component, start, end } = item
  const stroke = selected ? theme.palette.primary.main : theme.palette.text.secondary
  const label = displayValue(component)

  if (item.isPort) {
    return (
      <g role="button" tabIndex={0} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect() }} style={{ cursor: 'pointer' }}>
        {item.leadStart && <line x1={item.leadStart.x} y1={item.leadStart.y} x2={start.x} y2={start.y} stroke={stroke} strokeWidth={selected ? 2.5 : 1.6} />}
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y + 13} stroke={stroke} strokeWidth={selected ? 2.5 : 1.6} />
        <circle cx={end.x} cy={end.y} r={13} fill={theme.palette.background.paper} stroke={stroke} strokeWidth={selected ? 2.5 : 1.6} />
        <text x={end.x} y={end.y + 4} textAnchor="middle" fontSize="10" fill={theme.palette.text.primary}>{String(component.resolvedValue ?? component.valueExpression)}</text>
        <text x={end.x} y={end.y - 20} textAnchor="middle" fontSize="10" fill={theme.palette.text.secondary}>{component.name}</text>
        <title>{`${component.name} · ${label}`}</title>
      </g>
    )
  }

  const symbol = (bodyStroke: string) => {
    if (component.kind === 'R') return <polyline points="-22,0 -16,-9 -10,9 -4,-9 2,9 8,-9 14,9 22,0" fill="none" stroke={bodyStroke} strokeWidth="2" />
    if (component.kind === 'C') return <><line x1="-6" y1="-12" x2="-6" y2="12" stroke={bodyStroke} strokeWidth="2" /><line x1="6" y1="-12" x2="6" y2="12" stroke={bodyStroke} strokeWidth="2" /></>
    if (component.kind === 'L') return <path d="M -22 0 C -18 -12 -12 -12 -8 0 C -4 -12 2 -12 6 0 C 10 -12 16 -12 22 0" fill="none" stroke={bodyStroke} strokeWidth="2" />
    if (component.kind === 'Lj') return <><line x1="-10" y1="-10" x2="10" y2="10" stroke={bodyStroke} strokeWidth="2" /><line x1="10" y1="-10" x2="-10" y2="10" stroke={bodyStroke} strokeWidth="2" /></>
    if (component.kind === 'I' || component.kind === 'V') return <><circle cx="0" cy="0" r="13" fill="none" stroke={bodyStroke} strokeWidth="2" /><line x1="0" y1="7" x2="0" y2="-7" stroke={bodyStroke} strokeWidth="1.5" /><polyline points="-4,-3 0,-8 4,-3" fill="none" stroke={bodyStroke} strokeWidth="1.5" /></>
    return <rect x="-18" y="-10" width="36" height="20" rx="3" fill={theme.palette.background.paper} stroke={bodyStroke} strokeWidth="2" />
  }

  const nodeStart = item.leadStart ?? start
  const nodeEnd = item.leadEnd ?? end
  const canRouteOrthogonally = !item.ground && Math.abs(nodeEnd.x - nodeStart.x) > 1

  if (canRouteOrthogonally) {
    // start/end are already on the horizontal component lane; leadStart/leadEnd are the real
    // electrical nodes. Draw only vertical risers between them, never diagonal connections.
    const laneY = start.y
    const leftX = start.x
    const rightX = end.x
    const length = Math.max(1, Math.abs(rightX - leftX))
    const half = length / 2
    const body = 22
    const centerX = (leftX + rightX) / 2
    const angle = rightX >= leftX ? 0 : 180

    return (
      <g role="button" tabIndex={0} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect() }} style={{ cursor: 'pointer' }}>
        {Math.abs(nodeStart.y - laneY) > 0.5 && <line x1={nodeStart.x} y1={nodeStart.y} x2={start.x} y2={laneY} stroke={stroke} strokeWidth={selected ? 2.5 : 1.6} />}
        {Math.abs(nodeEnd.y - laneY) > 0.5 && <line x1={nodeEnd.x} y1={nodeEnd.y} x2={end.x} y2={laneY} stroke={stroke} strokeWidth={selected ? 2.5 : 1.6} />}
        <g transform={`translate(${centerX} ${laneY}) rotate(${angle})`}>
          <line x1={-half} y1="0" x2={-body} y2="0" stroke={stroke} strokeWidth={selected ? 2.5 : 1.6} />
          <line x1={body} y1="0" x2={half} y2="0" stroke={stroke} strokeWidth={selected ? 2.5 : 1.6} />
          {symbol(stroke)}
        </g>
        <text x={centerX} y={laneY - 16} textAnchor="middle" fontSize="10" fill={theme.palette.text.secondary}>{component.name}</text>
        <title>{`${component.name} · ${component.node1} ↔ ${component.node2} · ${label}`}</title>
      </g>
    )
  }

  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.max(1, Math.hypot(dx, dy))
  const half = length / 2
  const body = 22
  const angle = Math.atan2(dy, dx) * 180 / Math.PI

  return (
    <g role="button" tabIndex={0} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect() }} style={{ cursor: 'pointer' }}>
      {item.leadStart && <line x1={item.leadStart.x} y1={item.leadStart.y} x2={start.x} y2={start.y} stroke={stroke} strokeWidth={selected ? 2.5 : 1.6} />}
      {item.leadEnd && <line x1={item.leadEnd.x} y1={item.leadEnd.y} x2={end.x} y2={end.y} stroke={stroke} strokeWidth={selected ? 2.5 : 1.6} />}
      <g transform={`translate(${(start.x + end.x) / 2} ${(start.y + end.y) / 2}) rotate(${angle})`}>
        <line x1={-half} y1="0" x2={-body} y2="0" stroke={stroke} strokeWidth={selected ? 2.5 : 1.6} />
        <line x1={body} y1="0" x2={half} y2="0" stroke={stroke} strokeWidth={selected ? 2.5 : 1.6} />
        {symbol(stroke)}
      </g>
      <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 16} textAnchor="middle" fontSize="10" fill={theme.palette.text.secondary}>{component.name}</text>
      <title>{`${component.name} · ${component.node1} ↔ ${component.node2} · ${label}`}</title>
    </g>
  )
}

function Ground({ point }: { point: Point }) {
  const theme = useTheme()
  return <g stroke={theme.palette.text.secondary} strokeWidth="1.4"><line x1={point.x} y1={point.y - 30} x2={point.x} y2={point.y - 12} /><line x1={point.x - 12} y1={point.y - 12} x2={point.x + 12} y2={point.y - 12} /><line x1={point.x - 8} y1={point.y - 7} x2={point.x + 8} y2={point.y - 7} /><line x1={point.x - 4} y1={point.y - 2} x2={point.x + 4} y2={point.y - 2} /></g>
}

export function CircuitPreview({ data, loading, error, stale, onGenerate }: {
  data: CircuitPreviewData | null
  loading: boolean
  error: string | null
  stale: boolean
  onGenerate: () => void
}) {
  const theme = useTheme()
  const [zoom, setZoom] = useState<number | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const layout = useMemo(() => data ? buildLayout(data) : null, [data])
  const selected = data?.components.find((component) => component.name === selectedName) ?? null

  if (!data) {
    return (
      <Paper variant="outlined" sx={{ mt: 1.5, p: 2, minHeight: 150, display: 'grid', placeItems: 'center', borderStyle: 'dashed' }}>
        <Stack spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle2">Circuit preview</Typography>
          <Typography variant="body2" color="text.secondary">Generate the resolved circuit from <code>create_user_circuit</code>. This executes the circuit definition but does not run a simulation.</Typography>
          <Button variant="contained" onClick={onGenerate} disabled={loading}>{loading ? 'Generating…' : 'Generate preview'}</Button>
          {error && <Alert severity="error" sx={{ mt: 1, maxWidth: 760 }}>{error}</Alert>}
        </Stack>
      </Paper>
    )
  }

  const parameterEntries = Object.entries(data.parameters)
  const parameterSummary = parameterEntries.slice(0, 5).map(([name, value]) => `${name}=${value}`).join(' · ')
  const svgWidth = zoom === null ? '100%' : Math.max(720, layout!.width * zoom)
  const svgHeight = zoom === null ? 360 : Math.max(320, layout!.height * zoom)

  return (
    <Paper variant="outlined" sx={{ mt: 1.5, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1} sx={{ px: 1.5, py: 1, alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
        <Typography variant="subtitle2">Resolved circuit</Typography>
        <Chip size="small" variant="outlined" label={`${data.nodes.filter((node) => node !== '0').length} nodes`} />
        <Chip size="small" variant="outlined" label={`${data.components.length} components`} />
        <Chip size="small" variant="outlined" label={`${data.portCount} ports`} />
        {stale && <Chip size="small" color="warning" label="Preview out of date" />}
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => setZoom(null)}>Fit</Button>
        <Button size="small" onClick={() => setZoom((current) => Math.max(0.2, (current ?? 0.5) / 1.35))}>−</Button>
        <Button size="small" onClick={() => setZoom((current) => Math.min(2.5, (current ?? 0.5) * 1.35))}>+</Button>
        <Button size="small" variant={stale ? 'contained' : 'outlined'} onClick={onGenerate} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
      </Stack>
      <Box sx={{ px: 1.5, py: 0.7, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">Preview configuration: first value of each parameter{parameterSummary ? ` · ${parameterSummary}${parameterEntries.length > 5 ? ' · …' : ''}` : ''}</Typography>
      </Box>
      {error && <Alert severity="error" sx={{ m: 1.5 }}>{error}</Alert>}
      <Box sx={{ overflow: 'auto', maxHeight: 520, backgroundColor: 'background.default' }}>
        <svg viewBox={`0 0 ${layout!.width} ${layout!.height}`} width={svgWidth} height={svgHeight} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: zoom === null ? undefined : svgWidth }}>
          {layout!.omissions.map((omission, index) => {
            const middleX = (omission.left.x + omission.right.x) / 2
            const middleY = (omission.left.y + omission.right.y) / 2
            const gap = 28
            return (
              <g key={`omission-${index}`}>
                <line x1={omission.left.x} y1={omission.left.y} x2={middleX - gap} y2={middleY} stroke={theme.palette.text.disabled} strokeWidth="1.5" strokeDasharray="5 5" />
                <line x1={middleX + gap} y1={middleY} x2={omission.right.x} y2={omission.right.y} stroke={theme.palette.text.disabled} strokeWidth="1.5" strokeDasharray="5 5" />
                <text x={middleX} y={middleY + 5} textAnchor="middle" fontSize="24" fill={theme.palette.text.secondary}>…</text>
                <title>Middle cells omitted from the drawing</title>
              </g>
            )
          })}
          {layout!.couplings.map(({ component, start, end }) => (
            <g key={component.name} onClick={() => setSelectedName(component.name)} style={{ cursor: 'pointer' }}>
              <path d={`M ${start.x} ${start.y} Q ${(start.x + end.x) / 2} ${Math.min(start.y, end.y) - 42} ${end.x} ${end.y}`} fill="none" stroke={selectedName === component.name ? theme.palette.primary.main : theme.palette.text.disabled} strokeWidth="1.5" strokeDasharray="5 4" />
              <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 24} fontSize="10" textAnchor="middle" fill={theme.palette.text.secondary}>{component.name}</text>
            </g>
          ))}
          {layout!.items.map((item) => <Glyph key={item.component.name} item={item} selected={selectedName === item.component.name} onSelect={() => setSelectedName(item.component.name)} />)}
          {[...layout!.nodePositions.entries()].map(([node, point]) => <g key={node}><circle cx={point.x} cy={point.y} r="3.2" fill={theme.palette.text.primary} /><text x={point.x} y={point.y + 15} textAnchor="middle" fontSize="9" fill={theme.palette.text.disabled}>{node}</text></g>)}
          {layout!.items.filter((item) => item.ground).map((item) => <Ground key={`g-${item.component.name}`} point={item.ground!} />)}
        </svg>
      </Box>
      <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider', minHeight: 42 }}>
        {selected ? (
          <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" color="primary" label={selected.name} />
            <Typography variant="body2"><strong>{selected.node1}</strong> ↔ <strong>{selected.node2}</strong></Typography>
            <Typography variant="body2">{displayValue(selected)}</Typography>
            {String(selected.resolvedValue ?? '') !== selected.valueExpression && <Typography variant="caption" color="text.secondary">expression: {selected.valueExpression}</Typography>}
          </Stack>
        ) : <Typography variant="caption" color="text.secondary">Click a component to inspect its nodes and resolved value.</Typography>}
      </Box>
    </Paper>
  )
}
