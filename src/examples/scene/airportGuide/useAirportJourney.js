/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-06-09
 * @Description: 飞机场导览 — 航班驱动旅程状态机
 * @FilePath: /bic-map-plugin/src/examples/scene/airportGuide/useAirportJourney.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

import { computed, ref } from 'vue'

import { ROBOT_STATUS } from '@/examples/utils/robot'

import {
  buildDirectRoute,
  buildGuideRouteSegments,
  buildJourneyPolyline,
  buildReturnStandbyRoute,
  getRouteEndPoint,
  resolveRouteLegs,
  ROUTE_HANGZHOU_BAGGAGE,
  ROUTE_HANGZHOU_NO_BAGGAGE,
  ROUTE_SHANGHAI_FAST,
  getPoiById,
} from './airportRoutes.js'
import {
  AIRPORT_PROMPTS,
  GUIDE_ROBOT_ID,
  GUIDE_SPEED_FRAC_PER_SECOND,
  JOURNEY_STAGE,
  PROMPT_MODE,
  ROBOT_IDLE_HEADING,
  ROBOT_STANDBY_POI_ID,
  URGENT_REMAINING_MINUTES,
} from './constants.js'
import { isUrgentFlight } from './flightSchedule.js'
import { buildRouteSegments, getRoutePositionAtTime, iconRot } from './routeAnimation.js'

/**
 * @param {object} options
 * @param {() => object | null} options.getMap
 * @param {() => object | null} options.getRobotCtrl
 * @param {() => object | null} [options.getRoutePolyCtrl]
 * @param {(x:number,y:number)=>[number,number]} options.fracToGPS
 * @param {(poiId: string) => void} [options.onHighlightPoi]
 */
export function useAirportJourney(options) {
  const { getMap, getRobotCtrl, getRoutePolyCtrl, fracToGPS, onHighlightPoi } = options

  const activeFlight = ref(null)
  const journeyStage = ref(JOURNEY_STAGE.IDLE)
  const promptMode = ref(PROMPT_MODE.SELECT)
  const urgentText = ref('')
  const isGuiding = ref(false)
  const arrivalCard = ref(null)
  const showInteractionPanel = ref(true)

  const routeLegs = ref([])
  const currentLegIndex = ref(-1)
  const completedLegs = ref([])
  const guideRoute = ref([])
  const guideRobotPosition = ref(null)
  const currentLegRoute = ref([])
  const completedLegRoutes = ref([])
  const readyDepartPrompt = ref('')
  const isReturningToStandby = ref(false)
  const guideRobotRotation = ref(0)

  let animationFrameId = null

  function cancelAnimation() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  function getRobotStandbyHomePoint() {
    const standbyPoi = getPoiById(ROBOT_STANDBY_POI_ID)
    return { xFrac: standbyPoi.xFrac + 0.02, yFrac: standbyPoi.yFrac }
  }

  function initRobotAtStandby(robotCtrl, position = null, rotation = null) {
    const point = position || getRobotStandbyHomePoint()
    const facing = rotation ?? iconRot(ROBOT_IDLE_HEADING)
    guideRobotPosition.value = point
    guideRobotRotation.value = facing
    robotCtrl?.updateRobot(GUIDE_ROBOT_ID, {
      lngLat: fracToGPS(point.xFrac, point.yFrac),
      rotation: facing,
      status: ROBOT_STATUS.IDLE,
      task: '待机中',
    })
  }

  function getRouteArrivalRotation(route) {
    const segments = buildRouteSegments(route, GUIDE_SPEED_FRAC_PER_SECOND)
    const lastSegment = segments[segments.length - 1]
    return lastSegment ? iconRot(lastSegment.rotation) : guideRobotRotation.value
  }

  function updateRouteLayer() {
    const routePolyCtrl = getRoutePolyCtrl?.()
    if (!routePolyCtrl) return
    const polyline = isReturningToStandby.value
      ? currentLegRoute.value
      : buildJourneyPolyline(completedLegRoutes.value, currentLegRoute.value)
    routePolyCtrl.update(buildGuideRouteSegments(polyline, fracToGPS))
  }

  function getCurrentTarget() {
    if (currentLegIndex.value < 0 || currentLegIndex.value >= routeLegs.value.length) return null
    return routeLegs.value[currentLegIndex.value]
  }

  const taskText = computed(() => {
    if (isGuiding.value) {
      const target = getCurrentTarget()
      return target ? `前往 ${target.name}` : '引导中'
    }
    if (journeyStage.value === JOURNEY_STAGE.COMPLETE) return '任务完成'
    if (activeFlight.value) return `服务 ${activeFlight.value.destination} 航班`
    return '待机中'
  })

  const promptText = computed(() => {
    switch (promptMode.value) {
      case PROMPT_MODE.SELECT:
        return AIRPORT_PROMPTS.selectFlight
      case PROMPT_MODE.FLIGHT_FOUND:
        return activeFlight.value?.destination === '上海'
          ? AIRPORT_PROMPTS.shanghaiUrgent
          : AIRPORT_PROMPTS.hangzhouRelaxed
      case PROMPT_MODE.ASK_FAST_CHECKIN:
        return `${AIRPORT_PROMPTS.shanghaiUrgent} ${AIRPORT_PROMPTS.askFastCheckin}`
      case PROMPT_MODE.ASK_BAGGAGE:
        return AIRPORT_PROMPTS.hangzhouAskBaggage
      case PROMPT_MODE.READY_DEPART:
        return readyDepartPrompt.value || AIRPORT_PROMPTS.readyDepart
      case PROMPT_MODE.GUIDING:
        return AIRPORT_PROMPTS.guiding
      case PROMPT_MODE.COMPLETE:
        return AIRPORT_PROMPTS.complete
      default:
        return AIRPORT_PROMPTS.selectFlight
    }
  })

  const showConfirmYes = computed(() => (
    !isGuiding.value
    && !arrivalCard.value
    && activeFlight.value
    && [PROMPT_MODE.ASK_FAST_CHECKIN, PROMPT_MODE.ASK_BAGGAGE].includes(promptMode.value)
  ))

  const showConfirmNo = computed(() => (
    !isGuiding.value
    && !arrivalCard.value
    && activeFlight.value
    && promptMode.value === PROMPT_MODE.ASK_BAGGAGE
  ))

  const showDepart = computed(() => (
    !isGuiding.value
    && !arrivalCard.value
    && routeLegs.value.length > 0
    && promptMode.value === PROMPT_MODE.READY_DEPART
  ))

  const showContinue = computed(() => (
    !!arrivalCard.value
    && !isGuiding.value
    && journeyStage.value !== JOURNEY_STAGE.COMPLETE
    && currentLegIndex.value < routeLegs.value.length - 1
  ))

  function resetJourneyState() {
    cancelAnimation()
    isGuiding.value = false
    routeLegs.value = []
    currentLegIndex.value = -1
    completedLegs.value = []
    completedLegRoutes.value = []
    guideRoute.value = []
    currentLegRoute.value = []
    arrivalCard.value = null
    urgentText.value = ''
    readyDepartPrompt.value = ''
    isReturningToStandby.value = false
    updateRouteLayer()
    onHighlightPoi?.('')
  }

  function searchFlight(flight) {
    if (!flight) {
      activeFlight.value = null
      journeyStage.value = JOURNEY_STAGE.IDLE
      promptMode.value = PROMPT_MODE.SELECT
      showInteractionPanel.value = true
      resetJourneyState()
      return
    }

    resetJourneyState()
    activeFlight.value = flight
    journeyStage.value = JOURNEY_STAGE.ASK_BRANCH
    promptMode.value = PROMPT_MODE.FLIGHT_FOUND
    showInteractionPanel.value = true

    if (isUrgentFlight(flight.remainingMinutes)) {
      urgentText.value = `距登机不足 ${URGENT_REMAINING_MINUTES / 60} 小时，请抓紧时间`
      promptMode.value = PROMPT_MODE.ASK_FAST_CHECKIN
    } else {
      urgentText.value = ''
      promptMode.value = PROMPT_MODE.ASK_BAGGAGE
    }
  }

  function loadRoute(legsDefinition, options = {}) {
    routeLegs.value = resolveRouteLegs(legsDefinition)
    currentLegIndex.value = 0
    completedLegs.value = []
    completedLegRoutes.value = []
    journeyStage.value = JOURNEY_STAGE.GUIDING
    readyDepartPrompt.value = options.readyPrompt || ''
    promptMode.value = PROMPT_MODE.READY_DEPART
    prepareCurrentLegRoute()
    onHighlightPoi?.(getCurrentTarget()?.poiId || '')
    updateRouteLayer()
  }

  function confirmFastCheckin() {
    if (!activeFlight.value || activeFlight.value.destination !== '上海') return
    loadRoute(ROUTE_SHANGHAI_FAST)
  }

  function confirmBaggage(needsBaggage) {
    if (!activeFlight.value || activeFlight.value.destination !== '杭州') return
    loadRoute(
      needsBaggage ? ROUTE_HANGZHOU_BAGGAGE : ROUTE_HANGZHOU_NO_BAGGAGE,
      {
        readyPrompt: needsBaggage
          ? AIRPORT_PROMPTS.hangzhouConfirmBaggageYes
          : AIRPORT_PROMPTS.hangzhouConfirmBaggageNo,
      },
    )
  }

  function prepareCurrentLegRoute() {
    const target = getCurrentTarget()
    if (!target) return
    const start = guideRobotPosition.value || getRobotStandbyHomePoint()
    currentLegRoute.value = target.path?.length
      ? target.path
      : buildDirectRoute(start, target)
    guideRoute.value = currentLegRoute.value
    updateRouteLayer()
    onHighlightPoi?.(target.poiId)
    getRobotCtrl()?.updateRobot(GUIDE_ROBOT_ID, {
      status: ROBOT_STATUS.IDLE,
      task: `待出发：${target.name}`,
    })
  }

  function departCurrentLeg() {
    if (!currentLegRoute.value.length) prepareCurrentLegRoute()
    startGuideAnimation(() => onLegArrived())
  }

  function onLegArrived() {
    isGuiding.value = false
    promptMode.value = PROMPT_MODE.ARRIVED
    const target = getCurrentTarget()
    if (!target) return

    completedLegs.value = [...completedLegs.value, target]
    completedLegRoutes.value = [...completedLegRoutes.value, currentLegRoute.value]
    const endPoint = getRouteEndPoint(currentLegRoute.value, target)
    const arrivalRotation = getRouteArrivalRotation(currentLegRoute.value)
    guideRobotPosition.value = endPoint
    guideRobotRotation.value = arrivalRotation
    getRobotCtrl()?.updateRobot(GUIDE_ROBOT_ID, {
      lngLat: fracToGPS(endPoint.xFrac, endPoint.yFrac),
      rotation: arrivalRotation,
      status: ROBOT_STATUS.IDLE,
      task: `已到达 ${target.name}`,
    })
    onHighlightPoi?.(target.poiId)

    const progress = `${completedLegs.value.length}/${routeLegs.value.length}`
    arrivalCard.value = {
      title: target.arrivalTitle,
      body: target.arrivalBody,
      progress,
    }

    if (currentLegIndex.value >= routeLegs.value.length - 1) {
      journeyStage.value = JOURNEY_STAGE.COMPLETE
      promptMode.value = PROMPT_MODE.COMPLETE
      arrivalCard.value = {
        title: '导览已结束',
        body: '请在登机口排队上飞机。',
        progress,
      }
      setTimeout(() => autoReturnToStandby(), 1200)
      return
    }

    promptMode.value = PROMPT_MODE.ARRIVED
  }

  function continueNextLeg() {
    arrivalCard.value = null
    currentLegIndex.value += 1
    readyDepartPrompt.value = ''
    promptMode.value = PROMPT_MODE.READY_DEPART
    prepareCurrentLegRoute()
    onHighlightPoi?.(getCurrentTarget()?.poiId || '')
  }

  function animateAlongRoute(onComplete) {
    if (!guideRoute.value.length) {
      onComplete?.()
      return
    }
    cancelAnimation()
    const segments = buildRouteSegments(guideRoute.value, GUIDE_SPEED_FRAC_PER_SECOND)
    const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0)
    const startedAt = performance.now()

    const applyRoutePosition = (position) => {
      guideRobotPosition.value = { xFrac: position.xFrac, yFrac: position.yFrac }
      guideRobotRotation.value = position.rotation
      getRobotCtrl()?.updateRobot(GUIDE_ROBOT_ID, {
        lngLat: fracToGPS(position.xFrac, position.yFrac),
        rotation: position.rotation,
        status: ROBOT_STATUS.RUNNING,
      })
    }

    if (segments.length) {
      applyRoutePosition(getRoutePositionAtTime(segments, 0))
    }
    getRobotCtrl()?.updateRobot(GUIDE_ROBOT_ID, {
      status: ROBOT_STATUS.RUNNING,
      task: taskText.value,
    })

    const tick = (now) => {
      const elapsed = Math.min(now - startedAt, totalDuration)
      applyRoutePosition(getRoutePositionAtTime(segments, elapsed))
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
    promptMode.value = PROMPT_MODE.GUIDING
    onHighlightPoi?.(getCurrentTarget()?.poiId || '')
    animateAlongRoute(onComplete)
  }

  function finishReturnToStandby(robotCtrl) {
    const endPoint = guideRobotPosition.value
      ? { ...guideRobotPosition.value }
      : getRobotStandbyHomePoint()
    const endRotation = guideRobotRotation.value
    activeFlight.value = null
    journeyStage.value = JOURNEY_STAGE.IDLE
    promptMode.value = PROMPT_MODE.SELECT
    arrivalCard.value = null
    urgentText.value = ''
    showInteractionPanel.value = true
    resetJourneyState()
    initRobotAtStandby(robotCtrl, endPoint, endRotation)
  }

  function getLastReachedPoiId() {
    return completedLegs.value[completedLegs.value.length - 1]?.poiId
      || getCurrentTarget()?.poiId
      || null
  }

  function startReturnToStandbyAnimation(robotCtrl) {
    cancelAnimation()
    isGuiding.value = false
    promptMode.value = PROMPT_MODE.GUIDING
    urgentText.value = ''

    const home = getRobotStandbyHomePoint()
    const current = guideRobotPosition.value ? { ...guideRobotPosition.value } : { ...home }
    const returnRoute = buildReturnStandbyRoute(getLastReachedPoiId(), current, home)

    isReturningToStandby.value = true
    onHighlightPoi?.('')
    guideRoute.value = returnRoute
    currentLegRoute.value = returnRoute
    updateRouteLayer()

    getRobotCtrl()?.updateRobot(GUIDE_ROBOT_ID, {
      status: ROBOT_STATUS.RUNNING,
      task: AIRPORT_PROMPTS.returnStandby,
    })

    animateAlongRoute(() => {
      isReturningToStandby.value = false
      guideRoute.value = []
      currentLegRoute.value = []
      updateRouteLayer()
      finishReturnToStandby(robotCtrl)
    })
  }

  function autoReturnToStandby() {
    startReturnToStandbyAnimation(getRobotCtrl())
  }

  function returnToStandby() {
    const robotCtrl = getRobotCtrl()
    cancelAnimation()
    isGuiding.value = false

    const home = getRobotStandbyHomePoint()
    const current = guideRobotPosition.value ? { ...guideRobotPosition.value } : { ...home }
    const dx = Math.abs(current.xFrac - home.xFrac)
    const dy = Math.abs(current.yFrac - home.yFrac)

    if (dx < 0.004 && dy < 0.004) {
      finishReturnToStandby(robotCtrl)
      return
    }

    startReturnToStandbyAnimation(robotCtrl)
  }

  function cleanup() {
    cancelAnimation()
  }

  return {
    activeFlight,
    journeyStage,
    promptMode,
    urgentText,
    isGuiding,
    arrivalCard,
    showInteractionPanel,
    taskText,
    promptText,
    showConfirmYes,
    showConfirmNo,
    showDepart,
    showContinue,
    searchFlight,
    confirmFastCheckin,
    confirmBaggage,
    departCurrentLeg,
    continueNextLeg,
    returnToStandby,
    initRobotAtStandby,
    cleanup,
  }
}
