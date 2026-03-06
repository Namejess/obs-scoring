<script setup lang="ts">
/**
 * BracketTree.vue - High-performance tournament bracket visualization
 *
 * Dark theme inspired by start.gg
 * Uses @obs-scoring/bracket-layout for layout calculation
 * Renders with SVG for interactivity and crisp text
 * Supports pan/zoom for large brackets
 */
import { computed, ref, watch, onMounted } from 'vue'
import {
  calculateBracketLayout,
  type BracketSet,
  type BracketNode,
  type BracketConnector,
  type BracketLayoutOptions,
  connectorToSvgPath,
} from '@obs-scoring/bracket-layout'

// ═══════════════════════════════════════════════════════════════════════════
// Theme Configuration - start.gg style dark theme
// ═══════════════════════════════════════════════════════════════════════════
const theme = {
  // Background colors
  bgPrimary: '#1a1a2e', // Main background
  bgSecondary: '#16162a', // Deeper background
  bgMatch: '#252541', // Match card background
  bgMatchHover: '#2d2d4a', // Match card hover
  bgMatchActive: '#2a2a45', // Active match background
  bgMatchSelected: '#1e3a5f', // Selected match background

  // Border colors
  borderDefault: '#3a3a5c', // Default border
  borderHover: '#4a4a6c', // Hover border
  borderActive: '#f59e0b', // Active match border (amber)
  borderSelected: '#3b82f6', // Selected match border (blue)
  borderCompleted: '#2d2d4a', // Completed match border

  // Text colors
  textPrimary: '#ffffff', // Primary text
  textSecondary: '#a0a0b8', // Secondary text (tags, rounds)
  textMuted: '#6b6b85', // Muted text (TBD, etc.)
  textWinner: '#10b981', // Winner score (green)
  textLoser: '#6b6b85', // Loser score

  // Connector colors
  connectorWinner: '#10b981', // Winner path (green)
  connectorLoser: '#ef4444', // Loser path (red)
  connectorDefault: '#4a4a6c', // Default connector

  // Control panel
  controlBg: '#252541',
  controlBorder: '#3a3a5c',
  controlHover: '#2d2d4a',
  controlText: '#a0a0b8',
} as const

const props = withDefaults(
  defineProps<{
    sets: BracketSet[]
    selectedSetId?: string | null
    highlightedSetId?: string | null
    options?: Partial<BracketLayoutOptions>
  }>(),
  {
    selectedSetId: null,
    highlightedSetId: null,
    options: () => ({}),
  }
)

const emit = defineEmits<{
  (e: 'select', setId: string, set: BracketSet): void
  (e: 'hover', setId: string | null): void
}>()

// ═══════════════════════════════════════════════════════════════════════════
// Layout computation - Compact like start.gg
// ═══════════════════════════════════════════════════════════════════════════
const layoutOptions = computed<Partial<BracketLayoutOptions>>(() => ({
  matchWidth: 180, // Compact width like start.gg
  matchHeight: 52, // Compact height (2 players)
  columnGap: 35, // Tight column spacing
  rowGap: 8, // Very tight row spacing like start.gg
  direction: 'ltr' as const,
  compactMode: true, // Enable compact mode
  showGrandFinal: true,
  ...props.options,
}))

const layout = computed(() => {
  if (!props.sets || props.sets.length === 0) return null
  return calculateBracketLayout(props.sets, layoutOptions.value as BracketLayoutOptions)
})

// ═══════════════════════════════════════════════════════════════════════════
// Pan and zoom state - Extended range for large brackets
// ═══════════════════════════════════════════════════════════════════════════
const containerRef = ref<HTMLDivElement | null>(null)
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const lastPanPoint = ref({ x: 0, y: 0 })

// Zoom limits - Extended for better exploration
const MIN_SCALE = 0.5 // 50% minimum (not too small)
const MAX_SCALE = 8.0 // 800% maximum (very close zoom)
const ZOOM_STEP = 0.25 // Larger zoom step for buttons

// Computed viewBox - Fixed size, zoom/pan handled by transform
const viewBox = computed(() => {
  if (!layout.value) return '0 0 1200 800'
  const { width, height } = layout.value.bounds
  const padding = 40
  return `${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`
})

// SVG transform for pan/zoom
const svgTransform = computed(() => {
  return `translate(${panX.value}, ${panY.value}) scale(${scale.value})`
})

// ═══════════════════════════════════════════════════════════════════════════
// Match colors based on state - Dark theme
// ═══════════════════════════════════════════════════════════════════════════
function getMatchColors(node: BracketNode) {
  const isSelected = node.set.id === props.selectedSetId
  const isHighlighted = node.set.id === props.highlightedSetId
  const isCompleted = node.set.state === 3
  const isActive = node.set.state === 2

  if (isSelected) {
    return {
      bg: theme.bgMatchSelected,
      border: theme.borderSelected,
      text: theme.textPrimary,
      divider: '#3a5a8c',
    }
  }
  if (isHighlighted) {
    return {
      bg: theme.bgMatchHover,
      border: theme.borderHover,
      text: theme.textPrimary,
      divider: theme.borderDefault,
    }
  }
  if (isActive) {
    return {
      bg: theme.bgMatchActive,
      border: theme.borderActive,
      text: theme.textPrimary,
      divider: theme.borderDefault,
    }
  }
  if (isCompleted) {
    return {
      bg: theme.bgMatch,
      border: theme.borderCompleted,
      text: theme.textSecondary,
      divider: theme.borderDefault,
    }
  }
  // Pending/default
  return {
    bg: theme.bgMatch,
    border: theme.borderDefault,
    text: theme.textMuted,
    divider: theme.borderDefault,
  }
}

function getScoreColor(player: 'p1' | 'p2', node: BracketNode) {
  if (node.set.state !== 3) return theme.textSecondary // Not completed
  const p1Score = node.set.player1Score ?? 0
  const p2Score = node.set.player2Score ?? 0
  const isWinner = (player === 'p1' && p1Score > p2Score) || (player === 'p2' && p2Score > p1Score)
  return isWinner ? theme.textWinner : theme.textLoser
}

function getPlayerTextColor(player: 'p1' | 'p2', node: BracketNode) {
  if (node.set.state !== 3) return getMatchColors(node).text
  const p1Score = node.set.player1Score ?? 0
  const p2Score = node.set.player2Score ?? 0
  const isWinner = (player === 'p1' && p1Score > p2Score) || (player === 'p2' && p2Score > p1Score)
  return isWinner ? theme.textPrimary : theme.textMuted
}

// ═══════════════════════════════════════════════════════════════════════════
// Event handlers
// ═══════════════════════════════════════════════════════════════════════════
function handleMatchClick(node: BracketNode) {
  emit('select', node.set.id, node.set)
}

function handleMatchHover(node: BracketNode | null) {
  emit('hover', node?.set.id ?? null)
}

// Pan handlers - Direct pixel movement (amplified for responsiveness)
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  isPanning.value = true
  lastPanPoint.value = { x: e.clientX, y: e.clientY }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!isPanning.value) return
  const dx = e.clientX - lastPanPoint.value.x
  const dy = e.clientY - lastPanPoint.value.y
  // Direct 1:1 pixel movement - very responsive
  panX.value += dx * 2.5 // Amplified for faster panning
  panY.value += dy * 2.5
  lastPanPoint.value = { x: e.clientX, y: e.clientY }
}

function onPointerUp() {
  isPanning.value = false
}

// Zoom with wheel - Zoom towards mouse position
function onWheel(e: WheelEvent) {
  e.preventDefault()
  e.stopPropagation()

  if (!containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  // Mouse position relative to container center
  const mouseX = e.clientX - rect.left - rect.width / 2
  const mouseY = e.clientY - rect.top - rect.height / 2

  const oldScale = scale.value
  const delta = e.deltaY > 0 ? -0.2 : 0.2
  const newScale = Math.min(Math.max(oldScale + delta, MIN_SCALE), MAX_SCALE)

  if (newScale !== oldScale) {
    // Adjust pan to zoom towards mouse position
    const scaleRatio = newScale / oldScale
    panX.value = mouseX - (mouseX - panX.value) * scaleRatio
    panY.value = mouseY - (mouseY - panY.value) * scaleRatio
    scale.value = newScale
  }
}

// Zoom controls
function zoomIn() {
  scale.value = Math.min(scale.value + ZOOM_STEP, MAX_SCALE)
}

function zoomOut() {
  scale.value = Math.max(scale.value - ZOOM_STEP, MIN_SCALE)
}

// Fit to view - Shows full bracket
function fitToView() {
  if (!containerRef.value || !layout.value) {
    scale.value = 1
    panX.value = 0
    panY.value = 0
    return
  }

  const container = containerRef.value.getBoundingClientRect()
  const { width: contentWidth, height: contentHeight } = layout.value.bounds

  // Calculate scale to fit content with padding
  const padding = 80
  const scaleX = (container.width - padding) / contentWidth
  const scaleY = (container.height - padding) / contentHeight
  // Use the smaller scale to fit both dimensions
  const fitScale = Math.min(scaleX, scaleY)

  scale.value = Math.max(fitScale, MIN_SCALE) // At least MIN_SCALE
  panX.value = 0
  panY.value = 0
}

// Reset to readable view (100% zoom, centered)
function resetView() {
  scale.value = 1 // Start at 100%
  panX.value = 0
  panY.value = 0
}

// ═══════════════════════════════════════════════════════════════════════════
// Connector styling
// ═══════════════════════════════════════════════════════════════════════════
function getConnectorColor(connector: BracketConnector) {
  return connector.type === 'winner' ? theme.connectorWinner : theme.connectorLoser
}

function getConnectorOpacity(connector: BracketConnector) {
  return connector.type === 'winner' ? 0.7 : 0.5
}

// Auto-reset to 100% ONLY on first load, not on refresh
const isFirstLoad = ref(true)
watch(
  () => props.sets.length, // Watch length only, not the whole array
  (newLen, oldLen) => {
    // Only reset if we go from 0 sets to having sets (first load)
    if (isFirstLoad.value && newLen > 0 && oldLen === 0) {
      scale.value = 1
      panX.value = 0
      panY.value = 0
      isFirstLoad.value = false
    }
    // Don't reset zoom on subsequent updates (auto-refresh)
  }
)

// No auto-reset on mount - let watch handle first load
onMounted(() => {
  // Only set initial values if no sets yet
  if (props.sets.length === 0) {
    scale.value = 1
    panX.value = 0
    panY.value = 0
  }
})

// Expose for parent components
defineExpose({ fitToView, resetView, scale, panX, panY })
</script>

<template>
  <div
    ref="containerRef"
    class="bracket-tree"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel.prevent.stop="onWheel"
  >
    <!-- Controls - Dark themed -->
    <div class="bracket-controls">
      <button @click="zoomIn" title="Zoom avant" class="control-btn">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      <button @click="zoomOut" title="Zoom arrière" class="control-btn">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      <button @click="resetView" title="Ajuster à la vue" class="control-btn">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      </button>
      <div class="zoom-divider"></div>
      <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
    </div>

    <!-- Empty state - Dark themed -->
    <div v-if="!layout || layout.nodes.length === 0" class="bracket-empty">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        opacity="0.4"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
      <p>Aucun bracket disponible</p>
    </div>

    <!-- SVG Bracket -->
    <svg v-else class="bracket-svg" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
      <!-- Background pattern for visual interest -->
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            :stroke="theme.borderDefault"
            stroke-width="0.5"
            opacity="0.15"
          />
        </pattern>
      </defs>

      <g :transform="svgTransform">
        <!-- Subtle grid background -->
        <rect
          v-if="layout"
          :x="-100"
          :y="-100"
          :width="layout.bounds.width + 200"
          :height="layout.bounds.height + 200"
          fill="url(#grid)"
        />

        <!-- Connectors (rendered first, behind matches) -->
        <g class="connectors">
          <path
            v-for="(connector, idx) in layout.connectors"
            :key="`connector-${idx}`"
            :d="connectorToSvgPath(connector)"
            :stroke="getConnectorColor(connector)"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            :opacity="getConnectorOpacity(connector)"
            class="connector-path"
          />
        </g>

        <!-- Round headers (one per column) -->
        <g class="round-headers">
          <text
            v-for="(header, idx) in layout.roundHeaders"
            :key="`header-${idx}`"
            :x="header.x"
            :y="header.y"
            text-anchor="middle"
            class="round-header-label"
            font-size="12"
            font-weight="600"
            :fill="theme.textMuted"
          >
            {{ header.text }}
          </text>
        </g>

        <!-- Match nodes -->
        <g class="match-nodes">
          <g
            v-for="node in layout.nodes"
            :key="node.set.id"
            class="match-node"
            :transform="`translate(${node.x}, ${node.y})`"
            @click="handleMatchClick(node)"
            @mouseenter="handleMatchHover(node)"
            @mouseleave="handleMatchHover(null)"
          >
            <!-- Drop shadow -->
            <rect
              :width="node.width"
              :height="node.height"
              rx="6"
              fill="rgba(0,0,0,0.3)"
              transform="translate(2, 2)"
            />

            <!-- Background -->
            <rect
              :width="node.width"
              :height="node.height"
              rx="6"
              :fill="getMatchColors(node).bg"
              :stroke="getMatchColors(node).border"
              stroke-width="1.5"
              class="match-bg"
            />

            <!-- Match identifier badge -->
            <g v-if="node.set.identifier" class="match-id-badge">
              <rect
                :x="node.width - 28"
                y="-6"
                width="24"
                height="14"
                rx="3"
                :fill="theme.bgSecondary"
                :stroke="theme.borderDefault"
                stroke-width="0.5"
              />
              <text
                :x="node.width - 16"
                y="4"
                text-anchor="middle"
                font-size="9"
                font-weight="600"
                :fill="theme.textMuted"
              >
                {{ node.set.identifier }}
              </text>
            </g>

            <!-- Player 1 row -->
            <g class="player player-1" transform="translate(0, 0)">
              <rect :width="node.width" :height="node.height / 2" fill="transparent" rx="6" />

              <!-- Player tag with prefix -->
              <text
                x="12"
                :y="node.height / 4 + 5"
                font-size="13"
                font-weight="600"
                :fill="getPlayerTextColor('p1', node)"
                class="player-tag"
              >
                <tspan v-if="node.set.player1Prefix" :fill="theme.textMuted" font-weight="400">
                  {{ node.set.player1Prefix }} |
                </tspan>
                {{ node.set.player1Tag || 'TBD' }}
              </text>

              <!-- Score box -->
              <rect
                :x="node.width - 36"
                y="4"
                width="28"
                :height="node.height / 2 - 8"
                rx="4"
                :fill="
                  node.set.state === 3 &&
                  (node.set.player1Score ?? 0) > (node.set.player2Score ?? 0)
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'transparent'
                "
              />
              <text
                :x="node.width - 22"
                :y="node.height / 4 + 5"
                text-anchor="middle"
                font-size="14"
                font-weight="700"
                :fill="getScoreColor('p1', node)"
                class="player-score"
              >
                {{ node.set.state >= 2 ? (node.set.player1Score ?? 0) : '-' }}
              </text>
            </g>

            <!-- Divider line -->
            <line
              x1="8"
              :y1="node.height / 2"
              :x2="node.width - 8"
              :y2="node.height / 2"
              :stroke="getMatchColors(node).divider"
              stroke-width="1"
            />

            <!-- Player 2 row -->
            <g class="player player-2" :transform="`translate(0, ${node.height / 2})`">
              <rect :width="node.width" :height="node.height / 2" fill="transparent" rx="6" />

              <!-- Player tag with prefix -->
              <text
                x="12"
                :y="node.height / 4 + 5"
                font-size="13"
                font-weight="600"
                :fill="getPlayerTextColor('p2', node)"
                class="player-tag"
              >
                <tspan v-if="node.set.player2Prefix" :fill="theme.textMuted" font-weight="400">
                  {{ node.set.player2Prefix }} |
                </tspan>
                {{ node.set.player2Tag || 'TBD' }}
              </text>

              <!-- Score box -->
              <rect
                :x="node.width - 36"
                y="4"
                width="28"
                :height="node.height / 2 - 8"
                rx="4"
                :fill="
                  node.set.state === 3 &&
                  (node.set.player2Score ?? 0) > (node.set.player1Score ?? 0)
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'transparent'
                "
              />
              <text
                :x="node.width - 22"
                :y="node.height / 4 + 5"
                text-anchor="middle"
                font-size="14"
                font-weight="700"
                :fill="getScoreColor('p2', node)"
                class="player-score"
              >
                {{ node.set.state >= 2 ? (node.set.player2Score ?? 0) : '-' }}
              </text>
            </g>

            <!-- Active match indicator (pulsing border) -->
            <rect
              v-if="node.set.state === 2"
              :width="node.width"
              :height="node.height"
              rx="6"
              fill="none"
              :stroke="theme.borderActive"
              stroke-width="2"
              class="active-indicator"
            />

            <!-- Selection ring -->
            <rect
              v-if="node.set.id === selectedSetId"
              :width="node.width + 4"
              :height="node.height + 4"
              x="-2"
              y="-2"
              rx="8"
              fill="none"
              :stroke="theme.borderSelected"
              stroke-width="3"
              class="selection-ring"
            />
          </g>
        </g>
      </g>
    </svg>

    <!-- Legend - Dark themed -->
    <div class="bracket-legend">
      <span class="legend-item">
        <span class="legend-dot active"></span>
        En cours
      </span>
      <span class="legend-item">
        <span class="legend-dot completed"></span>
        Terminé
      </span>
      <span class="legend-item">
        <span class="legend-connector winner"></span>
        Winner
      </span>
      <span class="legend-item">
        <span class="legend-connector loser"></span>
        Loser
      </span>
    </div>

    <!-- Keyboard shortcuts hint -->
    <div class="shortcuts-hint">
      <span>Scroll: Zoom</span>
      <span>Drag: Pan</span>
    </div>
  </div>
</template>

<style scoped>
.bracket-tree {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 500px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%);
  border-radius: 12px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.bracket-tree:active {
  cursor: grabbing;
}

/* Controls - Dark theme */
.bracket-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  align-items: center;
  z-index: 10;
  background: rgba(37, 37, 65, 0.95);
  backdrop-filter: blur(8px);
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #3a3a5c;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.control-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #3a3a5c;
  border-radius: 6px;
  background: #1a1a2e;
  color: #a0a0b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.control-btn:hover {
  background: #2d2d4a;
  border-color: #4a4a6c;
  color: #ffffff;
}

.control-btn:active {
  transform: scale(0.95);
}

.zoom-divider {
  width: 1px;
  height: 20px;
  background: #3a3a5c;
  margin: 0 4px;
}

.zoom-level {
  font-size: 12px;
  font-weight: 600;
  color: #a0a0b8;
  min-width: 45px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* Empty state - Dark theme */
.bracket-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: #6b6b85;
}

.bracket-empty p {
  margin: 0;
  font-size: 14px;
}

/* SVG */
.bracket-svg {
  width: 100%;
  height: 100%;
}

/* Connectors */
.connector-path {
  transition: opacity 0.2s ease;
}

.connector-path:hover {
  opacity: 1 !important;
}

/* Match nodes */
.match-node {
  cursor: pointer;
}

.match-node:hover .match-bg {
  filter: brightness(1.1);
}

.match-bg {
  transition:
    filter 0.15s ease,
    fill 0.15s ease;
}

.round-label {
  pointer-events: none;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.player-tag {
  /* Prevent text overflow */
}

.player-score {
  font-variant-numeric: tabular-nums;
}

.player-seed {
  font-variant-numeric: tabular-nums;
}

/* Active match pulse animation */
.active-indicator {
  animation: pulse-active 2s ease-in-out infinite;
}

@keyframes pulse-active {
  0%,
  100% {
    opacity: 1;
    stroke-width: 2;
  }
  50% {
    opacity: 0.5;
    stroke-width: 3;
  }
}

/* Selection ring animation */
.selection-ring {
  pointer-events: none;
  animation: pulse-ring 1.5s ease-in-out infinite;
}

@keyframes pulse-ring {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* Legend - Dark theme */
.bracket-legend {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  gap: 16px;
  background: rgba(37, 37, 65, 0.95);
  backdrop-filter: blur(8px);
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #3a3a5c;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  font-size: 11px;
  color: #a0a0b8;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.active {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
}

.legend-dot.completed {
  background: #3a3a5c;
}

.legend-connector {
  width: 20px;
  height: 3px;
  border-radius: 2px;
}

.legend-connector.winner {
  background: #10b981;
}

.legend-connector.loser {
  background: #ef4444;
}

/* Shortcuts hint */
.shortcuts-hint {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: #6b6b85;
  background: rgba(37, 37, 65, 0.7);
  padding: 4px 8px;
  border-radius: 4px;
}

.shortcuts-hint span {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .bracket-legend {
    gap: 10px;
    padding: 6px 10px;
    font-size: 10px;
  }

  .shortcuts-hint {
    display: none;
  }

  .bracket-controls {
    padding: 4px 6px;
  }

  .control-btn {
    width: 28px;
    height: 28px;
  }
}
</style>
