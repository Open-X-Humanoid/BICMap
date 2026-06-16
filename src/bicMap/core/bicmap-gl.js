// 导入第三方地图引擎依赖（替代原 bicMap.min.js 运行时动态加载）
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import * as THREE from 'three';
// MapLibre 基础样式：?inline 让 Vite 在构建时把 CSS 内联为字符串，运行时注入，
// 这样 npm / CDN 两种方式都无需消费方单独引入 CSS。
import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css?inline';

// 导入坐标转换工具（原 window.MapUtils）
import mapUtils from './utils/mapUtils.js';

// 导入工具函数
import { loadScript, loadCSS, loadResources } from './utils/loaders.js';

// 导入地图基础功能
import { createMap } from './map/index.js';

// 导入地图图层功能
import {
  loadSlamMap
} from './layers/index.js';

// 导入标记功能
import { 
  addDirectionalMarker,
  addBatchPOIMarkers 
} from './markers/index.js';

// 导入机器人标记功能
import { addRobotMarkers } from './markers/robo.js';

// 导入点云功能
import pointClouds from './pointClouds/index.js';

// 导入矩形显示功能
import rectangle from './rectangle/index.js';

// 导入多边形显示功能
import polygon from './polygon/index.js';

// 导入圆形显示功能（circle layer）
import { createCircles } from './circle/index.js';

// 导入折线功能
import { createPolylines } from './polyline/index.js';

// 导入宽线段功能
import { createWideLines } from './wideline/index.js';

// 导入控件功能
import {
  addZoomControl 
} from './controls/index.js';

// 导入绘制工具功能
import { enableRectangleDrawing, enablePolygonDrawing, enablePolylineDrawing, enableCircleRadiusDrawing } from './drawing/index.js';



// BicMap类封装maplibregl功能
class BicMap {
  constructor() {
    this.maplibregl = null;
    this.turf = null;
    this.THREE = null;
    this.mapUtils = null;
    this.isLoaded = false;
    // 添加资源路径配置
    this.resourcePaths = {
      assetsUrl: '/bicMap/assets',
      fontsUrl: '/bicMap/assets/ttf',
      cssUrl: '/bicMap/bicMap.css',
      jsUrl: '/bicMap/bicMap.min.js'
    };
  }

  /**
   * 初始化并加载所需库
   * @param {Object} options - 初始化选项
   * @param {string} [options.cssUrl='/bicMap/bicMap.css'] - CSS文件URL，支持相对路径、绝对路径和完整URL
   * @param {string} [options.jsUrl='/bicMap/bicMap.min.js'] - JS文件URL，支持相对路径、绝对路径和完整URL
   * @param {string} [options.assetsUrl='/bicMap/assets'] - 图片资源基础路径，支持相对路径、绝对路径和完整URL
   * @param {string} [options.fontsUrl='/bicMap/assets/ttf'] - 字体文件基础路径，支持相对路径、绝对路径和完整URL
   * @returns {Promise} - 初始化完成的Promise
   */
  async init(options = {}) {
    if (this.isLoaded) return Promise.resolve();

    try {
      // 兼容原有 API：仍接受 cssUrl/jsUrl/assetsUrl/fontsUrl。
      // 现在 maplibre-gl / turf / three 已通过 npm 静态打包，无需再动态加载 jsUrl；
      // cssUrl 也默认改为内联注入，仅当显式传入非默认地址时才额外加载。
      const {
        cssUrl = '/bicMap/bicMap.css',
        jsUrl = '/bicMap/bicMap.min.js',
        assetsUrl = '/bicMap/assets',
        fontsUrl = '/bicMap/assets/ttf'
      } = options;

      // 存储资源路径配置
      this.resourcePaths = {
        cssUrl,
        jsUrl,
        assetsUrl,
        fontsUrl
      };

      // 注入内置的 MapLibre 基础样式（只注入一次）
      this.injectBaseStyles();

      // 注入 Harmony 字体的 @font-face（指向 fontsUrl，默认/自定义路径均生效）。
      // 只要使用方按约定托管了字体文件，标签即可开箱即用地显示鸿蒙字体；
      // 未托管时浏览器会自动回退到 sans-serif，不影响功能。
      this.injectFontStyles();

      // 向后兼容：若调用方显式传入了自定义（非默认）CSS 地址，则额外加载，便于样式覆盖
      if (cssUrl && cssUrl !== '/bicMap/bicMap.css') {
        await loadCSS(cssUrl);
      }

      // 向后兼容：若调用方显式传入了自定义（非默认）JS 地址，则额外加载
      if (jsUrl && jsUrl !== '/bicMap/bicMap.min.js') {
        await loadScript(jsUrl);
      }

      // 引用通过 npm 打包进来的引擎实例
      this.maplibregl = maplibregl;
      this.turf = turf;
      this.THREE = THREE;
      this.mapUtils = mapUtils;

      // 向后兼容：原先 bicMap.min.js 会把引擎挂到 window 全局，部分业务代码
      // （如 window.maplibregl / window.MapUtils / window.cartesianToGPS）直接依赖这些全局。
      // 为保持「使用方式和原先一模一样」，init() 后同样补齐这些全局（已存在则不覆盖）。
      this.exposeGlobals();

      this.isLoaded = true;

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 向 window 暴露引擎全局（向后兼容原 bicMap.min.js 的全局挂载方式）
   * @private
   */
  exposeGlobals() {
    if (typeof window === 'undefined') return;

    if (!window.maplibregl) window.maplibregl = maplibregl;
    if (!window.turf) window.turf = turf;
    // THREE 模块命名空间是只读且不可扩展的，复制为普通对象，
    // 兼容那些需要在 window.THREE 上挂载附加组件（如 GLTFLoader）的旧代码。
    if (!window.THREE) window.THREE = { ...THREE };

    if (!window.MapUtils) window.MapUtils = mapUtils;
    if (!window.cartesianToGPS) window.cartesianToGPS = mapUtils.cartesianToGPS;
    if (!window.GPSToCartesian) window.GPSToCartesian = mapUtils.GPSToCartesian;
    if (!window.getMapCorners) window.getMapCorners = mapUtils.getMapCorners;
    if (!window.getDistance) window.getDistance = mapUtils.getDistance;
    if (!window.validateDistance) window.validateDistance = mapUtils.validateDistance;
  }

  /**
   * 注入内置的 MapLibre 基础样式（幂等，只注入一次）
   * @private
   */
  injectBaseStyles() {
    const styleId = 'bic-maplibre-base-styles';
    if (typeof document === 'undefined' || document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = maplibreCss;
    document.head.appendChild(style);
  }

  /**
   * 动态注入字体样式
   * @private
   */
  injectFontStyles() {
    const styleId = 'bic-dynamic-fonts';

    // SSR / 非浏览器环境跳过；并保证幂等（已注入过则不重复）
    if (typeof document === 'undefined' || document.getElementById(styleId)) return;
    
    const fontStyles = `
      @font-face {
        font-family: 'Harmony Bold';
        src: url('${this.resourcePaths.fontsUrl}/HARMONYOS_SANS_SC_BOLD.TTF') format('truetype');
        font-weight: bold;
        font-style: normal;
      }

      @font-face {
        font-family: 'Harmony Regular';
        src: url('${this.resourcePaths.fontsUrl}/HARMONYOS_SANS_SC_REGULAR.TTF') format('truetype');
        font-weight: normal;
        font-style: normal;
      }

      @font-face {
        font-family: 'Harmony Medium';
        src: url('${this.resourcePaths.fontsUrl}/HARMONYOS_SANS_SC_MEDIUM.TTF') format('truetype');
        font-weight: 500;
        font-style: normal;
      }
    `;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = fontStyles;
    document.head.appendChild(style);
  }

  /**
   * 获取资源完整路径
   * @param {string} relativePath - 相对路径（如 '/svg/pos.svg' 或 '/img/arrow.png'）
   * @returns {string} 完整的资源路径
   */
  getAssetPath(relativePath) {
    if (!relativePath) return this.resourcePaths.assetsUrl;
    
    // 如果已经是完整URL（包含协议），直接返回
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://') || relativePath.startsWith('//')) {
      return relativePath;
    }
    
    // 如果以 /bicMap/assets 开头，替换为配置的资源路径
    if (relativePath.startsWith('/bicMap/assets')) {
      return relativePath.replace('/bicMap/assets', this.resourcePaths.assetsUrl);
    }
    
    // 确保路径以 / 开头
    const cleanPath = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
    
    // 拼接资源基础路径
    return this.resourcePaths.assetsUrl + cleanPath;
  }

  /**
   * 获取游标样式字符串
   * @param {string} relativePath - 游标图片相对路径（如 '/svg/add-cursor.svg'）
   * @param {number} [hotspotX=10] - 游标热点X坐标
   * @param {number} [hotspotY=10] - 游标热点Y坐标
   * @param {string} [fallback='auto'] - 后备游标样式
   * @returns {string} CSS游标样式字符串
   */
  getCursorStyle(relativePath, hotspotX = 10, hotspotY = 10, fallback = 'auto') {
    const fullPath = this.getAssetPath(relativePath);
    return `url('${fullPath}') ${hotspotX} ${hotspotY}, ${fallback}`;
  }

  /**
   * 获取字体文件完整路径
   * @param {string} fontFileName - 字体文件名（如 'HARMONYOS_SANS_SC_BOLD.TTF'）
   * @returns {string} 完整的字体文件路径
   */
  getFontPath(fontFileName) {
    if (!fontFileName) return this.resourcePaths.fontsUrl;
    
    // 如果已经是完整URL（包含协议），直接返回
    if (fontFileName.startsWith('http://') || fontFileName.startsWith('https://') || fontFileName.startsWith('//')) {
      return fontFileName;
    }
    
    // 如果以 /bicMap/assets/ttf 开头，替换为配置的字体路径
    if (fontFileName.startsWith('/bicMap/assets/ttf')) {
      return fontFileName.replace('/bicMap/assets/ttf', this.resourcePaths.fontsUrl);
    }
    
    // 确保文件名以 / 开头（如果不是绝对路径）
    const cleanFileName = fontFileName.startsWith('/') ? fontFileName : '/' + fontFileName;
    
    // 拼接字体基础路径
    return this.resourcePaths.fontsUrl + cleanFileName;
  }

  // 创建新地图实例
  createMap(options) {
    if (!this.isLoaded) {
      throw new Error('BicMap未初始化。请先调用init()。');
    }
    
    return createMap(this.maplibregl, options);
  }
  
  // 向地图添加GeoJSON数据源
  addGeoJSONSource(map, id, data) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    return addGeoJSONSource(map, id, data);
  }
  
  // 添加填充图层（多边形）到地图
  addFillLayer(map, id, sourceId, paint = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    return addFillLayer(map, id, sourceId, paint);
  }
  
  // 添加线图层到地图
  addLineLayer(map, id, sourceId, paint = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    return addLineLayer(map, id, sourceId, paint);
  }
  
  // 添加自定义缩放控件，带有缩放级别显示
  addZoomControl(map, position = 'bottom-right') {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }

    addZoomControl(this.maplibregl, map, position);
  }
  
  /**
   * 加载SLAM地图
   * @param {Object} map - 地图实例
   * @param {Object} options - 地图配置选项
   * @returns {Promise<Object>} 包含缓存的相机边界和其他相关信息的对象
   */
  async loadSlamMap(map, options) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    return loadSlamMap(map, options);
  }

  /**
   * 向地图添加带有旋转控制的方向标记
   * @param {Object} map - 地图实例
   * @param {Array} lngLat - 标记的[经度,纬度]坐标
   * @param {Object} options - 标记选项
   * @returns {Object} 包含操作标记方法的控制器对象
   */
  addDirectionalMarker(map, lngLat, options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    // 处理图片路径，如果options中没有指定imagePath，使用默认路径
    if (!options.imagePath) {
      options.imagePath = this.getAssetPath('/svg/pos.svg');
    } else if (options.imagePath.startsWith('/bicMap/assets')) {
      // 如果指定的路径是旧的硬编码路径，进行转换
      options.imagePath = this.getAssetPath(options.imagePath);
    }
    console.log('addDirectionalMarker options.imagePath', options.imagePath);
    return addDirectionalMarker(map, lngLat, options);
  }

  /**
   * 批量添加POI点位标记，支持旋转角度
   * @param {Object} map - 地图实例
   * @param {Array} points - 点位数组，每个点包含位置和旋转信息 [{lngLat: [lng, lat], rotation: number, name: string}]
   * @param {Object} options - 配置选项
   * @returns {Object} 包含批量点位控制方法的对象
   */
  addBatchPOIMarkers(map, points = [], options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    // 处理图片路径
    if (!options.imagePath) {
      options.imagePath = this.getAssetPath('/img/pos.png');
    } else if (options.imagePath.startsWith('/bicMap/assets')) {
      options.imagePath = this.getAssetPath(options.imagePath);
    }
    
    if (!options.labelIconPath) {
      options.labelIconPath = this.getAssetPath('/img/poi-sig.png');
    } else if (options.labelIconPath.startsWith('/bicMap/assets')) {
      options.labelIconPath = this.getAssetPath(options.labelIconPath);
    }
    console.log('addBatchPOIMarkers options.imagePath', options.imagePath);
    console.log('addBatchPOIMarkers options.labelIconPath', options.labelIconPath);
    return addBatchPOIMarkers(map, points, options);
  }

  /**
   * 添加机器人位置标记，支持旋转角度和标签
   * @param {Object} map - 地图实例
   * @param {Array} robots - 机器人数组，每个机器人包含位置、旋转和标识信息 [{lngLat: [lng, lat], rotation: number, name: string, id: string}]
   * @param {Object} options - 配置选项
   * @returns {Object} 包含机器人标记控制方法的对象
   */
  addRobotMarkers(map, robots = [], options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    // 处理图片路径
    if (!options.svgPath) {
      options.svgPath = this.getAssetPath('/img/robo.png');
    } else if (options.svgPath.startsWith('/bicMap/assets')) {
      options.svgPath = this.getAssetPath(options.svgPath);
    }
    
    return addRobotMarkers(map, robots, options);
  }

  /**
   * 添加点云到地图
   * @param {Object} map - 地图实例
   * @param {Array} points - 点云数据数组，每个点包含位置信息 [{lngLat: [lng, lat]}]
   * @param {Object} options - 配置选项
   * @returns {Object} 点云对象
   */
  createPointCloud(map, points = [], options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    return pointClouds.createPointCloud(map, points, options);
  }

  /**
   * 创建 3D 点云（基于 MapLibre custom layer + WebGL gl.POINTS）
   * 与 createPointCloud 的区别：
   *  - 使用自定义 WebGL 层真实抬升高度（z 轴以米为单位）
   *  - 与 2D 圆形图层互不冲突，可同时启用
   * @param {Object} map - 地图实例
   * @param {Array<[number,number,number?]>} points - 点云数据 [lng, lat, z?]
   * @param {Object} options - 配置选项，详见 pointCloud3D.js
   * @returns {Object} 3D 点云控制器（update/show/hide/remove/getPoints/getOptions）
   */
  createPointCloud3D(map, points = [], options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }

    return pointClouds.createPointCloud3D(map, points, options);
  }

  /**
   * 创建矩形区域
   * @param {Object} map - 地图实例
   * @param {Array} rectangles - 矩形数据数组
   * @param {Object} options - 配置选项
   * @returns {Object} 矩形控制器
   */
  createRectangles(map, rectangles = [], options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    return rectangle.createRectangles(map, rectangles, options);
  }

  /**
   * 创建多边形区域
   * @param {Object} map - 地图实例
   * @param {Array} polygons - 多边形数据数组，每个多边形包含 points: [[lng, lat], [lng, lat], ...] 和样式选项
   * @param {Object} options - 全局配置选项
   * @param {string} [options.fillColor='#3388ff'] - 默认填充颜色
   * @param {number} [options.fillOpacity=0.4] - 默认填充透明度
   * @param {string} [options.outlineColor='#3388ff'] - 默认边框颜色
   * @param {number} [options.outlineWidth=2] - 默认边框宽度
   * @param {string} [options.highlightColor='#ff6600'] - 高亮颜色
   * @param {boolean} [options.filled=true] - 默认是否填充
   * @returns {Object} 多边形控制器，包含 addPolygon/updatePolygon/removePolygon/show/hide/remove 等方法
   */
  createPolygons(map, polygons = [], options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    return polygon.createPolygons(map, polygons, options);
  }

  /**
   * 创建圆形集合（circle layer：点 + circle-radius）
   * @param {Object} map - 地图实例
   * @param {Array<{center:[number,number], radiusM:number}>} circles - 圆数据
   * @param {Object} options - 样式/ID 配置
   * @returns {Object} 圆形控制器（addCircle/clear/remove）
   */
  createCircles(map, circles = [], options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    return createCircles(map, circles, options);
  }

  /**
   * 创建多线段集合
   * @param {Object} map - 地图实例
   * @param {Array} polylines - 线段数据数组，每条线段包含 {path: [[lng, lat], [lng, lat], ...], color: string, width: number, opacity: number, dashType: string, showArrow: boolean}
   * @param {Object} options - 配置选项
   * @param {boolean} [options.showArrow=false] - 是否显示方向箭头，指示线段方向
   * @param {number} [options.arrowSize=1] - 箭头大小
   * @param {number} [options.arrowSpacing=50] - 箭头间距
   * @param {string} [options.arrowImagePath] - 箭头图片路径，如果不指定则使用默认路径
   * @returns {Object} 线段控制器
   */
  createPolylines(map, polylines = [], options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    // 处理箭头图片路径
    if (!options.arrowImagePath) {
      options.arrowImagePath = this.getAssetPath('/img/arrow.png');
    } else if (options.arrowImagePath.startsWith('/bicMap/assets')) {
      options.arrowImagePath = this.getAssetPath(options.arrowImagePath);
    }
    
    return createPolylines(map, polylines, options);
  }

  /**
   * 创建宽线段集合（轨道线/马路）
   * @param {Object} map - 地图实例
   * @param {Array} widelines - 宽线段数据数组，每条线段包含 {path: [[lng, lat], [lng, lat], ...], width: number(米), color: string, opacity: number}
   * @param {Object} options - 配置选项
   * @param {number} [options.defaultWidth=10] - 默认宽度（米）
   * @param {string} [options.defaultColor='#3388ff'] - 默认颜色
   * @param {number} [options.defaultOpacity=0.8] - 默认透明度
   * @param {boolean} [options.showOutline=true] - 是否显示边框
   * @param {string} [options.defaultOutlineColor='#2266cc'] - 默认边框颜色
   * @param {number} [options.defaultOutlineWidth=2] - 默认边框宽度
   * @param {Function} [options.onClick] - 点击回调函数
   * @returns {Object} 宽线段控制器，包含 update/addWideLine/updateWideLine/removeWideLine/clear/show/hide/remove 等方法
   */
  createWideLines(map, widelines = [], options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    
    return createWideLines(map, widelines, options);
  }

  /**
   * 启用矩形绘制工具
   * @param {Object} map - 地图实例
   * @param {Object} options - 绘制选项
   * @returns {Object} 绘制控制器，包含完成/取消回调和绘制状态管理方法
   */
  enableRectangleDrawing(map, options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    return enableRectangleDrawing(this.turf, map, options);
  }

  /**
   * 启用圆形绘制工具
   * @param {Object} map - 地图实例
   * @param {Object} options - 绘制选项
   * @returns {Object} 绘制控制器
   */
  enableCircleDrawing(map, options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    // 已升级为 circle layer 版本（点 + circle-radius），不再使用多边形近似
    return enableCircleRadiusDrawing(map, options);
  }

  /**
   * 启用多边形绘制工具
   * @param {Object} map - 地图实例
   * @param {Object} options - 绘制选项
   * @param {string} options.fillColor - 多边形填充颜色，默认为'#088'
   * @param {number} options.fillOpacity - 多边形填充透明度，默认为0.5
   * @param {string} options.lineColor - 多边形轮廓颜色，默认为'#044'
   * @param {number} options.lineWidth - 多边形轮廓宽度，默认为2
   * @param {string} options.pointColor - 顶点颜色，默认为'#ff0000'
   * @param {number} options.pointRadius - 顶点半径，默认为5
   * @param {Function} options.onDrawComplete - 绘制完成回调，接收GeoJSON多边形和多边形信息作为参数
   * @param {boolean} options.enableTouch - 是否启用触摸支持，默认为true
   * @param {number} options.minPoints - 最少点数，默认为3
   * @returns {Object} 绘制控制器，包含enable/disable/clearDrawing/finishDrawing等方法
   */
  enablePolygonDrawing(map, options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    return enablePolygonDrawing(this.turf, map, options);
  }

  /**
   * 启用线段绘制工具
   * @param {Object} map - 地图实例
   * @param {Object} options - 绘制选项
   * @param {string} options.fillColor - 线段填充颜色，默认为'#3388ff'
   * @param {number} options.fillOpacity - 线段填充透明度，默认为0.8
   * @param {string} options.lineColor - 线段轮廓颜色，默认为'#2266cc'
   * @param {number} options.lineWidth - 线段轮廓宽度，默认为2
   * @param {string} options.pointColor - 顶点颜色，默认为'#ff0000'
   * @param {number} options.pointRadius - 顶点半径，默认为5
   * @param {number} options.defaultWidth - 默认宽度（米），默认为20
   * @param {Function} options.onDrawComplete - 绘制完成回调，接收路径和宽度信息作为参数
   * @param {boolean} options.enableTouch - 是否启用触摸支持，默认为true
   * @param {number} options.minPoints - 最少点数，默认为2
   * @returns {Object} 绘制控制器，包含enable/disable/clearDrawing/finishDrawing/setWidth/getWidth等方法
   */
  enablePolylineDrawing(map, options = {}) {
    if (!this.isLoaded || !map) {
      throw new Error('地图未初始化。');
    }
    return enablePolylineDrawing(this.turf, map, options);
  }

  /**
   * 静态方法：加载外部资源（CSS和JS文件）
   * @param {Object} options - 加载选项
   * @param {Array<string>|string} [options.scripts] - 脚本URL或URL数组
   * @param {Array<string>|string} [options.stylesheets] - CSS文件URL或URL数组
   * @returns {Promise} - 所有资源加载完成的Promise
   */
  static loadResources(options) {
    return loadResources(options);
  }

  /**
   * 静态方法：加载单个CSS文件
   * @param {string} href - CSS文件URL
   * @returns {Promise} - 加载完成的Promise
   */
  static loadCSS(href) {
    return loadCSS(href);
  }

  /**
   * 静态方法：加载单个JS文件
   * @param {string} src - 脚本URL
   * @returns {Promise} - 加载完成的Promise
   */
  static loadScript(src) {
    return loadScript(src);
  }
}

// 创建单例实例
const bicMap = new BicMap();

// 导出
export default bicMap; 