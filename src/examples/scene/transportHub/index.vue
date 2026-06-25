<!--
 * @Date: 2026-06-25
 * @Description: 三站一场导览 — 融合火车站、客运站、飞机场同类导览示例
 * @FilePath: /bic-map/src/examples/scene/transportHub/index.vue
-->
<template>
  <div class="transport-hub">
    <AppHeader title="三站一场路径规划" />

    <div class="transport-hub__scene">
      <component
        :is="activeScene.component"
        :key="activeScene.key"
        embedded
        ref="sceneRef"
      />
    </div>

    <AppFooter
      :left-buttons="typeFooterButtons"
      :right-buttons="sceneFooterButtons"
    />
  </div>
</template>

<script setup>
import { computed, ref, unref } from 'vue'

import { Building2, Plane, TrainFront } from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'

import {
  DEFAULT_SCENE_TYPE,
  SCENE_TYPES,
  SCENE_TYPE_AIRPORT,
  SCENE_TYPE_PASSENGER,
  SCENE_TYPE_STATION,
} from './constants.js'

const SCENE_TYPE_ICONS = {
  [SCENE_TYPE_STATION]: TrainFront,
  [SCENE_TYPE_PASSENGER]: Building2,
  [SCENE_TYPE_AIRPORT]: Plane,
}

const activeSceneType = ref(DEFAULT_SCENE_TYPE)
const sceneRef = ref(null)

const activeScene = computed(() =>
  SCENE_TYPES.find(item => item.key === activeSceneType.value) || SCENE_TYPES[0]
)

const typeFooterButtons = computed(() =>
  SCENE_TYPES.map(item => ({
    label: item.label,
    icon: SCENE_TYPE_ICONS[item.key],
    active: item.key === activeSceneType.value,
    onClick: () => switchScene(item.key),
  }))
)

const sceneFooterButtons = computed(() => unref(sceneRef.value?.footerButtons) || [])

/**
 * 切换三站一场子场景
 * @param {string} sceneType
 */
function switchScene(sceneType) {
  if (sceneType === activeSceneType.value) return
  activeSceneType.value = sceneType
}
</script>

<style lang="scss" scoped>
.transport-hub {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  inset: 0;
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);
}

.transport-hub__scene {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
</style>
