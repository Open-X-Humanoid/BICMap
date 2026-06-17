/*
 * robot3DLayer.js — 通用 MapLibre 3D 模型自定义图层（无 threebox-plugin）
 *
 * 设计原则：
 *  - 所有 THREE.js API 通过 window.THREE 使用（bicMap 内置 r149 UMD）
 *  - GLTFLoader 通过 unpkg CDN 加载（r128 版本，兼容全局 THREE）
 *  - 相机同步与坐标转换参考 pointCloud3D.js 已验证方案
 *  - 模型配置完全外置（robot3DPresets.js），可随时替换 GLB 文件与动画名
 *  - 内置自动动画状态机：行走时播放 walk，静止时自动切回 idle
 *  - 对外暴露最小接口：addRobot / updateRobot / setAnimation / removeRobot / destroy
 */

function ensureGLTFLoader() {
  if (window.THREE && window.THREE.GLTFLoader) {
    return Promise.resolve(window.THREE.GLTFLoader)
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/three@0.147.0/examples/js/loaders/GLTFLoader.js'
    script.onload = () => {
      if (window.THREE && window.THREE.GLTFLoader) resolve(window.THREE.GLTFLoader)
      else reject(new Error('GLTFLoader 加载后仍未找到'))
    }
    script.onerror = () => reject(new Error('GLTFLoader CDN 加载失败'))
    document.head.appendChild(script)
  })
}

function crossFade(from, to, duration = 0.3) {
  if (!to) return
  if (from && from !== to) from.fadeOut(duration)
  to.reset().fadeIn(duration).play()
}

function haversineDistance(lngLat1, lngLat2) {
  const R = 6371008.8
  const dLat = (lngLat2[1] - lngLat1[1]) * Math.PI / 180
  const dLon = (lngLat2[0] - lngLat1[0]) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lngLat1[1] * Math.PI / 180) * Math.cos(lngLat2[1] * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

let GLTFLoaderPromise = null

/**
 * @typedef {Object} RobotModelConfig
 * @property {string}  url              - GLB 文件的公共路径（相对于 public/）
 * @property {number}  scale            - 模型本身的统一缩放（与 metersScale 叠加）
 * @property {number}  metersScale      - 米→Mercator 缩放系数（通常不需修改）
 * @property {number}  [rotateX]        - 模型 X 轴旋转（弧度），修正坐标系
 * @property {number}  [rotateY]        - 模型 Y 轴旋转（弧度）
 * @property {number}  [rotateZ]        - 模型 Z 轴旋转（弧度）
 * @property {Object}  animations       - { animKey: 'GLB内动画名称' }
 * @property {string}  defaultAnimation - 初始播放的 animKey
 */

export function createRobot3DLayer(map, modelConfig, options = {}) {
  const {
    layerId = 'robot-3d-layer',
    beforeLayerId,
    movementThreshold = 0.1,
    idleDebounceMs = 500,
    headingOffset3D = 0,
  } = options

  const THREE = window.THREE
  const maplibregl = window.maplibregl
  if (!THREE || !maplibregl || !maplibregl.MercatorCoordinate) {
    console.error('[robot3DLayer] window.THREE 或 window.maplibregl 不可用')
    return null
  }

  if (!GLTFLoaderPromise) {
    GLTFLoaderPromise = ensureGLTFLoader()
  }

  let renderer = null
  let scene = null
  let camera = null
  let modelTemplate = null
  let modelTemplateScene = null
  let originMC = null
  let metersPerMercator = 1

  const entries = new Map()

  let lastFrameTime = 0

  const _matM = new THREE.Matrix4()
  const _matL = new THREE.Matrix4()
  const _scaleVec = new THREE.Vector3()

  const customLayer = {
    id: layerId,
    type: 'custom',
    renderingMode: '3d',

    onAdd(mapInstance, gl) {
      scene = new THREE.Scene()
      camera = new THREE.Camera()

      try {
        renderer = new THREE.WebGLRenderer({
          canvas: mapInstance.getCanvas(),
          context: gl,
          antialias: true,
        })
      } catch (e) {
        console.error('[robot3DLayer] WebGLRenderer 初始化失败:', e)
        return
      }
      renderer.autoClear = false

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
      scene.add(ambientLight)
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
      dirLight.position.set(2, 3, 1).normalize()
      scene.add(dirLight)
      const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6)
      dirLight2.position.set(-1, 0.5, -1).normalize()
      scene.add(dirLight2)
      const topLight = new THREE.DirectionalLight(0xffffff, 0.3)
      topLight.position.set(0, 1, 0).normalize()
      scene.add(topLight)

      GLTFLoaderPromise.then(GLTFLoader => {
        const loader = new GLTFLoader()
        loader.load(modelConfig.url, gltf => {
          modelTemplateScene = gltf.scene
          modelTemplate = gltf
          
          if (!originMC) {
            originMC = maplibregl.MercatorCoordinate.fromLngLat(
              mapInstance.getCenter(), 0
            )
            metersPerMercator = originMC.meterInMercatorCoordinateUnits()
          }

          for (const [id, entry] of entries) {
            if (!entry.group) _instantiate(id, entry, mapInstance)
          }
        }, undefined, err => {
          console.error('[robot3DLayer] 模型加载失败:', err)
        })
      })
    },

    render(_gl, matrixOrArgs) {
      if (!renderer || !scene || !originMC) return

      let mainMatrix = null
      if (Array.isArray(matrixOrArgs) || matrixOrArgs instanceof Float32Array) {
        mainMatrix = matrixOrArgs
      } else if (matrixOrArgs && typeof matrixOrArgs === 'object') {
        const dpd = matrixOrArgs.defaultProjectionData
        if (dpd?.mainMatrix && dpd.mainMatrix.length === 16) {
          mainMatrix = dpd.mainMatrix
        } else if (matrixOrArgs.projectionMatrix?.length === 16) {
          mainMatrix = matrixOrArgs.projectionMatrix
        } else if (matrixOrArgs.modelViewProjectionMatrix?.length === 16) {
          mainMatrix = matrixOrArgs.modelViewProjectionMatrix
        }
      }
      if (!mainMatrix || mainMatrix.length !== 16) return

      const now = performance.now()
      const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0.016
      lastFrameTime = now

      for (const entry of entries.values()) {
        if (!entry.group) continue
        if (entry.mixer) entry.mixer.update(dt)
        if (entry.animState === 'manual') continue
        if (entry.lastMoveTime && (now - entry.lastMoveTime) > idleDebounceMs) {
          if (entry.currentAnim !== 'idle') {
            _playAnimation(entry, 'idle')
          }
        }
      }

      const s = metersPerMercator
      _scaleVec.set(s, -s, s)
      _matL
        .makeTranslation(originMC.x, originMC.y, originMC.z)
        .scale(_scaleVec)

      _matM.fromArray(mainMatrix)

      camera.projectionMatrix.multiplyMatrices(_matM, _matL)
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
      camera.matrixWorld.identity()
      camera.matrixWorldInverse.identity()

      renderer.resetState()
      renderer.clearDepth()
      renderer.render(scene, camera)
    },

    onRemove() {
      for (const entry of entries.values()) {
        if (entry.mixer) entry.mixer.stopAllAction()
        if (entry.group) {
          entry.group.traverse(child => {
            if (child.isMesh) {
              if (child.geometry) child.geometry.dispose()
              if (Array.isArray(child.material)) {
                child.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose() })
              } else if (child.material) {
                if (child.material.map) child.material.map.dispose()
                child.material.dispose()
              }
            }
          })
          scene?.remove(entry.group)
        }
      }
      entries.clear()
      modelTemplateScene = null
      modelTemplate = null
      renderer = null
    },
  }

  if (beforeLayerId && map.getLayer(beforeLayerId)) {
    map.addLayer(customLayer, beforeLayerId)
  } else {
    map.addLayer(customLayer)
  }

  function _lngLatToLocalPos(lngLat) {
    const mc = maplibregl.MercatorCoordinate.fromLngLat(
      { lng: lngLat[0], lat: lngLat[1] }, 0
    )
    const invMPM = 1 / metersPerMercator
    return {
      x: (mc.x - originMC.x) * invMPM,
      y: -(mc.y - originMC.y) * invMPM,
      z: (mc.z - originMC.z) * invMPM,
    }
  }

  function _instantiate(id, entry, mapInstance) {
    if (!modelTemplateScene) return

    const clonedScene = modelTemplateScene.clone(true)

    // ── 修复 SkinnedMesh 骨骼引用 ──
    // clone(true) 对 SkinnedMesh 是浅拷贝 skeleton，导致骨骼的 matrixWorld 停留在原点(0,0,0)
    // 需要为每个 SkinnedMesh 创建独立 Skeleton，引用克隆体的骨骼而非原始骨骼
    _fixClonedSkeletons(clonedScene)

    const group = new THREE.Group()
    group.add(clonedScene)

    const s = (modelConfig.scale ?? 1) * (modelConfig.metersScale ?? 1)
    group.scale.set(s, s, s)

    const pos = _lngLatToLocalPos(entry.lngLat)
    group.position.set(pos.x, pos.y, pos.z)

    const rotateX = modelConfig.rotateX ?? 0
    const rotateY = modelConfig.rotateY ?? 0
    const rotateZ = modelConfig.rotateZ ?? 0
    clonedScene.rotation.set(rotateX, rotateY, rotateZ)

    const headingRad = (-entry.heading + headingOffset3D) * Math.PI / 180
    group.rotation.set(0, 0, headingRad)

    const mixer = new THREE.AnimationMixer(clonedScene)
    const actions = {}
    if (modelTemplate && modelTemplate.animations) {
      for (const [key, clipName] of Object.entries(modelConfig.animations ?? {})) {
        const clip = THREE.AnimationClip.findByName(modelTemplate.animations, clipName)
        if (clip) {
          const action = mixer.clipAction(clip)
          action.loop = THREE.LoopRepeat
          actions[key] = action
        }
      }
    }

    scene.add(group)

    entry.group = group
    entry.modelNode = clonedScene
    entry.mixer = mixer
    entry.actions = actions
    entry.currentAnim = null
    entry.prevLngLat = null
    entry.lastMoveTime = null
    entry.animState = 'auto'

    const defaultAnim = modelConfig.defaultAnimation ?? 'idle'
    _playAnimation(entry, defaultAnim)
  }

  /**
   * 修复 clonedScene 中 SkinnedMesh 的骨骼引用
   * clone(true) 对 SkinnedMesh.skeleton 是浅拷贝，克隆体与原始共享同一个 skeleton 对象
   * 导致骨骼的 matrixWorld 停留在原始场景的 (0,0,0)，蒙皮顶点被渲染到地图中心
   */
  function _fixClonedSkeletons(clonedScene) {
    const clonedBones = new Map()
    clonedScene.traverse(child => {
      if (child.isBone) clonedBones.set(child.name, child)
    })
    clonedScene.traverse(child => {
      if (child.isSkinnedMesh) {
        const origSkel = child.skeleton
        const newBones = origSkel.bones.map(b => clonedBones.get(b.name) || b)
        const newInverses = origSkel.boneInverses.map(m => m.clone())
        const newSkeleton = new THREE.Skeleton(newBones, newInverses)
        child.bind(newSkeleton, child.bindMatrix.clone())
      }
    })
  }

  function _playAnimation(entry, animKey) {
    if (entry.currentAnim === animKey) return
    const from = entry.actions?.[entry.currentAnim]
    const to = entry.actions?.[animKey]
    crossFade(from, to, 0.3)
    entry.currentAnim = animKey
  }

  function _updateAutoAnimation(entry) {
    if (!entry.prevLngLat) {
      entry.prevLngLat = entry.lngLat
      return
    }

    const dist = haversineDistance(entry.prevLngLat, entry.lngLat)
    entry.prevLngLat = entry.lngLat

    let targetAnim = dist > movementThreshold ? 'walk' : 'idle'

    if (targetAnim === 'idle' && entry.prevHeading !== null && Math.abs(entry.heading - entry.prevHeading) > 5) {
      targetAnim = 'walk'
    }
    entry.prevHeading = entry.heading

    _playAnimation(entry, targetAnim)

    if (dist > movementThreshold) {
      entry.lastMoveTime = performance.now()
    }
  }

  function _updateRobotTransform(entry) {
    if (!entry.group || !originMC) return
    const pos = _lngLatToLocalPos(entry.lngLat)
    entry.group.position.set(pos.x, pos.y, pos.z)
    const headingRad = (-entry.heading + headingOffset3D) * Math.PI / 180
    entry.group.rotation.set(0, 0, headingRad)
  }

  function addRobot({ id, lngLat, heading = 0 }) {
    if (entries.has(id)) return
    const entry = {
      lngLat, heading,
      group: null, modelNode: null, mixer: null, actions: {},
      currentAnim: null,
      prevLngLat: null,
      prevHeading: null,
      lastMoveTime: null,
      animState: 'auto',
    }
    entries.set(id, entry)
    if (modelTemplateScene) _instantiate(id, entry, map)
  }

  function updateRobot(id, patch) {
    const entry = entries.get(id)
    if (!entry) return

    const hasLngLat = patch.lngLat != null
    const hasHeading = patch.heading != null

    if (hasLngLat) entry.lngLat = patch.lngLat
    if (hasHeading) entry.heading = patch.heading

    if (entry.group) {
      if (hasLngLat || hasHeading) _updateRobotTransform(entry)
    }

    if (hasLngLat && entry.animState === 'auto') {
      _updateAutoAnimation(entry)
    }
  }

  function setAnimation(id, animKey) {
    const entry = entries.get(id)
    if (!entry) return
    entry.animState = 'manual'
    _playAnimation(entry, animKey)
  }

  function removeRobot(id) {
    const entry = entries.get(id)
    if (!entry) return
    if (entry.group) {
      if (entry.mixer) entry.mixer.stopAllAction()
      scene?.remove(entry.group)
      entry.group = null
    }
    entries.delete(id)
  }

  function destroy() {
    for (const id of entries.keys()) removeRobot(id)
    if (map.getLayer(layerId)) map.removeLayer(layerId)
    renderer = null
    scene = null
  }

  return { addRobot, updateRobot, setAnimation, removeRobot, destroy }
}

// ── addStatusRobotMarkers 同构适配层 ─────────────────────────────────────────

/**
 * 将 createRobot3DLayer 包装为与 addStatusRobotMarkers 完全相同的接口。
 *
 * 字段映射：
 *   robot.rotation  → heading（3D 层使用 heading，2D 层使用 rotation）
 *   robot.status    → setAnimation('walk' | 'idle')
 *   robot.name / battery / task 在 3D 层中静默忽略
 *
 * @param {Object} map         - 地图实例
 * @param {Object} modelConfig - 模型配置（同 createRobot3DLayer）
 * @param {Object} options     - 其余选项（同 createRobot3DLayer）
 * @returns {{ addRobot, updateRobot, updateRobots, removeRobot,
 *             clearRobots, getRobots, toggleLabels, remove }}
 */
export function createRobot3DStatusLayer(map, modelConfig, options = {}) {
  const layer = createRobot3DLayer(map, modelConfig, options)
  let _robots = []

  function _toLayerArgs(robot) {
    return {
      id: robot.id,
      lngLat: robot.lngLat,
      heading: robot.rotation ?? robot.heading ?? 0,
    }
  }

  // 仅保留 3D 层能消费的字段，丢弃 name/status/battery/task
  function _toPatch(patch) {
    const p = {}
    if (patch.lngLat != null) p.lngLat = patch.lngLat
    if (patch.rotation != null) p.heading = patch.rotation
    if (patch.heading != null) p.heading = patch.heading
    return p
  }

  function _applyStatus(id, status) {
    if (!status) return
    layer.setAnimation(id, status === 'running' ? 'walk' : 'idle')
  }

  function _findIdx(identifier) {
    return typeof identifier === 'number'
      ? identifier
      : _robots.findIndex(r => r.id === identifier)
  }

  const addRobot = (robot) => {
    _robots.push(robot)
    layer.addRobot(_toLayerArgs(robot))
    _applyStatus(robot.id, robot.status)
    return _robots.length - 1
  }

  const updateRobot = (identifier, patch) => {
    const idx = _findIdx(identifier)
    if (idx < 0 || idx >= _robots.length) return false
    _robots[idx] = { ..._robots[idx], ...patch }
    const p = _toPatch(patch)
    if (Object.keys(p).length > 0) layer.updateRobot(_robots[idx].id, p)
    if (patch.status != null) _applyStatus(_robots[idx].id, patch.status)
    return true
  }

  const updateRobots = (newRobots = []) => {
    for (const r of _robots) layer.removeRobot(r.id)
    _robots = [...newRobots]
    for (const r of _robots) {
      layer.addRobot(_toLayerArgs(r))
      _applyStatus(r.id, r.status)
    }
  }

  const removeRobot = (identifier) => {
    const idx = _findIdx(identifier)
    if (idx < 0 || idx >= _robots.length) return false
    layer.removeRobot(_robots[idx].id)
    _robots.splice(idx, 1)
    return true
  }

  const clearRobots = () => {
    for (const r of _robots) layer.removeRobot(r.id)
    _robots = []
  }

  const getRobots = () => [..._robots]

  // 3D 层无 HTML 标签，保持接口签名但不做任何操作
  const toggleLabels = () => {}

  const remove = () => layer.destroy()

  return { addRobot, updateRobot, updateRobots, removeRobot, clearRobots, getRobots, toggleLabels, remove }
}
