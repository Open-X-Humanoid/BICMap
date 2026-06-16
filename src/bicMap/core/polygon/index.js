/**
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-06-20 21:00:00
 * @Description: 多边形面显示实现
 * @FilePath: /bic-map-plugin/src/bicMap/core/polygon/index.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

import { LAYER_IDS, addLayerWithOrder } from '../layers/layerConfig';

/**
 * 创建多边形显示控制器
 * @param {Object} map - Mapbox GL JS地图实例
 * @param {Array} polygons - 多边形数据数组，每个多边形包含 points: [[lng, lat], [lng, lat], ...] 的坐标数组和可选的样式选项
 * @param {Object} options - 全局配置选项
 * @returns {Object} 多边形控制器实例
 */
const createPolygons = (map, polygons = [], options = {}) => {
  if (!map) {
    console.error('创建多边形失败: 地图实例不能为空');
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
    sourceId: `polygon-source-${Date.now()}`,
    layerId: LAYER_IDS.POLYGON,
    outlineLayerId: LAYER_IDS.POLYGON_OUTLINE,
    filled: true // 是否填充多边形，默认为true
  };

  // 合并配置
  const mergedOptions = { ...defaultOptions, ...options };
  
  // 存储所有多边形的ID
  const polygonIds = [];

  // 将多边形数据转换为GeoJSON Feature
  const createPolygonFeature = (polygon, id) => {
    const { points, ...customOptions } = polygon;
    
    // 确保坐标正确
    if (!points || !Array.isArray(points) || points.length < 3) {
      console.error('多边形坐标格式不正确，应为 [[lng, lat], [lng, lat], ...] 且至少包含3个点');
      return null;
    }
    
    // 确保多边形闭合（第一个点和最后一个点相同）
    const coordinates = [...points];
    const firstPoint = coordinates[0];
    const lastPoint = coordinates[coordinates.length - 1];
    
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      coordinates.push([...firstPoint]);
    }
    
    // 创建GeoJSON Feature
    return {
      type: 'Feature',
      id: id,
      properties: {
        id: id,
        filled: polygon.filled !== undefined ? polygon.filled : mergedOptions.filled,
        ...customOptions
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
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

  // 设置多边形数据
  const setData = (polygons) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    // 清空当前ID列表
    polygonIds.length = 0;
    
    // 转换多边形数据为GeoJSON Features
    const features = polygons.map((polygon, index) => {
      const id = polygon.id || `polygon-${index}`;
      polygonIds.push(id);
      return createPolygonFeature(polygon, id);
    }).filter(Boolean);
    
    // 更新数据源
    map.getSource(mergedOptions.sourceId).setData({
      type: 'FeatureCollection',
      features
    });
  };

  // 添加新的多边形
  const addPolygon = (polygon) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    const currentData = map.getSource(mergedOptions.sourceId)._data;
    const id = polygon.id || `polygon-${polygonIds.length}`;
    polygonIds.push(id);
    
    const newFeature = createPolygonFeature(polygon, id);
    if (newFeature) {
      currentData.features.push(newFeature);
      map.getSource(mergedOptions.sourceId).setData(currentData);
    }
    
    return id;
  };

  // 更新多边形
  const updatePolygon = (id, updatedData) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    const currentData = map.getSource(mergedOptions.sourceId)._data;
    const featureIndex = currentData.features.findIndex(f => f.id === id);
    
    if (featureIndex !== -1) {
      // 更新坐标
      if (updatedData.points) {
        const newFeature = createPolygonFeature({
          ...currentData.features[featureIndex].properties,
          points: updatedData.points
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

  // 移除多边形
  const removePolygon = (id) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    const currentData = map.getSource(mergedOptions.sourceId)._data;
    const featureIndex = currentData.features.findIndex(f => f.id === id);
    
    if (featureIndex !== -1) {
      currentData.features.splice(featureIndex, 1);
      map.getSource(mergedOptions.sourceId).setData(currentData);
      const idIndex = polygonIds.indexOf(id);
      if (idIndex !== -1) {
        polygonIds.splice(idIndex, 1);
      }
    }
  };

  // 高亮多边形
  const highlightPolygon = (id) => {
    if (id && polygonIds.includes(id)) {
      map.setFeatureState(
        { source: mergedOptions.sourceId, id },
        { hover: true }
      );
    }
  };

  // 取消高亮
  const unhighlightPolygon = (id) => {
    if (id && polygonIds.includes(id)) {
      map.setFeatureState(
        { source: mergedOptions.sourceId, id },
        { hover: false }
      );
    }
  };

  // 清除所有高亮
  const clearHighlights = () => {
    polygonIds.forEach(id => {
      unhighlightPolygon(id);
    });
  };

  // 显示所有多边形
  const show = () => {
    if (map.getLayer(mergedOptions.layerId)) {
      map.setLayoutProperty(mergedOptions.layerId, 'visibility', 'visible');
    }
    if (map.getLayer(mergedOptions.outlineLayerId)) {
      map.setLayoutProperty(mergedOptions.outlineLayerId, 'visibility', 'visible');
    }
  };

  // 隐藏所有多边形
  const hide = () => {
    if (map.getLayer(mergedOptions.layerId)) {
      map.setLayoutProperty(mergedOptions.layerId, 'visibility', 'none');
    }
    if (map.getLayer(mergedOptions.outlineLayerId)) {
      map.setLayoutProperty(mergedOptions.outlineLayerId, 'visibility', 'none');
    }
  };

  // 设置所有多边形是否填充
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

  // 设置指定多边形是否填充
  const setPolygonFilled = (id, filled) => {
    updatePolygon(id, { filled });
  };

  // 切换所有多边形的填充状态
  const toggleAllFilled = () => {
    setAllFilled(!mergedOptions.filled);
  };
  
  // 切换指定多边形的填充状态
  const togglePolygonFilled = (id) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return;
    }
    
    const currentData = map.getSource(mergedOptions.sourceId)._data;
    const feature = currentData.features.find(f => f.id === id);
    
    if (feature) {
      const currentState = feature.properties.filled !== undefined ? 
        feature.properties.filled : mergedOptions.filled;
      
      setPolygonFilled(id, !currentState);
    }
  };

  // 移除所有多边形和图层
  const remove = () => {
    // 退出编辑模式
    if (isEditMode) {
      exitEditMode();
    }
    
    // 移除编辑图层
    if (map.getLayer(editPointsLayerId)) {
      map.removeLayer(editPointsLayerId);
    }
    if (map.getLayer(editLayerId)) {
      map.removeLayer(editLayerId);
    }
    if (map.getSource(editPointsSourceId)) {
      map.removeSource(editPointsSourceId);
    }
    if (map.getSource(editSourceId)) {
      map.removeSource(editSourceId);
    }
    
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
    
    polygonIds.length = 0;
  };

  // 获取所有多边形ID
  const getPolygonIds = () => {
    return [...polygonIds];
  };
  
  // 获取多边形数据
  const getPolygonData = (id) => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return null;
    }
    
    const currentData = map.getSource(mergedOptions.sourceId)._data;
    return currentData.features.find(f => f.id === id);
  };

  // 获取所有多边形数据
  const getAllPolygons = () => {
    if (!map.getSource(mergedOptions.sourceId)) {
      return [];
    }
    
    return map.getSource(mergedOptions.sourceId)._data.features;
  };

  // 编辑模式相关状态
  let isEditMode = false;
  let selectedPolygonId = null;
  let editPoints = []; // 编辑时的顶点数据
  let editSourceId = `polygon-edit-source-${Date.now()}`;
  let editLayerId = `polygon-edit-layer-${Date.now()}`;
  let editPointsSourceId = `polygon-edit-points-source-${Date.now()}`;
  let editPointsLayerId = `polygon-edit-points-layer-${Date.now()}`;
  let isDragging = false;
  let dragPointIndex = -1;
  
  // 编辑回调函数
  let onEditStart = null; // 开始编辑回调
  let onEditUpdate = null; // 编辑更新回调
  let onEditEnd = null; // 结束编辑回调
  
  // 绑定事件监听
  let mouseEnterListener, mouseLeaveListener, clickListener;
  let editMouseDownListener, editMouseMoveListener, editMouseUpListener;
  
  const setupEventListeners = () => {
    // 鼠标悬停高亮
    mouseEnterListener = (e) => {
      if (e.features && e.features.length > 0) {
        const id = e.features[0].id;
        highlightPolygon(id);
        
        // 鼠标指针样式
        map.getCanvas().style.cursor = 'pointer';
      }
    };
    
    mouseLeaveListener = (e) => {
      if (e.features && e.features.length > 0) {
        const id = e.features[0].id;
        unhighlightPolygon(id);
        
        // 恢复鼠标指针样式
        map.getCanvas().style.cursor = '';
      }
    };
    
    // 点击事件
    clickListener = (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        
        // 触发自定义点击事件
        map.fire('polygonclick', {
          polygonId: feature.id,
          feature: feature,
          lngLat: e.lngLat
        });
      }
    };
    
    map.on('mouseenter', mergedOptions.layerId, mouseEnterListener);
    map.on('mouseleave', mergedOptions.layerId, mouseLeaveListener);
    map.on('click', mergedOptions.layerId, clickListener);
  };
  
  // 初始化编辑图层
  const initEditLayers = () => {
    // 编辑多边形图层
    if (!map.getSource(editSourceId)) {
      map.addSource(editSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      
      addLayerWithOrder(map, {
        id: editLayerId,
        type: 'fill',
        source: editSourceId,
        paint: {
          'fill-color': mergedOptions.highlightColor,
          'fill-opacity': 0.3,
          'fill-outline-color': mergedOptions.highlightColor
        }
      });
    }
    
    // 编辑顶点图层
    if (!map.getSource(editPointsSourceId)) {
      map.addSource(editPointsSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      
      addLayerWithOrder(map, {
        id: editPointsLayerId,
        type: 'circle',
        source: editPointsSourceId,
        paint: {
          'circle-radius': 8,
          'circle-color': '#ff0000',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }
  };
  
  // 进入编辑模式
  const enterEditMode = (polygonId, callbacks = {}) => {
    if (!polygonIds.includes(polygonId)) {
      console.error('多边形ID不存在:', polygonId);
      return false;
    }
    
    isEditMode = true;
    selectedPolygonId = polygonId;
    
    // 设置回调函数
    onEditStart = callbacks.onEditStart || null;
    onEditUpdate = callbacks.onEditUpdate || null;
    onEditEnd = callbacks.onEditEnd || null;
    
    // 获取多边形数据
    const feature = getPolygonData(polygonId);
    if (!feature) return false;
    
    // 提取顶点坐标（移除闭合点）
    const coordinates = feature.geometry.coordinates[0];
    editPoints = coordinates.slice(0, -1);
    
    // 初始化编辑图层
    initEditLayers();
    
    // 显示编辑多边形和顶点
    updateEditDisplay();
    
    // 绑定编辑事件
    setupEditEventListeners();
    
    // 触发开始编辑回调
    if (onEditStart && typeof onEditStart === 'function') {
      onEditStart({
        polygonId: polygonId,
        points: [...editPoints],
        feature: feature
      });
    }
    
    return true;
  };
  
  // 退出编辑模式
  const exitEditMode = () => {
    // 触发结束编辑回调
    if (onEditEnd && typeof onEditEnd === 'function' && selectedPolygonId) {
      onEditEnd({
        polygonId: selectedPolygonId,
        points: [...editPoints],
        finalPoints: [...editPoints]
      });
    }
    
    isEditMode = false;
    selectedPolygonId = null;
    editPoints = [];
    isDragging = false;
    dragPointIndex = -1;
    
    // 清除回调函数
    onEditStart = null;
    onEditUpdate = null;
    onEditEnd = null;
    
    // 移除编辑事件监听
    removeEditEventListeners();
    
    // 清除编辑图层
    clearEditDisplay();
  };
  
  // 更新编辑显示
  const updateEditDisplay = () => {
    if (!isEditMode || editPoints.length === 0) return;
    
    // 创建编辑多边形（闭合）
    const closedPoints = [...editPoints, editPoints[0]];
    const editPolygon = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [closedPoints]
      }
    };
    
    // 更新编辑多边形
    const editSource = map.getSource(editSourceId);
    if (editSource) {
      editSource.setData({
        type: 'FeatureCollection',
        features: [editPolygon]
      });
    }
    
    // 更新编辑顶点
    const pointFeatures = editPoints.map((point, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: point
      },
      properties: {
        index: index
      }
    }));
    
    const editPointsSource = map.getSource(editPointsSourceId);
    if (editPointsSource) {
      editPointsSource.setData({
        type: 'FeatureCollection',
        features: pointFeatures
      });
    }
  };
  
  // 清除编辑显示
  const clearEditDisplay = () => {
    if (map.getSource(editSourceId)) {
      map.getSource(editSourceId).setData({
        type: 'FeatureCollection',
        features: []
      });
    }
    
    if (map.getSource(editPointsSourceId)) {
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
            polygonId: selectedPolygonId,
            points: [...editPoints],
            changedPointIndex: dragPointIndex,
            changedPoint: newPoint
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
        
        // 更新原始多边形
        if (selectedPolygonId) {
          updatePolygon(selectedPolygonId, { points: editPoints });
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
    
    // 移除编辑事件监听
    removeEditEventListeners();
  };

  // 初始化
  initLayers();
  if (polygons.length > 0) {
    setData(polygons);
  }
  setupEventListeners();

  // 返回控制器实例
  return {
    addPolygon,
    updatePolygon,
    removePolygon,
    setData,
    highlightPolygon,
    unhighlightPolygon,
    clearHighlights,
    show,
    hide,
    remove,
    getPolygonIds,
    getPolygonData,
    getAllPolygons,
    setAllFilled,
    setPolygonFilled,
    toggleAllFilled,
    togglePolygonFilled,
    removeEventListeners,
    // 编辑模式方法
    enterEditMode,
    exitEditMode,
    isEditMode: () => isEditMode,
    getSelectedPolygonId: () => selectedPolygonId,
    getEditPoints: () => isEditMode ? [...editPoints] : null,
    getEditData: () => {
      if (!isEditMode || !selectedPolygonId) return null;
      return {
        polygonId: selectedPolygonId,
        points: [...editPoints],
        isDragging: isDragging,
        dragPointIndex: dragPointIndex
      };
    },
    options: mergedOptions
  };
};

export default {
  createPolygons
};

