/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2025-07-16 15:30:31
 * @LastEditors: Ella ella.yin@x-humanoid.com
 * @LastEditTime: 2025-07-23 16:14:17
 * @FilePath: /bic-robobiz-admin/src/components/ImageEditor/core/plugins/DrawLinePlugin.js
 * @Description: 绘制线元素插件
 */
class DrawLinePlugin {
  static pluginName = "DrawLinePlugin";
  static apis = [
    "setLineType", 
    "setMode", 
    "setPencilDrawType", 
    "setPencilDrawColor", 
    "setPencilDrawWidth", 
    "setEraserDrawColor", 
    "setEraserDrawWidth",
    "bindPencilDraw",
    "bindEraserDraw"
  ];
  isDrawingLineMode;
  lineType; // 绘制工具类型
  pencilDraw = {
    color: "#fff",
    type: "free",
    width: 1,
    brushType: 'pencil',
  };
  eraserDraw = {
    color: "#fff",
    width: 1,
    brushType: 'eraser',
  };

  constructor(canvas, editor, options) {
    this.canvas = canvas;
    this.editor = editor;
    this.options = options;
  }

  setLineType(params) {
    this.lineType = params;
  }

  setPencilDrawType(params) {
    this.pencilDraw.type = params;
    if (this.lineType === "pencil" && this.isDrawingLineMode) {
      this.bindPencilDraw();
    }
  }

  setPencilDrawColor(params) {
    this.pencilDraw.color = params;
    if (this.lineType === "pencil" && this.isDrawingLineMode) {
      if(this.pencilDraw.type === "free") {
      const freeDrawPlugin = this.editor.getPlugin('FreeDrawPlugin');
        if (freeDrawPlugin && freeDrawPlugin.updateBrushColor) {
          freeDrawPlugin.updateBrushColor(params);
        }
      } else if(this.pencilDraw.type === "line") {
        const lineDrawPlugin = this.editor.getPlugin('StraightLinePlugin');
        if (lineDrawPlugin && lineDrawPlugin.updateLineBrushColor) {
          lineDrawPlugin.updateLineBrushColor(params);
        }
      }
    }
  }

  setPencilDrawWidth(params) {
    this.pencilDraw.width = params;
    if (this.lineType === "pencil" && this.isDrawingLineMode) {
      if(this.pencilDraw.type === "free") {
        const freeDrawPlugin = this.editor.getPlugin('FreeDrawPlugin');
        if (freeDrawPlugin && freeDrawPlugin.updateBrushWidth) {
          freeDrawPlugin.updateBrushWidth(params);
        }
      } else if(this.pencilDraw.type === "line") {
        const lineDrawPlugin = this.editor.getPlugin('StraightLinePlugin');
        if (lineDrawPlugin && lineDrawPlugin.updateLineBrushWidth) {
          lineDrawPlugin.updateLineBrushWidth(params);
        }
      }
    }
  }

  setEraserDrawColor(params) {
    this.eraserDraw.color = params;
    if (this.lineType === "eraser" && this.isDrawingLineMode) {
      const freeDrawPlugin = this.editor.getPlugin('FreeDrawPlugin');
      if (freeDrawPlugin && freeDrawPlugin.updateBrushColor) {
        freeDrawPlugin.updateBrushColor(params);
      }
    }
  }

  setEraserDrawWidth(params) {
    this.eraserDraw.width = params;
    if (this.lineType === "eraser" && this.isDrawingLineMode) {
      const freeDrawPlugin = this.editor.getPlugin('FreeDrawPlugin');
      if (freeDrawPlugin && freeDrawPlugin.updateBrushWidth) {
        freeDrawPlugin.updateBrushWidth(params);
      }
    }
  }

  bindPencilDraw() {
    const freeDrawPlugin = this.editor.getPlugin('FreeDrawPlugin');
    const lineDrawPlugin = this.editor.getPlugin('StraightLinePlugin');
    if(!freeDrawPlugin || !lineDrawPlugin) {
      return;
    }
    if(this.pencilDraw.type === "free") {
      lineDrawPlugin.endLineDraw();
      freeDrawPlugin.startFreeDraw(this.pencilDraw);
    } else if(this.pencilDraw.type === "line") {
      freeDrawPlugin.endFreeDraw();
      lineDrawPlugin.startLineDraw(this.pencilDraw);
    }
  }

  bindEraserDraw() {
    // 添加橡皮擦绘制方法
    const freeDrawPlugin = this.editor.getPlugin('FreeDrawPlugin');
    if (freeDrawPlugin) {
      freeDrawPlugin.startFreeDraw(this.eraserDraw);
    }
  }

  setMode(params) {
    this.isDrawingLineMode = params;
    if (!this.isDrawingLineMode) {
      this.endRest();
      const freeDrawPlugin = this.editor.getPlugin('FreeDrawPlugin');
      if (freeDrawPlugin) {
        freeDrawPlugin.endFreeDraw();
      }
      const lineDrawPlugin = this.editor.getPlugin('StraightLinePlugin');
      if (lineDrawPlugin) {
        lineDrawPlugin.endLineDraw();
      }
    }
  }

  endRest() {
    this.canvas.getObjects().forEach((obj) => {
      // 保持背景图片和橡皮擦对象不可选中
      if (obj.name === "backgroundImage" || obj.name === "eraser") {
        obj.selectable = false;
        obj.hasControls = false;
        obj.evented = false;
      } else if (obj.id !== "workspace") {
        obj.selectable = true;
        obj.hasControls = true;
      }
    });
    
    // 确保背景图片始终保持不可交互状态
    const workspacePlugin = this.editor.getPlugin('WorkspacePlugin');
    if (workspacePlugin && workspacePlugin.ensureBackgroundNotInteractive) {
      workspacePlugin.ensureBackgroundNotInteractive();
    }
  }

  destroy() {
    this.canvas.off("mouse:down");
    this.canvas.off("mouse:move");
    this.canvas.off("mouse:up");
    this.canvas.off("mouse:wheel");
    this.isDrawingLineMode = null;
    this.lineType = null;
  }
}

export default DrawLinePlugin;
