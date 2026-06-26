# Robot Activity Orchestration Engine

通用机器人活动编排引擎 — 将 `mallRobotMonitor/robotSimulation.js`（商场导览机器人专用模拟）重构为支持室内/室外多类型机器人、自定义航点事件、外部交互条件、2D/3D 多模式显示的通用引擎。

## 架构概览

```
┌──────────────────────────────────────────────┐
│              Mission Layer                    │
│   (巡逻3圈→充电 / 等电梯→上2F→巡检)            │
├──────────────────────────────────────────────┤
│           Activity Tree Layer                 │
│   Sequence / Parallel / Loop / Conditional    │
├──────────────────────────────────────────────┤
│            Task Primitives                    │
│   MoveTask / WaitTask / ActionTask / ...      │
├──────────────────────────────────────────────┤
│          Waypoint Event System                │
│   onApproach / onArrive / onDepart / ...      │
├──────────────────────────────────────────────┤
│          State Machine Layer                  │
│   idle → moving → arrived → waiting → ...    │
├──────────────────────────────────────────────┤
│       Physics / Movement / Display Layer      │
│   kinematics / 2D marker / 3D model           │
└──────────────────────────────────────────────┘
```

## 模块清单

### `core/` — 机器人模型层

| 文件 | 导出 | 职责 |
|---|---|---|
| `robotPhase.js` | `RobotPhase` `canTransition` `isTerminal` `isActive` `PHASE_TRANSITIONS` | 13 种机器人阶段定义 + 状态转移白名单 |
| `waypointTypes.js` | `WaypointType` `Waypoint` `WaypointTypeRegistry` | 12 种航点类型 + 生命周期事件钩子 + 类型注册表 |
| `robotProfile.js` | `createRobotProfile` `getAvailableProfileTypes` `hasCapability` `ROBOT_PROFILE_TYPES` | 机器人配置模板：运动学/电池/传感器/显示 |

### `infra/` — 基础设施层

| 文件 | 导出 | 职责 |
|---|---|---|
| `eventBus.js` | `EventBus` | 机器人间及外部通信的发布/订阅事件系统 |
| `resourceManager.js` | `ResourceManager` `ResourceType` `ResourceLock` | 共享资源（电梯/充电桩/路段/区域）的获取与释放 |
| `displayManager.js` | `DisplayManager` `DisplayMode` | 2D/3D 可插拔渲染器统一门面，对外暴露与 `addStatusRobotMarkers` 相同的接口 |

### `engine/` — 引擎核心层

| 文件 | 导出 | 职责 |
|---|---|---|
| `robotController.js` | `RobotController` | 单个机器人的状态封装、运动控制、任务驱动 |
| `robotEngine.js` | `RobotEngine` | 多机器人生命周期管理 + RAF 主循环 + 插件注册 |
| `tasks/task.js` | `Task` | 活动树节点基类：`start` / `update` / `cancel` / `reset` |
| `tasks/taskStatus.js` | `TaskStatus` | 任务生命周期状态枚举 |
| `tasks/waitCondition.js` | `WaitCondition` | 11 种等待条件工厂方法（含 sensor / occupancy / elevator / trafficLight）+ AND/OR/NOT |
| `tasks/composites.js` | `Sequence` `Parallel` `Loop` `Conditional` `Retry` `Race` | 活动树组合节点 |
| `tasks/atomics.js` | `MoveTask` `WaitTask` `ActionTask` `AnnounceTask` `ChargeTask` `DockTask` `SignalTask` `SensorTask` | 活动树原子节点 |

### `visual/` — 视觉渲染层

| 文件 | 导出 | 职责 |
|---|---|---|
| `robotStatus.js` | `addStatusRobotMarkers` `ROBOT_STATUS` | 2D 图标 + 状态气泡（含电量/状态/坐标） |
| `robot3DLayer.js` | `createRobot3DLayer` `createRobot3DStatusLayer` | Three.js GLB 3D 模型渲染层 + 自动动画状态机 |
| `robot3DPresets.js` | `ROBOT_EXPRESSIVE_CONFIG` | 3D 模型预设配置（RobotExpressive.glb） |
| `fov.js` | `createRobotFOV` | 机器人视野扇形（FOV）图层 |

### 入口

| 文件 | 职责 |
|---|---|
| `index.js` | 所有公共 API 的 barrel export |

## 快速开始

```javascript
import { RobotEngine, RobotPhase, WaitCondition } from './index.js'

// 1. 创建引擎实例
const engine = new RobotEngine()

// 2. 添加机器人（使用内置画像）
const robotAlpha = engine.addRobot('guide-alpha', 'guide-indoor', {
  position: { x: 0.1, y: 0.5 },
  heading: 90,
  battery: 100,
})

// 3. 监听阶段变化
robotAlpha.onPhaseChange((robotId, oldPhase, newPhase) => {
  console.log(`[${robotId}] ${oldPhase} → ${newPhase}`)
})

// 4. 下达移动指令
robotAlpha.moveTo([0.9, 0.5], { tolerance: 0.3 })

// 5. 启动引擎
engine.start()
// 引擎自动以 requestAnimationFrame 驱动 tick
```

## 核心 API

### RobotEngine

| 方法 | 说明 |
|---|---|
| `start()` / `stop()` / `pause()` / `resume()` | 引擎生命周期控制 |
| `addRobot(id, profile, initialState)` | 添加机器人，返回 `RobotController` |
| `removeRobot(id)` | 移除机器人 |
| `getRobot(id)` / `getRobots()` | 查询机器人 |
| `assignMission(robotId, task)` | 分配任务 |
| `cancelMission(robotId)` | 取消任务 |
| `emitSignal(name, data)` / `onSignal(name, handler)` | 引擎级信号 |
| `registerWaypointType(type, handler)` | 注册自定义航点类型 |
| `registerConditionType(type, factory)` | 注册自定义条件类型 |

### RobotPhase (13 种状态)

`IDLE` → `MOVING` → `ARRIVED` → `DWELLING` / `WAITING` → ...

终态：`IDLE` | `ERROR` | `MANUAL`

完整转移定义见 `PHASE_TRANSITIONS` 映射表。

### TaskStatus

任务生命周期状态枚举：

| 值 | 说明 |
|---|---|
| `PENDING` | 已创建但尚未启动 |
| `IDLE` | 无活跃任务（初始状态） |
| `RUNNING` | 任务执行中 |
| `COMPLETED` | 任务已完成（到达目标） |
| `FAILED` | 任务失败 |
| `CANCELLED` | 任务已取消 |

### WaitCondition

| 工厂方法 | 说明 |
|---|---|
| `WaitCondition.duration(ms)` | 等待固定时长 |
| `WaitCondition.signal(name, options)` | 等待外部信号 |
| `WaitCondition.distance(robotId, minDist)` | 等待机器人远离 |
| `WaitCondition.resource(type, id, options)` | 等待资源可用 |
| `WaitCondition.sensor(type, options)` | 等待传感器值满足条件（eq/neq/gt/gte/lt/lte） |
| `WaitCondition.occupancy(zoneId, state)` | 等待区域进入指定占用状态 |
| `WaitCondition.elevator(floor, options)` | 等待电梯到达目标楼层 |
| `WaitCondition.trafficLight(color, options)` | 等待红绿灯变为指定颜色 |
| `WaitCondition.all(...conditions)` | AND 组合 |
| `WaitCondition.race(...conditions)` | OR 组合 |
| `WaitCondition.not(condition)` | 取反 |

### RobotProfile

内置 3 种画像：

| 画像类型 | 适用场景 | 最高速度 | 电池容量 |
|---|---|---|---|
| `guide-indoor` | 室内导览/播报 | 1.0 m/s | 100 |
| `patrol-outdoor` | 室外巡检/安防 | 2.5 m/s | 200 |
| `delivery-indoor` | 室内配送/运输 | 1.5 m/s | 150 |

可通过 `createRobotProfile(type, overrides)` 自定义覆盖。

