<!--
 * @Author: houser.hao@humanoid.com
 * @Date: Do not edit
 * @LastEditTime: Do not edit
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 地图工具示例：展示地图缩放、旋转、拖拽锁定、视角切换、自适应等常用交互操作
 * @FilePath: /bic-map/src/examples/base/mapTools/index.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="app-root">
    <canvas id="canvasMapTools" style="display: none"></canvas>

    <AppHeader title="地图工具" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="mapToolsMap" class="map-gl"></div>

        <aside class="hud-panel">
          <div class="hud-title">
            <span class="hud-bar"></span>
            地图状态
          </div>

          <dl class="hud-grid">
            <div class="hud-row">
              <dt>缩放级别</dt>
              <dd class="accent">{{ currentZoom }}</dd>
            </div>
            <div class="hud-row">
              <dt>朝向角</dt>
              <dd>{{ currentBearing }}°</dd>
            </div>
            <div class="hud-row">
              <dt>俯仰角</dt>
              <dd>{{ currentPitch }}°</dd>
            </div>
            <div class="hud-row">
              <dt>拖拽</dt>
              <dd :class="{ accent: dragEnabled, warn: !dragEnabled }">
                {{ dragEnabled ? '已启用' : '已锁定' }}
              </dd>
            </div>
            <div class="hud-row">
              <dt>视角</dt>
              <dd :class="{ accent: is3D }">{{ is3D ? '三维' : '二维' }}</dd>
            </div>
          </dl>

          <div class="hud-divider"></div>

          <ul class="hud-tips">
            <li>滚轮 / 双指 缩放地图</li>
            <li>右键拖拽可旋转视角</li>
            <li>Ctrl + 拖拽可调整俯仰</li>
          </ul>
        </aside>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { Box, Lock, Maximize2, Navigation, RotateCcw, RotateCw, Unlock, ZoomIn, ZoomOut } from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_transparent.png'

const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05
const ROTATE_STEP = 45
const PITCH_3D = 60

const map = ref(null)
const mapReady = ref(false)
const cameraBound = ref(null)
const currentZoom = ref('—')
const currentBearing = ref('0.0')
const currentPitch = ref('0.0')
const dragEnabled = ref(true)
const is3D = ref(false)

const footerButtons = computed(() => [
  { label: '放大', icon: ZoomIn, onClick: zoomIn, disabled: !mapReady.value },
  { label: '缩小', icon: ZoomOut, onClick: zoomOut, disabled: !mapReady.value },
  { label: '左旋', icon: RotateCcw, onClick: rotateLeft, disabled: !mapReady.value },
  { label: '右旋', icon: RotateCw, onClick: rotateRight, disabled: !mapReady.value },
  { label: '重置朝向', icon: Navigation, onClick: resetNorth, disabled: !mapReady.value },
  {
    label: dragEnabled.value ? '锁定拖拽' : '解锁拖拽',
    icon: dragEnabled.value ? Lock : Unlock,
    active: !dragEnabled.value,
    onClick: toggleDrag,
    disabled: !mapReady.value
  },
  {
    label: is3D.value ? '切换 2D' : '切换 3D',
    icon: Box,
    active: is3D.value,
    onClick: togglePitch,
    disabled: !mapReady.value
  },
  { label: '自适应', icon: Maximize2, onClick: fitMap, disabled: !mapReady.value || !cameraBound.value }
])

onMounted(() => initMap())
onBeforeUnmount(() => {
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'mapToolsMap',
      center: [116.4074, 39.9042],
      zoom: 18,
      backgroundColor: '#fff'
    })
    map.value.on('load', loadBaseMap)
    map.value.on('zoom', syncState)
    map.value.on('rotate', syncState)
    map.value.on('pitch', syncState)
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

/**
 * 同步地图状态到 HUD 面板
 */
function syncState() {
  if (!map.value) return
  currentZoom.value = map.value.getZoom().toFixed(1)
  currentBearing.value = map.value.getBearing().toFixed(1)
  currentPitch.value = map.value.getPitch().toFixed(1)
}

async function loadBaseMap() {
  if (!map.value) return
  try {
    const result = await bicMap.loadSlamMap(map.value, {
      startX: MAP_START_X,
      startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT,
      yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      imagePath: slamImage,
      canvasId: 'canvasMapTools',
      fitBounds: true
    })
    cameraBound.value = result.cameraBound
    mapReady.value = true
    syncState()
  } catch (error) {
    console.error('加载底图失败:', error)
  }
}

function zoomIn() {
  map.value?.zoomIn({ duration: 300 })
}

function zoomOut() {
  map.value?.zoomOut({ duration: 300 })
}

/**
 * 旋转地图（相对当前朝向偏移指定角度）
 * @param {number} delta - 旋转角度，正值顺时针，负值逆时针
 */
function rotateBy(delta) {
  if (!map.value) return
  map.value.flyTo({ bearing: map.value.getBearing() + delta, duration: 400 })
}

function rotateLeft() {
  rotateBy(-ROTATE_STEP)
}

function rotateRight() {
  rotateBy(ROTATE_STEP)
}

function resetNorth() {
  map.value?.flyTo({ bearing: 0, duration: 500 })
}

function toggleDrag() {
  if (!map.value) return
  if (dragEnabled.value) {
    map.value.dragPan.disable()
    map.value.dragRotate.disable()
  } else {
    map.value.dragPan.enable()
    map.value.dragRotate.enable()
  }
  dragEnabled.value = !dragEnabled.value
}

function togglePitch() {
  if (!map.value) return
  map.value.flyTo({ pitch: is3D.value ? 0 : PITCH_3D, duration: 600 })
  is3D.value = !is3D.value
}

/**
 * 自适应：飞回加载底图时计算的初始相机范围
 */
function fitMap() {
  if (!map.value || !cameraBound.value) return
  map.value.flyTo({ ...cameraBound.value, duration: 800 })
}
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

.map-area {
  position: relative;
  flex: 1;
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

.map-container {
  position: absolute;
  inset: 12px;
  border-radius: 16px;
  overflow: hidden;
  background: rgb(129 182 220 / 49%);
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
  width: 200px;
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
  gap: 10px;

  .hud-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.08em;
    color: #fff;
  }

  .hud-bar {
    width: 4px;
    height: 14px;
    border-radius: 2px;
    background: linear-gradient(180deg, #06b6d4 0%, #3b82f6 100%);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
    flex-shrink: 0;
  }

  .hud-grid {
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .hud-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    dt {
      color: #8eb4e6;
      font-weight: 500;
    }

    dd {
      margin: 0;
      font-family: 'Space Mono', 'Courier New', monospace;
      color: #c7dcf8;
      text-align: right;

      &.accent {
        color: #67e8f9;
        text-shadow: 0 0 8px rgba(103, 232, 249, 0.4);
      }

      &.warn {
        color: #fca5a5;
        text-shadow: 0 0 8px rgba(252, 165, 165, 0.4);
      }
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
  }

  .hud-tips {
    margin: 0;
    padding: 0 0 0 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    list-style: disc;
    color: #5a7db0;
    font-size: 11px;
    line-height: 1.5;
  }
}
</style>
