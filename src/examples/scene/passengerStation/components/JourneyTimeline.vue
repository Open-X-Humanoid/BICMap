<!--
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-06-05
 * @Description: 客运站四阶段出行时间线
 * @FilePath: /bic-map/src/examples/scene/passengerStation/components/JourneyTimeline.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="journey-timeline">
    <div class="journey-timeline__search">
      <input
        :disabled="true"
        v-model="ticketInput"
        class="journey-timeline__input"
        type="text"
        placeholder="请在上图选择班次"
        @keyup.enter="submitTicket"
      />
      <button class="journey-timeline__btn" type="button" @click="submitTicket">查询</button>
    </div>

    <div v-if="activeTrip" class="journey-timeline__trip">
      <strong>{{ activeTrip.destination }}</strong>
      <span>{{ activeTrip.departureTime }} 发车 · {{ activeTrip.boardingBay }} 号位</span>
    </div>

    <ol class="journey-timeline__steps">
      <li
        v-for="step in steps"
        :key="step.stage"
        class="journey-timeline__step"
        :class="stepClass(step.stage)"
      >
        <span class="journey-timeline__dot"></span>
        <div class="journey-timeline__content">
          <strong>{{ step.label }}</strong>
          <small>{{ stepHint(step.stage) }}</small>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

import { JOURNEY_STAGE, JOURNEY_STEPS } from '../constants.js'

const props = defineProps({
  activeTrip: { type: Object, default: null },
  currentStage: { type: String, default: JOURNEY_STAGE.IDLE },
})

const emit = defineEmits(['search-ticket'])

const ticketInput = ref('')
const steps = JOURNEY_STEPS

watch(() => props.activeTrip, (trip) => {
  if (trip?.ticketNo) ticketInput.value = trip.ticketNo
})

function submitTicket() {
  emit('search-ticket', ticketInput.value)
}

function stepClass(stage) {
  const order = steps.find(s => s.stage === stage)?.order ?? 0
  const currentOrder = steps.find(s => s.stage === props.currentStage)?.order ?? 0
  if (props.currentStage === JOURNEY_STAGE.COMPLETE) {
    return 'journey-timeline__step--done'
  }
  if (order < currentOrder) return 'journey-timeline__step--done'
  if (stage === props.currentStage) return 'journey-timeline__step--active'
  return 'journey-timeline__step--pending'
}

function stepHint(stage) {
  if (!props.activeTrip) return '请先选择班次'
  switch (stage) {
    case JOURNEY_STAGE.TICKET:
      return '取票厅取票'
    case JOURNEY_STAGE.WAITING:
      return '候车厅候车'
    case JOURNEY_STAGE.CHECK:
      return `${props.activeTrip.checkGate} 号检票口`
    case JOURNEY_STAGE.BOARDING:
      return `${props.activeTrip.boardingBay} 号发车位上车`
    default:
      return ''
  }
}
</script>

<style lang="scss" scoped>
.journey-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;

  &__search {
    display: flex;
    gap: 8px;
  }

  &__input {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid rgba(137, 173, 212, 0.45);
    border-radius: 10px;
    font-size: 12px;
    background: rgba(255, 255, 255, 0.85);
  }

  &__btn {
    padding: 8px 12px;
    border: none;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    cursor: pointer;
  }

  &__trip {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(224, 242, 254, 0.65);
    border: 1px solid rgba(14, 165, 233, 0.25);

    strong {
      color: #0f172a;
      font-size: 14px;
    }

    span {
      font-size: 11px;
      color: #475569;
    }
  }

  &__steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__step {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid transparent;

    &--done {
      opacity: 0.72;

      .journey-timeline__dot {
        background: #22c55e;
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15);
      }
    }

    &--active {
      border-color: rgba(59, 130, 246, 0.35);
      background: rgba(59, 130, 246, 0.08);

      .journey-timeline__dot {
        background: #3b82f6;
        animation: pulse 1.4s ease infinite;
      }
    }

    &--pending {
      opacity: 0.55;
    }
  }

  &__dot {
    width: 10px;
    height: 10px;
    margin-top: 4px;
    border-radius: 50%;
    background: #94a3b8;
    flex-shrink: 0;
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: 2px;

    strong {
      font-size: 13px;
      color: #1e293b;
    }

    small {
      font-size: 11px;
      color: #64748b;
    }
  }
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.35); }
  50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
}
</style>
