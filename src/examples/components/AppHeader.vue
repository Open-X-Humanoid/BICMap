<!--
 * @Description: 公共顶部 Header 组件
 * 支持 props: title, showTime
 * 支持 slot: left / center / right
-->
<template>
  <header class="header-bar">
    <div class="header-bg"></div>
    <div class="header-line"></div>
    <div class="header-line-glow"></div>

    <div class="header-content">
      <!-- 左侧：默认显示 logo，可通过 #left slot 覆盖 -->
      <div class="header-left">
        <slot name="left">
          <div class="logo-wrap" v-if="logoUrl" :class="{ 'logo-clickable': !isHome }" @click="goHome">
            <img :src="logoUrl" alt="logo" class="logo-img" />
          </div>
        </slot>
      </div>

      <!-- 中间：默认显示 title，可通过 #center slot 覆盖 -->
      <div class="header-center">
        <slot name="center">
          <h1 class="header-title">{{ title }}</h1>
        </slot>
      </div>

      <!-- 右侧：默认显示时钟，可通过 #right slot 覆盖，showTime=false 可隐藏 -->
      <div class="header-right">
        <slot name="right">
          <div class="time-block" v-if="showTime">
            <div class="time-value">{{ timeStr }}</div>
            <div class="date-value">{{ dateStr }}</div>
          </div>
        </slot>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import logoUrl from '../assets/bicmap_abstract_light.png'

defineProps({
  /** 标题文字 */
  title: { type: String, default: '' },
  /** 是否显示右侧时钟，默认 true */
  showTime: { type: Boolean, default: true }
})

const router = useRouter()
const route = useRoute()
const isHome = computed(() => route.name === 'Home')

function goHome() {
  if (!isHome.value) router.push({ name: 'Home' })
}

const time = ref(new Date())
const timeStr = computed(() => time.value.toLocaleTimeString('zh-CN', { hour12: false }))
const dateStr = computed(() =>
  time.value.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
)

let timer = null
onMounted(() => { timer = setInterval(() => { time.value = new Date() }, 1000) })
onBeforeUnmount(() => { clearInterval(timer) })
</script>

<style scoped>
.header-bar {
  position: relative;
  z-index: 20;
  flex-shrink: 0;
}
.header-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(240,248,255,0.92) 0%, rgba(224,242,254,0.88) 40%, rgba(230,240,255,0.90) 100%);
  backdrop-filter: blur(20px);
}
.header-line {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 5%, #06b6d4 20%, #3b82f6 40%, #137af5 60%, #06b6d4 80%, transparent 95%);
}
.header-line-glow {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 5%, rgba(6,182,212,0.12) 30%, rgba(59,130,246,0.10) 50%, rgba(6,182,212,0.12) 70%, transparent 95%);
  filter: blur(3px);
}
.header-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
}
.header-left { display: flex; align-items: center; }
.logo-wrap { position: relative; display: flex; align-items: center; }
.logo-img {
  height: 36px; width: auto; object-fit: contain; display: block;
  filter: drop-shadow(0 2px 8px rgba(14,165,233,0.2));
}
.logo-clickable {
  cursor: pointer;
}
.logo-clickable:hover .logo-img {
  filter: drop-shadow(0 2px 12px rgba(14,165,233,0.5));
  transform: scale(1.05);
  transition: filter 0.2s, transform 0.2s;
}
.header-center {
  position: absolute;
  left: 50%; transform: translateX(-50%);
  pointer-events: none;
  padding: 8px 20px; overflow: hidden;
}
.header-title {
  position: relative;
  font-size: 17px; font-weight: 800;
  letter-spacing: 0.12em;
  margin: 0; white-space: nowrap;
  color: #64686d;
}
.header-right { display: flex; align-items: center; gap: 16px; }
.time-block { text-align: right; }
.time-value {
  font-size: 14px; font-weight: 700;
  font-family: 'Space Mono', monospace; color: #1d81f5;
  font-variant-numeric: tabular-nums;
}
.date-value {
  font-size: 9px; font-family: 'Space Mono', monospace;
  color: #94a3b8; font-variant-numeric: tabular-nums; letter-spacing: 0.05em;
}

</style>
