/*
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-27 16:55:30
 * @LastEditTime: 2025-06-18 11:35:54
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 地图图层相关功能
 * @FilePath: /bic-map-plugin/src/bicMap/core/layers/index.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

import { LAYER_IDS, addLayerWithOrder } from './layerConfig';
import { safeImageLoader } from '../utils/loaders';
import mapUtils from '../utils/mapUtils';

/**
 * 加载SLAM地图
 * @param {Object} map - 地图实例
 * @param {Object} options - 地图配置选项
 * @param {number} options.startX - 起始X坐标
 * @param {number} options.startY - 起始Y坐标
 * @param {number} options.xGridCount - X轴网格数量
 * @param {number} options.yGridCount - Y轴网格数量
 * @param {number} options.resolution - 地图分辨率（米/像素）
 * @param {string} options.imagePath - 地图图片路径
 * @param {string} options.canvasId - 画布ID，默认为'canvasMap'
 * @param {boolean} options.fitBounds - 是否自动调整视图以适应地图，默认为true
 * @param {Object} options.padding - 地图边距，默认为各边30像素
 * @param {number} options.zoomFactor - 缩放因子，用于高缩放级别的精细调整，默认为1.0
 * @returns {Promise<Object>} 包含缓存的相机边界和其他相关信息的对象
 */
export async function loadSlamMap(map, options) {
  if (!map) {
    throw new Error('地图未初始化。');
  }
  
  const {
    startX,
    startY,
    xGridCount,
    yGridCount,
    resolution,
    imagePath,
    canvasId = 'canvasMap',
    fitBounds = true,
    padding = { top: 30, bottom: 30, left: 30, right: 30 },
    zoomFactor = 2
  } = options;
  
  // 确保canvas元素存在
  let canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.log(`未找到ID为'${canvasId}'的Canvas，正在创建.`);
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
  } else {
    console.log(`使用已存在的ID为'${canvasId}'的Canvas`);
  }
  
  try {
    // 使用MapUtils计算角点位置
    const corners = mapUtils.getMapCorners({
      startX,
      startY,
      xGridCount,
      yGridCount,
      resolution
    });
    
    const upperLeftPos = corners.topLeft;
    const upperRightPos = corners.topRight;
    const lowerRightPos = corners.bottomRight;
    const lowerLeftPos = corners.bottomLeft;
    
    // 设置canvas
    const context = canvas.getContext('2d');
    canvas.width = xGridCount;
    canvas.height = yGridCount;
    
    // 加载图片
    let img;
    try {
      console.log('尝试加载SLAM地图图片:', imagePath);
      // 使用安全图片加载器处理本地和网络图片
      img = await safeImageLoader(imagePath);
      
      // 在canvas上绘制图片
      context.drawImage(img, 0, 0, xGridCount, yGridCount);
    } catch (error) {
      console.error('加载图片失败，尝试创建应急地图:', error);
      
      // 创建一个默认的应急地图图片
      context.fillStyle = '#808080';
      context.fillRect(0, 0, xGridCount, yGridCount);
      
      // 添加网格
      context.strokeStyle = '#cccccc';
      context.lineWidth = 0.2;
      
      // 每隔10像素绘制网格线
      const gridSpacing = 10;
      for (let x = 0; x <= xGridCount; x += gridSpacing) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, yGridCount);
        context.stroke();
      }
      
      for (let y = 0; y <= yGridCount; y += gridSpacing) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(xGridCount, y);
        context.stroke();
      }
      
      // 添加错误提示
      context.fillStyle = 'red';
      context.font = '12px Arial';
      context.textAlign = 'center';
      context.fillText('地图图片加载失败', xGridCount / 2, yGridCount / 2 - 10);
      context.fillText(imagePath.substring(0, 40) + '...', xGridCount / 2, yGridCount / 2 + 10);
      
      console.warn('已使用应急地图替代原图片');
      // 不抛出错误，继续使用应急地图
    }
    
    // 定义坐标转换函数
    const toLonLat = (coords) => {
      const gpsCoords = mapUtils.cartesianToGPS({
        x: coords[0],
        y: coords[1],
        scale: resolution,
        zoomFactor: zoomFactor
      });
      
      return [gpsCoords.longitude, gpsCoords.latitude];
    };
    
    // 转换笛卡尔坐标为GPS坐标
    const defaultLeftTop = toLonLat([upperLeftPos.x, upperLeftPos.y]);
    const defaultTopRight = toLonLat([upperRightPos.x, upperRightPos.y]);
    const defaultRightBottom = toLonLat([lowerRightPos.x, lowerRightPos.y]);
    const defaultLeftBottom = toLonLat([lowerLeftPos.x, lowerLeftPos.y]);
    
    // 添加或更新canvas源
    let canvasSource = map.getSource('scanCanvasSource');
    
    if (!canvasSource) {
      map.addSource('scanCanvasSource', {
        type: 'canvas',
        canvas: canvasId,
        animate: true,
        coordinates: [defaultLeftTop, defaultTopRight, defaultRightBottom, defaultLeftBottom]
      });
      
      // 添加canvas图层
      addLayerWithOrder(map, {
        id: LAYER_IDS.CANVAS_MAP,
        type: 'raster',
        source: 'scanCanvasSource',
        minzoom: 0,
        maxzoom: 24
      });
    } else {
      // 如果源已存在，更新坐标
      canvasSource.setCoordinates([defaultLeftTop, defaultTopRight, defaultRightBottom, defaultLeftBottom]);
    }
    
    // 计算相机边界
    const lowerLeftPosLatLng = toLonLat([lowerLeftPos.x, lowerLeftPos.y]);
    const upperRightPosLatLng = toLonLat([upperRightPos.x, upperRightPos.y]);
    
    const cameraBound = map.cameraForBounds([lowerLeftPosLatLng, upperRightPosLatLng], {
      padding
    });
    
    const cacheCameraBound = Object.assign({pitch: 0, bearing: 0}, cameraBound);
    
    // 如果需要自动适应地图，跳转到边界区域
    if (fitBounds) {
      map.jumpTo(cacheCameraBound);
    }
    
    return {
      corners,
      cameraBound: cacheCameraBound,
      coordinates: [defaultLeftTop, defaultTopRight, defaultRightBottom, defaultLeftBottom]
    };
  } catch (error) {
    console.error('加载SLAM地图失败:', error);
    throw error;
  }
} 