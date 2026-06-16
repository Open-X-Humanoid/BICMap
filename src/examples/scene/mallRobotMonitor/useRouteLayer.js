import { ref } from 'vue'
import { ROBOT_CONFIGS, PATROL_ROUTES } from './constants.js'
import { getFovColor } from './useRobotManager.js'

const ROUTE_SOURCE_ID        = 'bic-mall-route-source'
const ROUTE_LAYER_ID         = 'bic-mall-route-layer'
const ROUTE_MARKER_SOURCE_ID = 'bic-mall-route-marker-source'
const ROUTE_START_LAYER_ID   = 'bic-mall-route-start-layer'
const ROUTE_END_LAYER_ID     = 'bic-mall-route-end-layer'
const ANNOUNCE_SOURCE_ID    = 'bic-mall-announce-source'
const ANNOUNCE_LAYER_ID     = 'bic-mall-announce-layer'

export function useRouteLayer(getMap, fracToGPS, routesGetter = null) {
  const showRoute = ref(false)

  function buildRouteGeoJSON() {
    const features = []
    const routes = routesGetter ? routesGetter() : PATROL_ROUTES
    ROBOT_CONFIGS.forEach((robot, robotIndex) => {
      const route = routes[robot.id]
      if (!route) return
      features.push({
        type: 'Feature',
        properties: {
          robotId: robot.id,
          name: robot.name,
          lineColor: getFovColor(robot.id, robotIndex),
        },
        geometry: { type: 'LineString', coordinates: route.map(frac => fracToGPS(...frac)) },
      })
    })
    return { type: 'FeatureCollection', features }
  }

  function buildRouteMarkersGeoJSON() {
    const features = []
    const routes = routesGetter ? routesGetter() : PATROL_ROUTES
    ROBOT_CONFIGS.forEach(robot => {
      const route = routes[robot.id]
      if (!route || route.length < 2) return
      features.push({
        type: 'Feature',
        properties: { robotId: robot.id, markerType: 'start' },
        geometry: { type: 'Point', coordinates: fracToGPS(...route[0]) },
      })
      features.push({
        type: 'Feature',
        properties: { robotId: robot.id, markerType: 'end' },
        geometry: { type: 'Point', coordinates: fracToGPS(...route[route.length - 1]) },
      })
    })
    return { type: 'FeatureCollection', features }
  }

  function buildAnnounceGeoJSON(announcements) {
    const features = announcements.map(({ frac, status, robotId }) => ({
      type: 'Feature',
      properties: { status, robotId },
      geometry: { type: 'Point', coordinates: fracToGPS(...frac) },
    }))
    return { type: 'FeatureCollection', features }
  }

  function addRouteLayer() {
    const map = getMap()
    if (!map) return
    if (map.getSource(ROUTE_SOURCE_ID)) {
      map.setLayoutProperty(ROUTE_LAYER_ID, 'visibility', 'visible')
      if (map.getLayer(ROUTE_START_LAYER_ID)) map.setLayoutProperty(ROUTE_START_LAYER_ID, 'visibility', 'visible')
      if (map.getLayer(ROUTE_END_LAYER_ID))   map.setLayoutProperty(ROUTE_END_LAYER_ID,   'visibility', 'visible')
      return
    }
    // 路线/公告点插入到机器人图层之前，确保机器人始终在路线上方
    const beforeId = map.getLayer('robot-markers-layer') ? 'robot-markers-layer' : undefined
    map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: buildRouteGeoJSON() })
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      paint: {
        'line-color': ['get', 'lineColor'],
        'line-width': 2,
        'line-opacity': 0.6,
        'line-dasharray': [4, 4],
      },
    }, beforeId)

    map.addSource(ROUTE_MARKER_SOURCE_ID, { type: 'geojson', data: buildRouteMarkersGeoJSON() })
    map.addLayer({
      id: ROUTE_START_LAYER_ID,
      type: 'circle',
      source: ROUTE_MARKER_SOURCE_ID,
      filter: ['==', ['get', 'markerType'], 'start'],
      paint: {
        'circle-radius': 5,
        'circle-color': '#1CD5A4',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9,
      },
    }, beforeId)
    map.addLayer({
      id: ROUTE_END_LAYER_ID,
      type: 'circle',
      source: ROUTE_MARKER_SOURCE_ID,
      filter: ['==', ['get', 'markerType'], 'end'],
      paint: {
        'circle-radius': 5,
        'circle-color': '#FF3B30',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9,
      },
    }, beforeId)
  }

  function removeRouteLayer() {
    const map = getMap()
    if (!map) return
    if (map.getLayer(ROUTE_LAYER_ID))       map.setLayoutProperty(ROUTE_LAYER_ID,       'visibility', 'none')
    if (map.getLayer(ROUTE_START_LAYER_ID)) map.setLayoutProperty(ROUTE_START_LAYER_ID, 'visibility', 'none')
    if (map.getLayer(ROUTE_END_LAYER_ID))   map.setLayoutProperty(ROUTE_END_LAYER_ID,   'visibility', 'none')
  }

  function toggleRoute() {
    showRoute.value = !showRoute.value
    showRoute.value ? addRouteLayer() : removeRouteLayer()
  }

  function addAnnounceLayer() {
    const map = getMap()
    if (!map) return
    if (map.getSource(ANNOUNCE_SOURCE_ID)) return
    const beforeId = map.getLayer('robot-markers-layer') ? 'robot-markers-layer' : undefined
    map.addSource(ANNOUNCE_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: ANNOUNCE_LAYER_ID,
      type: 'circle',
      source: ANNOUNCE_SOURCE_ID,
      paint: {
        'circle-radius': 6,
        'circle-color': [
          'match',
          ['get', 'status'],
          'pending', '#999999',
          'arrived', '#00FF88',
          'left', '#AAAAAA',
          '#999999',
        ],
        'circle-opacity': [
          'match',
          ['get', 'status'],
          'pending', 0.4,
          'arrived', 1.0,
          'left', 0.2,
          0.4,
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    }, beforeId)
  }

  function updateAnnouncementPoints(announcements) {
    const map = getMap()
    if (!map) return
    if (!map.getSource(ANNOUNCE_SOURCE_ID)) {
      addAnnounceLayer()
    }
    map.getSource(ANNOUNCE_SOURCE_ID).setData(buildAnnounceGeoJSON(announcements))
  }

  function cleanup() {
    const map = getMap()
    if (!map) return
    if (map.getLayer(ROUTE_LAYER_ID))        map.removeLayer(ROUTE_LAYER_ID)
    if (map.getSource(ROUTE_SOURCE_ID))      map.removeSource(ROUTE_SOURCE_ID)
    if (map.getLayer(ROUTE_START_LAYER_ID))  map.removeLayer(ROUTE_START_LAYER_ID)
    if (map.getLayer(ROUTE_END_LAYER_ID))    map.removeLayer(ROUTE_END_LAYER_ID)
    if (map.getSource(ROUTE_MARKER_SOURCE_ID)) map.removeSource(ROUTE_MARKER_SOURCE_ID)
    if (map.getLayer(ANNOUNCE_LAYER_ID))     map.removeLayer(ANNOUNCE_LAYER_ID)
    if (map.getSource(ANNOUNCE_SOURCE_ID))   map.removeSource(ANNOUNCE_SOURCE_ID)
  }

  function setRouteVisible(visible) {
    const map = getMap()
    if (!map) return
    if (visible && showRoute.value) {
      addRouteLayer()
    } else if (!visible) {
      removeRouteLayer()
    }
  }

  function setAnnouncementsVisible(visible) {
    const map = getMap()
    if (!map) return
    if (map.getLayer(ANNOUNCE_LAYER_ID)) {
      map.setLayoutProperty(ANNOUNCE_LAYER_ID, 'visibility', visible ? 'visible' : 'none')
    }
  }

  function updateRoutes() {
    const map = getMap()
    if (!map) return
    if (!map.getSource(ROUTE_SOURCE_ID)) return
    map.getSource(ROUTE_SOURCE_ID).setData(buildRouteGeoJSON())
    map.getSource(ROUTE_MARKER_SOURCE_ID).setData(buildRouteMarkersGeoJSON())
  }

  return { showRoute, toggleRoute, cleanup, updateRoutes, updateAnnouncementPoints, setRouteVisible, setAnnouncementsVisible }
}
