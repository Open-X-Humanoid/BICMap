import { safeImageLoader } from '@/bicMap/core/utils/loaders.js';

/**
 * 创建多楼层地图管理器
 * @param {Object} map - 地图实例
 * @param {Object} options - 配置选项
 * @param {Array}  options.floors - 楼层配置数组
 * @param {string} options.floors[].id           - 楼层唯一标识，如 'F1'
 * @param {string} options.floors[].label        - 显示名称，如 '1F'
 * @param {string} options.floors[].slamImagePath - SLAM 图片路径
 * @param {Object} options.floors[].slamOptions  - SLAM 加载参数（startX/Y, xGridCount, yGridCount, resolution）
 * @param {string} [options.defaultFloor]        - 默认激活的楼层 ID
 * @param {Function} [options.onFloorChange]     - 楼层切换回调 (floorId, floorConfig) => void
 * @param {number}  [options.zoomFactor=2]       - 坐标转换缩放因子
 * @returns {Object} 楼层管理器控制器
 */
export function createFloorManager(map, options = {}) {
  if (!map) {
    throw new Error('地图未初始化。');
  }

  if (!window.MapUtils) {
    throw new Error('MapUtils 不可用，请确保已加载 bicMap 运行时。');
  }

  const {
    floors = [],
    defaultFloor = null,
    onFloorChange = null,
    zoomFactor = 2
  } = options;

  if (!floors.length) {
    throw new Error('floors 配置不能为空。');
  }

  // 当前激活楼层 ID
  let activeFloorId = null;

  // 每层的资源 ID 通过楼层 ID 隔离，避免多层同名 source/layer 冲突
  const getSourceId = (floorId) => `floor-slam-source-${floorId}`;
  const getLayerId  = (floorId) => `floor-slam-layer-${floorId}`;
  const getCanvasId = (floorId) => `floor-slam-canvas-${floorId}`;

  // 已加载楼层的 cameraBound 缓存
  const cameraBoundCache = new Map();

  // 每层楼绑定的附属 3D 图层 ID 列表（用于 fill-extrusion 等图层联动）
  const layers3DRegistry = new Map(); // floorId → string[]

  /**
   * 加载单层 SLAM 地图（若已加载则跳过图片重绘，仅切换可见性）
   * @param {Object} floorConfig
   * @returns {Promise<Object>} { cameraBound, coordinates }
   */
  const loadFloor = async (floorConfig) => {
    const { id, slamImagePath, slamOptions = {} } = floorConfig;
    const {
      startX = 0,
      startY = 0,
      xGridCount = 512,
      yGridCount = 512,
      resolution = 0.05,
      fitBounds = true,
      padding = { top: 30, bottom: 30, left: 30, right: 30 }
    } = slamOptions;

    const sourceId = getSourceId(id);
    const layerId  = getLayerId(id);
    const canvasId = getCanvasId(id);

    // 已存在时仅切换可见性
    if (map.getSource(sourceId)) {
      map.setLayoutProperty(layerId, 'visibility', 'visible');
      // 联动显示附属 3D 图层
      const extra = layers3DRegistry.get(id) ?? [];
      extra.forEach(eid => {
        if (map.getLayer(eid)) map.setLayoutProperty(eid, 'visibility', 'visible');
      });
      return {
        cameraBound: cameraBoundCache.get(id),
        coordinates: null
      };
    }

    // 计算 SLAM 四角坐标
    const corners = window.MapUtils.getMapCorners({ startX, startY, xGridCount, yGridCount, resolution });

    const toLonLat = (coords) => {
      const gps = window.MapUtils.cartesianToGPS({ x: coords[0], y: coords[1], scale: resolution, zoomFactor });
      return [gps.longitude, gps.latitude];
    };

    const topLeft     = toLonLat([corners.topLeft.x,     corners.topLeft.y]);
    const topRight    = toLonLat([corners.topRight.x,    corners.topRight.y]);
    const bottomRight = toLonLat([corners.bottomRight.x, corners.bottomRight.y]);
    const bottomLeft  = toLonLat([corners.bottomLeft.x,  corners.bottomLeft.y]);
    const coordinates = [topLeft, topRight, bottomRight, bottomLeft];

    // 准备 canvas
    let canvas = document.getElementById(canvasId);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = canvasId;
      canvas.style.display = 'none';
      document.body.appendChild(canvas);
    }

    canvas.width  = xGridCount;
    canvas.height = yGridCount;
    const ctx = canvas.getContext('2d');

    try {
      const img = await safeImageLoader(slamImagePath);
      ctx.drawImage(img, 0, 0, xGridCount, yGridCount);
    } catch (err) {
      console.warn(`[FloorManager] 楼层 ${id} 地图图片加载失败，使用占位图:`, err);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, xGridCount, yGridCount);
    }

    // 添加 source + layer
    map.addSource(sourceId, {
      type: 'canvas',
      canvas: canvasId,
      animate: true,
      coordinates
    });

    map.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      minzoom: 0,
      maxzoom: 24,
      layout: { visibility: 'visible' }
    });

    // 计算相机边界
    const cameraBound = map.cameraForBounds([bottomLeft, topRight], { padding });
    const cached = Object.assign({ pitch: 0, bearing: 0 }, cameraBound);
    cameraBoundCache.set(id, cached);

    if (fitBounds) {
      map.jumpTo(cached);
    }

    return { cameraBound: cached, coordinates };
  };

  /**
   * 隐藏某层 SLAM（不销毁 source，保留缓存以快速切回）
   * @param {string} floorId
   */
  const hideFloor = (floorId) => {
    const layerId = getLayerId(floorId);
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'none');
    }
    // 联动隐藏附属 3D 图层
    const extra = layers3DRegistry.get(floorId) ?? [];
    extra.forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    });
  };

  /**
   * 切换到指定楼层
   * @param {string} floorId - 目标楼层 ID
   * @returns {Promise<void>}
   */
  const switchTo = async (floorId) => {
    const floorConfig = floors.find(f => f.id === floorId);
    if (!floorConfig) {
      console.warn(`[FloorManager] 未找到楼层 ${floorId}`);
      return;
    }

    if (activeFloorId === floorId) return;

    // 隐藏当前层
    if (activeFloorId) {
      hideFloor(activeFloorId);
    }

    // 加载并显示新层
    await loadFloor(floorConfig);
    activeFloorId = floorId;

    onFloorChange?.(floorId, floorConfig);
  };

  /**
   * 获取当前激活楼层信息
   * @returns {{ id: string, config: Object } | null}
   */
  const getActiveFloor = () => {
    if (!activeFloorId) return null;
    return {
      id: activeFloorId,
      config: floors.find(f => f.id === activeFloorId) ?? null
    };
  };

  /**
   * 获取所有楼层配置列表（用于渲染楼层选择器 UI）
   * @returns {Array}
   */
  const getFloors = () => floors.map(f => ({
    id: f.id,
    label: f.label,
    active: f.id === activeFloorId
  }));

  /**
   * 销毁全部楼层资源（layer + source + canvas）
   */
  const remove = () => {
    floors.forEach(({ id }) => {
      const layerId  = getLayerId(id);
      const sourceId = getSourceId(id);
      const canvasId = getCanvasId(id);

      if (map.getLayer(layerId))   map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      const canvas = document.getElementById(canvasId);
      if (canvas) canvas.remove();
    });

    cameraBoundCache.clear();
    layers3DRegistry.clear();
    activeFloorId = null;
  };

  // 初始化默认楼层
  const initialFloorId = defaultFloor ?? floors[0]?.id;
  if (initialFloorId) {
    switchTo(initialFloorId);
  }

  /**
   * 为指定楼层绑定附属 3D 图层（fill-extrusion 等）
   * 切换楼层时自动随 SLAM 层联动显示/隐藏
   * @param {string}   floorId  - 楼层 ID，须已在 floors 配置中存在
   * @param {string[]} layerIds - 需要联动的 MapLibre 图层 ID 数组
   */
  const bindLayers3D = (floorId, layerIds = []) => {
    layers3DRegistry.set(floorId, layerIds);
  };

  return {
    switchTo,
    getActiveFloor,
    getFloors,
    hideFloor,
    bindLayers3D,
    remove
  };
}
