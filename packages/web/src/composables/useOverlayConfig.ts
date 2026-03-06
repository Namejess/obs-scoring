import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { OverlayConfig } from '@obs-scoring/shared'
import { DEFAULT_OVERLAY_CONFIG } from '@obs-scoring/shared'

/**
 * Parse overlay configuration from URL query parameters
 * Used by both OverlayView and PreviewView
 */
export function useOverlayConfig() {
  const route = useRoute()

  const config = computed<OverlayConfig>(() => {
    const query = route.query

    return {
      textColor: (query.textColor as string) || DEFAULT_OVERLAY_CONFIG.textColor,
      bgColor: (query.bgColor as string) || DEFAULT_OVERLAY_CONFIG.bgColor,
      fontSize: parseInt(query.fontSize as string, 10) || DEFAULT_OVERLAY_CONFIG.fontSize,
      fontFamily: (query.fontFamily as string) || DEFAULT_OVERLAY_CONFIG.fontFamily,
      showTeams: query.showTeams !== 'false',
      layout: (query.layout as 'horizontal' | 'vertical') || DEFAULT_OVERLAY_CONFIG.layout,
    }
  })

  const cssVars = computed(() => ({
    '--text-color': `#${config.value.textColor}`,
    '--bg-color': config.value.bgColor === 'transparent' ? 'transparent' : `#${config.value.bgColor}`,
    '--font-size': `${config.value.fontSize}px`,
    '--font-family': config.value.fontFamily,
  }))

  /**
   * Build URL with current config for OBS Browser Source
   */
  function buildOverlayUrl(baseUrl: string = ''): string {
    const params = new URLSearchParams()

    if (config.value.textColor !== DEFAULT_OVERLAY_CONFIG.textColor) {
      params.set('textColor', config.value.textColor)
    }
    if (config.value.bgColor !== DEFAULT_OVERLAY_CONFIG.bgColor) {
      params.set('bgColor', config.value.bgColor)
    }
    if (config.value.fontSize !== DEFAULT_OVERLAY_CONFIG.fontSize) {
      params.set('fontSize', config.value.fontSize.toString())
    }
    if (config.value.fontFamily !== DEFAULT_OVERLAY_CONFIG.fontFamily) {
      params.set('fontFamily', config.value.fontFamily)
    }
    if (!config.value.showTeams) {
      params.set('showTeams', 'false')
    }
    if (config.value.layout !== DEFAULT_OVERLAY_CONFIG.layout) {
      params.set('layout', config.value.layout)
    }

    const queryString = params.toString()
    return `${baseUrl}/overlay${queryString ? '?' + queryString : ''}`
  }

  return {
    config,
    cssVars,
    buildOverlayUrl,
  }
}
