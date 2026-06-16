# Fabric.js 6.7 鼠标事件检测指南

## 概述

在 Fabric.js 6.7 版本中，鼠标按键检测需要考虑不同浏览器的兼容性。我们提供了一套工具函数来统一处理鼠标事件检测。

## 鼠标按键值对照表

### MouseEvent.button 属性
- `0`: 左键 (主要按钮)
- `1`: 中键 (辅助按钮，通常是滚轮)
- `2`: 右键 (次要按钮)

### MouseEvent.which 属性 (已废弃但仍被使用)
- `1`: 左键
- `2`: 中键
- `3`: 右键

### MouseEvent.buttons 属性 (位掩码)
- `1`: 左键被按下
- `2`: 右键被按下
- `4`: 中键被按下

## 工具函数使用

### 检测右键点击

```javascript
canvas.on("mouse:down", (opt) => {
  if (isRightClick(opt)) {
    console.log("右键点击");
    // 执行右键相关逻辑
    opt.e.preventDefault(); // 阻止默认右键菜单
  }
});
```

### 检测左键点击

```javascript
canvas.on("mouse:down", (opt) => {
  if (isLeftClick(opt)) {
    console.log("左键点击");
    // 执行左键相关逻辑
  }
});
```

### 检测中键点击

```javascript
canvas.on("mouse:down", (opt) => {
  if (isMiddleClick(opt)) {
    console.log("中键点击");
    // 执行中键相关逻辑（如拖拽）
  }
});
```

## 实际应用示例

### 右键菜单

```javascript
canvas.on("mouse:down", (opt) => {
  if (isRightClick(opt)) {
    opt.e.preventDefault(); // 阻止浏览器默认右键菜单
    showCustomContextMenu(opt);
  }
});
```

### 拖拽功能

```javascript
canvas.on("mouse:down", (opt) => {
  const evt = opt.e;
  // Alt + 左键 或 中键点击开始拖拽
  if ((evt.altKey && isLeftClick(opt)) || isMiddleClick(opt)) {
    startDragging(opt);
  }
});
```

## 兼容性说明

- 工具函数已经处理了不同浏览器的兼容性问题
- 支持 Chrome、Firefox、Safari、Edge 等主流浏览器
- 自动处理 `button`、`which`、`buttons` 属性的差异

## 注意事项

1. **事件阻止**: 右键点击时记得调用 `opt.e.preventDefault()` 来阻止默认右键菜单
2. **事件冒泡**: 必要时使用 `opt.e.stopPropagation()` 来阻止事件冒泡
3. **多按键**: 同时按下多个鼠标按键时，`buttons` 属性会是多个值的组合

## 最佳实践

1. 统一使用工具函数而不是直接检测原生事件属性
2. 在组件初始化时导入需要的工具函数
3. 为不同的鼠标按键提供不同的功能，提升用户体验
