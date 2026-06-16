/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2025-07-18 11:10:00
 * @LastEditors: Ella ella.yin@x-humanoid.com
 * @LastEditTime: 2025-07-21 16:40:21
 * @FilePath: /bic-robobiz-admin/src/components/ImageEditor/core/plugins/StraightLinePlugin.js
 * @Description: 铅笔直线绘制插件
 */
import { v4 as uuid } from "uuid";
import * as fabric from "fabric";
import { isLeftClick } from "../../utils/index";

class StraightLinePlugin {
  static pluginName = "StraightLinePlugin";
  static apis = [
    "startLineDraw",
    "endLineDraw",
    "updateLineBrushColor",
    "updateLineBrushWidth",
  ];
  lineToDraw;
  pointer;
  pointerPoints;
  isDrawingLine;
  mouseDown;
  // 添加当前设置状态
  currentSettings;

  constructor(canvas, editor, options) {
    this.canvas = canvas;
    this.editor = editor;
    this.options = options;
    this.isDrawingLine = false;
    this.lineToDraw = null;
    this.pointer = null;
    this.pointerPoints = null;
    this.mouseDown = false;
    // 初始化当前设置
    this.currentSettings = {
      strokeWidth: 1,
      stroke: "#000000"
    };
  }

  startLineDraw(options) {
    const { width, color } = options;
    // 更新当前设置
    this.currentSettings = {
      strokeWidth: width,
      stroke: color,
    };

    this._removeEventListeners();

    this.isDrawingLine = true;
    this.canvas.defaultCursor = "crosshair";
    
    // 强制清除任何现有选择状态
    this.canvas.discardActiveObject();
    this.canvas._activeObject = null;
    this.canvas.selection = false;
    
    // 确保所有直线对象保持不可选中状态
    this.canvas.getObjects().forEach((obj) => {
      obj.selectable = false;
      obj.hasControls = false;
      obj.evented = false;
      obj.active = false;
    });

    this._bindEventListeners();
  }

  _bindEventListeners() {
    const { canvas } = this;

    this._onMouseDown = (o) => {
      if (!this.isDrawingLine || !isLeftClick(o)) return;

      this.mouseDown = true;

      // 强制清除任何活动对象选择
      canvas.discardActiveObject();
      
      // 强制清除选择状态并禁用选择功能
      canvas.selection = false;
      canvas.skipTargetFind = true;

      // 临时禁用所有对象的交互，特别关注直线对象
      canvas.getObjects().forEach((obj) => {
        obj.selectable = false;
        obj.hasControls = false;
        obj.evented = false;
      });

      canvas.requestRenderAll();

      this.pointer = canvas.getPointer(o.e);
      this.pointerPoints = [
        this.pointer.x,
        this.pointer.y,
        this.pointer.x,
        this.pointer.y,
      ];

      // 使用最新的设置创建直线，而不是传入的opts
      const lineOptions = {
        ...this.currentSettings,
        id: uuid(),
      };

      this.lineToDraw = new fabric.Line(this.pointerPoints, lineOptions);

      // 彻底禁用直线对象的所有交互功能
      this.lineToDraw.selectable = false;
      this.lineToDraw.hasControls = false;
      this.lineToDraw.evented = false;
      this.lineToDraw.active = false;
      this.lineToDraw.strokeUniform = true;
      this.lineToDraw.moveCursor = null;
      this.lineToDraw.hoverCursor = null;
      // 添加类型标识，用于后续识别这是由直线插件绘制的对象
      // this.lineToDraw.type = "straight-line";
      canvas.add(this.lineToDraw);
    };

    this._onMouseMove = (o) => {
      if (!this.isDrawingLine || !this.mouseDown) return;
      canvas.discardActiveObject();
      const activeObject = canvas.getActiveObject();
      if (activeObject) return;
      this.pointer = canvas.getPointer(o.e);
      if (o.e.shiftKey) {
        // shift+绘制直线时，约束直线角度为15度的倍数
        const startX = this.pointerPoints[0];
        const startY = this.pointerPoints[1];
        const x2 = this.pointer.x - startX;
        const y2 = this.pointer.y - startY;
        const r = Math.sqrt(x2 * x2 + y2 * y2);
        let angle = (Math.atan2(y2, x2) / Math.PI) * 180;
        angle = ~~(((angle + 7.5) % 360) / 15) * 15;

        const cosx = r * Math.cos((angle * Math.PI) / 180);
        const sinx = r * Math.sin((angle * Math.PI) / 180);

        this.lineToDraw.set({
          x2: cosx + startX,
          y2: sinx + startY,
        });
      } else {
        this.lineToDraw.set({
          x2: this.pointer.x,
          y2: this.pointer.y,
        });
      }

      canvas.renderAll();
    };

    this._onMouseUp = () => {
      if (!this.isDrawingLine || !this.mouseDown) return;
      this.mouseDown = false;

      // 保存当前绘制的线条引用
      const currentLine = this.lineToDraw;

      // 确保绘制完成的直线彻底不可选中
      if (currentLine) {
        currentLine.setCoords();
        currentLine.selectable = false;
        currentLine.hasControls = false;
        currentLine.evented = false;
        currentLine.active = false;
        currentLine.moveCursor = null;
        currentLine.hoverCursor = null;
        // currentLine.type = "straight-line";
      }

      // 清空当前绘制的直线引用，防止颜色切换时影响已完成的直线
      this.lineToDraw = null;

      // 强制清除任何可能的选择状态
      canvas.discardActiveObject();
      canvas._activeObject = null;
      
      // 重新启用目标查找但保持直线不可选中
      canvas.skipTargetFind = false;
      
      canvas.renderAll();
    };

    canvas.on("mouse:down", this._onMouseDown);
    canvas.on("mouse:move", this._onMouseMove);
    canvas.on("mouse:up", this._onMouseUp);
  }

  _removeEventListeners() {
    const { canvas } = this;
    if (this._onMouseDown) {
      canvas.off("mouse:down", this._onMouseDown);
    }
    if (this._onMouseMove) {
      canvas.off("mouse:move", this._onMouseMove);
    }
    if (this._onMouseUp) {
      canvas.off("mouse:up", this._onMouseUp);
    }
  }

  endLineDraw() {
    if (!this.isDrawingLine) return;
    this.isDrawingLine = false;
    this.lineToDraw = null;
    this.pointer = null;
    this.pointerPoints = null;
    this.canvas.defaultCursor = "default";
    
    // 强制清除任何选择状态
    this.canvas.discardActiveObject();
    this.canvas._activeObject = null;
    this.canvas.selection = true; // 恢复画布选择功能

    // 清除事件监听器
    this._removeEventListeners();

    // 恢复画布上对象的可选中状态，但保持特殊对象的不可选中状态
    this.canvas.getObjects().forEach((obj) => {
      // 保持背景图片和橡皮擦对象不可选中
      if (obj.name === "backgroundImage" || obj.name === "eraser") {
        
        obj.selectable = false;
        obj.hasControls = false;
        obj.evented = false;
      } else {
        // 恢复其他对象的可选中状态
        obj.selectable = true;
        obj.hasControls = true;
        obj.evented = true;
      }
    });
    this.canvas.requestRenderAll();
  }

  // 实时更新画笔颜色
  updateLineBrushColor(color) {
    // 更新当前设置状态
    this.currentSettings.stroke = color;
    
    // 如果当前正在绘制直线，也更新当前直线的颜色
    if (this.isDrawingLine && this.lineToDraw) {
      this.lineToDraw.set("stroke", color);
      this.canvas.renderAll();
    }
  }

  // 实时更新画笔宽度
  updateLineBrushWidth(width) {
    // 更新当前设置状态
    this.currentSettings.strokeWidth = width;
    
    // 如果当前正在绘制直线，也更新当前直线的宽度
    if (this.isDrawingLine && this.lineToDraw) {
      this.lineToDraw.set("strokeWidth", width);
      this.canvas.renderAll();
    }
  }
}

export default StraightLinePlugin;
