/**
 * @obs-scoring/bracket-layout
 * High-performance bracket layout engine for tournament visualization
 *
 * Algorithm: Uses entrant source links from start.gg to build a proper tree
 * - Builds dependency graph (which sets feed into which)
 * - Positions sets recursively based on their feeder matches
 * - Each set is centered between the matches that feed into it
 */

// ============================================================================
// Types
// ============================================================================

/** Set state from start.gg API */
export enum SetState {
  CREATED = 1,
  ACTIVE = 2,
  COMPLETED = 3,
  BYE = 4,
  CALLED = 6,
  QUEUED = 7,
}

/** Input: A set/match from start.gg */
export interface BracketSet {
  id: string
  round: number // Positive = winners, negative = losers
  identifier: string // "A", "B", "AA", etc.
  fullRoundText: string // "Winners Final", "Losers Round 2"
  state: SetState | number
  bestOf?: number
  player1Tag: string | null
  player2Tag: string | null
  player1Prefix?: string | null
  player2Prefix?: string | null
  player1Score: number | null
  player2Score: number | null
  winnerId?: string | null
  // Sources for building the bracket tree
  entrant1Source?: {
    type: string | null // 'set' | 'seed'
    sourceId: string | null // ID of the source set
    condition: string | null // 'winner' | 'loser'
  } | null
  entrant2Source?: {
    type: string | null
    sourceId: string | null
    condition: string | null
  } | null
}

/** Output: A positioned node for rendering */
export interface BracketNode {
  set: BracketSet
  x: number
  y: number
  width: number
  height: number
  column: number
  row: number
  bracket: 'winners' | 'losers' | 'grandFinal'
  connectors: BracketConnector[]
}

/** A line connecting two bracket nodes */
export interface BracketConnector {
  fromNodeId: string
  toNodeId: string
  type: 'winner' | 'loser'
  path: ConnectorPath
}

/** SVG path data for connector */
export interface ConnectorPath {
  startX: number
  startY: number
  endX: number
  endY: number
  controlPoints?: { x: number; y: number }[]
}

/** Layout configuration options */
export interface BracketLayoutOptions {
  matchWidth: number
  matchHeight: number
  columnGap: number
  rowGap: number
  roundGap: number
  direction: 'ltr' | 'rtl'
  showByes: boolean
  compactMode: boolean
}

/** Complete layout result */
export interface BracketLayout {
  nodes: BracketNode[]
  connectors: BracketConnector[]
  /** Round headers - one per column for labeling */
  roundHeaders: RoundHeader[]
  bounds: {
    width: number
    height: number
    winnersHeight: number
    losersHeight: number
  }
  metadata: {
    totalSets: number
    winnersRounds: number
    losersRounds: number
    bracketType: 'single' | 'double'
  }
}

/** Round header for column labeling */
export interface RoundHeader {
  text: string
  x: number
  y: number
  column: number
  bracket: 'winners' | 'losers' | 'grandFinal'
}

export const DEFAULT_OPTIONS: BracketLayoutOptions = {
  matchWidth: 200,
  matchHeight: 60,
  columnGap: 30,
  rowGap: 12,
  roundGap: 50,
  direction: 'ltr',
  showByes: false,
  compactMode: false,
}

// ============================================================================
// Layout Engine
// ============================================================================

export function calculateBracketLayout(
  sets: BracketSet[],
  options: Partial<BracketLayoutOptions> = {}
): BracketLayout {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const filteredSets = opts.showByes ? sets : sets.filter((s) => s.state !== SetState.BYE)

  if (filteredSets.length === 0) {
    return createEmptyLayout()
  }

  const { winners, losers, grandFinal } = separateBrackets(filteredSets)
  const isDoubleElim = losers.length > 0

  // Layout winners bracket
  const winnersNodes = layoutBracketWithSources(winners, opts, 'winners', 0)
  const winnersBottom = getMaxY(winnersNodes, opts.matchHeight)

  // Layout losers bracket below winners
  const losersStartY = winnersBottom + opts.roundGap
  const losersNodes = layoutBracketWithSources(losers, opts, 'losers', losersStartY)
  const losersBottom = getMaxY(losersNodes, opts.matchHeight)

  // Layout grand final
  const gfNodes = layoutGrandFinal(grandFinal, opts, winnersNodes, losersNodes)

  const allNodes = [...winnersNodes, ...losersNodes, ...gfNodes]
  const connectors = calculateConnectorsFromSources(allNodes, opts)
  attachConnectorsToNodes(allNodes, connectors)

  // Generate round headers (one per column per bracket section)
  const roundHeaders = generateRoundHeaders(allNodes, opts, losersStartY)

  const winnersHeight = winnersBottom
  const losersHeight = losersNodes.length > 0 ? losersBottom - losersStartY : 0
  const bounds = calculateBounds(allNodes, winnersHeight, losersHeight)

  return {
    nodes: allNodes,
    connectors,
    roundHeaders,
    bounds,
    metadata: {
      totalSets: filteredSets.length,
      winnersRounds: new Set(winners.map((s) => s.round)).size,
      losersRounds: new Set(losers.map((s) => s.round)).size,
      bracketType: isDoubleElim ? 'double' : 'single',
    },
  }
}

// ============================================================================
// Core Layout Algorithm - Simple Tree Layout
// ============================================================================

/**
 * Layout a bracket using a simple tree algorithm:
 * 1. First round: evenly spaced
 * 2. Later rounds: each match centered between its two feeder matches
 *
 * This guarantees no overlaps because:
 * - First round has fixed spacing
 * - Each subsequent match is between two matches from the previous round
 * - The tree structure naturally provides spacing
 */
function layoutBracketWithSources(
  sets: BracketSet[],
  opts: BracketLayoutOptions,
  bracket: 'winners' | 'losers',
  startY: number
): BracketNode[] {
  if (sets.length === 0) return []

  // Group sets by round and sort rounds
  const roundGroups = groupByRound(sets)
  const rounds = [...roundGroups.keys()].sort((a, b) => {
    if (bracket === 'losers') return Math.abs(a) - Math.abs(b)
    return a - b
  })

  if (rounds.length === 0) return []

  // Sort each round's sets by identifier for consistent ordering
  for (const round of rounds) {
    const roundSets = roundGroups.get(round) || []
    roundSets.sort((a, b) => parseIdentifier(a.identifier) - parseIdentifier(b.identifier))
  }

  const nodes: BracketNode[] = []
  const nodeMap = new Map<string, BracketNode>() // Track positioned nodes by set ID
  const slotHeight = opts.matchHeight + opts.rowGap

  // Process each round
  for (let colIdx = 0; colIdx < rounds.length; colIdx++) {
    const round = rounds[colIdx]!
    const roundSets = roundGroups.get(round) || []

    for (let rowIdx = 0; rowIdx < roundSets.length; rowIdx++) {
      const set = roundSets[rowIdx]!

      // Find feeder nodes (matches that feed into this one)
      const feeder1Id = set.entrant1Source?.type === 'set' ? set.entrant1Source.sourceId : null
      const feeder2Id = set.entrant2Source?.type === 'set' ? set.entrant2Source.sourceId : null

      const feeder1 = feeder1Id ? nodeMap.get(feeder1Id) : null
      const feeder2 = feeder2Id ? nodeMap.get(feeder2Id) : null

      let y: number

      if (feeder1 && feeder2) {
        // Center between the two feeder matches
        const feeder1Center = feeder1.y + opts.matchHeight / 2
        const feeder2Center = feeder2.y + opts.matchHeight / 2
        y = (feeder1Center + feeder2Center) / 2 - opts.matchHeight / 2
      } else if (feeder1) {
        // Align with single feeder
        y = feeder1.y
      } else if (feeder2) {
        // Align with single feeder
        y = feeder2.y
      } else {
        // No feeders (first round) - use even spacing
        y = startY + rowIdx * slotHeight
      }

      const x =
        opts.direction === 'ltr'
          ? colIdx * (opts.matchWidth + opts.columnGap)
          : (rounds.length - 1 - colIdx) * (opts.matchWidth + opts.columnGap)

      const node: BracketNode = {
        set,
        x,
        y,
        width: opts.matchWidth,
        height: opts.matchHeight,
        column: colIdx,
        row: rowIdx,
        bracket,
        connectors: [],
      }

      nodes.push(node)
      nodeMap.set(set.id, node)
    }
  }

  return nodes
}

/**
 * Generate round headers - one label per column per bracket section
 * O(n) complexity
 */
function generateRoundHeaders(
  nodes: BracketNode[],
  opts: BracketLayoutOptions,
  losersStartY: number
): RoundHeader[] {
  const headers: RoundHeader[] = []

  // Group nodes by bracket and column to get unique round labels
  const columnMap = new Map<
    string,
    { text: string; x: number; bracket: BracketNode['bracket']; column: number; minY: number }
  >()

  for (const node of nodes) {
    const key = `${node.bracket}-${node.column}`
    const existing = columnMap.get(key)

    if (!existing || node.y < existing.minY) {
      columnMap.set(key, {
        text: node.set.fullRoundText || `Round ${Math.abs(node.set.round)}`,
        x: node.x + opts.matchWidth / 2,
        bracket: node.bracket,
        column: node.column,
        minY: node.y,
      })
    }
  }

  // Convert to headers with proper Y positioning
  for (const [, data] of columnMap) {
    let y: number
    if (data.bracket === 'winners') {
      y = -25 // Fixed position above winners bracket
    } else if (data.bracket === 'losers') {
      y = losersStartY - 25 // Fixed position above losers bracket
    } else {
      // Grand final - position above the GF matches
      y = data.minY - 25
    }

    headers.push({
      text: data.text,
      x: data.x,
      y,
      column: data.column,
      bracket: data.bracket,
    })
  }

  return headers
}

// ============================================================================
// Helper Functions
// ============================================================================

function createEmptyLayout(): BracketLayout {
  return {
    nodes: [],
    connectors: [],
    roundHeaders: [],
    bounds: { width: 0, height: 0, winnersHeight: 0, losersHeight: 0 },
    metadata: { totalSets: 0, winnersRounds: 0, losersRounds: 0, bracketType: 'single' },
  }
}

function separateBrackets(sets: BracketSet[]) {
  const winners: BracketSet[] = []
  const losers: BracketSet[] = []
  const grandFinal: BracketSet[] = []

  const positiveRounds = sets.filter((s) => s.round > 0).map((s) => s.round)
  const maxRound = positiveRounds.length > 0 ? Math.max(...positiveRounds) : 0
  const hasLosers = sets.some((s) => s.round < 0)

  for (const set of sets) {
    if (set.round < 0) {
      losers.push(set)
    } else if (hasLosers && set.round === maxRound) {
      grandFinal.push(set)
    } else {
      winners.push(set)
    }
  }

  return { winners, losers, grandFinal }
}

function getMaxY(nodes: BracketNode[], matchHeight: number): number {
  if (nodes.length === 0) return 0
  return Math.max(...nodes.map((n) => n.y + matchHeight))
}

function parseIdentifier(id: string): number {
  if (!id) return 0
  let result = 0
  const upper = id.toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    const charCode = upper.charCodeAt(i) - 65
    if (charCode < 0 || charCode > 25) continue
    result = result * 26 + charCode + 1
  }
  return result - 1
}

function groupByRound(sets: BracketSet[]): Map<number, BracketSet[]> {
  const groups = new Map<number, BracketSet[]>()
  for (const set of sets) {
    const existing = groups.get(set.round) || []
    existing.push(set)
    groups.set(set.round, existing)
  }
  return groups
}

function layoutGrandFinal(
  sets: BracketSet[],
  opts: BracketLayoutOptions,
  winnersNodes: BracketNode[],
  losersNodes: BracketNode[]
): BracketNode[] {
  if (sets.length === 0) return []

  const sortedSets = [...sets].sort(
    (a, b) => parseIdentifier(a.identifier) - parseIdentifier(b.identifier)
  )

  const maxWinnersCol =
    winnersNodes.length > 0 ? Math.max(...winnersNodes.map((n) => n.column)) : -1
  const maxLosersCol = losersNodes.length > 0 ? Math.max(...losersNodes.map((n) => n.column)) : -1
  const gfColumn = Math.max(maxWinnersCol, maxLosersCol) + 1

  const winnersFinal = winnersNodes.find((n) => n.column === maxWinnersCol)
  const losersFinal = losersNodes.find((n) => n.column === maxLosersCol)

  let centerY: number
  if (winnersFinal && losersFinal) {
    const wfCenter = winnersFinal.y + opts.matchHeight / 2
    const lfCenter = losersFinal.y + opts.matchHeight / 2
    centerY = (wfCenter + lfCenter) / 2 - opts.matchHeight / 2
  } else if (winnersFinal) {
    centerY = winnersFinal.y
  } else if (losersFinal) {
    centerY = losersFinal.y
  } else {
    centerY = 0
  }

  const nodes: BracketNode[] = []
  for (let i = 0; i < sortedSets.length; i++) {
    const set = sortedSets[i]!
    const x = opts.direction === 'ltr' ? gfColumn * (opts.matchWidth + opts.columnGap) : 0
    const y = centerY + i * (opts.matchHeight + opts.rowGap)

    nodes.push({
      set,
      x,
      y,
      width: opts.matchWidth,
      height: opts.matchHeight,
      column: gfColumn,
      row: i,
      bracket: 'grandFinal',
      connectors: [],
    })
  }

  return nodes
}

function calculateConnectorsFromSources(
  nodes: BracketNode[],
  opts: BracketLayoutOptions
): BracketConnector[] {
  const connectors: BracketConnector[] = []
  const nodeMap = new Map(nodes.map((n) => [n.set.id, n]))

  for (const node of nodes) {
    const set = node.set

    if (set.entrant1Source?.type === 'set' && set.entrant1Source.sourceId) {
      const sourceNode = nodeMap.get(set.entrant1Source.sourceId)
      if (sourceNode) {
        const type = set.entrant1Source.condition === 'loser' ? 'loser' : 'winner'
        connectors.push(createConnector(sourceNode, node, type, opts))
      }
    }

    if (set.entrant2Source?.type === 'set' && set.entrant2Source.sourceId) {
      const sourceNode = nodeMap.get(set.entrant2Source.sourceId)
      if (sourceNode) {
        const type = set.entrant2Source.condition === 'loser' ? 'loser' : 'winner'
        connectors.push(createConnector(sourceNode, node, type, opts))
      }
    }
  }

  return connectors
}

function createConnector(
  from: BracketNode,
  to: BracketNode,
  type: 'winner' | 'loser',
  _opts: BracketLayoutOptions
): BracketConnector {
  const startX = from.x + from.width
  const startY = from.y + from.height / 2
  const endX = to.x
  const endY = to.y + to.height / 2
  const midX = (startX + endX) / 2

  return {
    fromNodeId: from.set.id,
    toNodeId: to.set.id,
    type,
    path: {
      startX,
      startY,
      endX,
      endY,
      controlPoints: [
        { x: midX, y: startY },
        { x: midX, y: endY },
      ],
    },
  }
}

function attachConnectorsToNodes(nodes: BracketNode[], connectors: BracketConnector[]): void {
  const nodeMap = new Map(nodes.map((n) => [n.set.id, n]))
  for (const connector of connectors) {
    const fromNode = nodeMap.get(connector.fromNodeId)
    if (fromNode) {
      fromNode.connectors.push(connector)
    }
  }
}

function calculateBounds(
  nodes: BracketNode[],
  winnersHeight: number,
  losersHeight: number
): BracketLayout['bounds'] {
  if (nodes.length === 0) {
    return { width: 0, height: 0, winnersHeight: 0, losersHeight: 0 }
  }
  const maxX = Math.max(...nodes.map((n) => n.x + n.width))
  const maxY = Math.max(...nodes.map((n) => n.y + n.height))
  return { width: maxX, height: maxY, winnersHeight, losersHeight }
}

// ============================================================================
// Utility Functions (exported)
// ============================================================================

export function getSetStateText(state: SetState | number): string {
  switch (state) {
    case SetState.CREATED:
      return 'Upcoming'
    case SetState.ACTIVE:
      return 'In Progress'
    case SetState.COMPLETED:
      return 'Completed'
    case SetState.BYE:
      return 'Bye'
    case SetState.CALLED:
      return 'Called'
    case SetState.QUEUED:
      return 'Queued'
    default:
      return 'Unknown'
  }
}

export function getSetStateClass(state: SetState | number): string {
  switch (state) {
    case SetState.CREATED:
      return 'state-upcoming'
    case SetState.ACTIVE:
      return 'state-active'
    case SetState.COMPLETED:
      return 'state-completed'
    case SetState.BYE:
      return 'state-bye'
    case SetState.CALLED:
      return 'state-called'
    case SetState.QUEUED:
      return 'state-queued'
    default:
      return 'state-unknown'
  }
}

export function connectorToSvgPath(connector: BracketConnector): string {
  const { startX, startY, endX, endY, controlPoints } = connector.path
  if (controlPoints && controlPoints.length >= 2) {
    const cp1 = controlPoints[0]!
    const cp2 = controlPoints[1]!
    return `M ${startX} ${startY} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${endX} ${endY}`
  }
  return `M ${startX} ${startY} L ${endX} ${endY}`
}

export function isNodeVisible(
  node: BracketNode,
  viewport: { x: number; y: number; width: number; height: number },
  padding: number = 50
): boolean {
  return (
    node.x + node.width + padding >= viewport.x &&
    node.x - padding <= viewport.x + viewport.width &&
    node.y + node.height + padding >= viewport.y &&
    node.y - padding <= viewport.y + viewport.height
  )
}

export function getVisibleNodes(
  nodes: BracketNode[],
  viewport: { x: number; y: number; width: number; height: number },
  padding: number = 50
): BracketNode[] {
  return nodes.filter((node) => isNodeVisible(node, viewport, padding))
}
