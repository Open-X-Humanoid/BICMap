<template>
  <div class="heading-hud">
    <div class="heading-compass">
      <svg viewBox="0 0 32 32" width="32" height="32">
        <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(0,102,255,0.35)" stroke-width="1.5"/>
        <polygon
          :points="`16,4 13,20 16,17 19,20`"
          :transform="`rotate(${deg}, 16, 16)`"
          fill="#0066ff"
        />
        <circle cx="16" cy="16" r="2" fill="rgba(255,255,255,0.6)"/>
      </svg>
    </div>
    <div class="heading-info">
      <span class="heading-deg">{{ deg }}°</span>
      <span class="heading-dir">{{ dir }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  deg: { type: Number, default: 0 },
  dir: { type: String, default: 'N' },
})
</script>

<style scoped>
.heading-hud {
  position: absolute;
  bottom: 18px; right: 14px;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px 6px 8px;
  background: rgba(4, 12, 40, 0.82);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(0, 102, 255, 0.28);
  border-radius: 24px;
  z-index: 20; pointer-events: none;
  box-shadow: 0 4px 18px rgba(0, 20, 80, 0.4);
}

.heading-compass { flex-shrink: 0; }

.heading-info {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
}

.heading-deg {
  font-size: 14px; font-weight: 700; color: #e8f0ff;
  letter-spacing: 0.03em; line-height: 1;
}

.heading-dir {
  font-size: 10px; font-weight: 600; color: #5588cc;
  letter-spacing: 0.08em; line-height: 1;
}
</style>
