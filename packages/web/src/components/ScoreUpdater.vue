<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Match } from '@obs-scoring/shared'
import { useMatches } from '@/composables/useMatches'

const props = defineProps<{
  matchId: number | null
}>()

const emit = defineEmits<{
  (e: 'updated', match: Match): void
}>()

const { fetchMatch, updateScore, setCurrentMatch } = useMatches()

const match = ref<Match | null>(null)
const player1Score = ref(0)
const player2Score = ref(0)
const loading = ref(false)
const updating = ref(false)

async function loadMatch() {
  if (!props.matchId) {
    match.value = null
    return
  }

  loading.value = true
  const result = await fetchMatch(props.matchId)
  if (result) {
    match.value = result
    player1Score.value = result.player1Score
    player2Score.value = result.player2Score
  }
  loading.value = false
}

watch(() => props.matchId, loadMatch, { immediate: true })

async function handleUpdateScore() {
  if (!match.value) return

  updating.value = true
  const result = await updateScore(match.value.id, {
    player1Score: player1Score.value,
    player2Score: player2Score.value,
  })
  updating.value = false

  if (result) {
    match.value = result
    emit('updated', result)
  }
}

async function handleSetCurrent() {
  if (!match.value) return

  updating.value = true
  const result = await setCurrentMatch(match.value.id)
  updating.value = false

  if (result) {
    match.value = result
    emit('updated', result)
  }
}

function incrementScore(player: 1 | 2) {
  if (player === 1) {
    player1Score.value++
  } else {
    player2Score.value++
  }
  handleUpdateScore()
}

function decrementScore(player: 1 | 2) {
  if (player === 1 && player1Score.value > 0) {
    player1Score.value--
  } else if (player === 2 && player2Score.value > 0) {
    player2Score.value--
  }
  handleUpdateScore()
}
</script>

<template>
  <div class="score-updater">
    <template v-if="loading">
      <div class="loading">Loading...</div>
    </template>

    <template v-else-if="!match">
      <div class="no-match">Select a match to update</div>
    </template>

    <template v-else>
      <div class="match-header">
        <h3>{{ match.player1 }} vs {{ match.player2 }}</h3>
        <span v-if="match.isCurrent" class="current-badge">Current</span>
      </div>

      <div class="score-controls">
        <div class="player-score">
          <span class="player-name">{{ match.player1 }}</span>
          <div class="score-buttons">
            <button @click="decrementScore(1)" :disabled="updating || player1Score === 0">-</button>
            <input
              type="number"
              v-model.number="player1Score"
              min="0"
              @change="handleUpdateScore"
              :disabled="updating"
            />
            <button @click="incrementScore(1)" :disabled="updating">+</button>
          </div>
        </div>

        <div class="player-score">
          <span class="player-name">{{ match.player2 }}</span>
          <div class="score-buttons">
            <button @click="decrementScore(2)" :disabled="updating || player2Score === 0">-</button>
            <input
              type="number"
              v-model.number="player2Score"
              min="0"
              @change="handleUpdateScore"
              :disabled="updating"
            />
            <button @click="incrementScore(2)" :disabled="updating">+</button>
          </div>
        </div>
      </div>

      <div class="actions">
        <button
          v-if="!match.isCurrent"
          @click="handleSetCurrent"
          :disabled="updating"
          class="btn-primary"
        >
          Set as Current Match
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.score-updater {
  padding: 1.5rem;
  background: var(--color-surface);
  border-radius: 8px;
}

.match-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.match-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.current-badge {
  background: var(--color-primary);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.score-controls {
  display: flex;
  gap: 2rem;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.player-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.player-name {
  font-weight: 600;
}

.score-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.score-buttons button {
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1.25rem;
  font-weight: 700;
  border: none;
  border-radius: 4px;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  transition: opacity 0.2s;
}

.score-buttons button:hover:not(:disabled) {
  opacity: 0.9;
}

.score-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.score-buttons input {
  width: 4rem;
  height: 2.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
}

.score-buttons input::-webkit-inner-spin-button,
.score-buttons input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.actions {
  display: flex;
  justify-content: center;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.no-match,
.loading {
  color: var(--color-muted);
  font-style: italic;
  text-align: center;
}
</style>
