// ===== SLAM 地图参数（对应酒店楼层平面图，约 80 m × 50 m）=====
export const MAP_START_X      = -40.0
export const MAP_START_Y      = -25.0
export const MAP_X_GRID_COUNT = 1600
export const MAP_Y_GRID_COUNT = 1000
export const MAP_RESOLUTION   = 0.05
export const MAP_WIDTH        = MAP_X_GRID_COUNT * MAP_RESOLUTION  // 80 m
export const MAP_HEIGHT       = MAP_Y_GRID_COUNT * MAP_RESOLUTION  // 50 m

// ===== 运动参数 =====
export const ROBOT_SPEED  = 5  // m/s
export const UPDATE_MS    = 16    // RAF 动画首帧默认 delta（ms），首个 tick 无真实 dt 时回退至此值
export const ARRIVAL_DIST = 0.5   // 到达判定距离（m）
export const IDLE_HEADING = 90    // 待机朝向：北顺时针 0°，东 = 90°
export const ROTATE_DPS   = 120   // 转向角速度（度/秒），匀速旋转

// 机器人待机区中心（分数坐标，与 ROOM_ROUTES 中 home 节点保持一致）
export const IDLE_FRAC = [0.135, 0.29]

// ===== 视角参数 =====
export const VIEW_3D_PITCH = 60  // 3D 模式默认俯仰角（度）

// ===== 3D 机器人模型配置（酒店配送场景专用）=====
export const DELIVERY_ROBOT_CONFIG = {
  url: '/bicMap/assets/models/RobotExpressive.glb',
  scale: 0.1,
  metersScale: 0.35,
  rotateX: Math.PI / 2,
  rotateY: 0,
  rotateZ: 0,
  animations: {
    idle:  'Idle',
    walk:  'Walking',
    dwell: 'Idle',
  },
  defaultAnimation: 'idle',
}

// ===== 楼层配置 =====
export const FLOOR_CONFIGS = [
  {
    id: '1F',
    label: '1F',
    slamOptions: {
      startX: MAP_START_X, startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT, yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      fitBounds: true
    }
  },
  {
    id: '2F',
    label: '2F',
    slamOptions: {
      startX: MAP_START_X, startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT, yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      fitBounds: true
    }
  }
]
