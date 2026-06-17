<!--
 * @Date: 2026-04-22 10:30:00
 * @LastEditTime: 2026-06-05 14:46:29
 * @Description: 示例门户首页：以卡片网格形式展示所有示例，点击跳转
 * @FilePath: /bic-map/src/examples/home.vue
-->
<template>
  <div class="app-root">
    <AppHeader>
      <template #center>
        <h1 class="home-title">
          <!-- <span class="home-title__bic">Bic</span><span class="home-title__map">Map</span> -->
          <!-- <span class="home-title__sub">开发示例</span> -->
        </h1>
      </template>
    </AppHeader>

    <main class="portal-main">
      <div class="grid-bg"></div>

      <div class="portal-content">
        <section
          v-for="group in exampleGroups"
          :key="group.key"
          class="portal-section"
        >
          <header class="portal-section__header">
            <span class="portal-section__bar"></span>
            <h2 class="portal-section__title">{{ group.label }}</h2>
            <span class="portal-section__count">{{ group.items.length }}</span>
          </header>

          <ul class="portal-grid">
            <li
              v-for="item in group.items"
              :key="item.path"
              class="portal-card"
              @click="goTo(item)"
            >
              <div class="portal-card__cover" :class="{ 'has-img': item.thumb }">
                <div class="portal-card__cover-grid"></div>
                <div class="portal-card__cover-fx"></div>
                <img
                  v-if="item.thumb"
                  :src="item.thumb"
                  :alt="item.title"
                  class="portal-card__cover-img"
                  loading="lazy"
                />
                <component
                  v-else
                  :is="item.icon"
                  class="portal-card__cover-icon"
                  :size="44"
                  :stroke-width="1.4"
                />
                <span class="portal-card__cover-tag">预览图</span>
              </div>

              <div class="portal-card__body">
                <h3 class="portal-card__title">{{ item.title }}</h3>
                <p class="portal-card__path">{{ item.path }}</p>
              </div>

              <div class="portal-card__footer">
                <span class="portal-card__cta">
                  打开示例
                  <ArrowRight :size="14" />
                </span>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import {
  ArrowRight,
  Building2,
  Compass,
  Layers,
  Map as MapIcon,
  Shapes,
  Sparkles,
  Bot
} from 'lucide-vue-next'

import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'

const SELF_ROUTE_NAME = 'Home'

const GROUP_META = {
  indoor: { label: '室内地图', icon: MapIcon },
  scene: { label: '场景案例', icon: Bot },
  base: { label: '基础功能', icon: Shapes },
  expand: { label: '扩展能力', icon: Sparkles },
  outdoor: { label: '室外地图', icon: Building2 }
}

const PATH_TO_GROUP = [
  { test: (p) => p.startsWith('/indoor'), key: 'indoor' },
  { test: (p) => p.startsWith('/scene'), key: 'scene' },
  { test: (p) => p.startsWith('/base'), key: 'base' },
  { test: (p) => p.startsWith('/expand'), key: 'expand' },
  { test: (p) => p.startsWith('/outdoor'), key: 'outdoor' }
]

const THUMB_MAP = import.meta.glob('./assets/home-thum/*.png', {
  eager: true,
  import: 'default'
})

const router = useRouter()

const exampleGroups = computed(() => {
  const groupMap = new Map()
  for (const route of router.options.routes) {
    if (!route.component || route.name === SELF_ROUTE_NAME) continue
    const groupKey = resolveGroupKey(route.path)
    const meta = GROUP_META[groupKey]
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        key: groupKey,
        label: meta.label,
        icon: meta.icon,
        items: []
      })
    }
    groupMap.get(groupKey).items.push({
      title: route.meta?.title || route.name || route.path,
      path: route.path,
      name: route.name,
      icon: meta.icon,
      thumb: resolveThumb(route.path)
    })
  }
  return Array.from(groupMap.values())
})

const totalCount = computed(() =>
  exampleGroups.value.reduce((sum, g) => sum + g.items.length, 0)
)

const footerButtons = computed(() => [
  { label: `共 ${totalCount.value} 个示例`, active: false, icon: Layers },
  { label: '官方文档', active: false, icon: Compass, onClick: openDocs }
])

/**
 * 跳转到对应示例路由
 * @param {{ name?: string, path: string }} item
 */
function goTo(item) {
  if (item.name) {
    router.push({ name: item.name })
    return
  }
  router.push(item.path)
}

function resolveGroupKey(path) {
  const matched = PATH_TO_GROUP.find((rule) => rule.test(path))
  return matched.key
}

/**
 * 根据路由 path 解析对应缩略图 URL
 * 规则：去掉开头 '/'，将剩余 '/' 替换为 '_'，拼接 .png
 * 例如 '/indoor/slam' -> 'indoor_slam.png'
 * @param {string} path
 * @returns {string | undefined}
 */
function resolveThumb(path) {
  const fileName = path.replace(/^\//, '').replace(/\//g, '_') + '.png'
  return THUMB_MAP[`./assets/home-thum/${fileName}`]
}

function openDocs() {
  window.open('/API_DOC.md', '_blank')
}
</script>

<style lang="scss" scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);
}

.portal-main {
  flex: 1;
  position: relative;
  overflow: hidden;
  z-index: 10;
}

.grid-bg {
  position: absolute;
  inset: 0;
  opacity: 0.04;
  background-image:
    linear-gradient(rgba(14, 165, 233, 1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 1) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

.portal-content {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding: 24px 32px 32px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.portal-section {
  display: flex;
  flex-direction: column;
  gap: 14px;

  &__header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__bar {
    width: 4px;
    height: 18px;
    border-radius: 2px;
    background: linear-gradient(180deg, #06b6d4 0%, #3b82f6 100%);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
  }

  &__title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #1e293b;
  }

  &__count {
    font-size: 12px;
    font-weight: 600;
    color: #0284c7;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(14, 165, 233, 0.1);
    border: 1px solid rgba(14, 165, 233, 0.2);
    font-family: 'Space Mono', monospace;
  }
}

.portal-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.home-title {
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 0.12em;
  white-space: nowrap;

  &__bic { color: #1d81f5; }
  &__map { color: #000; }
  &__sub { color: #747474; margin-left: 0.5em; }
}

.portal-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(14, 165, 233, 0.15);
  box-shadow:
    0 4px 18px rgba(14, 165, 233, 0.06),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  backdrop-filter: blur(12px);
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;

  &:hover {
    transform: translateY(-4px);
    border-color: rgba(59, 130, 246, 0.4);
    box-shadow:
      0 10px 30px rgba(14, 165, 233, 0.18),
      0 0 0 1px rgba(255, 255, 255, 0.9) inset;

    .portal-card__cover-icon {
      transform: scale(1.08);
      color: #2563eb;
    }

    .portal-card__cta {
      background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
      color: #fff;
    }
  }

  &__cover {
    position: relative;
    aspect-ratio: 16 / 9;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  &__cover-grid {
    position: absolute;
    inset: 0;
    opacity: 0.18;
    background-image:
      linear-gradient(rgba(14, 165, 233, 1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(14, 165, 233, 1) 1px, transparent 1px);
    background-size: 22px 22px;
    pointer-events: none;
    z-index: 1;
  }

  &__cover-fx {
    position: absolute;
    inset: 7px;
    pointer-events: none;
    z-index: 4;
    background:
      linear-gradient(to right,  rgba(99, 170, 255, 0.5) 2px, transparent 2px) top left    / 13px 13px no-repeat,
      linear-gradient(to bottom, rgba(99, 170, 255, 0.5) 2px, transparent 2px) top left    / 13px 13px no-repeat,
      linear-gradient(to left,   rgba(99, 170, 255, 0.5) 2px, transparent 2px) top right   / 13px 13px no-repeat,
      linear-gradient(to bottom, rgba(99, 170, 255, 0.5) 2px, transparent 2px) top right   / 13px 13px no-repeat,
      linear-gradient(to right,  rgba(99, 170, 255, 0.5) 2px, transparent 2px) bottom left / 13px 13px no-repeat,
      linear-gradient(to top,    rgba(99, 170, 255, 0.5) 2px, transparent 2px) bottom left / 13px 13px no-repeat,
      linear-gradient(to left,   rgba(99, 170, 255, 0.5) 2px, transparent 2px) bottom right / 13px 13px no-repeat,
      linear-gradient(to top,    rgba(99, 170, 255, 0.5) 2px, transparent 2px) bottom right / 13px 13px no-repeat;
  }

  &__cover-icon {
    position: relative;
    z-index: 2;
    color: #3b82f6;
    transition: transform 0.3s ease, color 0.3s ease;
    filter: drop-shadow(0 2px 8px rgba(59, 130, 246, 0.25));
  }

  &__cover-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    transition: transform 0.3s ease;
    z-index: 2;
  }

  &:hover &__cover-img {
    transform: scale(1.04);
  }

  &__cover-tag {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: #0284c7;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(14, 165, 233, 0.25);
    font-family: 'Space Mono', monospace;
    z-index: 5;
  }

  &__body {
    padding: 14px 16px 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: 0.02em;
  }

  &__path {
    margin: 0;
    font-size: 11px;
    color: #64748b;
    font-family: 'Space Mono', monospace;
    word-break: break-all;
  }

  &__footer {
    margin-top: auto;
    padding: 8px 16px 14px;
    display: flex;
    justify-content: flex-end;
  }

  &__cta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: #0284c7;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(14, 165, 233, 0.3);
    background: rgba(255, 255, 255, 0.6);
    transition: background 0.25s ease, color 0.25s ease;
  }
}


</style>
