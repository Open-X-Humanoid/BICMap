<!--
 * @Date: 2026-06-09
 * @Description: 飞机场导览 — 航班查询与选择面板
 * @FilePath: /bic-map/src/examples/scene/airportGuide/components/FlightBoard.vue
-->
<template>
  <div class="flight-board">
    <div class="flight-board__header">
      <span class="flight-board__title">航班查询</span>
    </div>

    <form class="flight-board__search" @submit.prevent="onSearch">
      <input
        v-model="query"
        class="flight-board__input"
        type="text"
        placeholder="输入航班号或目的地"
      />
      <button class="flight-board__search-btn" type="submit">查询</button>
    </form>

    <div class="flight-board__table-wrap">
      <table class="flight-board__table">
        <thead>
          <tr>
            <th>航班</th>
            <th>目的地</th>
            <th>登机口</th>
            <th>剩余</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="flight in flights"
            :key="flight.id"
            class="flight-board__row"
            :class="{ 'flight-board__row--active': flight.id === activeFlightId }"
            @click="onSelect(flight)"
          >
            <td>{{ flight.flightNo }}</td>
            <td>{{ flight.destination }}</td>
            <td>{{ flight.boardingGate }}</td>
            <td>
              <span
                class="flight-board__badge"
                :class="flight.remainingMinutes < 120 ? 'flight-board__badge--urgent' : 'flight-board__badge--normal'"
              >
                {{ formatRemaining(flight.remainingMinutes) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  flights: { type: Array, default: () => [] },
  activeFlightId: { type: String, default: '' },
})

const emit = defineEmits(['search', 'select'])

const query = ref('')

/**
 * @param {number} minutes
 */
function formatRemaining(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m}m` : `${m}m`
}

function onSearch() {
  emit('search', query.value)
}

/**
 * @param {object} flight
 */
function onSelect(flight) {
  emit('select', flight)
  emit('search', flight.flightNo)
}
</script>

<style lang="scss" scoped>
.flight-board {
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
    color: #0f172a;
  }

  &__search-btn {
    padding: 8px 12px;
    border: none;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    cursor: pointer;
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

    &--urgent {
      color: #b91c1c;
      background: rgba(239, 68, 68, 0.12);
    }

    &--normal {
      color: #0369a1;
      background: rgba(14, 165, 233, 0.12);
    }
  }
}
</style>
