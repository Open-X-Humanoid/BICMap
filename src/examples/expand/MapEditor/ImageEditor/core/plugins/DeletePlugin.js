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
