/*
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-29 18:12:30
 * @LastEditTime: 2025-06-21 07:46:00
 * @LastEditors: houser.hao@humanoid.com
 * @Description: Polyline drawing functionality
 * @FilePath: /bic-map-plugin/src/bicMap/core/polyline/index.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

import { safeImageLoader } from '../utils/loaders.js';

/**
 * 创建多线段集合
 * @param {Object} map - 地图实例
 * @param {Array} polylines - 线段数据数组
 * @param {Object} options - 配置选项
 * @returns {Object} 线段控制器
 */
const createPolylines = (map, polylines = [], options = {}) => {
  if (!map) {
    throw new Error('地图实例不能为空');
  }

  // 默认配置
  const defaultOptions = {
    sourceId: `polylines-source-${Date.now()}`,
    layerId: `polylines-layer-${Date.now()}`,
    defaultColor: '#3388ff',
    defaultWidth: 3,
    defaultOpacity: 0.8,
    lineGapWidth: 0,
    lineJoin: 'round',
    lineCap: 'round',
    showArrow: false,  // 默认不显示箭头
    arrowSize: 1,  // 箭头大小（像素）
    arrowSpacing: 50,  // 箭头间距（像素）
    arrowImagePath: '/bicMap/assets/img/arrow.png'  // 箭头图片路径
  };

  // 合并选项
  const mergedOptions = { ...defaultOptions, ...options };

  // 生成唯一标识
  const generateUniqueId = () => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  // 生成箭头点位和角度
  const generateArrowSymbols = (path, color, opacity, arrowSpacing) => {
    if (!path || path.length < 2) return [];
    const arrows = [];
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      // 计算像素距离
      const startPixel = map.project(start);
      const endPixel = map.project(end);
      const dx = endPixel.x - startPixel.x;
      const dy = endPixel.y - startPixel.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const numArrows = Math.max(1, Math.floor(segmentLength / arrowSpacing));
      for (let j = 1; j < numArrows; j++) {
        const ratio = j / numArrows;
        const lng = start[0] + (end[0] - start[0]) * ratio;
        const lat = start[1] + (end[1] - start[1]) * ratio;
        arrows.push({
          type: 'Feature',
          properties: {
            color,
            opacity,
            angle
          },
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        });
      }
    }
    return arrows;
  };

  // 格式化线段数据为GeoJSON格式
  const formatPolylines = (lines) => {
    // 按照dashType分组
    const groupedLines = {
      'solid': [],
      'dashed': [],
      'dotted': [],
      'dashdot': []
    };
    
    // 存储所有箭头
    const arrows = [];
    const arrowSymbols = [];

    // 分组处理
    lines.forEach(line => {
      // 确保线段至少有两个点
      if (!line.path || line.path.length < 2) {
        console.warn('线段至少需要两个点');
        return;
      }

      // 设置虚线类型
      const dashType = line.dashType || 'solid';
      
      if (!groupedLines[dashType]) {
        groupedLines[dashType] = [];
      }

      // 创建GeoJSON Feature
      groupedLines[dashType].push({
        type: 'Feature',
        properties: {
          id: line.id || `polyline-${generateUniqueId()}`,
          color: line.color || mergedOptions.defaultColor,
          width: line.width || mergedOptions.defaultWidth,
          opacity: line.opacity !== undefined ? line.opacity : mergedOptions.defaultOpacity,
          name: line.name || '',
          data: line.data || {}
        },
        geometry: {
          type: 'LineString',
          coordinates: line.path
        }
      });
      
      // 如果需要显示箭头
      const showArrow = line.showArrow !== undefined ? line.showArrow : mergedOptions.showArrow;
      if (showArrow) {
        const arrowSpacing = line.arrowSpacing || mergedOptions.arrowSpacing;
        const lineArrows = generateArrowSymbols(
          line.path,
          line.color || mergedOptions.defaultColor,
          line.opacity !== undefined ? line.opacity : mergedOptions.defaultOpacity,
          arrowSpacing
        );
        arrowSymbols.push(...lineArrows);
      }
    });

    return { groupedLines, arrowSymbols };
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

  // 虚线模式定义 - 注意实线设为空数组，更兼容maplibregl 3.11.0
  const dashPatterns = {
    'solid': [],  // 实线不需要设置dash参数
    'dashed': [4, 4],
    'dotted': [1, 3],
    'dashdot': [4, 2, 1, 2]
  };

  // 储存所有数据源和图层ID
  const sources = {};
  const layers = {};
  
  // 箭头数据源和图层ID
  const arrowSourceId = `${mergedOptions.sourceId}-arrows-symbol`;
  const arrowLayerId = `${mergedOptions.layerId}-arrows-symbol`;

  // 处理不同的虚线样式，为每种样式创建单独的数据源和图层
  const setupDashTypes = (formattedData) => {
    const { groupedLines, arrowSymbols } = formattedData;
    
    Object.entries(dashPatterns).forEach(([dashType, dashArray]) => {
      const sourceId = `${mergedOptions.sourceId}-${dashType}`;
      const layerId = `${mergedOptions.layerId}-${dashType}`;
      
      // 创建或更新数据源
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: groupedLines[dashType] || []
          }
        });
      } else {
        map.getSource(sourceId).setData({
          type: 'FeatureCollection',
          features: groupedLines[dashType] || []
        });
      }
      
      // 创建图层
      if (!map.getLayer(layerId)) {
        const layerConfig = {
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': mergedOptions.lineJoin,
            'line-cap': mergedOptions.lineCap
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['get', 'width'],
            'line-opacity': ['get', 'opacity'],
            'line-gap-width': mergedOptions.lineGapWidth
          }
        };
        
        // 只为非实线类型设置虚线样式
        if (dashType !== 'solid' && dashArray.length > 0) {
          layerConfig.paint['line-dasharray'] = dashArray;
        }
        
        map.addLayer(layerConfig);
        setupEvents(layerId);
      }
      
      sources[dashType] = sourceId;
      layers[dashType] = layerId;
    });
    
    // 添加箭头 SymbolLayer
    setupArrowSymbols(arrowSymbols);
  };

  // 添加箭头 SymbolLayer
  const setupArrowSymbols = (arrowSymbols) => {
    if (!map.getSource(arrowSourceId)) {
      map.addSource(arrowSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: arrowSymbols
        }
      });
    } else {
      map.getSource(arrowSourceId).setData({
        type: 'FeatureCollection',
        features: arrowSymbols
      });
    }

    // 加载箭头图片（只需一次）
    if (!map.hasImage('arrow-icon')) {
      safeImageLoader(mergedOptions.arrowImagePath)
        .then(img => {
          if (!map.hasImage('arrow-icon')) {
            map.addImage('arrow-icon', img);
          }
        })
        .catch(error => {
          console.error('加载箭头图标失败:', error);
          // 创建备用图标
          const canvas = document.createElement('canvas');
          canvas.width = 20;
          canvas.height = 20;
          const ctx = canvas.getContext('2d');
          
          // 绘制箭头形状
          ctx.beginPath();
          ctx.moveTo(4, 10);
          ctx.lineTo(16, 10);
          ctx.lineTo(12, 6);
          ctx.moveTo(16, 10);
          ctx.lineTo(12, 14);
          ctx.strokeStyle = '#0066FF';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          if (!map.hasImage('arrow-icon')) {
            map.addImage('arrow-icon', canvas);
          }
        });
    }

    if (!map.getLayer(arrowLayerId) && arrowSymbols.length > 0) {
      map.addLayer({
        id: arrowLayerId,
        type: 'symbol',
        source: arrowSourceId,
        layout: {
          'icon-image': 'arrow-icon',
          'icon-size': mergedOptions.arrowSize,
          'icon-rotate': ['get', 'angle'],
          'icon-allow-overlap': true
        },
        paint: {
          // 可选：如果你想让箭头有不同颜色，可以用 SDF 矢量图标并设置 'icon-color'
          // 'icon-color': ['get', 'color'],
          // 'icon-opacity': ['get', 'opacity']
        }
      });
    }
  };

  // 初始化数据
  const formattedData = formatPolylines(polylines);
  setupDashTypes(formattedData);

  // 返回控制器
  return {
    // 更新线段数据
    update: (newPolylines) => {
      const formattedData = formatPolylines(newPolylines);
      
      // 更新每个类型的数据源
      Object.entries(dashPatterns).forEach(([dashType]) => {
        const sourceId = sources[dashType];
        if (map.getSource(sourceId)) {
          map.getSource(sourceId).setData({
            type: 'FeatureCollection',
            features: formattedData.groupedLines[dashType] || []
          });
        }
      });
      
      // 更新箭头数据源
      if (map.getSource(arrowSourceId)) {
        map.getSource(arrowSourceId).setData({
          type: 'FeatureCollection',
          features: formattedData.arrowSymbols
        });
      }
      
      // 如果有箭头但没有箭头图层，则创建
      if (formattedData.arrowSymbols.length > 0 && !map.getLayer(arrowLayerId)) {
        map.addLayer({
          id: arrowLayerId,
          type: 'symbol',
          source: arrowSourceId,
          layout: {
            'icon-image': 'arrow-icon',
            'icon-size': mergedOptions.arrowSize,
            'icon-rotate': ['get', 'angle'],
            'icon-allow-overlap': true
          },
          paint: {}
        });
      }
    },

    // 更新箭头大小
    updateArrowSize: (newSize) => {
      if (map.getLayer(arrowLayerId)) {
        map.setLayoutProperty(arrowLayerId, 'icon-size', newSize);
      }
    },
    
    // 更新单条线段的箭头大小
    updatePolylineArrowSize: (id, newSize) => {
      // 查找线段
      Object.entries(sources).forEach(([dashType, sourceId]) => {
        if (map.getSource(sourceId)) {
          const currentData = map.getSource(sourceId)._data;
          const feature = currentData.features.find(f => f.properties.id === id);
          
          if (feature) {
            // 更新箭头数据
            if (map.getSource(arrowSourceId)) {
              const arrowData = map.getSource(arrowSourceId)._data;
              const arrowFeatures = arrowData.features.filter(f => 
                f.properties.lineId === id
              );
              
              arrowFeatures.forEach(feature => {
                feature.properties.arrowSize = newSize;
              });
              
              map.getSource(arrowSourceId).setData(arrowData);
            }
          }
        }
      });
    },
    
    // 添加单条线段
    addPolyline: (polyline) => {
      const dashType = polyline.dashType || 'solid';
      const sourceId = sources[dashType];
      
      if (!map.getSource(sourceId)) {
        return null;
      }
      
      // 获取当前线段数据
      const currentLineData = map.getSource(sourceId)._data;
      const formattedData = formatPolylines([polyline]);
      const formattedLine = formattedData.groupedLines[dashType][0];
      
      if (formattedLine) {
        // 添加线段
        currentLineData.features.push(formattedLine);
        map.getSource(sourceId).setData(currentLineData);
        
        // 添加箭头
        if (formattedData.arrowSymbols.length > 0) {
          const currentArrowData = map.getSource(arrowSourceId)._data;
          currentArrowData.features.push(...formattedData.arrowSymbols);
          map.getSource(arrowSourceId).setData(currentArrowData);
          
          // 确保箭头图层存在
          if (!map.getLayer(arrowLayerId)) {
            map.addLayer({
              id: arrowLayerId,
              type: 'symbol',
              source: arrowSourceId,
              layout: {
                'icon-image': 'arrow-icon',
                'icon-size': mergedOptions.arrowSize,
                'icon-rotate': ['get', 'angle'],
                'icon-allow-overlap': true
              },
              paint: {
                // 可选：如果你想让箭头有不同颜色，可以用 SDF 矢量图标并设置 'icon-color'
                // 'icon-color': ['get', 'color'],
                // 'icon-opacity': ['get', 'opacity']
              }
            });
          }
        }
        
        return formattedLine.properties.id;
      }
      
      return null;
    },
    
    // 更新单条线段
    updatePolyline: (id, polyline) => {
      // 首先需要找到这个ID在哪个数据源
      const newDashType = polyline.dashType || 'solid';
      let foundInSource = null;
      let featureIndex = -1;
      
      // 查找线段
      Object.entries(sources).forEach(([dashType, sourceId]) => {
        if (map.getSource(sourceId)) {
          const currentData = map.getSource(sourceId)._data;
          const index = currentData.features.findIndex(f => f.properties.id === id);
          
          if (index !== -1) {
            foundInSource = { dashType, sourceId, data: currentData };
            featureIndex = index;
          }
        }
      });
      
      if (foundInSource && featureIndex !== -1) {
        // 原位置删除
        const oldData = foundInSource.data;
        oldData.features.splice(featureIndex, 1);
        map.getSource(foundInSource.sourceId).setData(oldData);
        
        // 新位置添加
        const formattedData = formatPolylines([polyline]);
        const formattedLine = formattedData.groupedLines[newDashType][0];
        
        if (formattedLine) {
          const newSourceId = sources[newDashType];
          const newData = map.getSource(newSourceId)._data;
          newData.features.push(formattedLine);
          map.getSource(newSourceId).setData(newData);
          
          // 更新箭头 - 先移除相关的箭头，再添加新的
          if (map.getSource(arrowSourceId)) {
            // 获取当前所有箭头
            const currentArrows = map.getSource(arrowSourceId)._data;
            
            // 添加新线段的箭头
            if (formattedData.arrowSymbols.length > 0) {
              currentArrows.features.push(...formattedData.arrowSymbols);
            }
            
            // 更新箭头数据源
            map.getSource(arrowSourceId).setData(currentArrows);
          }
        }
      }
    },
    
    // 移除单条线段
    removePolyline: (id) => {
      // 在所有数据源中查找并删除
      Object.values(sources).forEach(sourceId => {
        if (map.getSource(sourceId)) {
          const currentData = map.getSource(sourceId)._data;
          const index = currentData.features.findIndex(f => f.properties.id === id);
          
          if (index !== -1) {
            currentData.features.splice(index, 1);
            map.getSource(sourceId).setData(currentData);
          }
        }
      });
      
      // 注意：由于箭头没有关联到具体的线段ID，暂时无法移除特定线段的箭头
      // 这需要额外的设计来跟踪箭头与线段的对应关系
    },
    
    // 清空所有线段
    clear: () => {
      // 清空所有数据源
      Object.values(sources).forEach(sourceId => {
        if (map.getSource(sourceId)) {
          map.getSource(sourceId).setData({
            type: 'FeatureCollection',
            features: []
          });
        }
      });
      
      // 清空箭头
      if (map.getSource(arrowSourceId)) {
        map.getSource(arrowSourceId).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    },
    
    // 删除图层和数据源
    remove: () => {
      // 删除所有图层和数据源
      Object.values(layers).forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      });
      
      Object.values(sources).forEach(sourceId => {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      });
      
      // 删除箭头图层和数据源
      if (map.getLayer(arrowLayerId)) {
        map.removeLayer(arrowLayerId);
      }
      
      if (map.getSource(arrowSourceId)) {
        map.removeSource(arrowSourceId);
      }
    }
  };
};

export {
  createPolylines
};
