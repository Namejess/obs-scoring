<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Match } from '@obs-scoring/shared'
import { useSocket } from '@/composables/useSocket'
import { useMatches } from '@/composables/useMatches'

const props = defineProps<{
  matchId: number | null
}>()

const { onScoreUpdate } = useSocket()
const { fetchMatch } = useMatches()

const match = ref<Match | null>(null)
const loading = ref(false)

async function loadMatch() {
  if (!props.matchId) {
    match.value = null
    return
  }
  
  loading.value = true
  match.value = await fetchMatch(props.matchId)
  loading.value = false
}

// Load match when matchId changes
watch(() => props.matchId, loadMatch, { immediate: true })

// Update on score changes
onScoreUpdate((event) => {
  if (match.value && match.value.id === event.matchId) {
    match.value.player1Score = event.player1Score
    match.value.player2Score = event.player2Score
  }
})
</script>

<template>
  <div class="score-display">
    <template v-if="loading">
      <div class="loading">Loading...</div>
    </template>

    <template v-else-if="!match">
      <div class="no-match">Select a match</div>
    </template>

    <template v-else>
      <div class="player">
        <span class="team" v-if="match.team1">{{ match.team1 }}</span>
        <span class="name">{{ match.player1 }}</span>
        <span class="score">{{ match.player1Score }}</span>
      </div>

      <div class="vs">VS</div>

      <div class="player">
        <span class="score">{{ match.player2Score }}</span>
        <span class="name">{{ match.player2 }}</span>
        <span class="team" v-if="match.team2">{{ match.team2 }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.score-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 1.5rem;
  background: var(--color-surface);
  border-radius: 8px;
}

.player {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.name {
  font-weight: 600;
  font-size: 1.25rem;
}

.team {
  font-size: 0.875rem;
  color: var(--color-muted);
}

.score {
  font-weight: 700;
  font-size: 2rem;
  min-width: 2.5rem;
  text-align: center;
  color: var(--color-primary);
}

.vs {
  font-weight: 700;
  color: var(--color-muted);
}

.no-match,
.loading {
  color: var(--color-muted);
  font-style: italic;
}
</style>
