# ImageEditor 图片编辑器组件

## 概述

ImageEditor 是一个基于 **Fabric.js 6.7** 构建的现代化图片编辑器组件，采用插件化架构设计。该组件提供了图片导入、编辑、绘制、缩放、导出等完整的图片编辑功能，适用于在线地图编辑、图片标注等业务场景。

## 核心特性

### 🏗️ 插件化架构
- **核心 Editor 类**: 统一管理所有插件，提供插件注册、API代理、事件绑定等功能
- **标准化插件接口**: 每个插件遵循统一的开发规范，支持热插拔
- **生命周期管理**: 完善的插件生命周期钩子函数

### 🖼️ 图片处理能力
- **智能适配**: 图片自动适配容器尺寸，保持原始宽高比
- **响应式布局**: 支持容器尺寸变化时自动重新布局
- **格式检测**: 自动检测并保持原始图片格式
- **高质量导出**: 支持原始分辨率导出

### 🎨 丰富的绘制工具
- **铅笔工具**: 支持自由绘制和直线绘制
- **橡皮擦工具**: 可调节大小的橡皮擦功能
- **颜色选择**: 预设颜色和自定义颜色支持
- **画笔设置**: 可调节画笔大小、颜色、类型

### 🔧 交互功能
- **拖拽移动**: 画布拖拽移动，支持边界限制
- **缩放控制**: 鼠标滚轮缩放，支持缩放边界
- **右键菜单**: 上下文相关的右键菜单
- **快捷键**: 完整的快捷键支持

## 架构设计

### 核心组件结构

```
ImageEditor/
├── core/                    # 核心功能
│   ├── Editor.js           # 核心编辑器类
│   ├── ContextMenu.js      # 右键菜单
│   └── plugins/            # 插件目录
│       ├── WorkspacePlugin.js    # 工作区插件
│       ├── DrawPlugin.js         # 绘制插件
│       ├── DeletePlugin.js       # 删除插件
│       ├── DragPlugin.js         # 拖拽插件
│       ├── FreeDrawPlugin.js     # 自由绘制插件
│       ├── StraightLinePlugin.js # 直线插件
│       ├── ExportPlugin.js       # 导出插件
│       └── ControlsPlugin.js     # 控制插件
├── components/              # UI组件
│   ├── layout/             # 布局组件
│   │   ├── ToolBar.vue     # 工具栏
│   │   └── PropertyBar.vue # 属性栏
│   ├── common/             # 通用组件
│   │   ├── ColorPicker.vue # 颜色选择器
│   │   └── Slider.vue      # 滑块控制器
│   └── control/            # 控制组件
│       └── Zoom.vue        # 缩放控制
├── config/                  # 配置文件
│   ├── tools.js           # 工具配置
│   └── eventType.js       # 事件类型
├── hooks/                   # Vue3 组合式函数
├── utils/                   # 工具函数
├── docs/                    # 文档
└── index.vue               # 组件入口
```

### 插件系统

#### 内置插件功能

| 插件名 | 功能描述 | 主要API |
|--------|----------|---------|
| **WorkspacePlugin** | 工作区管理 | `big()`, `small()`, `defaultZoom()`, `resetCanvas()`, `exportImage()` |
| **DrawPlugin** | 绘制工具管理 | `setLineType()`, `setPencilDrawColor()`, `setPencilDrawWidth()` |
| **DeletePlugin** | 删除功能 | `del()` |
| **DragPlugin** | 拖拽移动 | 画布拖拽功能 |
| **FreeDrawPlugin** | 自由绘制 | 自由画笔功能 |
| **StraightLinePlugin** | 直线绘制 | `startStraightLine()`, `endStraightLine()` |
| **ExportPlugin** | 导出功能 | 图片导出处理 |
| **ControlsPlugin** | 控制管理 | 对象控制功能 |


## 工具配置

### 支持的绘制工具

- **选择工具 (select)**: 默认选择模式
- **铅笔工具 (pencil)**: 支持自由绘制和直线绘制
- **橡皮擦 (eraser)**: 可调节大小的橡皮擦
- **拖拽工具 (move)**: 画布拖拽移动

### 快捷键支持

| 快捷键 | 功能 |
|--------|------|
| `Backspace` | 删除选中对象 |
| 鼠标滚轮 | 缩放画布 |

## 技术特点

### 🎯 性能优化
- **节流处理**: 鼠标移动等高频事件使用节流优化
- **内存管理**: 自动清理事件监听器，防止内存泄漏
- **按需渲染**: 智能的画布重绘机制

### 🔒 稳定性保障
- **错误处理**: 完善的异常处理机制
- **边界检查**: 严格的操作边界限制

### 🌐 扩展性
- **插件化**: 易于扩展新功能
- **事件驱动**: 完整的事件系统
- **配置灵活**: 丰富的配置选项

## 依赖项

- **Fabric.js 6.7**: 核心Canvas操作库
- **Vue 3**: 前端框架
- **Element Plus**: UI组件库
- **hotkeys-js**: 快捷键处理
- **tapable**: 插件钩子系统

## 浏览器支持

- Chrome >= 88
- Firefox >= 85
- Safari >= 14
- Edge >= 88


### 自定义插件开发

参考 `docs/plugin-architecture.md` 了解详细的插件开发指南。


> 📖 更多详细文档请查看 `docs/` 目录下的相关文档文件 