/**
 * 计算两点间的垂直向量（单位向量）
 * @param {Array} point1 - 起点 [lng, lat]
 * @param {Array} point2 - 终点 [lng, lat]
 * @returns {Array} 垂直单位向量 [dx, dy]
 */
const getPerpendicularVector = (point1, point2) => {
  const dx = point2[0] - point1[0];
  const dy = point2[1] - point1[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) return [0, 0];
  
  // 垂直向量（逆时针旋转90度）
  return [-dy / length, dx / length];
};

/**
 * 将线段路径转换为带宽度的多边形坐标
 * @param {Array} path - 线段路径 [[lng, lat], [lng, lat], ...]
 * @param {number} width - 线段宽度（米）
 * @returns {Array} 多边形坐标 [[lng, lat], [lng, lat], ...]
 */
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

    // 计算宽度偏移（根据经纬度转换，这里简化处理）
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

/**
 * 创建宽线段集合
 * @param {Object} map - 地图实例
 * @param {Array} widelines - 宽线段数据数组
 * @param {Object} options - 配置选项
 * @returns {Object} 宽线段控制器
 */
const createWideLines = (map, widelines = [], options = {}) => {
  if (!map) {
    throw new Error('地图实例不能为空');
  }

  // 默认配置
  const defaultOptions = {
    sourceId: `widelines-source-${Date.now()}`,
    fillLayerId: `widelines-fill-layer-${Date.now()}`,
    outlineLayerId: `widelines-outline-layer-${Date.now()}`,
    defaultColor: '#3388ff',
    defaultWidth: 10, // 默认宽度10米
    defaultOpacity: 0.8,
    defaultOutlineColor: '#2266cc',
    defaultOutlineWidth: 2,
    showOutline: true,

    // 编辑顶点（拖拽控制点）样式
    editPointColor: '#2266cc',
    editPointRadius: 6,
    editPointStrokeColor: '#ffffff',
    editPointStrokeWidth: 2
  };

  // 合并选项
  const mergedOptions = { ...defaultOptions, ...options };

  // 生成唯一标识
  const generateUniqueId = () => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  // 格式化宽线段数据为GeoJSON格式
  const formatWideLines = (lines) => {
    const features = [];

    lines.forEach(line => {
      // 确保线段至少有两个点
      if (!line.path || line.path.length < 2) {
        console.warn('宽线段至少需要两个点');
        return;
      }

      // 计算宽度
      const width = line.width !== undefined ? line.width : mergedOptions.defaultWidth;
      
      // 将线段路径转换为多边形
      const polygonCoords = pathToPolygon(line.path, width);
      
      if (polygonCoords.length === 0) {
        return;
      }

      // 创建GeoJSON Feature
      features.push({
        type: 'Feature',
        properties: {
          id: line.id || `wideline-${generateUniqueId()}`,
          color: line.color || mergedOptions.defaultColor,
          opacity: line.opacity !== undefined ? line.opacity : mergedOptions.defaultOpacity,
          outlineColor: line.outlineColor || mergedOptions.defaultOutlineColor,
          outlineWidth: line.outlineWidth !== undefined ? line.outlineWidth : mergedOptions.defaultOutlineWidth,
          width: width,
          name: line.name || '',
          data: line.data || {},
          originalPath: line.path // 保存原始路径用于编辑
        },
        geometry: {
          type: 'Polygon',
          coordinates: [polygonCoords]
        }
      });
    });

    return {
      type: 'FeatureCollection',
      features: features
    };
  };

  // 添加交互事件处理
  const setupEvents = (layerId) => {
    if (mergedOptions.onClick) {
      map.on('click', layerId, (e) => {
        if (e.features && e.features.length > 0) {
          mergedOptions.onClick(e.features[0], e);
        }
      });
      
      // 鼠标悬停时显示指针
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    }
  };

  // 初始化数据源和图层
  const formattedData = formatWideLines(widelines);

  // 创建数据源
  if (!map.getSource(mergedOptions.sourceId)) {
    map.addSource(mergedOptions.sourceId, {
      type: 'geojson',
      data: formattedData
    });
  } else {
    map.getSource(mergedOptions.sourceId).setData(formattedData);
  }

  // 创建填充图层
  if (!map.getLayer(mergedOptions.fillLayerId)) {
    map.addLayer({
      id: mergedOptions.fillLayerId,
      type: 'fill',
      source: mergedOptions.sourceId,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['get', 'opacity']
      }
    });
    setupEvents(mergedOptions.fillLayerId);
  }

  // 创建轮廓图层
  if (mergedOptions.showOutline && !map.getLayer(mergedOptions.outlineLayerId)) {
    map.addLayer({
      id: mergedOptions.outlineLayerId,
      type: 'line',
      source: mergedOptions.sourceId,
      paint: {
        'line-color': ['get', 'outlineColor'],
        'line-width': ['get', 'outlineWidth'],
        'line-opacity': ['get', 'opacity']
      }
    });
  }

  // 编辑模式相关变量
  let isEditMode = false;
  let selectedWidelineId = null;
  let editPoints = [];
  let editPointsSourceId = null;
  let editPointsLayerId = null;
  let editMouseDownListener = null;
  let editMouseMoveListener = null;
  let editMouseUpListener = null;
  let isDragging = false;
  let dragPointIndex = -1;
  let onEditStart = null;
  let onEditUpdate = null;
  let onEditEnd = null;

  // 高亮相关变量
  let highlightSourceId = null;
  let highlightLayerId = null;

  // 创建高亮数据源和图层
  const createHighlightLayer = () => {
    highlightSourceId = `${mergedOptions.sourceId}-highlight`;
    highlightLayerId = `${mergedOptions.fillLayerId}-highlight`;
    
    if (!map.getSource(highlightSourceId)) {
      map.addSource(highlightSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    }
    
    if (!map.getLayer(highlightLayerId)) {
      map.addLayer({
        id: highlightLayerId,
        type: 'fill',
        source: highlightSourceId,
        paint: {
          'fill-color': '#ffeb3b',
          'fill-opacity': 0.3
        }
      });
    }
  };

  // 创建编辑点数据源和图层
  const createEditLayers = () => {
    editPointsSourceId = `${mergedOptions.sourceId}-edit-points`;
    editPointsLayerId = `${mergedOptions.sourceId}-edit-points-layer`;
    
    if (!map.getSource(editPointsSourceId)) {
      map.addSource(editPointsSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    }
    
    if (!map.getLayer(editPointsLayerId)) {
      map.addLayer({
        id: editPointsLayerId,
        type: 'circle',
        source: editPointsSourceId,
        paint: {
          'circle-color': mergedOptions.editPointColor,
          'circle-radius': mergedOptions.editPointRadius,
          'circle-stroke-color': mergedOptions.editPointStrokeColor,
          'circle-stroke-width': mergedOptions.editPointStrokeWidth
        }
      });
    }
  };

  // 更新编辑点显示
  const updateEditDisplay = () => {
    if (!editPointsSourceId || !map.getSource(editPointsSourceId)) return;
    
    const features = editPoints.map((point, index) => ({
      type: 'Feature',
      properties: {
        index: index
      },
      geometry: {
        type: 'Point',
        coordinates: point
      }
    }));
    
    map.getSource(editPointsSourceId).setData({
      type: 'FeatureCollection',
      features: features
    });
  };

  // 清除编辑显示
  const clearEditDisplay = () => {
    if (editPointsSourceId && map.getSource(editPointsSourceId)) {
      map.getSource(editPointsSourceId).setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  };

  // 设置编辑事件监听
  const setupEditEventListeners = () => {
    // 顶点拖拽事件
    editMouseDownListener = (e) => {
      if (e.features && e.features.length > 0 && e.features[0].source === editPointsSourceId) {
        isDragging = true;
        dragPointIndex = e.features[0].properties.index;
        map.getCanvas().style.cursor = 'grabbing';
        e.preventDefault();
      }
    };
    
    editMouseMoveListener = (e) => {
      if (isDragging && dragPointIndex >= 0) {
        const newPoint = [e.lngLat.lng, e.lngLat.lat];
        editPoints[dragPointIndex] = newPoint;
        updateEditDisplay();
        
        // 触发编辑更新回调
        if (onEditUpdate && typeof onEditUpdate === 'function') {
          onEditUpdate({
            widelineId: selectedWidelineId,
            points: [...editPoints],
            changedPointIndex: dragPointIndex,
            changedPoint: newPoint,
            isDragging: true,
            dragPointIndex: dragPointIndex
          });
        }
        
        e.preventDefault();
      }
    };
    
    editMouseUpListener = (e) => {
      if (isDragging) {
        isDragging = false;
        dragPointIndex = -1;
        map.getCanvas().style.cursor = '';
        
        // 触发编辑结束回调
        if (onEditEnd && typeof onEditEnd === 'function') {
          onEditEnd({
            widelineId: selectedWidelineId,
            points: [...editPoints],
            isDragging: false,
            dragPointIndex: -1
          });
        }
        
        e.preventDefault();
      }
    };
    
    map.on('mousedown', editPointsLayerId, editMouseDownListener);
    map.on('mousemove', editMouseMoveListener);
    map.on('mouseup', editMouseUpListener);
  };

  // 移除编辑事件监听
  const removeEditEventListeners = () => {
    if (editMouseDownListener) {
      map.off('mousedown', editPointsLayerId, editMouseDownListener);
    }
    if (editMouseMoveListener) {
      map.off('mousemove', editMouseMoveListener);
    }
    if (editMouseUpListener) {
      map.off('mouseup', editMouseUpListener);
    }
  };

  // 初始化高亮和编辑图层
  createHighlightLayer();
  createEditLayers();

  // 返回控制器
  return {
    // 设置编辑顶点样式（编辑点图层在 createWideLines 时已创建）
    setEditPointStyle: (style = {}) => {
      if (!editPointsLayerId || !map.getLayer(editPointsLayerId)) return;

      const next = {
        editPointColor: style.color ?? mergedOptions.editPointColor,
        editPointRadius: style.radius ?? mergedOptions.editPointRadius,
        editPointStrokeColor: style.strokeColor ?? mergedOptions.editPointStrokeColor,
        editPointStrokeWidth: style.strokeWidth ?? mergedOptions.editPointStrokeWidth
      };

      mergedOptions.editPointColor = next.editPointColor;
      mergedOptions.editPointRadius = next.editPointRadius;
      mergedOptions.editPointStrokeColor = next.editPointStrokeColor;
      mergedOptions.editPointStrokeWidth = next.editPointStrokeWidth;

      map.setPaintProperty(editPointsLayerId, 'circle-color', mergedOptions.editPointColor);
      map.setPaintProperty(editPointsLayerId, 'circle-radius', mergedOptions.editPointRadius);
      map.setPaintProperty(editPointsLayerId, 'circle-stroke-color', mergedOptions.editPointStrokeColor);
      map.setPaintProperty(editPointsLayerId, 'circle-stroke-width', mergedOptions.editPointStrokeWidth);
    },

    // 更新宽线段数据
    update: (newWideLines) => {
      const formattedData = formatWideLines(newWideLines);
      
      if (map.getSource(mergedOptions.sourceId)) {
        map.getSource(mergedOptions.sourceId).setData(formattedData);
      }
    },

    // 添加单条宽线段
    addWideLine: (wideline) => {
      if (!map.getSource(mergedOptions.sourceId)) {
        return null;
      }
      
      const currentData = map.getSource(mergedOptions.sourceId)._data;
      const formattedData = formatWideLines([wideline]);
      const formattedLine = formattedData.features[0];
      
      if (formattedLine) {
        currentData.features.push(formattedLine);
        map.getSource(mergedOptions.sourceId).setData(currentData);
        return formattedLine.properties.id;
      }
      
      return null;
    },

    // 更新单条宽线段
    updateWideLine: (id, wideline) => {
      if (!map.getSource(mergedOptions.sourceId)) {
        return;
      }
      
      const currentData = map.getSource(mergedOptions.sourceId)._data;
      const index = currentData.features.findIndex(f => f.properties.id === id);
      
      if (index !== -1) {
        const formattedData = formatWideLines([wideline]);
        const formattedLine = formattedData.features[0];
        
        if (formattedLine) {
          // 保留原ID
          formattedLine.properties.id = id;
          currentData.features[index] = formattedLine;
          map.getSource(mergedOptions.sourceId).setData(currentData);
        }
      }
    },

    // 移除单条宽线段
    removeWideLine: (id) => {
      if (!map.getSource(mergedOptions.sourceId)) {
        return;
      }
      
      const currentData = map.getSource(mergedOptions.sourceId)._data;
      const index = currentData.features.findIndex(f => f.properties.id === id);
      
      if (index !== -1) {
        currentData.features.splice(index, 1);
        map.getSource(mergedOptions.sourceId).setData(currentData);
      }
    },

    // 清空所有宽线段
    clear: () => {
      if (map.getSource(mergedOptions.sourceId)) {
        map.getSource(mergedOptions.sourceId).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    },

    // 显示图层
    show: () => {
      if (map.getLayer(mergedOptions.fillLayerId)) {
        map.setLayoutProperty(mergedOptions.fillLayerId, 'visibility', 'visible');
      }
      if (map.getLayer(mergedOptions.outlineLayerId)) {
        map.setLayoutProperty(mergedOptions.outlineLayerId, 'visibility', 'visible');
      }
    },

    // 隐藏图层
    hide: () => {
      if (map.getLayer(mergedOptions.fillLayerId)) {
        map.setLayoutProperty(mergedOptions.fillLayerId, 'visibility', 'none');
      }
      if (map.getLayer(mergedOptions.outlineLayerId)) {
        map.setLayoutProperty(mergedOptions.outlineLayerId, 'visibility', 'none');
      }
    },

    // 高亮宽线段
    highlightWideLine: (id) => {
      if (!highlightSourceId || !map.getSource(highlightSourceId)) return;
      
      // 获取原始数据
      const currentData = map.getSource(mergedOptions.sourceId)._data;
      const feature = currentData.features.find(f => f.properties.id === id);
      
      if (feature) {
        map.getSource(highlightSourceId).setData({
          type: 'FeatureCollection',
          features: [feature]
        });
      }
    },

    // 清除高亮
    clearHighlights: () => {
      if (highlightSourceId && map.getSource(highlightSourceId)) {
        map.getSource(highlightSourceId).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    },

    // 进入编辑模式
    enterEditMode: (id, callbacks = {}) => {
      if (isEditMode) {
        console.warn('已经在编辑模式中');
        return false;
      }

      // 获取宽线段数据
      const currentData = map.getSource(mergedOptions.sourceId)._data;
      const feature = currentData.features.find(f => f.properties.id === id);
      
      if (!feature) {
        console.error('未找到指定的宽线段');
        return false;
      }

      // 从保存的原始路径中获取编辑点
      const path = feature.properties.originalPath || [];
      
      selectedWidelineId = id;
      editPoints = [...path];
      isEditMode = true;
      
      // 设置回调
      onEditStart = callbacks.onEditStart;
      onEditUpdate = callbacks.onEditUpdate;
      onEditEnd = callbacks.onEditEnd;
      
      // 显示编辑点
      updateEditDisplay();
      setupEditEventListeners();
      
      // 触发开始编辑回调
      if (onEditStart && typeof onEditStart === 'function') {
        onEditStart({
          widelineId: id,
          points: [...editPoints],
          isDragging: false,
          dragPointIndex: -1
        });
      }
      
      return true;
    },

    // 退出编辑模式
    exitEditMode: () => {
      if (!isEditMode) return;
      
      isEditMode = false;
      selectedWidelineId = null;
      editPoints = [];
      
      // 清除编辑显示
      clearEditDisplay();
      removeEditEventListeners();
      
      // 清除回调
      onEditStart = null;
      onEditUpdate = null;
      onEditEnd = null;
    },

    // 检查是否在编辑模式
    isEditMode: () => isEditMode,

    // 获取当前编辑的宽线段ID
    getSelectedWidelineId: () => selectedWidelineId,

    // 获取当前编辑的坐标点
    getEditPoints: () => [...editPoints],

    // 获取完整的编辑数据
    getEditData: () => ({
      widelineId: selectedWidelineId,
      points: [...editPoints],
      isDragging: isDragging,
      dragPointIndex: dragPointIndex
    }),

    // 获取宽线段数据
    getWideLineData: (id) => {
      const currentData = map.getSource(mergedOptions.sourceId)._data;
      return currentData.features.find(f => f.properties.id === id);
    },

    // 获取所有宽线段
    getAllWideLines: () => {
      const currentData = map.getSource(mergedOptions.sourceId)._data;
      return currentData.features;
    },

    // 获取宽线段ID列表
    getWideLineIds: () => {
      const currentData = map.getSource(mergedOptions.sourceId)._data;
      return currentData.features.map(f => f.properties.id);
    },

    // 删除图层和数据源
    remove: () => {
      // 退出编辑模式
      if (isEditMode) {
        exitEditMode();
      }
      
      // 删除主图层
      if (map.getLayer(mergedOptions.fillLayerId)) {
        map.removeLayer(mergedOptions.fillLayerId);
      }
      
      if (map.getLayer(mergedOptions.outlineLayerId)) {
        map.removeLayer(mergedOptions.outlineLayerId);
      }
      
      if (map.getSource(mergedOptions.sourceId)) {
        map.removeSource(mergedOptions.sourceId);
      }
      
      // 删除高亮图层
      if (map.getLayer(highlightLayerId)) {
        map.removeLayer(highlightLayerId);
      }
      
      if (map.getSource(highlightSourceId)) {
        map.removeSource(highlightSourceId);
      }
      
      // 删除编辑图层
      if (map.getLayer(editPointsLayerId)) {
        map.removeLayer(editPointsLayerId);
      }
      
      if (map.getSource(editPointsSourceId)) {
        map.removeSource(editPointsSourceId);
      }
    }
  };
};

export {
  createWideLines
};

