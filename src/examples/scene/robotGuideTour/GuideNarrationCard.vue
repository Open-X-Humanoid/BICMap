<!--
 * @Description: 导览讲解浮层 — 机器人到达 POI 时展示介绍文案
 * @FilePath: /bic-map/src/examples/scene/robotGuideTour/GuideNarrationCard.vue
-->
<template>
  <transition name="hud-fade">
    <div v-if="data" class="guide-narration">
      <div class="guide-narration__header">
        <span class="guide-narration__dot"></span>
        <div class="guide-narration__titles">
          <span class="guide-narration__tag">{{ data.tag }}</span>
          <h3 class="guide-narration__title">{{ data.title }}</h3>
        </div>
        <span v-if="progress" class="guide-narration__progress">{{ progress }}</span>
      </div>
      <p class="guide-narration__summary">{{ data.summary }}</p>
      <p class="guide-narration__body">{{ data.narration }}</p>
      <div class="guide-narration__footer">
        <span class="guide-narration__hint">智能讲解播放中</span>
        <span class="guide-narration__pulse"></span>
      </div>
    </div>
  </transition>
</template>

<script setup>
/**
 * 导览讲解浮层组件 Props
 * @property {Object|null} data 当前讲解点数据（title / tag / summary / narration）
 * @property {string} progress 进度文案，如 "2/5"
 */
defineProps({
  data: { type: Object, default: null },
  progress: { type: String, default: '' }
})
</script>

<style lang="scss" scoped>
.guide-narration {
  position: absolute;
  top: 20px;
  right: 20px;
  width: min(360px, calc(100% - 40px));
  padding: 16px 18px 14px;
  border-radius: 16px;
  background: linear-gradient(
    145deg,
    rgba(240, 248, 255, 0.95) 0%,
    rgba(224, 242, 254, 0.92) 45%,
    rgba(236, 254, 255, 0.94) 100%
  );
  backdrop-filter: blur(20px);
  border: 1px solid rgba(14, 165, 233, 0.22);
  box-shadow:
    0 10px 36px rgba(14, 165, 233, 0.16),
    0 0 0 1px rgba(255, 255, 255, 0.75) inset;
  z-index: 30;
  font-family: 'Exo 2', sans-serif;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: 16px 16px 0 0;
    background: linear-gradient(
      90deg,
      transparent 5%,
      #06b6d4 25%,
      #3b82f6 50%,
      #8b5cf6 75%,
      transparent 95%
    );
  }

  &__header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px dashed rgba(14, 165, 233, 0.2);
  }

  &__dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    margin-top: 6px;
    border-radius: 50%;
    background: #06b6d4;
    box-shadow: 0 0 10px #06b6d4;
    animation: guide-pulse 1.5s ease-in-out infinite;
  }

  &__titles {
    flex: 1;
    min-width: 0;
  }

  &__tag {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #0284c7;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(14, 165, 233, 0.12);
    border: 1px solid rgba(14, 165, 233, 0.25);
    margin-bottom: 4px;
  }

  &__title {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #0f172a;
    line-height: 1.3;
  }

  &__progress {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: #0369a1;
    font-family: 'Space Mono', monospace;
    padding: 4px 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.65);
    border: 1px solid rgba(14, 165, 233, 0.2);
  }

  &__summary {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: #334155;
    line-height: 1.5;
  }

  &__body {
    margin: 0;
    font-size: 12px;
    line-height: 1.65;
    color: #475569;
  }

  &__footer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(14, 165, 233, 0.12);
  }

  &__hint {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #059669;
    text-transform: uppercase;
  }

  &__pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    animation: guide-pulse 1s ease-in-out infinite;
  }
}

@keyframes guide-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.7;
  }
}

.hud-fade-enter-active,
.hud-fade-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.hud-fade-enter-from,
.hud-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>
