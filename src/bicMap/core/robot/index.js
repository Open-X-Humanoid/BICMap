/**
 * Robot Activity Orchestration Engine
 * 通用机器人活动编排引擎
 *
 * @module robot-activity-orchestration-engine
 */

// 状态机
export { RobotPhase, canTransition, isTerminal, isActive, PHASE_TRANSITIONS } from './core/robotPhase.js'

// 航点类型
export { WaypointType, Waypoint, WaypointTypeRegistry } from './core/waypointTypes.js'

// 条件系统
export { WaitCondition } from './core/waitCondition.js'

// 机器人画像
export { createRobotProfile, getAvailableProfileTypes, hasCapability, ROBOT_PROFILE_TYPES } from './core/robotProfile.js'

// 事件总线
export { EventBus } from './infra/eventBus.js'

// 资源管理器
export { ResourceManager, ResourceType, ResourceLock } from './infra/resourceManager.js'

// 移动任务
export { MoveTask } from './engine/moveTask.js'

// 任务状态枚举
export { TaskStatus } from './engine/taskStatus.js'

// 机器人控制器
export { RobotController } from './engine/robotController.js'

// 引擎核心
export { RobotEngine } from './engine/robotEngine.js'

// 显示管理器
export { DisplayManager, DisplayMode } from './infra/displayManager.js'

// 机器人状态标记
export { ROBOT_STATUS, addStatusRobotMarkers } from './visual/robotStatus.js'

// 机器人视野（FOV）
export { createRobotFOV } from './visual/fov.js'

// 3D 机器人渲染器（addStatusRobotMarkers 同构接口）
export { createRobot3DLayer, createRobot3DStatusLayer } from './visual/robot3DLayer.js'

// 3D 机器人模型预设配置
export { ROBOT_EXPRESSIVE_CONFIG } from './visual/robot3DPresets.js'
