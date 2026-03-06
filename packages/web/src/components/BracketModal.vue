<script setup lang="ts">
/**
 * BracketModal.vue - Modale plein écran pour afficher le bracket
 *
 * - Overlay sombre sur le background
 * - WebView style avec le bracket
 * - Fermeture via bouton ou clic sur overlay
 * - Sélection de match: cliquer = sélectionner et fermer
 * - Uniquement pour le format Web (pas mobile)
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import BracketViewer from './BracketViewer.vue'
import type { StartggSet } from '@/composables/useStartgg'

const props = defineProps<{
  show: boolean
  sets: StartggSet[]
  eventName: string | undefined
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', set: StartggSet): void
}>()

const modalRef = ref<HTMLDivElement | null>(null)
const selectedSetId = ref<string | null>(null)

// Fermer avec Escape
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

// Clic sur l'overlay (pas sur le contenu)
function handleOverlayClick(e: MouseEvent) {
  if (e.target === modalRef.value) {
    emit('close')
  }
}

// Quand un match est sélectionné dans le bracket
function handleMatchSelect(setId: string, set: StartggSet) {
  selectedSetId.value = setId
  // Émettre la sélection au parent
  emit('select', set)
  // Fermer la modale après un court délai pour voir la sélection
  setTimeout(() => {
    emit('close')
  }, 300)
}

// Empêcher le scroll du body quand la modale est ouverte
watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // Reset selection when opening
      selectedSetId.value = null
    } else {
      document.body.style.overflow = ''
    }
  }
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" ref="modalRef" class="bracket-modal-overlay" @click="handleOverlayClick">
        <div class="bracket-modal-content">
          <!-- Header -->
          <div class="bracket-modal-header">
            <h2 class="bracket-modal-title">
              <span class="bracket-icon">🏆</span>
              {{ eventName || 'Bracket' }}
            </h2>
            <button class="bracket-modal-close" @click="emit('close')" title="Fermer (Esc)">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Body avec le bracket -->
          <div class="bracket-modal-body">
            <BracketViewer
              :sets="sets"
              :event-name="eventName"
              :selected-set-id="selectedSetId"
              @select="handleMatchSelect"
            />
          </div>

          <!-- Footer avec info -->
          <div class="bracket-modal-footer">
            <span class="footer-hint"> <kbd>Esc</kbd> pour fermer </span>
            <span class="footer-info"> {{ sets.length }} match(es) </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Overlay sombre */
.bracket-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

/* Contenu de la modale */
.bracket-modal-content {
  width: 100%;
  max-width: 95vw;
  height: 90vh;
  max-height: 95vh;
  background: #1a1a2e;
  border-radius: 16px;
  border: 1px solid #3a3a5c;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.bracket-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #252541;
  border-bottom: 1px solid #3a3a5c;
}

.bracket-modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 10px;
}

.bracket-icon {
  font-size: 1.5rem;
}

.bracket-modal-close {
  width: 40px;
  height: 40px;
  border: 1px solid #3a3a5c;
  border-radius: 8px;
  background: #1a1a2e;
  color: #a0a0b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.bracket-modal-close:hover {
  background: #ef4444;
  border-color: #ef4444;
  color: #ffffff;
}

/* Body */
.bracket-modal-body {
  flex: 1;
  overflow: auto;
  min-height: 0; /* Permet au flex de fonctionner correctement */
}

/* Footer */
.bracket-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #252541;
  border-top: 1px solid #3a3a5c;
  font-size: 0.8rem;
  color: #6b6b85;
}

.footer-hint {
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-hint kbd {
  display: inline-block;
  padding: 2px 6px;
  background: #1a1a2e;
  border: 1px solid #3a3a5c;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.75rem;
}

.footer-info {
  color: #a0a0b8;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .bracket-modal-content,
.modal-leave-to .bracket-modal-content {
  transform: scale(0.95) translateY(20px);
  opacity: 0;
}

.modal-enter-active .bracket-modal-content,
.modal-leave-active .bracket-modal-content {
  transition: all 0.3s ease;
}

/* Responsive */
@media (max-width: 768px) {
  .bracket-modal-overlay {
    padding: 12px;
  }

  .bracket-modal-content {
    max-width: 100%;
    max-height: 100%;
    border-radius: 12px;
  }

  .bracket-modal-header {
    padding: 12px 16px;
  }

  .bracket-modal-title {
    font-size: 1rem;
  }

  .bracket-modal-footer {
    padding: 10px 16px;
  }

  .footer-hint {
    display: none;
  }
}
</style>
