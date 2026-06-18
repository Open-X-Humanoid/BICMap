# Overlay Utils - 覆盖层工具

地图上的覆盖元素（气泡、标记等）相关的工具函数集合。

## 功能模块

### iotBubble.js
IoT 事件气泡管理器，用于在地图上显示设备状态弹出通知（电梯、门禁等）。支持自动消失、常驻、多点位同时显示。

**主要导出：**
- `IOT_EVENT_TYPE` - IoT 事件类型枚举
  - `ELEVATOR_CALL` - 呼梯中
  - `ELEVATOR_ARRIVED` - 电梯已到达
  - `ELEVATOR_OPEN` - 电梯门开
  - `ELEVATOR_CLOSE` - 电梯门关
  - `DOOR_OPEN` - 房间门开
  - `DOOR_CLOSE` - 房间门关
  - `DELIVERY_ARRIVED` - 配送到达
  - `WARNING` - 警告
  - `ERROR` - 错误
  - `CUSTOM` - 自定义消息
- `createIoTBubbles(map, options)` - 创建 IoT 气泡控制器

**options 参数：**

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `defaultDuration` | `number` | `4000` | 默认显示时长（ms），`0` = 常驻 |
| `maxBubbles` | `number` | `20` | 最大同时显示气泡数 |
| `showIcon` | `boolean` | `true` | 是否显示事件图标 |

**返回接口：**
- `emit(event)` - 发布气泡，相同 `id` 的气泡会替换旧的
- `update(event)` - 更新已有气泡内容（等同于 emit，不存在则创建）
- `dismiss(id)` - 手动关闭指定气泡（播放淡出动画）
- `clear()` - 清空所有气泡
- `remove()` - 销毁管理器（清除所有气泡并移除样式）

**`emit` 事件对象字段：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | ✅ | 设备或事件唯一 ID |
| `lngLat` | `[lng, lat]` | ✅ | 地图坐标 |
| `type` | `IOT_EVENT_TYPE` | | 事件类型，默认 `CUSTOM` |
| `deviceName` | `string` | | 设备名称（如房间号） |
| `message` | `string` | | 自定义消息文字 |
| `duration` | `number` | | 显示时长（ms），覆盖全局默认值 |
| `icon` | `string` | | 仅 `CUSTOM` 类型时覆盖图标 emoji |
| `color` | `string` | | 仅 `CUSTOM` 类型时覆盖背景色 |
| `label` | `string` | | 仅 `CUSTOM` 类型时覆盖标签文字 |

## 使用示例

```javascript
import { createIoTBubbles, IOT_EVENT_TYPE } from '@/bicMap/core/overlay'

const bubbles = createIoTBubbles(map, { defaultDuration: 4000 })

bubbles.emit({
  id: 'elevator-1',
  lngLat: [116.404, 39.915],
  type: IOT_EVENT_TYPE.ELEVATOR_ARRIVED,
  deviceName: '1号梯',
})

// 手动关闭
bubbles.dismiss('elevator-1')
```
