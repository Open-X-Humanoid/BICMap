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

## 使用示例

```javascript
import { createFloorManager, ZONE_TYPE, createSemanticZones } from '@/bicMap/core/mapFeatures'
```
