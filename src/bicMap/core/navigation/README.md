# Navigation Utils - 导航工具

路径规划、地理坐标计算和 POI 相关的工具函数集合。

## 功能模块

### geoUtils.js
地理坐标转换和计算工具。

**主要导出：**
- `createGeoUtils(config)` - 创建地理坐标工具集
- `cartDist(a, b)` - 计算两点间欧氏距离
- `cartHeading(from, to)` - 计算北向顺时针角度
- `iconRot(heading)` - 将语义朝向转为图标旋转角
- `lerpAngle(from, to, t)` - 角度线性插值

### pathFinding.js
通用 A\* 路径规划算法实现（网格自由空间寻路）。

**主要导出：**
- `Pathfinder` - A\* 寻路器类

### pathBuild.js
路径构建和路由管理（基于网格 Pathfinder）。

**主要导出：**
- `initPathfinder(widthMeters, heightMeters)` - 初始化寻路器
- `buildPathfindingRoute(points, forbiddenZones)` - 构建寻路路线
- `routeIdsToCoords(routeIdList, allPois)` - 路线 ID 转坐标

### graphPathFinding.js
基于道路拓扑图结构的 A\* 寻路与回路规划器，与 `pathFinding.js`（网格自由空间寻路）互补，路径约束在预定义的图节点和边的连通性上。

**主要导出：**
- `GraphPathfinder` - 图结构路径规划器类

**`GraphPathfinder` API：**

| 方法 | 说明 |
|---|---|
| `findPath(startNodeId, endNodeId, options?)` | A\* 最短路径，返回节点 ID 序列 |
| `findNearestNode(lng, lat)` | 查找离指定 GPS 坐标最近的图节点 |
| `planCircuit(startNodeId, targetEdgeIds, config?)` | 规划覆盖指定边集的回路（自动选择最佳算法） |
| `planChinesePostmanCircuit(startNodeId, targetEdgeIds, options?)` | 中国邮路（CPP）最优覆盖回路 |
| `planGreedyCircuit(startNodeId, targetEdgeIds, options?)` | 贪心最近邻回路（改进版） |

`planCircuit` 自动策略：奇度顶点数 ≤ 24 → CPP（最优）；超出则依次尝试分治、贪心、逐边遍历回退。

### graphPathBuild.js
基于图结构的路径构建管线，提供坐标转换、碰撞检测、图边投影、段级验证等高级能力。

**主要导出：**

| 函数 | 说明 |
|---|---|
| `buildRoute(segments, findPathFn)` | 逐段寻路并展平结果，返回 `{ coords, segmentIndices }` |
| `buildGraphCoveragePath(nodeIdCircuit, options)` | 基于图节点回路构建巡逻路径（含碰撞检测 + 重路由） |
| `buildGraphPointToPointPath(points, options)` | 基于图结构的最短路径（支持途经点 + location snapping） |
| `removeEdgesThroughBuildings(graph, options)` | 剔除图中穿过建筑的边，返回清理后的新图 |
| `validatePathSegments(coords, options)` | 通用路径验证中间件（可插拔 validator + repairFn） |
| `createPathValidator(config)` | 创建可复用的路径验证器工厂 |
| `projectToNearestGraphEdge(xFrac, yFrac, graph, nodeIndex, gpsToFracFn)` | 将点投影到最近的图边 |
| `validateCollision(xFrac, yFrac, buildingPolygons)` | 检查点是否在建筑内，若是则修正到边界外 |

`buildGraphPointToPointPath` 支持输入点格式：
- `string` — 图节点 ID（如 `"N1"`）
- `{ nodeId: string }` — 图节点 ID
- `{ gps: [lng, lat] }` — GPS 坐标（自动吸附到最近道路边）
- `{ cart: { x, y } }` — 笛卡尔坐标（自动吸附）

### poiUtil.js
POI（兴趣点）相关工具函数。

**主要导出：**
- `isPointInForbiddenZone(xFrac, yFrac, forbiddenZones)` - 判断点是否在禁行区内
- `findNearestBoundaryPoint(xFrac, yFrac, forbiddenZones)` - 找到禁行区边界外最近的推出点
- `findForbiddenZoneCornerTarget(...)` - 找到禁行区角落附近的推出点
- `findAnnouncementPoint(options)` - 计算播报点位置

### pointUtil.js
点与多边形几何计算。

**主要导出：**
- `pointInPolygon(px, py, polygon)` - 射线法判断点是否在多边形内
- `segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)` - 检测两条线段是否相交（跨立实验）
- `lineSegmentIntersectsPolygon(x1, y1, x2, y2, polygon)` - 检测线段是否与多边形相交（含线段完全在内部的情况）

## 使用示例

```javascript
import {
  createGeoUtils,
  buildPathfindingRoute,
  Pathfinder,
  GraphPathfinder,
  buildGraphCoveragePath,
  buildGraphPointToPointPath,
  removeEdgesThroughBuildings,
  pointInPolygon,
  segmentsIntersect,
  lineSegmentIntersectsPolygon,
} from '@/bicMap/core/navigation'
```
