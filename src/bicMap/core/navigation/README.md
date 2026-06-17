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
通用 A* 路径规划算法实现。

**主要导出：**
- `Pathfinder` - A* 寻路器类

### pathBuild.js
路径构建和路由管理。

**主要导出：**
- `initPathfinder(widthMeters, heightMeters)` - 初始化寻路器
- `buildPathfindingRoute(points, forbiddenZones)` - 构建寻路路线
- `routeIdsToCoords(routeIdList, allPois)` - 路线 ID 转坐标

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

## 使用示例

```javascript
import {
  createGeoUtils,
  buildPathfindingRoute,
  Pathfinder,
  pointInPolygon
} from '@/bicMap/core/navigation'
```
