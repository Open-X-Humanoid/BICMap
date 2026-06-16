<template>
  <button
    class="zoom-btn"
    :title="title"
    @click="$emit('click')"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    ref="btnRef"
  >
    <slot></slot>
  </button>
</template>

<script setup>
import { ref } from 'vue'

defineProps({ title: String })
defineEmits(['click'])

const btnRef = ref(null)

const onEnter = () => {
  const el = btnRef.value
  if (!el) return
  el.style.borderColor = 'rgba(14,165,233,0.4)'
  el.style.boxShadow = '0 4px 15px rgba(14,165,233,0.15)'
  el.style.background = 'rgba(14,165,233,0.08)'
}
const onLeave = () => {
  const el = btnRef.value
  if (!el) return
  el.style.borderColor = 'rgba(14,165,233,0.2)'
  el.style.boxShadow = '0 2px 8px rgba(14,165,233,0.08)'
  el.style.background = 'rgba(255,255,255,0.85)'
}
</script>

<style scoped>
.zoom-btn {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(14,165,233,0.2);
  color: #0284c7;
  box-shadow: 0 2px 8px rgba(14,165,233,0.08);
}
.zoom-btn:hover {
  transform: scale(1.1);
}
.zoom-btn:active {
  transform: scale(0.9);
}
</style>
