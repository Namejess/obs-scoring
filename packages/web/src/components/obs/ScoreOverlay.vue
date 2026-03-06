<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { OBSOverlayData } from '@obs-scoring/shared'
import { useSocket } from '@/composables/useSocket'
import { useMatches } from '@/composables/useMatches'
import { useOverlayConfig } from '@/composables/useOverlayConfig'

const { status, onScoreUpdate, onCurrentMatchChanged } = useSocket()
const { fetchOBSData } = useMatches()
const { config, cssVars } = useOverlayConfig()

const data = ref<OBSOverlayData | null>(null)
const loading = ref(true)

async function loadData() {
  const result = await fetchOBSData()
  if (result) {
    data.value = result
  }
  loading.value = false
}

onMounted(() => {
  loadData()
})

// Update on score changes
onScoreUpdate((event) => {
  if (data.value && data.value.matchId === event.matchId) {
    data.value.players[0].score = event.player1Score
    data.value.players[1].score = event.player2Score
  }
})

// Reload when current match changes
onCurrentMatchChanged(() => {
  loadData()
})
</script>

<template>
  <div class="overlay" :class="config.layout" :style="cssVars">
    <!-- Loading skeleton - no flash -->
    <template v-if="loading">
      <div class="player skeleton">
        <span class="score">-</span>
      </div>
      <div class="separator">:</div>
      <div class="player skeleton">
        <span class="score">-</span>
      </div>
    </template>

    <!-- No match set -->
    <template v-else-if="!data?.matchId">
      <div class="no-match">No match selected</div>
    </template>

    <!-- Match display -->
    <template v-else>
      <div class="player">
        <span v-if="config.showTeams && data.players[0].team" class="team">
          {{ data.players[0].team }}
        </span>
        <span class="name">{{ data.players[0].name }}</span>
        <span class="score">{{ data.players[0].score }}</span>
      </div>

      <div class="separator">:</div>

      <div class="player">
        <span class="score">{{ data.players[1].score }}</span>
        <span class="name">{{ data.players[1].name }}</span>
        <span v-if="config.showTeams && data.players[1].team" class="team">
          {{ data.players[1].team }}
        </span>
      </div>
    </template>

    <!-- Connection indicator (subtle) -->
    <div v-if="status !== 'connected'" class="connection-status" :class="status">
      {{ status === 'reconnecting' ? 'Reconnecting...' : 'Disconnected' }}
    </div>
  </div>
</template>

<style scoped>
.overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: var(--bg-color);
  color: var(--text-color);
  font-family: var(--font-family), sans-serif;
  font-size: var(--font-size);
  min-height: 100vh;
  box-sizing: border-box;
}

.overlay.vertical {
  flex-direction: column;
}

.player {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.overlay.vertical .player {
  flex-direction: column;
}

.name {
  font-weight: 600;
}

.team {
  font-size: 0.6em;
  opacity: 0.8;
  font-weight: 400;
}

.score {
  font-weight: 700;
  font-size: 1.2em;
  min-width: 1.5em;
  text-align: center;
}

.separator {
  font-weight: 700;
  opacity: 0.6;
}

.overlay.vertical .separator {
  display: none;
}

.no-match {
  opacity: 0.5;
  font-style: italic;
  font-size: 0.6em;
}

.skeleton {
  opacity: 0.3;
}

.connection-status {
  position: fixed;
  bottom: 0.5rem;
  right: 0.5rem;
  font-size: 0.4em;
  padding: 0.25em 0.5em;
  border-radius: 0.25em;
  background: rgba(255, 0, 0, 0.8);
}

.connection-status.reconnecting {
  background: rgba(255, 165, 0, 0.8);
}
</style>
