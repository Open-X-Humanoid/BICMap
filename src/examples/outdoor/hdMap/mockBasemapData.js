/*
 * @Author: houser.hao@humanoid.com
 * @Date: 2026-06-15 14:30:00
 * @LastEditTime: 2026-06-15 14:30:00
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 高精地图示例底图 mock 数据；灰色道路面宽度与车道面 LANE_HALF_WIDTH 对齐，按车道数生成地理宽度
 * @FilePath: /bic-map-plugin/src/examples/outdoor/hdMap/mockBasemapData.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

export const MAP_CENTER = [116.4076, 39.9045]
export const MAP_ZOOM = 16
export const MAP_PITCH = 55
export const MAP_BEARING = -20

/** 单车道半宽（度），与 mockHdMapData 车道面一致 */
export const LANE_HALF_WIDTH = 0.000018

/** 主干道 / 次级道路车道数 */
export const PRIMARY_LANE_COUNT = 4
export const SECONDARY_LANE_COUNT = 2

/**
 * 生成矩形 footprint 坐标环
 * @param {number} cx 中心经度
 * @param {number} cy 中心纬度
 * @param {number} w 东西方向半宽（度）
 * @param {number} h 南北方向半高（度）
 * @returns {Array}
 */
function rect(cx, cy, w, h) {
  return [[
    [cx - w, cy - h],
    [cx + w, cy - h],
    [cx + w, cy + h],
    [cx - w, cy + h],
    [cx - w, cy - h]
  ]]
}

/**
 * 根据车道数计算道路面半宽
 * @param {number} laneCount
 * @returns {number}
 */
function roadHalfWidth(laneCount) {
  return LANE_HALF_WIDTH * laneCount
}

/**
 * 东西向道路面
 * @param {number} lngMin
 * @param {number} lngMax
 * @param {number} lat
 * @param {number} laneCount
 * @param {Object} properties
 * @returns {Object}
 */
function ewRoadSurface(lngMin, lngMax, lat, laneCount, properties) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: rect(
        (lngMin + lngMax) / 2,
        lat,
        (lngMax - lngMin) / 2,
        roadHalfWidth(laneCount)
      )
    },
    properties
  }
}

/**
 * 南北向道路面
 * @param {number} latMin
 * @param {number} latMax
 * @param {number} lng
 * @param {number} laneCount
 * @param {Object} properties
 * @returns {Object}
 */
function nsRoadSurface(latMin, latMax, lng, laneCount, properties) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: rect(
        lng,
        (latMin + latMax) / 2,
        roadHalfWidth(laneCount),
        (latMax - latMin) / 2
      )
    },
    properties
  }
}

/** 灰色道路面（地理宽度 = 车道数 × 单车道宽度） */
export const MOCK_ROAD_SURFACES = {
  type: 'FeatureCollection',
  features: [
    // 东西向主干道（4 车道）
    ewRoadSurface(116.4028, 116.4123, 39.9030, PRIMARY_LANE_COUNT, { road_type: 'primary', name: '创业路' }),
    ewRoadSurface(116.4028, 116.4123, 39.9043, PRIMARY_LANE_COUNT, { road_type: 'primary', name: '科技大道' }),
    ewRoadSurface(116.4028, 116.4123, 39.9057, PRIMARY_LANE_COUNT, { road_type: 'primary', name: '学院路' }),
    // 南北向主干道（4 车道）
    nsRoadSurface(39.9010, 39.9080, 116.4048, PRIMARY_LANE_COUNT, { road_type: 'primary', name: '中央大道' }),
    nsRoadSurface(39.9010, 39.9080, 116.4075, PRIMARY_LANE_COUNT, { road_type: 'primary', name: '中轴路' }),
    nsRoadSurface(39.9010, 39.9080, 116.4103, PRIMARY_LANE_COUNT, { road_type: 'primary', name: '东环路' }),
    // 东西向次级道路（2 车道）
    ewRoadSurface(116.4028, 116.4123, 39.9036, SECONDARY_LANE_COUNT, { road_type: 'secondary', name: '南一支路' }),
    ewRoadSurface(116.4028, 116.4123, 39.9050, SECONDARY_LANE_COUNT, { road_type: 'secondary', name: '北一支路' }),
    // 南北向次级道路（2 车道）
    nsRoadSurface(39.9010, 39.9080, 116.4062, SECONDARY_LANE_COUNT, { road_type: 'secondary', name: '西支路' }),
    nsRoadSurface(39.9010, 39.9080, 116.4089, SECONDARY_LANE_COUNT, { road_type: 'secondary', name: '东支路' })
  ]
}

/**
 * 道路中心线与路名标注（线要素，不含道路面）
 */
export const MOCK_ROADS = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4028, 39.9030], [116.4123, 39.9030]] }, properties: { road_type: 'primary', name: '创业路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4028, 39.9043], [116.4123, 39.9043]] }, properties: { road_type: 'primary', name: '科技大道' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4028, 39.9057], [116.4123, 39.9057]] }, properties: { road_type: 'primary', name: '学院路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4048, 39.9010], [116.4048, 39.9080]] }, properties: { road_type: 'primary', name: '中央大道' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4075, 39.9010], [116.4075, 39.9080]] }, properties: { road_type: 'primary', name: '中轴路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4103, 39.9010], [116.4103, 39.9080]] }, properties: { road_type: 'primary', name: '东环路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4028, 39.9036], [116.4123, 39.9036]] }, properties: { road_type: 'secondary', name: '南一支路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4028, 39.9050], [116.4123, 39.9050]] }, properties: { road_type: 'secondary', name: '北一支路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4062, 39.9010], [116.4062, 39.9080]] }, properties: { road_type: 'secondary', name: '西支路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4089, 39.9010], [116.4089, 39.9080]] }, properties: { road_type: 'secondary', name: '东支路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4028, 39.9030], [116.4123, 39.9030]] }, properties: { marking: 'centerline', name: '创业路中心线' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4028, 39.9043], [116.4123, 39.9043]] }, properties: { marking: 'centerline', name: '科技大道中心线' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4028, 39.9057], [116.4123, 39.9057]] }, properties: { marking: 'centerline', name: '学院路中心线' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4048, 39.9010], [116.4048, 39.9080]] }, properties: { marking: 'centerline', name: '中央大道中心线' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4075, 39.9010], [116.4075, 39.9080]] }, properties: { marking: 'centerline', name: '中轴路中心线' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4103, 39.9010], [116.4103, 39.9080]] }, properties: { marking: 'centerline', name: '东环路中心线' } }
  ]
}

export const MOCK_GROUND = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.40755, 39.9045, 0.00675, 0.0055) },
      properties: {}
    }
  ]
}

export const MOCK_PARKS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4055, 39.9053, 0.0004, 0.00018) },
      properties: { name: '北苑绿地公园' }
    },
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4096, 39.9053, 0.0004, 0.00018) },
      properties: { name: '东区公园' }
    }
  ]
}

export const MOCK_PLAZAS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9043, 0.0004, 0.0002) },
      properties: { name: '科技广场' }
    },
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4055, 39.9036, 0.0003, 0.0001) },
      properties: { name: '南入口广场' }
    }
  ]
}

export const MOCK_PARKING = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4082, 39.9033, 0.00045, 0.00010) },
      properties: { name: 'P1停车场' }
    },
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4096, 39.9040, 0.00045, 0.00018) },
      properties: { name: 'P2停车场' }
    }
  ]
}

export const MOCK_CROSSWALKS = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9030, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9030, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9030, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9030, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9030, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9030, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9043, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9043, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9043, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9043, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9043, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9043, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9057, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9057, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9057, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9057, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9057, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9057, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4062, 39.9043, 0.00005, 0.000015) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4062, 39.9043, 0.000015, 0.000035) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4089, 39.9043, 0.00005, 0.000015) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4089, 39.9043, 0.000015, 0.000035) }, properties: { name: '斑马线' } }
  ]
}
