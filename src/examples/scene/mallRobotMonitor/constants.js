export const SLAM_MAP_CONFIG = {
  startX: -58.999993705749512,
  startY: -21.349997329711914,
  xGridCount: 2752,
  yGridCount: 1536,
  resolution: 0.05
}

const { startX, startY, xGridCount, yGridCount, resolution } = SLAM_MAP_CONFIG
export const MAP_WIDTH_M  = xGridCount * resolution
export const MAP_HEIGHT_M = yGridCount * resolution

export const MAP_START_X = startX
export const MAP_START_Y = startY
export const MAP_X_GRID_COUNT = xGridCount
export const MAP_Y_GRID_COUNT = yGridCount
export const MAP_RESOLUTION = resolution

// 布局放大系数（使商场虚拟空间匹配中型商场尺寸）
export const LAYOUT_SCALE = 1.5

// 导览业务阶段枚举（对应 patrolState.phase 的所有取值）
export const GUIDE_PHASE = Object.freeze({
  /** 空闲，待导览 */
  IDLE:              'idle',
  /** 导览中（移动到下一个播报点） */
  MOVE:              'move',
  /** 讲解中（驻留在 POI） */
  DWELL:             'dwell',
  /** 返程中（导览结束，回到出发点） */
  RETURNING:         'returning',
  /** 归位中（旋转复位到北向） */
  ROTATING_TO_NORTH: 'rotating_to_north',
})

// 运动参数
export const ROBOT_SPEED     = 10.0
export const UPDATE_MS       = 16
export const ARRIVAL_DIST    = 0.5
export const IDLE_HEADING    = 0
export const ROTATE_DPS      = 120
export const DWELL_MS        = 5000

// 楼层配置
export const FLOOR_CONFIGS = [
  {
    id: '1F',
    label: '1F',
    slamOptions: { startX, startY, xGridCount, yGridCount, resolution, fitBounds: false }
  },
  {
    id: 'B1',
    label: 'B1',
    slamOptions: { startX, startY, xGridCount, yGridCount, resolution, fitBounds: false }
  }
]

// 预置机器人
export const ROBOT_CONFIGS = [
  {
    id: 'guide-bot-alpha',
    name: '导览机器人 A',
    markerSize: 28,
    initialFrac: [0.50, 0.00],
    startPoiId: 'poi-north-entrance',
    status: 'idle',
    battery: 90,
    task: '待导览',
    floor: '1F',
  },
  {
    id: 'guide-bot-beta',
    name: '导览机器人 B',
    markerSize: 28,
    initialFrac: [0.50, 0.00],
    startPoiId: 'poi-north-entrance',
    status: 'idle',
    battery: 82,
    task: '待导览',
    floor: '1F',
  },
  {
    id: 'guide-bot-b1',
    name: 'B1 导览机器人',
    markerSize: 28,
    initialFrac: [0.87, 0.20],
    startPoiId: 'poi-b1-robot-standby',
    status: 'idle',
    battery: 88,
    task: '待导览',
    floor: 'B1',
  },
]

// 巡逻路线（使用POI ID）
export const PATROL_ROUTES = {
  // 导览机器人 A - 西区路线
  'guide-bot-alpha': [
    'poi-game-center',       // 电玩娱乐城
    'poi-cafe',              // 品牌咖啡馆
    'poi-kids-area',         // 儿童游乐区
    'poi-west-food',         // 西区餐饮区
    'poi-west-zone',         // 西区精品区
    'poi-digital-center',    // 数码体验中心
  ],
  // 导览机器人 B - 东区路线
  'guide-bot-beta': [
    'poi-supermarket',       // 综合超市
    'poi-east-zone',         // 东区生活服务区
    'poi-cinema',            // 巨幕电影院
    'poi-east-food',         // 东区餐饮区
    'poi-jewelry-zone',      // 珠宝名表区
  ],
  // 巡检机器人 - 无路线，保持在待机区
  'patrol-bot': [],
  // B1 导览机器人 - B1 停车场路线
  'guide-bot-b1': [
    'poi-b1-parking-g',        // 停车区 G
    'poi-b1-parking-d',        // 停车区 D
    'poi-b1-parking-a',        // 停车区 A
    'poi-b1-exit-ramp',        // 出口坡道
    'poi-b1-elevator-lobby',   // 电梯厅
    'poi-b1-ev-charging',      // 新能源充电区
    'poi-b1-disabled-park',    // 无障碍车位区
    'poi-b1-fire-lane',        // 消防通道
  ],
}

// 默认预置 POI（根据商场实际布局设置）
export const DEFAULT_POIS = [
  // 北侧入口区域
  { id: 'poi-north-entrance', name: '南入口', description: '商场北侧主入口', narration: '欢迎来到本商场！这里是北侧主入口，设有自动扶梯和无障碍通道。向左前往西区商铺，向右前往东区超市和影院。', xFrac: 0.50, yFrac: 0.00, floor: '1F' },
  
  // 电玩娱乐城
  { id: 'poi-game-center', name: '电玩娱乐城', description: '电玩游戏娱乐中心', narration: '电玩娱乐城拥有多种热门游戏设备，包括街机、VR体验、赛车模拟等，是年轻人和游戏爱好者的聚集地。', xFrac: 0.295, yFrac: 0.12, floor: '1F' },
  
  // 中央中庭区域 - 服务台
  { id: 'poi-service-desk', name: '服务台', description: '客户服务中心', narration: '这里是商场服务台，位于中央中庭北侧。提供问询、引导、礼品包装等服务，您也可以在此租借导览机器人。', xFrac: 0.50, yFrac: 0.34, floor: '1F' },
  
  // 中央中庭区域 - 机器人待机区
  { id: 'poi-robot-standby', name: '机器人服务站', description: '导览机器人待机区', narration: '这里是导览机器人服务站，您可以在此呼叫机器人为您提供商场导览服务。机器人可带领您前往各个商铺和设施。', xFrac: 0.50, yFrac: 0.53, floor: '1F' },
  
  // 中央中庭区域 - 休息区
  { id: 'poi-atrium-rest', name: '中庭休息区', description: '中央中庭休息区', narration: '这里是中央中庭休息区，设有舒适的座椅和绿植装饰。您可以在此小憩片刻，欣赏中庭景观。', xFrac: 0.50, yFrac: 0.69, floor: '1F' },
  
  // 西区通道
  { id: 'poi-west-zone', name: '西区精品区', description: '西区精品商铺区域', narration: '西区汇集了国际名品馆、珠宝首饰馆、潮流服饰店等高端品牌，是时尚购物的理想选择。', xFrac: 0.12, yFrac: 0.765, floor: '1F' },
  
  // 西区卫生间附近（暂注释）
  // { id: 'poi-west-wc', name: '西区卫生间', description: '西区卫生间及母婴室', narration: '西区卫生间位于左侧通道中部，配备无障碍设施和母婴室，为您提供舒适的使用环境。', xFrac: 0.075, yFrac: 0.4425, floor: '1F' },
  
  // 西区餐饮区
  { id: 'poi-west-food', name: '西区餐饮区', description: '火锅料理和特色小吃', narration: '西区餐饮区汇集了火锅料理馆和特色小吃街，提供丰富的中式美食选择。', xFrac: 0.295, yFrac: 0.645, floor: '1F' },
  
  // 西区咖啡厅
  { id: 'poi-cafe', name: '品牌咖啡馆', description: '精品咖啡与甜点', narration: '本店提供精品咖啡、手工甜点和轻食简餐，是商务洽谈和朋友小聚的理想场所。', xFrac: 0.12, yFrac: 0.36, floor: '1F' },
  
  // 东区通道
  { id: 'poi-east-zone', name: '东区生活服务区', description: '东区生活服务区域', narration: '东区设有大型综合超市、健身运动中心和巨幕电影院，满足您的一站式生活需求。', xFrac: 0.71, yFrac: 0.36, floor: '1F' },
  
  // 东区超市入口
  { id: 'poi-supermarket', name: '综合超市', description: '大型综合超市入口', narration: '本超市提供新鲜蔬果、日用百货、进口食品等万余种商品，满足您的日常生活需求。', xFrac: 0.795, yFrac: 0.12, floor: '1F' },
  
  // 东区影院入口
  { id: 'poi-cinema', name: '巨幕电影院', description: '电影院入口', narration: '巨幕电影院配备先进的视听设备，提供震撼的观影体验。影院内设有VIP厅和休息区。', xFrac: 0.795, yFrac: 0.525, floor: '1F' },
  
  // 东区餐饮区
  { id: 'poi-east-food', name: '东区餐饮区', description: '日式料理与烘焙甜品', narration: '东区餐饮区提供精致的日式料理和美味的烘焙甜品，是休闲聚餐的好去处。', xFrac: 0.755, yFrac: 0.765, floor: '1F' },
  
  // 东区卫生间附近（暂注释）
  // { id: 'poi-east-wc', name: '东区卫生间', description: '东区卫生间', narration: '东区卫生间位于影院东侧，环境整洁，配备洗手液和干手机。', xFrac: 0.915, yFrac: 0.4425, floor: '1F' },
  
  // 儿童游乐区附近
  { id: 'poi-kids-area', name: '儿童游乐区', description: '亲子游乐区域', narration: '儿童游乐区配备安全软包设施，适合 3-12 岁儿童游玩，家长可在旁休息区等候。', xFrac: 0.12, yFrac: 0.525, floor: '1F' },
  
  // 数码体验中心
  { id: 'poi-digital-center', name: '数码体验中心', description: '智能数码产品体验区', narration: '数码体验中心展示最新的智能数码产品，您可以亲身体验各类电子产品的功能。', xFrac: 0.295, yFrac: 0.895, floor: '1F' },
  
  // 珠宝区
  { id: 'poi-jewelry-zone', name: '珠宝名表区', description: '珠宝首饰与品牌钟表', narration: '珠宝名表区汇集了品牌钟表馆和黄金珠宝馆，提供各类高端珠宝首饰和名表。', xFrac: 0.805, yFrac: 0.895, floor: '1F' },

  // ── B1 停车场 POI ──────────────────────────────────────────────────────────
  { id: 'poi-b1-entry-ramp', name: '入口坡道', description: 'B1 停车场入口', narration: '这里是 B1 停车场入口坡道，请减速慢行，注意行人安全。', xFrac: 0.88, yFrac: 0.04, floor: 'B1' },
  { id: 'poi-b1-exit-ramp', name: '出口坡道', description: 'B1 停车场出口', narration: '这里是 B1 停车场出口坡道，上坡请注意控制车速。', xFrac: 0.12, yFrac: 0.04, floor: 'B1' },
  { id: 'poi-b1-elevator-lobby', name: '电梯厅', description: 'B1 电梯厅入口', narration: 'B1 电梯厅可直达商场各楼层，乘坐电梯请排队等候，注意安全。', xFrac: 0.12, yFrac: 0.92, floor: 'B1' },
  { id: 'poi-b1-ev-charging', name: '新能源充电区', description: '电动汽车充电桩区域', narration: '新能源充电区配备多台快充充电桩，支持主流品牌电动汽车充电。', xFrac: 0.55, yFrac: 0.92, floor: 'B1' },
  { id: 'poi-b1-disabled-park', name: '无障碍车位区', description: '无障碍专用停车位', narration: '无障碍车位区设有加宽车位，方便行动不便人士停车，请勿占用。', xFrac: 0.30, yFrac: 0.92, floor: 'B1' },
  { id: 'poi-b1-fire-lane', name: '消防通道', description: '消防安全通道', narration: '这里是消防通道区域，请保持通道畅通，禁止停放任何车辆。', xFrac: 0.90, yFrac: 0.92, floor: 'B1' },
  { id: 'poi-b1-parking-a', name: '停车区 A', description: 'A 区停车位', narration: 'A 区停车位靠近入口，方便快速进出，适合短时停车。', xFrac: 0.13, yFrac: 0.20, floor: 'B1' },
  { id: 'poi-b1-parking-d', name: '停车区 D', description: 'D 区停车位', narration: 'D 区位于停车场中部，停车位充足，是主要停车区域之一。', xFrac: 0.38, yFrac: 0.20, floor: 'B1' },
  { id: 'poi-b1-parking-g', name: '停车区 G', description: 'G 区停车位', narration: 'G 区靠近商场电梯入口，方便快速上楼购物。', xFrac: 0.62, yFrac: 0.20, floor: 'B1' },
  // 机器人待机区（原停车区 J）
  { id: 'poi-b1-robot-standby', name: '机器人待机区', description: 'B1 导览机器人待机区', narration: '这里是 B1 导览机器人待机区，机器人可在此充电待机、等候导览任务。从此处出发可前往停车场各区域进行导览。', xFrac: 0.87, yFrac: 0.20, floor: 'B1' },
]
