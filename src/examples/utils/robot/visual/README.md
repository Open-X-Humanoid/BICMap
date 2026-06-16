# visual — 机器人可视化模块

本目录包含机器人在地图上的所有**视觉渲染**能力，共 4 个文件。
各文件职责单一，可独立使用，也可通过 `DisplayManager` 统一编排。

---

## 文件速览

| 文件 | 导出 | 一句话描述 |
|---|---|---|
| `robotStatus.js` | `addStatusRobotMarkers` | 2D 图标 + 状态气泡标记 |
| `robot3DLayer.js` | `createRobot3DLayer` `createRobot3DStatusLayer` | Three.js GLB 3D 模型渲染层 |
| `robot3DPresets.js` | `ROBOT_EXPRESSIVE_CONFIG` | 3D 模型预设配置（Three.js 官方示例机器人） |
| `fov.js` | `createRobotFOV` | 机器人视野扇形（FOV）层 |

---

## robotStatus.js

提供带**状态气泡**和**电量显示**的 2D 机器人标记，在 `addRobotMarkers`（`robo.js`）基础上叠加独立的 HTML overlay，不修改底层逻辑。

```js
import { addStatusRobotMarkers } from './robotStatus.js'

const layer = addStatusRobotMarkers(map, robots, {
  svgPath: '/bicMap/assets/img/robo.png',
  showStatus: true,   // 气泡中显示状态标签
  showBattery: true,  // 气泡中显示电量图标
  GPSToCartesian,     // 可选：坐标转换函数，传入则气泡显示笛卡尔坐标
  onClick: (robot) => console.log(robot),
})

layer.updateRobot('r1', { status: 'running', battery: 60 })
layer.toggleLabels(false)
layer.remove()
```

**机器人数据字段：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识 |
| `lngLat` | `[lng, lat]` | 经纬度坐标 |
| `rotation` | `number` | 朝向角（°） |
| `name` | `string` | 显示名称 |
| `status` | `'idle'\|'running'\|'charging'\|'error'` | 状态，影响气泡主题色 |
| `battery` | `number` | 电量 0~100 |
| `task` | `string` | 任务描述（无坐标转换时显示在气泡顶行） |

**返回接口：**
`{ addRobot, updateRobot, updateRobots, removeRobot, clearRobots, getRobots, toggleLabels, remove }`

---

## robot3DLayer.js

基于 Three.js 的 MapLibre **Custom Layer**，加载 GLB 格式 3D 模型，内置动画状态机（移动时自动切 `walk`，静止后切 `idle`）。

导出两个函数，接口不同，按需选用：

### `createRobot3DLayer`（底层）

```js
import { createRobot3DLayer } from './robot3DLayer.js'

const layer = createRobot3DLayer(map, modelConfig, {
  layerId: 'robot-3d-layer',
  movementThreshold: 0.1,  // 触发行走动画的最小位移（米）
  idleDebounceMs: 500,     // 静止多久后切回 idle
  headingOffset3D: 0,      // 模型朝向补偿（°）
})

layer.addRobot({ id: 'r1', lngLat: [116.4, 39.9], heading: 90 })
layer.updateRobot('r1', { lngLat: [116.401, 39.9], heading: 95 })
layer.setAnimation('r1', 'wave')  // 手动控制动画
layer.removeRobot('r1')
layer.destroy()
```

> 机器人朝向字段为 `heading`（不是 `rotation`）。

### `createRobot3DStatusLayer`（适配层）

将 `createRobot3DLayer` 包装为与 `addStatusRobotMarkers` **完全相同的接口**，字段映射 `rotation → heading`，`status` 自动驱动动画。

```js
import { createRobot3DStatusLayer } from './robot3DLayer.js'

const layer = createRobot3DStatusLayer(map, modelConfig)

// 与 addStatusRobotMarkers 返回值用法完全一致
layer.addRobot({ id: 'r1', lngLat: [116.4, 39.9], rotation: 90, status: 'running' })
layer.updateRobot('r1', { status: 'idle' })  // 自动切换到 idle 动画
layer.remove()
```

---

## robot3DPresets.js

3D 模型的配置预设，与场景无关的**通用默认值**放这里；场景专属配置在各自 `constants.js` 中扩展。

```js
import { ROBOT_EXPRESSIVE_CONFIG } from './robot3DPresets.js'

// 换模型：只需覆盖 url 和 animations
const MY_CONFIG = {
  ...ROBOT_EXPRESSIVE_CONFIG,
  url: '/bicMap/assets/models/my-robot.glb',
  animations: { walk: 'Walk_Cycle', idle: 'Idle_Breathe' },
}
```

**当前预设：** Three.js 官方 `RobotExpressive.glb`

| 字段 | 说明 |
|---|---|
| `url` | GLB 文件路径（相对于 `public/`） |
| `scale` | 模型本体缩放 |
| `metersScale` | Mercator 单位换算系数 |
| `rotateX/Y/Z` | 坐标系修正旋转（弧度） |
| `animations` | key → GLB 内 AnimationClip 名称 |
| `defaultAnimation` | 初始动画 key |

---

## fov.js

在地图上渲染机器人**视野扇形（Field of View）**，由多个同心扇环叠加模拟径向渐变，顶点坐标统一经 `cartToGPS` 转换，与地图坐标系保持一致。

```js
import { createRobotFOV } from './fov.js'

const fov = createRobotFOV(map, {
  mapConfig: { startX, startY, width, height, scale },
  id: 'robot-r1',       // 多机器人时用不同 id 隔离
  angle: 60,            // FOV 夹角（°）
  radiusMeters: 3,      // 视距（米）
  fillColor: '#1677ff',
  innerOpacity: 0.45,
  outerOpacity: 0.02,
  bands: 6,             // 径向分段数，越多越平滑
})

// 机器人位置更新时调用（SLAM 笛卡尔坐标）
fov.update({ x: 10.5, y: 20.3 }, 135)
fov.hide()
fov.show()
fov.setConfig({ fillColor: '#ff4d4f', radiusMeters: 5 })
fov.remove()
```

> `update` 接收 **SLAM 笛卡尔坐标**（米），不是经纬度。

---

## 接口统一说明

`addStatusRobotMarkers` 的返回接口是本目录的**标准接口**，`createRobot3DStatusLayer` 与 `DisplayManager` 均与之对齐，可互换使用：

```
addRobot(robot)           → index
updateRobot(id, patch)    → boolean
updateRobots(robots)      → void
removeRobot(id)           → boolean
clearRobots()             → void
getRobots()               → Robot[]
toggleLabels(show?)       → void | boolean
remove()                  → void
```
