<!--
 * @Date: 2026-06-09
 * @Description: 飞机场导览 — 人机交互对话面板
 * @FilePath: /bic-map/src/examples/scene/airportGuide/components/FlightInteractionPanel.vue
-->
<template>
  <div class="flight-interact">
    <div v-if="urgentText" class="flight-interact__urgent">{{ urgentText }}</div>

    <div class="flight-interact__header">
      <span class="flight-interact__avatar">🤖</span>
      <div class="flight-interact__meta">
        <strong>导览机器人<small>{{ taskText || '待机中' }}</small></strong>
      </div>
    </div>

    <p class="flight-interact__bubble">{{ promptText }}</p>

    <div v-if="arrivalCard" class="flight-interact__arrival">
      <strong>{{ arrivalCard.title }}</strong>
      <p>{{ arrivalCard.body }}</p>
      <span v-if="arrivalCard.progress" class="flight-interact__progress">{{ arrivalCard.progress }}</span>
    </div>

    <div class="flight-interact__actions">
      <button
        v-if="showConfirmYes"
        class="flight-interact__btn flight-interact__btn--primary"
        type="button"
        @click="$emit('confirm-yes')"
      >
        是
      </button>
      <button
        v-if="showConfirmNo"
        class="flight-interact__btn"
        type="button"
        @click="$emit('confirm-no')"
      >
        否
      </button>
      <button
        v-if="showDepart"
        class="flight-interact__btn flight-interact__btn--primary"
        type="button"
        @click="$emit('depart')"
      >
        出发
      </button>
      <button
        v-if="showContinue"
        class="flight-interact__btn flight-interact__btn--primary"
        type="button"
        @click="$emit('continue')"
      >
        继续下一步
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
  showConfirmNo: { type: Boolean, default: false },
  showDepart: { type: Boolean, default: false },
  showContinue: { type: Boolean, default: false },
})

defineEmits(['confirm-yes', 'confirm-no', 'depart', 'continue'])
</script>

<style lang="scss" scoped>
.flight-interact {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(14, 165, 233, 0.22);

  &__urgent {
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
  }

  &__avatar {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(224, 242, 254, 0.9);
    font-size: 16px;
  }

  &__meta {
    strong {
      font-size: 13px;
      color: #0f172a;

      small {
        margin-left: 8px;
        font-size: 11px;
        font-weight: 500;
        color: #64748b;
      }
    }
  }

  &__bubble {
    margin: 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(240, 248, 255, 0.95);
    border: 1px solid rgba(137, 173, 212, 0.25);
    font-size: 13px;
    line-height: 1.5;
    color: #334155;
  }

  &__arrival {
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
