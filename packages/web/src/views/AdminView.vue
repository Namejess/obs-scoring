<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMatches } from '@/composables/useMatches'
import MatchCreator from '@/components/MatchCreator.vue'
import MatchList from '@/components/MatchList.vue'
import ScoreUpdater from '@/components/ScoreUpdater.vue'
import ScoreDisplay from '@/components/ScoreDisplay.vue'
import ConnectionIndicator from '@/components/ConnectionIndicator.vue'
import StartggPanel from '@/components/StartggPanel.vue'

const { matches, fetchMatches } = useMatches()

const selectedMatchId = ref<number | null>(null)

onMounted(async () => {
  await fetchMatches()
  // Auto-select first match if any
  if (matches.value.length > 0 && matches.value[0]) {
    selectedMatchId.value = matches.value[0].id
  }
})

function handleMatchCreated() {
  // Select the newly created match (it's at the top)
  if (matches.value.length > 0 && matches.value[0]) {
    selectedMatchId.value = matches.value[0].id
  }
}

function handleMatchDeleted(id: number) {
  if (selectedMatchId.value === id) {
    selectedMatchId.value = matches.value[0]?.id ?? null
  }
}

function handleStartggMatchSelected(matchId: number) {
  selectedMatchId.value = matchId
}

// Tab management
const activeTab = ref<'manual' | 'startgg'>('manual')
</script>

<template>
  <div class="admin-view">
    <header>
      <h1>OBS Scoring</h1>
      <div class="header-right">
        <router-link to="/preview" class="preview-link">Preview Overlay</router-link>
        <ConnectionIndicator />
      </div>
    </header>

    <main>
      <div class="left-column">
        <!-- Tabs -->
        <div class="tabs">
          <button
            :class="['tab', { active: activeTab === 'manual' }]"
            @click="activeTab = 'manual'"
          >
            Création manuelle
          </button>
          <button
            :class="['tab', { active: activeTab === 'startgg' }]"
            @click="activeTab = 'startgg'"
          >
            start.gg
          </button>
        </div>

        <!-- Manual tab -->
        <template v-if="activeTab === 'manual'">
          <MatchCreator @created="handleMatchCreated" />
          <MatchList
            :matches="matches"
            :selectedId="selectedMatchId"
            @select="selectedMatchId = $event"
            @delete="handleMatchDeleted"
          />
        </template>

        <!-- Start.gg tab -->
        <StartggPanel v-else @matchSelected="handleStartggMatchSelected" />
      </div>

      <div class="right-column">
        <ScoreUpdater :matchId="selectedMatchId" />
        <ScoreDisplay :matchId="selectedMatchId" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-view {
  min-height: 100vh;
  background: var(--color-bg);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.preview-link {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background: var(--color-primary);
  color: white;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.875rem;
  transition: opacity 0.2s;
}

.preview-link:hover {
  opacity: 0.9;
}

main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  height: calc(100vh - 80px);
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 0;
  max-height: 100%;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.tab {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.tab.active {
  background: var(--color-primary);
  color: white;
}

.tab:hover:not(.active) {
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.1));
}

@media (max-width: 900px) {
  main {
    grid-template-columns: 1fr;
  }
}
</style>
