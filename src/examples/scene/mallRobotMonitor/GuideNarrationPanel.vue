<template>
  <transition name="panel-fade">
    <div v-if="items.length" class="narration-panel">
      <div class="narration-panel__header">
        <span class="narration-panel__dot"></span>
        <span class="narration-panel__title">导览播报</span>
        <span class="narration-panel__count">{{ items.length }}</span>
      </div>
      <div class="narration-panel__list">
        <div v-for="item in items" :key="item.robotId" class="narration-panel__item">
          <div class="narration-panel__item-header">
            <span class="narration-panel__robot">{{ item.robotName }}</span>
            <span class="narration-panel__sep">→</span>
            <span class="narration-panel__poi">{{ item.data.title }}</span>
            <span class="narration-panel__floor">{{ item.data.tag }}</span>
            <span v-if="item.progress" class="narration-panel__progress">{{ item.progress }}</span>
          </div>
          <p v-if="item.data.summary" class="narration-panel__summary">{{ item.data.summary }}</p>
          <p v-if="item.data.narration" class="narration-panel__body">{{ item.data.narration }}</p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => []
  }
})
</script>

<style lang="scss" scoped>
.narration-panel {
  position: absolute;
  top: 12px;
  right: 80px;
  z-index: 30;
  min-width: 200px;
  max-width: 340px;
  padding: 10px 14px 10px;
  border-radius: 12px;
  background: linear-gradient(
    145deg,
    rgba(240, 248, 255, 0.96) 0%,
    rgba(224, 242, 254, 0.93) 45%,
    rgba(236, 254, 255, 0.95) 100%
  );
  backdrop-filter: blur(20px);
  border: 1px solid rgba(14, 165, 233, 0.2);
  box-shadow:
    0 6px 24px rgba(14, 165, 233, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.7) inset;
  font-family: 'Exo 2', sans-serif;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: 12px 12px 0 0;
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
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px dashed rgba(14, 165, 233, 0.18);
  }

  &__dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #06b6d4;
    box-shadow: 0 0 8px #06b6d4;
    animation: panel-pulse 1.5s ease-in-out infinite;
  }

  &__title {
    flex: 1;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #0f172a;
    text-transform: uppercase;
  }

  &__count {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    color: #0284c7;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(14, 165, 233, 0.12);
    border: 1px solid rgba(14, 165, 233, 0.2);
    line-height: 1.5;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 11px;
    line-height: 1.4;
    padding: 5px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.5);
    transition: background 0.2s;

    &:hover {
      background: rgba(14, 165, 233, 0.06);
    }
  }

  &__item-header {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__summary {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    color: #334155;
    line-height: 1.4;
  }

  &__body {
    margin: 0;
    font-size: 11px;
    line-height: 1.5;
    color: #64748b;
  }

  &__robot {
    font-weight: 700;
    color: #0f172a;
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__sep {
    color: #94a3b8;
    flex-shrink: 0;
  }

  &__poi {
    color: #334155;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  &__floor {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    color: #0284c7;
    padding: 0 5px;
    border-radius: 4px;
    background: rgba(14, 165, 233, 0.1);
    border: 1px solid rgba(14, 165, 233, 0.15);
  }

  &__progress {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    font-family: 'Space Mono', monospace;
    color: #0369a1;
    padding: 0 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(14, 165, 233, 0.15);
  }
}

@keyframes panel-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.7;
  }
}

.panel-fade-enter-active,
.panel-fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
