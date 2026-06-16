/*
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-22 16:55:30
 * @LastEditTime: 2026-05-28 10:52:01
 * @LastEditors: kai.lee@x-humanoid.com
 * @Description: 插件入口
 * @FilePath: /bic-map-plugin/src/index.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */
import bicMap from './bicMap'

// 导出地图库
export default bicMap

// 添加Vue插件支持
bicMap.install = (app) => {
  // 添加全局属性，使其可以通过this.$bicMap访问
  app.config.globalProperties.$bicMap = bicMap
}