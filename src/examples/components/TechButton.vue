<template>
  <div
    class="tech-btn"
    :class="{ active: active, disabled: disabled }"
    :role="disabled ? undefined : 'button'"
    :tabindex="disabled ? -1 : 0"
    :aria-disabled="disabled || undefined"
    @click="handleClick"
    @keydown.enter.space.prevent="handleClick"
  >
    <div class="scan-overlay"></div>
    <span class="btn-icon"><slot name="icon"></slot></span>
    <span class="btn-label">{{ label }}</span>
  </div>
</template>

<script setup>
const props = defineProps({
  label: String,
  active: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['click'])

const handleClick = () => {
  if (props.disabled) return
  emit('click')
}
</script>

<style scoped>
.tech-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border-radius: 12px;
  border: 1px solid rgba(14, 165, 233, 0.2);
  font-size: 14px;
  font-weight: 600;
  font-family: 'Exo 2', sans-serif;
  overflow: hidden;
  transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease,
    box-shadow 0.25s ease, transform 0.25s ease;
  background: rgba(255, 255, 255, 0.7);
  color: #0369a1;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.06);
  cursor: pointer;
  user-select: none;
  outline: none;
}
.tech-btn:focus-visible {
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.5);
}

.tech-btn:not(.disabled):hover {
  transform: translateY(-1px) scale(1.03);
}
.tech-btn:not(.disabled):active {
  transform: scale(0.97);
}

/* 非选中态 hover */
.tech-btn:not(.active):not(.disabled):hover {
  background: rgba(14, 165, 233, 0.08);
  border-color: rgba(14, 165, 233, 0.35);
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.1);
}

/* 选中态（主推动作 / 当前启用状态）—— 蓝色渐变 */
.tech-btn.active {
  background: linear-gradient(135deg, #1a94f0 0%, #38bdf8 100%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.3);
  transform: translateZ(0);
}
.tech-btn.active:not(.disabled):hover {
  box-shadow: 0 6px 25px rgba(14, 165, 233, 0.4);
}

.tech-btn.disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: auto;
  filter: grayscale(0.35);
}
.tech-btn.disabled:hover {
  transform: none;
}
.tech-btn.disabled:active {
  transform: none;
}

.scan-overlay {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.5s;
  pointer-events: none;
}
.tech-btn:not(.disabled):hover .scan-overlay {
  opacity: 1;
  background: linear-gradient(90deg, transparent, rgba(14, 165, 233, 0.05), transparent);
  animation: scan-sweep 3s linear infinite;
}
.tech-btn.active:not(.disabled):hover .scan-overlay {
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
}

@keyframes scan-sweep {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.btn-icon,
.btn-label {
  position: relative;
  z-index: 1;
}
.btn-icon {
  display: flex;
  align-items: center;
}
</style>
