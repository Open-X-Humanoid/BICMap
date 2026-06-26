/*
 * @Description: 示例页路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../examples/home.vue'),
    meta: { title: '示例' }
  },
  {
    path: '/indoor/slam',
    name: 'Slam',
    component: () => import('../examples/indoor/slam/index.vue'),
    meta: { title: 'SLAM地图显示示例' }
  },
  {
    path: '/indoor/buildMap',
    name: 'BuildMap',
    component: () => import('../examples/indoor/slam/buildMap.vue'),
    meta: { title: '机器人建图' }
  },
  {
    path: '/indoor/robotFollow',
    name: 'RobotFollow',
    component: () => import('../examples/indoor/robotFollow/index.vue'),
    meta: { title: '机器人视角跟随' }
  },
  {
    path: '/base/mapTools',
    name: 'MapTools',
    component: () => import('../examples/base/mapTools/index.vue'),
    meta: { title: '地图工具' }
  },
  {
    path: '/base/POIMarkers',
    name: 'POIMarkers',
    component: () => import('../examples/base/POIMarkers/index.vue'),
    meta: { title: '点位Marker' }
  },
  {
    path: '/expand/POIadvancedLabel',
    name: 'POIadvancedLabel',
    component: () => import('../examples/expand/POIadvancedLabel/index.vue'),
    meta: { title: 'POI高级标注' }
  },
  {
    path: '/indoor/relocate',
    name: 'Relocate',
    component: () => import('../examples/indoor/relocate/index.vue'),
    meta: { title: '机器人重定位' }
  },
  {
    path: '/indoor/location',
    name: 'Location',
    component: () => import('../examples/indoor/location/index.vue'),
    meta: { title: '实时位置更新' }
  },
  {
    path: '/indoor/singleNavigation',
    name: 'SingleNavigation',
    component: () => import('../examples/indoor/singleNavigation/index.vue'),
    meta: { title: '单点导航' }
  },
  {
    path: '/indoor/load3D',
    name: 'load3D',
    component: () => import('../examples/indoor/load3D/index.vue'),
    meta: { title: '加载3D模型' }
  },
  {
    path: '/indoor/load3dControl',
    name: 'load3dControl',
    component: () => import('../examples/indoor/load3dControl/index.vue'),
    meta: { title: '3D模型控制' }
  },
  {
    path: '/indoor/pointCloud',
    name: 'PointCloud',
    component: () => import('../examples/indoor/pointCloud/index.vue'),
    meta: { title: '二三维点云示例' }
  },
  {
    path: '/indoor/semanticMap',
    name: 'SemanticMap',
    component: () => import('../examples/indoor/semanticMap/index.vue'),
    meta: { title: '语义地图分割' }
  },
  {
    path: '/indoor/load3dMarker',
    name: 'Space',
    component: () => import('../examples/indoor/load3dMarker/index.vue'),
    meta: { title: '三维空间数据渲染' }
  },
  {
    path: '/scene/robotGuideTour',
    name: 'RobotGuideTour',
    component: () => import('../examples/scene/robotGuideTour/index.vue'),
    meta: { title: '博物馆服务机器人导览讲解' }
  },
  {
    path: '/scene/hotelDelivery',
    name: 'HotelDelivery',
    component: () => import('../examples/scene/hotelDelivery/index.vue'),
    meta: { title: '酒店配送机器人' }
  },
  {
    path: '/scene/mallRobotMonitor',
    name: 'MallRobotMonitor',
    component: () => import('../examples/scene/mallRobotMonitor/index.vue'),
    meta: { title: '商场服务机器人导览与监控' }
  },
  {
    path: '/scene/indoorCleaning',
    name: 'IndoorCleaning',
    component: () => import('../examples/scene/indoorCleaning/index.vue'),
    meta: { title: '扫地机器人清扫场景' }
  },
  {
    path: '/scene/communityInspect',
    name: 'CommunityInspect',
    component: () => import('../examples/scene/communityInspect/index.vue'),
    meta: { title: '社区24h无人值守巡检' }
  },
  {
    path: '/base/PolylineDrawing',
    name: 'PolylineDrawing',
    component: () => import('../examples/base/polylineDraw/index.vue'),
    meta: { title: '折线绘制' }
  },
  {
    path: '/base/RectangleDraw',
    name: 'RectangleDraw',
    component: () => import('../examples/base/rectangleDraw/index.vue'),
    meta: { title: '矩形绘制' }
  },
  {
    path: '/base/PolygonDraw',
    name: 'PolygonDraw',
    component: () => import('../examples/base/polygonDraw/index.vue'),
    meta: { title: '多边形绘制' }
  },
  {
    path: '/base/CircleDraw',
    name: 'CircleDraw',
    component: () => import('../examples/base/circleDraw/index.vue'),
    meta: { title: '圆形绘制' }
  },
  {
    path: '/base/PathReplay',
    name: 'PathReplay',
    component: () => import('../examples/base/pathReplay/index.vue'),
    meta: { title: '路径回放' }
  },
  {
    path: '/base/PathPlanning',
    name: 'PathPlanning',
    component: () => import('../examples/base/pathPlanning/index.vue'),
    meta: { title: '路径规划' }
  },
  {
    path: '/expand/MapEditor',
    name: 'MapEditor',
    component: () => import('../examples/expand/MapEditor/index.vue'),
    meta: { title: '地图编辑' }
  },
  {
    path: '/expand/GraphicDrawing',
    name: 'GraphicDrawing',
    component: () => import('../examples/expand/GraphicDrawing/index.vue'),
    meta: { title: '图形绘制' }
  },
  {
    path: '/base/passableArea',
    name: 'PassableArea',
    component: () => import('../examples/base/passableArea/index.vue'),
    meta: { title: '可通行区域' }
  },
  {
    path: '/base/editPassableArea',
    name: 'EditPassableArea',
    component: () => import('../examples/base/editPassableArea/index.vue'),
    meta: { title: '可通行区域编辑' }
  },
  {
    path: '/outdoor/buildings',
    name: 'OutdoorBuildings',
    component: () => import('../examples/outdoor/buildings/index.vue'),
    meta: { title: '室外建筑物' }
  },
  {
    path: '/outdoor/pointCloud',
    name: 'OutdoorPointCloud',
    component: () => import('../examples/outdoor/pointCloud/index.vue'),
    meta: { title: '室外点云' }
  },
  {
    path: '/scene/transportHub',
    name: 'TransportHub',
    component: () => import('../examples/scene/transportHub/index.vue'),
    meta: { title: '三站一场地图引导' }
  },
  {
    path: '/scene/publicClean',
    name: 'PublicClean',
    component: () => import('../examples/scene/publicClean/index.vue'),
    meta: { title: '公共区域清洁' }
  },
  {
    path: '/outdoor/mapTiles',
    name: 'OutdoorMapTiles',
    component: () => import('../examples/outdoor/mapTiles/index.vue'),
    meta: { title: '地图瓦片加载' }
  },
  {
    path: '/outdoor/hdMap',
    name: 'OutdoorHdMap',
    component: () => import('../examples/outdoor/hdMap/index.vue'),
    meta: { title: '高精地图加载' }
  },
  {
    path: '/scene/securityPatrol',
    name: 'SecurityPatrol',
    component: () => import('../examples/scene/securityPatrol/index.vue'),
    meta: { title: '园区安防巡逻' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router