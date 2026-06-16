import { computed, ref } from 'vue'

import { ROBOT_STATUS } from '@/examples/utils/robot'

import {
  GUIDE_ROBOT_ID,
  GUIDE_SPEED_FRAC_PER_SECOND,
  JOURNEY_STAGE,
  NARRATION_SCRIPTS,
  ROBOT_PROMPTS,
  ROBOT_STANDBY_POI_ID,
  BOARDING_AUTO_RETURN_DELAY_MS,
  ROBOT_IDLE_HEADING,
  ROUTE_SOURCE_ID,
} from './constants.js'
import {
  getCheckGateDeparturePoint,
  getStageTargetPoi,
  STATION_POIS,
} from './passengerStationLayout.js'
import {
  buildGuideRoute,
  buildRouteGeoJSON,
  buildRouteSegments,
  getRoutePositionAtTime,
  iconRot,
} from './pathfinding.js'

/**
 * @param {object} options
 * @param {() => object | null} options.getMap
 * @param {() => object | null} options.getRobotCtrl
 * @param {import('vue').Ref<object[]>} options.areas
 * @param {(x:number,y:number)=>[number,number]} options.fracToGPS
 * @param {() => void} [options.onRouteLayerUpdate]
 * @param {() => void} [options.onReturnStandbyComplete]
 */
export function usePassengerJourney(options) {
  const { getMap, getRobotCtrl, areas, fracToGPS, onRouteLayerUpdate, onReturnStandbyComplete } = options

  const activeTrip = ref(null)
  const journeyStage = ref(JOURNEY_STAGE.IDLE)
  const guideRoute = ref([])
  const isGuiding = ref(false)
  const guideRobotPosition = ref(null)
  const arrivalCard = ref(null)
  const promptMode = ref('idle')
  const urgentText = ref('')
  const showInteractionPanel = ref(false)

  let animationFrameId = null
  let completeHideTimer = null

  function clearCompleteHideTimer() {
    if (completeHideTimer) {
      clearTimeout(completeHideTimer)
      completeHideTimer = null
    }
  }

  function scheduleAutoReturnAfterBoarding() {
    clearCompleteHideTimer()
    completeHideTimer = setTimeout(() => {
      arrivalCard.value = {
        title: NARRATION_SCRIPTS[JOURNEY_STAGE.COMPLETE].title,
        body: NARRATION_SCRIPTS[JOURNEY_STAGE.COMPLETE].body,
        progress: '4/4',
      }
      promptMode.value = 'boardingComplete'
      showInteractionPanel.value = true
      autoReturnToStandby()
      completeHideTimer = null
    }, BOARDING_AUTO_RETURN_DELAY_MS)
  }

  function finishReturnToStandby(robotCtrl) {
    activeTrip.value = null
    journeyStage.value = JOURNEY_STAGE.IDLE
    arrivalCard.value = null
    promptMode.value = 'select'
    urgentText.value = ''
    showInteractionPanel.value = false
    initRobotAtStandby(robotCtrl)
    onReturnStandbyComplete?.()
  }

  function autoReturnToStandby() {
    const robotCtrl = getRobotCtrl()
    cancelAnimation()
    isGuiding.value = false
    urgentText.value = ''

    const home = getRobotStandbyHomePoint()
    const current = guideRobotPosition.value
      ? { ...guideRobotPosition.value }
      : { ...home }

    const dx = Math.abs(current.xFrac - home.xFrac)
    const dy = Math.abs(current.yFrac - home.yFrac)

    if (dx < 0.004 && dy < 0.004) {
      guideRoute.value = []
      updateRouteLayer()
      finishReturnToStandby(robotCtrl)
      return
    }

    guideRoute.value = buildGuideRoute(current, { xFrac: home.xFrac, yFrac: home.yFrac }, areas.value)
    updateRouteLayer()
    getRobotCtrl()?.updateRobot(GUIDE_ROBOT_ID, {
      status: ROBOT_STATUS.RUNNING,
      task: '返回待机区',
    })
    animateAlongRoute(() => {
      guideRoute.value = []
      updateRouteLayer()
      finishReturnToStandby(robotCtrl)
    }, { task: '返回待机区' })
  }

  const taskText = computed(() => {
    if (isGuiding.value && activeTrip.value) {
      const target = getStageTargetPoi(activeTrip.value, journeyStage.value)
      return target ? `前往 ${target.name}` : '引导中'
    }
    if (journeyStage.value === JOURNEY_STAGE.COMPLETE) return '任务完成'
    if (activeTrip.value) return `服务 ${activeTrip.value.destination} 班次`
    return '待机中'
  })

  const promptText = computed(() => {
    switch (promptMode.value) {
      case 'select':
        return ROBOT_PROMPTS.selectTrip
      case 'ticketFound':
        return ROBOT_PROMPTS.ticketFound
      case 'readyTicket':
        return ROBOT_PROMPTS.readyTicket
      case 'readyWaiting':
        return ROBOT_PROMPTS.readyWaiting
      case 'readyCheck':
        return ROBOT_PROMPTS.readyCheck
      case 'readyBoarding':
        return ROBOT_PROMPTS.readyBoarding
      case 'guiding':
        return ROBOT_PROMPTS.guiding
      case 'gateChanged':
        return ROBOT_PROMPTS.gateChanged
      case 'urgent':
        return ROBOT_PROMPTS.urgent
      case 'boardingComplete':
        return ROBOT_PROMPTS.boardingComplete
      case 'idle':
        return journeyStage.value === JOURNEY_STAGE.COMPLETE && activeTrip.value
          ? '已到达发车位，请稍候…'
          : ROBOT_PROMPTS.selectTrip
      default:
        return ROBOT_PROMPTS.selectTrip
    }
  })

  const showConfirmYes = computed(() => (
    !isGuiding.value
    && !arrivalCard.value
    && activeTrip.value
    && promptMode.value === 'ticketFound'
  ))

  const showDepart = computed(() => (
    !isGuiding.value
    && !arrivalCard.value
    && activeTrip.value
    && ['readyTicket', 'readyWaiting', 'readyCheck', 'readyBoarding'].includes(promptMode.value)
  ))

  const departButtonLabel = computed(() => (
    promptMode.value === 'readyTicket' ? '下一步' : '出发'
  ))

  const showContinue = computed(() => (
    !!arrivalCard.value
    && !isGuiding.value
    && journeyStage.value !== JOURNEY_STAGE.COMPLETE
  ))

  const showWait = computed(() => !isGuiding.value && activeTrip.value && journeyStage.value !== JOURNEY_STAGE.COMPLETE)

  function getRobotStandbyHomePoint() {
    const standbyPoi = STATION_POIS.find(p => p.id === ROBOT_STANDBY_POI_ID)
    return { xFrac: standbyPoi.xFrac + 0.03, yFrac: standbyPoi.yFrac }
  }

  function getRouteStartPoint() {
    if (journeyStage.value === JOURNEY_STAGE.BOARDING && activeTrip.value) {
      const departure = getCheckGateDeparturePoint(activeTrip.value.checkGate)
      if (departure) return { ...departure }
    }
    if (guideRobotPosition.value) return { ...guideRobotPosition.value }
    return getRobotStandbyHomePoint()
  }

  function initRobotAtStandby(robotCtrl) {
    const point = getRobotStandbyHomePoint()
    guideRobotPosition.value = point
    robotCtrl?.updateRobot(GUIDE_ROBOT_ID, {
      lngLat: fracToGPS(point.xFrac, point.yFrac),
      rotation: iconRot(ROBOT_IDLE_HEADING),
      status: ROBOT_STATUS.IDLE,
      task: '待机中',
    })
  }

  function updateRouteLayer() {
    const map = getMap()
    if (!map) return
    map.getSource(ROUTE_SOURCE_ID)?.setData(buildRouteGeoJSON(guideRoute.value, fracToGPS))
    onRouteLayerUpdate?.()
  }

  function prepareRouteForStage(stage) {
    cancelAnimation()
    arrivalCard.value = null
    const targetPoi = getStageTargetPoi(activeTrip.value, stage)
    if (!targetPoi) return
    const startPoint = getRouteStartPoint()
    guideRoute.value = buildGuideRoute(startPoint, targetPoi, areas.value)
    updateRouteLayer()
    getRobotCtrl()?.updateRobot(GUIDE_ROBOT_ID, {
      status: ROBOT_STATUS.IDLE,
      task: `待出发：${targetPoi.name}`,
    })
  }

  function setActiveTrip(trip) {
    cancelAnimation()
    isGuiding.value = false
    activeTrip.value = trip
    journeyStage.value = JOURNEY_STAGE.IDLE
    guideRoute.value = []
    arrivalCard.value = null
    promptMode.value = 'select'
    urgentText.value = ''
    updateRouteLayer()
  }

  function searchTicket(trip) {
    if (!trip) {
      promptMode.value = 'select'
      showInteractionPanel.value = false
      return
    }
    clearCompleteHideTimer()
    cancelAnimation()
    isGuiding.value = false
    activeTrip.value = trip
    journeyStage.value = JOURNEY_STAGE.IDLE
    guideRoute.value = []
    arrivalCard.value = null
    promptMode.value = 'ticketFound'
    urgentText.value = ''
    showInteractionPanel.value = true
    updateRouteLayer()
  }

  function confirmTicketGuide() {
    if (!activeTrip.value) return
    journeyStage.value = JOURNEY_STAGE.TICKET
    promptMode.value = 'readyTicket'
    prepareRouteForStage(JOURNEY_STAGE.TICKET)
  }

  function departCurrentStage() {
    if (!guideRoute.value.length) prepareRouteForStage(journeyStage.value)
    startGuideAnimation(() => onStageArrived())
  }

  function continueJourney() {
    arrivalCard.value = null
    if (journeyStage.value === JOURNEY_STAGE.TICKET) {
      journeyStage.value = JOURNEY_STAGE.WAITING
      promptMode.value = 'readyWaiting'
      prepareRouteForStage(JOURNEY_STAGE.WAITING)
      return
    }
    if (journeyStage.value === JOURNEY_STAGE.WAITING) {
      journeyStage.value = JOURNEY_STAGE.CHECK
      promptMode.value = 'readyCheck'
      prepareRouteForStage(JOURNEY_STAGE.CHECK)
      return
    }
    if (journeyStage.value === JOURNEY_STAGE.CHECK) {
      journeyStage.value = JOURNEY_STAGE.BOARDING
      promptMode.value = 'readyBoarding'
      const departure = getCheckGateDeparturePoint(activeTrip.value.checkGate)
      if (departure) {
        guideRobotPosition.value = { ...departure }
        getRobotCtrl()?.updateRobot(GUIDE_ROBOT_ID, {
          lngLat: fracToGPS(departure.xFrac, departure.yFrac),
          rotation: iconRot(ROBOT_IDLE_HEADING),
        })
      }
      prepareRouteForStage(JOURNEY_STAGE.BOARDING)
    }
  }

  function onStageArrived() {
    isGuiding.value = false
    promptMode.value = 'idle'
    const script = NARRATION_SCRIPTS[journeyStage.value]
    const stepOrder = { ticket: 1, waiting: 2, check: 3, boarding: 4 }[journeyStage.value] || 0
    if (script) {
      arrivalCard.value = {
        title: script.title,
        body: script.body,
        progress: stepOrder ? `${stepOrder}/4` : '',
      }
    }
    getRobotCtrl()?.updateRobot(GUIDE_ROBOT_ID, {
      status: ROBOT_STATUS.IDLE,
      task: script?.title || '已到达',
    })

    if (journeyStage.value === JOURNEY_STAGE.BOARDING) {
      journeyStage.value = JOURNEY_STAGE.COMPLETE
      arrivalCard.value = null
      promptMode.value = 'idle'
      scheduleAutoReturnAfterBoarding()
      return
    }

    if (journeyStage.value === JOURNEY_STAGE.TICKET) {
      promptMode.value = 'readyWaiting'
    } else if (journeyStage.value === JOURNEY_STAGE.WAITING) {
      promptMode.value = 'readyCheck'
    } else if (journeyStage.value === JOURNEY_STAGE.CHECK) {
      promptMode.value = 'readyBoarding'
    }
  }

  function animateAlongRoute(onComplete, { task = '移动中' } = {}) {
    if (!guideRoute.value.length) {
      onComplete?.()
      return
    }
    cancelAnimation()
    getRobotCtrl()?.updateRobot(GUIDE_ROBOT_ID, { status: ROBOT_STATUS.RUNNING, task })

    const segments = buildRouteSegments(guideRoute.value, GUIDE_SPEED_FRAC_PER_SECOND)
    const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0)
    const startedAt = performance.now()

    const tick = (now) => {
      const elapsed = Math.min(now - startedAt, totalDuration)
      const position = getRoutePositionAtTime(segments, elapsed)
      guideRobotPosition.value = { xFrac: position.xFrac, yFrac: position.yFrac }
      getRobotCtrl()?.updateRobot(GUIDE_ROBOT_ID, {
        lngLat: fracToGPS(position.xFrac, position.yFrac),
        rotation: position.rotation,
        status: ROBOT_STATUS.RUNNING,
      })
      if (elapsed >= totalDuration) {
        animationFrameId = null
        onComplete?.()
        return
      }
      animationFrameId = requestAnimationFrame(tick)
    }
    animationFrameId = requestAnimationFrame(tick)
  }

  function startGuideAnimation(onComplete) {
    if (!guideRoute.value.length) {
      onComplete?.()
      return
    }
    isGuiding.value = true
    promptMode.value = 'guiding'
    animateAlongRoute(onComplete)
  }

  function cancelAnimation() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  function returnToStandby() {
    const robotCtrl = getRobotCtrl()
    clearCompleteHideTimer()
    cancelAnimation()
    isGuiding.value = false

    const home = getRobotStandbyHomePoint()
    const current = guideRobotPosition.value
      ? { ...guideRobotPosition.value }
      : { ...home }

    const dx = Math.abs(current.xFrac - home.xFrac)
    const dy = Math.abs(current.yFrac - home.yFrac)

    if (dx < 0.004 && dy < 0.004) {
      guideRoute.value = []
      updateRouteLayer()
      finishReturnToStandby(robotCtrl)
      return
    }

    guideRoute.value = buildGuideRoute(current, { xFrac: home.xFrac, yFrac: home.yFrac }, areas.value)
    updateRouteLayer()
    animateAlongRoute(() => {
      guideRoute.value = []
      updateRouteLayer()
      finishReturnToStandby(robotCtrl)
    }, { task: '返回待机区' })
  }

  function onWait() {
    arrivalCard.value = null
  }

  function cleanup() {
    clearCompleteHideTimer()
    cancelAnimation()
  }

  return {
    activeTrip,
    journeyStage,
    guideRoute,
    isGuiding,
    arrivalCard,
    showInteractionPanel,
    promptText,
    taskText,
    urgentText,
    showConfirmYes,
    showDepart,
    showContinue,
    showWait,
    departButtonLabel,
    setActiveTrip,
    searchTicket,
    confirmTicketGuide,
    departCurrentStage,
    continueJourney,
    returnToStandby,
    initRobotAtStandby,
    onWait,
    cleanup,
  }
}
