/*
 * @Description: 笛卡尔坐标 <-> GPS 坐标转换工具
 *   从原 bicMap.min.js 内联的 MapUtils 迁移而来，行为与原全局 window.MapUtils 完全一致。
 *   - 默认原点为北京 (39.9042, 116.4074)
 *   - 默认比例尺 0.01 米/单位，可通过参数覆盖
 * @FilePath: /bic-map/src/bicMap/core/utils/mapUtils.js
 */

const EARTH_R = 6378137.0;
const MAX_DISTANCE = 5000;

const DEFAULT_ORIGIN_LATITUDE = 39.9042;
const DEFAULT_ORIGIN_LONGITUDE = 116.4074;
const DEFAULT_SCALE = 0.01;
const DEFAULT_BEARING = 0;
const DEFAULT_ZOOM_FACTOR = 1.0;

/**
 * 计算两点之间的距离（米），Haversine 公式
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} 距离（米）
 */
export const getDistance = (lat1, lon1, lat2, lon2) => {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_R * c;
};

/**
 * 验证距离是否在允许范围内，超出抛出错误
 * @param {number} originLat
 * @param {number} originLon
 * @param {number} targetLat
 * @param {number} targetLon
 * @throws {Error} 当距离超过最大允许距离时
 */
export const validateDistance = (originLat, originLon, targetLat, targetLon) => {
  const distance = getDistance(originLat, originLon, targetLat, targetLon);
  if (distance > MAX_DISTANCE) {
    throw new Error(`距离 ${distance}米 超过最大允许距离 ${MAX_DISTANCE}米`);
  }
};

/**
 * 计算地图四个角点的笛卡尔坐标
 * @param {Object} params
 * @param {number} params.startX
 * @param {number} params.startY
 * @param {number} params.xGridCount
 * @param {number} params.yGridCount
 * @param {number} params.resolution - 米/像素
 * @returns {{bottomLeft:Object, bottomRight:Object, topLeft:Object, topRight:Object}}
 */
export const getMapCorners = (params) => {
  const { startX, startY, xGridCount, yGridCount, resolution } = params;

  const bottomLeft = { x: startX, y: startY };
  const bottomRight = { x: startX + (xGridCount * resolution), y: startY };
  const topLeft = { x: startX, y: startY + (yGridCount * resolution) };
  const topRight = { x: startX + (xGridCount * resolution), y: startY + (yGridCount * resolution) };

  return { bottomLeft, bottomRight, topLeft, topRight };
};

/**
 * 将笛卡尔坐标转换为 GPS 坐标
 * @param {Object} params
 * @param {number} params.x
 * @param {number} params.y
 * @param {number} [params.originLatitude=39.9042]
 * @param {number} [params.originLongitude=116.4074]
 * @param {number} [params.scale=0.01] - 比例尺（米/单位）
 * @param {number} [params.bearing=0] - 坐标系旋转角度（弧度，相对正北顺时针为正）
 * @param {number} [params.zoomFactor=1.0]
 * @returns {{latitude:number, longitude:number}}
 */
export const cartesianToGPS = (params) => {
  const {
    x, y,
    originLatitude = DEFAULT_ORIGIN_LATITUDE,
    originLongitude = DEFAULT_ORIGIN_LONGITUDE,
    scale = DEFAULT_SCALE,
    bearing = DEFAULT_BEARING,
    zoomFactor = DEFAULT_ZOOM_FACTOR
  } = params;

  const adjustedScale = scale * zoomFactor;
  const distanceX = x * adjustedScale;
  const distanceY = y * adjustedScale;

  const deltaLat = (distanceY * Math.cos(bearing) - distanceX * Math.sin(bearing)) / EARTH_R;
  const deltaLon = (distanceX * Math.cos(bearing) + distanceY * Math.sin(bearing)) /
    (EARTH_R * Math.cos(originLatitude * Math.PI / 180));

  const latitude = originLatitude + (deltaLat * 180 / Math.PI);
  const longitude = originLongitude + (deltaLon * 180 / Math.PI);

  try {
    const distance = getDistance(originLatitude, originLongitude, latitude, longitude);
    if (distance > MAX_DISTANCE) {
      console.warn(`警告: 距离 ${distance.toFixed(2)}米 超过最大建议距离 ${MAX_DISTANCE}米`);
    }
  } catch (e) {
    console.warn('距离验证失败:', e);
  }

  return {
    latitude: Number(latitude.toFixed(12)),
    longitude: Number(longitude.toFixed(12))
  };
};

/**
 * 将 GPS 坐标转换为笛卡尔坐标
 * @param {Object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {number} [params.originLatitude=39.9042]
 * @param {number} [params.originLongitude=116.4074]
 * @param {number} [params.scale=0.01]
 * @param {number} [params.bearing=0]
 * @param {number} [params.zoomFactor=1.0]
 * @returns {{x:number, y:number}}
 */
export const GPSToCartesian = (params) => {
  const {
    latitude,
    longitude,
    originLatitude = DEFAULT_ORIGIN_LATITUDE,
    originLongitude = DEFAULT_ORIGIN_LONGITUDE,
    scale = DEFAULT_SCALE,
    bearing = DEFAULT_BEARING,
    zoomFactor = DEFAULT_ZOOM_FACTOR
  } = params;

  try {
    const distance = getDistance(originLatitude, originLongitude, latitude, longitude);
    if (distance > MAX_DISTANCE) {
      console.warn(`警告: 距离 ${distance.toFixed(2)}米 超过最大建议距离 ${MAX_DISTANCE}米`);
    }
  } catch (e) {
    console.warn('距离验证失败:', e);
  }

  const deltaLat = (latitude - originLatitude) * Math.PI / 180;
  const deltaLon = (longitude - originLongitude) * Math.PI / 180;

  const y = deltaLat * EARTH_R;
  const x = deltaLon * EARTH_R * Math.cos(originLatitude * Math.PI / 180);

  const adjustedScale = scale * zoomFactor;
  const rotatedX = (x * Math.cos(-bearing) - y * Math.sin(-bearing)) / adjustedScale;
  const rotatedY = (x * Math.sin(-bearing) + y * Math.cos(-bearing)) / adjustedScale;

  return {
    x: Number(rotatedX.toFixed(6)),
    y: Number(rotatedY.toFixed(6))
  };
};

/**
 * 与原 window.MapUtils 形态保持一致的聚合对象
 */
const MapUtils = {
  getDistance,
  validateDistance,
  getMapCorners,
  cartesianToGPS,
  GPSToCartesian
};

export default MapUtils;
