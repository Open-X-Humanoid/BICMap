import { v4 as uuid } from "uuid";
import * as fabric from "fabric";

class FreeDrawPlugin {
  static pluginName = "FreeDrawPlugin";
  static apis = ["startFreeDraw", "endFreeDraw", "updateBrushColor", "updateBrushWidth"];

  constructor(canvas, editor, options) {
    this.canvas = canvas;
    this.editor = editor;
    this.options = options;
    // 记录进入自由绘制前的光标，方便结束时恢复
    this._prevCursors = null;
  }

  _bindEvent() {
    this.canvas.on("path:created", this._createdHandler);
  }

  _unbindEvent() {
    this.canvas.off("path:created", this._createdHandler);
  }

  _createdHandler = (opt) => {
    opt.path.set("id", uuid());
    // 检查是否为橡皮擦工具绘制的对象
    if (this.canvas.freeDrawingBrush && this.canvas.freeDrawingBrush.name === 'eraser') {
      // 设置橡皮擦对象的标识和属性
      opt.path.set({
        name: "eraser",
        selectable: false,
        hasControls: false,
        evented: false
      });
    }
    // 属性补齐后再记录历史，保证撤销/重做还原出的对象带有 id 与橡皮擦标识
    this.editor.saveState?.();
  };

  // 生成圆形光标（基于离屏Canvas → PNG dataURL），用来预览笔刷大小
  _makeCircleCursor(size, options = {}) {
    const { stroke = "#000", strokeWidth = 1 } = options;
    const r = Math.max(1, size / 2);
    const pad = 1; // 适当留白，避免描边被裁剪
    const diameter = r * 2 + pad * 2;

    // 浏览器对自定义光标尺寸有限制（常见约128px）
    const MAX_EDGE = 128;
    const scale = Math.min(1, MAX_EDGE / diameter);
    const pixelSize = Math.max(8, Math.round(diameter * scale));

    const cx = Math.round(pixelSize / 2);
    const cy = cx;

    const off = document.createElement('canvas');
    off.width = pixelSize;
    off.height = pixelSize;
    const ctx = off.getContext('2d');

    // 提升边缘锐度
    ctx.imageSmoothingEnabled = true;

    // 画圆
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, (r + 0.5) * scale), 0, Math.PI * 2);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, strokeWidth * scale);
    ctx.stroke();

    const url = off.toDataURL('image/png');
    const hotspotX = cx;
    const hotspotY = cy;
    return `url(${url}) ${hotspotX} ${hotspotY}, crosshair`;
  }

  _applyBrushCursor(size) {
    if (!size) return;
    const cursor = this._makeCircleCursor(size, { stroke: "#000", showCross: true });
    this.canvas.defaultCursor = cursor;
    this.canvas.hoverCursor = cursor;
    this.canvas.freeDrawingCursor = cursor;
    this.canvas.requestRenderAll();
  }

  _storePrevCursors() {
    if (this._prevCursors) return;
    this._prevCursors = {
      defaultCursor: this.canvas.defaultCursor,
      hoverCursor: this.canvas.hoverCursor,
      freeDrawingCursor: this.canvas.freeDrawingCursor,
    };
  }

  _restorePrevCursors() {
    if (!this._prevCursors) return;
    this.canvas.defaultCursor = this._prevCursors.defaultCursor || "default";
    this.canvas.hoverCursor = this._prevCursors.hoverCursor || "default";
    this.canvas.freeDrawingCursor = this._prevCursors.freeDrawingCursor || "crosshair";
    this._prevCursors = null;
    this.canvas.renderAll();
  }

  startFreeDraw(options) {
    this.canvas.isDrawingMode = true;
    this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
    this.canvas.freeDrawingBrush.width = options.width;
    this.canvas.freeDrawingBrush.color = options.color;
    this.canvas.freeDrawingBrush.name = options.brushType;

    // 应用圆形光标并记录原先光标
    this._storePrevCursors();
    this._applyBrushCursor(options.width);

    this._bindEvent();
  }

  endFreeDraw() {
    if (this.canvas.isDrawingMode) {
      this.canvas.isDrawingMode = false;
      this._unbindEvent();
      // 恢复进入绘制前的光标
      this._restorePrevCursors();
      return;
    }
  }

  // 实时更新画笔颜色
  updateBrushColor(color) {
    if (this.canvas.isDrawingMode && this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = color;
    }
  }

  // 实时更新画笔宽度（同步更新圆形光标大小）
  updateBrushWidth(width) {
    if (this.canvas.isDrawingMode && this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.width = width;
      this._applyBrushCursor(width);
    }
  }

}

export default FreeDrawPlugin;
