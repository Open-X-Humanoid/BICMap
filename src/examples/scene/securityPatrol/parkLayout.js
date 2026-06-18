/*
 * @Description: 产业园区 GeoJSON 数据
 *   提供矢量地图底图数据（建筑、道路、围墙、绿化、停车场、门岗等）
 *   园区范围：SW [116.3995, 39.9015] → NE [116.4105, 39.9095]（约 940m × 890m）
 *   坐标系：WGS84，与室外建筑示例使用同一北京区域坐标空间
 */

// ─── 坐标辅助 ─────────────────────────────────────────────────────────────────

import { rect } from '@/bicMap/core/mapFeatures/shape.js'
import { pointInPolygon } from '@/bicMap/core/navigation/pointUtil.js'

// ─── 底图地面 ──────────────────────────────────────────────────────────────────
export const PARK_GROUND = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4050, 39.9055, 0.0060, 0.0045) },
      properties: {}
    }
  ]
}

// ─── 绿化区域 ─────────────────────────────────────────────────────────────────

export const PARK_GREEN = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4050, 39.9055, 0.0006, 0.0005) }, properties: { name: '中央广场绿化' } },


  ]
}

// ─── 停车场 ───────────────────────────────────────────────────────────────────

export const PARK_PARKING = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4025, 39.90274, 0.0012, 0.0004) }, properties: { name: 'P1 停车场' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.90274, 0.0012, 0.0004) }, properties: { name: 'P2 停车场' } },
  ]
}

// ─── 道路网络 ─────────────────────────────────────────────────────────────────
// primary：园区主干道（宽）；secondary：内部服务道（窄）

export const PARK_ROADS = {
  type: 'FeatureCollection',
  features: [
    // 外环：围墙内侧一圈（端点向外延伸 0.000075，使外沿边界线闭合）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.902105], [116.4000, 39.909210]] }, properties: { road_type: 'primary', name: '西环路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4100, 39.902105], [116.4100, 39.909210]] }, properties: { road_type: 'primary', name: '东环路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.399925, 39.909135], [116.410075, 39.909135]] }, properties: { road_type: 'primary', name: '北环路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.399925, 39.90218], [116.410075, 39.90218]] }, properties: { road_type: 'primary', name: '南环路' } },

    // 中轴路：南北贯穿
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4050, 39.90218], [116.4050, 39.909135]] }, properties: { road_type: 'primary', name: '中轴大道' } },

    // 东西横路
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.9055], [116.4100, 39.9055]] }, properties: { road_type: 'secondary', name: '东西干道' } },

    // 内部服务路（已移除东一路、西一路、南一横路）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.9072], [116.4100, 39.9072]] }, properties: { road_type: 'secondary', name: '北一横路' } },

    // 中心线（黄虚线，与外环道路延长量一致）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.90213], [116.4000, 39.909185]] }, properties: { marking: 'centerline' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4100, 39.90213], [116.4100, 39.909185]] }, properties: { marking: 'centerline' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.39995, 39.909135], [116.41005, 39.909135]] }, properties: { marking: 'centerline' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.39995, 39.90218], [116.41005, 39.90218]] }, properties: { marking: 'centerline' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4050, 39.90218], [116.4050, 39.909135]] }, properties: { marking: 'centerline' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.9055], [116.4100, 39.9055]] }, properties: { marking: 'centerline' } },

    // 人行道（sidewalk）
    // 西环路两侧
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.39990, 39.90218], [116.39990, 39.909135]] }, properties: { road_type: 'sidewalk', name: '西环路人行道-西' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.40010, 39.90218], [116.40010, 39.909135]] }, properties: { road_type: 'sidewalk', name: '西环路人行道-东' } },
    // 东环路两侧
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.40990, 39.90218], [116.40990, 39.909135]] }, properties: { road_type: 'sidewalk', name: '东环路人行道-西' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.41010, 39.90218], [116.41010, 39.909135]] }, properties: { road_type: 'sidewalk', name: '东环路人行道-东' } },
    // 北环路两侧
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.909035], [116.4100, 39.909035]] }, properties: { road_type: 'sidewalk', name: '北环路人行道-南' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.909235], [116.4100, 39.909235]] }, properties: { road_type: 'sidewalk', name: '北环路人行道-北' } },
    // 南环路两侧
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.90208], [116.4100, 39.90208]] }, properties: { road_type: 'sidewalk', name: '南环路人行道-南' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.90228], [116.4100, 39.90228]] }, properties: { road_type: 'sidewalk', name: '南环路人行道-北' } },
    // 中轴大道两侧
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.40490, 39.90218], [116.40490, 39.909135]] }, properties: { road_type: 'sidewalk', name: '中轴大道人行道-西' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.40510, 39.90218], [116.40510, 39.909135]] }, properties: { road_type: 'sidewalk', name: '中轴大道人行道-东' } },
    // 东西干道两侧
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.90540], [116.4100, 39.90540]] }, properties: { road_type: 'sidewalk', name: '东西干道人行道-南' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.90560], [116.4100, 39.90560]] }, properties: { road_type: 'sidewalk', name: '东西干道人行道-北' } },

    // ── 小路网络（tertiary，连接主要建筑物的内部支路）──
    // 西区支路：南北向，东西干道 ↔ 北一横路（两端各缩短5m，避免过度延伸）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.40194, 39.9055], [116.40194, 39.9072]] }, properties: { road_type: 'tertiary', name: '西一支路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4038, 39.906235], [116.4038, 39.9072]] }, properties: { road_type: 'tertiary', name: '西二支路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4038, 39.9067], [116.40414, 39.9067]] }, properties: { road_type: 'tertiary', name: '数据中心连接路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.40194, 39.90589], [116.40270, 39.90589]] }, properties: { road_type: 'tertiary', name: '机器人待机区连接路' } },
    // 机器人待机区南引道：机器人待机区南侧 → 东西干道
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.403048, 39.90559], [116.403048, 39.9055]] }, properties: { road_type: 'tertiary', name: '机器人待机区南引道' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.40194, 39.906235], [116.4038, 39.906235]] }, properties: { road_type: 'tertiary', name: '安防中心北连接路' } },
    // 东区支路：南北向，东西干道 ↔ 北一横路（两端各缩短5m，避免过度延伸）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4065, 39.9055], [116.4065, 39.9072]] }, properties: { road_type: 'tertiary', name: '东一支路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4087, 39.9055], [116.4087, 39.9072]] }, properties: { road_type: 'tertiary', name: '东二支路' } },
    // 南区支路：南北向（已移除南一支路和南二支路——穿过总部办公楼和研发中心底部）
    // 南区横路：会议中心右侧中部 → 中轴大道（经总部办公楼南侧交汇，西端东移2m脱离会议中心）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.400965, 39.90360], [116.40232, 39.90360], [116.4050, 39.90360]] }, properties: { road_type: 'tertiary', name: '南区横路' } },
    // 总部办公楼南引道：总部办公楼南入口 → 南区横路交汇点 → P1停车场（端点外移2m脱离建筑/停车场）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.40232, 39.90392], [116.40232, 39.90360], [116.40232, 39.90312]] }, properties: { road_type: 'tertiary', name: '总部办公楼南引道' } },
    // 南区横路东段：中轴大道东侧 → 研发中心中部 → 东环路（对称于西段，西端接入中轴大道）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4050, 39.90360], [116.40768, 39.90360], [116.4100, 39.90360]] }, properties: { road_type: 'tertiary', name: '南区横路东段' } },
    // 研发中心南引道：研发中心南入口 → 南区横路东段交汇点 → P2停车场（端点外移2m脱离建筑/停车场）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.40768, 39.90392], [116.40768, 39.90360], [116.40768, 39.90312]] }, properties: { road_type: 'tertiary', name: '研发中心南引道' } },
    // 餐厅北引道：餐厅右侧中部 → 向东延伸
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.40127, 39.90612], [116.40194, 39.90612]] }, properties: { road_type: 'tertiary', name: '餐厅北引道' } },
    // （已移除餐厅连接路——横穿餐厅建筑内部）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4065, 39.90623], [116.40935, 39.90623]] }, properties: { road_type: 'tertiary', name: '能源中心连接路' } },
    // （已移除总部办公楼连接路和研发中心连接路——位于建筑底部，与建筑重叠）
    // 北厂房南侧连接路（分西/东两段，中间为仓库区，内侧接中轴大道，外侧接环路）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4000, 39.9082], [116.4050, 39.9082]] }, properties: { road_type: 'tertiary', name: '北厂房南连接路-西段' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4050, 39.9082], [116.4100, 39.9082]] }, properties: { road_type: 'tertiary', name: '北厂房南连接路-东段' } },
    // AB、CD之间南北向小路连接
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4025, 39.9072], [116.4025, 39.909135]] }, properties: { road_type: 'tertiary', name: '厂房AB连接路' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4075, 39.9072], [116.4075, 39.909135]] }, properties: { road_type: 'tertiary', name: '厂房CD连接路' } },
    // 仓库A连接路：仓库A西侧中部 → 厂房AB连接路（终点距仓库A西墙约3.4m）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4025, 39.90782], [116.40404, 39.90782]] }, properties: { road_type: 'tertiary', name: '仓库A连接路' } },
    // 仓储中心东侧连接路：仓储中心中部东侧 → 厂房CD连接路（南移20m）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.40620, 39.90780], [116.4075, 39.90780]] }, properties: { road_type: 'tertiary', name: '仓储中心连接路' } },
    // 仓库西侧连接路：厂房CD连接路 → 仓库中部西侧（北移10m，东端点移出仓库建筑范围）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4075, 39.90798], [116.40935, 39.90798]] }, properties: { road_type: 'tertiary', name: '仓库连接路' } },
  ]
}

// ─── 人行横道 ─────────────────────────────────────────────────────────────────

export const PARK_CROSSWALKS = {
  type: 'FeatureCollection',
  features: [
    // 北门
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4050, 39.909135, 0.00009, 0.000015) }, properties: {} },
    // 南门
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4050, 39.90218, 0.00009, 0.000015) }, properties: {} },
    // 东门
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4100, 39.9055, 0.000015, 0.00007) }, properties: {} },
    // 中轴×东西干道交叉口
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4050, 39.9055, 0.00007, 0.000015) }, properties: {} },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4050, 39.9055, 0.000015, 0.00005) }, properties: {} },
  ]
}

// ─── 门岗点（circle + label 用） ─────────────────────────────────────────────

export const PARK_GATES = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [116.4050, 39.909135] }, properties: { name: '北门', type: 'gate' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [116.4050, 39.90218] }, properties: { name: '南门', type: 'gate' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [116.4100, 39.9055] }, properties: { name: '东门', type: 'gate' } },
  ]
}

// ─── 路口节点（Intersections） ───────────────────────────────────────────────

export const PARK_INTERSECTIONS = {
  nodes: [
    { id: 'int-nw',     coordinates: [116.4000, 39.909135], roads: ['西环路', '北环路'],     priority: 'primary' },
    { id: 'int-ne',     coordinates: [116.4100, 39.909135], roads: ['东环路', '北环路'],     priority: 'primary' },
    { id: 'int-sw',     coordinates: [116.4000, 39.90218],  roads: ['西环路', '南环路'],     priority: 'primary' },
    { id: 'int-se',     coordinates: [116.4100, 39.90218],  roads: ['东环路', '南环路'],     priority: 'primary' },
    { id: 'int-north',  coordinates: [116.4050, 39.909135], roads: ['中轴大道', '北环路'],    priority: 'primary' },
    { id: 'int-south',  coordinates: [116.4050, 39.90218],  roads: ['中轴大道', '南环路'],    priority: 'primary' },
    { id: 'int-center', coordinates: [116.4050, 39.9055],   roads: ['中轴大道', '东西干道'],  priority: 'primary' },
    { id: 'int-west',   coordinates: [116.4000, 39.9055],   roads: ['西环路', '东西干道'],   priority: 'secondary' },
    { id: 'int-east',   coordinates: [116.4100, 39.9055],   roads: ['东环路', '东西干道'],   priority: 'secondary' },
    { id: 'int-northwest', coordinates: [116.4000, 39.9072], roads: ['西环路', '北一横路'], priority: 'secondary' },
    { id: 'int-northeast', coordinates: [116.4100, 39.9072], roads: ['东环路', '北一横路'], priority: 'secondary' },
    { id: 'int-midwest',   coordinates: [116.4050, 39.9072], roads: ['中轴大道', '北一横路'], priority: 'secondary' },

    // ── 小路 × 主路/次级路交叉口 ──
    { id: 'int-west-1',  coordinates: [116.40194, 39.9055], roads: ['西一支路', '东西干道'],  priority: 'tertiary' },
    { id: 'int-west-2',  coordinates: [116.4038, 39.906235], roads: ['西二支路'],  priority: 'tertiary' },
    { id: 'int-east-1',  coordinates: [116.4065, 39.9055], roads: ['东一支路', '东西干道'],  priority: 'tertiary' },
    { id: 'int-east-2',  coordinates: [116.4087, 39.9055], roads: ['东二支路', '东西干道'],  priority: 'tertiary' },
    { id: 'int-midwest-1', coordinates: [116.40194, 39.9072], roads: ['西一支路', '北一横路'], priority: 'tertiary' },
    { id: 'int-data-west', coordinates: [116.4038, 39.9067], roads: ['西二支路', '数据中心连接路'], priority: 'tertiary' },
    { id: 'int-canteen-w1', coordinates: [116.40194, 39.90612], roads: ['西一支路', '餐厅北引道'], priority: 'tertiary' },
    { id: 'int-robot-west', coordinates: [116.40194, 39.90589], roads: ['西一支路', '机器人待机区连接路'], priority: 'tertiary' },
    // 机器人待机区南引道 × 东西干道交叉口
    { id: 'int-robot-south', coordinates: [116.403048, 39.9055], roads: ['东西干道', '机器人待机区南引道'], priority: 'tertiary' },
    { id: 'int-security-north', coordinates: [116.40194, 39.906235], roads: ['西一支路', '安防中心北连接路'], priority: 'tertiary' },
    { id: 'int-midwest-2', coordinates: [116.4038, 39.9072], roads: ['西二支路', '北一横路'], priority: 'tertiary' },
    { id: 'int-mideast-1', coordinates: [116.4065, 39.9072], roads: ['东一支路', '北一横路'], priority: 'tertiary' },
    { id: 'int-mideast-2', coordinates: [116.4087, 39.9072], roads: ['东二支路', '北一横路'], priority: 'tertiary' },
    // 南区横路交叉口
    { id: 'int-south-meet', coordinates: [116.40232, 39.90360], roads: ['南区横路', '总部办公楼南引道'], priority: 'tertiary' },
    { id: 'int-rd-meet', coordinates: [116.40768, 39.90360], roads: ['南区横路东段', '研发中心南引道'], priority: 'tertiary' },
    // AB、CD连接路交叉口
    { id: 'int-ab-south', coordinates: [116.4025, 39.9072], roads: ['厂房AB连接路', '北一横路'], priority: 'tertiary' },
    { id: 'int-ab-north', coordinates: [116.4025, 39.90907], roads: ['厂房AB连接路', '北厂房北连接路'], priority: 'tertiary' },
    { id: 'int-cd-south', coordinates: [116.4075, 39.9072], roads: ['厂房CD连接路', '北一横路'], priority: 'tertiary' },
    { id: 'int-cd-north', coordinates: [116.4075, 39.90907], roads: ['厂房CD连接路', '北厂房北连接路'], priority: 'tertiary' },
    // 北厂房南连接路 × 环路交叉口
    { id: 'int-factory-sw', coordinates: [116.4000, 39.9082], roads: ['北厂房南连接路-西段', '西环路'], priority: 'tertiary' },
    { id: 'int-factory-se', coordinates: [116.4100, 39.9082], roads: ['北厂房南连接路-东段', '东环路'], priority: 'tertiary' },
    // 北厂房南连接路 × AB/CD连接路交叉口
    { id: 'int-factory-ab', coordinates: [116.4025, 39.9082], roads: ['北厂房南连接路-西段', '厂房AB连接路'], priority: 'tertiary' },
    { id: 'int-factory-cd', coordinates: [116.4075, 39.9082], roads: ['北厂房南连接路-东段', '厂房CD连接路'], priority: 'tertiary' },
    // 北厂房南连接路 × 中轴大道交叉口
    { id: 'int-factory-axis', coordinates: [116.4050, 39.9082], roads: ['北厂房南连接路-西段', '北厂房南连接路-东段', '中轴大道'], priority: 'tertiary' },
    // 仓库A连接路交叉口
    { id: 'int-warehouse-a-west', coordinates: [116.4025, 39.90782], roads: ['厂房AB连接路', '仓库A连接路'], priority: 'tertiary' },
    // 仓储中心/CD连接路交叉口
    { id: 'int-storage-cd', coordinates: [116.4075, 39.90780], roads: ['厂房CD连接路', '仓储中心连接路'], priority: 'tertiary' },
    // 仓库/CD连接路交叉口
    { id: 'int-loading-cd', coordinates: [116.4075, 39.90798], roads: ['厂房CD连接路', '仓库连接路'], priority: 'tertiary' },
    // 能源中心连接路交叉口
    { id: 'int-energy-west', coordinates: [116.4065, 39.90623], roads: ['东一支路', '能源中心连接路'], priority: 'tertiary' },
    { id: 'int-energy-east', coordinates: [116.40935, 39.90623], roads: ['能源中心连接路'], priority: 'tertiary' },
  ]
}

// ─── 建筑物（供 createBuildings 使用） ───────────────────────────────────────
// 布局：园区内按功能分区

export const PARK_BUILDINGS = {
  type: 'FeatureCollection',
  features: [
    // ══════════ 北区（北环路~北一横路，y: 39.9075~39.9087）══════════════
    // ── A1 西侧地块（西环路~中轴大道）—— 厂房A + 厂房B ──
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4013, 39.9086, 0.0011, 0.00035) }, properties: { height: 28, base_height: 0, color: '#8ca8c8', name: '厂房A', entrances: [[116.4013, 39.90825], [116.4013, 39.90895]] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4037, 39.9086, 0.0011, 0.00035) }, properties: { height: 22, base_height: 0, color: '#8ca8c8', name: '厂房B', entrances: [[116.4037, 39.90825], [116.4037, 39.90895]] } },

    // ── A2 东侧地块（中轴大道~东环路）—— 厂房C + 厂房D ──
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4063, 39.9086, 0.0011, 0.00035) }, properties: { height: 22, base_height: 0, color: '#8ca8c8', name: '厂房C', entrances: [[116.4063, 39.90825], [116.4063, 39.90895]] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4087, 39.9086, 0.0011, 0.00035) }, properties: { height: 20, base_height: 0, color: '#8ca8c8', name: '厂房D', entrances: [[116.4087, 39.90825], [116.4087, 39.90895]] } },

    // ══════════ 中北区（北一横路~东西干道，y: 39.9058~39.9069）══════════
    // ── B1 西侧地块（西环路~中轴大道） ──
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4010, 39.90676, 0.0008, 0.00035) }, properties: { height: 35, base_height: 0, color: '#7c5cf4', name: '创新中心', entrances: [[116.4010, 39.90641]] } },
    // 创新中心下方 10m — 餐厅
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40077, 39.90612, 0.0005, 0.00020) }, properties: { height: 10, base_height: 0, color: '#FF8C00', name: '餐厅', entrances: [[116.40077, 39.90592]] } },
    // 配电房已移走
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4038, 39.90589, 0.00030, 0.00030) }, properties: { height: 12, base_height: 0, color: '#4682B4', name: '安防中心', entrances: [[116.4038, 39.90559]] } },
    // 安防中心西侧约 10m — 机器人待机区
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40305, 39.90589, 0.00035, 0.00030) }, properties: { height: 3, base_height: 0, color: '#E6D9F0', name: '机器人待机区', entrances: [[116.40270, 39.90589], [116.403048, 39.90559]] } },

    // 靠近厂房的中轴大道西侧 — 装卸车间（已移走）
    // ── B2 东侧地块（中轴大道~东环路）已移除实验中心/数据中心 ──

    // ══════════ 创新中心东侧 — 实验中心 / 数据中心 / 测试中心（依次排开）════
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40254, 39.90676, 0.0005, 0.00035) }, properties: { height: 30, base_height: 0, color: '#7c5cf4', name: '实验中心', entrances: [[116.40254, 39.90641]] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40449, 39.90676, 0.00035, 0.00025) }, properties: { height: 18, base_height: 0, color: '#0598b4', name: '数据中心', entrances: [[116.40449, 39.90651], [116.40414, 39.9067]] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40578, 39.90658, 0.00060, 0.00044) }, properties: { height: 20, base_height: 0, color: '#5b8db8', name: '测试中心', entrances: [[116.40578, 39.90614]] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40722, 39.90667, 0.00060, 0.00035) }, properties: { height: 18, base_height: 0, color: '#94a3b8', name: '能源中心', entrances: [[116.40722, 39.90632]] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40910, 39.90658, 0.00025, 0.00030) }, properties: { height: 8, base_height: 0, color: '#94a3b8', name: '配电房', entrances: [[116.40910, 39.90628]] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40830, 39.90658, 0.00025, 0.00025) }, properties: { height: 8, base_height: 0, color: '#94a3b8', name: '空压机房', entrances: [[116.40830, 39.90633]] } },

    // ══════════ 中南区（东西干道~南环路，y: 39.9023~39.9052）══════════
    // ── C1 西侧（西环路~西一路）已移除能源中心/空压机房 ──

    // ── C2 中西侧 — 总部办公楼（占满左侧区域，距道路 15m，避开绿化） ──
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40232, 39.90461, 0.00202, 0.00067) }, properties: { height: 80, base_height: 0, color: '#4a90d9', name: '总部办公楼', entrances: [[116.40232, 39.90394], [116.40232, 39.90528]] } },

    // ── C3 中东侧 — 研发中心（与总部办公楼对称） ──
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40768, 39.90461, 0.00202, 0.00067) }, properties: { height: 55, base_height: 0, color: '#4a90d9', name: '研发中心', entrances: [[116.40768, 39.90394], [116.40768, 39.90528]] } },

    // ══════════ 厂房B/C 南侧 — 仓库区（放大两倍，距厂房约 10m）════════════
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40444, 39.90784, 0.00036, 0.00032) }, properties: { height: 10, base_height: 0, color: '#a0aec0', name: '仓库A', entrances: [[116.40444, 39.90752]] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40570, 39.90780, 0.00050, 0.00036) }, properties: { height: 14, base_height: 0, color: '#a0aec0', name: '仓储中心', entrances: [[116.40570, 39.90744]] } },

    // ══════════ 南区（东西干道~南环路，y: 39.9023~39.9052）══════════════
    // ── D1 西侧地块（西环路~中轴大道） ──
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40059, 39.90360, 0.00035, 0.00025) }, properties: { height: 15, base_height: 0, color: '#60a5fa', name: '会议中心', entrances: [[116.40059, 39.90335]] } },

    // ── D2 东侧地块（中轴大道~东环路）已移除测试中心 ──

    // ══════════ 厂房D 南侧 — 仓库区（距厂房D 约 10m，距东环路同厂房D）════════
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40960, 39.90796, 0.00020, 0.00020) }, properties: { height: 10, base_height: 0, color: '#a0aec0', name: '仓库', entrances: [[116.40960, 39.90776]] } },
  ]
}

// ─── 静态障碍物（Obstacles） ──────────────────────────────────────────────────

export const PARK_OBSTACLES = {
  type: 'FeatureCollection',
  features: [
    // 围墙：园区外环边界线（略微外扩）
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.3995, 39.9019], [116.4105, 39.9019], [116.4105, 39.9094], [116.3995, 39.9094], [116.3995, 39.9019]] }, properties: { name: '园区围墙', obstacle_type: 'fence' } },

    // 绿化隔离带：中央广场绿化周围的花坛/路沿石
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40439, 39.90514, 0.00001, 0.00016) }, properties: { name: '绿化西隔离带-南', obstacle_type: 'barrier' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40439, 39.90586, 0.00001, 0.00016) }, properties: { name: '绿化西隔离带-北', obstacle_type: 'barrier' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40561, 39.90514, 0.00001, 0.00016) }, properties: { name: '绿化东隔离带-南', obstacle_type: 'barrier' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40561, 39.90586, 0.00001, 0.00016) }, properties: { name: '绿化东隔离带-北', obstacle_type: 'barrier' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.404625, 39.90499, 0.000225, 0.00001) }, properties: { name: '绿化南隔离带-西', obstacle_type: 'barrier' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.405375, 39.90499, 0.000225, 0.00001) }, properties: { name: '绿化南隔离带-东', obstacle_type: 'barrier' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.404625, 39.90601, 0.000225, 0.00001) }, properties: { name: '绿化北隔离带-西', obstacle_type: 'barrier' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.405375, 39.90601, 0.000225, 0.00001) }, properties: { name: '绿化北隔离带-东', obstacle_type: 'barrier' } },

    // 仓库区与厂房之间的狭窄不可通行缝隙
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40453, 39.90808, 0.00007, 0.00004) }, properties: { name: '仓库A北侧缝隙', obstacle_type: 'narrow_gap' } },
  ]
}

// ─── 功能语义分区（Semantic Zones） ───────────────────────────────────────────

export const PARK_SEMANTIC_ZONES = {
  type: 'FeatureCollection',
  features: [
    // 设备区：配电房周围
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40910, 39.90658, 0.00028, 0.00033) }, properties: { zoneType: 'service_area', name: '配电设备区' } },
    // 设备区：空压机房周围
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40830, 39.90658, 0.00028, 0.00030) }, properties: { zoneType: 'service_area', name: '空压设备区' } },
    // 危险区：能源中心周围
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.40722, 39.90667, 0.00065, 0.000399) }, properties: { zoneType: 'forbidden', name: '能源中心危险区' } },
    // 停车区：P1 停车场
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4025, 39.90274, 0.0012, 0.0004) }, properties: { zoneType: 'service_area', name: 'P1 停车区' } },
    // 停车区：P2 停车场
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.90274, 0.0012, 0.0004) }, properties: { zoneType: 'service_area', name: 'P2 停车区' } },
  ]
}

// ─── Graph 数据生成工具 ──────────────────────────────────────────────────────

/**
 * 点到线段距离
 */
function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return { distance: Math.hypot(px - ax, py - ay), t: 0 }
  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return { distance: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t }
}

function gpsDistance(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

/**
 * 判断线段内部是否穿过任意建筑（采样中点法）
 *
 * 沿线段等距采样若干内部点，若有任意采样点落在某个建筑多边形内部，
 * 则认为该线段穿过建筑。采样内部点（不含端点）可避免入口节点恰好
 * 落在建筑边界上导致的误判。
 *
 * @param {[number,number]} a - 线段起点 [lng, lat]
 * @param {[number,number]} b - 线段终点 [lng, lat]
 * @param {[number,number][][]} buildingPolygons - 建筑多边形列表（GPS 坐标环）
 * @param {number} [samples=24] - 采样段数
 * @returns {boolean}
 */
function segmentPassesThroughBuilding(a, b, buildingPolygons, samples = 24) {
  for (const polygon of buildingPolygons) {
    for (let k = 1; k < samples; k++) {
      const t = k / samples
      const x = a[0] + (b[0] - a[0]) * t
      const y = a[1] + (b[1] - a[1]) * t
      if (pointInPolygon(x, y, polygon)) return true
    }
  }
  return false
}

/** 提取所有建筑多边形外环（GPS 坐标） */
function getBuildingPolygons() {
  return PARK_BUILDINGS.features
    .filter(feature => feature.geometry.type === 'Polygon')
    .map(feature => feature.geometry.coordinates[0])
}

const SNAP_THRESHOLD = 0.00005 // 约 5m
export const WEIGHT_SCALE = 85000

/**
 * 从 PARK_ROADS 道路数据自动生成边集
 */
function generateEdgesFromRoads(nodes) {
  const nodeMap = {}
  for (const node of nodes) nodeMap[node.id] = node

  const buildingPolygons = getBuildingPolygons()

  const edges = []
  const edgeSet = new Set()
  const edgeSeqCounters = new Map()

  function addEdge(fromId, toId, weight, allowedTypes, roadType = null, displayName = null) {
    const key = [fromId, toId].sort().join('|')
    if (edgeSet.has(key)) return false

    // 拒绝任何内部穿过建筑的边，保证图里"只沿道路走"
    const fromNode = nodeMap[fromId], toNode = nodeMap[toId]
    if (fromNode && toNode
      && segmentPassesThroughBuilding(fromNode.coordinates, toNode.coordinates, buildingPolygons)) {
      return false
    }

    edgeSet.add(key)

    let id
    if (displayName) {
      const seq = edgeSeqCounters.get(displayName) || 0
      edgeSeqCounters.set(displayName, seq + 1)
      id = `e-${displayName}-${seq}`
    } else {
      id = `e-${fromId}-${toId}`
    }

    edges.push({
      id,
      from: fromId, to: toId, weight,
      constraints: { direction: 'both', allowedTypes },
      roadType,
    })
    return true
  }

  function computeWeight(a, b) {
    return Math.round(gpsDistance(a, b) * WEIGHT_SCALE)
  }

  // ── 道路边：沿每条道路连接所有吸附节点 ──
  for (const road of PARK_ROADS.features) {
    const roadType = road.properties?.road_type
    if (road.properties?.marking === 'centerline' || roadType === 'sidewalk') continue

    const roadCoords = road.geometry.coordinates
    const roadName = road.properties?.name || 'unknown'

    const snapped = []
    for (const node of nodes) {
      let best = null
      for (let si = 0; si < roadCoords.length - 1; si++) {
        const r = pointToSegmentDistance(
          node.coordinates[0], node.coordinates[1],
          roadCoords[si][0], roadCoords[si][1],
          roadCoords[si + 1][0], roadCoords[si + 1][1]
        )
        if (r.distance < SNAP_THRESHOLD && (!best || r.distance < best.distance)) {
          best = { t: r.t, si }
        }
      }
      if (best) snapped.push({ nodeId: node.id, pos: best.si + best.t })
    }

    snapped.sort((a, b) => a.pos - b.pos)

    for (let i = 0; i < snapped.length - 1; i++) {
      const fn = nodeMap[snapped[i].nodeId], tn = nodeMap[snapped[i + 1].nodeId]
      if (!fn || !tn) continue
      addEdge(fn.id, tn.id, computeWeight(fn.coordinates, tn.coordinates), ['robot', 'vehicle'], roadType, roadName)
    }
  }

  // ── 建筑入口 → 最近道路节点（robot 专用）──
  const entranceNodes = nodes.filter(n => n.type === 'entrance')
  const roadNodes = nodes.filter(n => n.type === 'road_vertex')

  for (const ent of entranceNodes) {
    // 在"连线不穿建筑"的候选里按距离从近到远取第一个
    const candidates = roadNodes
      .map(rn => ({ rn, d: gpsDistance(ent.coordinates, rn.coordinates) }))
      .filter(c => c.d < 0.002)
      .sort((a, b) => a.d - b.d)

    for (const { rn } of candidates) {
      if (segmentPassesThroughBuilding(ent.coordinates, rn.coordinates, buildingPolygons)) continue
      addEdge(ent.id, rn.id, computeWeight(ent.coordinates, rn.coordinates), ['robot'], 'entrance', ent.building || 'entrance')
      break
    }
  }

  // ── 门禁 → 最近道路节点 ──
  const gateNodes = nodes.filter(n => n.type === 'gate')
  const roadVertexNodes = nodes.filter(n => n.type === 'road_vertex')

  for (const gate of gateNodes) {
    const candidates = roadVertexNodes
      .map(rv => ({ rv, d: gpsDistance(gate.coordinates, rv.coordinates) }))
      .filter(c => c.d < 0.001)
      .sort((a, b) => a.d - b.d)

    for (const { rv } of candidates) {
      if (segmentPassesThroughBuilding(gate.coordinates, rv.coordinates, buildingPolygons)) continue
      addEdge(gate.id, rv.id, computeWeight(gate.coordinates, rv.coordinates), ['robot', 'vehicle'], 'gate', gate.name || 'gate')
      break
    }
  }

  return edges
}

/**
 * 按道路类型 + 地理范围筛选 graph 边
 *
 * @param {Object} graph - PARK_GRAPH
 * @param {Object} [options]
 * @param {string[]} [options.roadTypes] - 道路类型筛选（primary/secondary/tertiary/entrance/gate）
 * @param {{ west:number, east:number, south:number, north:number }} [options.bounds] - 地理范围（边中点在范围内）
 * @returns {string[]} 匹配的 edge ID 列表
 */
export function computePatrolEdges(graph, { roadTypes, bounds } = {}) {
  const nodeCoordMap = {}
  for (const node of graph.nodes) nodeCoordMap[node.id] = node.coordinates

  return graph.edges
    .filter(edge => {
      if (roadTypes && roadTypes.length > 0 && !roadTypes.includes(edge.roadType)) return false
      if (bounds) {
        const fromCoord = nodeCoordMap[edge.from]
        const toCoord = nodeCoordMap[edge.to]
        if (!fromCoord || !toCoord) return false
        const midLng = (fromCoord[0] + toCoord[0]) / 2
        const midLat = (fromCoord[1] + toCoord[1]) / 2
        if (midLng < bounds.west || midLng > bounds.east || midLat < bounds.south || midLat > bounds.north) return false
      }
      return true
    })
    .map(e => e.id)
}

// ─── Graph 数据结构（节点从道路顶点提取 + 入口/门禁附属） ──────────────────────

const COORD_EPSILON = 0.000002 // 约 0.2m 去重精度

export const PARK_GRAPH = {
  nodes: [
    // ── 道路顶点节点（从 PARK_ROADS 提取，去重）──
    ...(function () {
      const nodeMap = new Map()
      let index = 0

      function addNode(coordinates, type, extra = {}) {
        const name = coordinates[0].toFixed(7) + ',' + coordinates[1].toFixed(7)
        if (nodeMap.has(name)) return
        nodeMap.set(name, {
          id: `rv-${index++}`,
          type,
          coordinates,
          ...extra,
        })
      }

      for (const road of PARK_ROADS.features) {
        if (road.properties?.marking === 'centerline' || road.properties?.road_type === 'sidewalk') continue
        for (const coord of road.geometry.coordinates) {
          addNode(coord, 'road_vertex')
        }
      }

      // 邻近点合并：坐标差 < COORD_EPSILON 的合并为一个节点
      const names = [...nodeMap.keys()]
      for (let i = 0; i < names.length; i++) {
        const nodeA = nodeMap.get(names[i])
        for (let j = i + 1; j < names.length; j++) {
          const nodeB = nodeMap.get(names[j])
          if (!nodeB) continue
          if (
            Math.abs(nodeA.coordinates[0] - nodeB.coordinates[0]) < COORD_EPSILON &&
            Math.abs(nodeA.coordinates[1] - nodeB.coordinates[1]) < COORD_EPSILON
          ) {
            nodeMap.delete(names[j])
          }
        }
      }

      return [...nodeMap.values()]
    })(),

    // ── 建筑入口节点（来自 PARK_BUILDINGS）──
    ...(function () {
      const entranceNodes = []
      for (let bi = 0; bi < PARK_BUILDINGS.features.length; bi++) {
        const building = PARK_BUILDINGS.features[bi]
        const bldName = building.properties?.name
        const entrances = building.properties?.entrances || []
        for (let ei = 0; ei < entrances.length; ei++) {
          entranceNodes.push({
            id: `ent-b${bi}-e${ei}`,
            type: 'entrance',
            coordinates: entrances[ei],
            building: bldName,
          })
        }
      }
      return entranceNodes
    })(),

    // ── 门禁节点（来自 PARK_GATES）──
    ...PARK_GATES.features.map((gate, gi) => ({
      id: `gate-${gi}`,
      type: 'gate',
      coordinates: gate.geometry.coordinates,
      name: gate.properties.name,
    })),
  ],
  edges: [], // 下面填充
}

// 从道路数据自动生成边
PARK_GRAPH.edges = generateEdgesFromRoads(PARK_GRAPH.nodes)

// ─── 构建园区 GeoJSON（汇总给 addMockBasemap 使用） ──────────────────────────

/**
 * 返回矢量地图所需的所有 GeoJSON 数据集
 * @returns {{ ground, green, parking, roads, crosswalks, gates, buildings, intersections, obstacles, semanticZones, graph, version }}
 */
export function buildParkVectorData() {
  return {
    ground:        PARK_GROUND,
    green:         PARK_GREEN,
    parking:       PARK_PARKING,
    roads:         PARK_ROADS,
    crosswalks:    PARK_CROSSWALKS,
    gates:         PARK_GATES,
    buildings:     PARK_BUILDINGS,
    intersections: PARK_INTERSECTIONS,
    obstacles:     PARK_OBSTACLES,
    semanticZones: PARK_SEMANTIC_ZONES,
    graph:         PARK_GRAPH,
    version:       '1.4.9',
  }
}
