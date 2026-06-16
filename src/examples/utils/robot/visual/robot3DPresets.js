/*
 * @Author: kai.lee@x-humanoid.com
 * @Date: 2026-06-02 11:30:23
 * @LastEditTime: 2026-06-09 11:26:00
 * @LastEditors: kai.lee@x-humanoid.com
 * @Description: 3D 机器人模型预设（通用默认预设，场景专属配置请在各自 constants.js 中定义）
 * @FilePath: /bic-map-plugin/src/examples/utils/robot/visual/robot3DPresets.js
 * Copyright (c) 2024 kai.lee@x-humanoid.com, All Rights Reserved.
 */

/*
 * 「换模型」只需：
 *   1. 把新 .glb 放到 public/bicMap/assets/models/
 *   2. 修改 url 和 animations 里的动画名称（来自 GLB 文件内的 AnimationClip.name）
 *   3. 按需调整 scale / rotateX 等变换参数
 *
 * 自定义示例：
 *   export const MY_ROBOT_CONFIG = {
 *     ...ROBOT_EXPRESSIVE_CONFIG,
 *     url: '/bicMap/assets/models/my-robot.glb',
 *     animations: { walk: 'Walk_Cycle', idle: 'Idle_Breathe' },
 *   }
 */

/**
 * Three.js 官方 RobotExpressive 模型配置
 *
 * 模型下载地址：
 *   https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive
 *
 * GLB 内置动画（AnimationClip.name）：
 *   Idle | Walking | Running | Dance | Death | Sitting | Standing | Wave | Punch | ThumbsUp
 *
 * 文件放置路径：public/bicMap/assets/models/RobotExpressive.glb
 */
export const ROBOT_EXPRESSIVE_CONFIG = {
  url: '/bicMap/assets/models/RobotExpressive.glb',

  // 模型原始单位是「任意单位」，需要缩放到真实米尺度
  // RobotExpressive 原始高度约 1.8 单位 → scale=1 约等于 1.8 米
  scale: 3,

  // Mercator 坐标系下，每米对应多少 Mercator 单位（由图层运行时计算，此处为乘数）
  // 若机器人看起来太大/太小，调整此值（建议范围 0.1 ~ 5）
  metersScale: 1,

  // RobotExpressive 是 Y-up，MapLibre Mercator 也是 Y-up（向屏幕下为正）
  // 需旋转 π/2（X轴）让模型「站」在地图平面上
  rotateX: Math.PI / 2,
  rotateY: 0,
  rotateZ: 0,

  // key → GLB 内动画名（完整字符串，区分大小写）
  animations: {
    idle:  'Idle',       // 待机，轻微呼吸
    walk:  'Walking',    // 行走循环
    dwell: 'Standing',   // 到达 POI 后原地站立
    run:   'Running',    // 可选：快速移动时使用
    wave:  'Wave',       // 可选：打招呼
  },

  // 机器人进入场景时的默认动画
  defaultAnimation: 'walk',
}
