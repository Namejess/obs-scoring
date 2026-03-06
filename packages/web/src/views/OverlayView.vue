<script setup lang="ts">
import ScoreOverlay from '@/components/obs/ScoreOverlay.vue'
</script>

<template>
  <ScoreOverlay />
</template>

<style>
/* Reset for OBS - no scrollbars, no margin */
html,
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: transparent;
}
</style>
