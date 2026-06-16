/*
 * @Author: houser.hao@humanoid.com
 * @Date: 2026-05-21
 * @LastEditTime: 2026-05-28 10:48:21
 * @LastEditors: kai.lee@x-humanoid.com
 * @Description: 语义区域样式预设 - 为酒店/仓库等场景提供禁行/限速/服务范围等标准化区域样式
 * @FilePath: /bic-map-plugin/src/examples/utils/experiment/map/semanticZones.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

/**
 * 语义区域类型枚举
 * @enum {string}
 */
export const ZONE_TYPE = {
  FORBIDDEN:     'forbidden',      // 禁行区
  SPEED_LIMIT:   'speed_limit',    // 限速区
  SERVICE_AREA:  'service_area',   // 服务范围
  CHARGING:      'charging',       // 充电区
  ELEVATOR:      'elevator',       // 电梯区域
  WAITING:       'waiting',        // 等候区
  ACTIVITY_AREA: 'activity_area',  // 活动区域（机器人活动范围，不可超出）
};

/**
 * 各语义区域类型的默认样式配置
 * 每项均可被 createSemanticZones 的 per-polygon options 覆盖
 */
export const ZONE_STYLE_PRESETS = {
  [ZONE_TYPE.FORBIDDEN]: {
    fillColor:    '#E53935',   // Material Red 600 — ISO 7010 禁止标准色
    fillOpacity:  0.18,
    outlineColor: '#E53935',
    outlineWidth: 2,
    outlineDash:  [4, 3],
    label:        '禁行区'
  },
  [ZONE_TYPE.SPEED_LIMIT]: {
    fillColor:    '#FB8C00',   // Material Amber 600 — 警告标准色
    fillOpacity:  0.15,
    outlineColor: '#FB8C00',
    outlineWidth: 2,
    outlineDash:  [6, 3],
    label:        '限速区'
  },
  [ZONE_TYPE.SERVICE_AREA]: {
    fillColor:    '#00897B',   // Material Teal 600 — 服务/通行区标准色
    fillOpacity:  0.12,
    outlineColor: '#00897B',
    outlineWidth: 1.5,
    outlineDash:  null,
    label:        '服务范围'
  },
  [ZONE_TYPE.CHARGING]: {
    fillColor:    '#43A047',   // Material Green 600 — 充电/安全区标准色
    fillOpacity:  0.2,
    outlineColor: '#43A047',
    outlineWidth: 2,
    outlineDash:  null,
    label:        '充电区'
  },
  [ZONE_TYPE.ELEVATOR]: {
    fillColor:    '#1E88E5',   // Material Blue 600 — 电梯/垂直交通标准色
    fillOpacity:  0.15,
    outlineColor: '#1E88E5',
    outlineWidth: 2,
    outlineDash:  [3, 3],
    label:        '电梯区'
  },
  [ZONE_TYPE.WAITING]: {
    fillColor:    '#78909C',   // Material Blue Grey 400 — 等候/停靠区
    fillOpacity:  0.12,
    outlineColor: '#78909C',
    outlineWidth: 1.5,
    outlineDash:  [5, 3],
    label:        '等候区'
  },
  [ZONE_TYPE.ACTIVITY_AREA]: {
    fillColor:    '#FFFFFF',
    fillOpacity:  0.15,
    outlineColor: '#43A047',   // Material Green 600
    outlineWidth: 2,
    outlineDash:  [8, 4],
    label:        '活动区域'
  }
};

/**
 * 创建语义区域集合
 *
 * 在已有的 `createPolygons` API 基础上封装，自动应用各区域类型的标准样式预设，
 * 并支持区域中心标注文字（MapLibre symbol 层）。
 *
 * @param {Object} map      - 地图实例
 * @param {Array}  zones    - 区域数组
 * @param {string}   zones[].type    - 区域类型，见 ZONE_TYPE 枚举
 * @param {Array}    zones[].points  - 多边形顶点 [[lng,lat], ...]
 * @param {string}   [zones[].id]    - 可选唯一 ID
 * @param {string}   [zones[].name]  - 可选区域名称（覆盖预设 label）
 * @param {number}   [zones[].speedLimit] - 限速区专用：速度值（km/h）
 * @param {Object}   [zones[].style] - 可选样式覆盖
 * @param {Object}  options - 全局选项
 * @param {boolean}  [options.showLabels=true]     - 是否显示区域中心文字标注
 * @param {number}   [options.labelFontSize=12]    - 标注字体大小
 * @param {string}   [options.labelColor='#ffffff'] - 标注文字颜色
 * @param {Function} [options.onClick]             - 区域点击回调 (zoneInfo) => void
 * @returns {Object} 语义区域控制器（addZone / removeZone / show / hide / remove / getZones）
 */
export function createSemanticZones(map, zones = [], options = {}) {
  if (!map) {
    throw new Error('地图未初始化。');
  }

  const {
    showLabels  = true,
    labelFontSize = 12,
    labelColor  = '#37474F',
    onClick     = null
  } = options;

  const FILL_SOURCE_ID    = 'bic-semantic-zones-fill-source';
  const FILL_LAYER_ID     = 'bic-semantic-zones-fill-layer';
  const OUTLINE_SOURCE_ID = 'bic-semantic-zones-outline-source';
  const OUTLINE_LAYER_ID  = 'bic-semantic-zones-outline-layer';

  let zoneList = [...zones];

  // 计算多边形重心（用于标注定位）
  const centroid = (pts) => {
    const n  = pts.length;
    const sx = pts.reduce((a, p) => a + p[0], 0) / n;
    const sy = pts.reduce((a, p) => a + p[1], 0) / n;
    return [sx, sy];
  };

  const buildFillGeoJSON = () => ({
    type: 'FeatureCollection',
    features: zoneList.map((zone, i) => {
      const preset = ZONE_STYLE_PRESETS[zone.type] ?? ZONE_STYLE_PRESETS[ZONE_TYPE.SERVICE_AREA];
      const style  = { ...preset, ...(zone.style ?? {}) };
      const ring   = [...zone.points];
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0]);
      }
      return {
        type: 'Feature',
        id: zone.id ?? `zone-${i}`,
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: {
          id:          zone.id ?? `zone-${i}`,
          type:        zone.type,
          fillColor:   style.fillColor,
          fillOpacity: style.fillOpacity,
          outlineColor: style.outlineColor,
          outlineWidth: style.outlineWidth
        }
      };
    })
  });

  const buildOutlineGeoJSON = () => ({
    type: 'FeatureCollection',
    features: zoneList.map((zone, i) => {
      const preset = ZONE_STYLE_PRESETS[zone.type] ?? ZONE_STYLE_PRESETS[ZONE_TYPE.SERVICE_AREA];
      const style  = { ...preset, ...(zone.style ?? {}) };
      const ring   = [...zone.points];
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0]);
      }
      return {
        type: 'Feature',
        id: `outline-${zone.id ?? i}`,
        geometry: { type: 'LineString', coordinates: ring },
        properties: {
          type:         zone.type,
          outlineColor: style.outlineColor,
          outlineWidth: style.outlineWidth,
          outlineDash:  style.outlineDash ? style.outlineDash.join(',') : ''
        }
      };
    })
  });

  // DOM label markers（替代 symbol 图层，避免依赖本地 glyph pbf 文件）
  let labelMarkerEls = [];

  const buildLabelMarkers = () => {
    const MapLibre = window.maplibregl;
    if (!MapLibre || !showLabels) return;

    labelMarkerEls.forEach(m => m.remove());
    labelMarkerEls = [];

    zoneList.forEach((zone) => {
      const preset  = ZONE_STYLE_PRESETS[zone.type] ?? ZONE_STYLE_PRESETS[ZONE_TYPE.SERVICE_AREA];
      const label   = zone.name ?? preset.label;
      const display = zone.type === ZONE_TYPE.SPEED_LIMIT && zone.speedLimit
        ? `${label} ${zone.speedLimit}km/h`
        : label;

      const el = document.createElement('div');
      el.textContent  = display;
      el.style.cssText = [
        `color:${labelColor}`,
        `font-size:${labelFontSize}px`,
        'font-weight:600',
        'font-family:system-ui,PingFang SC,Microsoft YaHei,sans-serif',
        'text-shadow:0 1px 3px rgba(0,0,0,0.6)',
        'white-space:nowrap',
        'pointer-events:none',
        'user-select:none',
        'letter-spacing:0.03em',
      ].join(';');

      const lngLat = centroid(zone.points);
      const marker = new MapLibre.Marker({ element: el, anchor: 'center' })
        .setLngLat(lngLat)
        .addTo(map);
      labelMarkerEls.push(marker);
    });
  };

  const clearLabelMarkers = () => {
    labelMarkerEls.forEach(m => m.remove());
    labelMarkerEls = [];
  };

  const ensureLayers = () => {
    // Fill layer
    if (!map.getSource(FILL_SOURCE_ID)) {
      map.addSource(FILL_SOURCE_ID, { type: 'geojson', data: buildFillGeoJSON() });
      map.addLayer({
        id:     FILL_LAYER_ID,
        type:   'fill',
        source: FILL_SOURCE_ID,
        paint: {
          'fill-color':   ['get', 'fillColor'],
          'fill-opacity': [
            'case',
            ['==', ['get', 'type'], 'speed_limit'],
            0,
            ['get', 'fillOpacity']
          ]
        }
      });
    }

    // Outline layer
    if (!map.getSource(OUTLINE_SOURCE_ID)) {
      map.addSource(OUTLINE_SOURCE_ID, { type: 'geojson', data: buildOutlineGeoJSON() });
      map.addLayer({
        id:     OUTLINE_LAYER_ID,
        type:   'line',
        source: OUTLINE_SOURCE_ID,
        paint: {
          'line-color': ['get', 'outlineColor'],
          'line-width': [
            'case',
            ['==', ['get', 'type'], 'speed_limit'],
            0,
            ['get', 'outlineWidth']
          ],
          'line-dasharray': [3, 2]
        }
      });
    }

    // DOM label markers（不使用 symbol 图层，避免触发 glyph pbf 加载）
    buildLabelMarkers();

    // Click handler
    if (onClick) {
      map.on('click', FILL_LAYER_ID, (e) => {
        e.originalEvent.stopPropagation();
        const feat = map.queryRenderedFeatures(e.point, { layers: [FILL_LAYER_ID] })[0];
        if (!feat) return;
        const zone = zoneList.find(z => String(z.id) === String(feat.properties.id) ||
          zoneList.indexOf(z) === Number(String(feat.id).replace('zone-', '')));
        onClick({ feature: feat, zone, lngLat: e.lngLat });
      });
      map.on('mouseenter', FILL_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', FILL_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });
    }
  };

  const syncSources = () => {
    if (map.getSource(FILL_SOURCE_ID))    map.getSource(FILL_SOURCE_ID).setData(buildFillGeoJSON());
    if (map.getSource(OUTLINE_SOURCE_ID)) map.getSource(OUTLINE_SOURCE_ID).setData(buildOutlineGeoJSON());
    buildLabelMarkers();
  };

  ensureLayers();

  /**
   * 新增单个语义区域
   * @param {Object} zone
   */
  const addZone = (zone) => {
    zoneList.push(zone);
    syncSources();
  };

  /**
   * 按 id 删除区域
   * @param {string} id
   */
  const removeZone = (id) => {
    zoneList = zoneList.filter(z => z.id !== id);
    syncSources();
  };

  /** 整体替换区域数据 */
  const update = (newZones = []) => {
    zoneList = [...newZones];
    syncSources();
  };

  const show = () => {
    [FILL_LAYER_ID, OUTLINE_LAYER_ID].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
    });
    labelMarkerEls.forEach(m => {
      const el = m.getElement();
      if (el) el.style.display = '';
    });
  };

  const hide = () => {
    [FILL_LAYER_ID, OUTLINE_LAYER_ID].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    });
    labelMarkerEls.forEach(m => {
      const el = m.getElement();
      if (el) el.style.display = 'none';
    });
  };

  /** 获取所有区域数据（只读副本） */
  const getZones = () => [...zoneList];

  const remove = () => {
    [FILL_LAYER_ID, OUTLINE_LAYER_ID].forEach(id => {
      if (map.getLayer(id)) {
        map.off('click', id);
        map.off('mouseenter', id);
        map.off('mouseleave', id);
        map.removeLayer(id);
      }
    });
    [FILL_SOURCE_ID, OUTLINE_SOURCE_ID].forEach(id => {
      if (map.getSource(id)) map.removeSource(id);
    });
    clearLabelMarkers();
    zoneList = [];
  };

  return { addZone, removeZone, update, show, hide, getZones, remove };
}
