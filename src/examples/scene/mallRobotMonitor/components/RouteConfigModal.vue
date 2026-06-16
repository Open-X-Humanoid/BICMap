<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="route-config-modal" @click.self="$emit('close')">
        <div class="route-config-modal__content">
          <div class="route-config-modal__header">
            <span class="route-config-modal__title">{{ robotName }} 路线配置</span>
            <button class="route-config-modal__close" @click="$emit('close')">
              <X :size="18" />
            </button>
          </div>

          <div class="route-config-modal__body">
            <div class="route-config-modal__section">
              <label class="route-config-modal__label">
                <MapPin :size="14" />
                <span>默认点位（出发点）</span>
              </label>
              <select 
                v-model="selectedStartPoi" 
                class="route-config-modal__select"
                @change="onStartPoiChange"
              >
                <option :value="''">请选择出发点</option>
                <option v-for="poi in pois" :key="poi.id" :value="poi.id">
                  {{ poi.name }}
                </option>
              </select>
            </div>

            <div class="route-config-modal__section">
              <div class="route-config-modal__section-header">
                <label class="route-config-modal__label">
                  <Route :size="14" />
                  <span>路线点位（拖拽调整顺序）</span>
                </label>
                <button 
                  v-if="selectedPois.length > 1"
                  class="route-config-modal__btn route-config-modal__btn--reverse"
                  @click="reverseRoute"
                >
                  <RotateCcw :size="14" />
                  <span>反向</span>
                </button>
              </div>

              <div class="route-config-modal__poi-list">
                <div 
                  v-for="(poi, index) in selectedPois" 
                  :key="poi.id"
                  class="route-config-modal__poi-item"
                  draggable="true"
                  @dragstart="onDragStart(index)"
                  @dragover.prevent
                  @drop="onDrop($event, index)"
                >
                  <span class="route-config-modal__poi-index">{{ index + 1 }}</span>
                  <span class="route-config-modal__poi-name">{{ poi.name }}</span>
                  <button class="route-config-modal__remove" @click="removePoi(index)">
                    <Trash2 :size="14" />
                  </button>
                </div>
                <div v-if="selectedPois.length === 0" class="route-config-modal__empty">
                  请从下方列表选择点位添加到路线
                </div>
              </div>
            </div>

            <div class="route-config-modal__section">
              <label class="route-config-modal__label">
                <Plus :size="14" />
                <span>可用点位</span>
              </label>
              <div class="route-config-modal__available-list">
                <button
                  v-for="poi in availablePois"
                  :key="poi.id"
                  class="route-config-modal__add-btn"
                  @click="addPoi(poi)"
                >
                  <Plus :size="12" />
                  <span>{{ poi.name }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="route-config-modal__footer">
            <button class="route-config-modal__btn route-config-modal__btn--cancel" @click="$emit('close')">
              取消
            </button>
            <button 
              class="route-config-modal__btn route-config-modal__btn--confirm" 
              :disabled="selectedPois.length < 2"
              @click="confirm"
            >
              确认配置
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>import { ref, computed, watch } from 'vue';
import { X, MapPin, Route, RotateCcw, Trash2, Plus } from 'lucide-vue-next';
const props = defineProps({
 visible: Boolean,
 robotId: String,
 robotName: String,
 pois: { type: Array, default: () => [] },
 currentRoute: { type: Array, default: () => [] },
 currentStartPoiId: String,
});
const emit = defineEmits(['close', 'confirm']);
const selectedStartPoi = ref('');
const selectedPois = ref([]);
const dragIndex = ref(-1);
watch(() => props.visible, (val) => {
 if (val) {
 initRoute();
 }
});
watch(() => props.pois, () => {
 initRoute();
}, { deep: true });
function initRoute() {
 selectedPois.value = [];
 selectedStartPoi.value = props.currentStartPoiId || '';
 if (props.currentRoute && props.currentRoute.length > 0) {
 const poiMap = new Map(props.pois.map(p => [p.id, p]));
 props.currentRoute.forEach(poiId => {
 const matchedPoi = poiMap.get(poiId);
 if (matchedPoi) {
 selectedPois.value.push(matchedPoi);
 }
 });
 }
}
const availablePois = computed(() => {
 const selectedIds = new Set(selectedPois.value.map(p => p.id));
 return props.pois.filter(p => !selectedIds.has(p.id));
});
function addPoi(poi) {
 selectedPois.value.push(poi);
}
function removePoi(index) {
 selectedPois.value.splice(index, 1);
}
function reverseRoute() {
 selectedPois.value.reverse();
}
function onStartPoiChange() {
}
function onDragStart(index) {
 dragIndex.value = index;
}
function onDrop(event, targetIndex) {
 if (dragIndex.value === -1 || dragIndex.value === targetIndex)
 return;
 const item = selectedPois.value.splice(dragIndex.value, 1)[0];
 selectedPois.value.splice(targetIndex, 0, item);
 dragIndex.value = -1;
}
function confirm() {
 if (selectedPois.value.length < 2)
 return;
 const route = selectedPois.value.map(p => p.id);
 const startPoi = props.pois.find(p => p.id === selectedStartPoi.value);
 const startPosition = startPoi ? [startPoi.xFrac, startPoi.yFrac] : null;
 emit('confirm', {
 robotId: props.robotId,
 route,
 startPosition,
 startPoiId: selectedStartPoi.value,
 });
}
</script>

<style lang="scss" scoped>
button {
  padding: 0;
}
.route-config-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.route-config-modal__content {
  width: 90%;
  max-width: 420px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.route-config-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(14, 165, 233, 0.1);
}

.route-config-modal__title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.route-config-modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.1);
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(148, 163, 184, 0.2);
    color: #475569;
  }
}

.route-config-modal__body {
  padding: 14px 16px;
  max-height: 420px;
  overflow-y: auto;
}

.route-config-modal__section {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.route-config-modal__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.route-config-modal__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 8px;
}

.route-config-modal__select {
  width: 100%;
  padding: 9px 12px;
  font-size: 12px;
  border: 1px solid rgba(14, 165, 233, 0.2);
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: rgba(14, 165, 233, 0.4);
  }

  &:focus {
    outline: none;
    border-color: #0284c7;
    box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.1);
  }
}

.route-config-modal__poi-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: rgba(14, 165, 233, 0.04);
  border-radius: 8px;
  min-height: 120px;
}

.route-config-modal__poi-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid rgba(14, 165, 233, 0.1);
  cursor: grab;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(14, 165, 233, 0.3);
    background: rgba(14, 165, 233, 0.03);
  }

  &:active {
    cursor: grabbing;
  }
}

.route-config-modal__poi-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #0284c7;
  border-radius: 4px;
  flex-shrink: 0;
}

.route-config-modal__poi-name {
  flex: 1;
  font-size: 12px;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-config-modal__remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
  flex-shrink: 0;

  .route-config-modal__poi-item:hover & {
    opacity: 1;
  }

  &:hover {
    background: rgba(239, 68, 68, 0.15);
  }
}

.route-config-modal__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  font-size: 12px;
  color: #94a3b8;
}

.route-config-modal__available-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.route-config-modal__add-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #0284c7;
  border: 1px solid rgba(14, 165, 233, 0.25);
  border-radius: 6px;
  background: rgba(14, 165, 233, 0.05);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(14, 165, 233, 0.12);
    border-color: rgba(14, 165, 233, 0.4);
  }
}

.route-config-modal__footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid rgba(14, 165, 233, 0.1);
}

.route-config-modal__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 9px 16px;
  font-size: 12px;
  font-weight: 700;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.route-config-modal__btn--cancel {
  color: #64748b;
  background: rgba(148, 163, 184, 0.15);

  &:hover:not(:disabled) {
    background: rgba(148, 163, 184, 0.25);
  }
}

.route-config-modal__btn--confirm {
  color: #fff;
  background: #0066ff;

  &:hover:not(:disabled) {
    background: #0052cc;
    box-shadow: 0 2px 10px rgba(0, 102, 255, 0.3);
  }
}

.route-config-modal__btn--reverse {
  flex: none;
  padding: 6px 10px;
  font-size: 11px;
  color: #0284c7;
  background: rgba(14, 165, 233, 0.08);

  &:hover {
    background: rgba(14, 165, 233, 0.15);
  }
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .route-config-modal__content,
.modal-leave-to .route-config-modal__content {
  transform: scale(0.95) translateY(20px);
}

.modal-enter-active .route-config-modal__content,
.modal-leave-active .route-config-modal__content {
  transition: transform 0.3s ease;
}
</style>