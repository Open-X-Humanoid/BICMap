/*
 * @Author: kai.lee@x-humanoid.com
 * @Date: 2026-06-05 17:21:26
 * @LastEditTime: 2026-06-05 18:39:58
 * @LastEditors: kai.lee@x-humanoid.com
 * @Description: 
 * @FilePath: /bic-map-plugin/src/examples/utils/experiment/robot/core/robotProfile.js
 * Copyright (c) 2024 kai.lee@x-humanoid.com, All Rights Reserved.
 */
/**
 * 机器人画像类型枚举
 */
export const ROBOT_PROFILE_TYPES = {
  GUIDE_INDOOR: 'guide-indoor',
  PATROL_OUTDOOR: 'patrol-outdoor',
  DELIVERY_INDOOR: 'delivery-indoor',
}

/**
 * 内置机器人画像配置集
 */
const BUILT_IN_PROFILES = {
  'guide-indoor': {
    type: 'guide',
    capabilities: ['patrol', 'announce', 'follow-human'],
    kinematics: { maxSpeed: 1.0, acceleration: 0.5, rotationSpeed: 90 },
    battery: { capacity: 100, drainMove: 0.0017, drainIdle: 0.0001, drainWait: 0.0003, drainRotate: 0.0008 },
    display: { markerType: 'robot-guide', model3D: 'guide-bot.glb', icon: 'robot-guide' },
    sensors: ['lidar', 'depth-camera', 'mic'],
  },
  'patrol-outdoor': {
    type: 'patrol',
    capabilities: ['patrol', 'surveillance', 'alarm'],
    kinematics: { maxSpeed: 2.5, acceleration: 1.0, rotationSpeed: 60 },
    battery: { capacity: 200, drainMove: 0.003, drainIdle: 0.0002, drainWait: 0.0005, drainRotate: 0.001 },
    display: { markerType: 'robot-patrol', model3D: 'patrol-bot.glb', icon: 'robot-patrol' },
    sensors: ['360-camera', 'thermal', 'gas-detector'],
    weatherResistant: true,
  },
  'delivery-indoor': {
    type: 'delivery',
    capabilities: ['transport', 'dock', 'call-elevator'],
    kinematics: { maxSpeed: 1.5, acceleration: 0.8, rotationSpeed: 120 },
    battery: { capacity: 150, drainMove: 0.002, drainIdle: 0.00015, drainWait: 0.0004, drainRotate: 0.0009 },
    display: { markerType: 'robot-delivery', model3D: 'delivery-bot.glb', icon: 'robot-delivery' },
    sensors: ['lidar', 'depth-camera'],
    cargo: { maxLoad: 50, compartments: 3 },
  },
}

/**
 * 创建机器人画像配置
 * @param {string} type - 画像类型标识，支持 'guide-indoor' | 'patrol-outdoor' | 'delivery-indoor'
 * @param {Object} [overrides={}] - 自定义覆盖项，会深度合并到内置画像上
 * @returns {Object} 完整的画像配置对象
 */
export function createRobotProfile(type, overrides = {}) {
  const baseProfile = BUILT_IN_PROFILES[type]
  if (!baseProfile) {
    throw new Error(`Unknown robot profile type: "${type}". Available types: ${Object.keys(BUILT_IN_PROFILES).join(', ')}`)
  }
  return deepMerge(baseProfile, overrides)
}

/**
 * 获取所有可用的画像类型
 * @returns {string[]}
 */
export function getAvailableProfileTypes() {
  return Object.keys(BUILT_IN_PROFILES)
}

/**
 * 检查画像是否具有某项能力
 * @param {Object} profile - 画像配置
 * @param {string} capability - 能力名称
 * @returns {boolean}
 */
export function hasCapability(profile, capability) {
  return profile.capabilities && profile.capabilities.includes(capability)
}

/**
 * 简单深度合并（支持嵌套对象）
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key]) && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}
