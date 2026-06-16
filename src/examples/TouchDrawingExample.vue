<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-06-18 16:30:00
 * @LastEditTime: 2025-06-18 16:30:00
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 移动端触摸绘制矩形示例
 * @FilePath: /bic-map-plugin/src/examples/TouchDrawingExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <h1>移动端触摸绘制示例</h1>
    <div class="device-info">
      <p><strong>当前设备：</strong>{{ isMobile ? '移动设备' : '桌面设备' }}</p>
      <p><strong>支持触摸：</strong>{{ supportTouch ? '是' : '否' }}</p>
    </div>
    <div class="instructions">
      <div class="instruction-card">
        <h3>📱 移动端操作指南</h3>
        <ul>
          <li><strong>单指拖动</strong>：绘制矩形</li>
          <li><strong>双指拖动</strong>：移动地图</li>
          <li><strong>双指缩放</strong>：放大/缩小地图</li>
        </ul>
      </div>
      <div class="instruction-card">
        <h3>🖱️ 桌面端操作</h3>
        <ul>
          <li><strong>鼠标拖动</strong>：绘制矩形</li>
          <li><strong>滚轮</strong>：缩放地图</li>
          <li><strong>右键拖动</strong>：移动地图</li>
        </ul>
      </div>
    </div>
    
    <div class="map-wrapper">
      <div id="touchDrawingMap" class="map-container"></div>
    </div>
    
    <div class="status-panel" v-if="drawingStatus">
      <div class="status-item">
        <span class="label">绘制状态：</span>
        <span :class="['status', { active: drawingStatus.isDrawing }]">
          {{ drawingStatus.isDrawing ? '正在绘制' : '待命' }}
        </span>
      </div>
      <div class="status-item" v-if="drawingStatus.touchCount > 0">
        <span class="label">触摸点数：</span>
        <span class="value">{{ drawingStatus.touchCount }}</span>
      </div>
      <div class="status-item" v-if="drawingStatus.mapDragEnabled !== undefined">
        <span class="label">地图拖拽：</span>
        <span :class="['status', { enabled: drawingStatus.mapDragEnabled }]">
          {{ drawingStatus.mapDragEnabled ? '启用' : '禁用' }}
        </span>
      </div>
    </div>

    <div class="controls">
      <button @click="toggleDrawing" :class="{ active: isDrawing }">
        {{ isDrawing ? '停止绘制' : '开始绘制' }}
      </button>
      <button @click="clearLastRectangle" :disabled="rectangles.length === 0">
        清除最后矩形
      </button>
      <button @click="clearAllRectangles" :disabled="rectangles.length === 0">
        清除所有矩形
      </button>
    </div>
    
    <div class="rectangle-list" v-if="rectangles.length > 0">
      <h3>已绘制的矩形 ({{ rectangles.length }})</h3>
      <div class="rectangle-item" v-for="(rect, index) in rectangles" :key="index">
        <span class="rectangle-id">矩形 {{ index + 1 }}</span>
        <span class="rectangle-info">
          面积: {{ rect.area.toFixed(2) }} km²
        </span>
        <button @click="removeRectangle(index)" class="remove-btn">删除</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import bicMap from '../bicMap/core/bicmap-gl';

// 引用
const map = ref(null);
const drawingController = ref(null);
const rectangleController = ref(null);
const isDrawing = ref(false);
const rectangles = ref([]);
const drawingStatus = ref(null);

// 设备检测
const isMobile = ref(false);
const supportTouch = ref(false);

// 检测设备类型
const detectDevice = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  isMobile.value = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
  supportTouch.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// 初始化地图
const initMap = async () => {
  try {
    // 检测设备
    detectDevice();
    
    // 初始化BicMap
    await bicMap.init();
    
    // 创建新的地图实例
    map.value = bicMap.createMap({
      container: 'touchDrawingMap',
      center: [116.3912, 39.9073], // 北京
      zoom: 11
    });
    
    // 监听地图加载事件
    map.value.on('load', () => {
      // 添加导航控件
      bicMap.addZoomControl(map.value, 'bottom-right');
      
      // 创建矩形控制器
      rectangleController.value = bicMap.createRectangles(map.value, [], {
        fillColor: '#4CAF50',
        fillOpacity: 0.3,
        outlineColor: '#2E7D32',
        outlineWidth: 2
      });
      
      console.log('地图加载成功！');
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 切换绘制模式
const toggleDrawing = () => {
  if (isDrawing.value) {
    stopDrawing();
  } else {
    startDrawing();
  }
};

// 开始绘制
const startDrawing = () => {
  if (!map.value) return;
  
  isDrawing.value = true;
  
  // 启用矩形绘制，专门针对移动端优化
  drawingController.value = bicMap.enableRectangleDrawing(map.value, {
    fillColor: '#4CAF50',
    fillOpacity: 0.3,
    lineColor: '#2E7D32',
    lineWidth: 3,
    enableTouch: true, // 启用触摸支持
    onDrawComplete: (rectangle, corners) => {
      console.log('矩形绘制完成:', rectangle);
      handleRectangleComplete(rectangle, corners);
    }
  });
  
  // 模拟状态更新（实际应用中，这些状态应该从绘制控制器获取）
  drawingStatus.value = {
    isDrawing: false,
    touchCount: 0,
    mapDragEnabled: true
  };
  
  // 添加状态监听（模拟）
  startStatusMonitoring();
};

// 停止绘制
const stopDrawing = () => {
  if (drawingController.value) {
    drawingController.value.disable();
    drawingController.value = null;
  }
  isDrawing.value = false;
  drawingStatus.value = null;
  stopStatusMonitoring();
};

// 状态监听（简化版本，实际应用中可以从绘制控制器获取更精确的状态）
let statusInterval = null;
const startStatusMonitoring = () => {
  statusInterval = setInterval(() => {
    if (drawingStatus.value && map.value) {
      // 模拟状态更新
      const isDragEnabled = map.value.dragPan.isEnabled();
      drawingStatus.value.mapDragEnabled = isDragEnabled;
    }
  }, 100);
};

const stopStatusMonitoring = () => {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
};

// 处理矩形绘制完成
const handleRectangleComplete = (rectangle, corners) => {
  if (!bicMap.turf || !rectangleController.value) return;
  
  try {
    // 计算面积
    const area = bicMap.turf.area(rectangle) / 1000000; // 转换为平方公里
    
    // 添加到矩形控制器
    const rectId = rectangleController.value.addRectangle({
      coordinates: [corners.southWest, corners.northEast],
      fillColor: '#4CAF50',
      fillOpacity: 0.3,
      outlineColor: '#2E7D32'
    });
    
    // 添加到列表
    rectangles.value.push({
      id: rectId,
      area,
      corners,
      geometry: rectangle.geometry
    });
    
    console.log(`添加矩形 ${rectId}，面积: ${area.toFixed(2)} km²`);
  } catch (error) {
    console.error('处理矩形完成时出错:', error);
  }
};

// 清除最后一个矩形
const clearLastRectangle = () => {
  if (rectangles.value.length === 0) return;
  
  const lastRect = rectangles.value.pop();
  if (rectangleController.value && lastRect.id) {
    rectangleController.value.removeRectangle(lastRect.id);
  }
};

// 清除所有矩形
const clearAllRectangles = () => {
  rectangles.value = [];
  if (rectangleController.value) {
    rectangleController.value.setData([]);
  }
};

// 删除指定矩形
const removeRectangle = (index) => {
  if (index < 0 || index >= rectangles.value.length) return;
  
  const rect = rectangles.value[index];
  if (rectangleController.value && rect.id) {
    rectangleController.value.removeRectangle(rect.id);
  }
  rectangles.value.splice(index, 1);
};

// 组件挂载时初始化地图
onMounted(() => {
  initMap();
});

// 组件卸载时清理
onBeforeUnmount(() => {
  stopStatusMonitoring();
  
  if (drawingController.value) {
    drawingController.value.disable();
    drawingController.value = null;
  }
  
  if (rectangleController.value) {
    rectangleController.value.remove();
    rectangleController.value = null;
  }
  
  if (map.value) {
    map.value.remove();
    map.value = null;
  }
});
</script>

<style scoped>
.example-container {
  display: flex;
  flex-direction: column;
  height: 90vh;
  padding: 20px;
  box-sizing: border-box;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.device-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.device-info p {
  margin: 5px 0;
  font-size: 14px;
}

.instructions {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.instruction-card {
  flex: 1;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
}

.instruction-card h3 {
  margin: 0 0 10px 0;
  color: #495057;
  font-size: 16px;
}

.instruction-card ul {
  margin: 0;
  padding-left: 20px;
}

.instruction-card li {
  margin-bottom: 8px;
  font-size: 14px;
  color: #6c757d;
}

.map-wrapper {
  border: 2px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  height: 400px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.map-container {
  width: 100%;
  height: 100%;
}

.status-panel {
  background: #e3f2fd;
  border: 1px solid #2196f3;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-weight: bold;
  color: #1976d2;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status.active {
  background: #4caf50;
  color: white;
}

.status.enabled {
  background: #2196f3;
  color: white;
}

.status:not(.active):not(.enabled) {
  background: #f44336;
  color: white;
}

.value {
  background: #fff3e0;
  color: #e65100;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 12px;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

button {
  padding: 10px 20px;
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

button:disabled {
  background: #cccccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

button.active {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
}

.rectangle-list {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  max-height: 200px;
  overflow-y: auto;
}

.rectangle-list h3 {
  margin: 0 0 15px 0;
  color: #495057;
}

.rectangle-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  margin-bottom: 8px;
}

.rectangle-id {
  font-weight: bold;
  color: #2196f3;
}

.rectangle-info {
  color: #6c757d;
  font-size: 14px;
}

.remove-btn {
  padding: 4px 8px;
  background: #f44336;
  font-size: 12px;
  margin: 0;
}

@media (max-width: 768px) {
  .instructions {
    flex-direction: column;
  }
  
  .status-panel {
    flex-direction: column;
    gap: 10px;
  }
  
  .controls {
    flex-direction: column;
  }
  
  .rectangle-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style> 