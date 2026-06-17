import { createGeoUtils } from '@/bicMap/core/navigation';

/**
 * 在地图上创建机器人 FOV（视野扇形）层
 *
 * 视觉效果：机器人朝向前方的半透明渐变扇形（内深外浅），
 * 由多个同心扇环叠加模拟径向渐变，避免 WebGL fill-gradient 兼容问题。
 * 圆锥顶点使用 SLAM 坐标计算，经 cartToGPS 统一转换到 GPS，
 * 确保 FOV 缩放与地图要素（房间/墙壁）的 zoomFactor 一致。
 *
 * @param {Object} map - 地图实例
 * @param {Object} options - 配置选项
 * @param {Object}  options.mapConfig              - 地图配置（必需）
 * @param {number}  options.mapConfig.startX       - 笛卡尔起点 X
 * @param {number}  options.mapConfig.startY       - 笛卡尔起点 Y
 * @param {number}  options.mapConfig.width        - 地图宽度（米）
 * @param {number}  options.mapConfig.height       - 地图高度（米）
 * @param {number}  options.mapConfig.scale        - 地图分辨率
 * @param {string}  [options.id='default']         - 实例 ID，允许同屏多个 FOV（如多机器人）
 * @param {boolean} [options.enabled=true]         - 是否启用
 * @param {number}  [options.angle=60]             - FOV 夹角（°），如 60 表示前方 ±30°
 * @param {number}  [options.radiusMeters=3]       - 视距（米）
 * @param {string}  [options.fillColor='#1677ff']  - 填充颜色
 * @param {number}  [options.innerOpacity=0.45]    - 最内圈透明度
 * @param {number}  [options.outerOpacity=0.02]    - 最外圈透明度
 * @param {number}  [options.bands=6]              - 径向分段数（越多越平滑）
 * @param {number}  [options.segments=20]          - 弧线采样点数
 * @returns {Object} FOV 控制器（update / show / hide / remove / setConfig）
 */
export function createRobotFOV(map, options = {}) {
  if (!map) {
    throw new Error('地图未初始化。');
  }

  const mapConfig = options.mapConfig;
  if (!mapConfig || typeof mapConfig !== 'object') {
    throw new Error('缺少 mapConfig 配置，请传入 { startX, startY, width, height, scale }');
  }
  const { startX, startY, width, height, scale } = mapConfig;
  const { cartToGPS } = createGeoUtils({ startX, startY, width, height, scale });

  const config = {
    id: 'default',
    enabled: true,
    angle: 60,
    radiusMeters: 3,
    fillColor: '#1677ff',
    innerOpacity: 0.45,
    outerOpacity: 0.02,
    bands: 6,
    segments: 20,
    ...options
  };

  const SOURCE_ID = `bic-fov-source-${config.id}`;
  const FILL_ID   = `bic-fov-fill-${config.id}`;

  let isVisible = config.enabled;

  // 构建多环带扇形 GeoJSON
  // 在 SLAM 坐标系（米）中计算顶点，再用 cartToGPS 统一转换到 GPS，
  // 避免单独使用硬编码米→度常量导致与地图 zoomFactor 不一致。
  const buildConeFeatures = (cartPos, heading) => {
    const h    = (heading + 360) % 360;
    const r    = config.radiusMeters;
    const half = config.angle / 2;
    const segs = config.segments;
    const N    = Math.max(2, config.bands);
    const features = [];

    for (let b = 0; b < N; b++) {
      const rInner = r * (b / N);
      const rOuter = r * ((b + 1) / N);
      // 带中点处的透明度，相邻带之间无硬边
      const t       = (b + 0.5) / N;
      const opacity = config.innerOpacity + (config.outerOpacity - config.innerOpacity) * t;
      const coords  = [];

      // 外弧（顺时针）
      for (let i = 0; i <= segs; i++) {
        const a   = h - half + (config.angle * i / segs);
        const rad = a * Math.PI / 180;
        const sx  = cartPos.x + rOuter * Math.sin(rad);
        const sy  = cartPos.y + rOuter * Math.cos(rad);
        const gps = cartToGPS(sx, sy);
        coords.push([gps[0], gps[1]]);
      }
      // 内弧（逆时针回去；b=0 时 rInner=0，退化为顶点）
      for (let i = segs; i >= 0; i--) {
        const a   = h - half + (config.angle * i / segs);
        const rad = a * Math.PI / 180;
        const sx  = cartPos.x + rInner * Math.sin(rad);
        const sy  = cartPos.y + rInner * Math.cos(rad);
        const gps = cartToGPS(sx, sy);
        coords.push([gps[0], gps[1]]);
      }
      coords.push(coords[0]); // 闭合

      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: { opacity }
      });
    }

    return { type: 'FeatureCollection', features };
  };

  // 初始化 source / layer
  const ensureLayers = () => {
    if (map.getSource(SOURCE_ID)) return;

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    // 插入在机器人图层下方（优先3D机器人层，回退2D标记层）
    const robot3DLayerId = config.beforeLayerId || 'robot-markers-layer'
    const beforeId = map.getLayer(robot3DLayerId) ? robot3DLayerId : undefined

    map.addLayer({
      id: FILL_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': config.fillColor,
        'fill-opacity': ['get', 'opacity'],
        'fill-antialias': true
      },
      layout: { visibility: isVisible ? 'visible' : 'none' }
    }, beforeId);
  };

  ensureLayers();

  /**
   * 更新 FOV 位置与朝向
   * @param {Object} cartPos - SLAM 笛卡尔坐标 { x, y }（米）
   * @param {number} heading - 朝向角（°，北=0，顺时针）
   */
  const update = (cartPos, heading) => {
    const src = map.getSource(SOURCE_ID);
    if (!src) return;
    src.setData(buildConeFeatures(cartPos, heading));
  };

  /** 显示 FOV */
  const show = () => {
    isVisible = true;
    if (map.getLayer(FILL_ID)) {
      map.setLayoutProperty(FILL_ID, 'visibility', 'visible');
    }
  };

  /** 隐藏 FOV */
  const hide = () => {
    isVisible = false;
    if (map.getLayer(FILL_ID)) {
      map.setLayoutProperty(FILL_ID, 'visibility', 'none');
    }
  };

  /**
   * 动态修改 FOV 参数（无需重建图层）
   * @param {Object} newConfig - 需覆盖的配置项
   */
  const setConfig = (newConfig = {}) => {
    Object.assign(config, newConfig);

    if (map.getLayer(FILL_ID) && newConfig.fillColor) {
      map.setPaintProperty(FILL_ID, 'fill-color', config.fillColor);
    }
  };

  /** 销毁 FOV 层与数据源 */
  const remove = () => {
    if (map.getLayer(FILL_ID))   map.removeLayer(FILL_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  };

  return { update, show, hide, setConfig, remove };
}
