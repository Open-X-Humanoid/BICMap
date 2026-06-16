<!--
  视角跟随状态徽章（左上角）
  用法：
    <FollowBadge :visible="follow" :pose="pose" />
-->
<template>
  <transition name="hud-fade">
    <div class="follow-badge" v-if="visible && pose">
      <span class="follow-badge-dot"></span>
      <span class="follow-badge-text">视角跟随中</span>
      <span class="follow-badge-phase" v-if="phaseLabel">{{ phaseLabel }}</span>
      <span class="follow-badge-meta mono">
        {{ pose.lng.toFixed(5) }}, {{ pose.lat.toFixed(5) }} · {{ pose.heading.toFixed(0) }}°
      </span>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  pose:    { type: Object,  default: null },
  phase:   { type: String,  default: '' }
})

const PHASE_MAP = {
  forward: '直行中',
  scan: '左右扫视',
  turn: '原地掉头',
  circle: '圆周巡航',
  moving: '巡航中'
}
const phaseLabel = computed(() => PHASE_MAP[props.phase] || '')
</script>

<style scoped>
.follow-badge {
  position: absolute;
  top: 20px;
  left: 20px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(16,185,129,0.14), rgba(6,182,212,0.18));
  backdrop-filter: blur(14px);
  border: 1px solid rgba(16,185,129,0.35);
  box-shadow: 0 6px 24px rgba(16,185,129,0.18), 0 0 0 1px rgba(255,255,255,0.5) inset;
  z-index: 30;
  font-family: 'Exo 2', sans-serif;
  color: #047857;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.follow-badge-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
  animation: follow-pulse 1.2s ease-in-out infinite;
}
.follow-badge-text { text-transform: uppercase; }
.follow-badge-phase {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(16,185,129,0.22);
  color: #065f46;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  border: 1px solid rgba(16,185,129,0.4);
}
.follow-badge-meta {
  color: #0f766e;
  font-weight: 600;
  opacity: 0.85;
}
.follow-badge-meta.mono {
  font-family: 'Space Mono', monospace;
  font-variant-numeric: tabular-nums;
}
@keyframes follow-pulse {
  0%, 100% { transform: scale(1);   box-shadow: 0 0 10px #10b981; }
  50%      { transform: scale(1.3); box-shadow: 0 0 18px #10b981; }
}

.hud-fade-enter-active, .hud-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.hud-fade-enter-from, .hud-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
