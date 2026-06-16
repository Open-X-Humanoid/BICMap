# Robot Activity Orchestration Engine — 架构设计方案

## 概述

将现有的 `mallRobotMonitor/robotSimulation.js`（商场导览机器人专用模拟）重构为**通用机器人活动编排引擎**。支持室内/室外多类型机器人、自定义航点事件、外部交互条件、2D/3D 多模式显示。

## 核心理念

```
活动树 (Activity Tree) + 分层状态机 + 插件式事件系统
```

所有机器人行为由**活动树**驱动，而非硬编码的 `move/dwell` 状态切换。

---

## 一、系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                      Mission Layer                           │
│   高层任务描述 (巡逻3圈→充电 / 从A到B→等待电梯→上2F→巡检)      │
├──────────────────────────────────────────────────────────────┤
│                    Activity Tree Layer                        │
│   Sequence / Parallel / Loop / Conditional / Retry / Race    │
├──────────────────────────────────────────────────────────────┤
│                     Task Primitives                           │
│   MoveTask / WaitTask / ActionTask / AnnounceTask             │
│   ChargeTask / DockTask / SignalTask / SensorTask            │
├──────────────────────────────────────────────────────────────┤
│                  Waypoint Event System                        │
│   onApproach / onArrive / onDepart / onWaitStart/End/TimedOut│
├──────────────────────────────────────────────────────────────┤
│                State Machine Layer                            │
│   idle → moving → arrived → dwelling → waiting → charging    │
│   → error → recovering → docking → manual                    │
├──────────────────────────────────────────────────────────────┤
│             Physics / Movement / Display Layer                │
│   kinematics / collision avoidance / interpolation            │
│   2D marker sync / 3D model sync / heading smoothing          │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、数据模型

### 2.1 航点系统 (Waypoint)

```javascript
// 航点类型
const WaypointType = {
  PATROL: 'patrol',                 // 普通巡检点
  POI: 'poi',                       // 兴趣点(播报)
  WAIT_ELEVATOR: 'wait_elevator',   // 等电梯
  WAIT_TRAFFIC: 'wait_traffic',     // 等红绿灯
  WAIT_DOOR: 'wait_door',           // 等门禁
  WAIT_SIGNAL: 'wait_signal',       // 等待外部信号
  CHARGING: 'charging',             // 充电站
  DOCK: 'dock',                     // 停靠点
  FLOOR_TRANSITION: 'floor_transition', // 跨楼层
  SERVICE: 'service',               // 服务站
  HOLD: 'hold',                     // 待命点
  HANDOVER: 'handover',             // 交接点(机器人间)
}

// 航点定义
const waypoint = {
  id: 'wp-elevator-north',
  type: WaypointType.WAIT_ELEVATOR,
  position: { xFrac: 0.5, yFrac: 0.3 },
  floor: '1F',
  meta: { /* 类型特定数据 */ },

  // 生命周期事件 (返回值决定行为)
  onApproach: async (robot, context) => { /* 靠近时触发 */ },
  onArrive: async (robot, context) => { /* 到达时触发 */ },
  onDepart: async (robot, context) => { /* 离开时触发 */ },
  onWaitStart: async (robot, context) => { /* 开始等待 */ },
  onWaitEnd: async (robot, context) => { /* 等待结束 */ },
  onTimeout: async (robot, context) => { /* 超时处理 */ },

  // 等待条件
  waitCondition: WaitCondition,
  waitTimeout: 30000,
}
```

### 2.2 条件系统 (WaitCondition)

```javascript
class WaitCondition {
  static duration(ms)                                  // 等待固定时长
  static signal(name, { timeout })                     // 等待外部信号
  static sensor(type, { value, operator })             // 等待传感器
  static all(...conditions)                            // 全部满足(AND)
  static race(...conditions)                           // 任一满足(OR)
  static not(condition)                                // 取反
  static distance(otherId, minDist)                    // 等待远离
  static occupancy(zoneId, state)                      // 等待区域空闲
  static resource(type, id, { shared })                // 等待资源
  static elevator(floor, direction)                    // 等电梯
  static trafficLight(color)                           // 等红绿灯
}
```

### 2.3 机器人状态机

```javascript
const RobotPhase = {
  IDLE: 'idle',            // 待命
  MOVING: 'moving',        // 移动中
  ROTATING: 'rotating',    // 旋转中
  ARRIVED: 'arrived',      // 已到达
  DWELLING: 'dwelling',    // 停留中
  WAITING: 'waiting',      // 等待条件
  CHARGING: 'charging',    // 充电中
  DOCKING: 'docking',      // 停靠中
  ERROR: 'error',          // 错误
  RECOVERING: 'recovering',// 恢复中
  RETURNING: 'returning',  // 归位中
  MANUAL: 'manual',        // 人工接管
  PAUSED: 'paused',        // 暂停
}
```

状态转移:

```
IDLE ──(start)──> MOVING
MOVING ──(arrive)──> ARRIVED
ARRIVED ──(hasWait)──> WAITING
ARRIVED ──(hasDwell)──> DWELLING
ARRIVED ──(nextWp)──> MOVING
WAITING ──(conditionMet)──> MOVING
WAITING ──(timeout)──> ERROR
DWELLING ──(timerDone)──> MOVING
ERROR ──(retry)──> RECOVERING
RECOVERING ──(success)──> MOVING
RECOVERING ──(fail)──> ERROR
MOVING ──(lowBattery)──> RETURNING
RETURNING ──(docked)──> CHARGING
CHARGING ──(full)──> IDLE
```

### 2.4 机器人画像 (RobotProfile)

```javascript
const robotProfiles = {
  'guide-indoor': {
    type: 'guide',
    capabilities: ['patrol', 'announce', 'follow-human'],
    kinematics: { maxSpeed: 1.0, acceleration: 0.5, rotationSpeed: 90 },
    battery: { capacity: 100, drainMove: 0.0017, drainIdle: 0.0001, drainWait: 0.0003 },
    display: { markerType: 'robot-guide', model3D: 'guide-bot.glb', icon: 'robot-guide' },
    sensors: ['lidar', 'depth-camera', 'mic'],
  },
  'patrol-outdoor': {
    type: 'patrol',
    capabilities: ['patrol', 'surveillance', 'alarm'],
    kinematics: { maxSpeed: 2.5, acceleration: 1.0, rotationSpeed: 60 },
    battery: { capacity: 200, drainMove: 0.003, drainIdle: 0.0002 },
    display: { markerType: 'robot-patrol', model3D: 'patrol-bot.glb', icon: 'robot-patrol' },
    sensors: ['360-camera', 'thermal', 'gas-detector'],
    weatherResistant: true,
  },
  'delivery-indoor': {
    type: 'delivery',
    capabilities: ['transport', 'dock', 'call-elevator'],
    kinematics: { maxSpeed: 1.5, acceleration: 0.8, rotationSpeed: 120 },
    battery: { capacity: 150, drainMove: 0.002, drainIdle: 0.00015 },
    display: { markerType: 'robot-delivery', model3D: 'delivery-bot.glb', icon: 'robot-delivery' },
    cargo: { maxLoad: 50, compartments: 3 },
  },
}
```

### 2.5 活动树 (Activity Tree)

```javascript
// 任务基类
class Task {
  constructor(config) { this.config = config }
  async start(context) { /* 开始执行 */ }
  async update(deltaTime, context) { /* 每帧更新，返回 'running' | 'completed' | 'failed' */ }
  async cancel(context) { /* 取消 */ }
  getStatus() { /* 当前状态 */ }
}

// 组合任务
class Sequence extends Task { constructor(tasks) }   // 顺序执行
class Parallel extends Task { constructor(tasks) }    // 并行执行
class Loop extends Task { constructor({ times, task }) } // 循环
class Conditional extends Task { constructor({ if: cond, then, else }) } // 条件分支
class Retry extends Task { constructor({ maxRetries, task }) } // 重试
class Race extends Task { constructor(tasks) }         // 竞速(任一完成即返回)

// 原子任务
class MoveTask extends Task { constructor({ to, route, tolerance }) }
class WaitTask extends Task { constructor({ condition, timeout }) }
class ActionTask extends Task { constructor({ action, params }) }
class AnnounceTask extends Task { constructor({ message, tts }) }
class ChargeTask extends Task { constructor({ stationId, minCharge }) }
class DockTask extends Task { constructor({ stationId }) }
class SignalTask extends Task { constructor({ signal, data }) }
class SensorTask extends Task { constructor({ sensor, action }) }
```

---

## 三、引擎核心接口

```javascript
class RobotEngine {
  constructor(config)

  // 生命周期
  start(): void
  stop(): void
  pause(): void
  resume(): void
  tick(deltaTime: number): void        // 主循环

  // 机器人管理
  addRobot(id, profile, initialState): RobotController
  removeRobot(id): void
  getRobot(id): RobotController
  getRobots(): Map<string, RobotController>

  // 任务管理
  assignMission(robotId, missionTree): void
  cancelMission(robotId): void
  getMissionStatus(robotId): string

  // 事件/信号
  emitSignal(name, data): void
  onSignal(name, handler): void

  // 资源管理
  getResourceManager(): ResourceManager

  // 显示同步
  setDisplayMode(mode: '2d' | '3d' | 'both'): void
  getDisplayManager(): DisplayManager

  // 插件注册
  registerWaypointType(type, handler): void
  registerConditionType(type, handler): void
  registerActionType(type, handler): void
}

class RobotController {
  // 状态查询
  getId(): string
  getProfile(): RobotProfile
  getPhase(): RobotPhase
  getPosition(): Vector2
  getHeading(): number
  getBattery(): number
  getTaskStatus(): string

  // 控制
  moveTo(target, options): Promise<void>
  waitFor(condition, options): Promise<void>
  performAction(action, params): Promise<void>
  cancelCurrentTask(): void
  emergencyStop(): void
  resume(): void

  // 信号
  signal(name, data): void
  onSignal(name, handler): void

  // 事件
  onPhaseChange(handler): void
  onError(handler): void
}
```

---

## 四、资源调度系统

```javascript
class ResourceManager {
  acquire(resourceType, resourceId, robotId, options): Promise<ResourceLock>
  release(lock): void
  signal(resourceId, event, data): void
  getStatus(resourceType, resourceId): ResourceStatus

  // 预置资源类型
  static ELEVATOR = 'elevator'
  static CHARGER = 'charger'
  static PATH_SEGMENT = 'path_segment'
  static GATE = 'gate'
  static ZONE = 'zone'
}
```

---

## 五、错误恢复策略

```javascript
const ErrorRecoveryStrategies = {
  PATH_BLOCKED: {
    maxRetries: 3,
    actions: ['repath', 'wait_and_retry', 'notify_dispatch'],
  },
  LOW_BATTERY: {
    actions: ['interrupt_and_charge', 'notify_dispatch'],
  },
  LOCALIZATION_LOST: {
    actions: ['stop_and_relocalize', 'request_human_help'],
  },
  COMMUNICATION_LOST: {
    actions: ['safe_stop', 'wait_for_reconnect'],
  },
  OBSTACLE_DETECTED: {
    actions: ['wait_and_retry', 'repath', 'request_clearance'],
  },
}
```

---

## 六、Display 管理

```javascript
class DisplayManager {
  constructor(map)
  setMode(mode)                       // '2d' | '3d' | 'both'
  addRobotMarker(robotId, config)    // 添加机器人标记
  updateRobotMarker(robotId, state)  // 更新位置/朝向/状态
  removeRobotMarker(robotId)         // 移除标记
  syncAll(robots)                     // 全量同步

  // 2D 模式使用 addStatusRobotMarkers
  // 3D 模式使用 gltf model + animation
}
```

---

## 七、向后兼容策略

- 旧的 `robotSimulation.js` 保持不动，新引擎作为独立模块
- 提供适配层，让 `mallRobotMonitor` 可以按需迁移
- 现有 `PatrolState` 数据模型映射到新引擎的初始状态

---

## 八、实施路径

### Phase 1 — 核心引擎（当前实施）
- 目录结构 + 基础类型定义
- WaypointType + WaitCondition 系统
- RobotPhase 状态机
- RobotProfile 配置系统
- RobotEngine 核心类 + tick 主循环
- MoveTask 原子任务（运动学 + 平滑朝向）

### Phase 2 — 活动树 + 组合任务
- Task 基类 + 原子任务集
- Sequence / Parallel / Loop / Conditional / Retry
- 任务中断与恢复

### Phase 3 — 资源调度 + 错误恢复
- ResourceManager
- 错误恢复策略注册
- EventBus 机器人间通信

### Phase 4 — 显示层 + 运维能力
- DisplayManager（2D/3D 统一）
- 任务日志与回放
- 时间表调度
