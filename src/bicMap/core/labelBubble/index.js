/**
 * createLabelBubble
 * ─────────────────────────────────────────────────────────────────────────────
 * 基于 map.project() + render 事件的自定义 HTML 气泡标注。
 *
 * 定位原理
 *  ┌────────────────────────────────────────────┐
 *  │  每一帧：                                   │
 *  │  pt = map.project(lngLat)                  │
 *  │  bubble 底部中心 → (pt.x + dx, pt.y + dy)  │
 *  └────────────────────────────────────────────┘
 *
 *  使用 CSS calc(Xpx - 50%) / calc(Ypx - 100%) 实现"底部居中"锚定，
 *  无需测量元素尺寸，且在任意 zoom / pitch / bearing 下均能精确跟随。
 *
 * 与 maplibregl.Marker 的关键区别
 *  - Marker 的 offset 是固定像素，放大时 3D 模型变高但偏移不变 → 气泡会
 *    嵌入模型内部；本模块的 screenOffset 在屏幕空间始终恒定。
 *  - 不依赖 window.maplibregl，直接使用传入的 map 实例。
 *
 * @param {import('maplibre-gl')} _maplibregl  - 保留参数（接口一致性），实际未使用
 * @param {import('maplibre-gl').Map} map      - 已初始化的地图实例
 * @param {Object} [options]
 * @param {[number, number]} [options.screenOffset=[0, 0]]
 *   [dx, dy] 像素偏移。正 x 向右，正 y 向下。
 *   bubble 底部中心 = 投影点 + (dx, dy)。
 *   典型用法：[0, -80] 表示气泡底部在投影点上方 80px。
 * @param {string} [options.className='']
 *   附加在容器元素上的自定义 CSS class
 * @returns {{
 *   show(lngLat: [number, number], htmlOrElement?: string | HTMLElement): void,
 *   hide(): void,
 *   setLngLat(lngLat: [number, number]): void,
 *   setHTML(html: string): void,
 *   setElement(el: HTMLElement): void,
 *   getElement(): HTMLElement,
 *   setScreenOffset(offset: [number, number]): void,
 *   remove(): void
 * }}
 */
export function createLabelBubble(_maplibregl, map, options = {}) {
  const {
    screenOffset = [0, 0],
    className = '',
  } = options;

  // 可变的当前偏移（setScreenOffset 时修改）
  let dx = screenOffset[0];
  let dy = screenOffset[1];

  // wrapper 直接挂到 map 容器里，与 MapLibre Marker 层级一致
  const mapContainer = map.getContainer();
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none;';
  if (className) wrapper.className = className;
  mapContainer.appendChild(wrapper);

  let currentLngLat = null;
  let visible = false;
  let destroyed = false;

  /**
   * 每帧同步屏幕坐标
   * 用 calc(Xpx - 50%) 和 calc(Ypx - 100%) 实现"底部居中"锚定，
   * 避免依赖运行时的 offsetWidth / offsetHeight。
   */
  function syncPosition() {
    if (!visible || !currentLngLat || destroyed) return;
    const pt = map.project(currentLngLat);
    const x = Math.round(pt.x + dx);
    const y = Math.round(pt.y + dy);
    // translate(calc(Xpx - 50%), calc(Ypx - 100%))
    //   → 元素底部中心 对齐到屏幕点 (x, y)
    wrapper.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 100%))`;
  }

  // 注册到 map render 事件，每帧自动更新
  map.on('render', syncPosition);

  function assertAlive() {
    if (destroyed) throw new Error('[labelBubble] 实例已销毁，请重新创建。');
  }

  function setContent(htmlOrElement) {
    if (htmlOrElement === undefined) return;
    if (typeof htmlOrElement === 'string') {
      wrapper.innerHTML = htmlOrElement;
    } else if (htmlOrElement instanceof HTMLElement) {
      wrapper.innerHTML = '';
      wrapper.appendChild(htmlOrElement);
    }
  }

  return {
    /**
     * 在指定地理坐标处显示气泡，可选地更新内容。
     * 重复调用会移动气泡并可选地刷新内容。
     * @param {[number, number]} lngLat
     * @param {string | HTMLElement} [htmlOrElement]
     */
    show(lngLat, htmlOrElement) {
      assertAlive();
      currentLngLat = lngLat;
      setContent(htmlOrElement);
      visible = true;
      wrapper.style.display = '';
      syncPosition();
    },

    /**
     * 隐藏气泡（保留内容状态，可再次 show）
     */
    hide() {
      if (destroyed) return;
      visible = false;
      wrapper.style.display = 'none';
    },

    /**
     * 更新跟踪的地理坐标
     * @param {[number, number]} lngLat
     */
    setLngLat(lngLat) {
      assertAlive();
      currentLngLat = lngLat;
      syncPosition();
    },

    /**
     * 以 HTML 字符串更新气泡内容
     * @param {string} html
     */
    setHTML(html) {
      assertAlive();
      wrapper.innerHTML = html;
    },

    /**
     * 以 DOM 元素替换气泡内容
     * @param {HTMLElement} el
     */
    setElement(el) {
      assertAlive();
      wrapper.innerHTML = '';
      wrapper.appendChild(el);
    },

    /**
     * 获取 wrapper 元素，供直接操作 DOM（动画、事件等）
     * @returns {HTMLElement}
     */
    getElement() {
      return wrapper;
    },

    /**
     * 运行时更新屏幕空间偏移
     * @param {[number, number]} offset [dx, dy]
     */
    setScreenOffset(offset) {
      assertAlive();
      dx = offset[0];
      dy = offset[1];
      syncPosition();
    },

    /**
     * 永久销毁，释放所有资源
     */
    remove() {
      if (destroyed) return;
      destroyed = true;
      map.off('render', syncPosition);
      wrapper.remove();
      currentLngLat = null;
    },
  };
}
