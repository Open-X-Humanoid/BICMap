import bicMap from './bicMap'

// 导出地图库
export default bicMap

// 添加Vue插件支持
bicMap.install = (app) => {
  // 添加全局属性，使其可以通过this.$bicMap访问
  app.config.globalProperties.$bicMap = bicMap
}