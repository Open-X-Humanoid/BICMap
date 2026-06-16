// ===== 类型定义 =====

/**
 * 路线航点（配置驱动的核心数据结构）
 *
 * @typedef {object} RouteWaypoint
 * @property {[number, number]} frac    - [xFrac, yFrac] 分数坐标（0~1 对应地图宽/高）
 * @property {string}           floor   - 此航点所在楼层 ID（e.g. '1F'）
 * @property {'normal'|'elevator'|'destination'|'home'} [type='normal']
 *   - normal      普通导航点，到达后吸附并旋转对准下一段方向，继续前进
 *   - elevator    电梯节点，到达后执行完整乘梯动画序列，换层后继续路线
 *   - destination 目的地，到达后执行配送完成序列（IoT + 等待 + 自动返程）
 *   - home        归位点，到达后旋转至待机朝向，结束本次任务
 * @property {ElevatorConfig}   [elevatorConfig]    - type === 'elevator' 时必填
 * @property {DestinationConfig} [destinationConfig] - type === 'destination' 时必填
 */

/**
 * 电梯节点配置
 *
 * @typedef {object} ElevatorConfig
 * @property {string}           name          - IoT 设备名（e.g. 'A梯'）
 * @property {string}           toFloor       - 目标楼层 ID
 * @property {number}           facingAngle   - 等待电梯时的朝向角（北顺时针°，如 270 = 朝西）
 * @property {[number, number]} interiorFrac  - 电梯轿厢内部落点（分数坐标）
 * @property {[number, number]} hallExitFrac  - 出梯后厅内等候点（分数坐标）
 * @property {[number, number]} corridorFrac  - 走出电梯厅至走廊的出口点（分数坐标）
 */

/**
 * 目的地节点配置
 *
 * @typedef {object} DestinationConfig
 * @property {number}           facingAngle - 面向房门的朝向角（北顺时针°，如 0 = 朝北）
 * @property {[number, number]} doorFrac    - 房门 IoT 显示位置（分数坐标）
 */

/**
 * 单次配送任务全量配置
 *
 * @typedef {object} RoomDeliveryConfig
 * @property {string}                    roomId       - 房间唯一 ID
 * @property {string}                    robotId      - robotCtrl 中的机器人 ID
 * @property {string}                    homeFloor    - 待机/起始楼层
 * @property {string}                    roomName     - 目标房间名（IoT + 文案）
 * @property {string}                    missionTask  - 配送任务文案
 * @property {string}                    idleTask     - 待机文案
 * @property {string}                    returnTask   - 返程文案
 * @property {number}                    idleBattery  - 初始电量（%）
 * @property {RouteWaypoint[]}           forwardRoute - 去程路线（index 0 = home/起点）
 * @property {RouteWaypoint[]|'auto'}    returnRoute  - 返程路线；'auto' = 自动反转去程
 */

// ===== 返程路线自动生成 =====

/**
 * 将去程路线自动反转为返程路线：
 *   - 首元素（目的地）type 改为 'normal'（robot 已在此处，仅作出发点）
 *   - 尾元素（home）保持 type: 'home'（触发任务结束）
 *   - elevator 节点的 floor / toFloor 对调（去程换层方向取反）
 *
 * @param {RouteWaypoint[]} forwardRoute
 * @returns {RouteWaypoint[]}
 */
export function buildReturnRoute(forwardRoute) {
  const reversed = [...forwardRoute].reverse()
  return reversed.map((wp, i) => {
    // 首元素：目的地变为普通出发点
    if (i === 0) {
      // eslint-disable-next-line no-unused-vars
      const { destinationConfig: _d, ...rest } = wp
      return { ...rest, type: 'normal' }
    }
    // 尾元素：强制确保 type 为 home（触发 onReturnComplete）
    if (i === reversed.length - 1) {
      return { ...wp, type: 'home' }
    }
    // 电梯节点：floor 与 toFloor 对调，实现换层方向取反
    if (wp.type === 'elevator' && wp.elevatorConfig) {
      return {
        ...wp,
        floor: wp.elevatorConfig.toFloor,
        elevatorConfig: {
          ...wp.elevatorConfig,
          toFloor: wp.floor,
        }
      }
    }
    return { ...wp }
  })
}

// ===== 预设路线集合 =====

/**
 * ROOM_ROUTES：按 roomId 索引的配送任务配置
 *
 * 新增房间只需在此对象中追加一个 RoomDeliveryConfig：
 *   - 同层配送：forwardRoute 中不含 elevator 节点，引擎自动跳过乘梯逻辑
 *   - 跨层配送：forwardRoute 含 elevator 节点，引擎自动执行乘梯动画序列
 *
 * @type {Record<string, RoomDeliveryConfig>}
 */
export const ROOM_ROUTES = {
  '215': {
    roomId:      '215',
    robotId:     'delivery-bot',
    homeFloor:   '1F',
    roomName:    '215号房',
    missionTask: '送至 215 号房',
    idleTask:    '待命中',
    returnTask:  '返回大堂',
    idleBattery: 85,
    // 去程：1F 待机区 → 走廊 → 乘 A 梯至 2F → 215 门口
    forwardRoute: [
      { frac: [0.135, 0.29], floor: '1F', type: 'home' },
      { frac: [0.18,  0.29], floor: '1F' },
      { frac: [0.18,  0.50], floor: '1F' },
      { frac: [0.55,  0.50], floor: '1F' },
      {
        frac: [0.55, 0.89], floor: '1F', type: 'elevator',
        elevatorConfig: {
          name:         'A梯',
          toFloor:      '2F',
          facingAngle:  270,
          interiorFrac: [0.495, 0.89],
          hallExitFrac: [0.55,  0.89],
          corridorFrac: [0.55,  0.50],
        }
      },
      // 电梯厅走廊出口（2F）：作为显式航点，确保 buildReturnRoute 反转后
      // 返程可沿 [0.915,0.50]→[0.55,0.50]→电梯 的 L 形走廊行走，避免穿墙
      { frac: [0.55,  0.50], floor: '2F' },
      { frac: [0.915, 0.50], floor: '2F' },
      {
        frac: [0.915, 0.54], floor: '2F', type: 'destination',
        destinationConfig: {
          facingAngle: 0,
          doorFrac:    [0.915, 0.54],
        }
      }
    ],
    returnRoute: 'auto',
  }
}
