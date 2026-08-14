/*
 * @Description: 点云着色计算，输出逐点 RGB(0~1)，供 three.js 独立场景与 maplibre 点云图层共用
 * @FilePath: src/examples/expand/PcdViewer/pointColors.js
 */
import { COLOR_MODE, HEIGHT_COLOR_STOPS } from './constants'

// 色带在模块级预解析成 [r,g,b]，避免逐点解析 hex 造成的开销
const HEIGHT_RAMP = HEIGHT_COLOR_STOPS.map(([stop, hex]) => ({ stop, rgb: hexToRgb(hex) }))

/**
 * 当前点云数据实际支持的着色模式，顺序即面板上的展示顺序
 * @param {object} [cloud] parsePcd 的返回值
 * @returns {string[]}
 */
export function availableColorModes(cloud) {
  const modes = [COLOR_MODE.HEIGHT, COLOR_MODE.SINGLE]
  if (cloud?.colors) modes.unshift(COLOR_MODE.RGB)
  if (cloud?.intensities) modes.unshift(COLOR_MODE.INTENSITY)
  return modes
}

/**
 * 生成指定着色模式下的逐点颜色
 * @param {object} cloud parsePcd 的返回值
 * @param {string} mode COLOR_MODE 之一
 * @returns {Float32Array|null} 单色模式返回 null，由调用方用材质基色渲染
 */
export function buildColors(cloud, mode) {
  if (!cloud) return null
  if (mode === COLOR_MODE.RGB) return cloud.colors ?? null
  if (mode === COLOR_MODE.INTENSITY) return buildIntensityColors(cloud)
  if (mode === COLOR_MODE.HEIGHT) return buildHeightColors(cloud)
  return null
}

/**
 * 按 z 值映射到高度色带
 * @param {object} cloud parsePcd 的返回值
 * @returns {Float32Array}
 */
function buildHeightColors(cloud) {
  const { positions, count, bounds } = cloud
  const colors = new Float32Array(count * 3)
  const zMin = bounds.min[2]
  const zSpan = bounds.size[2] || 1

  for (let i = 0; i < count; i++) {
    const offset = i * 3
    writeRampColor((positions[offset + 2] - zMin) / zSpan, colors, offset)
  }
  return colors
}

/**
 * 按反射强度映射到高度色带
 * @param {object} cloud parsePcd 的返回值
 * @returns {Float32Array|null} 无 intensity 字段时返回 null
 */
function buildIntensityColors(cloud) {
  const { intensities, count, bounds } = cloud
  if (!intensities) return null

  const colors = new Float32Array(count * 3)
  const [min, max] = bounds.intensityRange
  const span = max - min || 1

  for (let i = 0; i < count; i++) {
    writeRampColor((intensities[i] - min) / span, colors, i * 3)
  }
  return colors
}

/**
 * 在色带上采样并写入颜色数组
 * @param {number} t 归一化位置，超出 [0,1] 会被截断
 * @param {Float32Array} out 目标数组
 * @param {number} offset 写入起始下标
 */
function writeRampColor(t, out, offset) {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t

  let index = 1
  while (index < HEIGHT_RAMP.length - 1 && clamped > HEIGHT_RAMP[index].stop) index++

  const from = HEIGHT_RAMP[index - 1]
  const to = HEIGHT_RAMP[index]
  const span = to.stop - from.stop
  const k = span > 0 ? (clamped - from.stop) / span : 0

  out[offset] = from.rgb[0] + (to.rgb[0] - from.rgb[0]) * k
  out[offset + 1] = from.rgb[1] + (to.rgb[1] - from.rgb[1]) * k
  out[offset + 2] = from.rgb[2] + (to.rgb[2] - from.rgb[2]) * k
}

/**
 * #rrggbb → [r,g,b]（0~1）
 * @param {string} hex 十六进制颜色
 * @returns {number[]}
 */
function hexToRgb(hex) {
  const matched = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!matched) return [1, 1, 1]
  return [
    parseInt(matched[1], 16) / 255,
    parseInt(matched[2], 16) / 255,
    parseInt(matched[3], 16) / 255
  ]
}
