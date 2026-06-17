/**
 * Generic A*-based pathfinder with configurable grid resolution, obstacles,
 * path smoothing, and obstacle dilation.
 *
 * Zero external project imports — only depends on Math built-ins.
 * Coordinates are in fractional [0..1] range.
 * Obstacles are defined as polygon arrays in fractional coordinates.
 */

import { pointInPolygon } from '@/bicMap/core/navigation/pointUtil.js'

const NEIGHBORS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
]

const DEFAULT_OPTIONS = {
  gridSize: 0.5,
  turnPenalty: 2.8,
  diagonalPenalty: 0.8,
  smoothClearance: 2,
  dilatePasses: 3,
  marginLeft: 0.05,
  marginRight: 0.05,
  marginTop: 0,
  marginBottom: 0.05,
}

/**
 * Check if a line segment [x1,y1]→[x2,y2] intersects any edge of a polygon.
 * Pure geometric test (ray casting for segment intersection).
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {[number,number][]} polygon - Array of [x, y] vertices
 * @returns {boolean}
 */
function lineSegmentIntersectsPolygon(x1, y1, x2, y2, polygon) {
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [cx, cy] = polygon[i]
    const [dx, dy] = polygon[j]
    if (segmentsIntersect(x1, y1, x2, y2, cx, cy, dx, dy)) {
      return true
    }
  }
  return false
}

/**
 * Check if two line segments intersect.
 */
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax, d1y = by - ay
  const d2x = dx - cx, d2y = dy - cy
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return false
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

export class Pathfinder {
  /**
   * @param {Object} options
   * @param {number}  options.widthMeters       - Physical map width in meters (required)
   * @param {number}  options.heightMeters      - Physical map height in meters (required)
   * @param {number}  [options.gridSize]        - Cell size in meters (default 0.5)
   * @param {number}  [options.turnPenalty]     - Cost penalty for changing direction (default 2.8)
   * @param {number}  [options.diagonalPenalty] - Extra cost for diagonal movement (default 0.8)
   * @param {number}  [options.smoothClearance] - Clearance radius (in cells) for line-of-sight check (default 1)
   * @param {number}  [options.dilatePasses]    - How many times to dilate obstacle edges (default 2)
   * @param {number}  [options.marginLeft]      - Fraction left edge margin to block (default 0.05)
   * @param {number}  [options.marginRight]     - Fraction right edge margin to block (default 0.05)
   * @param {number}  [options.marginTop]       - Fraction top edge margin to block (default 0)
   * @param {number}  [options.marginBottom]    - Fraction bottom edge margin to block (default 0.05)
   */
  constructor(options = {}) {
    const { widthMeters, heightMeters, ...rest } = options
    if (widthMeters == null || heightMeters == null) {
      throw new Error('Pathfinder: widthMeters and heightMeters are required')
    }

    this.widthMeters = widthMeters
    this.heightMeters = heightMeters
    this.gridSize = rest.gridSize ?? DEFAULT_OPTIONS.gridSize
    this.turnPenalty = rest.turnPenalty ?? DEFAULT_OPTIONS.turnPenalty
    this.diagonalPenalty = rest.diagonalPenalty ?? DEFAULT_OPTIONS.diagonalPenalty
    this.smoothClearance = rest.smoothClearance ?? DEFAULT_OPTIONS.smoothClearance
    this.dilatePasses = rest.dilatePasses ?? DEFAULT_OPTIONS.dilatePasses
    this.marginLeft = rest.marginLeft ?? DEFAULT_OPTIONS.marginLeft
    this.marginRight = rest.marginRight ?? DEFAULT_OPTIONS.marginRight
    this.marginTop = rest.marginTop ?? DEFAULT_OPTIONS.marginTop
    this.marginBottom = rest.marginBottom ?? DEFAULT_OPTIONS.marginBottom

    // Grid dimensions (computed from physical size & cell resolution)
    this.cols = Math.ceil(this.widthMeters / this.gridSize)
    this.rows = Math.ceil(this.heightMeters / this.gridSize)
    this.cellCount = this.cols * this.rows

    // Internal state
    this._obstacleGrid = null
    this._forbiddenZones = null
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Set obstacle polygons and rebuild the internal boolean grid.
   * @param {{ polygon: [number,number][] }[]} obstacles - Array of obstacle objects with polygon vertex arrays
   */
  setObstacles(obstacles) {
    this._obstacleGrid = this._buildObstacleGrid(obstacles || [])
    this._forbiddenZones = obstacles || null
  }

  /**
   * Find a path from start to end, avoiding obstacles.
   * Both coordinates are in fractional [0..1] range.
   *
   * @param {[number,number]} start - [xFrac, yFrac] start point
   * @param {[number,number]} end   - [xFrac, yFrac] end point
   * @returns {[number,number][] | null} Array of [xFrac, yFrac] waypoints, or null if unreachable
   */
  findPath(start, end) {
    const [startXFrac, startYFrac] = start
    const [endXFrac, endYFrac] = end
    const grid = this._obstacleGrid
    if (!grid) return null

    const rawStartCol = Math.min(this.cols - 1, Math.max(0, Math.round(startXFrac * this.cols)))
    const rawStartRow = Math.min(this.rows - 1, Math.max(0, Math.round(startYFrac * this.rows)))
    const rawEndCol = Math.min(this.cols - 1, Math.max(0, Math.round(endXFrac * this.cols)))
    const rawEndRow = Math.min(this.rows - 1, Math.max(0, Math.round(endYFrac * this.rows)))

    // BFS fallback if start or end cell is blocked
    const startCell = this._nearestWalkableCell({ col: rawStartCol, row: rawStartRow }, grid)
    const endCell = this._nearestWalkableCell({ col: rawEndCol, row: rawEndRow }, grid)
    if (!startCell || !endCell) return null

    if (startCell.col === endCell.col && startCell.row === endCell.row) {
      return [[startXFrac, startYFrac]]
    }

    const gridPath = this._aStar(grid, startCell.col, startCell.row, endCell.col, endCell.row)
    if (!gridPath) return null

    const compactedPath = this._compactPath(gridPath, grid)
    return compactedPath.map(p => [p.col / this.cols, p.row / this.rows])
  }

  // ─── Internal: Grid Construction ────────────────────────────────────────

  /**
   * Build a boolean obstacle grid (true = walkable) from polygon obstacles.
   * Applies rasterization, dilation, and boundary margins.
   * @param {{ polygon: [number,number][] }[]} obstacles
   * @returns {boolean[][]} this.rows × this.cols grid
   */
  _buildObstacleGrid(obstacles) {
    const grid = []
    for (let rowIndex = 0; rowIndex < this.rows; rowIndex++) {
      grid[rowIndex] = new Array(this.cols).fill(true)
    }

    for (const obstacle of obstacles) {
      const polygon = obstacle.polygon
      if (!polygon || polygon.length < 3) continue

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const [x, y] of polygon) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }

      const minCol = Math.max(0, Math.floor(minX * this.cols))
      const maxCol = Math.min(this.cols - 1, Math.ceil(maxX * this.cols))
      const minRow = Math.max(0, Math.floor(minY * this.rows))
      const maxRow = Math.min(this.rows - 1, Math.ceil(maxY * this.rows))

      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const fractionalX = col / this.cols
          const fractionalY = row / this.rows
          if (pointInPolygon(fractionalX, fractionalY, polygon)) {
            grid[row][col] = false
          }
        }
      }
    }

    // Dilate obstacle edges
    let dilated = grid.map(row => [...row])
    for (let pass = 0; pass < this.dilatePasses; pass++) {
      const next = dilated.map(row => [...row])
      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          if (!dilated[row][col]) {
            if (row > 0) next[row - 1][col] = false
            if (row < this.rows - 1) next[row + 1][col] = false
            if (col > 0) next[row][col - 1] = false
            if (col < this.cols - 1) next[row][col + 1] = false
          }
        }
      }
      dilated = next
    }

    // Apply boundary margins
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const fractionalX = col / this.cols
        const fractionalY = row / this.rows
        if (fractionalX < this.marginLeft ||
            fractionalX > 1 - this.marginRight ||
            fractionalY > 1 - this.marginBottom ||
            fractionalY < this.marginTop) {
          dilated[row][col] = false
        }
      }
    }

    return dilated
  }

  // ─── Internal: A* Search ────────────────────────────────────────────────

  _cellDistance(col1, row1, col2, row2) {
    return Math.hypot(col2 - col1, row2 - row1)
  }

  _cellIndex(col, row) {
    return row * this.cols + col
  }

  _indexToCell(index) {
    return {
      col: index % this.cols,
      row: Math.floor(index / this.cols),
    }
  }

  _isCellInBounds(col, row) {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows
  }

  _reconstructPath(cameFrom, endIndex) {
    const path = []
    let cursor = endIndex
    while (cursor !== -1) {
      path.push(this._indexToCell(cursor))
      cursor = cameFrom[cursor]
    }
    return path.reverse()
  }

  _popBestCell(open, inOpen, fScore) {
    let bestIndex = 0
    let bestScore = fScore[open[0]]
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < bestScore) {
        bestScore = fScore[open[i]]
        bestIndex = i
      }
    }
    const cellIndex = open[bestIndex]
    open.splice(bestIndex, 1)
    inOpen.delete(cellIndex)
    return cellIndex
  }

  _nearestWalkableCell(cell, grid) {
    if (grid[cell.row]?.[cell.col]) return cell
    const queue = [cell]
    const seen = new Set([`${cell.col},${cell.row}`])
    let cursor = 0

    while (cursor < queue.length) {
      const current = queue[cursor++]
      for (const [deltaCol, deltaRow] of NEIGHBORS) {
        const neighborCol = current.col + deltaCol
        const neighborRow = current.row + deltaRow
        if (!this._isCellInBounds(neighborCol, neighborRow)) continue
        const key = `${neighborCol},${neighborRow}`
        if (seen.has(key)) continue
        if (grid[neighborRow][neighborCol]) return { col: neighborCol, row: neighborRow }
        seen.add(key)
        queue.push({ col: neighborCol, row: neighborRow })
      }
    }
    return null
  }

  _aStar(grid, startCol, startRow, endCol, endRow) {
    if (startCol === endCol && startRow === endRow) {
      return [{ col: startCol, row: startRow }]
    }

    if (!grid[startRow][startCol] || !grid[endRow][endCol]) {
      return null
    }

    const gScore = new Float64Array(this.cellCount).fill(1e30)
    const fScore = new Float64Array(this.cellCount).fill(1e30)
    const cameFrom = new Int32Array(this.cellCount).fill(-1)
    const cameDir = new Int8Array(this.cellCount).fill(-1)

    const startIndex = this._cellIndex(startCol, startRow)
    gScore[startIndex] = 0
    fScore[startIndex] = this._cellDistance(startCol, startRow, endCol, endRow)

    const open = [startIndex]
    const inOpen = new Set([startIndex])

    while (open.length) {
      const currentIndex = this._popBestCell(open, inOpen, fScore)
      const current = this._indexToCell(currentIndex)

      if (current.col === endCol && current.row === endRow) {
        return this._reconstructPath(cameFrom, currentIndex)
      }

      for (let dir = 0; dir < NEIGHBORS.length; dir++) {
        const [deltaCol, deltaRow] = NEIGHBORS[dir]
        const neighborCol = current.col + deltaCol
        const neighborRow = current.row + deltaRow

        if (!this._isCellInBounds(neighborCol, neighborRow)) continue
        if (!grid[neighborRow][neighborCol]) continue

        // Corner check for diagonal movement
        if (deltaCol !== 0 && deltaRow !== 0 &&
            (!grid[current.row][neighborCol] || !grid[neighborRow][current.col])) continue

        const nextIndex = this._cellIndex(neighborCol, neighborRow)
        const stepCost = Math.hypot(deltaCol, deltaRow)
        const turnPenalty = cameDir[currentIndex] === -1 || cameDir[currentIndex] === dir
          ? 0 : this.turnPenalty
        const diagPenalty = deltaCol !== 0 && deltaRow !== 0 ? this.diagonalPenalty : 0
        const tentative = gScore[currentIndex] + stepCost + turnPenalty + diagPenalty

        if (tentative >= gScore[nextIndex]) continue

        cameFrom[nextIndex] = currentIndex
        cameDir[nextIndex] = dir
        gScore[nextIndex] = tentative
        fScore[nextIndex] = tentative + this._cellDistance(neighborCol, neighborRow, endCol, endRow)

        if (!inOpen.has(nextIndex)) {
          open.push(nextIndex)
          inOpen.add(nextIndex)
        }
      }
    }

    return null
  }

  // ─── Internal: Path Smoothing (Line-of-Sight) ───────────────────────────

  _hasClearance(col, row, grid, clearance) {
    for (let deltaRow = -clearance; deltaRow <= clearance; deltaRow++) {
      for (let deltaCol = -clearance; deltaCol <= clearance; deltaCol++) {
        const neighborCol = col + deltaCol
        const neighborRow = row + deltaRow
        if (!this._isCellInBounds(neighborCol, neighborRow) || !grid[neighborRow][neighborCol]) return false
      }
    }
    return true
  }

  _hasLineOfSight(from, to, grid) {
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
      if (!this._isCellInBounds(x0, y0) || !grid[y0][x0]) return false
      if (this.smoothClearance > 0 && !this._hasClearance(x0, y0, grid, this.smoothClearance)) {
        return false
      }
      if (x0 === x1 && y0 === y1) break
      const e2 = err * 2
      if (e2 > -dy) {
        err -= dy
        x0 += sx
      }
      if (e2 < dx) {
        err += dx
        y0 += sy
      }
    }

    // Additional geometric check: line segment [from]→[to] against forbidden zone polygons
    if (this._forbiddenZones) {
      const fromXFrac = from.col / this.cols
      const fromYFrac = from.row / this.rows
      const toXFrac = to.col / this.cols
      const toYFrac = to.row / this.rows
      for (const zone of this._forbiddenZones) {
        if (zone.polygon && zone.polygon.length >= 3) {
          if (lineSegmentIntersectsPolygon(fromXFrac, fromYFrac, toXFrac, toYFrac, zone.polygon)) {
            return false
          }
        }
      }
    }

    return true
  }

  _compactPath(gridPath, grid) {
    if (gridPath.length < 3) return gridPath

    const result = [gridPath[0]]
    let i = 0
    while (i < gridPath.length - 1) {
      let farthest = i + 1
      for (let j = gridPath.length - 1; j > i + 1; j--) {
        if (this._hasLineOfSight(gridPath[i], gridPath[j], grid)) {
          farthest = j
          break
        }
      }
      result.push(gridPath[farthest])
      i = farthest
    }
    return result
  }
}
