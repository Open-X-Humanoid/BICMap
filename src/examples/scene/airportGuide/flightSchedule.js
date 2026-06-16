export const MOCK_FLIGHTS = [
  {
    id: 'FL-SHA',
    flightNo: 'MU5101',
    destination: '上海',
    departureTime: '16:30',
    boardingGate: 'B',
    standId: 'poi-stand-7',
    remainingMinutes: 85,
  },
  {
    id: 'FL-HGH',
    flightNo: 'CA1789',
    destination: '杭州',
    departureTime: '19:00',
    boardingGate: 'A',
    standId: 'poi-stand-4',
    remainingMinutes: 165,
  },
]

/**
 * 克隆航班列表
 * @returns {typeof MOCK_FLIGHTS}
 */
export function cloneFlights() {
  return MOCK_FLIGHTS.map(f => ({ ...f }))
}

/**
 * 按航班号、目的地或 id 查询
 * @param {string} query
 * @returns {object | null}
 */
export function findFlightByQuery(query) {
  const trimmed = query?.trim()
  if (!trimmed) return null
  return MOCK_FLIGHTS.find(f =>
    f.id === trimmed
    || f.flightNo === trimmed
    || f.destination === trimmed
    || f.flightNo.toLowerCase() === trimmed.toLowerCase()
  ) || null
}

/**
 * 是否时间紧迫（不足 2 小时）
 * @param {number} remainingMinutes
 */
export function isUrgentFlight(remainingMinutes) {
  return remainingMinutes < 120
}
