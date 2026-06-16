<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-24 17:30:30
 * @LastEditTime: 2025-06-18 16:19:23
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 使用BicMap-GL的矩形绘制示例
 * @FilePath: /bic-map-plugin/src/examples/RectangleDrawingExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <h1>矩形绘制示例</h1>
    <div class="info">
      <div v-if="!isDrawing">
        <p><strong>PC端操作：</strong>点击"开始绘制"按钮，然后在地图上点击并拖动鼠标来绘制矩形。</p>
        <p><strong>移动端操作：</strong>点击"开始绘制"按钮，然后用单指点击并拖动来绘制矩形，双指可以拖动地图。</p>
      </div>
      <div v-else>
        <p><strong>PC端：</strong>在地图上点击并拖动鼠标以绘制矩形。释放鼠标按钮完成绘制。</p>
        <p><strong>移动端：</strong>单指拖动绘制矩形，双指拖动地图。松开手指完成矩形绘制。</p>
      </div>
    </div>
    <div class="content-wrapper">
      <div class="map-wrapper">
        <div id="mapDrawing" class="map-container"></div>
      </div>
      <div class="info-panel">
        <div v-if="rectangleInfo" class="rectangle-info">
          <h3>矩形信息:</h3>
          <p>面积: {{ rectangleInfo.area.toFixed(2) }} 平方公里</p>
          <p>周长: {{ rectangleInfo.perimeter.toFixed(2) }} 公里</p>
          <p>中心点: {{ rectangleInfo.center[0].toFixed(6) }}, {{ rectangleInfo.center[1].toFixed(6) }}</p>
          <div class="corners-info">
            <h4>角点坐标:</h4>
            <table>
              <thead>
                <tr>
                  <th>角点</th>
                  <th>经度</th>
                  <th>纬度</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(coords, name) in rectangleInfo.corners" :key="name">
                  <td>{{ formatCornerName(name) }}</td>
                  <td>{{ coords[0].toFixed(6) }}</td>
                  <td>{{ coords[1].toFixed(6) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else class="no-rectangle-message">
          在地图上绘制矩形以查看信息
        </div>
      </div>
    </div>
    <div class="controls">
      <button @click="toggleDrawing" :class="{ active: isDrawing }">
        {{ isDrawing ? '停止绘制' : '开始绘制' }}
      </button>
      <button @click="clearRectangle" :disabled="!hasRectangle">清除矩形</button>
      <div class="drawing-options">
        <div class="option">
          <label for="fillColor">填充颜色:</label>
          <input type="color" id="fillColor" v-model="drawingOptions.fillColor" @change="updateDrawingOptions">
        </div>
        <div class="option">
          <label for="lineColor">线条颜色:</label>
          <input type="color" id="lineColor" v-model="drawingOptions.lineColor" @change="updateDrawingOptions">
        </div>
        <div class="option">
          <label for="enableTouch">启用触摸:</label>
          <input type="checkbox" id="enableTouch" v-model="drawingOptions.enableTouch" @change="updateDrawingOptions">
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import bicMap from '../../../bicMap/core/bicmap-gl';

// 引用
const map = ref(null);
const drawingController = ref(null);
const isDrawing = ref(false);
const hasRectangle = ref(false);
const rectangleInfo = ref(null);

// 绘制选项
const drawingOptions = ref({
  fillColor: '#4CAF50',
  fillOpacity: 0,
  lineColor: '#4CAF50',
  lineWidth: 3,
  enableTouch: true // 默认启用触摸支持
});

// 初始化地图
const initMap = async () => {
  try {
    // 初始化BicMap
    await bicMap.init();
    
    // 创建新的地图实例
    map.value = bicMap.createMap({
      container: 'mapDrawing',
      center: [116.3912, 39.9073], // 北京
      zoom: 11
    });
    
    // 监听地图加载事件
    map.value.on('load', () => {
      // 添加导航控件
      bicMap.addZoomControl(map.value, 'bottom-right');
      console.log('地图加载成功！');
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 切换绘制模式
const toggleDrawing = () => {
  if (isDrawing.value) {
    // 禁用绘制
    if (drawingController.value) {
      drawingController.value.disable();
      drawingController.value = null;
    }
    isDrawing.value = false;
  } else {
    // 启用绘制
    enableDrawing();
    isDrawing.value = true;
  }
};

// 启用绘制模式
const enableDrawing = () => {
  if (!map.value) return;
  
  // 启用矩形绘制
  drawingController.value = bicMap.enableRectangleDrawing(map.value, {
    ...drawingOptions.value,
    onDrawComplete: (rectangle, corners) => {
      console.log('矩形绘制完成:', rectangle);
      console.log('矩形角点:', corners);
      hasRectangle.value = true;
      calculateRectangleInfo(rectangle, corners);
    }
  });
};

// 计算矩形信息
const calculateRectangleInfo = (rectangle, corners) => {
  if (!bicMap.turf) return;
  
  try {
    // 计算面积（平方公里）
    const area = bicMap.turf.area(rectangle) / 1000000; // 转换为平方公里
    
    // 计算周长
    const coordinates = rectangle.geometry.coordinates[0];
    let perimeter = 0;
    
    for (let i = 0; i < coordinates.length - 1; i++) {
      const from = bicMap.turf.point(coordinates[i]);
      const to = bicMap.turf.point(coordinates[i + 1]);
      perimeter += bicMap.turf.distance(from, to, { units: 'kilometers' });
    }
    
    // 计算中心点
    const center = bicMap.turf.center(rectangle).geometry.coordinates;
    
    // 存储信息
    rectangleInfo.value = {
      area,
      perimeter,
      center,
      corners
    };
  } catch (error) {
    console.error('计算矩形信息时出错:', error);
  }
};

// 格式化角点名称以便显示
const formatCornerName = (name) => {
  switch (name) {
    case 'northWest': return '西北 (左上)';
    case 'northEast': return '东北 (右上)';
    case 'southEast': return '东南 (右下)';
    case 'southWest': return '西南 (左下)';
    default: return name;
  }
};

// 更新绘制选项
const updateDrawingOptions = () => {
  if (isDrawing.value && drawingController.value) {
    // 使用新选项重启绘制
    drawingController.value.disable();
    drawingController.value = null;
    enableDrawing();
  }
};

// 清除矩形
const clearRectangle = () => {
  if (drawingController.value) {
    drawingController.value.clearDrawing();
    hasRectangle.value = false;
    rectangleInfo.value = null;
  }
};

// 组件挂载时初始化地图
onMounted(() => {
  initMap();
});

// 组件卸载时清理
onBeforeUnmount(() => {
  if (drawingController.value) {
    drawingController.value.disable();
    drawingController.value = null;
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
  height: 75vh;
  padding: 20px;
  box-sizing: border-box;
}

.info {
  margin-bottom: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.content-wrapper {
  display: flex;
  margin-bottom: 20px;
  width: 100%;
}

.map-wrapper {
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
  width: 50%;
  height: 500px;
}

.info-panel {
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: auto;
  padding: 10px;
  background-color: #f9f9f9;
  width: 50%;
}

.no-rectangle-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.rectangle-info {
  padding: 10px;
  background-color: #e0f7fa;
  border-radius: 4px;
}

.corners-info {
  margin-top: 15px;
}

.corners-info h4 {
  margin-top: 0;
  margin-bottom: 10px;
}

.corners-info table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
}

.corners-info th, .corners-info td {
  border: 1px solid #ccc;
  padding: 8px;
  text-align: left;
}

.corners-info th {
  background-color: #e7f3ff;
  font-weight: bold;
}

.corners-info tr:nth-child(even) {
  background-color: #f9f9f9;
}

.map-container {
  width: 100%;
  height: 100%;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
  flex-wrap: wrap;
}

button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  cursor: pointer;
  border-radius: 4px;
}

button:hover {
  background-color: #45a049;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

button.active {
  background-color: #f44336;
}

button.active:hover {
  background-color: #d32f2f;
}

.drawing-options {
  display: flex;
  gap: 15px;
  margin-left: 20px;
}

.option {
  display: flex;
  align-items: center;
  gap: 5px;
}

.option label {
  font-weight: bold;
}

input[type="color"] {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
}

input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

@media (max-width: 900px) {
  .content-wrapper {
    flex-direction: column;
  }
  
  .info-panel {
    width: 100%;
    height: 300px;
  }
}
</style> 