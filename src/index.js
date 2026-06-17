import bicMap from './bicMap'

import * as robotUtils from './bicMap/core/robot/index.js'
import * as navigationUtils from './bicMap/core/navigation/index.js'
import * as mapFeatureUtils from './bicMap/core/mapFeatures/index.js'
import * as overlayUtils from './bicMap/core/overlay/index.js'

// 将扩展能力（机器人编排 / 导航 / 地图要素 / 覆盖物）挂到 bicMap 单例上，
// 与既有 bicMap.createMap 等方法保持一致的访问风格，避免入口同时使用
// default + named 导出而触发 Rollup 警告（UMD 消费方需用 .default 的问题）。
Object.assign(
  bicMap,
  robotUtils,
  navigationUtils,
  mapFeatureUtils,
  overlayUtils
)

// 同时按命名空间分组挂载，便于按域访问，避免顶层命名冲突时的歧义
bicMap.robot = robotUtils
bicMap.navigation = navigationUtils
bicMap.mapFeatures = mapFeatureUtils
bicMap.overlay = overlayUtils

// 添加Vue插件支持
bicMap.install = (app) => {
  // 添加全局属性，使其可以通过this.$bicMap访问
  app.config.globalProperties.$bicMap = bicMap
}

// 导出地图库（仅 default 导出，保证 UMD/ESM 消费方一致使用 bicMap 对象）
export default bicMap
