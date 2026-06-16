/**
 * @param {number} from
 * @param {number} to
 * @param {number} t
 */
export function lerp(from, to, t) {
  return from + (to - from) * t
}

/**
 * 将路径朝向转为地图 icon 旋转角（与客运站导览一致）
 * @param {number} heading
 */
export function iconRot(heading) {
  return (heading - 90 + 360) % 360
}

/**
 * @param {{ xFrac: number, yFrac: number }} from
 * @param {{ xFrac: number, yFrac: number }} to
 */
export function getRouteHeading(from, to) {
  return (Math.atan2(to.xFrac - from.xFrac, to.yFrac - from.yFrac) * (180 / Math.PI) + 360) % 360
}

/**
 * @param {Array<{ xFrac: number, yFrac: number }>} route
 * @param {number} speedFracPerSecond
 */
export function buildRouteSegments(route, speedFracPerSecond) {
  const segments = []
  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i]
    const to = route[i + 1]
    const distance = Math.hypot(to.xFrac - from.xFrac, to.yFrac - from.yFrac)
    if (distance <= 0) continue
    segments.push({
      from,
      to,
      distance,
      duration: (distance / speedFracPerSecond) * 1000,
      rotation: getRouteHeading(from, to),
    })
  }
  return segments
}

/**
 * @param {ReturnType<typeof buildRouteSegments>} segments
 * @param {number} elapsed
 */
export function getRoutePositionAtTime(segments, elapsed) {
  let cursor = 0
  for (const segment of segments) {
    const segmentEnd = cursor + segment.duration
    if (elapsed <= segmentEnd) {
      const progress = (elapsed - cursor) / segment.duration
      return {
        xFrac: lerp(segment.from.xFrac, segment.to.xFrac, progress),
        yFrac: lerp(segment.from.yFrac, segment.to.yFrac, progress),
        rotation: iconRot(segment.rotation),
      }
    }
    cursor = segmentEnd
  }
  const last = segments[segments.length - 1]
  return {
    xFrac: last.to.xFrac,
    yFrac: last.to.yFrac,
    rotation: iconRot(last.rotation),
  }
}
