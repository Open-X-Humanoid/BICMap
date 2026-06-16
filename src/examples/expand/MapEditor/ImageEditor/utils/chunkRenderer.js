/**
 * 大尺寸图片分块绘制器
 * 用于解决大图片导出时的内存和性能问题
 */
class ChunkRenderer {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 2048; // 每个分块的大小
    this.overlap = options.overlap || 100; // 分块间的重叠像素，避免边缘问题
    this.maxCanvasSize = options.maxCanvasSize || 16384; // 浏览器canvas最大尺寸限制
    this.quality = options.quality || 1.0; // 图片质量
    this.format = options.format || "png"; // 导出格式
  }

  /**
   * 检查是否需要分块渲染
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @returns {boolean}
   */
  needsChunkRendering(width, height) {
    return (
      width > this.maxCanvasSize ||
      height > this.maxCanvasSize ||
      width * height > (this.maxCanvasSize * this.maxCanvasSize) / 4
    );
  }

  /**
   * 计算分块信息
   * @param {number} totalWidth - 总宽度
   * @param {number} totalHeight - 总高度
   * @returns {Array} 分块信息数组
   */
  calculateChunks(totalWidth, totalHeight) {
    const chunks = [];
    const effectiveChunkSize = this.chunkSize - this.overlap;

    for (let y = 0; y < totalHeight; y += effectiveChunkSize) {
      for (let x = 0; x < totalWidth; x += effectiveChunkSize) {
        const chunkWidth = Math.min(
          this.chunkSize,
          totalWidth - x + this.overlap
        );
        const chunkHeight = Math.min(
          this.chunkSize,
          totalHeight - y + this.overlap
        );

        // 实际绘制区域（去除重叠部分）
        const actualX = x;
        const actualY = y;
        const actualWidth = Math.min(effectiveChunkSize, totalWidth - x);
        const actualHeight = Math.min(effectiveChunkSize, totalHeight - y);

        chunks.push({
          // 分块索引
          row: Math.floor(y / effectiveChunkSize),
          col: Math.floor(x / effectiveChunkSize),

          // 在原图中的位置和尺寸
          sourceX: x,
          sourceY: y,
          sourceWidth: chunkWidth,
          sourceHeight: chunkHeight,

          // 在目标画布中的位置和尺寸
          targetX: actualX,
          targetY: actualY,
          targetWidth: actualWidth,
          targetHeight: actualHeight,

          // 分块画布尺寸
          chunkWidth,
          chunkHeight,
        });
      }
    }

    return chunks;
  }

  /**
   * 渲染单个分块
   * @param {HTMLCanvasElement} sourceCanvas - 源画布
   * @param {Object} chunk - 分块信息
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<HTMLCanvasElement>}
   */
  async renderChunk(sourceCanvas, chunk, onProgress) {
    return new Promise((resolve, reject) => {
      try {
        // 创建分块画布
        const chunkCanvas = document.createElement("canvas");
        chunkCanvas.width = chunk.chunkWidth;
        chunkCanvas.height = chunk.chunkHeight;

        const chunkCtx = chunkCanvas.getContext("2d");
        const sourceCtx = sourceCanvas.getContext("2d");

        // 获取源画布的图像数据
        const imageData = sourceCtx.getImageData(
          chunk.sourceX,
          chunk.sourceY,
          chunk.sourceWidth,
          chunk.sourceHeight
        );

        // 将图像数据绘制到分块画布
        chunkCtx.putImageData(imageData, 0, 0);

        // 调用进度回调
        if (onProgress) {
          onProgress(chunk);
        }

        resolve(chunkCanvas);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 合并所有分块为最终图片
   * @param {Array} chunkCanvases - 分块画布数组
   * @param {Array} chunks - 分块信息数组
   * @param {number} totalWidth - 总宽度
   * @param {number} totalHeight - 总高度
   * @returns {Promise<string>} 最终图片的DataURL
   */
  async mergeChunks(chunkCanvases, chunks, totalWidth, totalHeight) {
    return new Promise((resolve, reject) => {
      try {
        // 创建最终画布
        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = totalWidth;
        finalCanvas.height = totalHeight;

        const finalCtx = finalCanvas.getContext("2d");

        // 合并所有分块
        chunks.forEach((chunk, index) => {
          const chunkCanvas = chunkCanvases[index];
          if (chunkCanvas) {
            // 只绘制实际有效区域，避免重叠
            finalCtx.drawImage(
              chunkCanvas,
              this.overlap / 2, // 源画布中的起始位置
              this.overlap / 2,
              chunk.targetWidth, // 源画布中的尺寸
              chunk.targetHeight,
              chunk.targetX, // 目标画布中的位置
              chunk.targetY,
              chunk.targetWidth, // 目标画布中的尺寸
              chunk.targetHeight
            );
          }
        });

        // 转换为DataURL
        const dataURL = finalCanvas.toDataURL(
          `image/${this.format}`,
          this.quality
        );
        resolve(dataURL);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 主要的分块渲染方法
   * @param {HTMLCanvasElement} sourceCanvas - 源画布
   * @param {number} targetWidth - 目标宽度
   * @param {number} targetHeight - 目标高度
   * @param {Object} options - 选项
   * @returns {Promise<string>} 渲染结果的DataURL
   */
  async renderInChunks(sourceCanvas, targetWidth, targetHeight, options = {}) {
    const {
      onProgress = () => {},
      onChunkComplete = () => {},
      onError = () => {},
    } = options;

    try {
      // 检查是否需要分块渲染
      if (!this.needsChunkRendering(targetWidth, targetHeight)) {
        // 不需要分块，直接绘制
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        // 计算缩放比例
        const scaleX = targetWidth / sourceCanvas.width;
        const scaleY = targetHeight / sourceCanvas.height;

        ctx.scale(scaleX, scaleY);
        ctx.drawImage(sourceCanvas, 0, 0);

        return canvas.toDataURL(`image/${this.format}`, this.quality);
      }

      // 需要分块渲染
      console.log(`开始分块渲染: ${targetWidth}x${targetHeight}`);

      // 创建临时缩放画布
      const scaledCanvas = await this.createScaledCanvas(
        sourceCanvas,
        targetWidth,
        targetHeight
      );

      // 计算分块
      const chunks = this.calculateChunks(targetWidth, targetHeight);
      console.log(`总共需要渲染 ${chunks.length} 个分块`);

      // 渲染所有分块
      const chunkCanvases = [];
      let completedChunks = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          const chunkCanvas = await this.renderChunk(
            scaledCanvas,
            chunk,
            () => {
              completedChunks++;
              const progress = (completedChunks / chunks.length) * 100;
              onProgress({
                completed: completedChunks,
                total: chunks.length,
                progress: progress,
                currentChunk: chunk,
              });
            }
          );

          chunkCanvases.push(chunkCanvas);
          onChunkComplete(chunk, chunkCanvas);
        } catch (error) {
          console.error(`分块 ${i} 渲染失败:`, error);
          onError(error, chunk);
          chunkCanvases.push(null); // 占位
        }
      }

      // 合并所有分块
      console.log("开始合并分块...");
      const finalDataURL = await this.mergeChunks(
        chunkCanvases,
        chunks,
        targetWidth,
        targetHeight
      );

      // 清理临时画布
      scaledCanvas.remove();
      chunkCanvases.forEach((canvas) => {
        if (canvas) canvas.remove();
      });

      console.log("分块渲染完成");
      return finalDataURL;
    } catch (error) {
      console.error("分块渲染失败:", error);
      onError(error);
      throw error;
    }
  }

  /**
   * 创建缩放后的临时画布
   * @param {HTMLCanvasElement} sourceCanvas - 源画布
   * @param {number} targetWidth - 目标宽度
   * @param {number} targetHeight - 目标高度
   * @returns {Promise<HTMLCanvasElement>}
   */
  async createScaledCanvas(sourceCanvas, targetWidth, targetHeight) {
    return new Promise((resolve, reject) => {
      try {
        const scaledCanvas = document.createElement("canvas");
        scaledCanvas.width = targetWidth;
        scaledCanvas.height = targetHeight;

        const ctx = scaledCanvas.getContext("2d");

        // 使用高质量缩放
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // 绘制缩放后的图像
        ctx.drawImage(
          sourceCanvas,
          0,
          0,
          sourceCanvas.width,
          sourceCanvas.height,
          0,
          0,
          targetWidth,
          targetHeight
        );

        resolve(scaledCanvas);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 估算渲染所需内存
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @returns {Object} 内存估算信息
   */
  estimateMemoryUsage(width, height) {
    const pixelCount = width * height;
    const bytesPerPixel = 4; // RGBA
    const totalBytes = pixelCount * bytesPerPixel;

    const chunks = this.calculateChunks(width, height);
    const chunkMemory =
      this.chunkSize * this.chunkSize * bytesPerPixel * chunks.length;

    return {
      totalImageSize: totalBytes,
      chunkCount: chunks.length,
      chunkMemoryUsage: chunkMemory,
      totalMemoryUsage: totalBytes + chunkMemory,
      // 转换为MB
      totalImageSizeMB: (totalBytes / (1024 * 1024)).toFixed(2),
      chunkMemoryUsageMB: (chunkMemory / (1024 * 1024)).toFixed(2),
      totalMemoryUsageMB: ((totalBytes + chunkMemory) / (1024 * 1024)).toFixed(
        2
      ),
    };
  }
}

export default ChunkRenderer;
