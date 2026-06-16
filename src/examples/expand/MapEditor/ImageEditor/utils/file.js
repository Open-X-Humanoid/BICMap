/**
 * 从URL中提取图片格式
 * @param {string} url - 图片URL
 * @returns {string} 图片格式
 */
function getImageFormatFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return 'unknown';
  }
  
  const cleanUrl = url.split('?')[0].split('#')[0];
  const extension = cleanUrl.split('.').pop().toLowerCase();
  
  // 标准化格式名称
  const formatMap = {
    'jpg': 'jpeg',
    'jpeg': 'jpeg', 
    'png': 'png',
    'gif': 'gif',
    'webp': 'webp',
    'svg': 'svg',
    'bmp': 'bmp',
    'ico': 'ico',
    'tiff': 'tiff',
    'tif': 'tiff'
  };
  
  return formatMap[extension] || 'unknown';
}

async function blobToFile(blob, fileName, options = {}) {
  return new File([blob], fileName, {
    type: blob.type,
    lastModified: Date.now(),
    ...options,
  });
}

/**
 * ImageEditor导出图片文件上传到BOS
 * @param {File} file - 图片文件
 * @param {Object} options - 配置选项
 */
async function uploadImageFile(file, options = {}) {
  const {
    objectBase = "images/",
    fileName = null,
    format = "png",
    chunkUploadThreshold = 5,
    onProgress = () => {},
    onSuccess = () => {},
    onError = () => {},
  } = options;

  try {
    // 确保file是有效对象
    if (!file) {
      throw new Error("文件对象为空");
    }

    // 检查BOS上传服务是否可用
    if (
      !window.$bosUpload ||
      !window.$bosUpload.client ||
      !window.$bosUpload.bosConfig
    ) {
      throw new Error("BOS上传服务未正确初始化");
    }
    // 获取存储桶信息
    const bucket = window.$bosUpload.bosConfig.bucket;

    if (!bucket) {
      throw new Error("BOS配置缺少bucket信息");
    }

    const objectPath = `${objectBase}${file.name}`;

    // 生成文件名
    const timestamp = Date.now();
    const finalFileName = fileName || `canvas_${timestamp}.${format}`;

    // 根据文件大小选择上传方式
    const fileSizeMB = file.size / 1024 / 1024;

    if (fileSizeMB > chunkUploadThreshold) {
      // 分片上传
      return new Promise((resolve, reject) => {
        window.$bosUpload
          .uploadFile(
            objectPath,
            file,
            (progressInfo) => {
              if (progressInfo?.progress) {
                const percent = Math.floor(progressInfo.progress * 100);
                onProgress({ percent, progressInfo });
              }
            },
            (state, data, fileInfo) => {
              if (state === "completed") {
                const result = {
                  url: fileInfo?.url,
                  md5: fileInfo?.md5,
                  size: file.size,
                  fileName: finalFileName,
                  objectPath,
                };
                onSuccess(result);
                resolve(result);
              } else if (state === "failed") {
                onError(data);
                reject(data);
              }
            }
          )
          .catch(reject);
      });
    } else {
      // 普通上传
      const result = await window.$bosUpload.uploadFileSimple(objectPath, file);
      const uploadResult = {
        url: result?.url,
        md5: result?.md5,
        size: file.size,
        fileName: finalFileName,
        objectPath,
      };
      onSuccess(uploadResult);
      return uploadResult;
    }
  } catch (error) {
    console.error("Canvas Blob上传失败:", error);
    onError(error);
    throw error;
  }
}

export { blobToFile, uploadImageFile, getImageFormatFromUrl };
