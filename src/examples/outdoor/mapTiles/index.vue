<!--
 * @Author: houser.hao@humanoid.com
 * @Date: Do not edit
 * @LastEditTime: 2026-06-02 10:17:47
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 地图瓦片加载示例：利用 BicMap GL 底层栅格瓦片 API，支持外部 URL 输入渲染
 * @FilePath: /bic-map-plugin/src/examples/outdoor/mapTiles/index.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="app-root">
    <AppHeader title="地图瓦片加载" />

    <main class="map-area">
      <div class="grid-bg"></div>
      <div class="map-container">
        <div id="mapTilesMap" class="map-gl"></div>
      </div>

      <div class="hud-panel">
        <div class="hud-title">
          <span class="hud-bar"></span>
          瓦片配置
        </div>

        <div class="hud-section-label">快捷预设</div>
        <div class="hud-presets">
          <button
            v-for="preset in TILE_PRESETS"
            :key="preset.name"
            class="hud-preset-btn"
            :class="{ 'hud-preset-btn--active': selectedPreset === preset.name }"
            @click="selectPreset(preset)"
          >
            {{ preset.name }}
          </button>
        </div>

        <div class="hud-section-label">瓦片地址</div>
        <textarea
          v-model="tileUrl"
          class="hud-url-input"
          placeholder="https://example.com/{z}/{x}/{y}.png"
          rows="3"
          spellcheck="false"
          @input="onUrlInput"
        />
        <div v-if="urlError" class="hud-error">{{ urlError }}</div>

        <div class="hud-row hud-row--gap">
          <span class="hud-label">瓦片尺寸</span>
          <div class="hud-size-btns">
            <button
              v-for="s in TILE_SIZES"
              :key="s"
              class="hud-size-btn"
              :class="{ 'hud-size-btn--active': tileSize === s }"
              @click="tileSize = s"
            >
              {{ s }}
            </button>
          </div>
        </div>

        <div class="hud-row hud-row--gap">
          <span class="hud-label">透明度</span>
          <span class="hud-value hud-value--accent">{{ (tileOpacity * 100).toFixed(0) }}%</span>
        </div>
        <input
          v-model.number="tileOpacity"
          class="hud-slider"
          type="range"
          min="0"
          max="1"
          step="0.05"
          @input="onOpacityChange"
        />

        <div class="hud-divider"></div>

        <div class="hud-row">
          <span class="hud-label">状态</span>
          <span class="hud-value" :class="{ 'hud-value--accent': tilesLoaded }">
            {{ tilesLoaded ? '已加载' : '未加载' }}
          </span>
        </div>
        <div class="hud-row">
          <span class="hud-label">缩放级别</span>
          <span class="hud-value">{{ currentZoom }}</span>
        </div>
        <div class="hud-row">
          <span class="hud-label">归因</span>
          <span class="hud-value hud-value--sm">{{ currentAttribution || '—' }}</span>
        </div>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Layers, Link, RotateCcw, Trash2 } from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'

const SOURCE_ID = 'map-tiles-source'
const LAYER_ID = 'map-tiles-layer'
const DEFAULT_CENTER = [116.3974, 39.9087]
const DEFAULT_ZOOM = 10
const DEFAULT_OPACITY = 1.0
const TILE_SIZES = [256, 512]
const URL_PLACEHOLDER = 'https://example.com/{z}/{x}/{y}.png'

const TILE_PRESETS = [
  {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileSize: 256,
    attribution: '© OpenStreetMap contributors'
  },
  {
    name: 'ESRI 卫星',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    tileSize: 256,
    attribution: '© Esri, Maxar, Earthstar Geographics'
  },
  {
    name: 'CartoDB 浅色',
    url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    tileSize: 256,
    attribution: '© CartoDB, © OpenStreetMap contributors'
  }
]

const map = ref(null)
const tileUrl = ref('')
const tileSize = ref(256)
const tileOpacity = ref(DEFAULT_OPACITY)
const tilesLoaded = ref(false)
const currentZoom = ref(DEFAULT_ZOOM.toFixed(1))
const urlError = ref('')
const selectedPreset = ref('')
const currentAttribution = ref('')

const footerButtons = computed(() => [
  {
    label: '应用瓦片',
    icon: Layers,
    onClick: applyTiles,
    disabled: !tileUrl.value || !!urlError.value
  },
  {
    label: '清除瓦片',
    icon: Trash2,
    onClick: clearTiles,
    disabled: !tilesLoaded.value
  },
  { label: '重置视角', icon: RotateCcw, onClick: resetView }
])

onMounted(() => initMap())
onBeforeUnmount(() => {
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

/**
 * 初始化地图实例
 */
async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'mapTilesMap',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      backgroundColor: 'transparent'
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('zoom', () => {
      currentZoom.value = map.value.getZoom().toFixed(1)
    })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

/**
 * 校验瓦片 URL 是否包含必要的占位符
 * @param {string} url
 * @returns {string} 错误信息，合法时返回空字符串
 */
function validateUrl(url) {
  if (!url.trim()) return 'URL 不能为空'
  if (!url.includes('{z}')) return 'URL 缺少 {z} 占位符'
  if (!url.includes('{x}') && !url.includes('{y}')) return 'URL 缺少 {x} / {y} 占位符'
  return ''
}

function onUrlInput() {
  selectedPreset.value = ''
  currentAttribution.value = ''
  urlError.value = tileUrl.value ? validateUrl(tileUrl.value) : ''
}

function onOpacityChange() {
  if (tilesLoaded.value && map.value) {
    map.value.setPaintProperty(LAYER_ID, 'raster-opacity', tileOpacity.value)
  }
}

/**
 * 选择预设瓦片，自动填充 URL 并应用
 * @param {{ name: string, url: string, tileSize: number, attribution: string }} preset
 */
function selectPreset(preset) {
  selectedPreset.value = preset.name
  tileUrl.value = preset.url
  tileSize.value = preset.tileSize
  currentAttribution.value = preset.attribution
  urlError.value = ''
  applyTiles()
}

/**
 * 移除已有的瓦片图层和数据源
 */
function removeTileLayer() {
  if (!map.value) return
  if (map.value.getLayer(LAYER_ID)) map.value.removeLayer(LAYER_ID)
  if (map.value.getSource(SOURCE_ID)) map.value.removeSource(SOURCE_ID)
}

/**
 * 应用瓦片：校验 URL → 重建 raster source + layer
 */
function applyTiles() {
  const error = validateUrl(tileUrl.value)
  if (error) {
    urlError.value = error
    return
  }
  if (!map.value) return

  removeTileLayer()

  map.value.addSource(SOURCE_ID, {
    type: 'raster',
    tiles: [tileUrl.value.trim()],
    tileSize: tileSize.value,
    minzoom: 0,
    maxzoom: 22
  })

  map.value.addLayer({
    id: LAYER_ID,
    type: 'raster',
    source: SOURCE_ID,
    paint: {
      'raster-opacity': tileOpacity.value,
      'raster-fade-duration': 300
    }
  })

  tilesLoaded.value = true
}

/**
 * 清除瓦片图层
 */
function clearTiles() {
  removeTileLayer()
  tilesLoaded.value = false
}

/**
 * 重置视角至默认中心和缩放级别
 */
function resetView() {
  map.value?.flyTo({
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    duration: 800
  })
}

watch(tileSize, () => {
  if (tilesLoaded.value) applyTiles()
})
</script>

<style lang="scss" scoped>
.app-root {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);
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

.map-area {
  position: relative;
  flex: 1;
  overflow: hidden;
  z-index: 10;
}

.map-container {
  position: absolute;
  inset: 12px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 30px rgba(14, 165, 233, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-gl {
  width: 100%;
  height: 100%;
}

.hud-panel {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 30;
  width: 280px;
  padding: 14px 16px 16px;
  border-radius: 14px;
  background: rgba(5, 18, 48, 0.82);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(80, 140, 255, 0.28);
  box-shadow: 0 6px 24px rgba(0, 20, 80, 0.4);
  color: #cfe4ff;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .hud-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.08em;
    color: #fff;
    margin-bottom: 2px;
  }

  .hud-bar {
    width: 4px;
    height: 14px;
    border-radius: 2px;
    background: linear-gradient(180deg, #06b6d4 0%, #3b82f6 100%);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
    flex-shrink: 0;
  }

  .hud-section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #6a9fd8;
    margin-top: 4px;
  }

  .hud-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .hud-preset-btn {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(80, 140, 255, 0.3);
    background: rgba(30, 60, 120, 0.4);
    color: #a0c4f8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

    &:hover {
      background: rgba(59, 130, 246, 0.25);
      border-color: rgba(99, 170, 255, 0.5);
      color: #dbeafe;
    }

    &--active {
      background: rgba(59, 130, 246, 0.35);
      border-color: #3b82f6;
      color: #93c5fd;
    }
  }

  .hud-url-input {
    width: 100%;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid rgba(80, 140, 255, 0.3);
    background: rgba(10, 25, 60, 0.6);
    color: #c7dcf8;
    font-size: 11px;
    font-family: 'Space Mono', 'Courier New', monospace;
    resize: none;
    outline: none;
    line-height: 1.5;
    transition: border-color 0.2s ease;
    box-sizing: border-box;

    &::placeholder {
      color: rgba(100, 140, 200, 0.4);
    }

    &:focus {
      border-color: rgba(99, 170, 255, 0.6);
    }
  }

  .hud-error {
    font-size: 11px;
    color: #f87171;
    margin-top: -2px;
  }

  .hud-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    &--gap {
      margin-top: 2px;
    }
  }

  .hud-label {
    color: #8eb4e6;
    flex-shrink: 0;
  }

  .hud-value {
    font-family: 'Space Mono', 'Courier New', monospace;
    color: #fff;
    text-align: right;
    word-break: break-all;

    &--accent {
      color: #67e8f9;
      text-shadow: 0 0 8px rgba(103, 232, 249, 0.4);
    }

    &--sm {
      font-size: 10px;
      color: #7099c4;
      font-family: inherit;
    }
  }

  .hud-size-btns {
    display: flex;
    gap: 4px;
  }

  .hud-size-btn {
    padding: 3px 10px;
    border-radius: 5px;
    border: 1px solid rgba(80, 140, 255, 0.3);
    background: rgba(30, 60, 120, 0.4);
    color: #a0c4f8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;

    &:hover {
      background: rgba(59, 130, 246, 0.2);
    }

    &--active {
      background: rgba(59, 130, 246, 0.35);
      border-color: #3b82f6;
      color: #93c5fd;
    }
  }

  .hud-slider {
    width: 100%;
    height: 4px;
    appearance: none;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      #3b82f6 0%,
      #3b82f6 calc(v-bind('(tileOpacity * 100) + "%"')),
      rgba(80, 140, 255, 0.2) calc(v-bind('(tileOpacity * 100) + "%"')),
      rgba(80, 140, 255, 0.2) 100%
    );
    outline: none;
    cursor: pointer;
    margin-top: 2px;

    &::-webkit-slider-thumb {
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #3b82f6;
      border: 2px solid #fff;
      box-shadow: 0 0 6px rgba(59, 130, 246, 0.6);
      cursor: pointer;
    }
  }

  .hud-divider {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(120, 160, 220, 0.35) 50%,
      transparent 100%
    );
    margin: 4px 0;
  }
}
</style>
