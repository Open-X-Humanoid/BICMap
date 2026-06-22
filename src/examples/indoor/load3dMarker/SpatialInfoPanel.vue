<!--
 * @Description: 空间数据点信息面板，展示选中数据点的名称、空间坐标与描述
 * @FilePath: src/examples/indoor/space/SpatialInfoPanel.vue
-->
<template>
  <transition name="panel-slide">
    <aside v-if="item" class="spatial-panel" aria-label="空间数据详情">
      <div class="panel-header">
        <span class="panel-dot"></span>
        <span class="panel-title">空间数据详情</span>
        <span class="panel-close" @click="$emit('close')">×</span>
      </div>

      <div class="panel-name">
        <MapPin :size="18" class="name-icon" />
        <span class="name-text">{{ item.name }}</span>
      </div>
      <div class="panel-tag">{{ item.category }}</div>

      <div class="panel-section">
        <div class="section-label">空间坐标（米）</div>
        <div class="coord-grid">
          <div class="coord-cell">
            <span class="coord-axis axis-x">X</span>
            <span class="coord-val">{{ fmt(item.coordinate.x) }}</span>
          </div>
          <div class="coord-cell">
            <span class="coord-axis axis-y">Y</span>
            <span class="coord-val">{{ fmt(item.coordinate.y) }}</span>
          </div>
          <div class="coord-cell">
            <span class="coord-axis axis-z">Z</span>
            <span class="coord-val">{{ fmt(item.coordinate.z) }}</span>
          </div>
        </div>
      </div>

      <div v-if="item.lngLat" class="panel-section">
        <div class="section-label">地理坐标</div>
        <div class="geo-row"><span>经度</span><span class="geo-val">{{ item.lngLat[0].toFixed(6) }}</span></div>
        <div class="geo-row"><span>纬度</span><span class="geo-val">{{ item.lngLat[1].toFixed(6) }}</span></div>
      </div>

      <div class="panel-section">
        <div class="section-label">描述</div>
        <p class="panel-desc">{{ item.description }}</p>
      </div>
    </aside>
  </transition>
</template>

<script setup>
import { MapPin } from 'lucide-vue-next'

defineProps({
  /** 选中的空间记忆物品；为空时面板隐藏 */
  item: { type: Object, default: null }
})
defineEmits(['close'])

/**
 * 数值格式化，保留两位小数
 * @param {number} v 原始坐标值
 * @returns {string} 格式化文本
 */
const fmt = (v) => Number(v).toFixed(2)
</script>

<style lang="scss" scoped>
.spatial-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 300px;
  padding: 16px 18px 18px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(240, 248, 255, 0.94) 0%, rgba(224, 242, 254, 0.9) 40%, rgba(230, 240, 255, 0.92) 100%);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(14, 165, 233, 0.2);
  box-shadow: 0 8px 32px rgba(14, 165, 233, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.7) inset;
  z-index: 30;
  overflow: hidden;
}

.spatial-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent 5%, #06b6d4 20%, #3b82f6 40%, #8b5cf6 60%, #06b6d4 80%, transparent 95%);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px dashed rgba(14, 165, 233, 0.2);
}

.panel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #06b6d4;
  box-shadow: 0 0 8px #06b6d4;
  animation: panel-pulse 1.6s ease-in-out infinite;
}

.panel-title {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: linear-gradient(135deg, #236ae8 0%, #c588ff 40%, #06b6d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.panel-close {
  font-size: 18px;
  line-height: 1;
  color: #64748b;
  cursor: pointer;
  user-select: none;
  width: 20px;
  height: 20px;
  text-align: center;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover { background: rgba(14, 165, 233, 0.1); color: #0369a1; }
}

.panel-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;

  .name-icon { color: #3b82f6; flex-shrink: 0; }
  .name-text { font-size: 17px; font-weight: 800; color: #0f3a66; }
}

.panel-tag {
  display: inline-block;
  padding: 2px 10px;
  margin-bottom: 14px;
  font-size: 11px;
  font-weight: 600;
  color: #0369a1;
  background: rgba(14, 165, 233, 0.12);
  border-radius: 99px;
}

.panel-section { margin-bottom: 14px; }

.section-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 8px;
}

.coord-grid {
  display: flex;
  gap: 8px;
}

.coord-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(14, 165, 233, 0.12);
}

.coord-axis {
  font-size: 11px;
  font-weight: 800;
  width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 5px;
  color: #fff;

  &.axis-x { background: #ef4444; }
  &.axis-y { background: #22c55e; }
  &.axis-z { background: #3b82f6; }
}

.coord-val {
  font-family: 'Space Mono', monospace;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  font-weight: 700;
  color: #0f3a66;
}

.geo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 12px;
  color: #64748b;

  .geo-val {
    font-family: 'Space Mono', monospace;
    font-variant-numeric: tabular-nums;
    color: #0369a1;
    font-weight: 700;
  }
}

.panel-desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: #475569;
}

@keyframes panel-pulse {
  0%, 100% { transform: scale(1);   box-shadow: 0 0 8px  #06b6d4; }
  50%      { transform: scale(1.3); box-shadow: 0 0 14px #06b6d4; }
}

.panel-slide-enter-active, .panel-slide-leave-active {
  transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.panel-slide-enter-from, .panel-slide-leave-to {
  opacity: 0;
  transform: translateX(12px) scale(0.98);
}
</style>
