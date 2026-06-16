import { ref, computed, watch } from 'vue'
import { DEFAULT_POIS } from './constants.js'

const STORAGE_KEY = 'mall_robot_monitor_pois'

function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.warn('[usePoiManager] Failed to load from localStorage:', e)
  }
  return null
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('[usePoiManager] Failed to save to localStorage:', e)
  }
}

export function usePoiManager() {
  const storedPois = loadFromStorage()
  const pois = ref(storedPois || DEFAULT_POIS.map(p => ({ ...p })))
  const activePoi = ref(null)
  const routeReferenceChecker = ref(null)

  watch(pois, (newPois) => {
    saveToStorage(newPois)
  }, { deep: true })

  function setRouteReferenceChecker(checker) {
    routeReferenceChecker.value = checker
  }

  function loadDefaultPois() {
    pois.value = DEFAULT_POIS.map(p => ({ ...p }))
  }

  function clearStorage() {
    localStorage.removeItem(STORAGE_KEY)
  }

  function addPoi(xFrac, yFrac, floor) {
    const id = `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newPoi = {
      id,
      name: `点位 ${pois.value.length + 1}`,
      description: '',
      narration: '',
      xFrac,
      yFrac,
      floor,
    }
    pois.value.push(newPoi)
    return newPoi
  }

  function updatePoi(id, data) {
    const idx = pois.value.findIndex(p => p.id === id)
    if (idx === -1) return
    pois.value[idx] = { ...pois.value[idx], ...data }
  }

  function isPoiInRoute(poiId) {
    if (typeof routeReferenceChecker.value === 'function') {
      return routeReferenceChecker.value(poiId)
    }
    return false
  }

  function removePoi(id) {
    if (isPoiInRoute(id)) {
      throw new Error('该点位已被路线引用，无法删除')
    }
    pois.value = pois.value.filter(p => p.id !== id)
    if (activePoi.value?.id === id) {
      activePoi.value = null
    }
  }

  function reorderPoi(fromIndex, toIndex) {
    const arr = [...pois.value]
    const [item] = arr.splice(fromIndex, 1)
    arr.splice(toIndex, 0, item)
    pois.value = arr
  }

  function setActivePoi(poi) {
    activePoi.value = poi
  }

  return {
    pois,
    activePoi,
    setActivePoi,
    addPoi,
    updatePoi,
    removePoi,
    isPoiInRoute,
    setRouteReferenceChecker,
    reorderPoi,
    loadDefaultPois,
    clearStorage,
  }
}
