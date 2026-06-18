/*
 * @Description: 产业园区安防巡检机器人场景 - 常量配置
 *   地图中心、园区 SLAM/矢量配置、机器人、巡逻路线 GPS 路点、门岗 POI、告警类型
 */

import { PARK_GRAPH, computePatrolEdges } from './parkLayout.js'

// ─── 全域地理范围 ─────────────────────────────────────────────────────────────

const LEFT_BOUNDS   = { west: 116.399, east: 116.4050, south: 39.901, north: 39.910 }
const RIGHT_BOUNDS  = { west: 116.4050, east: 116.411, south: 39.901, north: 39.910 }

// ─── 地图基础参数 ─────────────────────────────────────────────────────────────

/** 园区中心 GPS（北京朝阳区某产业园） */
export const MAP_CENTER = [116.4050, 39.9055]
export const MAP_ZOOM   = 16
export const MAP_PITCH  = 50
export const MAP_BEARING = -10

// ─── 机器人配置 ───────────────────────────────────────────────────────────────

export const ROBOT_CONFIGS = [
  {
    id:     'patrol-01',
    name:   '西区-01',
    speed:  0.0003,           // 度/秒（约 2.3 m/s 等效）
    fovColor: '#1677ff',
    markerSize: 32,
    battery: 91,
    status:  'idle',
    task:    '待命',
  },
  {
    id:     'patrol-02',
    name:   '东区-01',
    speed:  0.00025,
    fovColor: '#22c55e',
    markerSize: 32,
    battery: 76,
    status:  'idle',
    task:    '待命',
  },
]

// ─── 图结构巡逻路线配置（从 PARK_GRAPH 动态计算） ─────────────────────────────
//
// 西区全路线：西区所有道路（primary + secondary + tertiary + gate）全面巡逻
// 东区全路线：东区所有道路（primary + secondary + tertiary + gate）全面巡逻

export const PATROL_ROUTE_CONFIGS = {
  'patrol-01': {
    name: '西区全路线',
    description: '负责西区所有道路（主路+小路）的全面巡逻',
    startNodeId: 'ent-b7-e1',
    edgeIds: computePatrolEdges(PARK_GRAPH, {
      roadTypes: ['primary', 'secondary', 'tertiary', 'gate'],
      bounds: LEFT_BOUNDS,
    }),
  },
  'patrol-02': {
    name: '东区全路线',
    description: '负责东区所有道路（主路+小路）的全面巡逻',
    startNodeId: 'ent-b7-e0',
    edgeIds: computePatrolEdges(PARK_GRAPH, {
      roadTypes: ['primary', 'secondary', 'tertiary', 'gate'],
      bounds: RIGHT_BOUNDS,
    }),
  },
}

/** 机器人分散起始位置（对应各路线 startNodeId） */
export const ROBOT_STANDBY_POSITIONS = {
  'patrol-01': [116.403048, 39.90569],  // 机器人待机区南门（西区入口）
  'patrol-02': [116.40282, 39.90589],   // 机器人待机区西门（东区入口）
}

// ─── 告警类型 ─────────────────────────────────────────────────────────────────

export const ALERT_TYPES = {
  MOTION_DETECTED:    { label: '移动侦测', icon: '👤', color: '#f59e0b', level: 'warning' },
  PERIMETER_BREACH:   { label: '周界入侵', icon: '🚨', color: '#ef4444', level: 'critical' },
  UNAUTHORIZED_ACCESS:{ label: '未授权进入', icon: '🔒', color: '#dc2626', level: 'critical' },
  VEHICLE_ALERT:      { label: '可疑车辆', icon: '🚗', color: '#f97316', level: 'warning' },
  DOOR_OPEN:          { label: '门禁触发', icon: '🚪', color: '#06b6d4', level: 'info' },
  TEMPERATURE_ALERT:  { label: '温度异常', icon: '🌡️', color: '#8b5cf6', level: 'warning' },
}

// ─── 模拟安防事件报告类型（复用 ALERT_TYPES 定义） ─────────────────────────────

export const SIMULATED_EVENT_TYPES = ALERT_TYPES

/** 模拟事件描述模板（按类型） */
export const SIMULATED_EVENT_TEMPLATES = {
  MOTION_DETECTED: [
    '{poi}附近检测到异常移动目标',
    '{poi}监控区域发现人员活动异常',
    '{poi}围墙外探测到可疑移动信号',
    '{poi}区域红外传感器触发动检报警',
  ],
  PERIMETER_BREACH: [
    '{poi}区域周界防护系统告警触发',
    '{poi}围墙监测到非法闯入行为',
    '{poi}围栏电子围栏告警，疑似翻越',
  ],
  UNAUTHORIZED_ACCESS: [
    '{poi}检测到未授权门禁刷卡记录',
    '{poi}区域有人员尾随进入',
    '{poi}区域发现未登记访客',
  ],
  VEHICLE_ALERT: [
    '{poi}附近出现未登记车辆',
    '{poi}通道有车辆违规停放',
    '{poi}区域车辆速度异常',
  ],
  DOOR_OPEN: [
    '{poi}门禁系统异常开启',
    '{poi}防火门未按规定关闭',
    '{poi}安全通道门长时间开启告警',
  ],
  TEMPERATURE_ALERT: [
    '{poi}区域温度超出正常范围',
    '{poi}配电柜温度异常升高',
    '{poi}设备机房温度告警上限触发',
  ],
}

/** 模拟事件生成间隔范围（ms） */
export const EVENT_REPORT_INTERVAL = { min: 20000, max: 45000 }

// ─── 电量管理阈值 ─────────────────────────────────────────────────────────────

/** 低电量触发自动返回阈值（%） */
export const LOW_BATTERY_THRESHOLD = 10

/** 电量警告阈值（%）—— 低于此值进入预警状态 */
export const BATTERY_WARNING_THRESHOLD = 20

// ─── 运动参数 ─────────────────────────────────────────────────────────────────

/** 召回时速度倍率 */
export const RECALL_SPEED_MULTIPLIER = 1.5

/** 机器人到达 POI 判断距离（度，约 10m） */
export const ARRIVAL_DIST_DEG = 0.0001

/** FOV 扇形配置 */
export const FOV_CONFIG = {
  enabled: true,
  angle: 70,
  radiusMeters: 25,
  innerOpacity: 0.45,
  outerOpacity: 0.02,
  bands: 10,
  segments: 24,
}


