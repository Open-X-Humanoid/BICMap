<!--
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-06-05
 * @Description: 客运站发车信息屏
 * @FilePath: /bic-map-plugin/src/examples/scene/passengerStation/components/DepartureBoard.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="departure-board">
    <div class="departure-board__header">
      <span class="departure-board__title">发车信息</span>
    </div>

    <div class="departure-board__table-wrap">
      <table class="departure-board__table">
        <thead>
          <tr>
            <th>目的地</th>
            <th>发车</th>
            <th>检票口</th>
            <th>车位</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="trip in sortedTrips"
            :key="trip.id"
            class="departure-board__row"
            :class="{
              'departure-board__row--active': trip.id === activeTripId,
            }"
            @click="$emit('select', trip)"
          >
            <td>{{ trip.destination }}</td>
            <td>{{ trip.departureTime }}</td>
            <td>{{ trip.checkGate }} 号</td>
            <td>{{ trip.boardingBay }} 号</td>
            <td>
              <span class="departure-board__badge" :class="`departure-board__badge--${trip.status}`">
                {{ statusLabel(trip.status) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

import { TRIP_STATUS_LABEL } from '../constants.js'

const props = defineProps({
  trips: { type: Array, default: () => [] },
  activeTripId: { type: String, default: '' },
})

defineEmits(['select'])

const sortedTrips = computed(() => {
  return [...props.trips].sort((a, b) => a.departureTime.localeCompare(b.departureTime))
})

function statusLabel(status) {
  return TRIP_STATUS_LABEL[status] || status
}
</script>

<style lang="scss" scoped>
.departure-board {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: #1e3a5f;
  }

  &__table-wrap {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border: 1px solid rgba(137, 173, 212, 0.35);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.72);
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;

    th,
    td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid rgba(137, 173, 212, 0.2);
    }

    th {
      position: sticky;
      top: 0;
      background: rgba(240, 248, 255, 0.95);
      color: #475569;
      font-weight: 700;
    }
  }

  &__row {
    cursor: pointer;
    transition: background 0.2s ease;

    &:hover {
      background: rgba(59, 130, 246, 0.08);
    }

    &--active {
      background: rgba(59, 130, 246, 0.14);
    }
  }

  &__badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;

    &--waiting {
      color: #0369a1;
      background: rgba(14, 165, 233, 0.12);
    }

    &--checking {
      color: #b45309;
      background: rgba(245, 158, 11, 0.15);
    }

    &--boarding {
      color: #b91c1c;
      background: rgba(239, 68, 68, 0.12);
    }

    &--departed {
      color: #64748b;
      background: rgba(100, 116, 139, 0.12);
    }
  }
}
</style>
