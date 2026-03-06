<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useStartgg, SET_STATE, type StartggSet } from '@/composables/useStartgg'
import BracketModal from './BracketModal.vue'

const emit = defineEmits<{
  (e: 'matchSelected', matchId: number): void
}>()

const {
  tournaments,
  events,
  sets,
  setsPageInfo,
  loading,
  loadingEvents,
  loadingSets,
  selectingSetId,
  error,
  selectedTournament,
  selectedEvent,
  fetchTournaments,
  fetchSets,
  selectSet,
  selectTournament,
  selectEvent,
  goBackToTournaments,
  goBackToEvents,
  formatDate,
  getTournamentStateLabel,
  getSetStateLabel,
  getSetStateColor,
} = useStartgg()

// View mode: 'list' or 'bracket'
type ViewMode = 'list' | 'bracket'
const viewMode = ref<ViewMode>('list')

// Modal state for bracket view
const showBracketModal = ref(false)

// Filters
type FilterState = 'active' | 'pending' | 'completed' | 'all'
const filter = ref<FilterState>('all') // Default to 'all' for bracket view
const pollingEnabled = ref(true)
let pollingInterval: ReturnType<typeof setInterval> | null = null

const getStateFilter = (f: FilterState): number[] | undefined => {
  switch (f) {
    case 'active':
      return [SET_STATE.ACTIVE, SET_STATE.CALLED, SET_STATE.QUEUED]
    case 'pending':
      return [SET_STATE.CREATED, SET_STATE.QUEUED]
    case 'completed':
      return [SET_STATE.COMPLETED]
    default:
      return undefined
  }
}

// Refresh sets with current filter
function refreshSets() {
  if (selectedEvent.value) {
    const states = getStateFilter(filter.value)
    fetchSets(String(selectedEvent.value.id), {
      ...(states && { states }),
      perPage: 50,
    })
  }
}

// Watch filter changes
watch(filter, () => {
  refreshSets()
})

// Polling setup
function setupPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
  }
  if (pollingEnabled.value && selectedEvent.value) {
    pollingInterval = setInterval(() => {
      refreshSets()
    }, 15000)
  }
}

watch([pollingEnabled, selectedEvent], () => {
  setupPolling()
})

// Handle set selection
async function handleSelectSet(set: StartggSet) {
  const result = await selectSet(set.id)
  if (result) {
    emit('matchSelected', result.id)
  }
}

// Format player name
function formatPlayer(tag: string, prefix: string | null): string {
  return prefix ? `${prefix} | ${tag}` : tag
}

// Fetch all sets when switching to bracket view
watch(viewMode, (mode) => {
  if (mode === 'bracket' && selectedEvent.value) {
    // Fetch all sets for bracket view
    fetchSets(String(selectedEvent.value.id), { perPage: 100 })
    // Open the bracket modal
    showBracketModal.value = true
  }
})

// Open bracket modal
function openBracketModal() {
  if (selectedEvent.value) {
    fetchSets(String(selectedEvent.value.id), { perPage: 100 })
    showBracketModal.value = true
  }
}

// Close bracket modal
function closeBracketModal() {
  showBracketModal.value = false
}

// Handle match selection from bracket modal
function handleBracketMatchSelect(set: StartggSet) {
  // Sélectionner le match pour OBS
  handleSelectSet(set)
}

// Initial load
onMounted(() => {
  fetchTournaments()
})

onUnmounted(() => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
  }
})
</script>

<template>
  <div class="startgg-panel">
    <div class="panel-header">
      <h2>
        <span v-if="!selectedTournament">Tournois start.gg</span>
        <span v-else-if="!selectedEvent">{{ selectedTournament.name }}</span>
        <span v-else>{{ selectedEvent.name }}</span>
      </h2>
      <button
        v-if="selectedTournament"
        class="back-btn"
        @click="selectedEvent ? goBackToEvents() : goBackToTournaments()"
      >
        ← Retour
      </button>
    </div>

    <!-- Error state -->
    <div v-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="fetchTournaments">Réessayer</button>
    </div>

    <!-- Loading state -->
    <div v-else-if="loading || loadingEvents || loadingSets" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement...</p>
    </div>

    <!-- Tournaments list -->
    <div v-else-if="!selectedTournament" class="tournaments-list">
      <div
        v-for="tournament in tournaments"
        :key="tournament.id"
        class="tournament-card"
        @click="selectTournament(tournament)"
      >
        <div class="tournament-header">
          <span class="tournament-name">{{ tournament.name }}</span>
          <span
            class="badge"
            :style="{ backgroundColor: getTournamentStateLabel(tournament.state).color }"
          >
            {{ getTournamentStateLabel(tournament.state).label }}
          </span>
        </div>
        <div class="tournament-details">
          <span>📅 {{ formatDate(tournament.startAt) }}</span>
          <span v-if="tournament.city">📍 {{ tournament.city }}</span>
          <span v-if="tournament.isOnline">🌐 En ligne</span>
          <span>👥 {{ tournament.numAttendees }} • {{ tournament.events.length }} event(s)</span>
        </div>
      </div>
      <p v-if="tournaments.length === 0" class="empty-state">
        Aucun tournoi trouvé. Vérifiez votre token start.gg.
      </p>
    </div>

    <!-- Events list -->
    <div v-else-if="!selectedEvent" class="events-list">
      <div v-for="event in events" :key="event.id" class="event-card" @click="selectEvent(event)">
        <span class="event-name">{{ event.name }}</span>
        <div class="event-details">
          <span>👥 {{ event.numEntrants }} participants</span>
          <span class="event-state">{{ event.state }}</span>
        </div>
      </div>
      <p v-if="events.length === 0" class="empty-state">Aucun event trouvé.</p>
    </div>

    <!-- Sets list -->
    <div v-else class="sets-view">
      <!-- View mode tabs -->
      <div class="view-tabs">
        <button :class="['view-tab', { active: viewMode === 'list' }]" @click="viewMode = 'list'">
          📋 Liste
        </button>
        <button class="view-tab" @click="openBracketModal">🏆 Bracket</button>
      </div>

      <!-- List view -->
      <template v-if="viewMode === 'list'">
        <!-- Filters -->
        <div class="filters">
          <button
            :class="['filter-btn', { active: filter === 'active' }]"
            @click="filter = 'active'"
          >
            En cours
          </button>
          <button
            :class="['filter-btn', { active: filter === 'pending' }]"
            @click="filter = 'pending'"
          >
            À venir
          </button>
          <button
            :class="['filter-btn', { active: filter === 'completed' }]"
            @click="filter = 'completed'"
          >
            Terminés
          </button>
          <button :class="['filter-btn', { active: filter === 'all' }]" @click="filter = 'all'">
            Tous
          </button>
        </div>

        <!-- Polling toggle -->
        <div class="polling-row">
          <label class="polling-toggle">
            <input type="checkbox" v-model="pollingEnabled" />
            <span class="polling-dot" :class="{ active: pollingEnabled }"></span>
            Auto-refresh {{ pollingEnabled ? 'ON' : 'OFF' }}
          </label>
          <span v-if="setsPageInfo" class="count"> {{ setsPageInfo.total }} set(s) </span>
        </div>

        <!-- Sets -->
        <div class="sets-list">
          <div
            v-for="set in sets"
            :key="set.id"
            :class="[
              'set-card',
              { active: set.state === SET_STATE.ACTIVE, selecting: selectingSetId === set.id },
            ]"
            @click="handleSelectSet(set)"
          >
            <div class="set-header">
              <span class="round-text">{{ set.fullRoundText }}</span>
              <span class="state-badge" :style="{ backgroundColor: getSetStateColor(set.state) }">
                {{ getSetStateLabel(set.state) }}
              </span>
            </div>
            <div class="players">
              <div class="player-row">
                <span class="player-tag">{{
                  formatPlayer(set.player1Tag, set.player1Prefix)
                }}</span>
                <span class="score">{{ set.player1Score >= 0 ? set.player1Score : '-' }}</span>
              </div>
              <div class="player-row">
                <span class="player-tag">{{
                  formatPlayer(set.player2Tag, set.player2Prefix)
                }}</span>
                <span class="score">{{ set.player2Score >= 0 ? set.player2Score : '-' }}</span>
              </div>
            </div>
            <span v-if="set.bestOf > 0" class="best-of">Bo{{ set.bestOf }}</span>
            <div v-if="set.match" class="linked-badge">Lié au match #{{ set.match.id }}</div>
            <div v-if="selectingSetId === set.id" class="selecting-overlay">
              <div class="spinner small"></div>
            </div>
          </div>
          <p v-if="sets.length === 0" class="empty-state">
            Aucun set
            {{ filter === 'active' ? 'en cours' : filter === 'pending' ? 'à venir' : 'trouvé' }}
          </p>
        </div>
      </template>
    </div>

    <!-- Bracket Modal -->
    <BracketModal
      :show="showBracketModal"
      :sets="sets"
      :event-name="selectedEvent?.name"
      @close="closeBracketModal"
      @select="handleBracketMatchSelect"
    />
  </div>
</template>

<style scoped>
.startgg-panel {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 1.25rem;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.panel-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
}

.back-btn:hover {
  text-decoration: underline;
}

/* Loading & Error */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  flex: 1;
}

.error-state {
  color: #ef4444;
}

.error-state button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.small {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  text-align: center;
  color: var(--color-text-muted);
  padding: 2rem;
}

/* Tournaments list */
.tournaments-list,
.events-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tournament-card,
.event-card {
  background: var(--color-bg);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.1s;
}

.tournament-card:hover,
.event-card:hover {
  background: var(--color-bg-hover, rgba(255, 255, 255, 0.05));
  transform: translateY(-1px);
}

.tournament-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.tournament-name,
.event-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.badge,
.state-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  color: white;
}

.tournament-details,
.event-details {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.event-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.event-state {
  color: var(--color-primary);
  font-weight: 500;
}

/* Sets view */
.sets-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.filter-btn {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s;
}

.filter-btn.active {
  background: var(--color-primary);
  color: white;
}

.filter-btn:hover:not(.active) {
  background: var(--color-bg-hover, rgba(255, 255, 255, 0.1));
}

.polling-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.polling-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.polling-toggle input {
  display: none;
}

.polling-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
}

.polling-dot.active {
  background: #22c55e;
}

.sets-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.set-card {
  position: relative;
  background: var(--color-bg);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.set-card:hover {
  background: var(--color-bg-hover, rgba(255, 255, 255, 0.05));
}

.set-card.active {
  border: 1px solid #22c55e;
}

.set-card.selecting {
  pointer-events: none;
  opacity: 0.7;
}

.selecting-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.set-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.round-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.players {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.player-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.player-tag {
  font-size: 0.95rem;
  font-weight: 500;
}

.score {
  font-size: 1.1rem;
  font-weight: 700;
  min-width: 24px;
  text-align: center;
}

.best-of {
  position: absolute;
  top: 1rem;
  right: 5rem;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.linked-badge {
  margin-top: 0.75rem;
  display: inline-block;
  padding: 0.2rem 0.5rem;
  background: var(--color-primary);
  border-radius: 4px;
  font-size: 0.7rem;
  color: white;
}

.count {
  font-size: 0.8rem;
}

/* View tabs */
.view-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.view-tab {
  flex: 1;
  padding: 0.5rem 1rem;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.15s ease;
}

.view-tab:hover {
  background: var(--color-bg);
}

.view-tab.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
  font-weight: 600;
}

/* Bracket container */
.bracket-container {
  flex: 1;
  min-height: 400px;
  border-radius: 8px;
  overflow: hidden;
}

.bracket-empty {
  margin-top: 1rem;
}
</style>
