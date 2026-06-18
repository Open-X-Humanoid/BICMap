/**
 * Navigation utilities - 导航与路径规划相关工具函数
 */

// 地理坐标工具
export { createGeoUtils, cartDist, cartHeading, iconRot, lerpAngle } from './geoUtils.js'

// 路径构建
export { initPathfinder, buildPathfindingRoute, routeIdsToCoords } from './pathBuild.js'

// 路径规划核心
export { Pathfinder } from './pathFinding.js'

// 图结构路径规划（道路网络寻路）
export { GraphPathfinder } from './graphPathFinding.js'

// POI 工具
export {
  isPointInForbiddenZone,
  findNearestBoundaryPoint,
  findForbiddenZoneCornerTarget,
  findAnnouncementPoint
} from './poiUtil.js'

// 点/多边形工具
export { pointInPolygon, segmentsIntersect, lineSegmentIntersectsPolygon } from './pointUtil.js'

// 图路径构建与验证
export {
  buildRoute,
  buildGraphCoveragePath,
  buildGraphPointToPointPath,
  removeEdgesThroughBuildings,
  validatePathSegments,
  createPathValidator,
  projectToNearestGraphEdge,
  validateCollision,
} from './graphPathBuild.js'
