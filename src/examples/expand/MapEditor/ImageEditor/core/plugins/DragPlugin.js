/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2025-07-17 16:13:40
 * @LastEditors: Ella ella.yin@x-humanoid.com
 * @LastEditTime: 2025-07-21 14:14:09
 * @FilePath: /bic-robobiz-admin/src/components/ImageEditor/core/plugins/DragPlugin.js
 * @Description: 画布拖拽插件
 */

import { isMiddleClick } from "../../utils/index";

class DragPlugin {
  static pluginName = "DragPlugin";
  static apis = ["startDrag", "endDrag"];
  dragMode = null;

  constructor(canvas, editor) {
    this.dragMode = false;
    this.canvas = canvas;
    this.editor = editor;
    this.init();
  }
  init() {
    this._initDrag();
  }

  // 拖拽模式;
  _initDrag() {
    const This = this;
    const workspacePlugin = This.editor.getPlugin('WorkspacePlugin');

    this.canvas.on("mouse:down", function (opt) {
      const evt = opt.e;
      
      // 检测拖拽触发条件：Alt键 + 左键，或拖拽模式激活，或中键点击
      const isDragTrigger = evt.altKey || This.dragMode || isMiddleClick(opt);
      
      if (isDragTrigger) {
        This.canvas.setCursor("grabbing");
        This.canvas.discardActiveObject();
        This._setDrag();
        this.selection = false;
        this.isDragging = true;
        this.lastPosX = evt.clientX;
        this.lastPosY = evt.clientY;
        this.requestRenderAll();
      }
    });

    this.canvas.on("mouse:move", function (opt) {
      This.dragMode && This.canvas.setCursor("grab");
      const zoom = This.canvas.getZoom();
      if (this.isDragging && zoom !== 1) {

        This.canvas.discardActiveObject();
        This.canvas.setCursor("grabbing");
        const { e } = opt;
        if (!this.viewportTransform) return;
        const vpt = this.viewportTransform;
        
        // 计算新的偏移量
        const newTranslateX = vpt[4] + (e.clientX - this.lastPosX);
        const newTranslateY = vpt[5] + (e.clientY - this.lastPosY);
        
        // 获取拖拽边界限制
        if (workspacePlugin && workspacePlugin.calculateDragBounds) {
          const bounds = workspacePlugin.calculateDragBounds();
          
          // 应用边界限制
          vpt[4] = Math.max(bounds.minX, Math.min(bounds.maxX, newTranslateX));
          vpt[5] = Math.max(bounds.minY, Math.min(bounds.maxY, newTranslateY));
        } else {
          // 如果无法获取边界限制，使用原始逻辑
          vpt[4] = newTranslateX;
          vpt[5] = newTranslateY;
        }
        
        this.lastPosX = e.clientX;
        this.lastPosY = e.clientY;
        this.requestRenderAll();
      }
    });

    this.canvas.on("mouse:up", function () {
      if (!this.viewportTransform) return;
      this.setViewportTransform(this.viewportTransform);
      this.isDragging = false;
      this.selection = true;
      this.getObjects().forEach((obj) => {
        if (obj.id !== "workspace" && obj.hasControls) {
          obj.selectable = true;
        }
      });
      This.dragMode && This.canvas.setCursor("grab");
      
      // 确保背景图片始终保持不可交互状态
      if (workspacePlugin && workspacePlugin.ensureBackgroundNotInteractive) {
        workspacePlugin.ensureBackgroundNotInteractive();
      }
      
      this.requestRenderAll();
    });
  }

  _setDrag() {
    this.canvas.selection = false;
    this.canvas.getObjects().forEach((obj) => {
      obj.selectable = false;
    });
    this.canvas.requestRenderAll();
  }

  startDrag() {
    this.dragMode = true;
    this.canvas.setCursor("grab");
    this.canvas.renderAll();
  }

  endDrag() {
    this.dragMode = false;
    this.canvas.setCursor("default");
    this.canvas.isDragging = false;
    this.canvas.renderAll();
  }
}

export default DragPlugin;
