import {
  GUIDE_DIAGONAL_PENALTY,
  GUIDE_GRID_COLS,
  GUIDE_GRID_ROWS,
  GUIDE_MIN_SMOOTH_CLEARANCE,
  GUIDE_OBSTACLE_MARGIN,
  GUIDE_TURN_PENALTY,
  STATION_BOUNDS,
} from './constants.js'
import { getEffectivePassable } from './passengerStationLayout.js'

const GUIDE_NEIGHBORS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
]

function collectPathObstacles(areas) {
  return areas.filter(area => !getEffectivePassable(area))
}

export function buildGuideWalkableGrid(areas) {
  const obstacles = collectPathObstacles(areas)
  const grid = []
  for (let row = 0; row < GUIDE_GRID_ROWS; row++) {
    const line = []
    for (let col = 0; col < GUIDE_GRID_COLS; col++) {
      const point = guideCellToRoutePoint({ col, row })
      line.push(isPointWalkable(point.xFrac, point.yFrac, obstacles))
    }
    grid.push(line)
  }
  return grid
}

function isPointWalkable(xFrac, yFrac, obstacles) {
  if (xFrac < STATION_BOUNDS.xMin || xFrac > STATION_BOUNDS.xMax
    || yFrac < STATION_BOUNDS.yMin || yFrac > STATION_BOUNDS.yMax) return false
  return !obstacles.some(area => isPointInExpandedPolygon(
    xFrac,
    yFrac,
    area.polygon,
    GUIDE_OBSTACLE_MARGIN,
  ))
}

function isPointInExpandedPolygon(xFrac, yFrac, polygon, margin) {
  const xs = polygon.map(point => point[0])
  const ys = polygon.map(point => point[1])
  return xFrac >= Math.min(...xs) - margin
    && xFrac <= Math.max(...xs) + margin
    && yFrac >= Math.min(...ys) - margin
    && yFrac <= Math.max(...ys) + margin
}

function fracToGuideCell(point) {
  return {
    col: Math.max(0, Math.min(GUIDE_GRID_COLS - 1, Math.round(point.xFrac * (GUIDE_GRID_COLS - 1)))),
    row: Math.max(0, Math.min(GUIDE_GRID_ROWS - 1, Math.round(point.yFrac * (GUIDE_GRID_ROWS - 1)))),
  }
}

function guideCellToRoutePoint(cell) {
  return {
    xFrac: cell.col / (GUIDE_GRID_COLS - 1),
    yFrac: cell.row / (GUIDE_GRID_ROWS - 1),
  }
}

function nearestWalkableCell(cell, grid) {
  if (grid[cell.row]?.[cell.col]) return cell
  const queue = [cell]
  const seen = new Set([`${cell.col},${cell.row}`])
  let cursor = 0
  while (cursor < queue.length) {
    const current = queue[cursor++]
    for (const [dc, dr] of GUIDE_NEIGHBORS) {
      const next = { col: current.col + dc, row: current.row + dr }
      if (!isGuideCellInBounds(next)) continue
      const key = `${next.col},${next.row}`
      if (seen.has(key)) continue
      if (grid[next.row][next.col]) return next
      seen.add(key)
      queue.push(next)
    }
  }
  return null
}

function astarGuide(start, goal, grid) {
  if (!grid[start.row]?.[start.col] || !grid[goal.row]?.[goal.col]) return null
  const cellCount = GUIDE_GRID_COLS * GUIDE_GRID_ROWS
  const inf = 1e30
  const gScore = new Float64Array(cellCount).fill(inf)
  const fScore = new Float64Array(cellCount).fill(inf)
  const came = new Int32Array(cellCount).fill(-1)
  const cameDir = new Int8Array(cellCount).fill(-1)
  const open = []
  const inOpen = new Set()
  const startIndex = guideCellIndex(start)
  gScore[startIndex] = 0
  fScore[startIndex] = guideCellDistance(start, goal)
  open.push(startIndex)
  inOpen.add(startIndex)

  while (open.length) {
    const currentIndex = popBestGuideCell(open, inOpen, fScore)
    const current = guideIndexToCell(currentIndex)
    if (current.col === goal.col && current.row === goal.row) {
      return reconstructGuidePath(came, currentIndex)
    }
    for (let dir = 0; dir < GUIDE_NEIGHBORS.length; dir++) {
      const [dc, dr] = GUIDE_NEIGHBORS[dir]
      const next = { col: current.col + dc, row: current.row + dr }
      if (!isGuideCellInBounds(next)) continue
      if (!grid[next.row][next.col]) continue
      if (dc !== 0 && dr !== 0 && (!grid[current.row][next.col] || !grid[next.row][current.col])) continue
      const nextIndex = guideCellIndex(next)
      const turnCost = cameDir[currentIndex] === -1 || cameDir[currentIndex] === dir ? 0 : GUIDE_TURN_PENALTY
      const diagCost = dc !== 0 && dr !== 0 ? GUIDE_DIAGONAL_PENALTY : 0
      const tentative = gScore[currentIndex] + Math.hypot(dc, dr) + turnCost + diagCost
      if (tentative >= gScore[nextIndex]) continue
      came[nextIndex] = currentIndex
      cameDir[nextIndex] = dir
      gScore[nextIndex] = tentative
      fScore[nextIndex] = tentative + guideCellDistance(next, goal)
      if (!inOpen.has(nextIndex)) {
        open.push(nextIndex)
        inOpen.add(nextIndex)
      }
    }
  }
  return null
}

function popBestGuideCell(open, inOpen, fScore) {
  let bestOpenIndex = 0
  let bestScore = fScore[open[0]]
  for (let i = 1; i < open.length; i++) {
    if (fScore[open[i]] < bestScore) {
      bestScore = fScore[open[i]]
      bestOpenIndex = i
    }
  }
  const cellIndex = open[bestOpenIndex]
  open.splice(bestOpenIndex, 1)
  inOpen.delete(cellIndex)
  return cellIndex
}

function reconstructGuidePath(came, endIndex) {
  const path = []
  let cursor = endIndex
  while (cursor !== -1) {
    path.push(guideIndexToCell(cursor))
    cursor = came[cursor]
  }
  return path.reverse()
}

function smoothGuidePath(path, grid) {
  if (!path || path.length < 3) return path
  const result = []
  let i = 0
  while (i < path.length) {
    result.push(path[i])
    if (i === path.length - 1) break
    let j = path.length - 1
    for (; j > i + 1; j--) {
      if (hasGuideLineOfSight(path[i], path[j], grid)) break
    }
    i = j
  }
  return result
}

function hasGuideLineOfSight(from, to, grid) {
  let x0 = from.col
  let y0 = from.row
  const x1 = to.col
  const y1 = to.row
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  while (true) {
    if (!grid[y0]?.[x0]) return false
    if (GUIDE_MIN_SMOOTH_CLEARANCE > 0 && !hasGuideClearance({ col: x0, row: y0 }, grid, GUIDE_MIN_SMOOTH_CLEARANCE)) {
      return false
    }
    if (x0 === x1 && y0 === y1) break
    const e2 = err * 2
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx) { err += dx; y0 += sy }
  }
  return true
}

function hasGuideClearance(cell, grid, clearance) {
  for (let row = cell.row - clearance; row <= cell.row + clearance; row++) {
    for (let col = cell.col - clearance; col <= cell.col + clearance; col++) {
      if (!isGuideCellInBounds({ col, row }) || !grid[row][col]) return false
    }
  }
  return true
}

function guideCellIndex(cell) {
  return cell.row * GUIDE_GRID_COLS + cell.col
}

function guideIndexToCell(index) {
  return { col: index % GUIDE_GRID_COLS, row: Math.floor(index / GUIDE_GRID_COLS) }
}

function isGuideCellInBounds(cell) {
  return cell.col >= 0 && cell.row >= 0 && cell.col < GUIDE_GRID_COLS && cell.row < GUIDE_GRID_ROWS
}

function guideCellDistance(from, to) {
  return Math.hypot(to.col - from.col, to.row - from.row)
}

function dedupeRoutePoints(points) {
  return points.filter((point, index) => {
    const prev = points[index - 1]
    return !prev || prev.xFrac !== point.xFrac || prev.yFrac !== point.yFrac
  })
}

function hasGuideLineOfSightFrac(from, to, grid) {
  return hasGuideLineOfSight(fracToGuideCell(from), fracToGuideCell(to), grid)
}

function isBoardingAccessTarget(targetPoint) {
  return targetPoint.poi?.type === '发车位' || targetPoint.poi?.bayNo != null
}

/** 发车位登车点在车位左侧，先沿通道横移再上行，避免斜穿相邻车位 */
function appendBoardingAccessApproach(route, target) {
  const last = route[route.length - 1]
  const corner = { xFrac: target.xFrac, yFrac: last.yFrac }
  if (Math.abs(corner.xFrac - last.xFrac) > 0.0005) {
    route.push(corner)
  }
  route.push(target)
  return route
}

/** 终点精确坐标可能落在障碍膨胀区内，追加 L 形接近段避免最后一段斜穿车位 */
function extendRouteToTarget(route, targetPoint, grid) {
  const target = {
    xFrac: targetPoint.xFrac,
    yFrac: targetPoint.yFrac,
    poi: targetPoint.poi,
  }
  if (!route.length) return [target]

  const last = route[route.length - 1]
  if (last.xFrac === target.xFrac && last.yFrac === target.yFrac) {
    last.poi = target.poi
    return route
  }

  if (isBoardingAccessTarget(targetPoint)) {
    return appendBoardingAccessApproach(route, target)
  }

  if (hasGuideLineOfSightFrac(last, target, grid)) {
    route.push(target)
    return route
  }

  const horizontalCorner = { xFrac: target.xFrac, yFrac: last.yFrac }
  if (hasGuideLineOfSightFrac(last, horizontalCorner, grid)
    && hasGuideLineOfSightFrac(horizontalCorner, target, grid)) {
    route.push(horizontalCorner, target)
    return route
  }

  const verticalCorner = { xFrac: last.xFrac, yFrac: target.yFrac }
  if (hasGuideLineOfSightFrac(last, verticalCorner, grid)
    && hasGuideLineOfSightFrac(verticalCorner, target, grid)) {
    route.push(verticalCorner, target)
    return route
  }

  route.push(target)
  return route
}

export function planGuideRoute(startPoint, targetPoint, areas) {
  const grid = buildGuideWalkableGrid(areas)
  const startCell = nearestWalkableCell(fracToGuideCell(startPoint), grid)
  const goalCell = fracToGuideCell(targetPoint)
  const targetCell = grid[goalCell.row]?.[goalCell.col]
    ? goalCell
    : nearestWalkableCell(goalCell, grid)
  if (!startCell || !targetCell) return []

  const rawPath = astarGuide(startCell, targetCell, grid)
  const smoothed = smoothGuidePath(rawPath, grid)
  if (!smoothed?.length) return []

  const route = smoothed.map(cell => guideCellToRoutePoint(cell))
  route[0] = startPoint
  return extendRouteToTarget(route, targetPoint, grid)
}

export function buildGuideRoute(startPoint, targetPoi, areas) {
  if (!targetPoi) return []
  const targetPoint = { xFrac: targetPoi.xFrac, yFrac: targetPoi.yFrac, poi: targetPoi }
  const planned = planGuideRoute(startPoint, targetPoint, areas)
  return dedupeRoutePoints(planned.length ? planned : [startPoint, targetPoint])
}

export function getRouteHeading(from, to) {
  return (Math.atan2(to.xFrac - from.xFrac, to.yFrac - from.yFrac) * (180 / Math.PI) + 360) % 360
}

export function iconRot(heading) {
  return (heading - 90 + 360) % 360
}

export function getFracDistance(from, to) {
  return Math.sqrt((to.xFrac - from.xFrac) ** 2 + (to.yFrac - from.yFrac) ** 2)
}

export function lerp(from, to, progress) {
  return from + (to - from) * Math.max(0, Math.min(1, progress))
}

export function buildRouteSegments(route, speedFracPerSecond) {
  const segments = []
  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i]
    const to = route[i + 1]
    const distance = getFracDistance(from, to)
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

export function buildRouteGeoJSON(route, toGPS) {
  const coordinates = route.map(point => toGPS(point.xFrac, point.yFrac))
  return {
    type: 'FeatureCollection',
    features: coordinates.length >= 2
      ? [{
          type: 'Feature',
          properties: { id: 'passenger-guide-route' },
          geometry: { type: 'LineString', coordinates },
        }]
      : [],
  }
}
