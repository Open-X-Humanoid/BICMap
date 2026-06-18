<!--
 * @Description: 巡检机器人状态面板（右侧边栏）
 *   展示所有机器人的状态、电量、任务；支持单独启动/停止、跟随相机
-->
<template>
  <div class="patrol-panel">
    <div class="panel-header">
      <span class="panel-title">巡检状态</span>
      <span class="panel-badge" :class="isRunning ? 'badge--running' : 'badge--idle'">
        {{ isRunning ? '巡逻中' : '待机' }}
      </span>
    </div>

    <div class="robot-list">
      <div
        v-for="robot in robots"
        :key="robot.id"
        class="robot-card"
        :class="{
          'robot-card--running': robot.status === 'running',
          'robot-card--charging': robot.status === 'charging',
          'robot-card--returning': robot.status === 'returning',
          'robot-card--error': robot.status === 'error',
          // 'robot-card--followed': followRobotId === robot.id,  // 视角跟随已注释
        }"
      >
        <!-- 机器人头部 -->
        <div class="robot-card__head">
          <div class="robot-icon">
            <Bot :size="16" />
          </div>
          <div class="robot-info">
            <span class="robot-name">{{ robot.name }}</span>
          </div>
          <div class="robot-card__head-right">
            <div class="status-row">
              <div class="robot-status-dot" :style="{ background: statusColor(robot.status) }"></div>
              <span class="robot-status-label">{{ robot.task }}</span>
            </div>
            <div class="battery-row">
              <BatteryMedium :size="10" class="battery-icon" />
              <span class="battery-pct" :style="{ color: batteryColor(robot.battery) }">{{ Math.round(robot.battery) }}%</span>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="robot-card__actions">
          <button
            class="action-btn"
            :class="{ active: robot.status === 'running' || robot.status === 'dwell' }"
            :disabled="robot.status === 'returning'"
            :title="robot.status === 'returning' ? '召回中，无法启动' : ((robot.status === 'running') ? '停止' : '启动')"
            @click="emit('toggleRobot', robot.id)"
          >
            <component :is="robot.status === 'running' ? Square : Play" :size="11" />
            {{ robot.status === 'running' ? '停止' : '启动' }}
          </button>
          <button
            v-if="robot.status !== 'idle'"
            class="action-btn action-btn--recall"
            :disabled="robot.status === 'returning'"
            :title="robot.status === 'returning' ? '召回中' : '召回至待机区'"
            @click="emit('recall', robot.id)"
          >
            <RotateCcw :size="11" />
            召回
          </button>
          <!-- 跟随按钮已注释
          <button
            class="action-btn"
            :class="{ active: followRobotId === robot.id }"
            title="跟随相机"
            @click="emit('toggleFollow', robot.id)"
          >
            <Crosshair :size="11" />
            跟随
          </button>
          -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Bot, BatteryMedium, Play, Square, RotateCcw } from 'lucide-vue-next'  // Crosshair 已注释

defineProps({
  robots:         { type: Array,   default: () => [] },
  isRunning:      { type: Boolean, default: false },
  // followRobotId:  { type: String,  default: null },  // 视角跟随已注释
})

const emit = defineEmits(['toggleRobot', 'recall'])  // 'toggleFollow' 已注释

const STATUS_COLORS = {
  running:   '#22c55e',
  idle:      '#94a3b8',
  charging:  '#f59e0b',
  error:     '#ef4444',
  dwell:     '#06b6d4',
  returning: '#06b6d4',
}

const STATUS_LABELS = {
  running:   '巡逻中',
  idle:      '待机',
  charging:  '充电中',
  error:     '故障',
  dwell:     '停靠',
  returning: '召回中',
}

function statusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.idle
}

function statusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.idle
}

function batteryColor(pct) {
  if (pct > 50) return '#22c55e'
  if (pct > 20) return '#f59e0b'
  return '#ef4444'
}
</script>

<style scoped lang="scss">
.patrol-panel {
  width: 200px;
  background: #f0f7ff;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #1e293b;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #64748b;
  text-transform: uppercase;
}

.panel-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;

  &--running {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
  }

  &--idle {
    background: #f8fafc;
    color: #94a3b8;
    border: 1px solid #e2e8f0;
  }
}

.robot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.robot-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  padding: 10px 10px 8px;
  transition: border-color 0.2s;

  &--running   { border-color: #86efac; background: #f0fdf4; }
  &--charging  { border-color: #fde68a; background: #fffbeb; }
  &--returning { border-color: #67e8f9; background: #ecfeff; }
  &--error     { border-color: #fca5a5; background: #fef2f2; }
  // &--followed { border-color: #93c5fd; box-shadow: 0 0 6px rgba(59,130,246,0.15); }  // 视角跟随已注释
}

.robot-card__head {
  display: flex;
  align-items: center;
  gap: 7px;
}

.robot-card__head-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 3px;
}

.robot-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
  flex-shrink: 0;
}

.robot-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.robot-name {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.robot-task {
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
}

.robot-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 3px currentColor;
}

.robot-status-label {
  font-size: 10px;
  color: #64748b;
}

.battery-row {
  display: flex;
  align-items: center;
  gap: 3px;
}

.battery-icon {
  color: #94a3b8;
  flex-shrink: 0;
}

.battery-pct {
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.robot-card__actions {
  margin-top: 8px;
  display: flex;
  gap: 5px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  background: #ffffff;
  color: #64748b;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: #f1f5f9;
    color: #334155;
  }

  &.active {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #3b82f6;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
    background: #f8fafc;
    color: #cbd5e1;

    &:hover {
      background: #f8fafc;
      color: #cbd5e1;
    }
  }

  &--recall {
    border-color: #fcd34d;
    color: #d97706;

    &:hover {
      background: #fffbeb;
      color: #b45309;
      border-color: #f59e0b;
    }
  }
}

@keyframes pulse-badge {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}
</style>
