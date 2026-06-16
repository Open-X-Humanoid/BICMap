/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2025-07-19 15:20:00
 * @LastEditors: Ella ella.yin@x-humanoid.com
 * @LastEditTime: 2025-07-29 15:04:29
 * @FilePath: /bic-robobiz-admin/src/components/ImageEditor/core/plugins/DeletePlugin.js
 * @Description: 删除插件，删除当前选中的元素
 */

class DeleteHotKeyPlugin {
  static pluginName = "DeleteHotKeyPlugin";
  static apis = ["del"];
  hotkeys = ["backspace"];
  constructor(canvas, editor) {
    this.canvas = canvas;
    this.editor = editor;
  }

  // 快捷键扩展回调
  hotkeyEvent(eventName, e) {
    if (e.type === "keydown" && eventName === "backspace") {
      this.del();
    }
  }

  del() {
    const { canvas } = this;
    const activeObject = canvas.getActiveObjects();
    if (activeObject) {
      activeObject.map((item) => canvas.remove(item));
      canvas.requestRenderAll();
      canvas.discardActiveObject();
    }
  }

  contextMenu() {
    const activeObject = this.canvas.getActiveObject();
    if (activeObject) {
      return [
        null,
        {
          text: "删除",
          hotkey: "Backspace",
          disabled: false,
          onclick: () => this.del(),
        },
      ];
    }
  }

  destroy() {
    
  }
}

export default DeleteHotKeyPlugin;
