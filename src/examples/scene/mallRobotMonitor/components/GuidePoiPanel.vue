<template>
  <div class="guide-poi-panel">
    <div class="guide-poi-panel__header">
      <span class="guide-poi-panel__header-icon">
        <MapPin :size="16" />
      </span>
      <span class="guide-poi-panel__header-title">导览点位</span>
      <button class="guide-poi-panel__add-btn"
        :class="{ 'guide-poi-panel__add-btn--disabled': addDisabled }"
        :title="addDisabled ? '功能开发中' : '点击后地图选点'"
        @click="handleAddClick">
        <Plus :size="14" />
        <span>添加 POI</span>
      </button>
    </div>
    <transition name="dev-tip-fade">
      <div v-if="showDevTip" class="guide-poi-panel__dev-tip">功能开发中</div>
    </transition>

    <div class="guide-poi-panel__body">
      <div v-for="poi in pois" :key="poi.id" class="guide-poi-panel__item"
        :class="{ 'guide-poi-panel__item--active': activePoiId === poi.id }" @click="onSelect(poi)">
        <div class="guide-poi-panel__item-info">
          <span class="guide-poi-panel__item-name">{{ poi.name }}</span>
          <span class="guide-poi-panel__item-desc">{{ poi.description || '暂无描述' }}</span>
        </div>
        <!-- <span class="guide-poi-panel__item-floor">{{ poi.floor }}</span> -->
        <button class="guide-poi-panel__item-btn" @click.stop="openEdit(poi)" title="编辑">
          <Pencil :size="13" />
        </button>
        <button class="guide-poi-panel__item-btn guide-poi-panel__item-btn--danger" @click.stop="onDelete(poi)"
          title="删除">
          <Trash2 :size="13" />
        </button>
      </div>

      <div v-if="!pois.length" class="guide-poi-panel__empty">
        暂无点位，点击上方按钮添加
      </div>
    </div>

    <Teleport to="body">
      <transition name="modal-fade">
        <div v-if="editingPoi" class="guide-poi-panel__overlay" @click.self="closeEdit">
          <div class="guide-poi-panel__modal">
            <div class="guide-poi-panel__modal-header">
              <span class="guide-poi-panel__modal-title">编辑点位</span>
              <button class="guide-poi-panel__modal-close" @click="closeEdit">
                <X :size="16" />
              </button>
            </div>
            <div class="guide-poi-panel__modal-body">
              <label class="guide-poi-panel__field">
                <span class="guide-poi-panel__field-label">名称</span>
                <input v-model="editForm.name" class="guide-poi-panel__field-input" type="text" placeholder="点位名称" />
              </label>
              <label class="guide-poi-panel__field">
                <span class="guide-poi-panel__field-label">简介</span>
                <input v-model="editForm.description" class="guide-poi-panel__field-input" type="text"
                  placeholder="点位简介" />
              </label>
              <label class="guide-poi-panel__field">
                <span class="guide-poi-panel__field-label">讲解词</span>
                <textarea v-model="editForm.narration" class="guide-poi-panel__field-textarea"
                  placeholder="机器人到达时播放的讲解文案" rows="4"></textarea>
              </label>
            </div>
            <div class="guide-poi-panel__modal-footer">
              <button class="guide-poi-panel__btn guide-poi-panel__btn--cancel" @click="closeEdit">
                <X :size="14" />
                <span>取消</span>
              </button>
              <button class="guide-poi-panel__btn guide-poi-panel__btn--confirm" @click="confirmEdit">
                <Check :size="14" />
                <span>确认</span>
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { MapPin, Plus, Pencil, Trash2, X, Check } from 'lucide-vue-next'

const props = defineProps({
  pois: { type: Array, default: () => [] },
  activePoiId: { type: String, default: null },
  addDisabled: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'add', 'update', 'delete'])

const editingPoi = ref(null)
const editForm = reactive({ name: '', description: '', narration: '' })
const showDevTip = ref(false)

function handleAddClick() {
  if (props.addDisabled) {
    showDevTip.value = true
    setTimeout(() => { showDevTip.value = false }, 2000)
    return
  }
  emit('add')
}

function onSelect(poi) {
  emit('select', poi)
}

function onDelete(poi) {
  emit('delete', poi.id)
}

function openEdit(poi) {
  editingPoi.value = poi
  editForm.name = poi.name
  editForm.description = poi.description
  editForm.narration = poi.narration
}

function closeEdit() {
  editingPoi.value = null
}

function confirmEdit() {
  if (!editingPoi.value) return
  emit('update', {
    id: editingPoi.value.id,
    data: {
      name: editForm.name,
      description: editForm.description,
      narration: editForm.narration,
    },
  })
  closeEdit()
}

defineExpose({ openEdit })
</script>

<style lang="scss" scoped>
.guide-poi-panel,
.guide-poi-panel__overlay {
  --c-accent: #0284c7;
  --c-primary: #0066ff;
  --c-text: #0f172a;
  --c-muted: #94a3b8;

  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(240, 248, 255, 0.88);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(14, 165, 233, 0.15);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(14, 165, 233, 0.06);

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(14, 165, 233, 0.12);
    flex-shrink: 0;
  }

  &__header-icon {
    display: flex;
    align-items: center;
    color: var(--c-accent);
  }

  &__header-title {
    flex: 1;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--c-text);
  }

  &__add-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    background: var(--c-primary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s, box-shadow 0.2s, opacity 0.2s;

    &:hover {
      background: #0052cc;
      box-shadow: 0 2px 8px rgba(0, 102, 255, 0.3);
    }

    &--disabled {
      background: #94a3b8;
      cursor: not-allowed;
      opacity: 0.7;

      &:hover {
        background: #94a3b8;
        box-shadow: none;
      }
    }
  }

  &__dev-tip {
    position: absolute;
    top: 52px;
    right: 14px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    background: rgba(30, 41, 59, 0.88);
    border-radius: 6px;
    pointer-events: none;
    z-index: 10;
    backdrop-filter: blur(8px);
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 10px;

    &::-webkit-scrollbar {
      width: 3px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(14, 165, 233, 0.2);
      border-radius: 99px;
    }
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 4px;
    transition: background 0.2s;

    &:hover {
      background: rgba(14, 165, 233, 0.08);
    }

    &--active {
      background: rgba(14, 165, 233, 0.14);
    }
  }

  &__item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__item-name,
  &__item-desc {
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__item-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--c-text);
  }

  &__item-desc {
    font-size: 10px;
    color: #64748b;
  }

  &__item-floor {
    flex-shrink: 0;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--c-accent);
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(14, 165, 233, 0.12);
    border: 1px solid rgba(14, 165, 233, 0.2);
    font-family: 'Space Mono', monospace;
  }

  &__item-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--c-muted);
    cursor: pointer;
    opacity: 0;
    transition: background 0.2s, color 0.2s, opacity 0.15s;

    &:hover {
      background: rgba(14, 165, 233, 0.1);
      color: var(--c-accent);
    }

    &--danger:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }
  }

  &__item:hover &__item-btn,
  &__item--active &__item-btn {
    opacity: 1;
  }

  &__empty {
    text-align: center;
    padding: 32px 16px;
    font-size: 12px;
    color: var(--c-muted);
    line-height: 1.6;
  }

  &__overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(4px);
  }

  &__modal {
    width: 380px;
    background: rgba(240, 248, 255, 0.96);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(14, 165, 233, 0.2);
    border-radius: 14px;
    box-shadow: 0 12px 40px rgba(0, 20, 60, 0.25);
    overflow: hidden;
  }

  &__modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(14, 165, 233, 0.12);
  }

  &__modal-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--c-text);
    letter-spacing: 0.04em;
  }

  &__modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;

    &:hover {
      background: rgba(14, 165, 233, 0.1);
      color: var(--c-text);
    }
  }

  &__modal-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px 18px;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  &__field-label {
    font-size: 11px;
    font-weight: 700;
    color: #334155;
    letter-spacing: 0.04em;
  }

  &__field-input,
  &__field-textarea {
    padding: 8px 12px;
    font-size: 13px;
    color: var(--c-text);
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(14, 165, 233, 0.18);
    border-radius: 8px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:focus {
      border-color: var(--c-primary);
      box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.12);
    }

    &::placeholder {
      color: var(--c-muted);
    }
  }

  &__field-textarea {
    resize: vertical;
    min-height: 72px;
    font-family: inherit;
    line-height: 1.5;
  }

  &__modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid rgba(14, 165, 233, 0.12);
  }

  &__btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 16px;
    font-size: 12px;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s, box-shadow 0.2s;

    &--cancel {
      color: #475569;
      background: rgba(148, 163, 184, 0.15);

      &:hover {
        background: rgba(148, 163, 184, 0.25);
      }
    }

    &--confirm {
      color: #fff;
      background: var(--c-primary);

      &:hover {
        background: #0052cc;
        box-shadow: 0 2px 10px rgba(0, 102, 255, 0.3);
      }
    }
  }
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.22s ease;

  .guide-poi-panel__modal {
    transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;

  .guide-poi-panel__modal {
    transform: scale(0.94) translateY(8px);
  }
}

.dev-tip-fade-enter-active,
.dev-tip-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dev-tip-fade-enter-from,
.dev-tip-fade-leave-to {
  opacity: 0;
}
</style>
