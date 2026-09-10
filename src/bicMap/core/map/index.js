/**
 * 创建新地图实例
 * @param {Object} maplibregl - maplibregl实例
 * @param {Object} options - 地图选项
 * @returns {Object} 地图实例
 */
export function createMap(maplibregl, options) {
  if (!maplibregl) {
    throw new Error('maplibregl未初始化。');
  }

  const {
    container,
    center = [0, 0],
    zoom = 0.1,
    pitch = 0,
    bearing = 0,
    maxPitch = 60,
    antialias = false,
    backgroundColor = '#808080',
    style: userStyle,
    ...mapOptions
  } = options;

  if (!container) {
    throw new Error('缺少容器ID');
  }

  const blankStyle = {
    version: 8,
    name: 'BlankMap',
    glyphs: '/bicMap/glyphs/{fontstack}/{range}.pbf',
    sources: {},
    minzoom: 0,
    maxzoom: 24,
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': backgroundColor }
      }
    ]
  };

  return new maplibregl.Map({
    container,
    style: userStyle || blankStyle,
    center,
    zoom,
    pitch,
    bearing,
    maxPitch,
    antialias,
    maxZoom: 23.99,
    minZoom: 0,
    ...mapOptions
  });
} 