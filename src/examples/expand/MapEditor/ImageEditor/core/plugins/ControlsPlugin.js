class ControlsPlugin {
  static pluginName = "ControlsPlugin";

  constructor(canvas, editor) {
    this.canvas = canvas;
    this.editor = editor;
    this.activeControlsOptions = {
      transparentCorners: false,
      borderColor: "#51B9F9",
      cornerColor: "#FFF",
      borderScaleFactor: 2.5,
      cornerStyle: "circle",
      cornerStrokeColor: "#0E98FC",
      borderOpacityWhenMoving: 1,
    }
    this.init();
  }
  
  init() {
    // 设置canvas默认控制样式
    this.canvas.defaultControlsOptions = this.activeControlsOptions;

    // 监听对象添加事件，为新对象设置控制样式
    this.canvas.on('object:added', this.setObjectControlsStyle.bind(this));

    // 监听选择创建事件，确保单选和多选都应用样式
    this.canvas.on('selection:created', this.setSelectionControlsStyle.bind(this));

  }

  setObjectControlsStyle(e) {
    const obj = e.target;
    // 为新添加的对象设置控制样式（排除ActiveSelection）
    if (obj && obj.set && obj.type !== 'activeSelection') {
      obj.set(this.activeControlsOptions);
    }
  }

  setSelectionControlsStyle(e) {
    // 获取当前活动对象
    const activeObject = this.canvas.getActiveObject();
    activeObject.set(this.activeControlsOptions);
    this.canvas.requestRenderAll();
  }

  destroy() {
    this.canvas.off('object:added', this.setObjectControlsStyle);
    this.canvas.off('selection:created', this.setSelectionControlsStyle);
  }
}

export default ControlsPlugin;
