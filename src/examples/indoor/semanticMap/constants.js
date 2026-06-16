/**
 * 语义地图分割 Demo — SLAM 参数、语义类型与样式预设
 */

/** 工程通用室内 SLAM 地图栅格参数 */
export const SLAM_MAP_CONFIG = {
  startX: -58.999993705749512,
  startY: -21.349997329711914,
  xGridCount: 2752,
  yGridCount: 1536,
  resolution: 0.05
}

const { startX, startY, xGridCount, yGridCount, resolution } = SLAM_MAP_CONFIG

export const MAP_WIDTH_M = xGridCount * resolution
export const MAP_HEIGHT_M = yGridCount * resolution
export const MAP_START_X = startX
export const MAP_START_Y = startY
export const MAP_RESOLUTION = resolution
export const MAP_ZOOM_FACTOR = 2

/**
 * 机器人语义区域类型
 * @enum {string}
 */
export const SEMANTIC_ZONE_TYPE = {
  OFFICE: 'office',
  OPEN_OFFICE: 'open_office',
  MEETING: 'meeting',
  CORRIDOR: 'corridor',
  KITCHEN_REST: 'kitchen_rest',
  CHARGING: 'charging',
  FORBIDDEN: 'forbidden',
  ELEVATOR: 'elevator',
  LOBBY: 'lobby'
}

/** 各语义类型默认渲染样式（fill / outline / 图例文案） */
export const ZONE_STYLE_PRESETS = {
  [SEMANTIC_ZONE_TYPE.OFFICE]: {
    fillColor: '#64B5F6',
    fillOpacity: 0.38,
    outlineColor: '#1565C0',
    outlineWidth: 2,
    outlineDash: null,
    label: '办公室'
  },
  [SEMANTIC_ZONE_TYPE.OPEN_OFFICE]: {
    fillColor: '#64B5F6',
    fillOpacity: 0.35,
    outlineColor: '#1565C0',
    outlineWidth: 2,
    outlineDash: null,
    label: '开放办公区'
  },
  [SEMANTIC_ZONE_TYPE.MEETING]: {
    fillColor: '#F06292',
    fillOpacity: 0.36,
    outlineColor: '#C2185B',
    outlineWidth: 2,
    outlineDash: null,
    label: '会议室'
  },
  [SEMANTIC_ZONE_TYPE.CORRIDOR]: {
    fillColor: '#FFF176',
    fillOpacity: 0.28,
    outlineColor: '#F9A825',
    outlineWidth: 1.5,
    outlineDash: [4, 3],
    label: '走廊'
  },
  [SEMANTIC_ZONE_TYPE.KITCHEN_REST]: {
    fillColor: '#4DB6AC',
    fillOpacity: 0.38,
    outlineColor: '#00695C',
    outlineWidth: 2,
    outlineDash: null,
    label: '厨房/休息区'
  },
  [SEMANTIC_ZONE_TYPE.CHARGING]: {
    fillColor: '#66BB6A',
    fillOpacity: 0.42,
    outlineColor: '#2E7D32',
    outlineWidth: 2,
    outlineDash: null,
    label: '充电区'
  },
  [SEMANTIC_ZONE_TYPE.FORBIDDEN]: {
    fillColor: '#EF5350',
    fillOpacity: 0.32,
    outlineColor: '#C62828',
    outlineWidth: 2,
    outlineDash: [5, 3],
    label: '禁行区'
  },
  [SEMANTIC_ZONE_TYPE.ELEVATOR]: {
    fillColor: '#42A5F5',
    fillOpacity: 0.34,
    outlineColor: '#1565C0',
    outlineWidth: 2,
    outlineDash: [3, 3],
    label: '电梯区'
  },
  [SEMANTIC_ZONE_TYPE.LOBBY]: {
    fillColor: '#FFB74D',
    fillOpacity: 0.34,
    outlineColor: '#EF6C00',
    outlineWidth: 2,
    outlineDash: null,
    label: '接待区'
  }
}

/** 图例展示顺序 */
export const LEGEND_ZONE_TYPES = [
  SEMANTIC_ZONE_TYPE.OFFICE,
  SEMANTIC_ZONE_TYPE.OPEN_OFFICE,
  SEMANTIC_ZONE_TYPE.MEETING,
  SEMANTIC_ZONE_TYPE.CORRIDOR,
  SEMANTIC_ZONE_TYPE.KITCHEN_REST,
  SEMANTIC_ZONE_TYPE.CHARGING,
  SEMANTIC_ZONE_TYPE.FORBIDDEN,
  SEMANTIC_ZONE_TYPE.ELEVATOR,
  SEMANTIC_ZONE_TYPE.LOBBY
]
