<template>
  <div class="hud-panel">
    <div class="hud-title">
      <span class="hud-bar"></span>
      建筑参数
    </div>

    <div class="hud-row">
      <span class="hud-label">状态</span>
      <span class="hud-value" :class="{ 'hud-value--accent': buildingsVisible }">
        {{ buildingsVisible ? '显示' : '隐藏' }}
      </span>
    </div>
    <div class="hud-row">
      <span class="hud-label">颜色模式</span>
      <span class="hud-value">{{ useCustomColor ? '单色' : '分类色' }}</span>
    </div>
    <div class="hud-row">
      <span class="hud-label">建筑数量</span>
      <span class="hud-value">{{ buildingCount }}</span>
    </div>

    <div class="hud-divider"></div>

    <div class="hud-slider">
      <label>高度倍数</label>
      <input
        :value="heightScale"
        type="range"
        min="0.2"
        max="3"
        step="0.1"
        @input="onHeightScaleInput"
      />
      <span>{{ heightScale.toFixed(1) }}x</span>
    </div>

    <div class="hud-slider">
      <label>不透明度</label>
      <input
        :value="buildingOpacity"
        type="range"
        min="0.1"
        max="1"
        step="0.05"
        @input="onOpacityInput"
      />
      <span>{{ buildingOpacity.toFixed(2) }}</span>
    </div>

    <div class="hud-row hud-row--color" v-if="useCustomColor">
      <label class="hud-label">单色</label>
      <input
        :value="customColor"
        class="hud-color"
        type="color"
        @input="onColorInput"
        @change="onColorChange"
      />
    </div>

    <div class="hud-divider"></div>

    <div class="hud-tip">
      基于 MapLibre fill-extrusion 图层，GeoJSON 建筑面片按 height 属性拉伸为 3D 楼块；底图由纯 GeoJSON 矢量数据渲染，无需网络连接。
    </div>
  </div>
</template>

<script setup>
defineProps({
  buildingsVisible: Boolean,
  useCustomColor: Boolean,
  buildingCount: Number,
  heightScale: Number,
  buildingOpacity: Number,
  customColor: String,
})

const emit = defineEmits([
  'update:heightScale',
  'update:buildingOpacity',
  'update:customColor',
  'applyHeightScale',
  'applyOpacity',
  'reloadBuildings',
])

function onHeightScaleInput(e) {
  const val = parseFloat(e.target.value)
  emit('update:heightScale', val)
  emit('applyHeightScale')
}

function onOpacityInput(e) {
  const val = parseFloat(e.target.value)
  emit('update:buildingOpacity', val)
  emit('applyOpacity')
}

function onColorInput(e) {
  emit('update:customColor', e.target.value)
}

function onColorChange() {
  emit('reloadBuildings')
}
</script>

<style scoped lang="scss">
.hud-panel {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 30;
  width: 260px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(5, 18, 48, 0.78);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(80, 140, 255, 0.28);
  box-shadow: 0 6px 24px rgba(0, 20, 80, 0.35);
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
  }

  .hud-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    &--color {
      .hud-color {
        width: 44px;
        height: 22px;
        padding: 0;
        border: 1px solid rgba(120, 160, 220, 0.3);
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
      }
    }
  }

  .hud-label {
    color: #8eb4e6;
  }

  .hud-value {
    font-family: 'Space Mono', 'Courier New', monospace;
    color: #fff;

    &--accent {
      color: #67e8f9;
      text-shadow: 0 0 8px rgba(103, 232, 249, 0.5);
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

  .hud-slider {
    display: flex;
    align-items: center;
    gap: 8px;

    label {
      width: 64px;
      flex-shrink: 0;
      color: #8eb4e6;
    }

    input[type='range'] {
      flex: 1;
      accent-color: #3b82f6;
    }

    span {
      width: 54px;
      text-align: right;
      font-family: 'Space Mono', 'Courier New', monospace;
      color: #fff;
    }
  }

  .hud-tip {
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px dashed rgba(120, 160, 220, 0.3);
    font-size: 11px;
    line-height: 1.5;
    color: #8eb4e6;
  }
}
</style>
