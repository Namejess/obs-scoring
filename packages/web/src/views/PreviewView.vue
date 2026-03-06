<script setup lang="ts">
import { ref, computed } from 'vue'
import { DEFAULT_OVERLAY_CONFIG } from '@obs-scoring/shared'
import ConnectionIndicator from '@/components/ConnectionIndicator.vue'

// Config state
const textColor = ref(DEFAULT_OVERLAY_CONFIG.textColor)
const bgColor = ref(DEFAULT_OVERLAY_CONFIG.bgColor)
const fontSize = ref(DEFAULT_OVERLAY_CONFIG.fontSize)
const fontFamily = ref(DEFAULT_OVERLAY_CONFIG.fontFamily)
const showTeams = ref(DEFAULT_OVERLAY_CONFIG.showTeams)
const layout = ref<'horizontal' | 'vertical'>(DEFAULT_OVERLAY_CONFIG.layout)

const baseUrl = computed(() => {
  return window.location.origin
})

const overlayUrl = computed(() => {
  const params = new URLSearchParams()

  if (textColor.value !== DEFAULT_OVERLAY_CONFIG.textColor) {
    params.set('textColor', textColor.value)
  }
  if (bgColor.value !== DEFAULT_OVERLAY_CONFIG.bgColor) {
    params.set('bgColor', bgColor.value)
  }
  if (fontSize.value !== DEFAULT_OVERLAY_CONFIG.fontSize) {
    params.set('fontSize', fontSize.value.toString())
  }
  if (fontFamily.value !== DEFAULT_OVERLAY_CONFIG.fontFamily) {
    params.set('fontFamily', fontFamily.value)
  }
  if (!showTeams.value) {
    params.set('showTeams', 'false')
  }
  if (layout.value !== DEFAULT_OVERLAY_CONFIG.layout) {
    params.set('layout', layout.value)
  }

  const queryString = params.toString()
  return `${baseUrl.value}/overlay${queryString ? '?' + queryString : ''}`
})

function copyUrl() {
  navigator.clipboard.writeText(overlayUrl.value)
}

function resetConfig() {
  textColor.value = DEFAULT_OVERLAY_CONFIG.textColor
  bgColor.value = DEFAULT_OVERLAY_CONFIG.bgColor
  fontSize.value = DEFAULT_OVERLAY_CONFIG.fontSize
  fontFamily.value = DEFAULT_OVERLAY_CONFIG.fontFamily
  showTeams.value = DEFAULT_OVERLAY_CONFIG.showTeams
  layout.value = DEFAULT_OVERLAY_CONFIG.layout
}
</script>

<template>
  <div class="preview-view">
    <header>
      <div class="header-left">
        <router-link to="/" class="back-link">&larr; Back to Admin</router-link>
        <h1>Overlay Preview</h1>
      </div>
      <ConnectionIndicator />
    </header>

    <main>
      <aside class="controls">
        <h2>Configuration</h2>

        <div class="control-group">
          <label for="textColor">Text Color</label>
          <div class="color-input">
            <span class="hash">#</span>
            <input
              id="textColor"
              v-model="textColor"
              type="text"
              maxlength="6"
              placeholder="ffffff"
            />
            <input
              type="color"
              :value="'#' + textColor"
              @input="textColor = ($event.target as HTMLInputElement).value.slice(1)"
            />
          </div>
        </div>

        <div class="control-group">
          <label for="bgColor">Background Color</label>
          <div class="color-input">
            <span class="hash">#</span>
            <input
              id="bgColor"
              v-model="bgColor"
              type="text"
              placeholder="transparent"
            />
            <input
              v-if="bgColor !== 'transparent'"
              type="color"
              :value="'#' + bgColor"
              @input="bgColor = ($event.target as HTMLInputElement).value.slice(1)"
            />
          </div>
          <button class="btn-small" @click="bgColor = 'transparent'">Set Transparent</button>
        </div>

        <div class="control-group">
          <label for="fontSize">Font Size (px)</label>
          <input
            id="fontSize"
            v-model.number="fontSize"
            type="number"
            min="12"
            max="200"
          />
        </div>

        <div class="control-group">
          <label for="fontFamily">Font Family</label>
          <select id="fontFamily" v-model="fontFamily">
            <option value="Inter">Inter</option>
            <option value="Arial">Arial</option>
            <option value="Roboto">Roboto</option>
            <option value="Montserrat">Montserrat</option>
            <option value="Oswald">Oswald</option>
          </select>
        </div>

        <div class="control-group">
          <label for="layout">Layout</label>
          <select id="layout" v-model="layout">
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </div>

        <div class="control-group checkbox">
          <input id="showTeams" v-model="showTeams" type="checkbox" />
          <label for="showTeams">Show Teams</label>
        </div>

        <div class="actions">
          <button @click="resetConfig" class="btn-secondary">Reset to Defaults</button>
        </div>

        <div class="url-section">
          <h3>OBS Browser Source URL</h3>
          <div class="url-box">
            <code>{{ overlayUrl }}</code>
            <button @click="copyUrl" class="btn-copy">Copy</button>
          </div>
          <p class="hint">Recommended size: 1920x200 (horizontal) or 400x600 (vertical)</p>
        </div>
      </aside>

      <div class="preview-container">
        <div class="preview-frame" :class="{ vertical: layout === 'vertical' }">
          <iframe :src="overlayUrl" frameborder="0"></iframe>
        </div>
        <p class="preview-label">Live Preview (updates in real-time)</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.preview-view {
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

.header-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.back-link {
  color: var(--color-muted);
  text-decoration: none;
  font-size: 0.875rem;
}

.back-link:hover {
  color: var(--color-text);
}

header h1 {
  margin: 0;
  font-size: 1.5rem;
}

main {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 2rem;
  padding: 2rem;
  max-width: 1600px;
  margin: 0 auto;
}

.controls {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 1.5rem;
}

.controls h2 {
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
}

.control-group {
  margin-bottom: 1.25rem;
}

.control-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-muted);
}

.control-group.checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-group.checkbox label {
  margin: 0;
}

.color-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-input .hash {
  color: var(--color-muted);
}

.color-input input[type='text'] {
  flex: 1;
  padding: 0.5rem;
  font-size: 0.875rem;
  font-family: monospace;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
}

.color-input input[type='color'] {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.control-group input[type='number'],
.control-group select {
  width: 100%;
  padding: 0.5rem;
  font-size: 0.875rem;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
}

.btn-small {
  margin-top: 0.5rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border: none;
  border-radius: 4px;
  background: var(--color-border);
  color: var(--color-text);
  cursor: pointer;
}

.btn-small:hover {
  background: var(--color-muted);
}

.actions {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.btn-secondary {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: 2px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.url-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.url-section h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
}

.url-box {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.url-box code {
  flex: 1;
  padding: 0.75rem;
  font-size: 0.75rem;
  background: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: 4px;
  word-break: break-all;
  max-height: 80px;
  overflow-y: auto;
}

.btn-copy {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: none;
  border-radius: 4px;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  white-space: nowrap;
}

.btn-copy:hover {
  opacity: 0.9;
}

.hint {
  margin: 0.5rem 0 0 0;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.preview-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.preview-frame {
  width: 100%;
  height: 200px;
  background: repeating-conic-gradient(#1a1a2e 0% 25%, #2a2a4a 0% 50%) 50% / 20px 20px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.preview-frame.vertical {
  width: 400px;
  height: 600px;
}

.preview-frame iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.preview-label {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}

@media (max-width: 900px) {
  main {
    grid-template-columns: 1fr;
  }

  .preview-frame {
    height: 150px;
  }

  .preview-frame.vertical {
    width: 100%;
    max-width: 400px;
    height: 400px;
  }
}
</style>
