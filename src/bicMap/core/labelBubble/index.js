/**
 * createLabelBubble
 * ─────────────────────────────────────────────────────────────────────────────
 * 基于 maplibregl.Marker 的自定义 HTML 气泡标注。
 * 调用方可传入任意 HTML 字符串或 DOM 元素，气泡会自动跟随地图坐标
 * （平移 / 缩放 / 旋转均实时同步），无需外部做坐标转换。
 *
 * 设计原则
 *  - 本模块不注入任何全局 CSS，样式完全由调用方通过 HTML/element 控制。
 *  - 返回的控制器是幂等且可安全调用多次的（hide 后可再 show）。
 *  - remove() 之后实例作废，不应再被调用。
 *
 * @param {import('maplibre-gl')} maplibregl  - maplibregl 命名空间
 * @param {import('maplibre-gl').Map} map     - 已初始化的地图实例
 * @param {Object} [options]
 * @param {'bottom'|'top'|'left'|'right'|'center'|
 *         'top-left'|'top-right'|'bottom-left'|'bottom-right'} [options.anchor='bottom']
 *   Marker 锚点位置，决定 HTML 元素的哪一侧对齐到地理坐标点
 * @param {[number, number]} [options.offset=[0, 0]]
 *   像素偏移 [x, y]（正 x 向右，正 y 向下）
 * @param {string} [options.className='']
 *   附加在 wrapper 上的自定义 CSS class
 * @returns {{
 *   show(lngLat: [number, number], htmlOrElement?: string | HTMLElement): void,
 *   hide(): void,
 *   setLngLat(lngLat: [number, number]): void,
 *   setHTML(html: string): void,
 *   setElement(el: HTMLElement): void,
 *   getElement(): HTMLElement,
 *   setOffset(offset: [number, number]): void,
 *   remove(): void
 * }}
 */
export function createLabelBubble(maplibregl, map, options = {}) {
  const {
    anchor = 'bottom',
    offset = [0, 0],
    className = '',
  } = options;

  // wrapper 是真正传给 Marker 的 DOM 节点，调用方的内容挂在其内部
  const wrapper = document.createElement('div');
  wrapper.style.pointerEvents = 'none';
  if (className) wrapper.className = className;

  let marker = null;
  let currentLngLat = null;
  let currentAnchor = anchor;
  let currentOffset = offset;
  let destroyed = false;

  function assertNotDestroyed() {
    if (destroyed) throw new Error('[labelBubble] 实例已销毁，请重新创建。');
  }

  /**
   * 懒创建 Marker（第一次 show 时才实例化）
   */
  function getOrCreateMarker() {
    if (!marker) {
      marker = new maplibregl.Marker({
        element: wrapper,
        anchor: currentAnchor,
        offset: currentOffset,
      });
    }
    return marker;
  }

  return {
    /**
     * 在指定坐标处显示气泡，可选地更新内容。
     * 重复调用 show() 会移动气泡并可选地刷新内容。
     *
     * @param {[number, number]} lngLat
     * @param {string | HTMLElement} [htmlOrElement]
     */
    show(lngLat, htmlOrElement) {
      assertNotDestroyed();
      currentLngLat = lngLat;

      if (htmlOrElement !== undefined) {
        if (typeof htmlOrElement === 'string') {
          wrapper.innerHTML = htmlOrElement;
        } else if (htmlOrElement instanceof HTMLElement) {
          wrapper.innerHTML = '';
          wrapper.appendChild(htmlOrElement);
        }
      }

      getOrCreateMarker().setLngLat(lngLat).addTo(map);
    },

    /**
     * 隐藏气泡（从地图移除 DOM，但保留内容状态，可再次 show）
     */
    hide() {
      if (destroyed) return;
      marker?.remove();
    },

    /**
     * 更新气泡的地理坐标（气泡必须已显示）
     * @param {[number, number]} lngLat
     */
    setLngLat(lngLat) {
      assertNotDestroyed();
      currentLngLat = lngLat;
      marker?.setLngLat(lngLat);
    },

    /**
     * 以 HTML 字符串更新气泡内容
     * @param {string} html
     */
    setHTML(html) {
      assertNotDestroyed();
      wrapper.innerHTML = html;
    },

    /**
     * 以 DOM 元素替换气泡内容
     * @param {HTMLElement} el
     */
    setElement(el) {
      assertNotDestroyed();
      wrapper.innerHTML = '';
      wrapper.appendChild(el);
    },

    /**
     * 获取 wrapper 元素，供调用方直接操作 DOM（如动画、事件绑定）
     * @returns {HTMLElement}
     */
    getElement() {
      return wrapper;
    },

    /**
     * 更新像素偏移。
     * Marker 不支持运行时 setOffset，此方法会重建 Marker 并保持位置。
     * @param {[number, number]} newOffset
     */
    setOffset(newOffset) {
      assertNotDestroyed();
      currentOffset = newOffset;
      if (marker) {
        const wasOnMap = currentLngLat !== null;
        marker.remove();
        marker = new maplibregl.Marker({
          element: wrapper,
          anchor: currentAnchor,
          offset: newOffset,
        });
        if (wasOnMap) {
          marker.setLngLat(currentLngLat).addTo(map);
        }
      }
    },

    /**
     * 永久销毁气泡，释放资源。调用后实例不可再用。
     */
    remove() {
      if (destroyed) return;
      destroyed = true;
      marker?.remove();
      marker = null;
      wrapper.innerHTML = '';
      currentLngLat = null;
    },
  };
}
