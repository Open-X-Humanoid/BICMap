/*
 * @Description: 电量监测和低电量自动返回管理
 *   从 usePatrolManager 中提取的电池相关逻辑，负责：
 *   - 低电量检测并触发自动返回
 *   - 低电量预警状态管理
 *   - 返回中标记管理（防止重复触发）
 *   - 事件报告定时器管理
 */
import { shallowRef, watch } from 'vue'
import { ROBOT_STATUS } from '@/bicMap/core/robot'
import { LOW_BATTERY_THRESHOLD, BATTERY_WARNING_THRESHOLD, EVENT_REPORT_INTERVAL } from './constants.js'

export function useBatteryManager() {
  // 低电量回调（由外部设置，用于触发返回操作）
  let onLowBatteryCallback = null

  // 正在返回中的机器人集合（防止重复触发）
  const returningRobotIds = new Set()

  // 事件报告定时器（robotId → timerId）
  const eventReportTimers = {}

  // 低电量预警集合（robotId → boolean）
  const warningRobotIds = shallowRef({})

  /**
   * 设置低电量回调
   * @param {Function} callback - (robotId) => Promise<void>
   */
  function setOnLowBattery(callback) {
    onLowBatteryCallback = callback
  }

  /**
   * 检查并触发低电量返回
   * @param {string} robotId
   * @param {number} battery - 当前电量
   * @param {string} currentPhase - 当前机器人阶段
   * @returns {Promise<boolean>} 是否触发了返回
   */
  async function checkBatteryAndReturn(robotId, battery, currentPhase) {
    // 电量高于阈值、已在充电、已在返回中 → 跳过
    if (battery > LOW_BATTERY_THRESHOLD) return false
    if (currentPhase === 'CHARGING') return false
    if (returningRobotIds.has(robotId)) return false
    if (!onLowBatteryCallback) return false

    // 标记并触发返回
    returningRobotIds.add(robotId)
    stopEventReport(robotId)

    try {
      await onLowBatteryCallback(robotId)
    } finally {
      // 返回完成后清理标记
      returningRobotIds.delete(robotId)
    }
    return true
  }

  /**
   * 检查电量预警状态
   * @param {string} robotId
   * @param {number} battery
   */
  function checkBatteryWarning(robotId, battery) {
    if (battery <= BATTERY_WARNING_THRESHOLD) {
      warningRobotIds.value = { ...warningRobotIds.value, [robotId]: true }
    } else {
      const updated = { ...warningRobotIds.value }
      delete updated[robotId]
      warningRobotIds.value = updated
    }
  }

  /**
   * 手动清除返回标记（用于非低电量触发的召回）
   * @param {string} robotId
   */
  function clearReturningMark(robotId) {
    returningRobotIds.delete(robotId)
  }

  /**
   * 判断机器人是否正在返回中
   * @param {string} robotId
   * @returns {boolean}
   */
  function isReturning(robotId) {
    return returningRobotIds.has(robotId)
  }

  // --- 事件报告定时器管理 ---

  function startEventReport(robotId, generateEventFn) {
    stopEventReport(robotId)

    const interval = randomInRange(EVENT_REPORT_INTERVAL.min, EVENT_REPORT_INTERVAL.max)

    eventReportTimers[robotId] = setTimeout(() => {
      // 如果机器人正在返回中，不生成事件
      if (returningRobotIds.has(robotId)) {
        delete eventReportTimers[robotId]
        return
      }

      generateEventFn()

      // 继续下一轮（若仍在活跃状态）
      startEventReport(robotId, generateEventFn)
    }, interval)
  }

  function stopEventReport(robotId) {
    if (eventReportTimers[robotId]) {
      clearTimeout(eventReportTimers[robotId])
      delete eventReportTimers[robotId]
    }
  }

  function stopAllEventReports() {
    for (const robotId of Object.keys(eventReportTimers)) {
      stopEventReport(robotId)
    }
  }

  // --- 工具函数 ---

  function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function cleanup() {
    stopAllEventReports()
    returningRobotIds.clear()
    onLowBatteryCallback = null
  }

  return {
    // 状态
    warningRobotIds,
    returningRobotIds,
    // 回调设置
    setOnLowBattery,
    // 电量检查
    checkBatteryAndReturn,
    checkBatteryWarning,
    clearReturningMark,
    isReturning,
    // 事件报告
    startEventReport,
    stopEventReport,
    stopAllEventReports,
    // 清理
    cleanup,
  }
}
