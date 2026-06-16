export const JOURNEY_STAGE = {
  IDLE: 'idle',
  TICKET: 'ticket',
  WAITING: 'waiting',
  CHECK: 'check',
  BOARDING: 'boarding',
  COMPLETE: 'complete',
}

export const TRIP_STATUS = {
  WAITING: 'waiting',
  CHECKING: 'checking',
  BOARDING: 'boarding',
  DEPARTED: 'departed',
}

export const TRIP_STATUS_LABEL = {
  [TRIP_STATUS.WAITING]: '候车中',
  [TRIP_STATUS.CHECKING]: '正在检票',
  [TRIP_STATUS.BOARDING]: '准备上车',
  [TRIP_STATUS.DEPARTED]: '已发车',
}

export const ROUTE_SOURCE_ID = 'passenger-route-source'
export const ROUTE_LAYER_ID = 'passenger-route-line-layer'
export const AREA_SOURCE_ID = 'passenger-area-source'
export const AREA_FILL_LAYER_ID = 'passenger-area-fill-layer'
export const AREA_OUTLINE_LAYER_ID = 'passenger-area-outline-layer'
export const HIGHLIGHT_SOURCE_ID = 'passenger-highlight-source'
export const HIGHLIGHT_LAYER_ID = 'passenger-highlight-layer'

export const GUIDE_ROBOT_ID = 'passenger-guide-robot-01'
export const ROBOT_STANDBY_POI_ID = 'poi-robot-standby'
export const ROBOT_IDLE_HEADING = 90
export const GUIDE_SPEED_FRAC_PER_SECOND = 0.10
export const BOARDING_AUTO_RETURN_DELAY_MS = 1000

export const GUIDE_GRID_COLS = 72
export const GUIDE_GRID_ROWS = 72
export const GUIDE_OBSTACLE_MARGIN = 0.018
export const GUIDE_TURN_PENALTY = 2.8
export const GUIDE_DIAGONAL_PENALTY = 0.8
export const GUIDE_MIN_SMOOTH_CLEARANCE = 1

export const STATION_BOUNDS = { xMin: 0.08, xMax: 0.92, yMin: 0.05, yMax: 0.92 }

export const JOURNEY_STEPS = [
  { stage: JOURNEY_STAGE.TICKET, label: '取票', order: 1 },
  { stage: JOURNEY_STAGE.WAITING, label: '候车', order: 2 },
  { stage: JOURNEY_STAGE.CHECK, label: '检票', order: 3 },
  { stage: JOURNEY_STAGE.BOARDING, label: '上车', order: 4 },
]

export const NARRATION_SCRIPTS = {
  [JOURNEY_STAGE.TICKET]: {
    title: '请先取票',
    summary: '前往取票厅完成取票',
    body: '您好，请先跟我到取票厅取票，取票后我们再前往候车区休息。',
  },
  [JOURNEY_STAGE.WAITING]: {
    title: '前往候车区',
    summary: '在指定分区等候发车',
    body: '票已取好，请跟我到候车区休息，我会留意您的班次检票时间。',
  },
  [JOURNEY_STAGE.CHECK]: {
    title: '前往检票口',
    summary: '班次已开始检票',
    body: '您的班次已开始检票，请跟我到指定检票口，不要错过发车时间。',
  },
  [JOURNEY_STAGE.BOARDING]: {
    title: '前往发车位',
    summary: '检票完成，准备上车',
    body: '检票完成，请跟我到发车位上车。我会为您选择可通行的车道路线。',
  },
  [JOURNEY_STAGE.COMPLETE]: {
    title: '祝您旅途愉快',
    summary: '已到达发车位',
    body: '已带您到达发车位，请核对车牌后上车。祝您旅途愉快！',
  },
}

export const ROBOT_PROMPTS = {
  selectTrip: '请选择您的班次，开始导览。',
  ticketFound: '车票查询成功，需要我现在带你去取票吗？',
  readyTicket: '路线已规划至取票厅，点击下一步出发前往取票厅。',
  readyWaiting: '取票完成，是否前往候车区？',
  readyCheck: '已开始检票，是否前往检票口？',
  readyBoarding: '检票完成，是否前往发车位？',
  guiding: '正在带您前往目的地，请跟紧我。',
  gateChanged: '检票口已变更，已为您重新规划路线。',
  urgent: '距发车时间不多，我们将走最短路线，请加快脚步。',
  reroute: '前方发车位有车停靠，已为您绕行。',
  boardingComplete: '已带您到达发车位，请核对车牌后上车。我将返回待机区等候下一位旅客。',
}
