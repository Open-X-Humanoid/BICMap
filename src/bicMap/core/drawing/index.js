import * as turfLib from '@turf/turf';

import { LAYER_IDS, addLayerWithOrder } from '../layers/layerConfig';

/**
 * 向地图添加矩形绘制模式（支持桌面端鼠标和移动端触摸）
 * @param {Object} map - 地图实例
 * @param {Object} turf - turf.js实例
 * @param {Object} options - 绘制选项
 * @param {string} options.fillColor - 矩形填充颜色，默认为'#088'
 * @param {number} options.fillOpacity - 矩形填充透明度，默认为0.5
 * @param {string} options.lineColor - 矩形轮廓颜色，默认为'#044'
 * @param {number} options.lineWidth - 矩形轮廓宽度，默认为2
 * @param {Function} options.onDrawComplete - 绘制完成回调，接收GeoJSON矩形作为参数
 * @param {boolean} options.enableTouch - 是否启用触摸支持，默认为true
 * @returns {Object} 包含启用/禁用方法的绘制控制器
 */
export function enableRectangleDrawing(turf, map, options = {}) {
  if (!map || !turf) {
    throw new Error('地图或Turf库未初始化。');
  }
  
  const {
    fillColor = '#088',
    fillOpacity = 0.5,
    lineColor = '#044',
    lineWidth = 2,
    onDrawComplete = null,
    enableTouch = true
  } = options;
  
  // 绘制状态
  let isDrawing = false;
  let startPoint = null;
  let rectangle = null;
  let currentRectangle = null;
  
  // 触摸状态
  let activeTouches = 0;
  let lastSingleTouch = null;
  let isMapDraggingDisabled = false;
  
  // 源和图层ID
  const sourceId = 'rectangle-draw-source';
  const fillLayerId = LAYER_IDS.RECTANGLE_DRAW_FILL;
  const lineLayerId = LAYER_IDS.RECTANGLE_DRAW_LINE;
  
  // 初始化空数据源
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
    
    // 添加填充图层
    addLayerWithOrder(map, {
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': fillColor,
        'fill-opacity': fillOpacity,
        'fill-outline-color': lineColor
      }
    });
    
    // 添加线图层
    addLayerWithOrder(map, {
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': lineColor,
        'line-width': lineWidth,
        'line-opacity': 1
      }
    });
  }
  
  // 从两点创建矩形
  const createRectangle = (point1, point2) => {
    // 获取点的坐标
    const minX = Math.min(point1[0], point2[0]);
    const maxX = Math.max(point1[0], point2[0]);
    const minY = Math.min(point1[1], point2[1]);
    const maxY = Math.max(point1[1], point2[1]);
    
    // 创建矩形角点
    const coordinates = [
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY]
      ]
    ];
    
    // 使用turf创建多边形
    return turf.polygon(coordinates);
  };
  
  // 更新绘制
  const updateRectangle = (currentPoint) => {
    if (!startPoint) return;
    
    // 从起点到当前点创建矩形
    currentRectangle = createRectangle(startPoint, currentPoint);
    
    // 更新数据源
    const source = map.getSource(sourceId);
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: [currentRectangle]
      });
    }
  };
  
  // 工具函数：获取触摸点的地理坐标
  const getTouchLngLat = (touch) => {
    const rect = map.getContainer().getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    return map.unproject([x, y]);
  };
  
  // 触摸事件处理器
  const handleTouchStart = (e) => {
    if (!enableTouch) return;
    
    e.preventDefault();
    activeTouches = e.touches.length;
    
    if (activeTouches === 1) {
      // 单指触摸：开始绘制矩形
      const touch = e.touches[0];
      const lngLat = getTouchLngLat(touch);
      lastSingleTouch = touch;
      
      isDrawing = true;
      startPoint = [lngLat.lng, lngLat.lat];
      
      // 禁用地图拖拽
      if (!isMapDraggingDisabled) {
        map.dragPan.disable();
        isMapDraggingDisabled = true;
      }
    } else if (activeTouches >= 2) {
      // 双指或多指触摸：停止绘制，启用地图拖拽
      if (isDrawing) {
        isDrawing = false;
        startPoint = null;
      }
      
      if (isMapDraggingDisabled) {
        map.dragPan.enable();
        isMapDraggingDisabled = false;
      }
    }
  };
  
  const handleTouchMove = (e) => {
    if (!enableTouch) return;
    
    e.preventDefault();
    activeTouches = e.touches.length;
    
    if (activeTouches === 1 && isDrawing) {
      // 单指移动：更新矩形绘制
      const touch = e.touches[0];
      const lngLat = getTouchLngLat(touch);
      const currentPoint = [lngLat.lng, lngLat.lat];
      updateRectangle(currentPoint);
    }
  };
  
  const handleTouchEnd = (e) => {
    if (!enableTouch) return;
    
    e.preventDefault();
    
    // 获取结束时的触摸点（从changedTouches获取刚离开的触摸点）
    let endTouch = null;
    if (e.changedTouches && e.changedTouches.length > 0) {
      endTouch = e.changedTouches[0];
    }
    
    activeTouches = e.touches.length;
    
    if (activeTouches === 0) {
      // 所有手指离开
      if (isDrawing && startPoint && endTouch) {
        // 完成矩形绘制
        const lngLat = getTouchLngLat(endTouch);
        const endPoint = [lngLat.lng, lngLat.lat];
        
        // 移动端优化：只要绘制出了矩形就触发回调
        const deltaX = Math.abs(startPoint[0] - endPoint[0]);
        const deltaY = Math.abs(startPoint[1] - endPoint[1]);
        
        // 检查数据源中是否有矩形数据（说明用户确实绘制了矩形）
        const source = map.getSource(sourceId);
        const hasRectangleData = source && source._data && source._data.features && source._data.features.length > 0;
        
        // 条件：要么满足最小阈值，要么数据源中有矩形（移动端容错）
        if ((deltaX > 0.000001 || deltaY > 0.000001) || hasRectangleData) {
          rectangle = createRectangle(startPoint, endPoint);
          
          // 提取角点坐标
          const coordinates = rectangle.geometry.coordinates[0];
          const corners = {
            northWest: coordinates[0], // 左上
            northEast: coordinates[1], // 右上
            southEast: coordinates[2], // 右下
            southWest: coordinates[3]  // 左下
          };
          
          // 调用完成回调
          if (onDrawComplete && typeof onDrawComplete === 'function') {
            onDrawComplete(rectangle, corners);
          }
        }
      }
      
      // 重置状态
      isDrawing = false;
      startPoint = null;
      lastSingleTouch = null;
      
      // 恢复地图拖拽
      if (isMapDraggingDisabled) {
        map.dragPan.enable();
        isMapDraggingDisabled = false;
      }
    } else if (activeTouches >= 2 && isDrawing) {
      // 如果变成双指，停止绘制但不完成矩形
      isDrawing = false;
      startPoint = null;
      lastSingleTouch = null;
      
      // 清除当前绘制
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    }
  };
  
  // 鼠标事件处理器
  const handleMouseDown = (e) => {
    // 仅在左键点击时开始绘制
    if (e.originalEvent.button !== 0) return;
    
    isDrawing = true;
    startPoint = [e.lngLat.lng, e.lngLat.lat];
    
    // 更改光标
    map.getCanvas().style.cursor = 'crosshair';
    
    // 阻止默认行为
    e.preventDefault();
  };
  
  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    
    const currentPoint = [e.lngLat.lng, e.lngLat.lat];
    updateRectangle(currentPoint);
  };
  
  const handleMouseUp = (e) => {
    if (!isDrawing) return;
    
    const endPoint = [e.lngLat.lng, e.lngLat.lat];
    
    // 仅当矩形有面积（不仅仅是一个点）时完成矩形
    if (startPoint[0] !== endPoint[0] && startPoint[1] !== endPoint[1]) {
      rectangle = createRectangle(startPoint, endPoint);
      
      // 提取角点坐标以便访问
      const coordinates = rectangle.geometry.coordinates[0];
      const corners = {
        northWest: coordinates[0], // 左上
        northEast: coordinates[1], // 右上
        southEast: coordinates[2], // 右下
        southWest: coordinates[3]  // 左下
      };
      
      // 调用完成回调并传入最终矩形和角点
      if (onDrawComplete && typeof onDrawComplete === 'function') {
        onDrawComplete(rectangle, corners);
      }
    }
    
    // 重置绘制状态
    isDrawing = false;
    startPoint = null;
    
    // 恢复光标
    map.getCanvas().style.cursor = '';
  };
  
  // 启用绘制模式
  const enable = () => {
    // 鼠标事件
    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
    
    // 触摸事件
    if (enableTouch) {
      const canvas = map.getCanvas();
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false }); // 处理触摸取消
    }
    
    // 更改光标以指示绘制模式
    map.getCanvas().style.cursor = 'crosshair';
  };
  
  // 禁用绘制模式
  const disable = () => {
    // 移除鼠标事件
    map.off('mousedown', handleMouseDown);
    map.off('mousemove', handleMouseMove);
    map.off('mouseup', handleMouseUp);
    
    // 移除触摸事件
    if (enableTouch) {
      const canvas = map.getCanvas();
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    }
    
    // 恢复地图拖拽
    if (isMapDraggingDisabled) {
      map.dragPan.enable();
      isMapDraggingDisabled = false;
    }
    
    // 重置状态
    isDrawing = false;
    startPoint = null;
    lastSingleTouch = null;
    activeTouches = 0;
    
    // 重置光标
    map.getCanvas().style.cursor = '';
    
    // 清除绘制
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  };
  
  // 自动启用绘制
  enable();
  
  // 返回控制器对象
  return {
    enable,
    disable,
    getDrawing: () => rectangle,
    clearDrawing: () => {
      rectangle = null;
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    }
  };
}

/**
 * 向地图添加多边形绘制模式（支持桌面端鼠标和移动端触摸）
 * @param {Object} map - 地图实例
 * @param {Object} turf - turf.js实例
 * @param {Object} options - 绘制选项
 * @param {string} options.fillColor - 多边形填充颜色，默认为'#088'
 * @param {number} options.fillOpacity - 多边形填充透明度，默认为0.5
 * @param {string} options.lineColor - 多边形轮廓颜色，默认为'#044'
 * @param {number} options.lineWidth - 多边形轮廓宽度，默认为2
 * @param {string} options.pointColor - 顶点颜色，默认为'#ff0000'
 * @param {number} options.pointRadius - 顶点半径，默认为5
 * @param {Function} options.onDrawComplete - 绘制完成回调，接收GeoJSON多边形作为参数
 * @param {boolean} options.enableTouch - 是否启用触摸支持，默认为true
 * @param {number} options.minPoints - 最少点数，默认为3
 * @returns {Object} 包含启用/禁用方法的绘制控制器
 */
export function enablePolygonDrawing(turf, map, options = {}) {
  if (!map || !turf) {
    throw new Error('地图或Turf库未初始化。');
  }
  
  const {
    fillColor = '#088',
    fillOpacity = 0.5,
    lineColor = '#044',
    lineWidth = 2,
    pointColor = '#ff0000',
    pointRadius = 5,
    onDrawComplete = null,
    enableTouch = true,
    minPoints = 3
  } = options;
  
  // 绘制状态
  let isDrawing = false;
  let points = []; // 存储多边形的所有顶点
  let currentPolygon = null;
  let polygon = null;
  
  // 触摸状态
  let lastTouchTime = 0;
  let lastTouchPoint = null;
  
  // 源和图层ID
  const sourceId = 'polygon-draw-source';
  const pointsSourceId = 'polygon-draw-points-source';
  const fillLayerId = LAYER_IDS.POLYGON_DRAW_FILL;
  const lineLayerId = LAYER_IDS.POLYGON_DRAW_LINE;
  const pointsLayerId = LAYER_IDS.POLYGON_DRAW_POINTS;
  
  // 初始化数据源
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
    
    // 添加填充图层
    addLayerWithOrder(map, {
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': fillColor,
        'fill-opacity': fillOpacity,
        'fill-outline-color': lineColor
      }
    });
    
    // 添加线图层
    addLayerWithOrder(map, {
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': lineColor,
        'line-width': lineWidth,
        'line-opacity': 1
      }
    });
  }
  
  // 初始化顶点数据源
  if (!map.getSource(pointsSourceId)) {
    map.addSource(pointsSourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
    
    // 添加顶点图层
    addLayerWithOrder(map, {
      id: pointsLayerId,
      type: 'circle',
      source: pointsSourceId,
      paint: {
        'circle-radius': pointRadius,
        'circle-color': pointColor,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
  }
  
  // 更新顶点显示
  const updatePoints = () => {
    const pointFeatures = points.map(coord => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coord
      }
    }));
    
    const source = map.getSource(pointsSourceId);
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: pointFeatures
      });
    }
  };
  
  // 更新多边形显示
  const updatePolygon = (currentPoint = null) => {
    if (points.length < 2) return;
    
    // 创建临时坐标数组
    let coords = [...points];
    if (currentPoint) {
      coords.push(currentPoint);
    }
    
    // 如果有足够的点，创建多边形
    if (coords.length >= 2) {
      // 对于线段（少于3个点），使用LineString
      if (coords.length < 3) {
        currentPolygon = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: coords
          }
        };
      } else {
        // 闭合多边形
        const closedCoords = [...coords, coords[0]];
        currentPolygon = turf.polygon([closedCoords]);
      }
      
      // 更新数据源
      const source = map.getSource(sourceId);
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [currentPolygon]
        });
      }
    }
  };
  
  // 检查是否点击在起点附近（用于闭合多边形）
  const isNearFirstPoint = (point) => {
    if (points.length < minPoints) return false;
    
    const firstPoint = points[0];
    const distance = Math.sqrt(
      Math.pow(point[0] - firstPoint[0], 2) + 
      Math.pow(point[1] - firstPoint[1], 2)
    );
    
    // 使用地图投影转换为像素距离来判断
    const firstPointPixel = map.project(firstPoint);
    const currentPointPixel = map.project(point);
    const pixelDistance = Math.sqrt(
      Math.pow(firstPointPixel.x - currentPointPixel.x, 2) + 
      Math.pow(firstPointPixel.y - currentPointPixel.y, 2)
    );
    
    return pixelDistance < 15; // 15像素的容差
  };
  
  // 完成多边形绘制
  const finishPolygon = () => {
    if (points.length < minPoints) {
      console.warn(`多边形至少需要 ${minPoints} 个点`);
      return false;
    }
    
    // 闭合多边形
    const closedCoords = [...points, points[0]];
    polygon = turf.polygon([closedCoords]);
    
    // 计算多边形信息
    const polygonInfo = {
      area: turf.area(polygon) / 1000000, // 平方公里
      perimeter: turf.length(turf.polygonToLine(polygon), { units: 'kilometers' }),
      center: turf.center(polygon).geometry.coordinates,
      points: points,
      pointCount: points.length
    };
    
    // 调用完成回调
    if (onDrawComplete && typeof onDrawComplete === 'function') {
      onDrawComplete(polygon, polygonInfo);
    }
    
    // 重置状态
    isDrawing = false;
    points = [];
    
    return true;
  };
  
  // 鼠标事件处理器
  const handleMouseClick = (e) => {
    // 仅处理左键点击
    if (e.originalEvent.button !== 0) return;
    
    const point = [e.lngLat.lng, e.lngLat.lat];
    
    // 检查是否点击在起点附近（闭合多边形）
    if (isNearFirstPoint(point)) {
      if (finishPolygon()) {
        updatePoints();
        updatePolygon();
      }
      return;
    }
    
    // 添加新点
    points.push(point);
    isDrawing = true;
    
    // 更新显示
    updatePoints();
    updatePolygon();
    
    e.preventDefault();
  };
  
  const handleMouseMove = (e) => {
    if (!isDrawing || points.length === 0) return;
    
    const currentPoint = [e.lngLat.lng, e.lngLat.lat];
    updatePolygon(currentPoint);
  };
  
  const handleMouseDblClick = (e) => {
    if (!isDrawing || points.length < minPoints) return;
    
    e.preventDefault();
    
    // 双击完成绘制
    if (finishPolygon()) {
      updatePoints();
      updatePolygon();
    }
  };
  
  // 触摸事件处理器
  const getTouchLngLat = (touch) => {
    const rect = map.getContainer().getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    return map.unproject([x, y]);
  };
  
  const handleTouchStart = (e) => {
    if (!enableTouch) return;
    
    // 只处理单指触摸
    if (e.touches.length !== 1) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    const lngLat = getTouchLngLat(touch);
    const point = [lngLat.lng, lngLat.lat];
    
    const currentTime = Date.now();
    const timeDiff = currentTime - lastTouchTime;
    
    // 检测双击（两次触摸间隔小于300ms）
    if (timeDiff < 300 && lastTouchPoint) {
      const distance = Math.sqrt(
        Math.pow(point[0] - lastTouchPoint[0], 2) + 
        Math.pow(point[1] - lastTouchPoint[1], 2)
      );
      
      // 如果两次点击位置很近，认为是双击
      if (distance < 0.0001) {
        if (points.length >= minPoints && finishPolygon()) {
          updatePoints();
          updatePolygon();
        }
        lastTouchTime = 0;
        lastTouchPoint = null;
        return;
      }
    }
    
    // 检查是否点击在起点附近（闭合多边形）
    if (isNearFirstPoint(point)) {
      if (finishPolygon()) {
        updatePoints();
        updatePolygon();
      }
      return;
    }
    
    // 添加新点
    points.push(point);
    isDrawing = true;
    
    // 更新显示
    updatePoints();
    updatePolygon();
    
    lastTouchTime = currentTime;
    lastTouchPoint = point;
  };
  
  const handleTouchMove = (e) => {
    if (!enableTouch) return;
    
    // 只处理单指触摸
    if (e.touches.length !== 1) return;
    if (!isDrawing || points.length === 0) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    const lngLat = getTouchLngLat(touch);
    const currentPoint = [lngLat.lng, lngLat.lat];
    updatePolygon(currentPoint);
  };
  
  // 按键事件处理器（支持Esc取消，Enter完成）
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      // 取消绘制
      points = [];
      isDrawing = false;
      updatePoints();
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    } else if (e.key === 'Enter') {
      // 完成绘制
      if (points.length >= minPoints && finishPolygon()) {
        updatePoints();
        updatePolygon();
      }
    }
  };
  
  // 启用绘制模式
  const enable = () => {
    // 鼠标事件
    map.on('click', handleMouseClick);
    map.on('mousemove', handleMouseMove);
    map.on('dblclick', handleMouseDblClick);
    
    // 触摸事件
    if (enableTouch) {
      const canvas = map.getCanvas();
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    
    // 键盘事件
    document.addEventListener('keydown', handleKeyDown);
    
    // 更改光标以指示绘制模式
    map.getCanvas().style.cursor = 'crosshair';
  };
  
  // 禁用绘制模式
  const disable = () => {
    // 移除鼠标事件
    map.off('click', handleMouseClick);
    map.off('mousemove', handleMouseMove);
    map.off('dblclick', handleMouseDblClick);
    
    // 移除触摸事件
    if (enableTouch) {
      const canvas = map.getCanvas();
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
    }
    
    // 移除键盘事件
    document.removeEventListener('keydown', handleKeyDown);
    
    // 重置状态
    isDrawing = false;
    points = [];
    lastTouchTime = 0;
    lastTouchPoint = null;
    
    // 重置光标
    map.getCanvas().style.cursor = '';
    
    // 清除绘制
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData({
        type: 'FeatureCollection',
        features: []
      });
    }
    if (map.getSource(pointsSourceId)) {
      map.getSource(pointsSourceId).setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  };
  
  // 自动启用绘制
  enable();
  
  // 返回控制器对象
  return {
    enable,
    disable,
    getDrawing: () => polygon,
    getPoints: () => points,
    clearDrawing: () => {
      polygon = null;
      points = [];
      isDrawing = false;
      updatePoints();
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      if (map.getSource(pointsSourceId)) {
        map.getSource(pointsSourceId).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    },
    finishDrawing: () => {
      if (points.length >= minPoints) {
        return finishPolygon();
      }
      return false;
    }
  };
}

/**
 * 向地图添加圆形绘制模式（支持桌面端鼠标和移动端触摸）
 * 交互：按下确定圆心，拖拽确定半径，松开完成。
 * @param {Object} turf - turf.js实例
 * @param {Object} map - 地图实例
 * @param {Object} options - 绘制选项
 * @param {string} options.fillColor - 圆形填充颜色
 * @param {number} options.fillOpacity - 圆形填充透明度
 * @param {string} options.lineColor - 圆形轮廓颜色
 * @param {number} options.lineWidth - 圆形轮廓宽度
 * @param {Function} options.onDrawComplete - 绘制完成回调，接收(GeoJSON Polygon(circle), info)
 * @param {boolean} options.enableTouch - 是否启用触摸支持
 * @returns {Object} 绘制控制器
 */
export function enableCircleDrawing(turf, map, options = {}) {
  // 已升级为 circle layer 版本：点 + circle-radius（像素）
  // 保留函数名仅用于兼容旧调用方；内部转发到 enableCircleRadiusDrawing
  if (!map) {
    throw new Error('地图未初始化。');
  }
  return enableCircleRadiusDrawing(map, options);

  // 解构绘制样式与回调；均带默认值，避免调用方漏传
  const {
    fillColor = '#088', // 填充色
    fillOpacity = 0.2, // 填充不透明度
    lineColor = '#044', // 边线色
    lineWidth = 2, // 边线宽度（px）
    onDrawComplete = null, // 完成一次绘制后的回调
    enableTouch = true // 是否监听触摸（移动端单指画圆）
  } = options;

  /** 是否处于一次「按下—拖拽—松开」流程中（鼠标或触摸共用） */
  let isDrawing = false;
  /** 当前圆心 [lng, lat]，仅在拖拽过程中有效 */
  let centerPoint = null;
  /** 最后一次完成绘制得到的多边形（业务侧可通过 getDrawing 读取） */
  let circlePolygon = null;
  /** 当前预览或刚完成的几何（GeoJSON Polygon） */
  let currentCircle = null;

  /** 当前触摸点数量，用于区分单指 / 多指 */
  let activeTouches = 0;
  /** 单指绘制时是否临时关闭了地图拖拽，需在结束时恢复 */
  let isMapDraggingDisabled = false;

  /** GeoJSON 数据源 id，与图层共用 */
  const sourceId = 'circle-draw-source';
  /** 填充图层 id（来自统一图层顺序配置） */
  const fillLayerId = LAYER_IDS.CIRCLE_DRAW_FILL;
  /** 线图层 id */
  const lineLayerId = LAYER_IDS.CIRCLE_DRAW_LINE;

  /** 完成绘制时允许的最小像素半径，避免纯点击产生无效圆 */
  const MIN_FINISH_RADIUS_PX = 3;
  /** 完成绘制时允许的最小地理半径（米），与 MIN_FINISH_RADIUS_PX 双保险 */
  const MIN_FINISH_RADIUS_M = 0.02;

  /** 圆周近似时每段的目标弧长（像素），越小越圆滑，顶点越多 */
  const CIRCLE_PIXELS_PER_EDGE = 1.0;
  /** 段数下限：极小圆也保持足够细分，避免肉眼可见棱角 */
  const CIRCLE_STEPS_MIN = 72;
  /** 段数上限：大圆 / 高缩放时放开顶点数以削弱棱边（过高会增加 GeoJSON 与 GPU 负担） */
  const CIRCLE_STEPS_MAX = 720;

  /**
   * 按像素半径自适应采样段数：圆周长约 2π·rPx，按 CIRCLE_PIXELS_PER_EDGE 估算边数，限制在 [CIRCLE_STEPS_MIN, CIRCLE_STEPS_MAX]
   * @param {number} rPx 像素半径
   * @returns {number} 顶点个数（不含首尾闭合重复点）
   */
  const computeStepsForPixelRadius = (rPx) => {
    const circumferencePx = 2 * Math.PI * rPx;
    const byEdge = Math.ceil(circumferencePx / CIRCLE_PIXELS_PER_EDGE);
    return Math.min(CIRCLE_STEPS_MAX, Math.max(CIRCLE_STEPS_MIN, byEdge));
  };

  /**
   * 清空圆图层数据源（取消过小的拖拽或 reset 时用）
   */
  const clearCircleSource = () => {
    const source = map.getSource(sourceId);
    if (source) {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  };

  // 首次进入时注册数据源与填充、线图层；若已存在则跳过，避免重复 add
  if (!map.getSource(sourceId)) {
    // 矢量数据源，后续 setData 更新圆多边形
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    // 填充圆内部
    addLayerWithOrder(map, {
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': fillColor,
        'fill-opacity': fillOpacity,
        'fill-outline-color': lineColor
      }
    });

    // 描边（比 fill-outline 更易控制线宽）
    addLayerWithOrder(map, {
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': lineColor,
        'line-width': lineWidth,
        'line-opacity': 1
      }
    });
  }

  /**
   * 根据圆心与当前指针位置更新预览多边形
   * 几何在「屏幕像素平面」为圆，再 unproject 为 lng/lat，保证视觉上为圆（非经纬度平面圆）
   * @param {[number, number]} currentPoint 当前拖拽点 [lng, lat]
   */
  const updateCircle = (currentPoint) => {
    // 无圆心或当前点则无法构造
    if (!centerPoint || !currentPoint) return;

    // 圆心、当前点投影到屏幕像素坐标
    const cPx = map.project(centerPoint);
    const pPx = map.project(currentPoint);
    // 像素平面半径（与拖拽终点在屏幕上的距离一致）
    const rPx = Math.hypot(pPx.x - cPx.x, pPx.y - cPx.y);
    // 无效半径则不做绘制
    if (!Number.isFinite(rPx) || rPx <= 0) return;

    // 按像素周长决定顶点数，减轻放大后「多边形感」
    const STEPS = computeStepsForPixelRadius(rPx);

    const coords = [];
    // 在像素平面绕圆心均匀取角度采样
    for (let i = 0; i < STEPS; i++) {
      const a = (i * Math.PI * 2) / STEPS;
      const x = cPx.x + Math.cos(a) * rPx;
      const y = cPx.y + Math.sin(a) * rPx;
      const lngLat = map.unproject([x, y]);
      coords.push([lngLat.lng, lngLat.lat]);
    }
    // GeoJSON 闭合环：首尾坐标相同
    coords.push(coords[0]);
    currentCircle = turf.polygon([coords]);

    const source = map.getSource(sourceId);
    if (source) {
      source.setData({ type: 'FeatureCollection', features: [currentCircle] });
    }
  };

  /**
   * 拖拽结束：固化多边形并回调面积等信息
   * 面积/周长采用与「半径」一致的圆公式（πr²、2πr），避免折线累加 turf.area 与 turf.distance 半径不对齐
   * @param {[number, number]} endPoint 松开位置 [lng, lat]
   * @returns {boolean} 是否视为完成了一次有效绘制
   */
  const finishCircle = (endPoint) => {
    // 参数不齐直接失败
    if (!centerPoint || !endPoint) return false;

    // 先生成与预览一致的几何
    updateCircle(endPoint);
    circlePolygon = currentCircle;
    if (!circlePolygon) return false;

    // 用像素半径过滤「几乎未拖动」的mouseup，并清空预览
    const cPx = map.project(centerPoint);
    const pPx = map.project(endPoint);
    const rPx = Math.hypot(pPx.x - cPx.x, pPx.y - cPx.y);
    if (!Number.isFinite(rPx) || rPx < MIN_FINISH_RADIUS_PX) {
      clearCircleSource();
      currentCircle = null;
      circlePolygon = null;
      isDrawing = false;
      centerPoint = null;
      return false;
    }

    /** 圆心到终点的地面距离（米），作为圆的标称半径 */
    let radius = 0;
    try {
      radius = turf.distance(turf.point(centerPoint), turf.point(endPoint), { units: 'meters' });
    } catch (e) {
      radius = 0;
    }
    if (radius < MIN_FINISH_RADIUS_M) {
      clearCircleSource();
      currentCircle = null;
      circlePolygon = null;
      isDrawing = false;
      centerPoint = null;
      return false;
    }

    /** 与 radius 一致的圆面积（㎡）；室内/城市尺度下与 turf 多边形面积误差可忽略 */
    const area = Math.PI * radius * radius;
    /** 与 radius 一致的圆周长（m） */
    const perimeter = 2 * Math.PI * radius;
    /** 中心仍取绘制时的圆心坐标 */
    const center = centerPoint;

    const info = {
      area,
      perimeter,
      center,
      radius
    };

    if (onDrawComplete && typeof onDrawComplete === 'function') {
      onDrawComplete(circlePolygon, info);
    }

    isDrawing = false;
    centerPoint = null;
    return true;
  };

  /** 鼠标左键按下：记录圆心并开始绘制态 */
  const handleMouseDown = (e) => {
    // 仅响应主键（左键）
    if (e.originalEvent.button !== 0) return;
    isDrawing = true;
    centerPoint = [e.lngLat.lng, e.lngLat.lat];
    map.getCanvas().style.cursor = 'crosshair';
    e.preventDefault();
  };

  /** 鼠标移动：拖拽中刷新预览圆 */
  const handleMouseMove = (e) => {
    if (!isDrawing || !centerPoint) return;
    updateCircle([e.lngLat.lng, e.lngLat.lat]);
  };

  /** 鼠标松开：结束本次绘制并尝试完成 */
  const handleMouseUp = (e) => {
    if (!isDrawing || !centerPoint) return;
    const endPoint = [e.lngLat.lng, e.lngLat.lat];
    finishCircle(endPoint);
    map.getCanvas().style.cursor = '';
  };

  /** 将触摸点换算为地图经纬度（相对容器左上角 + unproject） */
  const getTouchLngLat = (touch) => {
    const rect = map.getContainer().getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    return map.unproject([x, y]);
  };

  /** 触摸开始：单指按下作为圆心并禁用拖拽以免冲突 */
  const handleTouchStart = (e) => {
    if (!enableTouch) return;
    e.preventDefault();
    activeTouches = e.touches.length;

    if (activeTouches === 1) {
      const touch = e.touches[0];
      const lngLat = getTouchLngLat(touch);
      isDrawing = true;
      centerPoint = [lngLat.lng, lngLat.lat];
      if (!isMapDraggingDisabled) {
        map.dragPan.disable();
        isMapDraggingDisabled = true;
      }
    } else if (activeTouches >= 2) {
      // 双指及以上恢复拖拽（缩放/平移地图）
      if (isMapDraggingDisabled) {
        map.dragPan.enable();
        isMapDraggingDisabled = false;
      }
    }
  };

  /** 触摸移动：单指拖拽更新圆 */
  const handleTouchMove = (e) => {
    if (!enableTouch) return;
    e.preventDefault();
    activeTouches = e.touches.length;
    if (activeTouches === 1 && isDrawing && centerPoint) {
      const touch = e.touches[0];
      const lngLat = getTouchLngLat(touch);
      updateCircle([lngLat.lng, lngLat.lat]);
    }
  };

  /** 触摸结束：单指抬起则完成圆；若无剩余触点则恢复拖拽 */
  const handleTouchEnd = (e) => {
    if (!enableTouch) return;
    e.preventDefault();

    const changed = e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : null;
    activeTouches = e.touches.length;

    if (activeTouches === 0) {
      if (isDrawing && centerPoint && changed) {
        const lngLat = getTouchLngLat(changed);
        finishCircle([lngLat.lng, lngLat.lat]);
      }
      isDrawing = false;
      centerPoint = null;
      if (isMapDraggingDisabled) {
        map.dragPan.enable();
        isMapDraggingDisabled = false;
      }
    }
  };

  /** 绑定地图与画布事件（可重复调用） */
  const enable = () => {
    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);

    if (enableTouch) {
      const canvas = map.getCanvas();
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }
    map.getCanvas().style.cursor = 'crosshair';
  };

  /** 解绑事件并恢复拖拽与光标 */
  const disable = () => {
    map.off('mousedown', handleMouseDown);
    map.off('mousemove', handleMouseMove);
    map.off('mouseup', handleMouseUp);

    if (enableTouch) {
      const canvas = map.getCanvas();
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    }

    if (isMapDraggingDisabled) {
      map.dragPan.enable();
      isMapDraggingDisabled = false;
    }

    isDrawing = false;
    centerPoint = null;
    map.getCanvas().style.cursor = '';
  };

  // 创建控制器后立即启用交互（与原行为一致）
  enable();

  return {
    enable,
    disable,
    getDrawing: () => circlePolygon,
    clearDrawing: () => {
      circlePolygon = null;
      currentCircle = null;
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData({ type: 'FeatureCollection', features: [] });
      }
    }
  };
}

/**
 * 向地图添加圆形绘制模式（circle layer 版本，不使用多边形近似圆）
 * 交互：按下确定圆心，拖拽确定半径（米），松开完成。
 *
 * 注意：MapLibre 的 circle 半径是「像素」，因此内部会根据当前 zoom/纬度将米半径换算为像素半径。
 *
 * @param {Object} map - 地图实例
 * @param {Object} options - 绘制选项
 * @param {string} [options.sourceId] - 临时绘制 source id（建议每个调用方传入唯一前缀，避免互相影响）
 * @param {string} [options.fillLayerId] - 临时填充 layer id
 * @param {string} [options.outlineLayerId] - 临时描边 layer id（stroke-only）
 * @param {string} [options.fillColor='#088']
 * @param {number} [options.fillOpacity=0.2]
 * @param {string} [options.lineColor='#044']
 * @param {number} [options.lineWidth=2]
 * @param {boolean} [options.enableTouch=true]
 * @param {Function} [options.onDrawComplete] - (payload, info) => void，其中 payload={center,radiusM}
 * @returns {Object} controller: enable/disable/clearDrawing
 */
export function enableCircleRadiusDrawing(map, options = {}) {
  if (!map) {
    throw new Error('地图未初始化。');
  }

  const {
    sourceId = `circle-radius-draw-source-${Date.now()}`,
    fillLayerId = `circle-radius-draw-fill-${Date.now()}`,
    outlineLayerId = `circle-radius-draw-outline-${Date.now()}`,
    fillColor = '#088',
    fillOpacity = 0.2,
    lineColor = '#044',
    lineWidth = 2,
    enableTouch = true,
    onDrawStart = null,
    onDrawComplete = null
  } = options;

  const state = {
    enabled: false,
    isPointerDown: false,
    center: null,
    radiusM: 0
  };
  let isMapDraggingDisabled = false;

  const metersPerPixelAtLat = (lat, zoom) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);

  const radiusMetersToPixels = (radiusM, centerLat) => {
    const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 0;
    const mpp = metersPerPixelAtLat(centerLat, zoom);
    if (!Number.isFinite(mpp) || mpp <= 0) return 0;
    return radiusM / mpp;
  };

  const distanceMeters = (aLngLat, bLngLat) => {
    if (turfLib?.distance) {
      try {
        return turfLib.distance(turfLib.point(aLngLat), turfLib.point(bLngLat), { units: 'meters' });
      } catch (e) {
        // fallthrough
      }
    }
    const R = 6371008.8;
    const toRad = (d) => (d * Math.PI) / 180;
    const lat1 = toRad(aLngLat[1]);
    const lat2 = toRad(bLngLat[1]);
    const dLat = lat2 - lat1;
    const dLng = toRad(bLngLat[0] - aLngLat[0]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  };

  const empty = { type: 'FeatureCollection', features: [] };

  const ensureLayers = () => {
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: empty });
    }

    if (!map.getLayer(fillLayerId)) {
      map.addLayer({
        id: fillLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-color': fillColor,
          'circle-opacity': 0,
          'circle-radius': 0
        }
      });
    }

    if (!map.getLayer(outlineLayerId)) {
      map.addLayer({
        id: outlineLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-color': 'rgba(0,0,0,0)',
          'circle-opacity': 0,
          'circle-radius': 0,
          'circle-stroke-color': lineColor,
          'circle-stroke-width': lineWidth,
          'circle-stroke-opacity': 0
        }
      });
    }

    // disable transitions to avoid shrink/fade artifacts
    try {
      map.setPaintProperty(fillLayerId, 'circle-radius-transition', { duration: 0, delay: 0 });
      map.setPaintProperty(fillLayerId, 'circle-opacity-transition', { duration: 0, delay: 0 });
      map.setPaintProperty(outlineLayerId, 'circle-radius-transition', { duration: 0, delay: 0 });
      map.setPaintProperty(outlineLayerId, 'circle-stroke-opacity-transition', { duration: 0, delay: 0 });
    } catch (e) {
      // ignore
    }
  };

  const setCenter = (centerLngLat) => {
    const src = map.getSource(sourceId);
    if (!src?.setData) return;
    src.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: centerLngLat }
        }
      ]
    });
  };

  const setRadiusPx = (radiusM, centerLat) => {
    const px = radiusMetersToPixels(radiusM, centerLat);
    const r = Number.isFinite(px) ? Math.max(0, px) : 0;
    if (map.getLayer(fillLayerId)) map.setPaintProperty(fillLayerId, 'circle-radius', r);
    if (map.getLayer(outlineLayerId)) map.setPaintProperty(outlineLayerId, 'circle-radius', r);
  };

  const setVisible = (visible) => {
    const fillO = visible ? fillOpacity : 0;
    const strokeO = visible ? 1 : 0;
    if (map.getLayer(fillLayerId)) map.setPaintProperty(fillLayerId, 'circle-opacity', fillO);
    if (map.getLayer(outlineLayerId)) map.setPaintProperty(outlineLayerId, 'circle-stroke-opacity', strokeO);
  };

  const clear = () => {
    const src = map.getSource(sourceId);
    src?.setData?.(empty);
    state.center = null;
    state.radiusM = 0;
    setRadiusPx(0, 0);
    setVisible(false);
  };

  const getClientPointFromMouseEvent = (e) => {
    if (!e) return null;
    const rect = map.getContainer().getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const getClientPointFromTouchEvent = (e) => {
    const t = e?.touches?.[0] || e?.changedTouches?.[0];
    if (!t) return null;
    const rect = map.getContainer().getBoundingClientRect();
    return [t.clientX - rect.left, t.clientY - rect.top];
  };

  const unprojectClientPoint = (pt) => {
    if (!pt) return null;
    const ll = map.unproject(pt);
    if (!ll || typeof ll.lng !== 'number' || typeof ll.lat !== 'number') return null;
    return [ll.lng, ll.lat];
  };

  const disableDragPanIfNeeded = () => {
    if (map.dragPan && typeof map.dragPan.isEnabled === 'function' && map.dragPan.isEnabled()) {
      map.dragPan.disable();
      isMapDraggingDisabled = true;
    }
  };

  const enableDragPanIfNeeded = () => {
    if (isMapDraggingDisabled && map.dragPan) {
      map.dragPan.enable();
      isMapDraggingDisabled = false;
    }
  };

  const onDownMouse = (e) => {
    if (!state.enabled) return;
    if (e?.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // disable before drag-pan starts consuming move
    disableDragPanIfNeeded();

    const center = unprojectClientPoint(getClientPointFromMouseEvent(e));
    if (!center) return;
    state.isPointerDown = true;
    state.center = center;
    state.radiusM = 0;
    setCenter(center);
    setRadiusPx(0, center[1]);
    setVisible(false);

    if (onDrawStart && typeof onDrawStart === 'function') {
      onDrawStart({ center });
    }
  };

  const onMoveMouse = (e) => {
    if (!state.enabled || !state.isPointerDown) return;
    e.preventDefault();
    if (!state.center) return;
    const cur = unprojectClientPoint(getClientPointFromMouseEvent(e));
    if (!cur) return;
    const r = distanceMeters(state.center, cur);
    state.radiusM = Number.isFinite(r) ? Math.max(0, r) : 0;
    setRadiusPx(state.radiusM, state.center[1]);
    if (state.radiusM > 0) setVisible(true);
  };

  const onUpMouse = () => {
    if (!state.enabled || !state.isPointerDown) return;
    state.isPointerDown = false;
    enableDragPanIfNeeded();
    if (!state.center || state.radiusM <= 0) {
      clear();
      return;
    }
    const payload = { center: state.center, radiusM: state.radiusM };
    const info = {
      center: state.center,
      radius: state.radiusM,
      area: Math.PI * state.radiusM * state.radiusM,
      perimeter: 2 * Math.PI * state.radiusM
    };
    clear();
    if (onDrawComplete && typeof onDrawComplete === 'function') {
      onDrawComplete(payload, info);
    }
  };

  const onZoom = () => {
    if (!state.center || state.radiusM <= 0) return;
    setRadiusPx(state.radiusM, state.center[1]);
  };

  const onDownTouch = (e) => {
    if (!state.enabled || !enableTouch) return;
    // only single touch draws circle
    if (e.touches && e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();

    disableDragPanIfNeeded();

    const center = unprojectClientPoint(getClientPointFromTouchEvent(e));
    if (!center) return;
    state.isPointerDown = true;
    state.center = center;
    state.radiusM = 0;
    setCenter(center);
    setRadiusPx(0, center[1]);
    setVisible(false);

    if (onDrawStart && typeof onDrawStart === 'function') {
      onDrawStart({ center });
    }
  };

  const onMoveTouch = (e) => {
    if (!state.enabled || !enableTouch || !state.isPointerDown) return;
    if (e.touches && e.touches.length !== 1) return;
    e.preventDefault();
    if (!state.center) return;
    const cur = unprojectClientPoint(getClientPointFromTouchEvent(e));
    if (!cur) return;
    const r = distanceMeters(state.center, cur);
    state.radiusM = Number.isFinite(r) ? Math.max(0, r) : 0;
    setRadiusPx(state.radiusM, state.center[1]);
    if (state.radiusM > 0) setVisible(true);
  };

  const onUpTouch = (e) => {
    if (!state.enabled || !enableTouch || !state.isPointerDown) return;
    e.preventDefault();
    state.isPointerDown = false;
    enableDragPanIfNeeded();

    if (!state.center || state.radiusM <= 0) {
      clear();
      return;
    }
    const payload = { center: state.center, radiusM: state.radiusM };
    const info = {
      center: state.center,
      radius: state.radiusM,
      area: Math.PI * state.radiusM * state.radiusM,
      perimeter: 2 * Math.PI * state.radiusM
    };
    clear();
    if (onDrawComplete && typeof onDrawComplete === 'function') {
      onDrawComplete(payload, info);
    }
  };

  const bind = () => {
    map.on('zoom', onZoom);

    const canvas = map.getCanvas();
    // capture:true so we can disable dragPan before MapLibre starts handling drag
    canvas.addEventListener('mousedown', onDownMouse, { capture: true });
    window.addEventListener('mousemove', onMoveMouse, { passive: false });
    window.addEventListener('mouseup', onUpMouse, { passive: true });

    if (enableTouch) {
      canvas.addEventListener('touchstart', onDownTouch, { passive: false, capture: true });
      canvas.addEventListener('touchmove', onMoveTouch, { passive: false });
      canvas.addEventListener('touchend', onUpTouch, { passive: false });
      canvas.addEventListener('touchcancel', onUpTouch, { passive: false });
    }
  };

  const unbind = () => {
    map.off('zoom', onZoom);

    const canvas = map.getCanvas();
    canvas.removeEventListener('mousedown', onDownMouse, { capture: true });
    window.removeEventListener('mousemove', onMoveMouse, { passive: false });
    window.removeEventListener('mouseup', onUpMouse, { passive: true });

    canvas.removeEventListener('touchstart', onDownTouch, { capture: true });
    canvas.removeEventListener('touchmove', onMoveTouch);
    canvas.removeEventListener('touchend', onUpTouch);
    canvas.removeEventListener('touchcancel', onUpTouch);
  };

  ensureLayers();

  const controller = {
    enable() {
      if (state.enabled) return;
      state.enabled = true;
      map.getCanvas().style.cursor = 'crosshair';
      bind();
    },
    disable() {
      if (!state.enabled) return;
      state.enabled = false;
      state.isPointerDown = false;
      unbind();
      clear();
      enableDragPanIfNeeded();
      map.getCanvas().style.cursor = '';
    },
    clearDrawing() {
      clear();
      enableDragPanIfNeeded();
    }
  };

  // 与矩形绘制保持一致：创建后立刻进入可绘制状态
  controller.enable();
  return controller;
}

/**
 * 向地图添加线段绘制模式（支持桌面端鼠标和移动端触摸）
 * @param {Object} map - 地图实例
 * @param {Object} turf - turf.js实例
 * @param {Object} options - 绘制选项
 * @param {string} options.fillColor - 线段填充颜色，默认为'#3388ff'
 * @param {number} options.fillOpacity - 线段填充透明度，默认为0.8
 * @param {string} options.lineColor - 线段轮廓颜色，默认为'#2266cc'
 * @param {number} options.lineWidth - 线段轮廓宽度，默认为2
 * @param {string} options.pointColor - 顶点颜色，默认为'#ff0000'
 * @param {number} options.pointRadius - 顶点半径，默认为5
 * @param {number} options.defaultWidth - 默认宽度（米），默认为20
 * @param {Function} options.onDrawComplete - 绘制完成回调，接收路径和宽度信息作为参数
 * @param {boolean} options.enableTouch - 是否启用触摸支持，默认为true
 * @param {number} options.minPoints - 最少点数，默认为2
 * @returns {Object} 包含启用/禁用方法的绘制控制器
 */
export function enablePolylineDrawing(turf, map, options = {}) {
  if (!map || !turf) {
    throw new Error('地图或Turf库未初始化。');
  }
  
  const {
    fillColor = '#3388ff',
    fillOpacity = 0.8,
    lineColor = '#2266cc',
    lineWidth = 2,
    pointColor = '#ff0000',
    pointRadius = 5,
    defaultWidth = 20, // 默认宽度20米
    onDrawComplete = null,
    enableTouch = true,
    minPoints = 2
  } = options;
  
  // 绘制状态
  let isDrawing = false;
  let points = []; // 存储路径的所有顶点
  let currentWidth = defaultWidth; // 当前宽度
  let polyline = null;
  
  // 触摸状态
  let lastTouchTime = 0;
  let lastTouchPoint = null;
  
  // 源和图层ID
  const sourceId = 'polyline-draw-source';
  const pointsSourceId = 'polyline-draw-points-source';
  const fillLayerId = LAYER_IDS.POLYLINE_DRAW_FILL;
  const lineLayerId = LAYER_IDS.POLYLINE_DRAW_LINE;
  const pointsLayerId = LAYER_IDS.POLYLINE_DRAW_POINTS;
  
  // 计算两点间的垂直向量（单位向量）
  const getPerpendicularVector = (point1, point2) => {
    const dx = point2[0] - point1[0];
    const dy = point2[1] - point1[1];
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return [0, 0];
    
    // 垂直向量（逆时针旋转90度）
    return [-dy / length, dx / length];
  };
  
  // 将线段路径转换为带宽度的多边形坐标
  const pathToPolygon = (path, width) => {
    if (!path || path.length < 2) {
      return [];
    }

    const halfWidth = width / 2;
    const leftSide = [];
    const rightSide = [];

    for (let i = 0; i < path.length; i++) {
      const current = path[i];
      let perpVector;

      if (i === 0) {
        // 第一个点：使用与下一个点的垂直向量
        perpVector = getPerpendicularVector(current, path[i + 1]);
      } else if (i === path.length - 1) {
        // 最后一个点：使用与前一个点的垂直向量
        perpVector = getPerpendicularVector(path[i - 1], current);
      } else {
        // 中间点：计算角平分线方向
        const perpVector1 = getPerpendicularVector(path[i - 1], current);
        const perpVector2 = getPerpendicularVector(current, path[i + 1]);
        
        // 平均两个垂直向量
        const avgX = (perpVector1[0] + perpVector2[0]) / 2;
        const avgY = (perpVector1[1] + perpVector2[1]) / 2;
        const length = Math.sqrt(avgX * avgX + avgY * avgY);
        
        if (length === 0) {
          perpVector = perpVector1;
        } else {
          perpVector = [avgX / length, avgY / length];
        }
      }

      // 计算宽度偏移（根据经纬度转换）
      // 在实际地图上，经度1度约等于111km，纬度1度约等于111km
      const widthOffset = halfWidth / 111000; // 转换为度数
      
      // 左右两侧的点
      leftSide.push([
        current[0] + perpVector[0] * widthOffset,
        current[1] + perpVector[1] * widthOffset
      ]);
      
      rightSide.push([
        current[0] - perpVector[0] * widthOffset,
        current[1] - perpVector[1] * widthOffset
      ]);
    }

    // 组合成多边形：左侧 + 右侧倒序 + 闭合
    const polygon = [...leftSide, ...rightSide.reverse(), leftSide[0]];
    
    return polygon;
  };
  
  // 初始化数据源
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
    
    // 添加填充图层
    addLayerWithOrder(map, {
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': fillColor,
        'fill-opacity': fillOpacity,
        'fill-outline-color': lineColor
      }
    });
    
    // 添加线图层
    addLayerWithOrder(map, {
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': lineColor,
        'line-width': lineWidth,
        'line-opacity': 1
      }
    });
  }
  
  // 初始化顶点数据源
  if (!map.getSource(pointsSourceId)) {
    map.addSource(pointsSourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
    
    // 添加顶点图层
    addLayerWithOrder(map, {
      id: pointsLayerId,
      type: 'circle',
      source: pointsSourceId,
      paint: {
        'circle-radius': pointRadius,
        'circle-color': pointColor,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
  }
  
  // 更新顶点显示
  const updatePoints = () => {
    const pointFeatures = points.map(coord => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coord
      }
    }));
    
    const source = map.getSource(pointsSourceId);
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: pointFeatures
      });
    }
  };
  
  // 更新线段显示
  const updatePolyline = (currentPoint = null) => {
    if (points.length < 1) return;
    
    // 创建临时坐标数组
    let coords = [...points];
    if (currentPoint) {
      coords.push(currentPoint);
    }
    
    // 至少需要2个点才能创建线段
    if (coords.length >= 2) {
      // 将路径转换为多边形
      const polygonCoords = pathToPolygon(coords, currentWidth);
      
      if (polygonCoords.length > 0) {
        const polylineFeature = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [polygonCoords]
          },
          properties: {
            width: currentWidth
          }
        };
        
        // 更新数据源
        const source = map.getSource(sourceId);
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features: [polylineFeature]
          });
        }
      }
    } else if (coords.length === 1) {
      // 只有一个点时，显示一个小圆点
      const source = map.getSource(sourceId);
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    }
  };
  
  // 完成线段绘制
  const finishPolyline = () => {
    if (points.length < minPoints) {
      console.warn(`线段至少需要 ${minPoints} 个点`);
      return false;
    }
    
    // 计算线段信息
    const lineString = turf.lineString(points);
    const length = turf.length(lineString, { units: 'kilometers' });
    
    // 计算面积（近似）
    const polygonCoords = pathToPolygon(points, currentWidth);
    let area = 0;
    if (polygonCoords.length > 0) {
      const polygon = turf.polygon([polygonCoords]);
      area = turf.area(polygon) / 1000000; // 平方公里
    }
    
    const polylineInfo = {
      path: points,
      width: currentWidth,
      length: length,
      area: area,
      pointCount: points.length
    };
    
    polyline = polylineInfo;
    
    // 调用完成回调
    if (onDrawComplete && typeof onDrawComplete === 'function') {
      onDrawComplete(polylineInfo);
    }
    
    // 重置状态
    isDrawing = false;
    points = [];
    
    return true;
  };
  
  // 鼠标事件处理器
  const handleMouseClick = (e) => {
    // 仅处理左键点击
    if (e.originalEvent.button !== 0) return;
    
    const point = [e.lngLat.lng, e.lngLat.lat];
    
    // 添加新点
    points.push(point);
    isDrawing = true;
    
    // 更新显示
    updatePoints();
    updatePolyline();
    
    e.preventDefault();
  };
  
  const handleMouseMove = (e) => {
    if (!isDrawing || points.length === 0) return;
    
    const currentPoint = [e.lngLat.lng, e.lngLat.lat];
    updatePolyline(currentPoint);
  };
  
  const handleMouseDblClick = (e) => {
    if (!isDrawing || points.length < minPoints) return;
    
    e.preventDefault();
    
    // 双击完成绘制
    if (finishPolyline()) {
      updatePoints();
      updatePolyline();
    }
  };
  
  // 触摸事件处理器
  const getTouchLngLat = (touch) => {
    const rect = map.getContainer().getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    return map.unproject([x, y]);
  };
  
  const handleTouchStart = (e) => {
    if (!enableTouch) return;
    
    // 只处理单指触摸
    if (e.touches.length !== 1) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    const lngLat = getTouchLngLat(touch);
    const point = [lngLat.lng, lngLat.lat];
    
    const currentTime = Date.now();
    const timeDiff = currentTime - lastTouchTime;
    
    // 检测双击（两次触摸间隔小于300ms）
    if (timeDiff < 300 && lastTouchPoint) {
      const distance = Math.sqrt(
        Math.pow(point[0] - lastTouchPoint[0], 2) + 
        Math.pow(point[1] - lastTouchPoint[1], 2)
      );
      
      // 如果两次点击位置很近，认为是双击
      if (distance < 0.0001) {
        if (points.length >= minPoints && finishPolyline()) {
          updatePoints();
          updatePolyline();
        }
        lastTouchTime = 0;
        lastTouchPoint = null;
        return;
      }
    }
    
    // 添加新点
    points.push(point);
    isDrawing = true;
    
    // 更新显示
    updatePoints();
    updatePolyline();
    
    lastTouchTime = currentTime;
    lastTouchPoint = point;
  };
  
  const handleTouchMove = (e) => {
    if (!enableTouch) return;
    
    // 只处理单指触摸
    if (e.touches.length !== 1) return;
    if (!isDrawing || points.length === 0) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    const lngLat = getTouchLngLat(touch);
    const currentPoint = [lngLat.lng, lngLat.lat];
    updatePolyline(currentPoint);
  };
  
  // 按键事件处理器（支持Esc取消，Enter完成）
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      // 取消绘制
      points = [];
      isDrawing = false;
      updatePoints();
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    } else if (e.key === 'Enter') {
      // 完成绘制
      if (points.length >= minPoints && finishPolyline()) {
        updatePoints();
        updatePolyline();
      }
    }
  };
  
  // 启用绘制模式
  const enable = () => {
    // 鼠标事件
    map.on('click', handleMouseClick);
    map.on('mousemove', handleMouseMove);
    map.on('dblclick', handleMouseDblClick);
    
    // 触摸事件
    if (enableTouch) {
      const canvas = map.getCanvas();
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    
    // 键盘事件
    document.addEventListener('keydown', handleKeyDown);
    
    // 更改光标以指示绘制模式
    map.getCanvas().style.cursor = 'crosshair';
  };
  
  // 禁用绘制模式
  const disable = () => {
    // 移除鼠标事件
    map.off('click', handleMouseClick);
    map.off('mousemove', handleMouseMove);
    map.off('dblclick', handleMouseDblClick);
    
    // 移除触摸事件
    if (enableTouch) {
      const canvas = map.getCanvas();
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
    }
    
    // 移除键盘事件
    document.removeEventListener('keydown', handleKeyDown);
    
    // 重置状态
    isDrawing = false;
    points = [];
    lastTouchTime = 0;
    lastTouchPoint = null;
    
    // 重置光标
    map.getCanvas().style.cursor = '';
    
    // 清除绘制
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData({
        type: 'FeatureCollection',
        features: []
      });
    }
    if (map.getSource(pointsSourceId)) {
      map.getSource(pointsSourceId).setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  };
  
  // 自动启用绘制
  enable();
  
  // 返回控制器对象
  return {
    enable,
    disable,
    getDrawing: () => polyline,
    getPoints: () => points,
    setWidth: (width) => {
      currentWidth = width;
      updatePolyline();
    },
    getWidth: () => currentWidth,
    clearDrawing: () => {
      polyline = null;
      points = [];
      isDrawing = false;
      updatePoints();
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      if (map.getSource(pointsSourceId)) {
        map.getSource(pointsSourceId).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    },
    finishDrawing: () => {
      if (points.length >= minPoints) {
        return finishPolyline();
      }
      return false;
    }
  };
} 