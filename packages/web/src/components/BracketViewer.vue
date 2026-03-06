<script setup lang="ts">
/**
 * BracketViewer.vue - Intégration de brackets-viewer.js
 *
 * Charge la librairie brackets-viewer.js dynamiquement et l'utilise
 * pour afficher les brackets de tournoi.
 */
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import type { StartggSet } from '@/composables/useStartgg'
import { convertStartggToBracketsViewer } from '@/utils/startggToBracketsViewer'

const BRACKETS_VIEWER_CSS =
  'https://cdn.jsdelivr.net/npm/brackets-viewer@1.9.0/dist/brackets-viewer.min.css'
const BRACKETS_VIEWER_JS =
  'https://cdn.jsdelivr.net/npm/brackets-viewer@1.9.0/dist/brackets-viewer.min.js'

const props = defineProps<{
  sets: StartggSet[]
  eventName: string | undefined
  selectedSetId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', setId: string, set: StartggSet): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const error = ref<string | null>(null)
const loading = ref(true)

// Map pour retrouver les données StartggSet à partir de l'ID interne brackets-viewer
const matchIdToSetId = ref<Map<number, string>>(new Map())

// Load script dynamically
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

// Load CSS dynamically
function loadCSS(href: string): void {
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

// Setup click handlers pour la sélection de match
function setupMatchClickHandlers() {
  if (!containerRef.value) return

  // Trouver tous les matches dans le bracket
  const matches = containerRef.value.querySelectorAll('.match')

  matches.forEach((matchEl) => {
    matchEl.addEventListener('click', handleMatchClick)
  })
}

// Handler pour le clic sur un match
function handleMatchClick(e: Event) {
  const matchEl = (e.currentTarget as HTMLElement).closest('.match')
  if (!matchEl) return

  // Récupérer l'ID du match depuis l'attribut data
  const matchId = matchEl.getAttribute('data-match-id')
  if (!matchId) return

  const numericId = parseInt(matchId, 10)
  const setId = matchIdToSetId.value.get(numericId)

  if (setId) {
    const set = props.sets.find((s) => s.id === setId)
    if (set) {
      // Mettre à jour la sélection visuelle
      updateSelectedMatch(setId)
      emit('select', setId, set)
    }
  }
}

// Mettre à jour la classe selected sur le bon match
function updateSelectedMatch(setId: string | null) {
  if (!containerRef.value) return

  // Retirer la sélection de tous les matches
  containerRef.value.querySelectorAll('.match.selected').forEach((el) => {
    el.classList.remove('selected')
  })

  if (!setId) return

  // Trouver le match correspondant et ajouter la classe selected
  const numericId = [...matchIdToSetId.value.entries()].find(([, sid]) => sid === setId)?.[0]
  if (numericId !== undefined) {
    const matchEl = containerRef.value.querySelector(`.match[data-match-id="${numericId}"]`)
    if (matchEl) {
      matchEl.classList.add('selected')
    }
  }
}

async function renderBracket() {
  if (!containerRef.value || !props.sets.length) {
    loading.value = false
    return
  }

  error.value = null
  loading.value = true

  try {
    // Load CSS first
    loadCSS(BRACKETS_VIEWER_CSS)

    // Load JS
    await loadScript(BRACKETS_VIEWER_JS)

    // Convert start.gg data to brackets-viewer format
    const data = convertStartggToBracketsViewer(props.sets, props.eventName || 'Tournament')

    if (!data.matches.length) {
      error.value = 'Aucun match à afficher'
      loading.value = false
      return
    }

    // Build the matchId -> setId mapping
    matchIdToSetId.value.clear()
    if (data.matchIdToSetId) {
      data.matchIdToSetId.forEach((setId, matchId) => {
        matchIdToSetId.value.set(matchId, setId)
      })
    }

    // Clear container
    containerRef.value.innerHTML = ''

    // Use global bracketsViewer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewer = (window as any).bracketsViewer

    if (!viewer) {
      throw new Error('brackets-viewer not loaded')
    }

    // Render the bracket
    await viewer.render(
      {
        stages: data.stages,
        matches: data.matches,
        matchGames: data.matchGames,
        participants: data.participants,
      },
      {
        selector: '.brackets-viewer',
        participantOriginPlacement: 'before',
        separatedChildCountLabel: true,
        showSlotsOrigin: true,
        showLowerBracketSlotsOrigin: true,
        highlightParticipantOnHover: true,
      }
    )

    // Setup click handlers after render
    await nextTick()
    setupMatchClickHandlers()

    // Appliquer la sélection initiale si présente
    if (props.selectedSetId) {
      updateSelectedMatch(props.selectedSetId)
    }

    loading.value = false
  } catch (err) {
    console.error('Erreur lors du rendu du bracket:', err)
    error.value = `Erreur: ${err instanceof Error ? err.message : 'Inconnue'}`
    loading.value = false
  }
}

// Watch pour la sélection externe
watch(
  () => props.selectedSetId,
  (newId) => {
    updateSelectedMatch(newId ?? null)
  }
)

onMounted(async () => {
  await nextTick()
  renderBracket()
})

watch(
  () => props.sets,
  async () => {
    await nextTick()
    renderBracket()
  },
  { deep: true }
)

onUnmounted(() => {
  // Cleanup click handlers
  if (containerRef.value) {
    const matches = containerRef.value.querySelectorAll('.match')
    matches.forEach((matchEl) => {
      matchEl.removeEventListener('click', handleMatchClick)
    })
  }
})
</script>

<template>
  <div class="bracket-viewer-wrapper">
    <div v-if="loading" class="bracket-loading">
      <div class="loading-spinner"></div>
      <span>Chargement du bracket...</span>
    </div>
    <div v-if="error" class="bracket-error">
      {{ error }}
    </div>
    <!-- Container toujours présent pour brackets-viewer -->
    <div
      ref="containerRef"
      class="brackets-viewer brackets-container"
      :class="{ hidden: loading || error }"
    ></div>
  </div>
</template>

<style scoped>
.bracket-viewer-wrapper {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #1a1a2e;
}

.brackets-container {
  min-width: 100%;
  min-height: 100%;
}

.brackets-container.hidden {
  display: none;
}

.bracket-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  color: #a0a0b8;
  gap: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #3a3a5c;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.bracket-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #ef4444;
  font-size: 1rem;
  padding: 2rem;
}
</style>

<style>
/* Override brackets-viewer CSS variables pour dark theme start.gg style */
.brackets-viewer {
  /* Couleurs principales */
  --primary-background: #1a1a2e !important;
  --secondary-background: #252541 !important;
  --match-background: #252541 !important;
  --font-color: #e0e0e8 !important;
  --win-color: #10b981 !important;
  --loss-color: #ef4444 !important;
  --label-color: #6b6b85 !important;
  --hint-color: #6b6b85 !important;
  --connector-color: #3a3a5c !important;
  --border-color: #3a3a5c !important;
  --border-hover-color: #4a4a6c !important;

  background: var(--primary-background) !important;
  color: var(--font-color) !important;
  padding: 24px !important;
}

/* Titres du bracket (Winner Bracket, Loser Bracket) */
.brackets-viewer h1,
.brackets-viewer h2,
.brackets-viewer h3 {
  color: #e0e0e8 !important;
}

/* Titres des rounds */
.brackets-viewer .round-robin .round-title,
.brackets-viewer .bracket .round-title,
.brackets-viewer header {
  background: #2d2d4a !important;
  color: #a0a0b8 !important;
  border-color: #3a3a5c !important;
}

/* Container des matches UNIQUEMENT - pas les connecteurs */
.brackets-viewer .match {
  background: #252541 !important;
  border: 2px solid #3a3a5c !important;
  border-radius: 8px !important;
  transition: all 0.15s ease !important;
  cursor: pointer !important;
}

.brackets-viewer .match:hover {
  background: #2d2d4a !important;
  border-color: #4a4a6c !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Match sélectionné */
.brackets-viewer .match.selected {
  border-color: #3b82f6 !important;
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.3),
    0 4px 12px rgba(59, 130, 246, 0.2) !important;
  background: #1e3a5f !important;
}

/* Rounds et groupes */
.brackets-viewer .round,
.brackets-viewer .group {
  background: transparent !important;
}

/* Bracket container */
.brackets-viewer .bracket {
  background: transparent !important;
}

/* Participants dans les matches */
.brackets-viewer .match .participant {
  background: transparent !important;
  border-color: #3a3a5c !important;
}

.brackets-viewer .match .participant .name {
  color: #e0e0e8 !important;
}

.brackets-viewer .match .participant .score {
  color: #a0a0b8 !important;
  font-weight: 700 !important;
}

/* Gagnant */
.brackets-viewer .match .participant.win,
.brackets-viewer .match .participant.winner {
  background: rgba(16, 185, 129, 0.1) !important;
}

.brackets-viewer .match .participant.win .name,
.brackets-viewer .match .participant.winner .name {
  color: #10b981 !important;
}

.brackets-viewer .match .participant.win .score,
.brackets-viewer .match .participant.winner .score {
  color: #10b981 !important;
}

/* Perdant */
.brackets-viewer .match .participant.loss,
.brackets-viewer .match .participant.loser {
  background: transparent !important;
}

.brackets-viewer .match .participant.loss .name,
.brackets-viewer .match .participant.loser .name {
  color: #6b6b85 !important;
}

.brackets-viewer .match .participant.loss .score,
.brackets-viewer .match .participant.loser .score {
  color: #6b6b85 !important;
}

/* Connecteurs entre matches */
.brackets-viewer svg.connector {
  stroke: #3a3a5c !important;
}

.brackets-viewer path,
.brackets-viewer line {
  stroke: #3a3a5c !important;
}

/* Labels (BYE, etc.) */
.brackets-viewer .match .participant.hint .name {
  color: #4a4a6c !important;
  font-style: italic !important;
}

/* Match identifiers (WB 1.1, etc.) */
.brackets-viewer .match-label {
  color: #6b6b85 !important;
  font-size: 11px !important;
}

/* Scrollbar styling */
.brackets-viewer::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.brackets-viewer::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.brackets-viewer::-webkit-scrollbar-thumb {
  background: #3a3a5c;
  border-radius: 4px;
}

.brackets-viewer::-webkit-scrollbar-thumb:hover {
  background: #4a4a6c;
}
</style>
