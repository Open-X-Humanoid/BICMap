<!--
 * @Date: 2026-02-25 13:57:06
 * @LastEditTime: 2026-02-25 16:39:26
 * @Description: 
 * @FilePath: /slam-map-vue/src/components/HudCorner.vue
-->
<template>
  <div class="hud-corner" :class="positionClass">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 40 40"
      fill="none"
      :style="{ transform: svgTransform }"
    >
      <path d="M2 36 L2 2 L36 2" stroke="rgba(14,165,233,0.12)" stroke-width="4" stroke-linecap="square" fill="none" />
      <path d="M2 36 L2 2 L36 2" stroke="rgba(14,165,233,0.5)" stroke-width="2" stroke-linecap="square" fill="none" />
      <path d="M6 24 L6 6 L24 6" stroke="rgba(6,182,212,0.25)" stroke-width="1" stroke-linecap="square" fill="none" />
      <circle cx="2" cy="2" r="3" fill="rgba(14,165,233,0.15)" />
      <circle cx="2" cy="2" r="2" fill="rgba(14,165,233,0.6)" />
    </svg>
    <span v-if="label" class="hud-label" :class="labelPositionClass">{{ label }}</span>
  </div>
</template>

<script setup>
/**
 * HUD Corner Bracket - Light Theme
 * Design: Embodied Horizon - Bright Futuristic
 */
import { computed } from 'vue'

const props = defineProps({
  position: { type: String, required: true },
  size: { type: Number, default: 40 },
  label: { type: String, default: '' }
})

const svgTransform = computed(() => {
  switch (props.position) {
    case 'top-left': return ''
    case 'top-right': return 'scaleX(-1)'
    case 'bottom-left': return 'scaleY(-1)'
    case 'bottom-right': return 'scale(-1)'
    default: return ''
  }
})

const positionClass = computed(() => `pos-${props.position}`)
const labelPositionClass = computed(() => `label-${props.position}`)
</script>

<style scoped>
.hud-corner {
  position: absolute;
  pointer-events: none;
  z-index: 10;
}
.pos-top-left { top: 0; left: 0; width: 40px; height: 40px; }
.pos-top-right { top: 0; right: 0; width: 40px; height: 40px; }
.pos-bottom-left { bottom: 0; left: 0; width: 40px; height: 40px; }
.pos-bottom-right { bottom: 0; right: 0; width: 40px; height: 40px; }

.hud-label {
  position: absolute;
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  font-weight: 600;
  font-family: 'Space Mono', monospace;
  color: rgba(14,165,233,0.45);
}
.label-top-left { top: 8px; left: 48px; }
.label-top-right { top: 8px; right: 48px; }
.label-bottom-left { bottom: 8px; left: 48px; }
.label-bottom-right { bottom: 8px; right: 48px; }
</style>
