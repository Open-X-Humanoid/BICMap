<!--
  点位信息 HUD 卡（科技感风格）
  用法：
    <POIInfoCard :data="selectedPOI" @close="selectedPOI = null" />
-->
<template>
  <transition name="hud-fade">
    <div class="poi-info-card" v-if="data">
      <div class="poi-info-header">
        <span class="poi-info-dot"></span>
        <span class="poi-info-title">点位信息</span>
        <span class="poi-info-close" @click="$emit('close')">×</span>
      </div>
      <div class="poi-info-row">
        <span class="poi-info-label">名称</span>
        <span class="poi-info-value">{{ data.name }}</span>
      </div>
      <div class="poi-info-row">
        <span class="poi-info-label">ID</span>
        <span class="poi-info-value mono">{{ data.id }}</span>
      </div>
      <div class="poi-info-row">
        <span class="poi-info-label">经度</span>
        <span class="poi-info-value mono">{{ data.lngLat[0].toFixed(6) }}</span>
      </div>
      <div class="poi-info-row">
        <span class="poi-info-label">纬度</span>
        <span class="poi-info-value mono">{{ data.lngLat[1].toFixed(6) }}</span>
      </div>
      <div class="poi-info-row">
        <span class="poi-info-label">朝向</span>
        <span class="poi-info-value mono">{{ Number(data.rotation).toFixed(1) }}°</span>
      </div>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  data: { type: Object, default: null }
})
defineEmits(['close'])
</script>

<style scoped>
.poi-info-card {
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
.poi-info-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent 5%, #06b6d4 20%, #3b82f6 40%, #8b5cf6 60%, #06b6d4 80%, transparent 95%);
}
.poi-info-header {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 10px; padding-bottom: 8px;
  border-bottom: 1px dashed rgba(14,165,233,0.2);
}
.poi-info-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #06b6d4;
  box-shadow: 0 0 8px #06b6d4;
  animation: poi-pulse 1.6s ease-in-out infinite;
}
.poi-info-title {
  flex: 1;
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.1em;
  background: linear-gradient(135deg, #236ae8 0%, #c588ff 40%, #06b6d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.poi-info-close {
  font-size: 18px; line-height: 1; color: #64748b;
  cursor: pointer; user-select: none;
  width: 20px; height: 20px; text-align: center;
  border-radius: 4px; transition: all 0.2s;
}
.poi-info-close:hover { background: rgba(14,165,233,0.1); color: #0369a1; }
.poi-info-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 0; font-size: 12px;
}
.poi-info-label { color: #64748b; font-weight: 500; letter-spacing: 0.08em; }
.poi-info-value {
  color: #0369a1; font-weight: 700;
  max-width: 170px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.poi-info-value.mono {
  font-family: 'Space Mono', monospace;
  font-variant-numeric: tabular-nums;
}
@keyframes poi-pulse {
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
