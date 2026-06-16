
/**
 * IoT 事件类型及其对应的默认样式
 * 消费方可直接使用这些常量传入 emit / update
 */
export const IOT_EVENT_TYPE = {
  ELEVATOR_CALL:    'elevator_call',     // 呼梯中
  ELEVATOR_ARRIVED: 'elevator_arrived',  // 电梯已到达
  ELEVATOR_OPEN:    'elevator_open',     // 电梯门开
  ELEVATOR_CLOSE:   'elevator_close',   // 电梯门关
  DOOR_OPEN:        'door_open',         // 房间门开
  DOOR_CLOSE:       'door_close',        // 房间门关
  DELIVERY_ARRIVED: 'delivery_arrived',  // 配送到达
  CUSTOM:           'custom'             // 自定义消息
};

const EVENT_STYLE = {
  [IOT_EVENT_TYPE.ELEVATOR_CALL]:    { icon: '🛗', color: '#0066FF', label: '呼梯中' },
  [IOT_EVENT_TYPE.ELEVATOR_ARRIVED]: { icon: '✅', color: '#1CD5A4', label: '电梯已到' },
  [IOT_EVENT_TYPE.ELEVATOR_OPEN]:    { icon: '🚪', color: '#34C759', label: '梯门已开' },
  [IOT_EVENT_TYPE.ELEVATOR_CLOSE]:   { icon: '🚪', color: '#8E8E93', label: '梯门关闭' },
  [IOT_EVENT_TYPE.DOOR_OPEN]:        { icon: '🔓', color: '#34C759', label: '门已开启' },
  [IOT_EVENT_TYPE.DOOR_CLOSE]:       { icon: '🔒', color: '#8E8E93', label: '门已关闭' },
  [IOT_EVENT_TYPE.DELIVERY_ARRIVED]: { icon: '📦', color: '#F7A800', label: '配送到达' },
  [IOT_EVENT_TYPE.CUSTOM]:           { icon: 'ℹ️', color: '#0066FF', label: '消息' }
};

/**
 * 创建 IoT 事件气泡管理器
 *
 * 用于在地图上指定位置显示设备状态弹出通知（电梯、门禁等）。
 * 气泡可自动消失，也可常驻；支持多点位同时显示。
 *
 * @param {Object} map     - 地图实例
 * @param {Object} options - 全局配置
 * @param {number}  [options.defaultDuration=4000]  - 默认显示时长（ms），0 = 常驻
 * @param {number}  [options.maxBubbles=20]          - 最大同时显示气泡数
 * @param {boolean} [options.showIcon=true]          - 是否显示事件图标
 * @returns {Object} IoT 气泡控制器（emit / update / clear / remove）
 */
export function createIoTBubbles(map, options = {}) {
  if (!map) {
    throw new Error('地图未初始化。');
  }

  const {
    defaultDuration = 4000,
    maxBubbles      = 20,
    showIcon        = true
  } = options;

  // 气泡注册表：id → { el, timer, lngLat }
  const bubbles = new Map();

  // 注入气泡 CSS（全局只注一次）
  const STYLE_ID = 'bic-iot-bubble-styles';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .bic-iot-bubble {
        position: absolute;
        pointer-events: none;
        transform: translateX(-50%) translateY(-100%);
        z-index: 10;
        animation: bic-iot-fadein 0.2s ease-out;
      }
      @keyframes bic-iot-fadein {
        from { opacity: 0; transform: translateX(-50%) translateY(-110%); }
        to   { opacity: 1; transform: translateX(-50%) translateY(-100%); }
      }
      .bic-iot-bubble.bic-iot-fadeout {
        animation: bic-iot-fadeout 0.3s ease-in forwards;
      }
      @keyframes bic-iot-fadeout {
        from { opacity: 1; }
        to   { opacity: 0; transform: translateX(-50%) translateY(-115%); }
      }
      .bic-iot-bubble-card {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        white-space: nowrap;
        font-family: 'Harmony Regular', sans-serif;
        font-size: 12px;
        color: #fff;
        margin-bottom: 6px;
      }
      .bic-iot-bubble-arrow {
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        margin: 0 auto;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 创建气泡 DOM 元素
   * @param {string} type
   * @param {string} message
   * @param {string} deviceName
   * @returns {HTMLElement}
   */
  const buildBubbleEl = (type, message, deviceName) => {
    const styleCfg = EVENT_STYLE[type] ?? EVENT_STYLE[IOT_EVENT_TYPE.CUSTOM];
    const { icon, color, label } = styleCfg;

    const wrapper = document.createElement('div');
    wrapper.className = 'bic-iot-bubble';

    const card = document.createElement('div');
    card.className = 'bic-iot-bubble-card';
    card.style.backgroundColor = color;

    if (showIcon) {
      const iconSpan = document.createElement('span');
      iconSpan.style.fontSize = '14px';
      iconSpan.textContent = icon;
      card.appendChild(iconSpan);
    }

    const textDiv = document.createElement('div');
    const title = deviceName ? `${deviceName} · ${label}` : label;
    const body  = message ?? title;

    textDiv.innerHTML = `<div style="font-weight:bold;line-height:1.2;">${deviceName ? deviceName : label}</div>`
      + (message ? `<div style="font-size:10px;opacity:0.9;margin-top:1px;">${message}</div>` : '');
    card.appendChild(textDiv);

    // 指向图标的小箭头
    const arrow = document.createElement('div');
    arrow.className = 'bic-iot-bubble-arrow';
    arrow.style.borderTop = `6px solid ${color}`;

    wrapper.appendChild(card);
    wrapper.appendChild(arrow);

    return wrapper;
  };

  /** 更新气泡位置（地图 move 时调用） */
  const syncBubblePosition = (id, el, lngLat) => {
    const pos = map.project(lngLat);
    el.style.left = `${pos.x}px`;
    el.style.top  = `${pos.y}px`;
  };

  const moveHandlers = new Map();

  /**
   * 发布 IoT 事件气泡
   *
   * @param {Object} event
   * @param {string}   event.id         - 设备或事件唯一 ID（相同 id 的气泡会替换旧的）
   * @param {Array}    event.lngLat     - 地图坐标 [lng, lat]
   * @param {string}   event.type       - 事件类型，见 IOT_EVENT_TYPE
   * @param {string}   [event.message]  - 自定义消息文字
   * @param {string}   [event.deviceName] - 设备名称（如房间号）
   * @param {number}   [event.duration]  - 显示时长（ms），0 = 常驻，不传使用全局默认值
   */
  const emit = (event) => {
    const { id, lngLat, type = IOT_EVENT_TYPE.CUSTOM, message, deviceName, duration } = event;
    if (!id || !lngLat) {
      console.warn('[IoTBubbles] emit: id 和 lngLat 为必填项');
      return;
    }

    // 替换已存在的同 id 气泡
    if (bubbles.has(id)) {
      _removeBubble(id, false);
    }

    // 超出最大数量时移除最旧的
    if (bubbles.size >= maxBubbles) {
      const oldestId = bubbles.keys().next().value;
      _removeBubble(oldestId, false);
    }

    const el = buildBubbleEl(type, message, deviceName);
    map.getContainer().appendChild(el);

    // 同步初始位置
    syncBubblePosition(id, el, lngLat);

    // 跟随地图平移
    const moveHandler = () => syncBubblePosition(id, el, lngLat);
    map.on('move', moveHandler);
    moveHandlers.set(id, moveHandler);

    // 自动消失
    const dur = duration !== undefined ? duration : defaultDuration;
    let timer = null;
    if (dur > 0) {
      timer = setTimeout(() => _removeBubble(id, true), dur);
    }

    bubbles.set(id, { el, timer, lngLat });
  };

  /**
   * 更新已有气泡内容（替换为同 id 的新事件）
   * 若气泡不存在则创建
   */
  const update = (event) => {
    emit(event);
  };

  /**
   * 内部移除单个气泡
   * @param {string}  id
   * @param {boolean} animate - 是否播放淡出动画
   */
  const _removeBubble = (id, animate = true) => {
    const entry = bubbles.get(id);
    if (!entry) return;

    clearTimeout(entry.timer);

    const moveHandler = moveHandlers.get(id);
    if (moveHandler) {
      map.off('move', moveHandler);
      moveHandlers.delete(id);
    }

    if (animate) {
      entry.el.classList.add('bic-iot-fadeout');
      entry.el.addEventListener('animationend', () => entry.el.remove(), { once: true });
    } else {
      entry.el.remove();
    }

    bubbles.delete(id);
  };

  /**
   * 手动关闭指定气泡
   * @param {string} id
   */
  const dismiss = (id) => _removeBubble(id, true);

  /** 清空所有气泡 */
  const clear = () => {
    [...bubbles.keys()].forEach(id => _removeBubble(id, false));
  };

  /** 销毁管理器（清除所有气泡并移除样式） */
  const remove = () => {
    clear();
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
  };

  return { emit, update, dismiss, clear, remove };
}
