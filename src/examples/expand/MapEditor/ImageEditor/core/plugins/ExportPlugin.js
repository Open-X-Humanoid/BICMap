import * as fabric from "fabric";

import { blobToFile } from "../../utils/index";

class ExportPlugin {
  static pluginName = "ExportPlugin";
  static apis = ["exportImage"];
  tempFabricCanvas = null;

  constructor(canvas, editor) {
    this.canvas = canvas;
    this.editor = editor;
  }

  // 导出合并后的图片
  async exportImage(format = null, quality = 1.0) {
    const { backgroundImageInfo } = this.editor.getPlugin("WorkspacePlugin");
    if (!backgroundImageInfo) {
      throw new Error("背景图片信息不存在，无法导出");
    }

    const exportFormat = format || backgroundImageInfo.format || "png";

    // 创建临时canvas用于导出
    const tempCanvas = document.createElement("canvas");

    // 设置临时canvas尺寸为原始背景图片尺寸
    const { originalWidth, originalHeight } = backgroundImageInfo;
    tempCanvas.width = originalWidth;
    tempCanvas.height = originalHeight;

    const tempFabricCanvas = await this._exportObjectsToCanvas(
      tempCanvas,
      backgroundImageInfo
    );

    const mimeType = `image/${exportFormat}`;
    // 将canvas导出为blob blob-->File
    const blob = await tempFabricCanvas.toBlob(mimeType, quality);
    const file = await blobToFile(blob, `map.${exportFormat}`);
    return file;
  }

  // 将canvas对象导出到临时canvas
  async _exportObjectsToCanvas(tempCanvas, backgroundImageInfo) {
    const {
      left: bgLeft,
      top: bgTop,
      scaleX: bgScaleX,
      scaleY: bgScaleY,
    } = backgroundImageInfo;

    this.tempFabricCanvas = new fabric.Canvas(tempCanvas);

    let fabricImage;

    try {
      // 首次尝试：直接通过 fabric.FabricImage.fromURL 加载
      fabricImage = await fabric.FabricImage.fromURL(
        backgroundImageInfo.source,
        { crossOrigin: "anonymous" }
      );
      console.log("导出时图片加载成功 - 直接方式");
    } catch (firstError) {
      console.warn("导出时直接加载图片失败，尝试容错方式:", firstError);
      
      try {
        // 容错方式：先通过 img 标签预加载图片，再创建 FabricImage
        fabricImage = await this._loadImageWithFallback(backgroundImageInfo.source);
        console.log("导出时图片加载成功 - 容错方式");
      } catch (fallbackError) {
        console.error("导出时容错方式也失败:", fallbackError);
        throw new Error(`导出时图片加载失败: ${firstError.message}. 容错尝试也失败: ${fallbackError.message}`);
      }
    }

    fabricImage.set({
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
      originX: "left",
      originY: "top",
      name: "backgroundImage",
    });

    this.tempFabricCanvas.add(fabricImage);
    this.tempFabricCanvas.moveObjectTo(fabricImage, 0);
    // 获取所有需要导出的对象（排除背景图片和裁剪路径）
    const objectsToExport = this.canvas
      .getObjects()
      .filter(
        (obj) =>
          obj.name !== "backgroundImage" &&
          obj.name !== "clipPath" &&
          this.editor
            .getPlugin("WorkspacePlugin")
            .isObjectIntersectingBackground(obj)
      );
    // 批量克隆和转换对象
    const clonedObjects = await Promise.all(
      objectsToExport.map((obj) =>
        this._cloneObjectForExport(obj, bgLeft, bgTop, bgScaleX, bgScaleY)
      )
    );

    // 添加所有克隆的对象到临时canvas
    clonedObjects.forEach((clonedObj) => {
      if (clonedObj) {
        this.tempFabricCanvas.add(clonedObj);
      }
    });

    // 渲染临时canvas
    this.tempFabricCanvas.renderAll();
    return this.tempFabricCanvas;
  }

  // 克隆对象并调整其属性
  async _cloneObjectForExport(obj, bgLeft, bgTop, bgScaleX, bgScaleY) {
    try {
      let cloned = null;
      cloned = await obj.clone();

      // 计算在原始坐标系中的位置和缩放
      const newLeft = (obj.left - bgLeft) / bgScaleX;
      const newTop = (obj.top - bgTop) / bgScaleY;
      const newScaleX = obj.scaleX / bgScaleX;
      const newScaleY = obj.scaleY / bgScaleY;

      // 设置新的位置和缩放
      cloned.set({
        left: newLeft,
        top: newTop,
        scaleX: newScaleX,
        scaleY: newScaleY,
        originX: obj.originX,
        originY: obj.originY,
      });

      cloned.clipPath = null;

      return cloned;
    } catch (error) {
      console.error("克隆对象时发生错误:", error, obj);
      return null;
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

  destroy() {
    this.tempFabricCanvas && this.tempFabricCanvas.destroy();
  }
}

export default ExportPlugin;
