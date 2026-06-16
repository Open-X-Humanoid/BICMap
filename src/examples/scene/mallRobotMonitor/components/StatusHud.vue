<template>
  <transition name="hud-fade">
    <div class="status-hud" v-if="hudText">
      <span class="hud-dot" :class="{ 'hud-dot--blue': isRunning }"></span>
      <span class="hud-text">{{ hudText }}</span>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  hudText:   { type: String,  default: '' },
  isRunning: { type: Boolean, default: false },
})
</script>

<style scoped>
.status-hud {
  position: absolute;
  bottom: 18px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px;
  padding: 8px 20px;
  background: rgba(4, 12, 40, 0.84);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(0, 102, 255, 0.28);
  border-radius: 30px;
  z-index: 20; pointer-events: none;
  box-shadow: 0 4px 22px rgba(0, 20, 80, 0.45);
}

.hud-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  animation: hud-pulse 1.2s ease-in-out infinite;
}
.hud-dot--blue { background: #0066ff; }

.hud-text {
  font-size: 13px; font-weight: 600; color: #b8d4ff;
  letter-spacing: 0.04em; white-space: nowrap;
}

.hud-fade-enter-active,
.hud-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.hud-fade-enter-from,
.hud-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

@keyframes hud-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.72); }
}
</style>
