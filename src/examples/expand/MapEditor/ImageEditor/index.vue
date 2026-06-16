<!--
 * @Author: Ella ella.yin@x-humanoid.com
 * @Description: 图片编辑器画布壳：初始化 fabric.Canvas + 注册全部插件，仅渲染 #workspace 与 canvas，
 *               全部操作 API 通过 defineExpose 暴露给父组件，UI 由父组件自行编排。
 * @FilePath: /bic-map/src/examples/expand/MapEditor/ImageEditor/index.vue
-->
<template>
  <div class="image-editor">
    <div id="workspace" class="image-editor__workspace">
      <canvas id="canvas-image-editor"></canvas>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import * as fabric from 'fabric'

import Editor, {
  ControlsPlugin,
  DeletePlugin,
  DragPlugin,
  DrawPlugin,
  ExportPlugin,
  HistoryPlugin,
  FreeDrawPlugin,
  StraightLinePlugin,
  WorkspacePlugin
} from './core/index.js'
import { toolConfigs } from './config/index.js'

const props = defineProps({
  mapUrl: { type: String, required: true }
})
const emit = defineEmits(['ready', 'saveSuccess', 'saveError', 'historyUpdate'])

const canvasEditor = ref(null)
const fabricCanvas = ref(null)
const currentTool = ref('move')

let resizeObserver = null

/**
 * 等待 #workspace 获得有效尺寸后再加载底图，避免首帧 offset 为 0 导致缩放与裁剪错误。
 */
async function waitForWorkspaceLayout(workspaceEl, maxAttempts = 30) {
  await nextTick()
  await new Promise((r) => requestAnimationFrame(r))
  for (let i = 0; i < maxAttempts; i++) {
    const w = workspaceEl.clientWidth
    const h = workspaceEl.clientHeight
    if (w >= 8 && h >= 8) return
    await new Promise((r) => requestAnimationFrame(r))
  }
}

onMounted(async () => {
  const workspaceEl = document.querySelector('#workspace')
  if (!workspaceEl) return

  await waitForWorkspaceLayout(workspaceEl)

  const canvas = new fabric.Canvas('canvas-image-editor', {
    fireRightClick: true,
    stopContextMenu: true,
    preserveObjectStacking: true
  })
  fabricCanvas.value = canvas

  const editor = new Editor()
  editor.init(canvas)
  editor
    .use(ControlsPlugin)
    .use(WorkspacePlugin)
    .use(HistoryPlugin)
    .use(DragPlugin)
    .use(DrawPlugin)
    .use(FreeDrawPlugin)
    .use(StraightLinePlugin)
    .use(DeletePlugin)
    .use(ExportPlugin)

  const wp = editor.getPlugin('WorkspacePlugin')
  try {
    await wp.initBackgroundImage(props.mapUrl)
  } catch (e) {
    console.error('加载地图底图失败:', e)
  }

  canvasEditor.value = editor

  const historyUpdateHandler = (undoCount, redoCount) => {
    emit('historyUpdate', undoCount, redoCount)
  }
  editor.on('historyUpdate', historyUpdateHandler)

  // 初始化时主动同步一次按钮状态
  const hp = editor.getPlugin('HistoryPlugin')
  hp?.historyUpdate?.()

  // 默认启用拖拽（move 工具）
  setTool('move')

  const lastObserved = { w: 0, h: 0 }
  lastObserved.w = workspaceEl.clientWidth
  lastObserved.h = workspaceEl.clientHeight

  resizeObserver = new ResizeObserver((entries) => {
    const cr = entries[0]?.contentRect
    if (!cr) return
    const w = Math.round(cr.width)
    const h = Math.round(cr.height)
    if (w < 8 || h < 8) return
    if (w === lastObserved.w && h === lastObserved.h) return
    lastObserved.w = w
    lastObserved.h = h

    const ed = canvasEditor.value
    if (!ed) return
    const workspacePlugin = ed.getPlugin('WorkspacePlugin')
    if (!workspacePlugin?.forceUpdateCanvasSize) return

    requestAnimationFrame(() => {
      workspacePlugin.forceUpdateCanvasSize().catch(() => {})
    })
  })
  resizeObserver.observe(workspaceEl)

  emit('ready', editor)
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (canvasEditor.value) {
    canvasEditor.value.destroy()
    canvasEditor.value = null
  }
  if (fabricCanvas.value) {
    fabricCanvas.value.dispose()
    fabricCanvas.value = null
  }
})

/**
 * 切换当前激活工具，并联动结束冲突的拖拽 / 绘制状态。
 * @param {'select'|'move'|'pencil'|'eraser'} type
 */
const setTool = (type) => {
  const editor = canvasEditor.value
  if (!editor) return

  editor.endDrag()
  editor.setMode(false)

  // 再次点击同一绘制工具时回到默认拖拽
  if (type === currentTool.value && type !== 'move') {
    type = 'move'
  }

  let drawingMode = false
  if (type === 'move') {
    editor.startDrag()
  } else if (type === 'pencil' || type === 'eraser') {
    drawingMode = true
    applyToolDefaults(type)
    if (type === 'pencil') editor.bindPencilDraw()
    if (type === 'eraser') editor.bindEraserDraw()
  }

  editor.setMode(drawingMode)
  editor.setLineType(type)
  currentTool.value = type
}

/**
 * 切换画笔/橡皮所使用的默认颜色与粗细，避免插件内部状态残留。
 */
const applyToolDefaults = (type) => {
  const editor = canvasEditor.value
  const config = toolConfigs[type]
  if (!editor || !config) return
  const defaultColor = config.colors?.[0]
  const defaultWidth = config.slider?.defaultValue
  if (type === 'pencil') {
    editor.setPencilDrawType('free')
    if (defaultColor) editor.setPencilDrawColor(defaultColor)
    if (defaultWidth) editor.setPencilDrawWidth(defaultWidth)
  } else if (type === 'eraser') {
    if (defaultColor) editor.setEraserDrawColor(defaultColor)
    if (defaultWidth) editor.setEraserDrawWidth(defaultWidth)
  }
}

const setBrushType = (type) => {
  const editor = canvasEditor.value
  if (!editor || currentTool.value !== 'pencil') return
  editor.setPencilDrawType(type)
}

const setColor = (color) => {
  const editor = canvasEditor.value
  if (!editor) return
  if (currentTool.value === 'pencil') editor.setPencilDrawColor(color)
  if (currentTool.value === 'eraser') editor.setEraserDrawColor(color)
}

const setWidth = (width) => {
  const editor = canvasEditor.value
  if (!editor) return
  if (currentTool.value === 'pencil') editor.setPencilDrawWidth(width)
  if (currentTool.value === 'eraser') editor.setEraserDrawWidth(width)
}

const zoomIn = () => canvasEditor.value?.big()
const zoomOut = () => canvasEditor.value?.small()
const resetZoom = () => canvasEditor.value?.defaultZoom()

const reset = async () => {
  const editor = canvasEditor.value
  if (!editor) return false
  return await editor.resetCanvas()
}

const undo = () => canvasEditor.value?.undo?.()
const redo = () => canvasEditor.value?.redo?.()
const clearAndSaveState = () => canvasEditor.value?.clearAndSaveState?.()

/**
 * 导出当前画布为 File，由父组件接收后自行决定上传或下载。
 * @returns {Promise<File|null>}
 */
const save = async () => {
  const editor = canvasEditor.value
  if (!editor) return null
  try {
    const format = editor.getBackgroundImageFormat()
    const file = await editor.exportImage(format)
    if (file) emit('saveSuccess', file)
    return file
  } catch (error) {
    emit('saveError', error)
    throw error
  }
}

defineExpose({
  setTool,
  setBrushType,
  setColor,
  setWidth,
  zoomIn,
  zoomOut,
  resetZoom,
  reset,
  undo,
  redo,
  clearAndSaveState,
  save
})
</script>

<style lang="scss" scoped>
.image-editor {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.image-editor__workspace {
  position: absolute;
  inset: 0;
}
</style>
