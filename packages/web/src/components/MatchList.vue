<script setup lang="ts">
import type { Match } from '@obs-scoring/shared'
import { useMatches } from '@/composables/useMatches'

defineProps<{
  matches: Match[]
  selectedId: number | null
}>()

const emit = defineEmits<{
  (e: 'select', id: number): void
  (e: 'delete', id: number): void
}>()

const { deleteMatch } = useMatches()

async function handleDelete(id: number) {
  if (confirm('Delete this match?')) {
    await deleteMatch(id)
    emit('delete', id)
  }
}
</script>

<template>
  <div class="match-list">
    <h3>Matches</h3>

    <div v-if="matches.length === 0" class="empty">
      No matches yet. Create one above!
    </div>

    <ul v-else>
      <li
        v-for="match in matches"
        :key="match.id"
        :class="{ selected: match.id === selectedId, current: match.isCurrent }"
        @click="emit('select', match.id)"
      >
        <div class="match-info">
          <span class="players">{{ match.player1 }} vs {{ match.player2 }}</span>
          <span class="score">{{ match.player1Score }} - {{ match.player2Score }}</span>
          <span v-if="match.isCurrent" class="current-badge">LIVE</span>
        </div>
        <button
          class="delete-btn"
          @click.stop="handleDelete(match.id)"
          title="Delete match"
        >
          ×
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.match-list {
  padding: 1.5rem;
  background: var(--color-surface);
  border-radius: 8px;
}

.match-list h3 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
}

.empty {
  color: var(--color-muted);
  font-style: italic;
  text-align: center;
  padding: 1rem;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 2px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

li:hover {
  border-color: var(--color-primary);
}

li.selected {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.1);
}

li.current {
  border-color: var(--color-success);
}

li.current.selected {
  background: rgba(34, 197, 94, 0.1);
}

.match-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.players {
  font-weight: 500;
}

.score {
  font-weight: 700;
  color: var(--color-primary);
}

.current-badge {
  background: var(--color-success);
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.delete-btn {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-muted);
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: var(--color-error);
  color: white;
}
</style>
