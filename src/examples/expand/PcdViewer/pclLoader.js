/*
 * @Description: PCD 解析与滤波。未压缩 binary 由 JS 直读；体素降采样 / 去噪走 pcl.js WASM。
 * @FilePath: src/examples/expand/PcdViewer/pclLoader.js
 */
import * as PCL from 'pcl.js'
import pclWasmUrl from 'pcl.js/pcl-core.wasm?url'

import { SOR_MEAN_K, SOR_STDDEV_MUL } from './constants'

// PCD 头里出现这些字段即认为点云自带颜色
const RGB_FIELDS = ['rgb', 'rgba']

let initPromise = null

/**
 * 初始化 pcl.js 的 WASM 运行时，全局只执行一次
 * @returns {Promise<void>}
 */
export function initPcl() {
  if (!initPromise) {
    // 不传 url 时 pcl.js 会按脚本目录去猜 wasm 位置，打包后必然 404，这里显式给出产物地址
    initPromise = PCL.init({ url: pclWasmUrl }).catch((error) => {
      initPromise = null
      throw error
    })
  }
  return initPromise
}

/**
 * 下载并解析 PCD 文件
 * @param {string} url PCD 文件地址
 * @param {object} [options] 见 parsePcd
 * @returns {Promise<object>} 见 parsePcd
 */
export async function loadPcdFromUrl(url, options) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`PCD 下载失败：${response.status} ${response.statusText}`)
  return parsePcd(await response.arrayBuffer(), options)
}

/**
 * 解析 PCD。未压缩 binary 默认走 JS：campus_vbr 这类同时带 intensity+rgb 的点，
 * pcl.js 没有对应点类型，loadPCDData 会在浏览器里把 C++ 异常抛成数字（例如 5766664）。
 * 体素降采样 / 去噪仍走 WASM。
 * @param {ArrayBuffer} buffer PCD 文件内容，支持 ascii / binary / binary_compressed
 * @param {object} [options]
 * @param {number} [options.leafSize=0] 体素栅格叶子尺寸（米），>0 时启用降采样
 * @param {boolean} [options.denoise=false] 是否做统计离群点去除
 * @returns {Promise<{
 *   positions: Float32Array,
 *   colors: (Float32Array|null),
 *   intensities: (Float32Array|null),
 *   count: number,
 *   rawCount: number,
 *   bounds: object,
 *   fields: string[],
 *   dataType: string,
 *   cost: number
 * }>}
 */
export async function parsePcd(buffer, options = {}) {
  const { leafSize = 0, denoise = false } = options
  const startedAt = performance.now()
  const needsFilter = leafSize > 0 || denoise

  if (!needsFilter) {
    const parsed = parseUncompressedPcd(buffer)
    if (parsed) {
      return {
        ...parsed,
        rawCount: parsed.count,
        cost: Math.round(performance.now() - startedAt)
      }
    }
  }

  try {
    return await parsePcdWithPcl(buffer, { leafSize, denoise, startedAt })
  } catch (error) {
    const fallback = parseUncompressedPcd(buffer)
    if (fallback) {
      console.warn('PCL 滤波失败，已回退为未滤波解析:', error)
      return {
        ...fallback,
        rawCount: fallback.count,
        cost: Math.round(performance.now() - startedAt)
      }
    }
    throw wrapPclError(error)
  }
}

/**
 * 把 pcl.js / Emscripten 抛出的指针数字转成可读错误
 * @param {unknown} error
 * @returns {Error}
 */
function wrapPclError(error) {
  if (error instanceof Error) return error
  return new Error(`PCD 解析失败（PCL ${String(error)}）`)
}

/**
 * 解析未压缩 binary PCD。ascii / binary_compressed 返回 null，交给 PCL。
 * @param {ArrayBuffer} buffer
 * @returns {object|null}
 */
function parseUncompressedPcd(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const header = readPcdHeader(bytes)
  if (!header || header.dataType !== 'binary') return null

  const { fields, sizes, counts, pointCount, dataOffset } = header
  const offsets = {}
  let stride = 0
  fields.forEach((field, i) => {
    offsets[field] = stride
    stride += sizes[i] * counts[i]
  })
  if (offsets.x === undefined || offsets.y === undefined || offsets.z === undefined) return null
  if (dataOffset + pointCount * stride > bytes.byteLength) {
    throw new Error('PCD 文件不完整：数据区短于声明点数')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + dataOffset)
  const rgbField = RGB_FIELDS.find((field) => offsets[field] !== undefined)
  const hasIntensity = offsets.intensity !== undefined

  const positions = new Float32Array(pointCount * 3)
  const colors = rgbField ? new Float32Array(pointCount * 3) : null
  const intensities = hasIntensity ? new Float32Array(pointCount) : null
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  let intensityMin = Infinity
  let intensityMax = -Infinity
  let kept = 0

  for (let i = 0; i < pointCount; i++) {
    const base = i * stride
    const x = view.getFloat32(base + offsets.x, true)
    const y = view.getFloat32(base + offsets.y, true)
    const z = view.getFloat32(base + offsets.z, true)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue

    const dest = kept * 3
    positions[dest] = x
    positions[dest + 1] = y
    positions[dest + 2] = z
    if (x < min[0]) min[0] = x
    if (y < min[1]) min[1] = y
    if (z < min[2]) min[2] = z
    if (x > max[0]) max[0] = x
    if (y > max[1]) max[1] = y
    if (z > max[2]) max[2] = z

    if (colors) {
      const packed = view.getUint32(base + offsets[rgbField], true)
      colors[dest] = ((packed >> 16) & 255) / 255
      colors[dest + 1] = ((packed >> 8) & 255) / 255
      colors[dest + 2] = (packed & 255) / 255
    }

    if (intensities) {
      const intensity = view.getFloat32(base + offsets.intensity, true)
      intensities[kept] = intensity
      if (intensity < intensityMin) intensityMin = intensity
      if (intensity > intensityMax) intensityMax = intensity
    }

    kept++
  }

  return {
    positions: kept === pointCount ? positions : positions.subarray(0, kept * 3),
    colors: colors && kept === pointCount ? colors : colors?.subarray(0, kept * 3) ?? null,
    intensities: intensities && kept === pointCount ? intensities : intensities?.subarray(0, kept) ?? null,
    count: kept,
    bounds: buildBounds(min, max, kept, intensityMin, intensityMax),
    fields,
    dataType: header.dataType
  }
}

/**
 * 读 PCD 文本头，定位 DATA 行
 * @param {Uint8Array} bytes
 * @returns {{ fields: string[], sizes: number[], counts: number[], pointCount: number, dataType: string, dataOffset: number }|null}
 */
function readPcdHeader(bytes) {
  const marker = indexOfDataLine(bytes)
  if (!marker) return null
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, marker.lineEnd))
  const fields = /FIELDS (.+)/.exec(header)?.[1].trim().split(/\s+/)
  const sizes = /SIZE (.+)/.exec(header)?.[1].trim().split(/\s+/).map(Number)
  const counts = /COUNT (.+)/.exec(header)?.[1].trim().split(/\s+/).map(Number) ?? fields?.map(() => 1)
  const pointCount = Number(/POINTS (\d+)/.exec(header)?.[1])
  if (!fields || !sizes || !Number.isFinite(pointCount)) return null
  return {
    fields,
    sizes,
    counts,
    pointCount,
    dataType: marker.dataType,
    dataOffset: marker.lineEnd + 1
  }
}

/**
 * 找到 DATA 行末尾（数据区起点的前一个换行）
 * @param {Uint8Array} bytes
 * @returns {{ dataType: string, lineEnd: number }|null}
 */
function indexOfDataLine(bytes) {
  const text = new TextDecoder('ascii').decode(bytes.subarray(0, Math.min(bytes.length, 4096)))
  const match = /^DATA (ascii|binary_compressed|binary)\s*$/m.exec(text)
  if (!match) return null
  const lineEnd = text.indexOf('\n', match.index)
  if (lineEnd < 0) return null
  return { dataType: match[1], lineEnd }
}

/**
 * 用 PCL 解析并滤波
 * @param {ArrayBuffer} buffer
 * @param {{ leafSize: number, denoise: boolean, startedAt: number }} options
 */
async function parsePcdWithPcl(buffer, { leafSize, denoise, startedAt }) {
  await initPcl()

  const header = PCL.readPCDHeader(buffer)
  const fields = header?.fields ?? []
  const { PT, kind } = resolvePointType(fields)

  // 每一步滤波都会产出新的 WASM 对象，统一登记后在 finally 里释放，避免 heap 泄漏
  const disposables = []
  const track = (cloud) => {
    if (cloud && !disposables.includes(cloud)) disposables.push(cloud)
    return cloud
  }

  try {
    let cloud = track(PCL.loadPCDData(buffer, PT))
    const rawCount = cloud.size

    // 含 NaN 的稀疏点云会污染包围盒，先剔除再进滤波
    if (!cloud.isDense) {
      const { cloud: dense, indices } = PCL.removeNaNFromPointCloud(cloud)
      indices?.manager?.delete()
      cloud = track(dense)
    }

    if (leafSize > 0) {
      cloud = track(
        applyFilter(new PCL.VoxelGrid(PT), cloud, (filter) => {
          filter.setLeafSize(leafSize, leafSize, leafSize)
          // 关闭时 VoxelGrid 只保留体素质心的 xyz，rgb / intensity 会被丢弃
          filter.setDownsampleAllData(kind !== 'xyz')
        })
      )
    }

    if (denoise) {
      cloud = track(
        applyFilter(new PCL.StatisticalOutlierRemoval(PT), cloud, (filter) => {
          filter.setMeanK(SOR_MEAN_K)
          filter.setStddevMulThresh(SOR_STDDEV_MUL)
        })
      )
    }

    return {
      ...extractGeometry(cloud, kind),
      rawCount,
      fields,
      dataType: header?.data ?? 'unknown',
      cost: Math.round(performance.now() - startedAt)
    }
  } finally {
    disposables.forEach((cloud) => {
      if (!cloud.manager.isDeleted()) cloud.manager.delete()
    })
  }
}

/**
 * 按 PCD 字段选择 PCL 点类型：类型选错会导致 rgb / intensity 被直接丢弃
 * @param {string[]} fields PCD 头中的 FIELDS
 * @returns {{ PT: Function, kind: 'rgb'|'intensity'|'xyz' }}
 */
function resolvePointType(fields) {
  if (fields.some((field) => RGB_FIELDS.includes(field))) {
    return { PT: PCL.PointXYZRGB, kind: 'rgb' }
  }
  if (fields.includes('intensity')) {
    return { PT: PCL.PointXYZI, kind: 'intensity' }
  }
  return { PT: PCL.PointXYZ, kind: 'xyz' }
}

/**
 * 执行一次 PCL 滤波并释放滤波器本身
 * @param {object} filter PCL 滤波器实例
 * @param {object} cloud 输入点云
 * @param {(filter: object) => void} configure 滤波参数配置回调
 * @returns {object} 滤波结果，滤波器不可用时原样返回输入点云
 */
function applyFilter(filter, cloud, configure) {
  configure(filter)
  filter.setInputCloud(cloud)
  const output = filter.filter()
  filter.manager.delete()
  return output ?? cloud
}

/**
 * 把 PCL 点云拷成 TypedArray，并顺带算出包围盒
 * @param {object} cloud PCL 点云
 * @param {'rgb'|'intensity'|'xyz'} kind 点云附带的属性种类
 * @returns {{ positions: Float32Array, colors: (Float32Array|null), intensities: (Float32Array|null), count: number, bounds: object }}
 */
function extractGeometry(cloud, kind) {
  // pcl.js 的 Points.get() 每取一个点都会 new 一次包装对象，十万级点云下开销就已经很可观；
  // 这里直接读底层 embind vector，一次循环填满 TypedArray
  const nativePoints = cloud.points._native
  const count = nativePoints.size()

  const positions = new Float32Array(count * 3)
  const colors = kind === 'rgb' ? new Float32Array(count * 3) : null
  const intensities = kind === 'intensity' ? new Float32Array(count) : null

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  let intensityMin = Infinity
  let intensityMax = -Infinity

  for (let i = 0; i < count; i++) {
    const point = nativePoints.get(i)
    const offset = i * 3
    const { x, y, z } = point

    positions[offset] = x
    positions[offset + 1] = y
    positions[offset + 2] = z

    if (x < min[0]) min[0] = x
    if (y < min[1]) min[1] = y
    if (z < min[2]) min[2] = z
    if (x > max[0]) max[0] = x
    if (y > max[1]) max[1] = y
    if (z > max[2]) max[2] = z

    if (colors) {
      colors[offset] = point.r / 255
      colors[offset + 1] = point.g / 255
      colors[offset + 2] = point.b / 255
    }

    if (intensities) {
      const intensity = point.intensity
      intensities[i] = intensity
      if (intensity < intensityMin) intensityMin = intensity
      if (intensity > intensityMax) intensityMax = intensity
    }
  }

  return {
    positions,
    colors,
    intensities,
    count,
    bounds: buildBounds(min, max, count, intensityMin, intensityMax)
  }
}

/**
 * 由 min / max 推导出场景自适应需要的中心、尺寸与外接球半径
 * @param {number[]} min 包围盒最小点
 * @param {number[]} max 包围盒最大点
 * @param {number} count 点数，为 0 时返回单位包围盒兜底
 * @param {number} intensityMin 强度最小值
 * @param {number} intensityMax 强度最大值
 * @returns {{ min: number[], max: number[], center: number[], size: number[], radius: number, intensityRange: number[] }}
 */
function buildBounds(min, max, count, intensityMin, intensityMax) {
  if (!count) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      center: [0, 0, 0],
      size: [1, 1, 1],
      radius: 1,
      intensityRange: [0, 1]
    }
  }

  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  const radius = Math.max(Math.hypot(size[0], size[1], size[2]) / 2, 1e-3)
  const hasIntensity = intensityMax > intensityMin

  return {
    min,
    max,
    center,
    size,
    radius,
    intensityRange: hasIntensity ? [intensityMin, intensityMax] : [0, 1]
  }
}
