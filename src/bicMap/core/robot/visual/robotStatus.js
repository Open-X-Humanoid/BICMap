import { addRobotMarkers } from '@/bicMap/core/markers/robo.js';

// ── 状态配置 ──────────────────────────────────────────────────────────────────

/** 机器人状态枚举 */
export const ROBOT_STATUS = {
  IDLE:      'idle',
  RUNNING:   'running',
  CHARGING:  'charging',
  ERROR:     'error',
  RETURNING: 'returning'
};

const STATUS_CONFIG = {
  idle:      { color: '#64748B', label: '待机' },
  running:   { color: '#0066FF', label: '执行中' },
  charging:  { color: '#F7A800', label: '充电' },
  error:     { color: '#FF3B30', label: '故障' },
  returning: { color: '#06B6D4', label: '召回中' }
};

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function getBatteryColor(pct) {
  if (pct >= 60) return '#1CD5A4';
  if (pct >= 20) return '#F7A800';
  return '#FF3B30';
}

function buildBatterySVG(pct) {
  const color  = getBatteryColor(pct);
  const filled = Math.round((pct / 100) * 4);
  let bars = '';
  for (let i = 0; i < 4; i++) {
    const fill = i < filled ? color : 'rgba(255,255,255,0.25)';
    bars += `<rect x="${2 + i * 4}" y="2" width="3" height="8" rx="0.5" fill="${fill}"/>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="12" viewBox="0 0 20 12">` +
    `<rect x="0" y="1" width="17" height="10" rx="1.5" stroke="${color}" stroke-width="1" fill="none"/>` +
    `<rect x="17" y="4" width="2" height="4" rx="0.5" fill="${color}"/>` +
    bars +
    `</svg>`
  );
}

/**
 * 构建状态气泡 DOM 元素
 * 独立于 robo.js 的 createLabelElement，采用相同的双行卡片风格，
 * 但主题色随状态变化，并在下行展示状态标签与电量。
 */
function buildStatusLabelEl(robot, opts) {
  const { showStatus, showBattery, GPSToCartesian } = opts;
  const cfg        = STATUS_CONFIG[robot.status] ?? STATUS_CONFIG.idle;
  const themeColor = cfg.color;

  // ── 外层容器 ──
  const wrap = document.createElement('div');
  wrap.className = 'bic-robot-label bic-robot-status-label';
  wrap.style.cssText = [
    'position:absolute',
    'pointer-events:none',
    'display:block',
    'text-align:center',
    'margin-top:-50px',
    'transform:translateX(-50%)',
    'z-index:2'
  ].join(';');

  const bubble = document.createElement('div');
  bubble.style.cssText = 'position:relative;padding:0;margin-bottom:7px;display:inline-block;';

  // ── 卡片 table ──
  const card = document.createElement('table');
  card.style.cssText = [
    'border-collapse:collapse',
    'border-radius:6px',
    'overflow:hidden',
    `border:1px solid ${themeColor}`,
    'min-width:120px',
    `box-shadow:0 1px 4px ${themeColor}33`,
    'width:100%',
    `background-color:${themeColor}`
  ].join(';');

  // ── 行 1：坐标 / 任务（白底） ──
  const r1 = document.createElement('tr');
  const c1 = document.createElement('td');
  c1.style.cssText = [
    'background-color:#FFFFFF',
    'padding:3px 8px',
    'height:18px',
    'text-align:center',
    'vertical-align:middle'
  ].join(';');

  let topText = '';
  if (GPSToCartesian) {
    const gps    = GPSToCartesian(robot.lngLat[0], robot.lngLat[1]);
    const rotate = (robot.rotation ?? 0).toFixed(1);
    topText = `${gps.x},${gps.y},${rotate}°`;
  } else if (robot.task) {
    topText = robot.task.length > 14 ? robot.task.slice(0, 14) + '…' : robot.task;
  } else {
    topText = `${robot.lngLat[0].toFixed(4)}, ${robot.lngLat[1].toFixed(4)}`;
  }
  c1.innerHTML = `<span style="color:${themeColor};font-size:10px;font-family:Harmony Regular,sans-serif;line-height:1;white-space:nowrap;letter-spacing:-0.2px;">${topText}</span>`;
  r1.appendChild(c1);
  card.appendChild(r1);

  // ── 行 2：名称 + 状态 + 电量（主题色底） ──
  const r2 = document.createElement('tr');
  const c2 = document.createElement('td');
  c2.style.cssText = [
    `background-color:${themeColor}`,
    'padding:3px 6px',
    'height:20px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:5px'
  ].join(';');

  const rawName     = robot.name || '未命名机器人';
  const displayName = rawName.length > 8 ? rawName.slice(0, 8) + '…' : rawName;

  let html = `<span style="color:#fff;font-size:12px;font-weight:bold;font-family:Harmony Regular,sans-serif;line-height:1;white-space:nowrap;">${displayName}</span>`;

  if (showStatus && robot.status && robot.status !== 'idle') {
    html += (
      `<span style="display:inline-flex;align-items:center;">` +
      `<span style="width:6px;height:6px;border-radius:50%;background:#fff;margin-right:2px;"></span>` +
      `<span style="color:#fff;font-size:9px;line-height:1;white-space:nowrap;">${cfg.label}</span>` +
      `</span>`
    );
  }

  if (showBattery && robot.battery != null) {
    html += `<span style="display:flex;align-items:center;">${buildBatterySVG(robot.battery)}</span>`;
  }

  c2.innerHTML = html;
  r2.appendChild(c2);
  card.appendChild(r2);

  bubble.appendChild(card);
  wrap.appendChild(bubble);
  return wrap;
}

// ── 主 API ────────────────────────────────────────────────────────────────────

/**
 * 添加带状态气泡与电量显示的机器人标记
 *
 * 本函数在 `addRobotMarkers` 之上叠加一套**完全独立**的状态 HTML overlay，
 * 不修改 robo.js 任何逻辑。MapLibre symbol 图层仍由底层 `addRobotMarkers` 管理；
 * 状态气泡由本模块自行创建、定位、销毁。
 *
 * 机器人数据字段（在原有 id/lngLat/rotation/name 基础上新增）：
 *   - status   {string}  'idle'|'running'|'charging'|'error'（默认 'idle'）
 *   - battery  {number}  0~100（不传则不显示电量栏）
 *   - task     {string}  任务描述（无 GPSToCartesian 时替代坐标显示）
 *
 * @param {Object} map     - 地图实例
 * @param {Array}  robots  - 机器人数组
 * @param {Object} options - 配置选项
 * @param {string}   [options.svgPath]          - 机器人图标路径（透传给 addRobotMarkers）
 * @param {number}   [options.size=30]          - 图标尺寸（透传给 addRobotMarkers）
 * @param {boolean}  [options.showLabels=true]  - 是否显示状态气泡
 * @param {boolean}  [options.showStatus=true]  - 气泡中是否显示状态标签
 * @param {boolean}  [options.showBattery=true] - 气泡中是否显示电量
 * @param {Function} [options.onClick]          - 点击机器人回调（透传给 addRobotMarkers）
 * @param {Function} [options.GPSToCartesian]   - 坐标转换函数（透传给 addRobotMarkers）
 * @returns {Object} 控制器（updateRobots / updateRobot / addRobot / removeRobot /
 *                           clearRobots / getRobots / toggleLabels / remove）
 */
export function addStatusRobotMarkers(map, robots = [], options = {}) {
  const {
    showLabels  = true,
    showStatus  = true,
    showBattery = true,
    GPSToCartesian = null,
    ...baseOptions
  } = options;

  // 调用 addRobotMarkers（showLabels 强制 false，由本层接管气泡）
  const base = addRobotMarkers(map, robots, {
    ...baseOptions,
    showLabels: false,
    GPSToCartesian
  });

  // ── 状态气泡管理 ──────────────────────────────────────────────────────────

  let currentRobots = [...robots];
  let statusLabels  = [];   // [{ el, robotIndex }]
  let labelsVisible = showLabels;

  const labelOpts = { showStatus, showBattery, GPSToCartesian };

  const updateLabelPos = (el, lngLat) => {
    const pos = map.project(lngLat);
    el.style.left = `${Math.round(pos.x)}px`;
    el.style.top  = `${Math.round(pos.y - 50)}px`;
  };

  const syncAllPositions = () => {
    if (!labelsVisible) return;
    statusLabels.forEach(({ el, robotIndex }) => {
      const r = currentRobots[robotIndex];
      if (r) updateLabelPos(el, r.lngLat);
    });
  };

  map.on('move', syncAllPositions);

  const clearStatusLabels = () => {
    statusLabels.forEach(({ el }) => el.parentNode?.removeChild(el));
    statusLabels = [];
  };

  const createStatusLabelForRobot = (robot, index) => {
    const el = buildStatusLabelEl(robot, labelOpts);
    el.id = `bic-robot-status-label-${index}`;
    map.getContainer().appendChild(el);
    statusLabels.push({ el, robotIndex: index });
    updateLabelPos(el, robot.lngLat);
  };

  const rebuildStatusLabels = () => {
    clearStatusLabels();
    if (!labelsVisible) return;
    currentRobots.forEach((r, i) => createStatusLabelForRobot(r, i));
  };

  if (labelsVisible) rebuildStatusLabels();

  // ── 公开方法 ──────────────────────────────────────────────────────────────

  /** 整体替换机器人数组 */
  const updateRobots = (newRobots = []) => {
    currentRobots = [...newRobots];
    base.updateRobots(newRobots);
    rebuildStatusLabels();
  };

  /** 更新单个机器人（可通过 index 或 id） */
  const updateRobot = (identifier, patch) => {
    const idx = typeof identifier === 'number'
      ? identifier
      : currentRobots.findIndex(r => r.id === identifier);
    if (idx < 0 || idx >= currentRobots.length) return false;

    currentRobots[idx] = { ...currentRobots[idx], ...patch };
    base.updateRobot(identifier, patch);

    if (labelsVisible) {
      const item = statusLabels.find(l => l.robotIndex === idx);
      // 仅位置/旋转变更时走快速路径：只移动 CSS，跳过 DOM 重建（高频调用关键优化）
      const onlyPosition = Object.keys(patch).every(k => k === 'lngLat' || k === 'rotation');
      if (onlyPosition && item?.el) {
        updateLabelPos(item.el, currentRobots[idx].lngLat);
      } else if (item?.el) {
        item.el.parentNode?.removeChild(item.el);
        statusLabels.splice(statusLabels.indexOf(item), 1);
        createStatusLabelForRobot(currentRobots[idx], idx);
      }
    }
    return true;
  };

  /** 追加一个机器人 */
  const addRobot = (robot) => {
    const newIdx = currentRobots.length;
    currentRobots.push(robot);
    base.addRobot(robot);
    if (labelsVisible) createStatusLabelForRobot(robot, newIdx);
    return newIdx;
  };

  /** 删除一个机器人 */
  const removeRobot = (identifier) => {
    const idx = typeof identifier === 'number'
      ? identifier
      : currentRobots.findIndex(r => r.id === identifier);
    if (idx < 0 || idx >= currentRobots.length) return false;

    currentRobots.splice(idx, 1);
    base.removeRobot(identifier);

    // 移除对应 label，更新后续索引
    const item = statusLabels.find(l => l.robotIndex === idx);
    if (item?.el) {
      item.el.parentNode?.removeChild(item.el);
      statusLabels.splice(statusLabels.indexOf(item), 1);
    }
    statusLabels.forEach(l => { if (l.robotIndex > idx) l.robotIndex--; });
    return true;
  };

  /** 清空所有机器人 */
  const clearRobots = () => {
    currentRobots = [];
    base.clearRobots();
    clearStatusLabels();
  };

  /** 获取所有机器人数据（只读副本） */
  const getRobots = () => [...currentRobots];

  /** 显示/隐藏状态气泡 */
  const toggleLabels = (show) => {
    labelsVisible = show !== undefined ? show : !labelsVisible;
    if (labelsVisible) {
      rebuildStatusLabels();
    } else {
      clearStatusLabels();
    }
    return labelsVisible;
  };

  /** 销毁全部资源 */
  const remove = () => {
    map.off('move', syncAllPositions);
    clearStatusLabels();
    base.remove();
  };

  return {
    updateRobots,
    updateRobot,
    addRobot,
    removeRobot,
    clearRobots,
    getRobots,
    toggleLabels,
    remove
  };
}
