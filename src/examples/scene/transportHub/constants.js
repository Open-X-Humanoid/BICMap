import AirportGuide from '../airportGuide/index.vue'
import PassengerStation from '../passengerStation/index.vue'
import StationGuide from '../stationGuide/index.vue'

export const SCENE_TYPE_STATION = 'station'
export const SCENE_TYPE_PASSENGER = 'passenger'
export const SCENE_TYPE_AIRPORT = 'airport'

export const DEFAULT_SCENE_TYPE = SCENE_TYPE_STATION

/** 三站一场场景类型配置 */
export const SCENE_TYPES = [
  {
    key: SCENE_TYPE_STATION,
    label: '火车/高铁站',
    component: StationGuide,
  },
  {
    key: SCENE_TYPE_PASSENGER,
    label: '客运站',
    component: PassengerStation,
  },
  {
    key: SCENE_TYPE_AIRPORT,
    label: '飞机场',
    component: AirportGuide,
  },
]
