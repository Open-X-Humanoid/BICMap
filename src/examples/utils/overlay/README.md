# Overlay Utils - 覆盖层工具

地图上的覆盖元素（气泡、标记等）相关的工具函数集合。

## 功能模块

### iotBubble.js
IoT 事件气泡管理器，用于在地图上显示设备状态弹出通知（电梯、门禁等）。

**主要导出：**
- `IOT_EVENT_TYPE` - IoT 事件类型枚举
  - `ELEVATOR_CALL` - 呼梯中
  - `ELEVATOR_ARRIVED` - 电梯已到达
  - `ELEVATOR_OPEN` - 电梯门开
  - `ELEVATOR_CLOSE` - 电梯门关
  - `DOOR_OPEN` - 房间门开
  - `DOOR_CLOSE` - 房间门关
  - `DELIVERY_ARRIVED` - 配送到达
  - `CUSTOM` - 自定义消息
- `createIoTBubbles(map, options)` - 创建 IoT 气泡控制器

## 使用示例

```javascript
import { createIoTBubbles, IOT_EVENT_TYPE } from '@/examples/utils/overlay'

const bubbles = createIoTBubbles(map, { defaultDuration: 4000 })
bubbles.emit({
  type: IOT_EVENT_TYPE.ELEVATOR_ARRIVED,
  position: [116.404, 39.915]
})
```
