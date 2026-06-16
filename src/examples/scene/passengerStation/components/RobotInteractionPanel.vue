<!--
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-06-05
 * @Description: 客运站人机交互对话面板
 * @FilePath: /bic-map-plugin/src/examples/scene/passengerStation/components/RobotInteractionPanel.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="robot-panel">
    <div v-if="urgentText" class="robot-panel__urgent">{{ urgentText }}</div>

    <div class="robot-panel__header">
      <span class="robot-panel__avatar">🤖</span>
      <div class="robot-panel__meta">
        <strong>导览机器人<small  style="margin-left: 8px;">{{ taskText || '待机中' }}</small></strong>
      </div>
    </div>

    <p class="robot-panel__bubble">{{ promptText }}</p>

    <div v-if="arrivalCard" class="robot-panel__arrival">
      <strong>{{ arrivalCard.title }}</strong>
      <p>{{ arrivalCard.body }}</p>
      <span v-if="arrivalCard.progress" class="robot-panel__progress">{{ arrivalCard.progress }}</span>
    </div>

    <div class="robot-panel__actions">
      <button
        v-if="showConfirmYes"
        class="robot-panel__btn robot-panel__btn--primary"
        type="button"
        @click="$emit('confirm-yes')"
      >
        是
      </button>
      <button
        v-if="showDepart"
        class="robot-panel__btn robot-panel__btn--primary"
        type="button"
        @click="$emit('depart')"
      >
        {{ departButtonLabel }}
      </button>
      <button
        v-if="showContinue"
        class="robot-panel__btn robot-panel__btn--primary"
        type="button"
        @click="$emit('continue')"
      >
        继续下一步
      </button>
      <!-- <button
        v-if="showWait"
        class="robot-panel__btn"
        type="button"
        @click="$emit('wait')"
      >
        稍等
      </button> -->
      <button
        class="robot-panel__btn"
        type="button"
        @click="$emit('return-standby')"
      >
        结束导览
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  promptText: { type: String, default: '' },
  taskText: { type: String, default: '' },
  urgentText: { type: String, default: '' },
  arrivalCard: { type: Object, default: null },
  showConfirmYes: { type: Boolean, default: false },
  showDepart: { type: Boolean, default: false },
  showContinue: { type: Boolean, default: false },
  showWait: { type: Boolean, default: false },
  departButtonLabel: { type: String, default: '出发' },
})

defineEmits(['confirm-yes', 'depart', 'continue', 'wait', 'return-standby'])
</script>

<style lang="scss" scoped>
.robot-panel {
  position: fixed;
  left: 20px;
  top: 80px;
  width: min(360px, calc(100% - 32px));
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(14, 165, 233, 0.25);
  box-shadow: 0 12px 36px rgba(45, 87, 138, 0.16);
  backdrop-filter: blur(14px);
  z-index: 25;

  &__urgent {
    margin-bottom: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    color: #b91c1c;
    background: rgba(254, 226, 226, 0.9);
    border: 1px solid rgba(239, 68, 68, 0.25);
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  &__avatar {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(224, 242, 254, 0.9);
    font-size: 18px;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 2px;

    strong {
      font-size: 14px;
      color: #0f172a;
    }

    small {
      font-size: 11px;
      color: #64748b;
    }
  }

  &__bubble {
    margin: 0 0 6px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(240, 248, 255, 0.95);
    border: 1px solid rgba(137, 173, 212, 0.25);
    font-size: 13px;
    line-height: 1.5;
    color: #334155;
  }

  &__arrival {
    margin-bottom: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(236, 254, 255, 0.85);
    border: 1px solid rgba(6, 182, 212, 0.25);

    strong {
      display: block;
      margin-bottom: 4px;
      font-size: 13px;
      color: #0f172a;
    }

    p {
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      color: #475569;
    }
  }

  &__progress {
    display: inline-block;
    margin-top: 8px;
    font-size: 11px;
    font-weight: 700;
    color: #0284c7;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__btn {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid rgba(137, 173, 212, 0.45);
    background: rgba(255, 255, 255, 0.85);
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    cursor: pointer;

    &--primary {
      color: #fff;
      border-color: transparent;
      background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    }
  }
}
</style>
