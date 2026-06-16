/*
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-27 17:10:30
 * @LastEditTime: 2025-08-07 14:44:51
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 地图基础功能
 * @FilePath: /bic-map-plugin/src/bicMap/core/map/index.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

/**
 * 创建新地图实例
 * @param {Object} maplibregl - maplibregl实例
 * @param {Object} options - 地图选项
 * @returns {Object} 地图实例
 */
export function createMap(maplibregl, options) {
  if (!maplibregl) {
    throw new Error('maplibregl未初始化。');
  }

  const {
    container,
    center = [0, 0],
    zoom = 0.1,
    pitch = 0,
    bearing = 0,
    maxPitch = 60,
    antialias = false,
    backgroundColor = '#808080'
  } = options;

  if (!container) {
    throw new Error('缺少容器ID');
  }

  const blankStyle = {
    version: 8,
    name: 'BlankMap',
    glyphs: '/bicMap/glyphs/{fontstack}/{range}.pbf',
    sources: {},
    minzoom: 0,
    maxzoom: 24,
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': backgroundColor }
      }
    ]
  };

  return new maplibregl.Map({
    container,
    style: blankStyle,
    center,
    zoom,
    pitch,
    bearing,
    maxPitch,
    antialias,
    maxZoom: 23.99,
    minZoom: 0
  });
} 