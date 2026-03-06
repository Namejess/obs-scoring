<script setup lang="ts">
import { ref } from 'vue'
import type { CreateMatchDto } from '@obs-scoring/shared'
import { useMatches } from '@/composables/useMatches'

const emit = defineEmits<{
  (e: 'created'): void
}>()

const { createMatch, error } = useMatches()

const player1 = ref('')
const player2 = ref('')
const team1 = ref('')
const team2 = ref('')
const loading = ref(false)

async function handleSubmit() {
  if (!player1.value.trim() || !player2.value.trim()) return

  loading.value = true
  const data: CreateMatchDto = {
    player1: player1.value.trim(),
    player2: player2.value.trim(),
  }
  if (team1.value.trim()) data.team1 = team1.value.trim()
  if (team2.value.trim()) data.team2 = team2.value.trim()

  const result = await createMatch(data)
  loading.value = false

  if (result) {
    player1.value = ''
    player2.value = ''
    team1.value = ''
    team2.value = ''
    emit('created')
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="match-creator">
    <h3>Create New Match</h3>

    <div class="form-row">
      <div class="form-group">
        <label for="player1">Player 1 *</label>
        <input
          id="player1"
          v-model="player1"
          type="text"
          required
          placeholder="Player name"
          :disabled="loading"
        />
      </div>

      <div class="form-group">
        <label for="team1">Team 1</label>
        <input
          id="team1"
          v-model="team1"
          type="text"
          placeholder="Team name (optional)"
          :disabled="loading"
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="player2">Player 2 *</label>
        <input
          id="player2"
          v-model="player2"
          type="text"
          required
          placeholder="Player name"
          :disabled="loading"
        />
      </div>

      <div class="form-group">
        <label for="team2">Team 2</label>
        <input
          id="team2"
          v-model="team2"
          type="text"
          placeholder="Team name (optional)"
          :disabled="loading"
        />
      </div>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <button type="submit" :disabled="loading || !player1.trim() || !player2.trim()">
      {{ loading ? 'Creating...' : 'Create Match' }}
    </button>
  </form>
</template>

<style scoped>
.match-creator {
  padding: 1.5rem;
  background: var(--color-surface);
  border-radius: 8px;
}

.match-creator h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-muted);
}

.form-group input {
  padding: 0.75rem;
  font-size: 1rem;
  border: 2px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.error {
  color: var(--color-error);
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

button[type='submit'] {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  transition: opacity 0.2s;
}

button[type='submit']:hover:not(:disabled) {
  opacity: 0.9;
}

button[type='submit']:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
