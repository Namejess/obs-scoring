<script setup lang="ts">
import { useSocket } from '@/composables/useSocket'

const { status, reconnectAttempts } = useSocket()
</script>

<template>
  <div class="connection-indicator" :class="status">
    <span class="dot"></span>
    <span class="text">
      <template v-if="status === 'connected'">Connected</template>
      <template v-else-if="status === 'reconnecting'">
        Reconnecting... ({{ reconnectAttempts }})
      </template>
      <template v-else>Disconnected</template>
    </span>
  </div>
</template>

<style scoped>
.connection-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.connection-indicator.connected {
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
}

.connection-indicator.reconnecting {
  background: rgba(245, 158, 11, 0.1);
  color: var(--color-warning);
}

.connection-indicator.disconnected {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.connection-indicator.reconnecting .dot {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
