# BicMap-GL API 使用说明文档

## 目录

### 基础功能
- [快速开始](#快速开始)
- [地图初始化](#地图初始化)
- [基础操作](#基础操作)

### 标记功能
- [方向标记](#方向标记)
- [批量POI标记](#批量poi标记)
- [机器人标记](#机器人标记)

### 绘制功能
- [多边形绘制](#多边形绘制)
- [线段绘制](#线段绘制)
- [矩形绘制](#矩形绘制)

### 静态要素
- [多边形要素](#多边形要素)
- [多边形编辑模式](#多边形编辑模式)
- [矩形要素](#矩形要素)
- [线段要素](#线段要素)
- [宽线段要素](#宽线段要素)

### 点云渲染
- [点云渲染](#点云渲染)

### SLAM地图
- [SLAM地图](#slam地图)

### 工具函数
- [工具函数](#工具函数)

### 示例代码
- [Vue组件示例](#vue组件示例)
- [原生示例](#原生示例)

---

## 快速开始

### 基础地图创建

```
import bicMap from './bicMap/core/bicmap-gl';

// 1. 初始化BicMap
await bicMap.init();

// 2. 创建地图实例
const map = bicMap.createMap({
  container: 'mapContainer', // DOM元素ID
  center: [116.3912, 39.9073], // 中心点坐标 [经度, 纬度]
  zoom: 13, // 缩放级别
  style: 'mapbox://styles/mapbox/light-v11' // 地图样式
});

// 3. 添加缩放控件
bicMap.addZoomControl(map, 'bottom-right');
```

---

## 地图初始化

### bicMap.init()
初始化BicMap库，必须在创建地图前调用。

```
await bicMap.init();
```

### bicMap.createMap(options)
创建地图实例。

**参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `container` | string | 是 | - | DOM容器ID，地图将渲染到此元素中 |
| `center` | Array<number> | 否 | [0, 0] | 初始中心点坐标 [经度, 纬度]，使用WGS84坐标系 |
| `zoom` | number | 否 | 0 | 初始缩放级别，范围通常为0-22 |
| `style` | string\|Object | 否 | 'mapbox://styles/mapbox/streets-v11' | 地图样式，可以是Mapbox样式URL或自定义样式对象 |
| `pitch` | number | 否 | 0 | 地图倾斜角度，范围0-85度，用于3D效果 |
| `bearing` | number | 否 | 0 | 地图旋转角度，范围0-360度 |
| `antialias` | boolean | 否 | false | 是否启用抗锯齿，提升渲染质量但可能影响性能 |
| `backgroundColor` | string | 否 | '#000000' | 地图背景颜色，在地图加载前显示 |
| `maxZoom` | number | 否 | 22 | 最大缩放级别 |
| `minZoom` | number | 否 | 0 | 最小缩放级别 |
| `maxPitch` | number | 否 | 85 | 最大倾斜角度 |
| `maxBounds` | Array<Array<number>> | 否 | null | 地图边界限制 [[西南角], [东北角]] |

**示例:**
```
const map = bicMap.createMap({
  container: 'myMap',
  center: [116.3912, 39.9073],
  zoom: 13,
  pitch: 45,
  bearing: 0,
  antialias: true,
  style: 'mapbox://styles/mapbox/light-v11',
  maxZoom: 20,
  minZoom: 3
});
```

### bicMap.addZoomControl(map, position)
添加缩放控件。

**参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `map` | Map | 是 | - | 地图实例对象 |
| `position` | string | 否 | 'bottom-right' | 控件位置，可选值：'top-left', 'top-right', 'bottom-left', 'bottom-right' |

**返回值:** 无

**示例:**
```
// 在右下角添加缩放控件
bicMap.addZoomControl(map, 'bottom-right');

// 在左上角添加缩放控件
bicMap.addZoomControl(map, 'top-left');
```

---

## 基础操作

### 地图控制

```
// 获取地图中心点
const center = map.getCenter();

// 设置地图中心点
map.setCenter([116.4, 39.9]);

// 缩放地图
map.zoomTo(15);

// 飞行到指定位置
map.flyTo({
  center: [116.4, 39.9],
  zoom: 15,
  duration: 1000
});

// 获取地图边界
const bounds = map.getBounds();

// 适应边界
map.fitBounds(bounds);
```

---

## 标记功能

创建可旋转的方向标记。

**方法名称:**
```
bicMap.addDirectionalMarker(map, position, options)
```

**参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `map` | Map | 是 | - | 地图实例对象 |
| `position` | Array<number> | 是 | - | 标记位置 [经度, 纬度] |
| `options` | Object | 否 | {} | 配置选项 |

**options 参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `imagePath` | string | 否 | '/bicMap/assets/svg/pos.svg' | 标记图标路径，支持SVG、PNG、JPG格式 |
| `initialRotation` | number | 否 | 0 | 初始旋转角度，范围0-360度 |
| `draggable` | boolean | 否 | true | 是否可拖拽移动 |
| `rotationControl` | boolean | 否 | true | 是否显示旋转控制手柄 |
| `initialEditMode` | boolean | 否 | false | 初始是否为编辑模式 |
| `highlightStyle` | Object | 否 | {} | 高亮样式配置 |
| `highlightStyle.backgroundColor` | string | 否 | 'rgba(76, 175, 80, 0.15)' | 高亮背景颜色 |
| `highlightStyle.borderColor` | string | 否 | '#4CAF50' | 高亮边框颜色 |
| `highlightStyle.shadowColor` | string | 否 | 'rgba(76, 175, 80, 0.6)' | 高亮阴影颜色 |
| `onChange` | function | 否 | null | 位置或旋转变化时的回调函数 |

**回调函数参数:**
- `onChange(data)`: `data.lngLat` - 位置坐标, `data.rotation` - 旋转角度
- `onClick(event)`: 点击事件对象
- `onDragStart(event)`: 拖拽开始事件
- `onDragEnd(event)`: 拖拽结束事件

**返回值:** DirectionalMarker对象

**示例:**
```
const marker = bicMap.addDirectionalMarker(map, [116.3912, 39.9073], {
  imagePath: '/bicMap/assets/svg/pos.svg',
  initialRotation: 0,
  draggable: true,
  rotationControl: true,
  initialEditMode: false,
  highlightStyle: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderColor: '#4CAF50',
    shadowColor: 'rgba(76, 175, 80, 0.6)'
  },
  onChange: (data) => {
    console.log('标记位置:', data.lngLat);
    console.log('旋转角度:', data.rotation);
  }
});

// 获取标记位置
const position = marker.getPosition();

// 获取旋转角度
const rotation = marker.getRotation();

// 设置旋转角度
marker.setRotation(45);

// 切换编辑模式
marker.toggleEditMode();

// 启用编辑模式
marker.enableEditMode();

// 禁用编辑模式
marker.disableEditMode();

// 检查是否在编辑模式
const isEditing = marker.isInEditMode();

// 移除标记
marker.remove();
```

### 批量POI标记

高效渲染大量POI点位。

**方法名称:**
```
bicMap.addBatchPOIMarkers(map, points, options)
```

**参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `map` | Map | 是 | - | 地图实例对象 |
| `points` | Array<Object> | 是 | - | POI点位数据数组 |
| `options` | Object | 否 | {} | 配置选项 |

**points 数组元素说明:**

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 点位唯一标识符 |
| `lngLat` | Array<number> | 是 | 位置坐标 [经度, 纬度] |
| `rotation` | number | 否 | 0 | 旋转角度，范围0-360度 |
| `name` | string | 否 | '' | 点位名称，用于标签显示 |

**options 参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `imagePath` | string | 否 | '/bicMap/assets/img/pos.png' | 标记图标路径 |
| `size` | number | 否 | 24 | 标记大小，单位像素 |
| `showLabels` | boolean | 否 | false | 是否显示标签 |
| `labelIconPath` | string | 否 | '/bicMap/assets/img/poi-sig.png' | 标签图标路径 |
| `selectable` | boolean | 否 | true | 是否可选择 |
| `selectedStyle` | Object | 否 | {} | 选中样式配置 |
| `selectedStyle.color` | string | 否 | '#ffba40' | 选中时的扩散效果边框颜色 |
| `selectedStyle.fillColor` | string | 否 | '#ffba40' | 选中时的扩散效果填充颜色 |
| `selectedStyle.fillOpacity` | number | 否 | 1 | 填充透明度 |
| `selectedStyle.baseRadius` | number | 否 | 0.2 | 扩散圆环的基础半径倍数（相对于marker尺寸） |
| `selectedStyle.maxRadius` | number | 否 | 0.6 | 扩散动画的最大半径倍数（相对于marker尺寸） |
| `selectedStyle.strokeWidth` | number | 否 | 3 | 扩散圆环的边框宽度 |
| `selectedStyle.opacity` | number | 否 | 0 | 扩散圆环的初始透明度 |
| `selectedStyle.animationDuration` | number | 否 | 2000 | 动画持续时间（毫秒） |
| `onClick` | function | 否 | null | 点击标记时的回调函数 |
| `onSelectionChange` | function | 否 | null | 选中状态变化时的回调函数 |

**回调函数参数:**
- `onClick(markerData)`: `markerData` - 包含id、lngLat、rotation、name等属性
- `onSelectionChange(data)`: `data` - 选中状态变化数据

**返回值:** BatchPOIController对象

**示例:**
```
const points = [
  {
    id: 'poi-1',
    lngLat: [116.3912, 39.9073],
    rotation: 0,
    name: '点位1'
  },
  {
    id: 'poi-2',
    lngLat: [116.4012, 39.9173],
    rotation: 45,
    name: '点位2'
  }
];

const markersController = bicMap.addBatchPOIMarkers(map, points, {
  imagePath: '/bicMap/assets/img/pos.png',
  size: 24,
  showLabels: true,
  labelIconPath: '/bicMap/assets/img/poi-sig.png',
  selectable: true,
  selectedStyle: {
    color: '#ffba40',
    fillColor: '#ffba40',
    fillOpacity: 1,
    baseRadius: 0.2,
    maxRadius: 0.6,
    strokeWidth: 3,
    opacity: 0,
    animationDuration: 2000
  },
  onClick: (markerData) => {
    console.log('点击了标记:', markerData);
  },
  onSelectionChange: (data) => {
    console.log('选中状态变化:', data);
  }
});

// 更新标记
markersController.updateMarkers(newPoints);

// 添加单个标记
markersController.addMarker(markerData);

// 移除标记
markersController.removeMarker(index);

// 根据ID选中标记
markersController.selectById('poi-1');

// 清除选中
markersController.clearSelection();

// 设置可选中状态
markersController.setSelectable(true);

// 获取当前是否可选中状态
const isSelectable = markersController.isSelectable();

// 切换标签显示
markersController.toggleLabels();

// 获取所有标记
const allMarkers = markersController.getMarkers();

// 获取选中的标记（单选模式）
const selectedMarker = markersController.getSelectedMarker();

// 获取所有选中的标记
const selectedMarkers = markersController.getSelectedMarkers();

// 根据ID获取标记信息
const markerInfo = markersController.getMarkerById('poi-1');

// 清除所有标记
markersController.clearMarkers();

// 移除控制器
markersController.remove();
```

### 机器人标记

专门用于机器人位置显示的标记。

**方法名称:**
```
bicMap.addRobotMarkers(map, robots, options)
```

**参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `map` | Map | 是 | - | 地图实例对象 |
| `robots` | Array<Object> | 是 | - | 机器人数据数组 |
| `options` | Object | 否 | {} | 配置选项 |

**robots 数组元素说明:**

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 机器人唯一标识符 |
| `name` | string | 是 | 机器人名称 |
| `lngLat` | Array<number> | 是 | 位置坐标 [经度, 纬度] |
| `rotation` | number | 否 | 0 | 机器人朝向角度，范围0-360度 |

**options 参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `svgPath` | string | 是 | - | 机器人图标路径，推荐使用SVG格式 |
| `size` | number | 否 | 30 | 图标大小，单位像素 |
| `showLabels` | boolean | 否 | true | 是否显示机器人名称标签 |
| `onClick` | function | 否 | null | 点击机器人时的回调函数 |
| `GPSToCartesian` | function | 否 | null | GPS坐标转笛卡尔坐标的转换函数 |

**回调函数参数:**
- `onClick(robotInfo)`: `robotInfo` - 包含id、name、lngLat、rotation等属性
- `GPSToCartesian(lng, lat)`: 坐标转换函数，返回转换后的坐标对象

**返回值:** RobotMarkersController对象

**示例:**
```
const robots = [
  {
    id: 'robot-001',
    name: '机器人1',
    lngLat: [116.3912, 39.9073],
    rotation: 90
  }
];

const robotController = bicMap.addRobotMarkers(map, robots, {
  svgPath: '/path/to/robot.svg',
  size: 30,
  showLabels: true,
  onClick: (robotInfo) => {
    console.log('点击了机器人:', robotInfo);
  },
  GPSToCartesian: (lng, lat) => {
    // 坐标转换函数
    return MapUtils.GPSToCartesian({ longitude: lng, latitude: lat });
  }
});

// 添加机器人
robotController.addRobot(robotData);

// 更新机器人
robotController.updateRobot(index, robotData);

// 移除机器人
robotController.removeRobot(index);

// 更新所有机器人
robotController.updateRobots(newRobots);

// 切换标签显示
robotController.toggleLabels();

// 清除所有机器人
robotController.clearRobots();

// 移除控制器
robotController.remove();
```

---

## 绘制功能

### 多边形绘制

启用多边形绘制功能。

**方法名称:**
```
bicMap.enablePolygonDrawing(map, options)
```

**参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `map` | Map | 是 | - | 地图实例对象 |
| `options` | Object | 否 | {} | 绘制配置选项 |

**options 参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `fillColor` | string | 否 | '#4CAF50' | 填充颜色，支持十六进制、RGB、HSL格式 |
| `fillOpacity` | number | 否 | 0.3 | 填充透明度，范围0-1 |
| `lineColor` | string | 否 | '#2E7D32' | 边框颜色 |
| `lineWidth` | number | 否 | 3 | 边框宽度，单位像素 |
| `pointColor` | string | 否 | '#FF5722' | 顶点颜色 |
| `pointRadius` | number | 否 | 6 | 顶点半径，单位像素 |
| `enableTouch` | boolean | 否 | true | 是否启用触摸支持（移动端） |
| `minPoints` | number | 否 | 3 | 最少顶点数量 |
| `onDrawComplete` | function | 否 | null | 绘制完成时的回调函数 |
| `onDrawStart` | function | 否 | null | 开始绘制时的回调函数 |
| `onDrawUpdate` | function | 否 | null | 绘制过程中的回调函数 |

**回调函数参数:**
- `onDrawComplete(polygon, info)`: 
  - `polygon` - GeoJSON多边形对象
  - `info` - 包含面积、周长、中心点等计算信息
- `onDrawStart()`: 开始绘制时触发
- `onDrawUpdate(points)`: `points` - 当前绘制的顶点数组

**返回值:** DrawingController对象

**示例:**
```
const drawingController = bicMap.enablePolygonDrawing(map, {
  fillColor: '#4CAF50',
  fillOpacity: 0.3,
  lineColor: '#2E7D32',
  lineWidth: 3,
  pointColor: '#FF5722',
  pointRadius: 6,
  enableTouch: true,
  minPoints: 3,
  onDrawComplete: (polygon, info) => {
    console.log('多边形绘制完成:', polygon);
    console.log('面积:', info.area, '平方公里');
    console.log('周长:', info.perimeter, '公里');
  },
  onDrawStart: () => {
    console.log('开始绘制多边形');
  }
});

// 完成当前绘制
drawingController.finishDrawing();

// 清除绘制
drawingController.clearDrawing();

// 禁用绘制
drawingController.disable();
```

### 线段绘制

```
const drawingController = bicMap.enablePolylineDrawing(map, {
  fillColor: '#3388ff',
  fillOpacity: 0.8,
  lineColor: '#2266cc',
  lineWidth: 2,
  pointColor: '#FF5722',
  pointRadius: 6,
  defaultWidth: 20, // 默认宽度(米)
  enableTouch: true,
  minPoints: 2,
  onDrawComplete: (polylineData) => {
    console.log('线段绘制完成:', polylineData);
  }
});

// 设置宽度
drawingController.setWidth(30);

// 完成当前绘制
drawingController.finishDrawing();

// 清除绘制
drawingController.clearDrawing();

// 禁用绘制
drawingController.disable();
```

### 矩形绘制

```
const drawingController = bicMap.enableRectangleDrawing(map, {
  fillColor: '#4CAF50',
  fillOpacity: 0.3,
  lineColor: '#2E7D32',
  lineWidth: 3,
  enableTouch: true,
  onDrawComplete: (rectangle, corners) => {
    console.log('矩形绘制完成:', rectangle);
    console.log('矩形角点:', corners);
  }
});

// 完成当前绘制
drawingController.finishDrawing();

// 清除绘制
drawingController.clearDrawing();

// 禁用绘制
drawingController.disable();
```

---

## 要素功能

### 多边形要素

```
const polygons = [
  {
    id: 'polygon-1',
    points: [[lng1, lat1], [lng2, lat2], [lng3, lat3]],
    fillColor: '#4CAF50',
    outlineColor: '#2E7D32',
    fillOpacity: 0.6,
    outlineWidth: 2,
    filled: true
  }
];

const polygonController = bicMap.createPolygons(map, polygons, {
  fillOpacity: 0.6,
  outlineWidth: 2,
  highlightColor: '#ff6600',
  filled: true
});

// 添加多边形
const newId = polygonController.addPolygon(polygonData);

// 移除多边形
polygonController.removePolygon(id);

// 更新多边形
polygonController.updatePolygon(id, polygonData);

// 切换填充状态
polygonController.togglePolygonFilled(id);

// 设置所有多边形填充状态
polygonController.setAllFilled(true);

// 高亮多边形
polygonController.highlightPolygon(id);

// 清除高亮
polygonController.clearHighlights();

// 显示/隐藏
polygonController.show();
polygonController.hide();

// 获取多边形数据
const data = polygonController.getPolygonData(id);

// 获取所有多边形
const allPolygons = polygonController.getAllPolygons();

// 获取多边形ID列表
const ids = polygonController.getPolygonIds();

// 移除控制器
polygonController.remove();
```

### 多边形编辑模式

支持通过拖拽顶点动态编辑多边形形状，并提供实时坐标回调。

**编辑模式方法:**

```
// 进入编辑模式
polygonController.enterEditMode(polygonId, callbacks);

// 退出编辑模式
polygonController.exitEditMode();

// 检查编辑状态
const isEditing = polygonController.isEditMode();

// 获取当前编辑的多边形ID
const selectedId = polygonController.getSelectedPolygonId();

// 获取当前编辑的坐标点
const editPoints = polygonController.getEditPoints();

// 获取完整的编辑数据
const editData = polygonController.getEditData();
```

**参数说明:**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `polygonId` | string | 是 | 要编辑的多边形ID |
| `callbacks` | Object | 否 | 编辑回调函数对象 |

**callbacks 参数说明:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `onEditStart` | function | 开始编辑时的回调函数 |
| `onEditUpdate` | function | 编辑过程中的回调函数 |
| `onEditEnd` | function | 结束编辑时的回调函数 |

**回调函数参数:**

- `onEditStart(data)`: 开始编辑回调
  - `data.polygonId` - 多边形ID
  - `data.points` - 顶点坐标数组
  - `data.feature` - 原始GeoJSON特征

- `onEditUpdate(data)`: 编辑更新回调
  - `data.polygonId` - 多边形ID
  - `data.points` - 更新后的所有顶点坐标
  - `data.changedPointIndex` - 被拖拽的顶点索引
  - `data.changedPoint` - 被拖拽顶点的当前坐标

- `onEditEnd(data)`: 结束编辑回调
  - `data.polygonId` - 多边形ID
  - `data.points` - 最终顶点坐标
  - `data.finalPoints` - 最终顶点坐标（与points相同）

**示例:**

```
// 基本编辑功能
const success = polygonController.enterEditMode('polygon-0', {
  onEditStart: (data) => {
    console.log('开始编辑多边形:', data.polygonId);
    console.log('初始坐标:', data.points);
  },
  onEditUpdate: (data) => {
    console.log('坐标更新:', data.points);
    console.log('拖拽的顶点:', data.changedPointIndex);
  },
  onEditEnd: (data) => {
    console.log('编辑完成，最终坐标:', data.finalPoints);
    // 保存最终坐标到服务器
    savePolygonCoordinates(data.polygonId, data.finalPoints);
  }
});

// 实时坐标监控
let coordinateHistory = [];

polygonController.enterEditMode('polygon-0', {
  onEditUpdate: (data) => {
    // 记录坐标变化历史
    coordinateHistory.push({
      timestamp: Date.now(),
      polygonId: data.polygonId,
      points: data.points,
      changedIndex: data.changedPointIndex
    });
    
    // 实时显示坐标
    updateCoordinateDisplay(data.points);
  }
});

// 检查编辑状态
if (polygonController.isEditMode()) {
  const editData = polygonController.getEditData();
  console.log('当前编辑的多边形:', editData.polygonId);
  console.log('当前坐标:', editData.points);
  console.log('是否正在拖拽:', editData.isDragging);
}

// 退出编辑模式
polygonController.exitEditMode();
```

**注意事项:**

1. **编辑模式互斥**: 同时只能编辑一个多边形
2. **坐标格式**: 所有坐标都是 [经度, 纬度] 格式
3. **回调频率**: onEditUpdate 在拖拽过程中会频繁触发，建议进行防抖处理
4. **内存管理**: 编辑历史记录会自动限制在100条以内
5. **事件清理**: 组件卸载时会自动退出编辑模式

### 矩形要素

```
const rectangles = [
  {
    id: 'rect-1',
    coordinates: [
      [swLng, swLat], // 西南角
      [neLng, neLat]  // 东北角
    ],
    fillColor: '#4CAF50',
    outlineColor: '#2E7D32',
    fillOpacity: 0.6,
    outlineWidth: 2,
    filled: true
  }
];

const rectangleController = bicMap.createRectangles(map, rectangles, {
  fillOpacity: 0.6,
  outlineWidth: 2,
  highlightColor: '#ff6600',
  filled: true
});

// 添加矩形
const newId = rectangleController.addRectangle(rectangleData);

// 移除矩形
rectangleController.removeRectangle(id);

// 更新矩形
rectangleController.updateRectangle(id, rectangleData);

// 切换填充状态
rectangleController.toggleRectangleFilled(id);

// 设置所有矩形填充状态
rectangleController.setAllFilled(true);

// 高亮矩形
rectangleController.highlightRectangle(id);

// 清除高亮
rectangleController.clearHighlights();

// 显示/隐藏
rectangleController.show();
rectangleController.hide();

// 获取矩形数据
const data = rectangleController.getRectangleData(id);

// 获取所有矩形
const allRectangles = rectangleController.getAllRectangles();

// 获取矩形ID列表
const ids = rectangleController.getRectangleIds();

// 移除控制器
rectangleController.remove();
```

### 线段要素

```
const polylines = [
  {
    path: [[lng1, lat1], [lng2, lat2], [lng3, lat3]],
    color: '#3388ff',
    width: 3,
    opacity: 0.8,
    dashType: 'solid', // 'solid', 'dashed', 'dotted', 'dashdot'
    showArrow: false,
    arrowSize: 1,
    arrowSpacing: 50,
    name: '线段1'
  }
];

const polylinesController = bicMap.createPolylines(map, polylines, {
  onClick: (feature) => {
    console.log('线段点击:', feature.properties);
  }
});

// 更新线段
polylinesController.update(newPolylines);

// 清除所有线段
polylinesController.clear();

// 更新箭头大小
polylinesController.updateArrowSize(1.5);

// 更新单个线段箭头大小
polylinesController.updatePolylineArrowSize(id, 2.0);

// 移除控制器
polylinesController.remove();
```

### 宽线段要素

创建具有宽度的轨道线，支持高亮和编辑功能。

**API 使用最佳实践:**

- **推荐使用**: `addWideLine()`, `updateWideLine()`, `removeWideLine()` 等单个操作方法
- **不推荐使用**: `update()` 方法进行批量更新，性能较差
- **性能优化**: 单个操作比批量操作更高效，只更新需要修改的线段
- **用户体验**: 添加新线段时会自动选中，提供更好的交互反馈

**方法名称:**
```
bicMap.createWideLines(map, wideLines, options)
```

**参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `map` | Map | 是 | - | 地图实例对象 |
| `wideLines` | Array<Object> | 是 | [] | 宽线段数据数组 |
| `options` | Object | 否 | {} | 配置选项 |

**wideLines 数组元素说明:**

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | 否 | 自动生成 | 宽线段唯一标识符 |
| `path` | Array<Array<number>> | 是 | - | 路径坐标数组 [[经度, 纬度], ...] |
| `color` | string | 否 | '#3388ff' | 填充颜色 |
| `width` | number | 否 | 10 | 宽度（米） |
| `opacity` | number | 否 | 0.8 | 透明度，范围0-1 |
| `outlineColor` | string | 否 | '#2266cc' | 边框颜色 |
| `outlineWidth` | number | 否 | 2 | 边框宽度（像素） |
| `name` | string | 否 | '' | 宽线段名称 |
| `data` | Object | 否 | {} | 自定义数据 |

**options 参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `showOutline` | boolean | 否 | true | 是否显示边框 |
| `onClick` | function | 否 | null | 点击宽线段时的回调函数 |

**返回值:** WideLinesController对象

**示例:**
```
const wideLines = [
  {
    id: 'highway-1',
    path: [[116.3912, 39.9073], [116.4012, 39.9073], [116.4112, 39.9173]],
    color: '#3388ff',
    width: 20, // 宽度(米)
    opacity: 0.8,
    outlineColor: '#2266cc',
    outlineWidth: 2,
    name: '高速公路主线'
  },
  {
    id: 'street-1',
    path: [[116.3912, 39.9073], [116.4012, 39.9073]],
    color: '#95a5a6',
    width: 15,
    opacity: 0.8,
    outlineColor: '#7f8c8d',
    outlineWidth: 2,
    name: '城市街道'
  }
];

const widelinesController = bicMap.createWideLines(map, wideLines, {
  showOutline: true,
  onClick: (feature) => {
    console.log('宽轨道点击:', feature.properties);
  }
});

// 添加单条宽线段（推荐使用）
const newId = widelinesController.addWideLine({
  id: 'new-highway',
  path: [[116.4212, 39.9273], [116.4312, 39.9373]],
  color: '#e74c3c',
  width: 25,
  opacity: 0.9,
  outlineColor: '#c0392b',
  outlineWidth: 3,
  name: '新建高速公路'
});

// 更新单条宽线段（推荐使用）
widelinesController.updateWideLine('highway-1', {
  color: '#f39c12',
  width: 30,
  opacity: 0.7
});

// 移除单条宽线段（推荐使用）
widelinesController.removeWideLine('street-1');

// 高亮宽线段
widelinesController.highlightWideLine('highway-1');

// 清除高亮
widelinesController.clearHighlights();

// 显示/隐藏
widelinesController.show();
widelinesController.hide();

// 清除所有宽线段
widelinesController.clear();

// 移除控制器
widelinesController.remove();
```

### 宽线段编辑模式

支持通过拖拽顶点动态编辑宽线段形状，编辑的是底层Polyline路径。

**编辑模式方法:**

```
// 进入编辑模式
widelinesController.enterEditMode(widelineId, callbacks);

// 退出编辑模式
widelinesController.exitEditMode();

// 检查编辑状态
const isEditing = widelinesController.isEditMode();

// 获取当前编辑的宽线段ID
const selectedId = widelinesController.getSelectedWidelineId();

// 获取当前编辑的坐标点
const editPoints = widelinesController.getEditPoints();

// 获取完整的编辑数据
const editData = widelinesController.getEditData();
```

**参数说明:**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `widelineId` | string | 是 | 要编辑的宽线段ID |
| `callbacks` | Object | 否 | 编辑回调函数对象 |

**callbacks 参数说明:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `onEditStart` | function | 开始编辑时的回调函数 |
| `onEditUpdate` | function | 编辑过程中的回调函数 |
| `onEditEnd` | function | 结束编辑时的回调函数 |

**回调函数参数:**

- `onEditStart(data)`: 开始编辑回调
  - `data.widelineId` - 宽线段ID
  - `data.points` - 顶点坐标数组
  - `data.isDragging` - 是否正在拖拽
  - `data.dragPointIndex` - 拖拽的顶点索引

- `onEditUpdate(data)`: 编辑更新回调
  - `data.widelineId` - 宽线段ID
  - `data.points` - 更新后的所有顶点坐标
  - `data.changedPointIndex` - 被拖拽的顶点索引
  - `data.changedPoint` - 被拖拽顶点的当前坐标
  - `data.isDragging` - 是否正在拖拽
  - `data.dragPointIndex` - 拖拽的顶点索引

- `onEditEnd(data)`: 结束编辑回调
  - `data.widelineId` - 宽线段ID
  - `data.points` - 最终顶点坐标
  - `data.isDragging` - 是否正在拖拽
  - `data.dragPointIndex` - 拖拽的顶点索引

**示例:**

```
// 基本编辑功能
const success = widelinesController.enterEditMode('highway-1', {
  onEditStart: (data) => {
    console.log('开始编辑宽线段:', data.widelineId);
    console.log('初始坐标:', data.points);
  },
  onEditUpdate: (data) => {
    console.log('坐标更新:', data.points);
    console.log('拖拽的顶点:', data.changedPointIndex);
  },
  onEditEnd: (data) => {
    console.log('编辑完成，最终坐标:', data.points);
    // 保存最终坐标到服务器
    saveWidelineCoordinates(data.widelineId, data.points);
  }
});

// 实时坐标监控
let coordinateHistory = [];

widelinesController.enterEditMode('highway-1', {
  onEditUpdate: (data) => {
    // 记录坐标变化历史
    coordinateHistory.push({
      timestamp: Date.now(),
      widelineId: data.widelineId,
      points: data.points,
      changedIndex: data.changedPointIndex
    });
    
    // 实时显示坐标
    updateCoordinateDisplay(data.points);
  }
});

// 检查编辑状态
if (widelinesController.isEditMode()) {
  const editData = widelinesController.getEditData();
  console.log('当前编辑的宽线段:', editData.widelineId);
  console.log('当前坐标:', editData.points);
  console.log('是否正在拖拽:', editData.isDragging);
}

// 退出编辑模式
widelinesController.exitEditMode();
```

**注意事项:**

1. **编辑模式互斥**: 同时只能编辑一个宽线段
2. **坐标格式**: 所有坐标都是 [经度, 纬度] 格式
3. **编辑底层路径**: 编辑的是原始Polyline路径，不是扩展后的面
4. **回调频率**: onEditUpdate 在拖拽过程中会频繁触发，建议进行防抖处理
5. **事件清理**: 组件卸载时会自动退出编辑模式

---

## 点云渲染

使用WebGL高性能渲染大量3D点云数据。

**方法名称:**
```
bicMap.createPointCloud(map, points, options)
```

**参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `map` | Map | 是 | - | 地图实例对象 |
| `points` | Array<Array<number>> | 是 | - | 点云数据数组，每个点为[经度, 纬度, 高度] |
| `options` | Object | 否 | {} | 点云配置选项 |

**points 数组说明:**
- 2D模式：`[[lng, lat], [lng, lat], ...]`
- 3D模式：`[[lng, lat, height], [lng, lat, height], ...]`

**options 参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `pointSize` | number | 否 | 5 | 点大小，单位像素，范围1-20 |
| `pointColor` | string | 否 | '#ff0000' | 点颜色（单色模式） |
| `pointOpacity` | number | 否 | 0.8 | 点透明度，范围0-1 |
| `is3D` | boolean | 否 | true | 是否启用3D模式 |
| `useColorMap` | boolean | 否 | false | 是否使用渐变色（基于高度） |
| `zRange` | Array<number> | 否 | [0, 10] | 高度范围 [最小值, 最大值] |
| `heightScale` | number | 否 | 200 | 高度缩放系数，用于3D显示 |
| `heightOffset` | number | 否 | 0 | 高度偏移量 |
| `colorMap` | string | 否 | 'viridis' | 渐变色方案，可选：'viridis', 'plasma', 'inferno', 'magma' |

**返回值:** PointCloud对象

**示例:**
```
const points = [
  [116.3912, 39.9073, 5.2], // 3D点
  [116.4012, 39.9173, 3.8],
  [116.4112, 39.9273, 7.1]
];

const pointCloud = bicMap.createPointCloud(map, points, {
  pointSize: 5,
  pointColor: '#ff0000',
  pointOpacity: 0.8,
  is3D: true,
  useColorMap: false,
  zRange: [0, 10],
  heightScale: 200,
  heightOffset: 0
});

// 更新点云
pointCloud.update(newPoints, options);

// 设置3D模式
pointCloud.set3D(true);

// 显示/隐藏
pointCloud.show();
pointCloud.hide();

// 移除点云
pointCloud.remove();
```

### 点云配置选项

- `pointSize`: 点大小(像素)
- `pointColor`: 点颜色(单色模式)
- `pointOpacity`: 点透明度
- `is3D`: 是否3D模式
- `useColorMap`: 是否使用渐变色(基于高度)
- `zRange`: 高度范围 [min, max]
- `heightScale`: 高度缩放系数
- `heightOffset`: 高度偏移

---

## SLAM地图

加载和显示SLAM（同时定位与地图构建）生成的地图数据。

**方法名称:**
```
bicMap.loadSlamMap(map, options)
```

**参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `map` | Map | 是 | - | 地图实例对象 |
| `options` | Object | 是 | - | SLAM地图配置选项 |

**options 参数说明:**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `startX` | number | 是 | - | SLAM地图起始X坐标（米） |
| `startY` | number | 是 | - | SLAM地图起始Y坐标（米） |
| `xGridCount` | number | 是 | - | X方向网格数量 |
| `yGridCount` | number | 是 | - | Y方向网格数量 |
| `resolution` | number | 是 | - | 地图分辨率（米/像素） |
| `imagePath` | string | 是 | - | SLAM地图图片路径（BMP格式） |
| `canvasId` | string | 否 | null | 画布元素ID，用于图片处理 |
| `fitBounds` | boolean | 否 | true | 是否自动适应地图边界 |
| `opacity` | number | 否 | 0.8 | 地图透明度，范围0-1 |
| `minZoom` | number | 否 | null | 最小缩放级别 |
| `maxZoom` | number | 否 | null | 最大缩放级别 |

**返回值:** Promise<Object>

**返回值说明:**
- `cameraBound`: 地图边界信息，用于`map.jumpTo()`
- `success`: 加载是否成功
- `error`: 错误信息（如果加载失败）

**示例:**
```
const result = await bicMap.loadSlamMap(map, {
  startX: -11.099993705749512,
  startY: -1.299997329711914,
  xGridCount: 836,
  yGridCount: 734,
  resolution: 0.05,
  imagePath: '/path/to/slam.bmp',
  canvasId: 'canvasMap',
  fitBounds: true,
  opacity: 0.8
});

// 获取相机边界
const cameraBound = result.cameraBound;

// 适应地图到SLAM范围
map.jumpTo(cameraBound);
```

### SLAM地图参数

- `startX`: 起始X坐标
- `startY`: 起始Y坐标
- `xGridCount`: X方向网格数量
- `yGridCount`: Y方向网格数量
- `resolution`: 分辨率
- `imagePath`: SLAM图片路径
- `canvasId`: 画布ID
- `fitBounds`: 是否自动适应边界

## 工具函数

### 坐标转换

```
// GPS转笛卡尔坐标
const cartesian = MapUtils.GPSToCartesian({
  longitude: lng,
  latitude: lat,
  scale: 1,
  zoomFactor: 1
});

// 笛卡尔转GPS坐标
const gps = MapUtils.CartesianToGPS({
  x: cartesian.x,
  y: cartesian.y,
  scale: 1,
  zoomFactor: 1
});
```

### 几何计算

```
// 计算面积
const area = bicMap.turf.area(geometry); // 平方米

// 计算距离
const distance = bicMap.turf.distance(point1, point2, { units: 'kilometers' });

// 计算中心点
const center = bicMap.turf.center(geometry);

// 计算周长
const perimeter = bicMap.turf.length(geometry, { units: 'kilometers' });
```

---

## 示例代码

### Vue组件示例

```
<template>
  <div class="map-container">
    <div id="myMap" style="width: 100%; height: 500px;"></div>
    <div class="controls">
      <button @click="addMarker">添加标记</button>
      <button @click="addPolygon">添加多边形</button>
      <button @click="startDrawing">开始绘制</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import bicMap from './bicMap/core/bicmap-gl';

const map = ref(null);
const markersController = ref(null);
const drawingController = ref(null);

// 初始化地图
const initMap = async () => {
  try {
    await bicMap.init();
    
    map.value = bicMap.createMap({
      container: 'myMap',
      center: [116.3912, 39.9073],
      zoom: 13
    });
    
    map.value.on('load', () => {
      bicMap.addZoomControl(map.value, 'bottom-right');
      console.log('地图加载成功！');
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 添加标记
const addMarker = () => {
  if (!map.value) return;
  
  const marker = bicMap.addDirectionalMarker(map.value, [116.3912, 39.9073], {
    imagePath: '/bicMap/assets/svg/pos.svg',
    draggable: true,
    rotationControl: true,
    initialEditMode: false,
    highlightStyle: {
      backgroundColor: 'rgba(76, 175, 80, 0.15)',
      borderColor: '#4CAF50',
      shadowColor: 'rgba(76, 175, 80, 0.6)'
    },
    onChange: (data) => {
      console.log('标记位置:', data.lngLat);
      console.log('旋转角度:', data.rotation);
    }
  });
};

// 添加多边形
const addPolygon = () => {
  if (!map.value) return;
  
  const polygonController = bicMap.createPolygons(map.value, [{
    id: 'polygon-1',
    points: [
      [116.3912, 39.9073],
      [116.4012, 39.9073],
      [116.4012, 39.9173],
      [116.3912, 39.9173]
    ],
    fillColor: '#4CAF50',
    outlineColor: '#2E7D32'
  }]);
};

// 开始绘制
const startDrawing = () => {
  if (!map.value) return;
  
  drawingController.value = bicMap.enablePolygonDrawing(map.value, {
    onDrawComplete: (polygon, info) => {
      console.log('绘制完成:', polygon);
    }
  });
};

onMounted(() => {
  initMap();
});

onBeforeUnmount(() => {
  if (map.value) {
    map.value.remove();
  }
});
</script>
```

### 原生示例

```
// 初始化地图
async function initMap() {
  try {
    await bicMap.init();
    
    const map = bicMap.createMap({
      container: 'mapContainer',
      center: [116.3912, 39.9073],
      zoom: 13
    });
    
    map.on('load', () => {
      bicMap.addZoomControl(map, 'bottom-right');
      
      // 添加标记
      const marker = bicMap.addDirectionalMarker(map, [116.3912, 39.9073], {
        imagePath: '/bicMap/assets/svg/pos.svg',
        draggable: true,
        rotationControl: true,
        highlightStyle: {
          backgroundColor: 'rgba(76, 175, 80, 0.15)',
          borderColor: '#4CAF50',
          shadowColor: 'rgba(76, 175, 80, 0.6)'
        }
      });
      
      // 添加多边形
      const polygonController = bicMap.createPolygons(map, [{
        id: 'polygon-1',
        points: [
          [116.3912, 39.9073],
          [116.4012, 39.9073],
          [116.4012, 39.9173],
          [116.3912, 39.9173]
        ],
        fillColor: '#4CAF50'
      }]);
      
      // 启用绘制
      const drawingController = bicMap.enablePolygonDrawing(map, {
        onDrawComplete: (polygon) => {
          console.log('绘制完成:', polygon);
        }
      });
    });
    
  } catch (error) {
    console.error('初始化失败:', error);
  }
}

// 启动应用
initMap();
```

---

## 注意事项

1. **初始化顺序**: 必须先调用 `bicMap.init()` 再创建地图
2. **资源清理**: 组件卸载时记得调用 `remove()` 方法清理资源
3. **坐标系统**: 使用WGS84坐标系 (经度, 纬度)
4. **性能优化**: 大量标记使用BatchPOI，点云使用WebGL渲染
5. **移动端支持**: 绘制功能支持触摸操作
6. **事件处理**: 所有交互都有相应的事件回调

---

## 更新日志

- v1.0.0: 初始版本，支持基础地图、标记、绘制功能
- v1.1.0: 新增点云渲染、SLAM地图支持
  -  新增宽线段、批量POI优化
  -  新增多边形编辑模式，支持拖拽顶点编辑和实时坐标回调
  -  新增宽线段高亮和编辑功能，支持拖拽顶点编辑底层Polyline路径
- v1.1.1: 优化宽线段API，推荐使用单个操作方法（addWideLine/updateWideLine/removeWideLine）替代批量更新，提升性能和用户体验
- v1.1.2: 方向标记和批量POI功能增强
  - 方向标记新增高亮样式配置（highlightStyle），支持自定义背景色、边框色和阴影色
  - 方向标记新增初始编辑模式（initialEditMode）和编辑模式控制方法
  - 批量POI标记新增选中样式配置（selectedStyle），支持扩散动画效果
  - 批量POI标记新增更多控制器方法，包括getSelectedMarker、getMarkerById等
  - 优化默认参数值，提升开发体验

---

## 技术支持

如有问题，请参考示例代码或联系技术支持团队。

版权声明 Copyright© 2025 北京人形机器人创新中心有限公司  
