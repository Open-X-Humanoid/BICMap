<!--
 * @Description: 几何要素语义渲染 — 多边形分割展示机器人相关区域（办公室/走廊/充电/禁行等）
 * @FilePath: /bic-map-plugin/src/examples/indoor/semanticMap/index.vue
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" class="app-root__canvas"></canvas>

    <AppHeader title="语义地图分割" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="semanticMapMain" class="map-gl"></div>

        <aside class="overlay-panel overlay-legend" aria-label="语义图例">
          <div class="panel-title">语义图例</div>
          <p class="legend-tip">点击彩色区域查看语义详情</p>
          <p v-if="!slamMapReady" class="hint-wait">正在加载 SLAM 地图底图…</p>
          <ul v-else class="legend-list">
            <li
              v-for="type in LEGEND_ZONE_TYPES"
              :key="type"
              class="legend-item"
            >
              <span
                class="legend-item__swatch"
                :style="{
                  background: legendStyle(type).fillColor,
                  borderColor: legendStyle(type).outlineColor
                }"
              ></span>
              <span class="legend-item__label">{{ legendStyle(type).label }}</span>
            </li>
          </ul>
        </aside>

        <aside
          v-if="selectedZone"
          class="overlay-panel overlay-detail"
          aria-label="区域详情"
        >
          <div class="panel-title">
            区域详情
            <button type="button" class="detail-close-x" @click="selectedZone = null" aria-label="关闭">
              <X :size="14" />
            </button>
          </div>
          <dl class="detail-grid">
            <div><dt>名称</dt><dd>{{ selectedZone.name }}</dd></div>
            <div><dt>语义类型</dt><dd>{{ typeLabel(selectedZone.type) }}</dd></div>
            <div v-if="selectedZone.speedLimit">
              <dt>限速</dt><dd>{{ selectedZone.speedLimit }} m/s</dd>
            </div>
            <div><dt>说明</dt><dd>{{ selectedZone.description || typeLabel(selectedZone.type) }}</dd></div>
          </dl>
        </aside>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import { Eye, EyeOff, X } from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_transparent.png'

import { SLAM_MAP_CONFIG, LEGEND_ZONE_TYPES, ZONE_STYLE_PRESETS, SEMANTIC_ZONE_TYPE } from './constants'
import { buildZonesFromMock } from './geoUtils'
import { createSemanticZones } from './createSemanticZones'
import { SEMANTIC_ZONE_DEFS } from './zoneMockData'

const MAP_CONTAINER_ID = 'semanticMapMain'
const CANVAS_ID = 'canvasMap'

const map = ref(null)
const slamMapReady = ref(false)
const zonesVisible = ref(true)
const selectedZone = ref(null)

let zoneController = null

const { startX, startY, xGridCount, yGridCount, resolution } = SLAM_MAP_CONFIG

const footerButtons = computed(() => [
  {
    label: zonesVisible.value ? '隐藏语义层' : '显示语义层',
    active: zonesVisible.value,
    icon: zonesVisible.value ? EyeOff : Eye,
    onClick: toggleZones
  }
])

/**
 * 获取图例样式
 * @param {string} type
 */
function legendStyle(type) {
  return ZONE_STYLE_PRESETS[type] ?? ZONE_STYLE_PRESETS[SEMANTIC_ZONE_TYPE.OFFICE]
}

/**
 * 语义类型中文名
 * @param {string} type
 */
function typeLabel(type) {
  return legendStyle(type).label
}

function toggleZones() {
  if (!zoneController) return
  if (zonesVisible.value) {
    zoneController.hide()
    zonesVisible.value = false
    selectedZone.value = null
  } else {
    zoneController.show()
    zonesVisible.value = true
  }
}

/**
 * 加载语义多边形图层
 */
function loadSemanticZones() {
  const m = map.value
  if (!m || !window.MapUtils) return

  if (zoneController) {
    zoneController.remove()
    zoneController = null
  }

  const zones = buildZonesFromMock(SEMANTIC_ZONE_DEFS)
  zoneController = createSemanticZones(m, zones, {
    showLabels: true,
    onClick: ({ zone }) => {
      selectedZone.value = zone ?? null
    }
  })
  zonesVisible.value = true
}

async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: MAP_CONTAINER_ID,
      center: [116.4074, 39.9042],
      zoom: 18,
      backgroundColor: '#fff'
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', () => {
      loadSlamMap()
    })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

async function loadSlamMap() {
  if (!map.value) return
  try {
    await bicMap.loadSlamMap(map.value, {
      startX,
      startY,
      xGridCount,
      yGridCount,
      resolution,
      imagePath: slamImage,
      canvasId: CANVAS_ID,
      fitBounds: true
    })
    slamMapReady.value = true
    loadSemanticZones()
  } catch (error) {
    console.error('加载 SLAM 地图失败:', error)
  }
}

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  slamMapReady.value = false
  if (zoneController) {
    zoneController.remove()
    zoneController = null
  }
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})
</script>

<style lang="scss" scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  inset: 0;
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);

  &__canvas {
    display: none;
  }
}

.map-area {
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
}

.map-container {
  position: absolute;
  inset: 12px;
  border-radius: 16px;
  overflow: hidden;
  background: rgb(129 182 220 / 49%);
  box-shadow:
    0 4px 30px rgba(14, 165, 233, 0.06),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-gl {
  width: 100%;
  height: 100%;
}

.overlay-panel {
  position: absolute;
  z-index: 20;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(14, 165, 233, 0.22);
  box-shadow: 0 8px 32px rgba(14, 165, 233, 0.08);
  font-size: 13px;
  color: #0c4a6e;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #0369a1;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(14, 165, 233, 0.15);
}

.overlay-legend {
  top: 12px;
  left: 12px;
  max-width: min(220px, calc(100% - 24px));
  max-height: min(70vh, 520px);
  overflow-y: auto;
}

.hint-wait {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

.legend-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;

  &__swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 2px solid;
    flex-shrink: 0;
  }

  &__label {
    color: #0c4a6e;
  }
}

.legend-tip {
  margin: 10px 0 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(14, 165, 233, 0.08);
  font-size: 11px;
  color: #64748b;
}

.overlay-detail {
  top: 12px;
  right: 12px;
  max-width: min(280px, calc(100% - 24px));

  .panel-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(14, 165, 233, 0.15);
    padding-bottom: 6px;
    margin-bottom: 8px;
  }
}

.detail-close-x {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid rgba(14, 165, 233, 0.25);
  background: rgba(14, 165, 233, 0.08);
  color: #0369a1;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.15s;
  margin-left: 4px;

  &:hover {
    background: rgba(14, 165, 233, 0.2);
  }
}

.detail-grid {
  display: grid;
  gap: 8px;
  margin: 0;

  dt {
    margin: 0;
    font-size: 10px;
    color: #64748b;
  }

  dd {
    margin: 2px 0 0;
    font-weight: 600;
    font-size: 12px;
    color: #0c4a6e;
  }
}

@media (max-width: 768px) {
  .map-container {
    inset: 8px;
  }

  .overlay-legend {
    left: 8px;
    right: 8px;
    max-width: none;
    top: 8px;
    max-height: min(36vh, 280px);
  }

  .overlay-detail {
    left: 8px;
    right: 8px;
    top: auto;
    bottom: 100px;
    max-width: none;
  }
}
</style>
