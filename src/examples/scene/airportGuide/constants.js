/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-06-09
 * @Description: 飞机场导览 Demo — SLAM 地图、导览状态与折线绘制常量
 * @FilePath: /bic-map-plugin/src/examples/scene/airportGuide/constants.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

/** 机场 SLAM 栅格地图参数（与 slam_airport_transparent.png 2752×1536 一致） */
export const AIRPORT_MAP_CONFIG = {
  startX: -58.999993705749512,
  startY: -21.349997329711914,
  xGridCount: 2752,
  yGridCount: 1536,
  resolution: 0.05,
}

const { startX, startY, xGridCount, yGridCount, resolution } = AIRPORT_MAP_CONFIG

export const MAP_START_X = startX
export const MAP_START_Y = startY
export const MAP_X_GRID_COUNT = xGridCount
export const MAP_Y_GRID_COUNT = yGridCount
export const MAP_RESOLUTION = resolution
export const MAP_WIDTH_M = xGridCount * resolution
export const MAP_HEIGHT_M = yGridCount * resolution
export const MAP_ZOOM_FACTOR = 2
export const MAP_CENTER = [116.4074, 39.9042]
export const MAP_ZOOM = 18

/** 距登机不足该分钟数视为时间紧迫（上海场景） */
export const URGENT_REMAINING_MINUTES = 120

export const JOURNEY_STAGE = {
  IDLE: 'idle',
  ASK_BRANCH: 'askBranch',
  GUIDING: 'guiding',
  COMPLETE: 'complete',
}

export const PROMPT_MODE = {
  SELECT: 'select',
  FLIGHT_FOUND: 'flightFound',
  ASK_FAST_CHECKIN: 'askFastCheckin',
  ASK_BAGGAGE: 'askBaggage',
  READY_DEPART: 'readyDepart',
  GUIDING: 'guiding',
  ARRIVED: 'arrived',
  COMPLETE: 'complete',
}

/** 导览路径线样式（对齐 indoorCleaning / PathReplay） */
export const GUIDE_ROUTE_STYLE = {
  colorStart: '#00F5FF',
  colorEnd: '#00EE00',
  width: 5,
  opacity: 0.85,
  showArrow: true,
  arrowSize: 0.5,
  arrowSpacing: 35,
  arrowImagePath: '/bicMap/assets/svg/arrow.svg',
}

export const GUIDE_ROBOT_ID = 'airport-guide-robot-01'
export const ROBOT_STANDBY_POI_ID = 'poi-robot-standby'
export const ROBOT_IDLE_HEADING = 90
export const GUIDE_SPEED_FRAC_PER_SECOND = 0.12

export const AIRPORT_PROMPTS = {
  selectFlight: '请输入或选择您的航班，开始导览。',
  shanghaiUrgent: '您的航班前往上海，距离登机不足 2 小时，时间较紧。',
  hangzhouRelaxed: '距离登机超过 2 小时，时间充裕。',
  askBaggage: '是否需要办理行李托运？',
  hangzhouAskBaggage: '距离登机超过 2 小时，时间充裕。是否需要办理行李托运？',
  hangzhouConfirmBaggageYes: '我将带你去值机柜台A，请跟我走。',
  hangzhouConfirmBaggageNo: '我将带你去自助值机柜台，无需排队，立即办理。',
  askFastCheckin: '是否需要带你去快速值机？',
  readyDepart: '路线已规划，点击出发前往下一站。',
  guiding: '正在带您前往目的地，请跟紧我。',
  complete: '导览已结束，请在登机口排队上飞机。',
  returnStandby: '正在返回机器人等待区…',
}

export const ARRIVAL_SCRIPTS = {
  'poi-fast-checkin': { title: '快速值机', body: '请在此办理快速值机。' },
  'poi-security-b': { title: '安检口 B', body: '快捷通道，无需排队。' },
  'poi-boarding-b': { title: '登机口 B', body: '请在此排队候机。' },
  'poi-stand-7': { title: '停机位 7', body: '请登机。' },
  'poi-checkin-a': { title: '值机柜台 A', body: '请在此办理行李托运。' },
  'poi-auto-ticket': { title: '自动值机', body: '请在此自助办理值机。' },
  'poi-security-a': { title: '安检口 A', body: '请排队安检。' },
  'poi-waiting-a': { title: '候机区 A', body: '请在此休息等候。' },
  'poi-boarding-a': { title: '登机口 A', body: '请排队登机。' },
  'poi-stand-4': { title: '停机位 4', body: '请登机。' },
}

/** 折线绘制默认样式（对齐 pathReplay 路线色） */
export const DRAWING_OPTIONS = {
  fillColor: '#00F5FF',
  fillOpacity: 0.35,
  lineColor: '#00F5FF',
  lineWidth: 5,
  pointColor: '#09E9F1',
  pointRadius: 6,
  defaultWidth: 0,
  enableTouch: true,
  minPoints: 2,
}
