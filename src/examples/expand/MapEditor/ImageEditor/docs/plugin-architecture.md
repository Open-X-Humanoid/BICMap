# 图片编辑器插件架构设计指南

## 概述

本图片编辑器基于 Fabric.js 6.7 构建，采用插件化架构设计，通过核心的 Editor 类管理所有插件，提供了灵活、可扩展的编辑功能模块化解决方案。

## 核心架构

### Editor 核心类

Editor 类是整个插件系统的核心，继承自 EventEmitter，提供以下核心功能：

- **插件管理**: 注册、初始化、销毁插件
- **API 代理**: 自动代理插件的 API 方法到 Editor 实例
- **事件绑定**: 统一管理插件的事件监听
- **生命周期**: 提供插件生命周期钩子函数
- **快捷键**: 集成 hotkeys-js 提供全局快捷键支持
- **右键菜单**: 统一管理插件的右键菜单项

```javascript
// 基本使用
const editor = new Editor();
editor.init(fabricCanvas);

// 注册插件
editor.use(WorkspacePlugin, options);
editor.use(DrawPlugin);
editor.use(DeletePlugin);
```

## 插件设计规范

### 插件类结构

每个插件都应该遵循以下标准结构：

```javascript
class YourPlugin {
  // 必需：插件唯一标识符
  static pluginName = "YourPlugin";
  
  // 可选：导出的API方法列表
  static apis = ["method1", "method2"];
  
  // 可选：自定义事件列表
  static events = ["customEvent"];
  
  // 可选：快捷键绑定
  hotkeys = ["ctrl+z", "backspace"];
  
  constructor(canvas, editor, options) {
    this.canvas = canvas;
    this.editor = editor;
    this.options = options;
  }
  
  // 可选：插件初始化
  init() {
    // 初始化逻辑
  }
  
  // 可选：快捷键事件处理
  hotkeyEvent(keyName, e) {
    // 快捷键处理逻辑
  }
  
  // 可选：右键菜单项
  contextMenu() {
    return [
      {
        text: "菜单项",
        hotkey: "Ctrl+Z",
        disabled: false,
        onclick: () => this.handleClick()
      }
    ];
  }
  
  // 可选：插件销毁
  destroy() {
    // 清理逻辑
  }
}
```

### 生命周期钩子

Editor 提供以下生命周期钩子，插件可以选择性实现：

- `hookImportBefore`: 导入前钩子
- `hookImportAfter`: 导入后钩子
- `hookSaveBefore`: 保存前钩子
- `hookSaveAfter`: 保存后钩子
- `hookTransform`: 变换钩子

```javascript
class YourPlugin {
  // 实现生命周期钩子
  hookSaveBefore(data) {
    // 保存前处理
    return Promise.resolve(data);
  }
}
```

## 内置插件介绍

### 1. WorkspacePlugin - 工作区插件

**功能**: 管理画布工作区尺寸、缩放、背景图片等核心功能

**主要API**:
- `big()`: 放大画布
- `small()`: 缩小画布
- `defaultZoom()`: 恢复默认缩放
- `resetCanvas()`: 重置画布
- `exportImage()`: 导出图片

**特性**:
- 支持鼠标滚轮缩放
- 自动背景图片加载
- 缩放边界限制
- 拖拽边界计算

### 2. DrawPlugin - 绘制插件

**功能**: 提供各种绘制工具，包括铅笔、橡皮擦等

**主要API**:
- `setLineType(type)`: 设置绘制工具类型
- `setPencilDrawColor(color)`: 设置铅笔颜色
- `setPencilDrawWidth(width)`: 设置铅笔宽度
- `bindPencilDraw()`: 绑定铅笔绘制
- `bindEraserDraw()`: 绑定橡皮擦绘制

**支持的绘制类型**:
- 自由绘制
- 直线绘制
- 橡皮擦

### 3. DeletePlugin - 删除插件

**功能**: 删除选中的图形元素

**主要API**:
- `del()`: 删除选中元素

**快捷键**: `Backspace`

**右键菜单**: 提供"删除"选项

### 4. DragPlugin - 拖拽插件

**功能**: 提供画布拖拽移动功能

**特性**:
- 左键拖拽
- 边界限制

### 5. StraightLinePlugin - 直线插件

**功能**: 绘制直线工具

**主要API**:
- `startStraightLine()`: 开始直线绘制
- `endStraightLine()`: 结束直线绘制

### 6. FreeDrawPlugin - 自由绘制插件

**功能**: 自由绘制功能

**特性**:
- 支持自定义画笔
- 可调节线条粗细和颜色

## 插件开发指南

### 1. 创建新插件

```javascript
class MyCustomPlugin {
  static pluginName = "MyCustomPlugin";
  static apis = ["myMethod"];
  
  constructor(canvas, editor, options) {
    this.canvas = canvas;
    this.editor = editor;
    this.options = options;
    this.init();
  }
  
  init() {
    // 初始化插件
    this.bindEvents();
  }
  
  bindEvents() {
    this.canvas.on('mouse:down', this.handleMouseDown.bind(this));
  }
  
  handleMouseDown(opt) {
    // 处理鼠标点击
  }
  
  myMethod() {
    // 自定义方法
    return "Hello from plugin";
  }
  
  destroy() {
    // 清理事件监听器
    this.canvas.off('mouse:down', this.handleMouseDown);
  }
}

export default MyCustomPlugin;
```

### 2. 注册插件

```javascript
import MyCustomPlugin from './plugins/MyCustomPlugin';

// 在Editor初始化后注册
editor.use(MyCustomPlugin, { 
  customOption: "value" 
});

// 调用插件API
editor.myMethod(); // "Hello from plugin"
```

### 3. 插件间通信

```javascript
class PluginA {
  someMethod() {
    // 通过editor获取其他插件
    const pluginB = this.editor.getPlugin('PluginB');
    if (pluginB) {
      pluginB.otherMethod();
    }
    
    // 通过事件通信
    this.editor.emit('custom-event', data);
  }
}

class PluginB {
  constructor(canvas, editor) {
    this.canvas = canvas;
    this.editor = editor;
    
    // 监听其他插件事件
    this.editor.on('custom-event', this.handleCustomEvent.bind(this));
  }
  
  handleCustomEvent(data) {
    // 处理事件
  }
}
```

## 最佳实践

### 1. 插件命名规范

- 使用 PascalCase 命名插件类
- 插件名称应该描述功能，如 `DrawPlugin`、`WorkspacePlugin`
- 避免名称冲突，使用唯一的 `pluginName`

### 2. API 设计原则

- API 方法名称应该语义化
- 提供合理的默认参数
- 返回有意义的数据
- 考虑链式调用

### 3. 事件处理

- 正确绑定和解绑事件监听器
- 在 `destroy` 方法中清理所有事件
- 避免内存泄漏

### 4. 错误处理

```javascript
class SafePlugin {
  myMethod() {
    try {
      // 可能出错的操作
      this.riskyOperation();
    } catch (error) {
      console.error('Plugin error:', error);
      // 提供降级方案
      this.fallbackMethod();
    }
  }
}
```

### 5. 性能优化

- 使用节流(throttle)和防抖(debounce)优化频繁操作
- 避免在渲染循环中执行重度计算
- 合理使用缓存

```javascript
import { throttle } from 'lodash';

class OptimizedPlugin {
  constructor(canvas, editor) {
    this.canvas = canvas;
    this.editor = editor;
    
    // 节流处理鼠标移动
    this.throttledMouseMove = throttle(this.handleMouseMove.bind(this), 16);
    this.canvas.on('mouse:move', this.throttledMouseMove);
  }
  
  handleMouseMove(opt) {
    // 处理鼠标移动
  }
}
```



## 总结

本插件架构设计提供了：

1. **高内聚低耦合**: 每个插件专注单一功能
2. **易于扩展**: 标准化的插件接口
3. **统一管理**: Editor 统一管理插件生命周期
4. **灵活配置**: 支持插件个性化配置
5. **完善的生态**: 内置常用编辑功能插件

通过遵循本指南，开发者可以快速创建功能丰富、稳定可靠的图片编辑插件。 