/**
 * @Date: 2025-05-10 14:25:30
 * @Description: 矩形面显示实现
 * @FilePath: /bic-map/src/bicMap/core/rectangle/index.js
 */

import { LAYER_IDS, addLayerWithOrder } from '../layers/layerConfig';

/**
 * 创建矩形显示控制器
 * @param {Object} map - Mapbox GL JS地图实例
 * @param {Array} rectangles - 矩形数据数组，每个矩形包含 [[lng1, lat1], [lng2, lat2]] 的坐标数组和可选的样式选项
 * @param {Object} options - 全局配置选项
 * @returns {Object} 矩形控制器实例
 */
const createRectangles = (map, rectangles = [], options = {}) => {
  if (!map) {
    console.error('创建矩形失败: 地图实例不能为空');
    return null;
  }

  // 默认配置
  const defaultOptions = {
    fillColor: '#3388ff',
    fillOpacity: 0.4,
    outlineColor: '#3388ff',
    outlineWidth: 2,
    outlineOpacity: 0.8,
    highlightColor: '#ff6600',
    highlightOpacity: 0.6,
    sourceId: `rectangle-source-${Date.now()}`,
    layerId: LAYER_IDS.RECTANGLE,
    outlineLayerId: LAYER_IDS.RECTANGLE_OUTLINE,
    filled: true // 新增: 是否填充矩形，默认为true
  };

  // 合并配置
  const mergedOptions = { ...defaultOptions, ...options };
  
  // 存储所有矩形的ID
  const rectangleIds = [];
  
  // 检查地图是否已加载
  // const ensureMapLoaded = (callback) => {
  //   if (map.loaded()) {
  //     callback();
  //   } else {
  //     map.once('load', callback);
  //   }
  // };

  // 将矩形数据转换为GeoJSON Feature
  const createRectangleFeature = (rectangle, id) => {
    const { coordinates, ...customOptions } = rectangle;
    
    // 确保坐标正确，按照西南角和东北角的格式
    if (!coordinates || coordinates.length !== 2) {
      console.error('矩形坐标格式不正确，应为 [[lng1, lat1], [lng2, lat2]]');
      return null;
    }
    
    const [sw, ne] = coordinates;
    
    // 创建矩形的四个角坐标（顺时针）
    const polygonCoordinates = [
      [sw[0], sw[1]], // 西南角
      [ne[0], sw[1]], // 东南角
      [ne[0], ne[1]], // 东北角
      [sw[0], ne[1]], // 西北角
      [sw[0], sw[1]]  // 回到起点，闭合多边形
    ];
    
    // 创建GeoJSON Feature
    return {
      type: 'Feature',
      id: id,
      properties: {
        id: id,
        filled: rectangle.filled !== undefined ? rectangle.filled : mergedOptions.filled, // 新增: 使用矩形自己的filled属性或全局配置
        ...customOptions
      },
      geometry: {
        type: 'Polygon',
        coordinates: [polygonCoordinates]
      }
    };
  };

  // 初始化GeoJSON数据源和图层
  const initLayers = () => {
    // 创建数据源
    map.addSource(mergedOptions.sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
    
    // 添加填充图层
    addLayerWithOrder(map, {
      id: mergedOptions.layerId,
      type: 'fill',
      source: mergedOptions.sourceId,
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          mergedOptions.highlightColor,
          ['coalesce', ['get', 'fillColor'], mergedOptions.fillColor]
        ],
        'fill-opacity': [
          'case',
          ['all',
            ['boolean', ['feature-state', 'hover'], false],
            ['coalesce', ['get', 'filled'], mergedOptions.filled]
          ],
          mergedOptions.highlightOpacity,
          ['case',
            ['coalesce', ['get', 'filled'], mergedOptions.filled],
            ['coalesce', ['get', 'fillOpacity'], mergedOptions.fillOpacity],
            0 // 如果不填充，则不透明度为0
          ]
        ]
      }
    });
    
    // 添加边框图层
    addLayerWithOrder(map, {
      id: mergedOptions.outlineLayerId,
      type: 'line',
      source: mergedOptions.sourceId,
      paint: {
        'line-color': ['coalesce', ['get', 'outlineColor'], mergedOptions.outlineColor],
        'line-width': ['coalesce', ['get', 'outlineWidth'], mergedOptions.outlineWidth],
        'line-opacity': ['coalesce', ['get', 'outlineOpacity'], mergedOptions.outlineOpacity]
      }
    });
  };

  // 设置矩形数据
  const setData = (rectangles) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    // 清空当前ID列表
    rectangleIds.length = 0;
    
    // 转换矩形数据为GeoJSON Features
    const features = rectangles.map((rectangle, index) => {
      const id = rectangle.id || `rectangle-${index}`;
      rectangleIds.push(id);
      return createRectangleFeature(rectangle, id);
    }).filter(Boolean);
    
    // 更新数据源
    map.getSource(mergedOptions.sourceId).setData({
      type: 'FeatureCollection',
      features
    });
  };

  // 添加新的矩形
  const addRectangle = (rectangle) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    const currentData = map.getSource(mergedOptions.sourceId)._data;
    const id = rectangle.id || `rectangle-${rectangleIds.length}`;
    rectangleIds.push(id);
    
    const newFeature = createRectangleFeature(rectangle, id);
    if (newFeature) {
      currentData.features.push(newFeature);
      map.getSource(mergedOptions.sourceId).setData(currentData);
    }
    
    return id;
  };

  // 更新矩形
  const updateRectangle = (id, updatedData) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    const currentData = map.getSource(mergedOptions.sourceId)._data;
    const featureIndex = currentData.features.findIndex(f => f.id === id);
    
    if (featureIndex !== -1) {
      // 更新坐标
      if (updatedData.coordinates) {
        const newFeature = createRectangleFeature({
          ...currentData.features[featureIndex].properties,
          coordinates: updatedData.coordinates
        }, id);
        
        if (newFeature) {
          currentData.features[featureIndex] = newFeature;
        }
      } else {
        // 只更新属性
        Object.assign(currentData.features[featureIndex].properties, updatedData);
      }
      
      map.getSource(mergedOptions.sourceId).setData(currentData);
    }
  };

  // 移除矩形
  const removeRectangle = (id) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    const currentData = map.getSource(mergedOptions.sourceId)._data;
    const featureIndex = currentData.features.findIndex(f => f.id === id);
    
    if (featureIndex !== -1) {
      currentData.features.splice(featureIndex, 1);
      map.getSource(mergedOptions.sourceId).setData(currentData);
      const idIndex = rectangleIds.indexOf(id);
      if (idIndex !== -1) {
        rectangleIds.splice(idIndex, 1);
      }
    }
  };

  // 高亮矩形
  const highlightRectangle = (id) => {
    if (id && rectangleIds.includes(id)) {
      map.setFeatureState(
        { source: mergedOptions.sourceId, id },
        { hover: true }
      );
    }
  };

  // 取消高亮
  const unhighlightRectangle = (id) => {
    if (id && rectangleIds.includes(id)) {
      map.setFeatureState(
        { source: mergedOptions.sourceId, id },
        { hover: false }
      );
    }
  };

  // 清除所有高亮
  const clearHighlights = () => {
    rectangleIds.forEach(id => {
      unhighlightRectangle(id);
    });
  };

  // 显示所有矩形
  const show = () => {
    if (map.getLayer(mergedOptions.layerId)) {
      map.setLayoutProperty(mergedOptions.layerId, 'visibility', 'visible');
    }
    if (map.getLayer(mergedOptions.outlineLayerId)) {
      map.setLayoutProperty(mergedOptions.outlineLayerId, 'visibility', 'visible');
    }
  };

  // 隐藏所有矩形
  const hide = () => {
    if (map.getLayer(mergedOptions.layerId)) {
      map.setLayoutProperty(mergedOptions.layerId, 'visibility', 'none');
    }
    if (map.getLayer(mergedOptions.outlineLayerId)) {
      map.setLayoutProperty(mergedOptions.outlineLayerId, 'visibility', 'none');
    }
  };

  // 设置所有矩形是否填充
  const setAllFilled = (filled) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    const currentData = map.getSource(mergedOptions.sourceId)._data;
    currentData.features.forEach(feature => {
      feature.properties.filled = filled;
    });
    
    map.getSource(mergedOptions.sourceId).setData(currentData);
    
    // 更新全局配置
    mergedOptions.filled = filled;
  };

  // 设置指定矩形是否填充
  const setRectangleFilled = (id, filled) => {
    updateRectangle(id, { filled });
  };

  // 切换所有矩形的填充状态
  const toggleAllFilled = () => {
    setAllFilled(!mergedOptions.filled);
  };
  
  // 切换指定矩形的填充状态
  const toggleRectangleFilled = (id) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    const currentData = map.getSource(mergedOptions.sourceId)._data;
    const feature = currentData.features.find(f => f.id === id);
    
    if (feature) {
      const currentState = feature.properties.filled !== undefined ? 
        feature.properties.filled : mergedOptions.filled;
      
      setRectangleFilled(id, !currentState);
    }
  };

  // 移除所有矩形和图层
  const remove = () => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    if (map.getLayer(mergedOptions.outlineLayerId)) {
      map.removeLayer(mergedOptions.outlineLayerId);
    }
    
    if (map.getLayer(mergedOptions.layerId)) {
      map.removeLayer(mergedOptions.layerId);
    }
    
    if (map.getSource(mergedOptions.sourceId)) {
      map.removeSource(mergedOptions.sourceId);
    }
    
    rectangleIds.length = 0;
  };

  // 获取所有矩形ID
  const getRectangleIds = () => {
    return [...rectangleIds];
  };
  
  // 获取矩形数据
  const getRectangleData = (id) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return null;
    }
    
    const currentData = map.getSource(mergedOptions.sourceId)._data;
    return currentData.features.find(f => f.id === id);
  };

  // 获取所有矩形数据
  const getAllRectangles = () => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return [];
    }
    
    return map.getSource(mergedOptions.sourceId)._data.features;
  };

  // 绑定事件监听
  let mouseEnterListener, mouseLeaveListener, clickListener;
  
  const setupEventListeners = () => {
    // 鼠标悬停高亮
    mouseEnterListener = (e) => {
      if (e.features && e.features.length > 0) {
        const id = e.features[0].id;
        highlightRectangle(id);
        
        // 鼠标指针样式
        map.getCanvas().style.cursor = 'pointer';
      }
    };
    
    mouseLeaveListener = (e) => {
      if (e.features && e.features.length > 0) {
        const id = e.features[0].id;
        unhighlightRectangle(id);
        
        // 恢复鼠标指针样式
        map.getCanvas().style.cursor = '';
      }
    };
    
    // 点击事件
    clickListener = (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        
        // 触发自定义点击事件
        map.fire('rectangleclick', {
          rectangleId: feature.id,
          feature: feature,
          lngLat: e.lngLat
        });
      }
    };
    
    map.on('mouseenter', mergedOptions.layerId, mouseEnterListener);
    map.on('mouseleave', mergedOptions.layerId, mouseLeaveListener);
    map.on('click', mergedOptions.layerId, clickListener);
  };
  
  const removeEventListeners = () => {
    if (mouseEnterListener) {
      map.off('mouseenter', mergedOptions.layerId, mouseEnterListener);
    }
    if (mouseLeaveListener) {
      map.off('mouseleave', mergedOptions.layerId, mouseLeaveListener);
    }
    if (clickListener) {
      map.off('click', mergedOptions.layerId, clickListener);
    }
  };
  initLayers();
  if (rectangles.length > 0) {
    setData(rectangles);
  }
  // setupEventListeners();

  // 返回控制器实例
  return {
    addRectangle,
    updateRectangle,
    removeRectangle,
    setData,
    highlightRectangle,
    unhighlightRectangle,
    clearHighlights,
    show,
    hide,
    remove,
    getRectangleIds,
    getRectangleData,
    getAllRectangles,
    setAllFilled,        // 新增: 设置所有矩形是否填充
    setRectangleFilled,  // 新增: 设置指定矩形是否填充
    toggleAllFilled,     // 新增: 切换所有矩形的填充状态
    toggleRectangleFilled, // 新增: 切换指定矩形的填充状态
    options: mergedOptions
  };
};

export default {
  createRectangles
};
