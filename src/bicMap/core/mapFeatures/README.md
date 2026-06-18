# Map Utils - 地图工具

地图相关的基础工具函数集合。

## 功能模块

### floorManager.js
多楼层地图管理器，支持酒店等多层建筑场景的 SLAM 地图按层加载/卸载。

**主要导出：**
- `createFloorManager(map, options)` - 创建楼层管理器

### semanticZones.js
语义区域样式预设，为酒店/仓库等场景提供禁行/限速/服务范围等标准化区域样式。

**主要导出：**
- `ZONE_TYPE` - 区域类型枚举（禁行区、限速区、服务范围等）
- `ZONE_STYLE_PRESETS` - 各类型默认样式配置
- `createSemanticZones(map, zones, options)` - 创建语义区域

### layerEvents.js
通用 MapLibre 图层事件路由器，将图层事件分发到精准 id / 属性匹配 / 通配三张路由表。

**主要导出：**
- `createLayerEvents(map, layerId)` - 创建图层事件路由器

**返回接口：**
- `on(event, handler)` / `off` / `once` — 全局 emitter
- `onFeature(event, handler)` — 通配：任意 feature 均触发
- `onFeature({k:v}, event, handler)` — 属性匹配：feature.properties 满足条件时触发
- `onFeature('id', event, handler)` — 精准 id 匹配
- `offFeature(...)` — 取消 feature 事件监听（签名与 onFeature 对应）
- `destroy()` — 解绑所有事件并清空路由表

### buildings.js
室外建筑物 3D 渲染模块，基于 MapLibre `fill-extrusion` 图层将 GeoJSON 建筑面片拉伸为三维楼块。

**主要导出：**
- `createBuildings(map, geojson, options)` - 创建建筑物 3D 渲染控制器

**GeoJSON Feature 属性字段：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `height` | `number` | 建筑总高度（米） |
| `base_height` | `number` | 底部高度（米），默认 0 |
| `color` | `string` | 建筑颜色（hex/rgb），可选 |
| `name` | `string` | 建筑名称，可选 |

**返回接口：**
`{ show, hide, remove, update, setHeightScale, setOpacity, on, off, once, onFeature, offFeature }`

### shape.js
GeoJSON 图形 footprint 生成工具，提供常见建筑物轮廓形状的坐标辅助函数（WGS84 坐标系）。

> 此文件为独立工具，未在 `index.js` 中导出，按需直接引入。

**主要导出：**
- `rect(cx, cy, w, h)` - 生成矩形 footprint 坐标环

### canvasLabels.js
Canvas 2D 离屏渲染标签工具，将 GeoJSON Polygon/Point 的 `name` 属性渲染为 Canvas Image，以 `icon-image` 注入 symbol 图层，规避 WebGL 中文文本渲染问题。

> 此文件为独立工具，未在 `index.js` 中导出，按需直接引入。

**主要导出：**
- `addCanvasLabels(map, options)` - 创建 Canvas 标签图层

**options 参数：**

| 字段 | 说明 |
|---|---|
| `layerId` | symbol 图层 ID |
| `data` | GeoJSON FeatureCollection（Polygon 或 Point） |
| `style` | 样式覆盖（font / textColor / haloColor / haloBlur / padding / labelKey） |
| `beforeId` | 插入到该图层之前（可选） |

**返回接口：** `{ remove() }` — 调用 `remove()` 清理图层和图片

## 使用示例

```javascript
import { createFloorManager, ZONE_TYPE, createSemanticZones, createLayerEvents, createBuildings } from '@/bicMap/core/mapFeatures'

// 独立工具（shape / canvasLabels）按需直接引入
import { rect } from '@/bicMap/core/mapFeatures/shape.js'
import { addCanvasLabels } from '@/bicMap/core/mapFeatures/canvasLabels.js'
```
