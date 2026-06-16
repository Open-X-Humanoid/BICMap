/*
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-29
 * @Description: 地图图层配置
 */

// 图层ID常量
export const LAYER_IDS = {
    CANVAS_MAP: 'canvas-map-layer',
    RECTANGLE: 'rectangle-layer',
    RECTANGLE_OUTLINE: 'rectangle-outline-layer',
    POLYGON: 'polygon-layer',
    POLYGON_OUTLINE: 'polygon-outline-layer',
    BATCH_POI: 'batch-poi-layer',
    ROBOT_MARKERS: 'robot-markers-layer',
    RECTANGLE_DRAW_FILL: 'rectangle-draw-fill-layer',
    RECTANGLE_DRAW_LINE: 'rectangle-draw-line-layer',
    CIRCLE_DRAW_FILL: 'circle-draw-fill-layer',
    CIRCLE_DRAW_LINE: 'circle-draw-line-layer',
    POLYGON_DRAW_FILL: 'polygon-draw-fill-layer',
    POLYGON_DRAW_LINE: 'polygon-draw-line-layer',
    POLYGON_DRAW_POINTS: 'polygon-draw-points-layer',
    POLYLINE_DRAW_FILL: 'polyline-draw-fill-layer',
    POLYLINE_DRAW_LINE: 'polyline-draw-line-layer',
    POLYLINE_DRAW_POINTS: 'polyline-draw-points-layer',
    POINT_CLOUD: 'point-cloud-layer'
  };
  
  // 图层顺序配置（从下到上）
  export const LAYER_ORDER = {
    CANVAS_MAP: 0,
    RECTANGLE: 1,
    RECTANGLE_OUTLINE: 2,
    POLYGON: 3,
    POLYGON_OUTLINE: 4,
    BATCH_POI: 5,
    ROBOT_MARKERS: 6,
    RECTANGLE_DRAW_FILL: 7,
    RECTANGLE_DRAW_LINE: 8,
    CIRCLE_DRAW_FILL: 8.5,
    CIRCLE_DRAW_LINE: 8.6,
    POLYGON_DRAW_FILL: 9,
    POLYGON_DRAW_LINE: 10,
    POLYGON_DRAW_POINTS: 11,
    POLYLINE_DRAW_FILL: 12,
    POLYLINE_DRAW_LINE: 13,
    POLYLINE_DRAW_POINTS: 14,
    POINT_CLOUD: 15
  };
  
  // 图层顺序数组（用于排序）
  export const LAYER_ORDER_ARRAY = [
    LAYER_IDS.CANVAS_MAP,
    LAYER_IDS.RECTANGLE,
    LAYER_IDS.RECTANGLE_OUTLINE,
    LAYER_IDS.POLYGON,
    LAYER_IDS.POLYGON_OUTLINE,
    LAYER_IDS.BATCH_POI,
    LAYER_IDS.ROBOT_MARKERS,
    LAYER_IDS.RECTANGLE_DRAW_FILL,
    LAYER_IDS.RECTANGLE_DRAW_LINE,
    LAYER_IDS.CIRCLE_DRAW_FILL,
    LAYER_IDS.CIRCLE_DRAW_LINE,
    LAYER_IDS.POLYGON_DRAW_FILL,
    LAYER_IDS.POLYGON_DRAW_LINE,
    LAYER_IDS.POLYGON_DRAW_POINTS,
    LAYER_IDS.POLYLINE_DRAW_FILL,
    LAYER_IDS.POLYLINE_DRAW_LINE,
    LAYER_IDS.POLYLINE_DRAW_POINTS,
    LAYER_IDS.POINT_CLOUD
  ];
  
  /**
   * 添加图层并确保正确的层级顺序
   * @param {Object} map - Mapbox GL JS地图实例
   * @param {Object} layerConfig - 图层配置对象
   * @param {string} layerConfig.id - 图层ID
   * @param {string} layerConfig.type - 图层类型
   * @param {Object} layerConfig.source - 图层数据源
   * @param {Object} layerConfig.paint - 图层绘制样式
   * @param {Object} layerConfig.layout - 图层布局样式
   * @returns {string} 图层ID
   */
  export function addLayerWithOrder(map, layerConfig) {
    if (!map || !layerConfig || !layerConfig.id) {
      throw new Error('Invalid map or layer configuration');
    }
  
    // 获取当前图层顺序
    const currentLayers = map.getStyle().layers || [];
    
    // 找到当前图层ID在顺序数组中的位置
    const layerIndex = LAYER_ORDER_ARRAY.indexOf(layerConfig.id);
    
    if (layerIndex === -1) {
      console.warn(`Layer ID ${layerConfig.id} not found in layer order configuration`);
      return map.addLayer(layerConfig);
    }
  
    // 找到应该插入的位置
    let insertBefore = null;
    for (let i = layerIndex + 1; i < LAYER_ORDER_ARRAY.length; i++) {
      const nextLayerId = LAYER_ORDER_ARRAY[i];
      const existingLayer = currentLayers.find(layer => layer.id === nextLayerId);
      if (existingLayer) {
        insertBefore = nextLayerId;
        break;
      }
    }
  
    // 添加图层
    return map.addLayer(layerConfig, insertBefore);
  }
  
  /**
   * 获取图层的顺序值
   * @param {string} layerId - 图层ID
   * @returns {number} 图层顺序值
   */
  export function getLayerOrder(layerId) {
    return LAYER_ORDER[layerId] !== undefined ? LAYER_ORDER[layerId] : 999;
  }
  
  /**
   * 确保图层按照正确的顺序排列
   * @param {Object} map - Mapbox GL JS地图实例
   */
  export function ensureLayerOrder(map) {
    if (!map) return;
  
    const currentLayers = map.getStyle().layers || [];
    
    // 按照配置的顺序对图层进行排序
    currentLayers.sort((a, b) => {
      const orderA = getLayerOrder(a.id);
      const orderB = getLayerOrder(b.id);
      return orderA - orderB;
    });
  
    // 重新添加图层以应用新的顺序
    currentLayers.forEach(layer => {
      const layerConfig = { ...layer };
      delete layerConfig.id;
      map.removeLayer(layer.id);
      addLayerWithOrder(map, { ...layerConfig, id: layer.id });
    });
  }