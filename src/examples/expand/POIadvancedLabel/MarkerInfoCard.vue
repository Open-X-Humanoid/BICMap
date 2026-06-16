<!--
  方向标记信息 HUD 卡（科技感风格）
  用法：
    <MarkerInfoCard :info="markerInfo" />
-->
<template>
  <transition name="hud-fade">
    <div class="marker-info-card" v-if="info">
      <div class="marker-info-header">
        <span class="marker-info-dot"></span>
        <span class="marker-info-title">标记信息</span>
        <span
          class="marker-info-badge"
          :class="{ on: info.editMode }"
        >{{ info.editMode ? 'EDIT' : 'VIEW' }}</span>
      </div>
      <div class="marker-info-row">
        <span class="marker-info-label">经度</span>
        <span class="marker-info-value mono">{{ Number(info.lng).toFixed(6) }}</span>
      </div>
      <div class="marker-info-row">
        <span class="marker-info-label">纬度</span>
        <span class="marker-info-value mono">{{ Number(info.lat).toFixed(6) }}</span>
      </div>
      <div class="marker-info-row">
        <span class="marker-info-label">旋转角度</span>
        <span class="marker-info-value mono">{{ Number(info.rotation).toFixed(1) }}°</span>
      </div>
      <div class="marker-info-tip">
        双击标记可切换编辑模式；编辑模式下拖动绿色滑块可旋转。
      </div>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  info: { type: Object, default: null }
})
</script>

<style scoped>
.marker-info-card {
  position: absolute;
  top: 20px;
  right: 20px;
  min-width: 260px;
  padding: 14px 16px 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(240,248,255,0.92) 0%, rgba(224,242,254,0.88) 40%, rgba(230,240,255,0.90) 100%);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(14,165,233,0.2);
  box-shadow: 0 8px 32px rgba(14,165,233,0.15), 0 0 0 1px rgba(255,255,255,0.7) inset;
  z-index: 30;
  overflow: hidden;
  font-family: 'Exo 2', sans-serif;
}
.marker-info-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent 5%, #06b6d4 20%, #3b82f6 40%, #8b5cf6 60%, #06b6d4 80%, transparent 95%);
}
.marker-info-header {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 10px; padding-bottom: 8px;
  border-bottom: 1px dashed rgba(14,165,233,0.2);
}
.marker-info-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #06b6d4;
  box-shadow: 0 0 8px #06b6d4;
  animation: marker-pulse 1.6s ease-in-out infinite;
}
.marker-info-title {
  flex: 1;
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.1em;
  background: linear-gradient(135deg, #236ae8 0%, #c588ff 40%, #06b6d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.marker-info-badge {
  font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
  padding: 2px 8px; border-radius: 999px;
  color: #64748b;
  background: rgba(148,163,184,0.14);
  border: 1px solid rgba(148,163,184,0.25);
  font-family: 'Space Mono', monospace;
  transition: all 0.25s;
}
.marker-info-badge.on {
  color: #ffffff;
  background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
  border-color: transparent;
  box-shadow: 0 0 10px rgba(16,185,129,0.5);
}
.marker-info-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 0; font-size: 12px;
}
.marker-info-label { color: #64748b; font-weight: 500; letter-spacing: 0.08em; }
.marker-info-value {
  color: #0369a1; font-weight: 700;
  max-width: 170px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.marker-info-value.mono {
  font-family: 'Space Mono', monospace;
  font-variant-numeric: tabular-nums;
}
.marker-info-tip {
  margin-top: 8px; padding-top: 8px;
  border-top: 1px dashed rgba(14,165,233,0.2);
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
  letter-spacing: 0.02em;
}
@keyframes marker-pulse {
  0%, 100% { transform: scale(1);   box-shadow: 0 0 8px  #06b6d4; }
  50%      { transform: scale(1.3); box-shadow: 0 0 14px #06b6d4; }
}

.hud-fade-enter-active, .hud-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.hud-fade-enter-from, .hud-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
