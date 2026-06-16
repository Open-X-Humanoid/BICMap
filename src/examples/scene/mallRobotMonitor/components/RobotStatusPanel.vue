<template>
  <div class="robot-status-panel">
    <div class="robot-status-panel__header">
      <span class="robot-status-panel__header-icon"><Radio :size="16" /></span>
      <span class="robot-status-panel__header-title">机器人状态</span>
    </div>

    <div class="robot-status-panel__summary">
      <span class="robot-status-panel__summary-dot robot-status-panel__summary-dot--total"></span>
      <span class="robot-status-panel__summary-text">
        {{ robots.length }} 台 · {{ runningCount }} 运行 · {{ errorCount }} 故障
      </span>
    </div>

    <div class="robot-status-panel__body">
      <div v-for="robot in robots" :key="robot.id" class="robot-status-panel__card" :class="{ 'robot-status-panel__card--following': robot.id === followRobotId }">
        <div class="robot-status-panel__card-left">
          <span class="robot-status-panel__status-dot" :style="{ background: robot.statusColor }"></span>
          <div class="robot-status-panel__card-info">
            <div class="robot-status-panel__card-top">
              <span class="robot-status-panel__card-name">{{ robot.name }}</span>
              <span class="robot-status-panel__status-label" :style="{ color: robot.statusColor }">{{ statusLabel(robot.status) }}</span>
            </div>
            <div class="robot-status-panel__card-bottom">
              <span class="robot-status-panel__battery" :style="{ color: robot.batteryColor }">{{ Math.round(robot.battery) }}%</span>
            </div>
          </div>
        </div>
        <div class="robot-status-panel__card-actions">
          <button 
          class="robot-status-panel__ctrl-btn robot-status-panel__ctrl-btn--single"
          :class="{ 'robot-status-panel__ctrl-btn--running': robot.status === 'running' }"
          @click="$emit('toggle-robot', robot.id)"
          :disabled="robot.status === 'error'"
          :title="robot.status === 'running' ? '停止' : '启动'"
        >
          <Square v-if="robot.status === 'running'" :size="14" />
          <Play v-else :size="14" />
        </button>
          <!-- <button 
            class="robot-status-panel__follow-btn" 
            :class="{ 'robot-status-panel__follow-btn--active': robot.id === followRobotId }"
            :disabled="robot.status !== 'running'"
            @click="$emit('toggle-follow', robot.id)" 
            title="跟随"
          >
            <Crosshair :size="14" />
          </button> -->
          <!-- <button 
            class="robot-status-panel__fov-btn" 
            :class="{ 'robot-status-panel__fov-btn--active': robot.fovActive }"
            @click="$emit('toggle-fov', robot.id)" 
            title="FOV"
          >
            <Eye v-if="robot.fovActive" :size="14" />
            <EyeOff v-else :size="14" />
          </button> -->
          <button 
            class="robot-status-panel__route-btn" 
            :disabled="robot.status === 'running'"
            @click="openRobotConfig(robot)" 
            title="路线配置"
          >
            <Route :size="14" />
          </button>
        </div>
      </div>
      <div v-if="!robots.length" class="robot-status-panel__empty">暂无机器人数据</div>
    </div>



    <RouteConfigModal
      :visible="showConfigModal"
      :robot-id="configRobotId"
      :robot-name="configRobotName"
      :pois="pois"
      :current-route="currentRoute"
      :current-start-poi-id="currentStartPoiId"
      @close="showConfigModal = false"
      @confirm="handleConfigConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Radio, Eye, EyeOff, Play, Route, Crosshair, Square } from 'lucide-vue-next'
import RouteConfigModal from './RouteConfigModal.vue'

const props = defineProps({
  robots: { type: Array, default: () => [] },
  isRunning: { type: Boolean, default: false },
  pois: { type: Array, default: () => [] },
  routes: { type: Object, default: () => ({}) },
  startPoiIds: { type: Object, default: () => ({}) },
  followRobotId: { type: String, default: null },
})

const emit = defineEmits(['toggle-fov', 'config-route', 'toggle-follow', 'toggle-robot'])

const showConfigModal = ref(false)
const configRobotId = ref('')
const configRobotName = ref('')

const STATUS_LABEL_MAP = { idle: '待机', running: '执行中', charging: '充电', error: '故障' }

function statusLabel(status) { return STATUS_LABEL_MAP[status] || status }

const runningCount = computed(() => props.robots.filter(r => r.status === 'running').length)
const errorCount = computed(() => props.robots.filter(r => r.status === 'error').length)

const currentRoute = computed(() => props.routes[configRobotId.value] || [])
const currentStartPoiId = computed(() => props.startPoiIds[configRobotId.value] || '')

function openRobotConfig(robot) {
  configRobotId.value = robot.id
  configRobotName.value = robot.name
  showConfigModal.value = true
}

function handleConfigConfirm(data) {
  showConfigModal.value = false
  emit('config-route', data)
}
</script>

<style lang="scss" scoped>
button {
  padding: 0;
}
.robot-status-panel {
  height: 100%; display: flex; flex-direction: column;
  background: rgba(240, 248, 255, 0.88); backdrop-filter: blur(16px);
  border: 1px solid rgba(14, 165, 233, 0.15); border-radius: 12px;
  overflow: hidden; box-shadow: 0 4px 20px rgba(14, 165, 233, 0.06);

  &__header {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; border-bottom: 1px solid rgba(14, 165, 233, 0.12);
  }

  &__header-icon { display: flex; align-items: center; color: #0284c7; }

  &__header-title {
    flex: 1; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; color: #0f172a;
  }

  &__config-btn {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border: none; border-radius: 6px;
    background: rgba(14, 165, 233, 0.08); color: #0284c7;
    cursor: pointer; transition: all 0.2s;

    &:hover:not(:disabled) { background: rgba(14, 165, 233, 0.15); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }

  &__summary {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; margin: 6px 8px 0;
    background: rgba(255, 255, 255, 0.55); border-radius: 8px;
    border: 1px solid rgba(14, 165, 233, 0.1);
  }

  &__summary-dot {
    width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
    &--total { background: #0066ff; box-shadow: 0 0 6px rgba(0, 102, 255, 0.4); }
  }

  &__summary-text {
    font-size: 11px; font-weight: 600; color: #475569;
    letter-spacing: 0.02em; line-height: 1.4;
  }

  &__body {
    flex: 1; overflow-y: auto; padding: 6px 8px;
    display: flex; flex-direction: column; gap: 5px;

    &::-webkit-scrollbar { width: 2px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: rgba(14, 165, 233, 0.2); border-radius: 99px;
    }
  }

  &__card {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 10px; border-radius: 8px;
    background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(14, 165, 233, 0.08);
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.85);
      border-color: rgba(14, 165, 233, 0.18);
    }

    &--following {
      background: rgba(0, 102, 255, 0.08);
      border-color: rgba(0, 102, 255, 0.3);
      box-shadow: 0 0 12px rgba(0, 102, 255, 0.15);
    }
  }

  &__card-left {
    display: flex; align-items: center; gap: 8px;
    min-width: 0; flex: 1;
  }

  &__status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

  &__card-info {
    flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;
  }

  &__card-top { display: flex; align-items: center; gap: 5px; }

  &__card-name {
    font-size: 12px; font-weight: 700; color: #0f172a;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  &__status-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
    padding: 1px 5px; border-radius: 3px; background: rgba(255, 255, 255, 0.6);
    border: 1px solid currentColor; opacity: 0.85; flex-shrink: 0;
  }

  &__card-bottom { display: flex; align-items: center; gap: 6px; }

  &__battery {
    font-size: 11px; font-weight: 700; font-family: 'Space Mono', monospace;
  }

  &__card-actions {
    display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-left: 6px;
    width: 52px;
  }

  &__ctrl-btn {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; border: none; border-radius: 5px;
    cursor: pointer;
    transition: all 0.2s;

    &--single {
      background: rgba(0, 102, 255, 0.1);
      color: #0066ff;

      &:hover:not(:disabled) {
        background: rgba(0, 102, 255, 0.2);
        box-shadow: 0 0 8px rgba(0, 102, 255, 0.2);
      }

      &--running {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;

        &:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.2);
        }
      }

      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
  }

  &__follow-btn, &__fov-btn, &__route-btn {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; border: none; border-radius: 5px;
    background: transparent; color: #94a3b8; cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: rgba(14, 165, 233, 0.1); color: #0284c7;
    }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }

  &__follow-btn--active {
    color: #00d4ff; background: rgba(0, 212, 255, 0.15);
    box-shadow: 0 0 0 1px rgba(0, 212, 255, 0.3);
    &:hover { background: rgba(0, 212, 255, 0.2); }
  }

  &__fov-btn--active {
    color: #0066ff; background: rgba(0, 102, 255, 0.1);
    box-shadow: 0 0 0 1px rgba(0, 102, 255, 0.2);
    &:hover { background: rgba(0, 102, 255, 0.15); }
  }

  &__empty {
    text-align: center; padding: 24px 12px;
    font-size: 12px; color: #94a3b8; line-height: 1.6;
  }

}
</style>