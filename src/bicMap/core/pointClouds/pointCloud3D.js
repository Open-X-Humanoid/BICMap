import maplibregl from 'maplibre-gl';
import * as THREE from 'three';

const DEFAULT_OPTIONS = {
  pointSize: 6,
  pointColor: '#ff3b3b',
  pointOpacity: 0.9,
  useColorMap: false,
  colorMap: [
    [0, '#2b7bff'],
    [0.5, '#19d3a2'],
    [1, '#ff5a5a']
  ],
  zRange: [0, 5],
  heightScale: 1,
  heightOffset: 0,
  sizeAttenuation: false,
  visible: true,
  debug: false
}

const LAYER_ID = 'point-cloud-3d-layer'

/**
 * 将 HEX 颜色转为 [r,g,b]（0~1）
 * @param {string} hex
 * @returns {number[]}
 */
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [1, 0, 0]
}

/**
 * 线性插值颜色映射：根据归一化 z 在 colorMap 中取色
 */
function getColorFromZ(z, range, colorMap) {
  const t = Math.max(0, Math.min(1, (z - range[0]) / (range[1] - range[0] || 1)))
  for (let i = 0; i < colorMap.length - 1; i++) {
    const [p1, c1] = colorMap[i]
    const [p2, c2] = colorMap[i + 1]
    if (t >= p1 && t <= p2) {
      const r = (t - p1) / (p2 - p1 || 1)
      const a = hexToRgb(c1)
      const b = hexToRgb(c2)
      return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r, a[2] + (b[2] - a[2]) * r]
    }
  }
  return hexToRgb(colorMap[colorMap.length - 1][1])
}

/**
 * 创建一个真 3D 点云（Three.js + MapLibre custom layer）
 * @param {Object} map - maplibre 地图实例
 * @param {Array<[number,number,number?]>} points - 点云数据 [lng, lat, z?]
 * @param {Object} [options]
 * @returns {Object} 控制器：update / show / hide / remove / getPoints / getOptions
 */
export function createPointCloud3D(map, points = [], options = {}) {
  if (!map) {
    console.error('[pointCloud3D] map is required')
    return null
  }
  if (!maplibregl || !maplibregl.MercatorCoordinate) {
    console.error('[pointCloud3D] maplibregl.MercatorCoordinate not available')
    return null
  }
  if (!THREE || !THREE.Scene) {
    console.error('[pointCloud3D] three.js not available')
    return null
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }
  let pointsData = Array.isArray(points) ? points : []

  let originMC = null
  let metersPerMercator = 1

  const computeOrigin = () => {
    const ref =
      pointsData.length > 0
        ? { lng: pointsData[0][0], lat: pointsData[0][1] }
        : map.getCenter()
    originMC = maplibregl.MercatorCoordinate.fromLngLat(ref, 0)
    metersPerMercator = originMC.meterInMercatorCoordinateUnits()
  }

  const scene = new THREE.Scene()
  const camera = new THREE.Camera()
  let renderer = null
  let geometry = null
  let material = null
  let pointsObj = null
  let renderLogged = false

  // 复用的 Matrix4，避免每帧 GC
  const _matM = new THREE.Matrix4()
  const _matL = new THREE.Matrix4()
  const _scaleVec = new THREE.Vector3()

  /**
   * 构建 / 重建 BufferGeometry。
   * 顶点存「相对 originMC 的米数，(东, 北, 上)」；渲染时由 L 矩阵做 Y 反号
   * 与缩放，把它转换到 mercator [0,1] 坐标。
   */
  const buildGeometry = () => {
    if (!originMC) computeOrigin()
    const count = pointsData.length
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const baseColor = hexToRgb(opts.pointColor)
    const invMPM = 1 / metersPerMercator

    for (let i = 0; i < count; i++) {
      const p = pointsData[i]
      const z = p.length > 2 && p[2] !== undefined ? p[2] : 0
      const altitude = z * opts.heightScale + opts.heightOffset
      const mc = maplibregl.MercatorCoordinate.fromLngLat({ lng: p[0], lat: p[1] }, altitude)
      const color = opts.useColorMap ? getColorFromZ(z, opts.zRange, opts.colorMap) : baseColor

      const o = i * 3
      // 东向米：mercator x 正方向即东，直接用
      positions[o] = (mc.x - originMC.x) * invMPM
      // 北向米：mercator y 正方向是南，翻一次号变成北向（与 L 里的 -s 配合回到 mercator）
      positions[o + 1] = -(mc.y - originMC.y) * invMPM
      // 上向米：mercator z 正方向即高度，直接用
      positions[o + 2] = (mc.z - originMC.z) * invMPM
      colors[o] = color[0]
      colors[o + 1] = color[1]
      colors[o + 2] = color[2]
    }

    if (geometry) geometry.dispose()
    geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeBoundingSphere()
  }

  /**
   * 构建 / 更新 ShaderMaterial：自定义 vert/frag，不依赖 Three 内建 Points 管线的
   * size/scale/attenuation 逻辑，最大化可控性。圆形裁剪在 frag 里做。
   */
  const buildMaterial = () => {
    if (!material) {
      material = new THREE.ShaderMaterial({
        uniforms: {
          uSize: { value: opts.pointSize },
          uOpacity: { value: opts.pointOpacity }
        },
        vertexShader: `
          attribute vec3 color;
          uniform float uSize;
          varying vec3 vColor;
          void main() {
            vColor = color;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize;
          }
        `,
        fragmentShader: `
          precision mediump float;
          uniform float uOpacity;
          varying vec3 vColor;
          void main() {
            vec2 c = gl_PointCoord - vec2(0.5);
            float d = length(c);
            if (d > 0.5) discard;
            float a = (1.0 - smoothstep(0.42, 0.5, d)) * uOpacity;
            gl_FragColor = vec4(vColor, a);
          }
        `,
        transparent: true,
        depthTest: true,
        depthWrite: true
      })
    } else {
      material.uniforms.uSize.value = opts.pointSize
      material.uniforms.uOpacity.value = opts.pointOpacity
    }
  }

  const customLayer = {
    id: LAYER_ID,
    type: 'custom',
    renderingMode: '3d',

    onAdd(mapInstance, gl) {
      this._map = mapInstance

      try {
        renderer = new THREE.WebGLRenderer({
          canvas: mapInstance.getCanvas(),
          context: gl,
          antialias: true
        })
      } catch (e) {
        console.error('[pointCloud3D] WebGLRenderer init failed:', e)
        return
      }
      renderer.autoClear = false

      buildGeometry()
      buildMaterial()

      pointsObj = new THREE.Points(geometry, material)
      pointsObj.frustumCulled = false
      // 显式保持单位矩阵：所有世界变换都放到 camera.projectionMatrix 上
      pointsObj.matrixAutoUpdate = false
      pointsObj.matrix.identity()
      pointsObj.matrixWorld.identity()

      scene.add(pointsObj)

      if (opts.debug) {
        console.log('[pointCloud3D] onAdd', {
          count: pointsData.length,
          origin: originMC,
          mpm: metersPerMercator,
          glVersion: gl.getParameter(gl.VERSION),
          canvasSize: [mapInstance.getCanvas().width, mapInstance.getCanvas().height]
        })
      }
    },

    render(gl, matrixOrArgs) {
      if (!renderer || !pointsObj || !originMC) return

      // maplibre-gl 5.x: 第二个参数是 CustomRenderMethodInput 对象，其中
      //   defaultProjectionData.mainMatrix 是「mercator[0,1] → clip」的矩阵，
      //   是唯一对任意 pitch/bearing/zoom 都稳定的选择
      let mainMatrix = null
      let source = 'none'
      if (Array.isArray(matrixOrArgs) || matrixOrArgs instanceof Float32Array) {
        mainMatrix = matrixOrArgs
        source = 'legacy-matrix-arg'
      } else if (matrixOrArgs && typeof matrixOrArgs === 'object') {
        const dpd = matrixOrArgs.defaultProjectionData
        if (dpd?.mainMatrix && dpd.mainMatrix.length === 16) {
          mainMatrix = dpd.mainMatrix
          source = 'defaultProjectionData.mainMatrix'
        } else if (matrixOrArgs.projectionMatrix?.length === 16) {
          mainMatrix = matrixOrArgs.projectionMatrix
          source = 'projectionMatrix'
        } else if (matrixOrArgs.modelViewProjectionMatrix?.length === 16) {
          mainMatrix = matrixOrArgs.modelViewProjectionMatrix
          source = 'modelViewProjectionMatrix'
        }
      }

      if (!mainMatrix || mainMatrix.length !== 16) return

      // L：把顶点缓冲里的「相对 origin 米数，(东,北,上)」转到 MC [0,1]
      //    - 平移到 originMC
      //    - 缩放 (s, -s, s)：Y 反号把「北向」翻回 mercator 南向约定
      //    - s = meterInMercatorCoordinateUnits（mercator单位/米）
      const s = metersPerMercator
      _scaleVec.set(s, -s, s)
      _matL
        .makeTranslation(originMC.x, originMC.y, originMC.z)
        .scale(_scaleVec)

      // M：mainMatrix 本身
      _matM.fromArray(mainMatrix)

      // camera.projectionMatrix = M · L；view matrix 固定为单位矩阵
      camera.projectionMatrix.multiplyMatrices(_matM, _matL)
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
      camera.matrixWorld.identity()
      camera.matrixWorldInverse.identity()

      if (opts.debug && !renderLogged) {
        renderLogged = true
        console.log('[pointCloud3D] first render tick', {
          vertices: pointsObj.geometry.attributes.position?.count,
          mvpSource: source,
          originMC,
          s
        })
      }

      renderer.resetState()
      renderer.render(scene, camera)
    },

    onRemove(_map, _gl) {
      if (pointsObj) scene.remove(pointsObj)
      if (geometry) geometry.dispose()
      if (material) material.dispose()
      pointsObj = null
      geometry = null
      material = null
      renderer = null
    }
  }

  const addLayerSafely = () => {
    if (map.getLayer(LAYER_ID)) return
    map.addLayer(customLayer)
    if (!opts.visible) map.setLayoutProperty(LAYER_ID, 'visibility', 'none')
    map.triggerRepaint()
  }

  // 判断 style 是否已经 ready 即可（不能依赖 map.loaded()——那要求所有 source idle，
  // SLAM 图片 source 加载期间它会一直是 false；而 'load' 事件早已触发过，once 不会再回调）
  if (typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true) {
    addLayerSafely()
  } else {
    map.once('styledata', addLayerSafely)
  }

  return {
    update(newPoints, updateOptions = {}) {
      const pointsChanged = Array.isArray(newPoints)
      if (pointsChanged) pointsData = newPoints
      Object.assign(opts, updateOptions)
      if (pointsChanged) computeOrigin()

      // 兜底：如果 layer 还没加到 map（比如 style 没 ready 时的遗留状态，
      // 或 HMR 下保留了旧 controller），这里现加一次，让 onAdd 正确跑一遍
      if (!map.getLayer(LAYER_ID)) {
        addLayerSafely()
        return
      }

      if (pointsObj) {
        buildGeometry()
        buildMaterial()
        pointsObj.geometry = geometry
        pointsObj.material = material
      }
      map.triggerRepaint()
    },
    show() {
      opts.visible = true
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'visible')
      map.triggerRepaint()
    },
    hide() {
      opts.visible = false
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none')
    },
    remove() {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
    },
    getPoints: () => [...pointsData],
    getOptions: () => ({ ...opts })
  }
}

export default { createPointCloud3D }
