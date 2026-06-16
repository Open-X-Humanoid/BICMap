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