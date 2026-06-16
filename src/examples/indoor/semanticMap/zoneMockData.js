/**
 * 语义地图 Mock 区域数据
 *
 * 坐标说明：
 * - rect: [x1, y1, x2, y2] 相对 SLAM 地图宽高的分数坐标（0~1）
 * - points: 自定义多边形顶点 [[xFrac, yFrac], ...]（与 rect 二选一）
 * - 修改本文件即可调整区域位置、名称与语义类型，无需改动渲染逻辑
 */

import { SEMANTIC_ZONE_TYPE } from './constants'

/**
 * @typedef {Object} SemanticZoneDef
 * @property {string} id
 * @property {string} type - SEMANTIC_ZONE_TYPE
 * @property {string} name - 区域标注名
 * @property {[number, number, number, number]} [rect]
 * @property {Array<[number, number]>} [points]
 * @property {number} [speedLimit] - 走廊限速（km/h）
 * @property {string} [description]
 * @property {Object} [style] - 覆盖默认样式
 */

/** @type {SemanticZoneDef[]} */
export const SEMANTIC_ZONE_DEFS = [
  // —— 顶部办公区 ——
  {
    id: 'zone-open-office',
    type: SEMANTIC_ZONE_TYPE.OPEN_OFFICE,
    name: '开放办公区',
    points: [
      [0.6069, 0.9489],
      [0.6054, 0.6726],
      [0.6464, 0.5794],
      [0.8667, 0.5803],
      [0.8647, 0.9489],
    ],
  },
  {
    id: 'zone-open-office1',
    type: SEMANTIC_ZONE_TYPE.MEETING,
    name: '电话亭1',
    rect: [0.5578, 0.8009, 0.6059, 0.9471]
  },
  {
    id: 'zone-open-office2',
    type: SEMANTIC_ZONE_TYPE.MEETING,
    name: '电话亭2',
    rect: [0.5592, 0.6695, 0.6045, 0.7975]
  },
  {
    id: 'zone-open-office3',
    type: SEMANTIC_ZONE_TYPE.MEETING,
    name: '电话亭3',
    rect: [0.6426, 0.521, 0.7271, 0.5789]
  },
  {
    id: 'zone-open-office4',
    type: SEMANTIC_ZONE_TYPE.MEETING,
    name: '电话亭4',
    rect: [0.7276, 0.5173, 0.8642, 0.578]
  },
  // —— 上方办公室 ——
  {
    id: 'zone-office1',
    type: SEMANTIC_ZONE_TYPE.OFFICE,
    name: '办公室1',
    rect: [0.3741, 0.5032, 0.4319, 0.6695],
  },
  {
    id: 'zone-office2',
    type: SEMANTIC_ZONE_TYPE.OFFICE,
    name: '办公室2',
    rect: [0.4319, 0.5014, 0.4888, 0.6714],
  },
  {
    id: 'zone-office3',
    type: SEMANTIC_ZONE_TYPE.OFFICE,
    name: '办公室3',
    rect: [0.4909, 0.5014, 0.5566, 0.6677],
  },
  // —— 主走廊 ——
  {
    id: 'zone-lower-corridor',
    type: SEMANTIC_ZONE_TYPE.CORRIDOR,
    name: '走廊',
    points: [
      [0.3075, 0.5004],
      [0.2505, 0.4072],
      [0.3075, 0.4072],
      [0.3065, 0.2646],
      [0.3471, 0.2628],
      [0.3476, 0.4045],
      [0.3706, 0.4036],
      [0.3706, 0.4278],
      [0.712, 0.4242],
      [0.7125, 0.2619],
      [0.7631, 0.2619],
      [0.7626, 0.513],
      [0.6469, 0.5157],
      [0.6464, 0.5794],
      [0.6059, 0.6673],
      [0.5608, 0.6646],
      [0.5608, 0.4996],
      [0.5608, 0.4996],
    ],
    // speedLimit: 1.2,
    description: '主通道'
  },
  // —— 下方办公室 ——
  {
    id: 'zone-right-office-mid',
    type: SEMANTIC_ZONE_TYPE.OFFICE,
    name: '办公室4',
    points: [
      [0.372, 0.4248],
      [0.4158, 0.4238],
      [0.4126, 0.2575],
      [0.3485, 0.2613],
      [0.3485, 0.4042],
      [0.3709, 0.4023],
      [0.3709, 0.4023],
    ]
  },
  {
    id: 'zone-right-office-bot',
    type: SEMANTIC_ZONE_TYPE.OFFICE,
    name: '办公室5',
    rect:  [0.4153, 0.2566, 0.5034, 0.4182],
  },
  {
    id: 'zone-big-meeting-room',
    type: SEMANTIC_ZONE_TYPE.OFFICE,
    name: '办公室6',
    rect: [0.5055, 0.2585, 0.5785, 0.4248],
  },
  {
    id: 'zone-big-meeting-room',
    type: SEMANTIC_ZONE_TYPE.OFFICE,
    name: '办公室7',
    rect: [0.5779, 0.2566, 0.6457, 0.4229],
  },
  {
    id: 'zone-big-meeting-room',
    type: SEMANTIC_ZONE_TYPE.OFFICE,
    name: '办公室8',
    rect: [0.6457, 0.2594, 0.7114, 0.421],
  },
  // —— 最下部区域 ——
  {
    id: 'zone-kitchen-rest',
    type: SEMANTIC_ZONE_TYPE.KITCHEN_REST,
    name: '厨房/休息区',
    rect: [0.711, 0.0753, 0.8642, 0.2592]
  },
  {
    id: 'zone-left-office',
    type: SEMANTIC_ZONE_TYPE.MEETING,
    name: '多人会议室',
    rect: [0.1874, 0.0744, 0.3436, 0.261],
  },
  // —— 机器人相关特殊区域 ——
  {
    id: 'zone-robot-charging1',
    type: SEMANTIC_ZONE_TYPE.CHARGING,
    name: '机器人充电区1',
    rect: [0.307, 0.5004, 0.3721, 0.6682]
  },
  {
    id: 'zone-robot-charging2',
    type: SEMANTIC_ZONE_TYPE.CHARGING,
    name: '机器人充电区2',
    rect: [0.249, 0.2637, 0.306, 0.4045]
  },
  {
    id: 'zone-forbidden',
    type: SEMANTIC_ZONE_TYPE.FORBIDDEN,
    name: '设备间（禁入）',
    rect: [0.7621, 0.2619, 0.8632, 0.3668]
  },
  {
    id: 'zone-forbidden2',
    type: SEMANTIC_ZONE_TYPE.FORBIDDEN,
    name: '禁行区',
    rect: [0.761, 0.3713, 0.8642, 0.5175],
  },
  {
    id: 'zone-elevator',
    type: SEMANTIC_ZONE_TYPE.ELEVATOR,
    name: '电梯厅',
    rect: [0.1458, 0.3857, 0.1909, 0.5507]
  },
  {
    id: 'zone-lobby',
    type: SEMANTIC_ZONE_TYPE.LOBBY,
    name: '访客接待',
    // rect: [0.58, 0.32, 0.63, 0.42],
    points: [
      [0.1869, 0.6735],
      [0.306, 0.6735],
      [0.307, 0.4951],
      [0.2495, 0.4054],
      [0.2485, 0.2619],
      [0.1869, 0.261],
      [0.1859, 0.3874],
      [0.1924, 0.3865],
      [0.1919, 0.5525],
      [0.1869, 0.5525],
      [0.1869, 0.5525],
    ]
  }
]
