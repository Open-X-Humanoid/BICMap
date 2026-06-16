/*
 * @Author: kai.lee@x-humanoid.com
 * @Date: 2026-06-04 14:08:47
 * @LastEditTime: 2026-06-04 16:06:17
 * @LastEditors: kai.lee@x-humanoid.com
 * @Description: 
 * @FilePath: /bic-map-plugin/src/examples/utils/experiment/geoUtils.js
 * Copyright (c) 2024 kai.lee@x-humanoid.com, All Rights Reserved.
 */
/**
 * 创建地理坐标工具集。
 * @param {Object} config
 * @param {number} config.startX   - 笛卡尔起点 X
 * @param {number} config.startY   - 笛卡尔起点 Y
 * @param {number} config.width    - 地图宽度（米）
 * @param {number} config.height   - 地图高度（米）
 * @param {number} config.scale    - 地图分辨率（cart→GPS 缩放系数）
 * @param {number} [config.zoomFactor=2] - GPS 缩放因子
 * @returns {{ fracToCart: (xFrac:number,yFrac:number)=> {x:number,y:number}, cartToGPS: (x:number,y:number)=> [number,number], fracToGPS: (xFrac:number,yFrac:number)=> [number,number] }}
 */
export function createGeoUtils({ startX, startY, width, height, scale, zoomFactor = 2 }) {
  function fracToCart(xFrac, yFrac) {
    return {
      x: startX + xFrac * width,
      y: startY + yFrac * height,
    }
  }

  function cartToGPS(x, y) {
    const g = window.MapUtils.cartesianToGPS({ x, y, scale, zoomFactor })
    return [g.longitude, g.latitude]
  }

  function fracToGPS(xFrac, yFrac) {
    const c = fracToCart(xFrac, yFrac)
    return cartToGPS(c.x, c.y)
  }

  return { fracToCart, cartToGPS, fracToGPS }
}

/** 两点间欧氏距离（米） */
export function cartDist(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
}

/**
 * 北向顺时针角度（0°=正北）
 * @returns {number} heading in degrees [0, 360)
 */
export function cartHeading(from, to) {
  return (Math.atan2(to.x - from.x, to.y - from.y) * (180 / Math.PI) + 360) % 360
}

/**
 * robo.png 默认朝东（East = 90°），将语义朝向（0°=正北）转为图标旋转角。
 * iconRot(0°N) = 270°, iconRot(90°E) = 0°, iconRot(180°S) = 90°, iconRot(270°W) = 180°
 * @returns {number} rotation in degrees
 */
export function iconRot(heading) {
  return (heading - 90 + 360) % 360
}

/**
 * 角度线性插值（正确处理 0/360 环绕，避免转向穿越 360° 跳变）。
 * @param {number} from - 起始角度 [0, 360)
 * @param {number} to   - 目标角度 [0, 360)
 * @param {number} t    - 插值因子 [0, 1]
 * @returns {number}
 */
export function lerpAngle(from, to, t) {
  const diff = ((to - from + 540) % 360) - 180
  return (from + diff * t + 360) % 360
}
