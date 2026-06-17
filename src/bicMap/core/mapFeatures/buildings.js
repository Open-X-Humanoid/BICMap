import { createLayerEvents } from '@/bicMap/core/mapFeatures/layerEvents.js'

const SOURCE_PREFIX = "bic-buildings-source-";
const LAYER_PREFIX = "bic-buildings-layer-";
const OUTLINE_PREFIX = "bic-buildings-outline-";

const DEFAULT_CONFIG = {
  defaultHeight: 20,
  defaultColor: "#90caf9",
  opacity: 0.85,
  heightScale: 1,
  showOutline: false,
  outlineColor: "#42a5f5",
  visible: true,
};

let instanceCounter = 0;

/**
 * 创建建筑物 3D 渲染控制器
 * @param {Object} map - MapLibre 地图实例
 * @param {Object} geojson - GeoJSON FeatureCollection，Feature 属性字段：
 *   - height {number}       建筑总高度（米）
 *   - base_height {number}  底部高度（米），默认 0
 *   - color {string}        建筑颜色（hex/rgb），可选
 *   - name {string}         建筑名称，可选
 * @param {Object} options - 渲染配置选项
 * @param {number}  [options.defaultHeight=20]       未指定高度时的默认高度（米）
 * @param {string}  [options.defaultColor='#90caf9'] 未指定颜色时的默认填充色
 * @param {number}  [options.opacity=0.85]           建筑不透明度 0~1
 * @param {number}  [options.heightScale=1]          高度缩放倍数
 * @param {boolean} [options.showOutline=true]       是否显示建筑轮廓线
 * @param {string}  [options.outlineColor='#42a5f5'] 轮廓线颜色
 * @returns {{
 *   show: Function,
 *   hide: Function,
 *   remove: Function,
 *   update: Function,
 *   setHeightScale: Function,
 *   setOpacity: Function,
 *   on: Function,
 *   off: Function,
 *   once: Function,
 *   onFeature: Function,
 *   offFeature: Function,
 * }} 建筑物控制器
 */
export function createBuildings(map, geojson, options = {}) {
  const id = ++instanceCounter;
  const sourceId = SOURCE_PREFIX + id;
  const layerId = LAYER_PREFIX + id;
  const outlineId = OUTLINE_PREFIX + id;

  const config = Object.assign({}, DEFAULT_CONFIG, options);

  /**
   * 初始化建筑图层（立即执行）
   */
  const _init = () => {
    /**
     * 构建 fill-extrusion 图层的 paint 属性配置
     * 使用 MapLibre 表达式语法，支持从 GeoJSON 属性动态取值
     * @param {number} scale - 高度缩放倍数
     * @param {number} op - 不透明度 (0~1)
     * @returns {Object} fill-extrusion paint 配置对象
     */
    const buildExtrusionPaint = (scale, op) => ({
      "fill-extrusion-color": [
        "coalesce",
        ["get", "color"],
        config.defaultColor,
      ],
      "fill-extrusion-height": [
        "*",
        ["coalesce", ["get", "height"], config.defaultHeight],
        scale,
      ],
      "fill-extrusion-base": ["coalesce", ["get", "base_height"], 0],
      "fill-extrusion-opacity": op,
    });
    map.addSource(sourceId, {
      type: "geojson",
      data: geojson,
    });

    map.addLayer({
      id: layerId,
      type: "fill-extrusion",
      source: sourceId,
      paint: buildExtrusionPaint(config.heightScale, config.opacity),
    });

    if (config.showOutline) {
      map.addLayer({
        id: outlineId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": config.outlineColor,
          "line-width": 0.8,
          "line-opacity": 0.6,
        },
      });
    }
  };

  _init();
  const events = createLayerEvents(map, layerId);

  /**
   * 显示建筑图层
   */
  function show() {
    if (config.visible) return;
    map.setLayoutProperty(layerId, "visibility", "visible");
    if (config.showOutline && map.getLayer(outlineId)) {
      map.setLayoutProperty(outlineId, "visibility", "visible");
    }
    config.visible = true;
    return this;
  };

  /**
   * 隐藏建筑图层
   */
  function hide() {
    if (!config.visible) return;
    map.setLayoutProperty(layerId, "visibility", "none");
    if (config.showOutline && map.getLayer(outlineId)) {
      map.setLayoutProperty(outlineId, "visibility", "none");
    }
    config.visible = false;
    return this;
  };

  /**
   * 更新建筑数据和/或渲染选项
   * @param {Object} newGeojson - 新的 GeoJSON FeatureCollection
   * @param {Object} [newOptions] - 新的渲染选项（合并到现有配置）
   */
  function update(newGeojson, newOptions = {}) {
    if (newGeojson) {
      map.getSource(sourceId).setData(newGeojson);
    }
    Object.assign(config, newOptions);
    map.setPaintProperty(layerId, "fill-extrusion-color", [
      "coalesce",
      ["get", "color"],
      config.defaultColor,
    ]);
    map.setPaintProperty(layerId, "fill-extrusion-height", [
      "*",
      ["coalesce", ["get", "height"], config.defaultHeight],
      config.heightScale,
    ]);
    map.setPaintProperty(layerId, "fill-extrusion-opacity", config.opacity);
    if (config.showOutline && map.getLayer(outlineId)) {
      map.setPaintProperty(outlineId, "line-color", config.outlineColor);
    }
    return this;
  };

  /**
   * 调整高度缩放倍数
   * @param {number} scale - 缩放倍数
   */
  function setHeightScale(scale) {
    config.heightScale = scale;
    map.setPaintProperty(layerId, "fill-extrusion-height", [
      "*",
      ["coalesce", ["get", "height"], config.defaultHeight],
      config.heightScale,
    ]);
    return this;
  };

  /**
   * 调整建筑透明度
   * @param {number} op - 透明度 0~1
   */
  function setOpacity(op) {
    config.opacity = op;
    map.setPaintProperty(layerId, "fill-extrusion-opacity", config.opacity);
    return this;
  }

  /**
   * 移除建筑图层及数据源，同时清理所有事件监听（不可恢复）
   */
  function remove() {
    events.destroy();
    if (map.getLayer(outlineId)) map.removeLayer(outlineId);
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    return this;
  };

  return {
    show, hide, remove, update, setHeightScale, setOpacity,
    on:         events.on,
    off:        events.off,
    once:       events.once,
    onFeature:  events.onFeature,
    offFeature: events.offFeature,
  };
}
