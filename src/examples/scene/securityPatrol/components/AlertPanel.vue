<!--
 * @Description: 安防告警时间线面板（左侧边栏）
 *   实时展示机器人触发的安防告警事件与模拟巡检事件报告
-->
<template>
  <div class="alert-panel">
    <div class="panel-header">
      <ShieldAlert :size="14" class="header-icon" />
      <span class="panel-title">安防告警</span>
      <span v-if="alerts.length + simulatedEvents.length" class="alert-count">
        {{ alerts.length + simulatedEvents.length }}
      </span>
    </div>

    <div v-if="!alerts.length && !simulatedEvents.length" class="empty-state">
      <ShieldCheck :size="28" class="empty-icon" />
      <span>暂无告警</span>
    </div>

    <div v-else class="alert-list" ref="listRef">
      <TransitionGroup name="alert-slide">
        <!-- 实时告警 -->
        <div
          v-for="alert in displayAlerts"
          :key="alert.id"
          class="alert-item"
          :class="`alert-item--${alert.level}`"
        >
          <div class="alert-item__dot"></div>
          <div class="alert-item__body">
            <div class="alert-item__top">
              <span class="alert-icon">{{ alert.icon }}</span>
              <span class="alert-label">{{ alert.label }}</span>
              <span class="alert-time">{{ formatTime(alert.time) }}</span>
            </div>
            <div class="alert-item__detail">
              <span class="alert-robot">{{ alert.robotName }}</span>
              <span class="alert-sep">·</span>
              <span class="alert-poi">{{ alert.poiName }}</span>
            </div>
          </div>
        </div>
        <!-- 模拟巡检事件 -->
        <div
          v-for="event in displaySimEvents"
          :key="event.id"
          class="alert-item sim-event-item"
          :class="`alert-item--${event.level}`"
        >
          <div class="alert-item__dot sim-event-dot"></div>
          <div class="alert-item__body">
            <div class="alert-item__top">
              <span class="alert-icon">{{ event.icon }}</span>
              <span class="alert-label">{{ event.label }}</span>
              <span class="sim-badge">模拟</span>
              <span class="alert-time">{{ formatTime(event.time) }}</span>
            </div>
            <div class="alert-item__detail">
              <span class="alert-robot">{{ event.robotName }}</span>
              <span class="alert-sep">·</span>
              <span class="alert-poi">{{ event.nearbyPoi }}</span>
            </div>
            <div class="sim-description">{{ event.description }}</div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div v-if="totalCount > MAX_DISPLAY" class="more-hint">
      还有 {{ totalCount - MAX_DISPLAY }} 条历史记录
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ShieldAlert, ShieldCheck } from 'lucide-vue-next'

const MAX_DISPLAY = 12

const props = defineProps({
  alerts:          { type: Array, default: () => [] },
  simulatedEvents: { type: Array, default: () => [] },
})

const totalCount = computed(() => props.alerts.length + props.simulatedEvents.length)

// 告警与模拟事件各取一半展示位
const alertSlotCount = computed(() => Math.min(props.alerts.length, Math.ceil(MAX_DISPLAY / 2)))
const simSlotCount = computed(() => Math.min(props.simulatedEvents.length, MAX_DISPLAY - alertSlotCount.value))

const displayAlerts = computed(() => props.alerts.slice(0, alertSlotCount.value))
const displaySimEvents = computed(() => props.simulatedEvents.slice(0, simSlotCount.value))

function formatTime(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
</script>

<style scoped lang="scss">
.alert-panel {
  width: 190px;
  background: #f0f7ff;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #1e293b;
  max-height: calc(100vh - 180px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.header-icon {
  color: #f59e0b;
}

.panel-title {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #64748b;
  text-transform: uppercase;
}

.alert-count {
  font-size: 10px;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: #fef2f2;
  color: #ef4444;
  border: 1px solid #fecaca;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  font-variant-numeric: tabular-nums;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 0;
  color: #94a3b8;
  font-size: 12px;
}

.empty-icon {
  color: #cbd5e1;
}

.alert-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 3px;
  }
}

.alert-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 7px 8px;
  border-radius: 7px;
  background: #f8fafc;
  border-left: 2px solid #e2e8f0;
  transition: background 0.2s;

  &--critical {
    border-left-color: #ef4444;
    background: #fef2f2;
  }
  &--warning {
    border-left-color: #f59e0b;
    background: #fffbeb;
  }
  &--info {
    border-left-color: #06b6d4;
    background: #ecfeff;
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-top: 4px;
    flex-shrink: 0;
    background: currentColor;

    .alert-item--critical & { color: #ef4444; }
    .alert-item--warning  & { color: #f59e0b; }
    .alert-item--info     & { color: #06b6d4; }
  }

  &__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &__top {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  &__detail {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.alert-icon {
  font-size: 11px;
}

.alert-label {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-time {
  font-size: 9px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
  font-family: 'Space Mono', monospace;
  flex-shrink: 0;
}

.alert-robot {
  color: #3b82f6;
  font-weight: 500;
}

.alert-sep {
  color: #cbd5e1;
}

.alert-poi {
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// 模拟事件特殊样式
.sim-event-item {
  background: #f5f3ff;
  border-left-color: #a78bfa;

  &.alert-item--info {
    background: #f5f3ff;
  }
}

.sim-event-dot {
  border-radius: 2px;
  width: 4px;
  opacity: 0.6;
}

.sim-badge {
  font-size: 8px;
  padding: 0 4px;
  border-radius: 4px;
  background: #ede9fe;
  color: #7c3aed;
  font-weight: 600;
  text-transform: uppercase;
  flex-shrink: 0;
}

.sim-description {
  font-size: 9px;
  color: #a78bfa;
  line-height: 1.3;
  word-break: break-all;
}

.more-hint {
  font-size: 10px;
  color: #94a3b8;
  text-align: center;
  padding-top: 4px;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
}

// 列表进入动效
.alert-slide-enter-active {
  transition: all 0.3s ease;
}
.alert-slide-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
