/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-06-05
 * @Description: 客运站 Mock 班次与状态计算
 * @FilePath: /bic-map-plugin/src/examples/scene/passengerStation/departureSchedule.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */
import { TRIP_STATUS } from './constants.js'
import { syncBayOccupancyFromTrips } from './passengerStationLayout.js'

function cloneTrips(trips) {
  return trips.map(t => ({ ...t }))
}

export const MOCK_DEPARTURES = [
  { id: 'DEP-001', destination: '唐山', departureTime: '14:30', checkGate: 2, boardingBay: 3, status: TRIP_STATUS.WAITING, ticketNo: '202606050001' },
  { id: 'DEP-006', destination: '石家庄', departureTime: '15:10', checkGate: 2, boardingBay: 11, status: TRIP_STATUS.WAITING, ticketNo: '202606050006' },
  { id: 'DEP-007', destination: '天津', departureTime: '14:05', checkGate: 1, boardingBay: 14, status: TRIP_STATUS.WAITING, ticketNo: '202606050007' },
  { id: 'DEP-008', destination: '保定', departureTime: '15:25', checkGate: 1, boardingBay: 16, status: TRIP_STATUS.WAITING, ticketNo: '202606050008' },
]

export function updateBayOccupancy(areas, trips) {
  syncBayOccupancyFromTrips(areas, trips)
}

export function findTripByTicket(ticketNo, trips) {
  const trimmed = ticketNo.trim()
  if (!trimmed) return null
  return trips.find(t => t.ticketNo === trimmed || t.id === trimmed) || null
}

export { cloneTrips }
