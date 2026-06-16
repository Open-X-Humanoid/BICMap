/*
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-01-XX XX:XX:XX
 * @Description: CDN 版本入口文件 - 将 bicMap 暴露到全局作用域
 * @FilePath: /bic-map-plugin/src/cdn.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */
import bicMap from './bicMap'

// 将 bicMap 暴露到全局作用域
if (typeof window !== 'undefined') {
  window.bicMap = bicMap
  // 也可以通过 BicMap 访问（兼容性考虑）
  window.BicMap = bicMap
}

// 同时支持 CommonJS 和 AMD 模块系统
if (typeof module !== 'undefined' && module.exports) {
  module.exports = bicMap
}

if (typeof define === 'function' && define.amd) {
  define(() => bicMap)
}

// 默认导出
export default bicMap 