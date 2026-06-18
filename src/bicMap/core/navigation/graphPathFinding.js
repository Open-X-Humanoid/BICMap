/**
 * 图结构路径规划器 — 基于道路拓扑的 A* 寻路与回路规划
 *
 * 与 Pathfinder（网格自由空间寻路）互补。
 * 专门用于沿道路网络行驶的场景（如园区巡逻），路径约束在预先定义的
 * 图节点和边的连通性上，不会穿过非道路区域。
 *
 * @module graphPathfinding
 */

// ─── 内部工具函数 ───────────────────────────────────────────────────────────

/** 构建 nodeId → GPS 坐标索引 */
export function buildNodeIndex(nodes) {
  const index = {}
  for (const node of nodes) {
    index[node.id] = node.coordinates
  }
  return index
}

/** 构建双向邻接表 */
export function buildAdjacency(nodes, edges, nodeIndex) {
  const adjacency = {}
  for (const node of nodes) adjacency[node.id] = []
  for (const edge of edges) {
    if (!nodeIndex[edge.from] || !nodeIndex[edge.to]) continue
    adjacency[edge.from].push({ to: edge.to, edgeId: edge.id, weight: edge.weight })
    adjacency[edge.to].push({ to: edge.from, edgeId: edge.id, weight: edge.weight })
  }
  return adjacency
}

// ─── 主类 ───────────────────────────────────────────────────────────────────

export class GraphPathfinder {
  /**
   * @param {Object} graph - 图结构
   * @param {{ id: string, type?: string, coordinates: [number, number] }[]} graph.nodes
   * @param {{ id: string, from: string, to: string, weight: number }[]} graph.edges
   */
  constructor(graph) {
    this.nodes = graph.nodes
    this.edges = graph.edges
    this.nodeIndex = buildNodeIndex(graph.nodes)
    this.adjacency = buildAdjacency(graph.nodes, graph.edges, this.nodeIndex)
  }

  // ─── 公开 API ─────────────────────────────────────────────────────────

  /**
   * A* 最短路径（图拓扑）
   *
   * @param {string} startNodeId - 起始节点 ID
   * @param {string} endNodeId - 目标节点 ID
   * @param {Object} [options]
   * @param {string[]|Set<string>} [options.excludeNodeIds=[]] - 需排除的节点
   * @returns {string[]|null} 节点 ID 序列（含起终点），不可达返回 null
   */
  findPath(startNodeId, endNodeId, options = {}) {
    const excludeNodeIds = options.excludeNodeIds ?? []
    const excluded = excludeNodeIds instanceof Set ? excludeNodeIds : new Set(excludeNodeIds)

    const endCoords = this.nodeIndex[endNodeId]
    if (!endCoords) return null
    if (!this.adjacency[startNodeId]) return null

    // 启发函数：GPS 欧氏距离（可采纳 → 保证最优性）
    const heuristic = (nodeId) => {
      const coords = this.nodeIndex[nodeId]
      if (!coords) return 0
      const deltaLng = coords[0] - endCoords[0]
      const deltaLat = coords[1] - endCoords[1]
      return Math.sqrt(deltaLng * deltaLng + deltaLat * deltaLat)
    }

    const gScore = {}
    const fScore = {}
    const previous = {}
    const inOpen = new Set()
    const queue = []

    for (const nodeId of Object.keys(this.adjacency)) {
      gScore[nodeId] = Infinity
      fScore[nodeId] = Infinity
      previous[nodeId] = null
    }
    gScore[startNodeId] = 0
    fScore[startNodeId] = heuristic(startNodeId)
    queue.push({ nodeId: startNodeId, fScore: fScore[startNodeId] })
    inOpen.add(startNodeId)

    while (queue.length > 0) {
      queue.sort((a, b) => a.fScore - b.fScore)
      const { nodeId } = queue.shift()
      inOpen.delete(nodeId)

      if (nodeId === endNodeId) {
        const path = []
        let current = endNodeId
        while (current !== null) {
          path.unshift(current)
          current = previous[current]
        }
        return path.length > 1 ? path : null
      }

      for (const neighbor of this.adjacency[nodeId] || []) {
        if (excluded.has(neighbor.to)) continue
        const tentativeG = gScore[nodeId] + neighbor.weight
        if (tentativeG >= gScore[neighbor.to]) continue

        previous[neighbor.to] = nodeId
        gScore[neighbor.to] = tentativeG
        fScore[neighbor.to] = tentativeG + heuristic(neighbor.to)

        if (!inOpen.has(neighbor.to)) {
          queue.push({ nodeId: neighbor.to, fScore: fScore[neighbor.to] })
          inOpen.add(neighbor.to)
        }
      }
    }

    return null
  }

  /**
   * 查找离给定 GPS 坐标最近的图节点
   *
   * @param {number} lng - GPS 经度
   * @param {number} lat - GPS 纬度
   * @returns {{ id: string, coordinates: [number, number], distance: number }|null}
   */
  findNearestNode(lng, lat) {
    let best = null
    let bestDist = Infinity

    for (const node of this.nodes) {
      const [nodeLng, nodeLat] = node.coordinates
      const deltaLng = nodeLng - lng
      const deltaLat = nodeLat - lat
      const d = deltaLng * deltaLng + deltaLat * deltaLat
      if (d < bestDist) {
        bestDist = d
        best = { id: node.id, coordinates: node.coordinates, distance: Math.sqrt(d) }
      }
    }

    return best
  }

  /**
   * 规划覆盖指定边集的回路
   *
   * 自动选择最佳算法：
   *   - 奇度顶点数 ≤ 16 → 中国邮路（CPP，最优解）
   *   - 奇度顶点数 > 16 → 贪心最近邻（快速近似）
   *
   * @param {string} startNodeId - 起始节点 ID
   * @param {string[]} targetEdgeIds - 需要覆盖的边 ID 列表
   * @param {Object} [config]
   * @param {string[]|Set<string>} [config.excludeNodeIds=[]]
   * @param {'auto'|'chinesePostman'|'greedy'} [config.algorithm='auto']
   * @returns {string[]|null} 节点 ID 序列
   */
  planCircuit(startNodeId, targetEdgeIds, config = {}) {
    const { excludeNodeIds = [], algorithm = 'auto' } = config
    const excluded = excludeNodeIds instanceof Set ? excludeNodeIds : new Set(excludeNodeIds)

    if (targetEdgeIds.length === 0) return null

    const subgraphInfo = this._analyzeSubgraph(targetEdgeIds)
    const { oddCount, components } = subgraphInfo

    // ── 策略 1: CPP（奇度顶点数 ≤ 24） ──
    if (algorithm === 'chinesePostman' || (algorithm === 'auto' && oddCount <= 24)) {
      const result = this.planChinesePostmanCircuit(startNodeId, targetEdgeIds, { excludeNodeIds })
      if (result) {
        console.log(`[planCircuit] 策略1(CPP) 成功, 覆盖 ${targetEdgeIds.length} 条边`)
        return result
      }
      console.log(`[planCircuit] 策略1(CPP) 失败, 共 ${components.length} 个连通分量`)
    }

    // ── 策略 2: 分治 — 按连通分量分别规划再拼接 ──
    if (components && components.length > 1) {
      const divResult = this._planByComponent(startNodeId, targetEdgeIds, components, { excludeNodeIds })
      if (divResult) {
        console.log(`[planCircuit] 策略2(分治) 成功`)
        return divResult
      }
      console.log(`[planCircuit] 策略2(分治) 失败`)
    }

    // ── 策略 3: 改进贪心（修复 Bug 1 后的版本） ──
    const greedyResult = this.planGreedyCircuit(startNodeId, targetEdgeIds, { excludeNodeIds })
    if (greedyResult) {
      console.log(`[planCircuit] 策略3(贪心) 成功`)
      return greedyResult
    }
    console.log(`[planCircuit] 策略3(贪心) 失败`)

    // ── 策略 4: 逐边遍历 + A* 最短路径桥接（最终回退） ──
    console.log(`[planCircuit] 尝试策略4(逐边遍历)`)
    return this._planEdgeByEdge(startNodeId, targetEdgeIds, { excludeNodeIds })
  }

  /**
   * 中国邮路（Chinese Postman）回路 — 最优覆盖指定边集
   *
   * 算法步骤：
   *   1. 提取子图（targetEdgeIds 定义的边集）
   *   2. 找出奇度顶点
   *   3. 对奇度顶点对做全配对 A* 最短路径（使用全图）
   *   4. 最小权完美匹配 → 确定哪些奇度点配对
   *   5. 构建增广多重图（所有顶点变为偶度）
   *   6. Hierholzer 算法 → 欧拉回路
   *
   * @param {string} startNodeId
   * @param {string[]} targetEdgeIds
   * @param {Object} [options]
   * @param {string[]|Set<string>} [options.excludeNodeIds=[]]
   * @returns {string[]|null}
   */
  planChinesePostmanCircuit(startNodeId, targetEdgeIds, options = {}) {
    const excludeNodeIds = options.excludeNodeIds ?? []
    const excluded = excludeNodeIds instanceof Set ? excludeNodeIds : new Set(excludeNodeIds)

    // ── 1. 提取子图 ──
    const subEdges = this.edges.filter(e =>
      targetEdgeIds.includes(e.id)
      && !excluded.has(e.from)
      && !excluded.has(e.to),
    )
    const subNodeSet = new Set()
    for (const edge of subEdges) {
      subNodeSet.add(edge.from)
      subNodeSet.add(edge.to)
    }
    const subNodes = Array.from(subNodeSet)
    if (subNodes.length === 0 || subEdges.length === 0) return null

    // ── 2. 计算子图度数，找出奇度顶点 ──
    const degree = {}
    for (const nodeId of subNodes) degree[nodeId] = 0
    for (const edge of subEdges) {
      degree[edge.from]++
      degree[edge.to]++
    }
    const oddVertices = subNodes.filter(n => degree[n] % 2 !== 0)

    // 如果没有奇度顶点，子图已是欧拉图 → 直接找欧拉回路
    if (oddVertices.length === 0) {
      return this._findEulerianCircuit(subEdges, startNodeId)
    }

    // ── 2.5 BFS 连通分量检测（在 excludeNodeIds 过滤后的子图上） ──
    const componentAdj = {}
    for (const nodeId of subNodes) componentAdj[nodeId] = new Set()
    for (const edge of subEdges) {
      componentAdj[edge.from].add(edge.to)
      componentAdj[edge.to].add(edge.from)
    }
    const visited = new Set()
    const components = []
    for (const nodeId of subNodes) {
      if (visited.has(nodeId)) continue
      const compNodes = []
      const queue = [nodeId]
      visited.add(nodeId)
      while (queue.length > 0) {
        const current = queue.shift()
        compNodes.push(current)
        for (const neighbor of componentAdj[current]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            queue.push(neighbor)
          }
        }
      }
      const compEdgeCount = subEdges.filter(e =>
        compNodes.includes(e.from) && compNodes.includes(e.to),
      ).length
      components.push({ nodeIds: compNodes, edgeCount: compEdgeCount })
    }

    if (components.length > 1) {
      console.log(
        `[CPP] 检测到 ${components.length} 个连通分量:`,
        components.map((c, i) => `分量${i}: ${c.nodeIds.length}节点 ${c.edgeCount}边`).join(', '),
      )
    }

    // ── 3. 按连通分量分组配对奇度顶点 ──
    // 将每个奇度顶点归到其所在分量
    const oddVertexComponent = {}
    for (const oddVertex of oddVertices) {
      for (let ci = 0; ci < components.length; ci++) {
        if (components[ci].nodeIds.includes(oddVertex)) {
          oddVertexComponent[oddVertex] = ci
          break
        }
      }
    }

    // 按分量分组奇度顶点
    const oddGroups = []
    for (let ci = 0; ci < components.length; ci++) {
      const group = oddVertices.filter(v => oddVertexComponent[v] === ci)
      if (group.length > 0) oddGroups.push(group)
    }

    // 全量 distance / paths 表（用于最终构建增广边）
    const distance = {}
    const paths = {}
    for (const oddVertex of oddVertices) {
      distance[oddVertex] = {}
      paths[oddVertex] = {}
    }

    // 每个分量内独立完成 A* 配对和匹配
    const matching = []
    for (const group of oddGroups) {
      if (group.length < 2) continue

      // 初始化本分量的 distance / paths
      for (const v of group) {
        distance[v][v] = 0
      }

      // 本分量内全配对 A* 最短路径
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const path = this.findPath(group[i], group[j], { excludeNodeIds })
          if (path) {
            let totalWeight = 0
            for (let k = 0; k < path.length - 1; k++) {
              const neighbor = (this.adjacency[path[k]] || []).find(n => n.to === path[k + 1])
              if (neighbor) totalWeight += neighbor.weight
            }
            distance[group[i]][group[j]] = totalWeight
            distance[group[j]][group[i]] = totalWeight
            paths[group[i]][group[j]] = path
            paths[group[j]][group[i]] = [...path].reverse()
          } else {
            distance[group[i]][group[j]] = Infinity
            distance[group[j]][group[i]] = Infinity
          }
        }
      }

      // 本分量内最小权完美匹配
      const groupMatching = this._minWeightPerfectMatching(group, distance)
      if (groupMatching && groupMatching.length > 0) {
        matching.push(...groupMatching)
      }
    }

    if (matching.length === 0) return null

    // ── 5. 构建增广边列表（原始边 + 虚拟边） ──
    const augmentedEdges = [...subEdges]
    for (const [a, b] of matching) {
      const path = paths[a][b]
      if (!path || path.length < 2) continue
      for (let k = 0; k < path.length - 1; k++) {
        const from = path[k]
        const to = path[k + 1]
        const alreadyInSubgraph = subEdges.some(e =>
          (e.from === from && e.to === to) || (e.from === to && e.to === from),
        )
        if (alreadyInSubgraph) {
          augmentedEdges.push({
            id: `cpp_dup_${from}_${to}_${augmentedEdges.length}`,
            from,
            to,
            weight: 0,
          })
        } else {
          const neighbor = (this.adjacency[from] || []).find(n => n.to === to)
          if (neighbor) {
            augmentedEdges.push({
              id: `cpp_virtual_${from}_${to}_${augmentedEdges.length}`,
              from,
              to,
              weight: neighbor.weight,
            })
          }
        }
      }
    }

    // ── 6. Hierholzer 欧拉回路 ──
    return this._findEulerianCircuit(augmentedEdges, startNodeId)
  }

  /**
   * 贪心最近邻回路（改进版）
   *
   * 从起始节点出发，每次选择最近的未访问目标边。
   * 若当前节点无直接未访问边，使用 A* 计算到各未访问边两端点的最短路径，
   * 选择总成本（寻路权重 + 边权重）最小的未访问边。
   *
   * @param {string} startNodeId
   * @param {string[]} targetEdgeIds
   * @param {Object} [options]
   * @param {string[]|Set<string>} [options.excludeNodeIds=[]]
   * @returns {string[]|null}
   */
  planGreedyCircuit(startNodeId, targetEdgeIds, options = {}) {
    const excludeNodeIds = options.excludeNodeIds ?? []
    const excluded = excludeNodeIds instanceof Set ? excludeNodeIds : new Set(excludeNodeIds)

    const edgeSet = new Set(targetEdgeIds)
    const visitedEdges = new Set()
    const circuit = [startNodeId]
    let currentNodeId = startNodeId

    while (visitedEdges.size < edgeSet.size) {
      let bestEdge = null
      let bestTotalCost = Infinity
      let bestPath = null
      let bestFromNodeId = null

      // 第一轮：检查当前节点是否有直接未访问边
      for (const neighbor of this.adjacency[currentNodeId] || []) {
        if (!edgeSet.has(neighbor.edgeId) || visitedEdges.has(neighbor.edgeId)) continue
        if (neighbor.weight < bestTotalCost) {
          bestTotalCost = neighbor.weight
          bestEdge = neighbor
          bestFromNodeId = currentNodeId
        }
      }

      // 第二轮（A* 回退）：无直接未访问边时，寻路到各未访问边端点
      if (!bestEdge) {
        for (const [nodeId, neighbors] of Object.entries(this.adjacency)) {
          if (excluded.has(nodeId)) continue
          for (const neighbor of neighbors) {
            if (!edgeSet.has(neighbor.edgeId) || visitedEdges.has(neighbor.edgeId)) continue

            // 计算到边的一个端点的最短路径权重
            const routePath = this.findPath(currentNodeId, nodeId, { excludeNodeIds })
            if (!routePath) continue

            let pathWeight = 0
            for (let k = 0; k < routePath.length - 1; k++) {
              const edgeNeighbor = (this.adjacency[routePath[k]] || []).find(n => n.to === routePath[k + 1])
              if (edgeNeighbor) pathWeight += edgeNeighbor.weight
            }

            const totalCost = pathWeight + neighbor.weight
            if (totalCost < bestTotalCost) {
              bestTotalCost = totalCost
              bestEdge = neighbor
              bestPath = routePath
              bestFromNodeId = nodeId
            }
          }
        }
      }

      if (!bestEdge) break

      if (bestPath && bestPath.length > 1) {
        circuit.push(...bestPath.slice(1))
      } else if (bestFromNodeId && bestFromNodeId !== currentNodeId) {
        circuit.push(bestFromNodeId)
      }
      circuit.push(bestEdge.to)
      visitedEdges.add(bestEdge.edgeId)
      currentNodeId = bestEdge.to
    }

    // 确保回路以 startNodeId 结尾
    if (circuit[circuit.length - 1] !== startNodeId) {
      const returnPath = this.findPath(currentNodeId, startNodeId, { excludeNodeIds })
      if (returnPath) {
        circuit.push(...returnPath.slice(1))
      }
    }

    return circuit
  }

  // ─── 内部：中国邮路 ────────────────────────────────────────────────────

  _analyzeSubgraph(targetEdgeIds) {
    const subEdges = this.edges.filter(e => targetEdgeIds.includes(e.id))
    const degree = {}
    for (const edge of subEdges) {
      degree[edge.from] = (degree[edge.from] || 0) + 1
      degree[edge.to] = (degree[edge.to] || 0) + 1
    }
    const nodeIds = Object.keys(degree)
    const oddCount = nodeIds.filter(n => degree[n] % 2 !== 0).length

    // BFS 连通分量检测
    const subgraphAdj = {}
    for (const nodeId of nodeIds) subgraphAdj[nodeId] = new Set()
    for (const edge of subEdges) {
      subgraphAdj[edge.from].add(edge.to)
      subgraphAdj[edge.to].add(edge.from)
    }

    const visited = new Set()
    const components = []
    for (const nodeId of nodeIds) {
      if (visited.has(nodeId)) continue
      const compNodes = []
      const queue = [nodeId]
      visited.add(nodeId)
      while (queue.length > 0) {
        const current = queue.shift()
        compNodes.push(current)
        for (const neighbor of subgraphAdj[current]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            queue.push(neighbor)
          }
        }
      }
      const compEdgeCount = subEdges.filter(e =>
        compNodes.includes(e.from) && compNodes.includes(e.to),
      ).length
      components.push({ nodeIds: compNodes, edgeCount: compEdgeCount })
    }

    return { nodeIds, oddCount, edgeCount: subEdges.length, components }
  }

  /**
   * 最小权完美匹配（DP 位掩码 + 贪心回退）
   */
  _minWeightPerfectMatching(vertices, distance) {
    const n = vertices.length
    if (n === 0) return []
    if (n % 2 !== 0) return []

    if (n > 16) return this._greedyMatching(vertices, distance)

    const size = 1 << n
    const dp = new Float64Array(size).fill(Infinity)
    dp[0] = 0
    const pair = new Int32Array(size).fill(-1)

    for (let mask = 0; mask < size; mask++) {
      if (dp[mask] === Infinity) continue

      let first = -1
      for (let i = 0; i < n; i++) {
        if (!(mask & (1 << i))) { first = i; break }
      }
      if (first === -1) continue

      for (let j = first + 1; j < n; j++) {
        if (mask & (1 << j)) continue
        const nextMask = mask | (1 << first) | (1 << j)
        const d = distance[vertices[first]][vertices[j]]
        if (d === Infinity) continue
        const newDist = dp[mask] + d
        if (newDist < dp[nextMask]) {
          dp[nextMask] = newDist
          pair[nextMask] = first * n + j
        }
      }
    }

    const result = []
    let mask = size - 1
    while (mask) {
      const p = pair[mask]
      if (p === -1) break
      const i = Math.floor(p / n)
      const j = p % n
      result.push([vertices[i], vertices[j]])
      mask &= ~(1 << i)
      mask &= ~(1 << j)
    }

    return result
  }

  /** 贪心匹配回退 */
  _greedyMatching(vertices, distance) {
    const n = vertices.length
    const paired = new Array(n).fill(false)
    const result = []

    for (let i = 0; i < n; i++) {
      if (paired[i]) continue
      let bestJ = -1
      let bestDist = Infinity
      for (let j = i + 1; j < n; j++) {
        if (paired[j]) continue
        const d = distance[vertices[i]][vertices[j]]
        if (d < bestDist) {
          bestDist = d
          bestJ = j
        }
      }
      if (bestJ !== -1) {
        result.push([vertices[i], vertices[bestJ]])
        paired[i] = true
        paired[bestJ] = true
      }
    }
    return result
  }

  /**
   * Hierholzer 算法 — 在多重图中找欧拉回路
   */
  _findEulerianCircuit(edges, startNodeId) {
    if (edges.length === 0) return null

    const remaining = {}
    for (const edge of edges) {
      const key = [edge.from, edge.to].sort().join('\u2194')
      remaining[key] = (remaining[key] || 0) + 1
    }

    const adj = {}
    for (const edge of edges) {
      if (!adj[edge.from]) adj[edge.from] = new Set()
      if (!adj[edge.to]) adj[edge.to] = new Set()
      adj[edge.from].add(edge.to)
      adj[edge.to].add(edge.from)
    }

    const stack = [startNodeId]
    const circuit = []

    while (stack.length > 0) {
      const current = stack[stack.length - 1]
      const neighbors = adj[current]
      let found = null

      if (neighbors) {
        for (const next of neighbors) {
          const key = [current, next].sort().join('\u2194')
          if ((remaining[key] || 0) > 0) {
            found = next
            remaining[key]--
            break
          }
        }
      }

      if (found !== null) {
        stack.push(found)
      } else {
        circuit.push(stack.pop())
      }
    }

    return circuit.length > 1 ? circuit : null
  }

  // ─── 内部：多重策略回退辅助 ───────────────────────────────────────────

  /**
   * 分治策略 — 按连通分量分别规划回路再拼接
   *
   * 对每个连通分量使用贪心回路规划，分量间用 A* 最短路径桥接。
   */
  _planByComponent(startNodeId, targetEdgeIds, components, options = {}) {
    const { excludeNodeIds = [] } = options
    const targetEdgeSet = new Set(targetEdgeIds)

    // 获取每个分量的边 ID 列表
    const componentEdgeIdsList = components.map(component => {
      const compEdgeSet = new Set()
      for (const edge of this.edges) {
        if (targetEdgeSet.has(edge.id)
          && component.nodeIds.includes(edge.from)
          && component.nodeIds.includes(edge.to)) {
          compEdgeSet.add(edge.id)
        }
      }
      return Array.from(compEdgeSet)
    })

    const fullCircuit = []
    let currentStartNodeId = startNodeId

    for (let ci = 0; ci < componentEdgeIdsList.length; ci++) {
      const compEdgeIds = componentEdgeIdsList[ci]
      if (compEdgeIds.length === 0) continue

      // 找到离 currentStartNodeId 最近的该分量节点
      let closestNodeInComponent = null
      let closestDistance = Infinity
      let closestPath = null

      for (const nodeId of components[ci].nodeIds) {
        if (excludeNodeIds.includes(nodeId)) continue
        const path = this.findPath(currentStartNodeId, nodeId, { excludeNodeIds })
        if (!path) continue

        let pathWeight = 0
        for (let k = 0; k < path.length - 1; k++) {
          const edgeNeighbor = (this.adjacency[path[k]] || []).find(n => n.to === path[k + 1])
          if (edgeNeighbor) pathWeight += edgeNeighbor.weight
        }
        if (pathWeight < closestDistance) {
          closestDistance = pathWeight
          closestNodeInComponent = nodeId
          closestPath = path
        }
      }

      if (!closestNodeInComponent) continue

      // 规划该分量的贪心回路
      const componentCircuit = this.planGreedyCircuit(closestNodeInComponent, compEdgeIds, { excludeNodeIds })
      if (!componentCircuit) continue

      // 将桥接路径（不含目标节点重复）和分量回路拼接到完整回路中
      if (closestPath && closestPath.length > 1) {
        fullCircuit.push(...closestPath.slice(0, -1))
      }
      fullCircuit.push(...componentCircuit)

      currentStartNodeId = componentCircuit[componentCircuit.length - 1]
    }

    if (fullCircuit.length === 0) return null

    // 确保以 startNodeId 开头
    if (fullCircuit[0] !== startNodeId) {
      fullCircuit.unshift(startNodeId)
    }

    // 确保以 startNodeId 结尾
    if (fullCircuit[fullCircuit.length - 1] !== startNodeId) {
      const returnPath = this.findPath(fullCircuit[fullCircuit.length - 1], startNodeId, { excludeNodeIds })
      if (returnPath) {
        fullCircuit.push(...returnPath.slice(1))
      }
    }

    return fullCircuit
  }

  /**
   * 逐边遍历 + A* 最短路径桥接（最终回退策略）
   *
   * 每次选择一条未访问边，使用 A* 寻路到其端点，遍历后继续下一轮。
   */
  _planEdgeByEdge(startNodeId, targetEdgeIds, options = {}) {
    const excludeNodeIds = options.excludeNodeIds ?? []
    const excluded = excludeNodeIds instanceof Set ? excludeNodeIds : new Set(excludeNodeIds)

    const edgeSet = new Set(targetEdgeIds)
    const visitedEdges = new Set()
    const circuit = [startNodeId]
    let currentNodeId = startNodeId

    while (visitedEdges.size < edgeSet.size) {
      let bestTarget = null
      let bestTotalCost = Infinity
      let bestPath = null
      let bestEdgeEndNodeId = null

      for (const [nodeId, neighbors] of Object.entries(this.adjacency)) {
        if (excluded.has(nodeId)) continue
        for (const neighbor of neighbors) {
          if (!edgeSet.has(neighbor.edgeId) || visitedEdges.has(neighbor.edgeId)) continue

          const routePath = this.findPath(currentNodeId, nodeId, { excludeNodeIds })
          if (!routePath) continue

          let pathWeight = 0
          for (let k = 0; k < routePath.length - 1; k++) {
            const edgeNeighbor = (this.adjacency[routePath[k]] || []).find(n => n.to === routePath[k + 1])
            if (edgeNeighbor) pathWeight += edgeNeighbor.weight
          }

          const totalCost = pathWeight + neighbor.weight
          if (totalCost < bestTotalCost) {
            bestTotalCost = totalCost
            bestTarget = neighbor
            bestPath = routePath
            bestEdgeEndNodeId = neighbor.to
          }
        }
      }

      if (!bestTarget) break

      if (bestPath && bestPath.length > 1) {
        circuit.push(...bestPath.slice(1))
      }
      circuit.push(bestEdgeEndNodeId)
      visitedEdges.add(bestTarget.edgeId)
      currentNodeId = bestEdgeEndNodeId
    }

    // 返回 startNodeId
    if (circuit[circuit.length - 1] !== startNodeId) {
      const returnPath = this.findPath(currentNodeId, startNodeId, { excludeNodeIds })
      if (returnPath) {
        circuit.push(...returnPath.slice(1))
      }
    }

    return circuit
  }
}
