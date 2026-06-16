import * as fabric from "fabric";

import { getImageFormatFromUrl } from "../../utils/index";

class WorkspacePlugin {
  static pluginName = "WorkspacePlugin";
  static apis = [
    "big",
    "small",
    "defaultZoom",
    "resetCanvas",
    "ensureBackgroundNotInteractive",
    "calculateDragBounds",
    "forceUpdateCanvasSize",
    "isEditCanvas",
    "getBackgroundImageFormat",
    "isObjectIntersectingBackground",
    "initBackgroundImage",
  ];
  workspaceEl = null;
  workspace = null;
  zoomRatio = 1;
  option = null;
  backgroundImageInfo = null; // 存储背景图片信息
  tempFabricCanvas = null;
  originalImageSource = null; // 存储原始图片源
  imageNotHttps = false;
  defaultActionParams = {
    selectable: false, // 不可选择
    hasControls: false, // 不显示控制点
    evented: false, // 不接收事件
    active: false, // 不激活
    lockMovementX: true, // 锁定X轴移动
    lockMovementY: true, // 锁定Y轴移动
    lockRotation: true, // 锁定旋转
    lockScalingX: true, // 锁定X轴缩放
    lockScalingY: true, // 锁定Y轴缩放
    lockSkewingX: true, // 锁定X轴倾斜
    lockSkewingY: true, // 锁定Y轴倾斜
    moveCursor: null, // 移除移动光标
    hoverCursor: null, // 移除悬停光标
    borderColor: "transparent", // 隐藏边框
    cornerColor: "transparent", // 隐藏角点
    cornerStyle: "circle", // 设置角点样式
    transparentCorners: true, // 透明角点
    excludeFromExport: true, // 导出时包含
    absolutePositioned: true, // 绝对定位，不受变换影响
    imageNotHttps: false
  };

  // 添加警告状态跟踪
  hasShownMaxZoomWarning = false;
  hasShownMinZoomWarning = false;

  constructor(canvas, editor) {
    this.canvas = canvas;
    this.editor = editor;
    this.init({
      width: 900,
      height: 1200,
    });
    this.zoomRatio = 1;
    this._bindEditBoundaryEvents();
  }

  init(option) {
    const workspaceEl = document.querySelector("#workspace");
    if (!workspaceEl) {
      throw new Error("element #workspace is missing, plz check!");
    }
    this.workspaceEl = workspaceEl;
    this.workspace = null;
    this.option = option;
    this._bindWheel();
  }

  async initBackgroundImage(imageSource) {
    this.originalImageSource = imageSource;
    this.imageNotHttps = false;
    await this._initBackground();
  }

  async _loadBackgroundImage() {
    try {
      const imageSource = this.originalImageSource;
      const imageNotHttps = this.imageNotHttps;

      // 检测图片格式
      const detectedFormat = await getImageFormatFromUrl(imageSource);

      let fabricImage;
      
      try {
        const param = imageNotHttps ? {} : { crossOrigin: "anonymous" }
        // 首次尝试：直接通过 fabric.FabricImage.fromURL 加载
        fabricImage = await fabric.FabricImage.fromURL(imageSource, param);
        console.log("图片加载成功 - 直接方式");
      } catch (firstError) {
        console.warn("直接加载图片失败，尝试容错方式:", firstError);
        
        try {
          // 容错方式：先通过 img 标签预加载图片，再创建 FabricImage
          fabricImage = await this._loadImageWithFallback(imageSource);
          console.log("图片加载成功 - 容错方式");
        } catch (fallbackError) {
          console.error("容错方式也失败:", fallbackError);
          throw new Error(`图片加载失败: ${firstError.message}. 容错尝试也失败: ${fallbackError.message}`);
        }
      }

      const imgEl =
        typeof fabricImage.getElement === "function"
          ? fabricImage.getElement()
          : null;
      const imageWidth = Math.max(
        1,
        fabricImage.width || imgEl?.naturalWidth || 1,
      );
      const imageHeight = Math.max(
        1,
        fabricImage.height || imgEl?.naturalHeight || 1,
      );

      const containerWidth = Math.max(
        1,
        this.workspaceEl.clientWidth || this.workspaceEl.offsetWidth,
      );
      const containerHeight = Math.max(
        1,
        this.workspaceEl.clientHeight || this.workspaceEl.offsetHeight,
      );

      this.canvas.setDimensions({
        width: containerWidth,
        height: containerHeight,
      });

      // 计算图片在canvas中的适配尺寸（保持宽高比）
      const imageAspectRatio = imageWidth / imageHeight;
      const containerAspectRatio = containerWidth / containerHeight;

      let displayWidth, displayHeight, scaleX, scaleY, left, top;

      // 根据宽高比决定如何适配到canvas中
      if (imageAspectRatio > containerAspectRatio) {
        // 图片比容器更宽，以容器宽度为准
        displayWidth = containerWidth;
        displayHeight = containerWidth / imageAspectRatio;
        left = 0;
        top = (containerHeight - displayHeight) / 2; // 垂直居中
      } else {
        // 图片比容器更高，以容器高度为准
        displayHeight = containerHeight;
        displayWidth = containerHeight * imageAspectRatio;
        left = (containerWidth - displayWidth) / 2; // 水平居中
        top = 0;
      }

      // 计算图片的缩放比例
      scaleX = displayWidth / imageWidth;
      scaleY = displayHeight / imageHeight;

      // 存储背景图片信息
      this.backgroundImageInfo = {
        left: left,                  // 背景图片在canvas中的x位置
        top: top,                   // 背景图片在canvas中的y位置
        width: displayWidth,         // 背景图片在canvas中的显示宽度
        height: displayHeight,       // 背景图片在canvas中的显示高度
        originalWidth: imageWidth,   // 原始图片宽度
        originalHeight: imageHeight, // 原始图片高度
        scaleX: scaleX,             // X轴缩放比例
        scaleY: scaleY,             // Y轴缩放比例
        canvasWidth: containerWidth, // canvas总宽度
        canvasHeight: containerHeight, // canvas总高度
        format: detectedFormat,      // 图片格式
        source: imageSource,         // 图片源
        imageNotHttps
      };

      // 设置图片属性使其作为背景
      fabricImage.set({
        left: left,
        top: top,
        scaleX: scaleX,
        scaleY: scaleY,
        originX: "left",
        originY: "top",
        name: "backgroundImage",
        ...this.defaultActionParams,
      });

      this.canvas.add(fabricImage);

      // 设置对象层级，确保背景图片在最底层（必须在add之后调用）
      this.canvas.moveObjectTo(fabricImage, 0);

      // 设置全局裁剪路径，限制绘制区域在背景图片范围内
      this._setCanvasClipPath();

      this.canvas.renderAll();
      this.defaultZoom();
      return fabricImage;
    } catch (error) {
      console.error("图片加载失败:", error);
      throw error;
    }
  }

  /**
   * 容错图片加载方法
   * 通过创建 img 标签预加载图片，然后使用该元素创建 FabricImage
   * @param {string} imageSource - 图片URL
   * @returns {Promise<fabric.FabricImage>} - FabricImage 实例
   */
  async _loadImageWithFallback(imageSource) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // 设置图片加载成功回调
      img.onload = () => {
        try {
          // 使用预加载的 img 元素创建 FabricImage
          const fabricImage = new fabric.FabricImage(img);
          resolve(fabricImage);
        } catch (error) {
          reject(new Error(`创建 FabricImage 失败: ${error.message}`));
        }
      };
      
      // 设置图片加载失败回调
      img.onerror = (error) => {
        reject(new Error(`Image 标签加载失败: ${error.message || '未知错误'}`));
      };
      
      // 设置图片加载超时
      const timeout = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        reject(new Error('图片加载超时'));
      }, 30000); // 30秒超时
      
      // 清理超时定时器
      const cleanup = () => {
        clearTimeout(timeout);
      };
      
      const originalOnload = img.onload;
      const originalOnerror = img.onerror;
      
      img.onload = (event) => {
        cleanup();
        if (originalOnload) originalOnload(event);
      };
      
      img.onerror = (event) => {
        cleanup();
        if (originalOnerror) originalOnerror(event);
      };
      // 尝试不同的 CORS 设置
      try {
        img.crossOrigin = "anonymous";
      } catch (corsError) {
        console.warn("设置 crossOrigin 失败，尝试不使用 CORS:", corsError);
        img.crossOrigin = null;
      }
            
      // 开始加载图片
      img.src = imageSource;
    });
  }

  // 获取背景图片格式
  getBackgroundImageFormat() {
    return this.backgroundImageInfo?.format || 'png';
  }

  async _initBackground() {
    await this._loadBackgroundImage();

    // 使用节流 监听视口大小变化，重新计算画布和图片尺寸
    // window.addEventListener(
    //   "resize",
    //   throttle(async () => {
    //     // 先移除背景图片
    //     this.canvas.getObjects().forEach((obj) => {
    //       if (obj.name === "backgroundImage") {
    //         this.canvas.remove(obj);
    //       }
    //     });
    //     // 重新加载背景图片，重新计算适配尺寸
    //     await this._loadBackgroundImage(this.originalImageSource);
    //     // 清理所有超出新背景范围的对象
    //     this._cleanOutOfBoundsObjects();
    //     this.defaultZoom();
    //   }, 500)
    // );
  }


  /**
   * 兼容 Fabric v7：v7 已移除 canvas.getCenter()，统一以画布像素中心点参与缩放。
   */
  _getCanvasCenterPoint() {
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();
    return new fabric.Point(width / 2, height / 2);
  }

  // 放大
  big() {
    this.editor.contextMenu.hideAll();
    let zoomRatio = this.canvas.getZoom();
    zoomRatio += 0.05;
    if (zoomRatio > 20) {
      if (!this.hasShownMaxZoomWarning) {
        console.warn("当前最大缩放比例为20，无法继续放大");
        this.hasShownMaxZoomWarning = true;
      }
      zoomRatio = 20;
    } else {
      this.hasShownMaxZoomWarning = false;
    }
    this.canvas.zoomToPoint(this._getCanvasCenterPoint(), zoomRatio);

    // 缩放后应用边界限制
    this._applyDragBoundsAfterZoom();
  }

  // 缩小
  small() {
    this.editor.contextMenu.hideAll();

    let zoomRatio = this.canvas.getZoom();
    zoomRatio -= 0.05;
    if (zoomRatio < 1) {
      if (!this.hasShownMinZoomWarning) {
        console.warn("当前最小缩放比例为1，无法继续缩小");
        this.hasShownMinZoomWarning = true;
      }
      zoomRatio = 1;
    } else {
      this.hasShownMinZoomWarning = false;
    }
    this.canvas.zoomToPoint(this._getCanvasCenterPoint(), zoomRatio);

    // 缩放后应用边界限制
    this._applyDragBoundsAfterZoom();
  }

  // 恢复画布默认缩放比例1并且恢复到初始位置
  defaultZoom() {
    this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    this.canvas.setZoom(1);
    this.canvas.absolutePan(new fabric.Point(0, 0));
    this.hasShownMaxZoomWarning = false;
    this.hasShownMinZoomWarning = false;

    this.editor && this.editor.contextMenu && this.editor.contextMenu.hideAll();

    // 重置后应用边界限制
    this._applyDragBoundsAfterZoom();

    this.canvas.renderAll();
  }

  // 完全重置画布到初始状态
  async resetCanvas() {
    try {
      // 清除除了背景图片的其他对象
      const objects = this.canvas
        .getObjects()
        .filter((obj) => obj.name !== "backgroundImage");
      objects.forEach((obj) => {
        this.canvas.remove(obj);
      });
      this.editor.contextMenu.hideAll();

      // 确保画布尺寸为父容器尺寸
      this.canvas.setDimensions({
        width: this.workspaceEl.offsetWidth,
        height: this.workspaceEl.offsetHeight,
      });

      // 重新计算并设置画布尺寸（适配容器变化）
      await this.forceUpdateCanvasSize();

      return true;
    } catch (error) {
      console.error("重置画布失败:", error);
      return false;
    }
  }

  _bindWheel() {
    this.canvas.on("mouse:wheel", (opt) => {
      this.editor.contextMenu.hideAll();
      const delta = opt.e.deltaY;
      let zoom = this.canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) {
        if (!this.hasShownMaxZoomWarning) {
          console.warn("当前最大缩放比例为20，无法继续放大");
          this.hasShownMaxZoomWarning = true;
        }
        zoom = 20;
      } else if (zoom < 1) {
        if (!this.hasShownMinZoomWarning) {
          console.warn("当前最小缩放比例为1，无法继续缩小");
          this.hasShownMinZoomWarning = true;
        }
        zoom = 1;
      } else {
        this.hasShownMaxZoomWarning = false;
        this.hasShownMinZoomWarning = false;
      }

      const center = this.canvas.getCenter();
      this.canvas.zoomToPoint(new fabric.Point(center.left, center.top), zoom);

      // 缩放后应用边界限制
      this._applyDragBoundsAfterZoom();

      opt.e.preventDefault();
      opt.e.stopPropagation();
    });
  }

  // 缩放后应用拖拽边界限制
  _applyDragBoundsAfterZoom() {
    const vpt = this.canvas.viewportTransform;
    if (!vpt) return;

    const bounds = this.calculateDragBounds();

    // 检查并修正当前视口位置
    const currentTranslateX = vpt[4];
    const currentTranslateY = vpt[5];

    // 应用边界限制
    const newTranslateX = Math.max(
      bounds.minX,
      Math.min(bounds.maxX, currentTranslateX)
    );
    const newTranslateY = Math.max(
      bounds.minY,
      Math.min(bounds.maxY, currentTranslateY)
    );

    // 如果需要调整，更新视口变换
    if (
      newTranslateX !== currentTranslateX ||
      newTranslateY !== currentTranslateY
    ) {
      vpt[4] = newTranslateX;
      vpt[5] = newTranslateY;
      this.canvas.setViewportTransform(vpt);
      this.canvas.requestRenderAll();
    }
  }

  // 确保背景图片保持不可交互状态的辅助方法
  ensureBackgroundNotInteractive() {
    // 查找所有背景图片对象
    const backgroundImages = this.canvas
      .getObjects()
      .filter((obj) => obj.name === "backgroundImage");

    backgroundImages.forEach((fabricImage) => {
      // 应用完整的不可交互设置
      fabricImage.set({
        ...this.defaultActionParams,
      });

      // 确保背景图片在最底层
      this.canvas.moveObjectTo(fabricImage, 0);
    });

    // 强制重新渲染
    this.canvas.renderAll();
  }

  // 计算拖拽边界限制
  calculateDragBounds() {
    const zoom = this.canvas.getZoom();

    if (!this.backgroundImageInfo) {
      return {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      };
    }

    // 视口尺寸（父容器尺寸，也是canvas尺寸）
    const viewportWidth = this.backgroundImageInfo.canvasWidth;
    const viewportHeight = this.backgroundImageInfo.canvasHeight;

    // 背景图片显示区域信息
    const { left: bgLeft, top: bgTop, width: bgWidth, height: bgHeight } = this.backgroundImageInfo;

    // 计算缩放后的背景图片位置和尺寸
    const scaledBgLeft = bgLeft * zoom;
    const scaledBgTop = bgTop * zoom;
    const scaledBgWidth = bgWidth * zoom;
    const scaledBgHeight = bgHeight * zoom;

    let bounds = {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };

    // 水平方向边界限制 - 确保背景图片始终在视口内可见
    if (scaledBgWidth > viewportWidth) {
      // 背景图片比视口宽，允许拖拽查看
      bounds.maxX = -scaledBgLeft;
      bounds.minX = -(scaledBgLeft + scaledBgWidth - viewportWidth);
    } else {
      // 背景图片比视口小，保持居中
      const centerOffsetX = (viewportWidth - scaledBgWidth) / 2 - scaledBgLeft;
      bounds.minX = centerOffsetX;
      bounds.maxX = centerOffsetX;
    }

    // 垂直方向边界限制 - 确保背景图片始终在视口内可见
    if (scaledBgHeight > viewportHeight) {
      // 背景图片比视口高，允许拖拽查看
      bounds.maxY = -scaledBgTop;
      bounds.minY = -(scaledBgTop + scaledBgHeight - viewportHeight);
    } else {
      // 背景图片比视口小，保持居中
      const centerOffsetY = (viewportHeight - scaledBgHeight) / 2 - scaledBgTop;
      bounds.minY = centerOffsetY;
      bounds.maxY = centerOffsetY;
    }

    return bounds;
  }

  async forceUpdateCanvasSize() {
    // 移除原有背景图片
    this.canvas.getObjects().forEach((obj) => {
      if (obj.name === "backgroundImage") {
        this.canvas.remove(obj);
      }
    });

    // 重新加载背景图片，canvas尺寸为父容器尺寸，图片按比例适配
    await this._loadBackgroundImage();
    // 清理所有超出新背景范围的对象
    this._cleanOutOfBoundsObjects();
  }

  // 是否编辑了canvas
  isEditCanvas() {
    // 获取所有对象，排除背景图片等系统对象
    const userObjects = this.canvas.getObjects().filter((obj) => {
      // 排除背景图片
      if (obj.name === "backgroundImage") {
        return false;
      }
      return true;
    });

    return userObjects.length > 0;
  }

  // 绑定编辑边界事件
  _bindEditBoundaryEvents() {
    // 对象添加后检查是否超出背景范围
    this.canvas.on('object:added', (e) => {
      if (e.target.name !== 'backgroundImage' && e.target.name !== 'clipPath') {
        setTimeout(() => {
          this._checkAndRemoveOutOfBoundsObject(e.target);
        }, 10); // 延迟检查，确保对象已完全添加
      }
    });

    // 对象移动后检查是否超出背景范围
    this.canvas.on('object:moved', (e) => {
      if (e.target.name !== 'backgroundImage' && e.target.name !== 'clipPath') {
        this._checkAndRemoveOutOfBoundsObject(e.target);
      }
    });

    // 对象缩放后检查是否超出背景范围
    this.canvas.on('object:scaled', (e) => {
      if (e.target.name !== 'backgroundImage' && e.target.name !== 'clipPath') {
        this._checkAndRemoveOutOfBoundsObject(e.target);
      }
    });

    // 路径创建后检查是否超出背景范围
    this.canvas.on('path:created', (e) => {
      setTimeout(() => {
        this._checkAndRemoveOutOfBoundsObject(e.path);
      }, 10);
    });
  }

  // 设置画布裁剪路径
  _setCanvasClipPath() {
    if (!this.backgroundImageInfo) {
      return;
    }

    const { left, top, width, height } = this.backgroundImageInfo;

    // 创建裁剪矩形
    const clipRect = new fabric.Rect({
      left: left,
      top: top,
      width: width,
      height: height,
      absolutePositioned: true,
      name: 'clipPath'
    });

    // 设置画布的裁剪路径
    this.canvas.clipPath = clipRect;
  }

  // 检查对象是否与背景图片区域有交集
  isObjectIntersectingBackground(obj) {
    if (!this.backgroundImageInfo || obj.name === 'backgroundImage' || obj.name === 'clipPath') {
      return true;
    }

    const objBounds = obj.getBoundingRect();
    const { left: bgLeft, top: bgTop, width: bgWidth, height: bgHeight } = this.backgroundImageInfo;
    const bgRight = bgLeft + bgWidth;
    const bgBottom = bgTop + bgHeight;

    // 检查对象边界与背景图片区域是否有交集
    const hasIntersection = !(
      objBounds.left + objBounds.width < bgLeft ||  // 对象在背景左侧
      objBounds.left > bgRight ||                   // 对象在背景右侧
      objBounds.top + objBounds.height < bgTop ||   // 对象在背景上方
      objBounds.top > bgBottom                      // 对象在背景下方
    );

    return hasIntersection;
  }

  // 检查并删除完全超出背景范围的对象
  _checkAndRemoveOutOfBoundsObject(obj) {
    if (!this.backgroundImageInfo || obj.name === 'backgroundImage' || obj.name === 'clipPath') {
      return;
    }

    // 如果对象与背景图片区域没有交集，则删除该对象
    if (!this.isObjectIntersectingBackground(obj)) {
      this.canvas.remove(obj);
      console.info("超出背景图片范围的内容已被删除");
    }
  }

  // 清理所有超出背景范围的对象
  _cleanOutOfBoundsObjects() {
    if (!this.backgroundImageInfo) {
      return;
    }

    const objectsToRemove = [];

    this.canvas.getObjects().forEach((obj) => {
      if (obj.name !== 'backgroundImage' && obj.name !== 'clipPath') {
        if (!this.isObjectIntersectingBackground(obj)) {
          objectsToRemove.push(obj);
        }
      }
    });

    // 批量删除超出范围的对象
    objectsToRemove.forEach((obj) => {
      this.canvas.remove(obj);
    });

    if (objectsToRemove.length > 0) {
      this.canvas.renderAll();
    }

    return objectsToRemove.length;
  }


  destroy() {
    this.canvas.off('object:added', this._objectAddedHandler);
    this.canvas.off('object:moved', this._objectMovedHandler);
    this.canvas.off('object:scaled', this._objectScaledHandler);
    this.canvas.off('path:created', this._pathCreatedHandler);
  }
}

export default WorkspacePlugin;
