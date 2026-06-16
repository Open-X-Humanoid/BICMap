/**
 * 检测是否为右键点击
 * @param {Object} opt - Fabric.js 事件对象
 * @param {Object} opt.e - 原生鼠标事件对象
 * @returns {boolean} 是否为右键点击
 */
function isRightClick(opt) {
  if (!opt || !opt.e) {
    return false;
  }

  const e = opt.e;

  // 在 Fabric.js 6.x 中，多种方法检测右键点击
  return (
    e.button === 2 || // 标准的右键值 (MouseEvent.button)
    e.which === 3 || // 某些浏览器中的右键值 (deprecated but still used)
    opt.button === 3 || // Fabric 可能映射的值
    e.buttons === 2 // 按钮状态检测 (MouseEvent.buttons)
  );
}

/**
 * 检测是否为左键点击
 * @param {Object} opt - Fabric.js 事件对象
 * @returns {boolean} 是否为左键点击
 */
function isLeftClick(opt) {
  if (!opt || !opt.e) {
    return false;
  }

  const e = opt.e;

  return (
    e.button === 0 || // 标准的左键值
    e.which === 1 || // 某些浏览器中的左键值
    opt.button === 1 || // Fabric 可能映射的值
    e.buttons === 1 // 按钮状态检测
  );
}

/**
 * 检测是否为中键点击
 * @param {Object} opt - Fabric.js 事件对象
 * @returns {boolean} 是否为中键点击
 */
function isMiddleClick(opt) {
  if (!opt || !opt.e) {
    return false;
  }

  const e = opt.e;

  return (
    e.button === 1 || // 标准的中键值
    e.which === 2 || // 某些浏览器中的中键值
    opt.button === 2 || // Fabric 可能映射的值
    e.buttons === 4 // 按钮状态检测
  );
}

export { isRightClick, isLeftClick, isMiddleClick };
