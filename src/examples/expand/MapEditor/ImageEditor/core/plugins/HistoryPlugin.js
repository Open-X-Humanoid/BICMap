import * as fabric from "fabric";

class HistoryPlugin {
  static pluginName = "HistoryPlugin";
  static apis = ["undo", "redo", "clearAndSaveState", "saveState"];
  static events = [];

  constructor(canvas, editor) {
    this.canvas = canvas;
    this.editor = editor;

    this.stack = [];
    this.currentIndex = 0;
    this.maxLength = 30;
    this.isProcessing = false;
    this.isLoading = false;

    this._boundEvents = {};
    this._init();
  }

  _init() {
    // 新增对象由各绘制插件在一笔绘制完成后主动调用 saveState()，
    // 避免 fabric 的 object:added / path:created 在插件补齐 id、name 等属性前就抓取快照。
    const events = {
      "object:removed": () => this.saveState(),
      "canvas:cleared": () => this.saveState(),
    };

    Object.entries(events).forEach(([eventName, handler]) => {
      this._boundEvents[eventName] = handler;
      this.canvas.on(eventName, handler);
    });

    // 初始化为当前画布状态（通常只有背景）
    this.saveState();
  }

  _getExtraProps() {
    return [
      "id",
      "name",
      "selectable",
      "hasControls",
      "evented",
      "excludeFromExport",
      "absolutePositioned",
    ];
  }

  getCurrentState() {
    const extraProps = this._getExtraProps();
    const json = this.canvas.toDatalessJSON(extraProps);
    const objects = Array.isArray(json.objects) ? json.objects : [];
    return objects.filter(
      (obj) => obj.name !== "backgroundImage" && obj.name !== "clipPath"
    );
  }

  saveState() {
    if (this.isProcessing) return;

    const state = this.getCurrentState();

    // 与当前状态完全一致说明是空操作（例如零长度直线被立即移除），不入栈也不截断重做链
    const currentState = this.stack[this.currentIndex - 1];
    if (
      currentState &&
      JSON.stringify(currentState) === JSON.stringify(state)
    ) {
      return;
    }

    // 新操作产生后，丢弃重做链
    this.stack.splice(this.currentIndex);
    this.stack.push(state);

    // 控制最大长度（丢弃最早）
    if (this.stack.length > this.maxLength) {
      this.stack.shift();
    } else {
      this.currentIndex++;
    }

    this.historyUpdate();
  }

  getState() {
    return {
      undoCount: this.currentIndex - 1,
      redoCount: this.stack.length - this.currentIndex,
    };
  }

  historyUpdate() {
    const { undoCount, redoCount } = this.getState();
    this.editor.emit("historyUpdate", undoCount, redoCount);
  }

  clearAndSaveState() {
    const currentState = this.getCurrentState();
    this.stack = [currentState];
    this.currentIndex = 1;
    this.historyUpdate();
  }

  _loadState(state, eventName) {
    this.isLoading = true;
    this.isProcessing = true;

    const objects = this.canvas.getObjects();
    const backgroundObj = objects.find((o) => o.name === "backgroundImage") || null;
    const clipPathObj = this.canvas.clipPath || null;

    const parsedState = JSON.parse(state);
    const drawingOnly = Array.isArray(parsedState)
      ? parsedState
      : parsedState.objects || [];
    const version = this.canvas.get("version") || undefined;
    const drawingOnlyJson = { version, objects: drawingOnly };

    this.canvas
      .loadFromJSON(JSON.stringify(drawingOnlyJson))
      .then(() => {
        if (backgroundObj) {
          this.canvas.add(backgroundObj);
          this.canvas.moveObjectTo(backgroundObj, 0);
        }
        if (clipPathObj) {
          this.canvas.clipPath = clipPathObj;
        }
        this.canvas.renderAll();
        this.canvas.fire(eventName);
      })
      .catch((err) => {
        console.error("History loadFromJSON failed:", err);
      })
      .finally(() => {
        this.isProcessing = false;
        this.isLoading = false;
      });
  }

  undo() {
    if (this.isLoading || this.currentIndex <= 1) return;
    this.currentIndex--;
    const state = this.stack[this.currentIndex - 1];
    if (!state) return;
    this._loadState(JSON.stringify(state), "history:undo");
    this.historyUpdate();
  }

  redo() {
    if (this.isLoading || this.currentIndex >= this.stack.length) return;
    const state = this.stack[this.currentIndex];
    if (!state) return;
    this._loadState(JSON.stringify(state), "history:redo");
    this.currentIndex++;
    this.historyUpdate();
  }

  destroy() {
    Object.entries(this._boundEvents).forEach(([eventName, handler]) => {
      this.canvas.off(eventName, handler);
    });
    this._boundEvents = {};
  }
}

export default HistoryPlugin;

