<!--
 * @Description: 地图编辑示例：默认加载 SLAM 透明图，并把 ImageEditor 的全部操作按钮（工具切换、画笔属性、缩放、保存/重置）统一搬到页面 Footer。
 * @FilePath: /bic-map/src/examples/expand/MapEditor/index.vue
-->
<template>
  <div class="app-root">
    <AppHeader title="地图编辑" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <ImageEditor
          ref="editorRef"
          :map-url="MAP_IMAGE_PATH"
          @history-update="onHistoryUpdate"
          @save-success="onSaveSuccess"
          @save-error="onSaveError"
        />
      </div>
    </main>

    <AppFooter>
      <template #left>
        <div class="editor-toolbar" role="toolbar" aria-label="图片编辑工具">
          <div class="tool-group">
            <button
              type="button"
              class="icon-btn"
              data-tooltip="恢复默认大小"
              aria-label="恢复默认大小"
              @click="resetZoom"
            >
              <Maximize :size="18" />
            </button>
            <button
              v-for="item in toolList"
              :key="item.type"
              type="button"
              class="icon-btn"
              :class="{ active: currentTool === item.type }"
              :data-tooltip="item.label"
              :aria-label="item.label"
              @click="onToolClick(item.type)"
            >
              <component :is="item.icon" :size="18" />
            </button>
          </div>

          <span v-if="showBrushType" class="divider"></span>
          <div v-if="showBrushType" class="tool-group" aria-label="画笔类型">
            <button
              v-for="brush in BRUSH_TYPE_LIST"
              :key="brush.type"
              type="button"
              class="icon-btn"
              :class="{ active: currentBrushType === brush.type }"
              :data-tooltip="brush.label"
              :aria-label="brush.label"
              @click="onBrushTypeClick(brush.type)"
            >
              <component :is="brush.icon" :size="18" />
            </button>
          </div>

          <span v-if="showColorPicker" class="divider"></span>
          <div v-if="showColorPicker" class="color-group" aria-label="颜色">
            <button
              v-for="c in colorList"
              :key="c"
              type="button"
              class="swatch"
              :class="{ active: currentColor === c }"
              :data-tooltip="c"
              :aria-label="`选择颜色 ${c}`"
              @click="onColorClick(c)"
            >
              <span class="swatch-fill" :style="{ background: c }"></span>
            </button>
          </div>

          <span v-if="showSlider" class="divider"></span>
          <div v-if="showSlider" class="slider-group" aria-label="粗细">
            <span class="slider-label">粗细</span>
            <input
              type="range"
              class="slider"
              :min="sliderConfig.min"
              :max="sliderConfig.max"
              :step="sliderConfig.step"
              :value="currentWidth"
              @input="onWidthInput($event.target.value)"
            />
            <span class="slider-value tabular">{{ currentWidth }}</span>
          </div>

          <span class="divider"></span>
        </div>
      </template>

      <template #right>
        <div class="footer-actions">
          <button
            type="button"
            class="icon-btn"
            :disabled="!canUndo"
            data-tooltip="撤销"
            aria-label="撤销"
            @click="onUndoClick"
          >
            <Undo2 :size="18" />
          </button>
          <button
            type="button"
            class="icon-btn"
            :disabled="!canRedo"
            data-tooltip="重做"
            aria-label="重做"
            @click="onRedoClick"
          >
            <Redo2 :size="18" />
          </button>
          <button
            type="button"
            class="icon-btn"
            data-tooltip="重置"
            aria-label="重置"
            @click="onResetClick"
          >
            <RotateCcw :size="18" />
          </button>
          <span
            class="footer-action-tooltip save-btn"
            data-tooltip="打开新窗口预览图片"
          >
            <TechButton label="预览" :active="true" @click="onSaveClick">
              <template #icon><Save :size="16" /></template>
            </TechButton>
          </span>
        </div>
      </template>
    </AppFooter>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

import {
  Eraser,
  Maximize,
  Minus,
  Move,
  Pencil,
  Redo2,
  RotateCcw,
  Save,
  Slash,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-vue-next";

import AppFooter from "../../components/AppFooter.vue";
import AppHeader from "../../components/AppHeader.vue";
import TechButton from "../../components/TechButton.vue";
import ImageEditor from "./ImageEditor/index.vue";
import { toolConfigs } from "./ImageEditor/config/index.js";
import slamImage from "../../assets/slam_transparent.png";

const MAP_IMAGE_PATH = slamImage;

const TOOL_LIST = [
//   { type: "select", label: "选择", icon: MousePointer2 },
  { type: "move", label: "拖动", icon: Move },
  { type: "pencil", label: "画笔", icon: Pencil },
  { type: "eraser", label: "橡皮", icon: Eraser },
];

const BRUSH_TYPE_LIST = [
  { type: 'free', label: '自由画笔', short: '自由', icon: Slash },
  { type: 'line', label: '直线画笔', short: '直线', icon: Minus },
];

const editorRef = ref(null);

const currentTool = ref("move");
const currentBrushType = ref("free");
const currentColor = ref(toolConfigs.pencil.colors[0]);
const currentWidth = ref(toolConfigs.pencil.slider.defaultValue);
const canUndo = ref(false);
const canRedo = ref(false);

const toolList = computed(() => TOOL_LIST);

const showBrushType = computed(() => currentTool.value === "pencil");
const showColorPicker = computed(
  () => currentTool.value === "pencil" || currentTool.value === "eraser",
);
const showSlider = computed(
  () => currentTool.value === "pencil" || currentTool.value === "eraser",
);

const colorList = computed(() => toolConfigs[currentTool.value]?.colors || []);

const sliderConfig = computed(
  () =>
    toolConfigs[currentTool.value]?.slider || {
      min: 1,
      max: 100,
      step: 1,
      defaultValue: 5,
    },
);

/**
 * 同步切换工具，并按工具默认值刷新颜色 / 粗细 / 笔刷类型本地状态
 */
const onToolClick = (type) => {
  const editor = editorRef.value;
  if (!editor) return;

  const next = currentTool.value === type && type !== "move" ? "move" : type;
  editor.setTool(next);
  currentTool.value = next;

  const config = toolConfigs[next];
  if (config?.colors?.length) currentColor.value = config.colors[0];
  if (config?.slider?.defaultValue)
    currentWidth.value = config.slider.defaultValue;
  if (next === "pencil") currentBrushType.value = "free";
};

const onBrushTypeClick = (type) => {
  currentBrushType.value = type;
  editorRef.value?.setBrushType(type);
};

const onColorClick = (color) => {
  currentColor.value = color;
  editorRef.value?.setColor(color);
};

const onWidthInput = (value) => {
  const num = Number(value);
  currentWidth.value = num;
  editorRef.value?.setWidth(num);
};

const zoomIn = () => editorRef.value?.zoomIn();
const zoomOut = () => editorRef.value?.zoomOut();
const resetZoom = () => editorRef.value?.resetZoom();

const onHistoryUpdate = (undoCount, redoCount) => {
  canUndo.value = Number(undoCount) > 0;
  canRedo.value = Number(redoCount) > 0;
};

const onUndoClick = () => editorRef.value?.undo?.();
const onRedoClick = () => editorRef.value?.redo?.();

const onResetClick = async () => {
  if (!editorRef.value) return;
  const ok = window.confirm("确定要清空所有操作并重置画布吗？");
  if (!ok) return;
  await editorRef.value.reset();
  editorRef.value?.clearAndSaveState?.();
  editorRef.value?.setTool?.("move");
  currentTool.value = "move";
};

const onSaveClick = async () => {
  await editorRef.value?.save();
};

/**
 * 示例工程未对接业务上传接口，保存后：
 * 1) 在控制台打印图片 base64（含 data: 前缀，可直接复制用于调试）；
 * 2) 通过 Blob URL 在新标签页中预览修改后的图片。
 */
const onSaveSuccess = (file) => {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result;
    console.log("[MapEditor] 保存成功 - 图片 base64:", base64);
  };
  reader.onerror = () => {
    console.error("[MapEditor] 读取 base64 失败:", reader.error);
  };
  reader.readAsDataURL(file);

  const blobUrl = URL.createObjectURL(file);
  const newTab = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!newTab) {
    console.warn("[MapEditor] 新标签页被浏览器拦截，请允许弹出窗口后重试");
  }
  // 给新标签页留出加载时间，避免立刻 revoke 导致 about:blank
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};

const onSaveError = (err) => {
  console.error("图片导出失败：", err);
};
</script>

<style lang="scss" scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  background: linear-gradient(
    160deg,
    #e8f4fc 0%,
    #eef1f8 30%,
    #f0f6fb 60%,
    #e6f0fa 100%
  );
}

.map-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  z-index: 10;
}

.grid-bg {
  position: absolute;
  inset: 0;
  opacity: 0.04;
  background-image:
    linear-gradient(rgba(14, 165, 233, 1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 1) 1px, transparent 1px);
  background-size: 40px 40px;
}

.map-container {
  position: absolute;
  inset: 12px;
  border-radius: 16px;
  overflow: hidden;
  background: #F5F5F5;
  box-shadow:
    0 4px 30px rgba(14, 165, 233, 0.06),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  max-width: 100%;
//   overflow-x: auto;
  padding-bottom: 2px;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.divider {
  width: 1px;
  align-self: stretch;
  background: rgba(14, 165, 233, 0.25);
  margin: 4px 4px;
}

.icon-btn {
  box-sizing: border-box;
  padding: 0;
  width: auto;
  min-width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 10px;
  border: 1px solid rgba(14, 165, 233, 0.2);
  background: rgba(255, 255, 255, 0.7);
  color: #0369a1;
  cursor: pointer;
  outline: none;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.06);
  font-size: 12px;
  font-weight: 600;
}

.icon-btn :deep(svg) {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  stroke: currentColor;
}

[data-tooltip] {
  position: relative;
}

[data-tooltip]::before,
[data-tooltip]::after {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translate(-50%, 4px);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  white-space: nowrap;
  z-index: 100;
}

[data-tooltip]::after {
  content: attr(data-tooltip);
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: #ffffff;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(2, 132, 199, 0.92));
  box-shadow: 0 6px 18px rgba(2, 132, 199, 0.25);
  backdrop-filter: blur(6px);
}

[data-tooltip]::before {
  content: '';
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid rgba(2, 132, 199, 0.92);
  bottom: calc(100% + 3px);
  filter: drop-shadow(0 2px 2px rgba(2, 132, 199, 0.2));
}

[data-tooltip]:hover::before,
[data-tooltip]:hover::after,
[data-tooltip]:focus-visible::before,
[data-tooltip]:focus-visible::after,
[data-tooltip]:focus-within::before,
[data-tooltip]:focus-within::after {
  opacity: 1;
  transform: translate(-50%, 0);
}

.icon-btn__label {
  padding-right: 8px;
  white-space: nowrap;
}

.tool-group--compact .icon-btn {
  min-width: 36px;
  width: 36px;
}

.tool-group--compact .icon-btn__label {
  display: none;
}

.icon-btn:hover {
  transform: translateY(-1px) scale(1.04);
  background: rgba(14, 165, 233, 0.08);
  border-color: rgba(14, 165, 233, 0.35);
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.1);
}

.icon-btn:active {
  transform: scale(0.96);
}

.icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.03);
}

.icon-btn:disabled:hover {
  transform: none;
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(14, 165, 233, 0.2);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.03);
}

.icon-btn:focus-visible {
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.5);
}

.icon-btn.active {
  border-color: transparent;
  background: linear-gradient(135deg, #1a94f0 0%, #38bdf8 100%);
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.3);
}

.icon-btn.active :deep(svg) {
  stroke: #ffffff;
}

.icon-btn.active .icon-btn__label {
  color: #ffffff;
}

.color-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.swatch {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  padding: 3px;
  border: 1px solid rgba(14, 165, 233, 0.25);
  background: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  outline: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}

.swatch:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15);
}

.swatch.active {
  border-color: #0167ff;
  box-shadow: 0 0 0 2px rgba(1, 103, 255, 0.25);
}

.swatch-fill {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 1px solid rgba(15, 23, 42, 0.12);
}

.slider-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(14, 165, 233, 0.2);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.06);
}

.slider-label {
  font-size: 12px;
  color: #0369a1;
  letter-spacing: 0.04em;
}

.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 140px;
  height: 4px;
  background: linear-gradient(90deg, #0167ff, #40bbe9);
  border-radius: 999px;
  outline: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #0167ff;
  box-shadow: 0 1px 4px rgba(14, 165, 233, 0.35);
}

.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #0167ff;
  box-shadow: 0 1px 4px rgba(14, 165, 233, 0.35);
}

.slider-value {
  min-width: 28px;
  text-align: right;
  font-size: 12px;
  color: #0369a1;
}

.tabular {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, "SF Mono", monospace;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.footer-action-tooltip {
  display: inline-flex;
  align-items: center;
}

.footer-action-tooltip.save-btn[data-tooltip]::after{
  width: 115px;
}

.footer-action-tooltip[data-tooltip]::after {
  white-space: normal;
  max-width: min(260px, calc(100vw - 48px));
  text-align: center;
  line-height: 1.35;
}

@media (max-width: 768px) {
  .map-container {
    inset: 8px;
  }

  .editor-toolbar {
    gap: 6px;
  }

  .slider {
    width: 100px;
  }
}
</style>
