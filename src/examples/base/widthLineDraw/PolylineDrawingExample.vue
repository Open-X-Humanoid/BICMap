<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-10-13 10:00:00
 * @LastEditTime: 2026-04-15 15:32:16
 * @LastEditors: Ella ella.yin@x-humanoid.com
 * @Description: 使用BicMap-GL的线段绘制示例
 * @FilePath: /bic-map-plugin/src/examples/PolylineDrawingExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <h1>线段绘制示例</h1>
    <div class="info">
      <div v-if="!isDrawing">
        <p><strong>准备开始：</strong>点击"开始绘制"按钮开始绘制线段。</p>
      </div>
      <div v-else>
        <p><strong>PC端操作：</strong></p>
        <ul>
          <li>单击地图添加路径点</li>
          <li>双击完成绘制</li>
          <li>按 <kbd>Enter</kbd> 键完成绘制</li>
          <li>按 <kbd>Esc</kbd> 键取消当前绘制</li>
        </ul>
        <p><strong>移动端操作：</strong></p>
        <ul>
          <li>单指点击地图添加路径点</li>
          <li>双击完成绘制</li>
        </ul>
        <p class="tip">已添加 {{ currentPointCount }} 个点 (至少需要 {{ minPoints }} 个点)</p>
        <p class="tip">当前宽度: {{ currentWidth }} 米</p>
      </div>
    </div>
    <div class="content-wrapper">
      <div class="map-wrapper">
        <div id="mapPolylineDrawing" class="map-container"></div>
      </div>
      <div class="info-panel">
        <div v-if="polylineInfo" class="polyline-info">
          <h3>线段信息:</h3>
          <p>宽度: {{ polylineInfo.width }} 米</p>
          <p>长度: {{ polylineInfo.length.toFixed(2) }} 公里</p>
          <p>面积: {{ polylineInfo.area.toFixed(4) }} 平方公里</p>
          <p>路径点数量: {{ polylineInfo.pointCount }}</p>
          <div class="points-info">
            <h4>路径点坐标:</h4>
            <div class="points-list">
              <table>
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>经度</th>
                    <th>纬度</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(point, index) in polylineInfo.path" :key="index">
                    <td>{{ index + 1 }}</td>
                    <td>{{ point[0].toFixed(6) }}</td>
                    <td>{{ point[1].toFixed(6) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div v-else class="no-polyline-message">
          在地图上绘制线段以查看信息
        </div>
      </div>
    </div>
    <div class="controls">
      <button @click="toggleDrawing" :class="{ active: isDrawing }">
        {{ isDrawing ? '停止绘制' : '开始绘制' }}
      </button>
      <button @click="finishDrawing" :disabled="!isDrawing || !canFinish">完成当前绘制</button>
      <button @click="clearPolyline" :disabled="!hasPolyline">清除线段</button>
      <div class="drawing-options">
        <div class="option">
          <label for="fillColor">填充颜色:</label>
          <input type="color" id="fillColor" v-model="drawingOptions.fillColor" @change="updateDrawingOptions">
        </div>
        <div class="option">
          <label for="lineColor">边框颜色:</label>
          <input type="color" id="lineColor" v-model="drawingOptions.lineColor" @change="updateDrawingOptions">
        </div>
        <div class="option">
          <label for="pointColor">顶点颜色:</label>
          <input type="color" id="pointColor" v-model="drawingOptions.pointColor" @change="updateDrawingOptions">
        </div>
        <div class="option">
          <label for="lineWidth">线段宽度(米):</label>
          <input 
            type="number" 
            id="lineWidth" 
            v-model.number="drawingOptions.defaultWidth" 
            min="1" 
            max="200"
            step="1"
            @input="updateWidth"
          >
        </div>
        <div class="option">
          <label for="minPoints">最少点数:</label>
          <input type="number" id="minPoints" v-model.number="drawingOptions.minPoints" min="2" @change="updateDrawingOptions">
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import bicMap from '../../../bicMap/core/bicmap-gl';

// 引用
const map = ref(null);
const drawingController = ref(null);
const isDrawing = ref(false);
const hasPolyline = ref(false);
const polylineInfo = ref(null);
const currentPointCount = ref(0);

// 绘制选项
const drawingOptions = ref({
  fillColor: '#3388ff',
  fillOpacity: 0.8,
  lineColor: '#2266cc',
  lineWidth: 2,
  pointColor: '#FF5722',
  pointRadius: 6,
  defaultWidth: 20,
  enableTouch: true,
  minPoints: 2
});

// 最少点数
const minPoints = computed(() => drawingOptions.value.minPoints);

// 当前宽度
const currentWidth = computed(() => drawingOptions.value.defaultWidth);

// 是否可以完成绘制
const canFinish = computed(() => currentPointCount.value >= minPoints.value);

// 更新当前点数
const updatePointCount = () => {
  if (drawingController.value && drawingController.value.getPoints) {
    const points = drawingController.value.getPoints();
    currentPointCount.value = points.length;
  } else {
    currentPointCount.value = 0;
  }
};

// 初始化地图
const initMap = async () => {
  try {
    // 初始化BicMap
    await bicMap.init();
    
    // 创建新的地图实例
    map.value = bicMap.createMap({
      container: 'mapPolylineDrawing',
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
    currentPointCount.value = 0;
  } else {
    // 启用绘制
    enableDrawing();
    isDrawing.value = true;
  }
};

// 启用绘制模式
const enableDrawing = () => {
  if (!map.value) return;
  
  // 启用线段绘制
  drawingController.value = bicMap.enablePolylineDrawing(map.value, {
    ...drawingOptions.value,
    onDrawComplete: (polylineData) => {
      console.log('线段绘制完成:', polylineData);
      hasPolyline.value = true;
      polylineInfo.value = polylineData;
      isDrawing.value = false;
      currentPointCount.value = 0;
    }
  });
  
  // 设置一个定时器来更新点数
  const updateInterval = setInterval(() => {
    if (!isDrawing.value) {
      clearInterval(updateInterval);
      return;
    }
    updatePointCount();
  }, 100);
};

// 完成当前绘制
const finishDrawing = () => {
  if (drawingController.value && drawingController.value.finishDrawing) {
    const success = drawingController.value.finishDrawing();
    if (success) {
      currentPointCount.value = 0;
    }
  }
};

// 更新宽度
const updateWidth = () => {
  if (isDrawing.value && drawingController.value && drawingController.value.setWidth) {
    drawingController.value.setWidth(drawingOptions.value.defaultWidth);
  }
};

// 更新绘制选项
const updateDrawingOptions = () => {
  if (isDrawing.value && drawingController.value) {
    // 使用新选项重启绘制
    drawingController.value.disable();
    drawingController.value = null;
    currentPointCount.value = 0;
    enableDrawing();
  }
};

// 清除线段
const clearPolyline = () => {
  if (drawingController.value) {
    drawingController.value.clearDrawing();
    hasPolyline.value = false;
    polylineInfo.value = null;
    currentPointCount.value = 0;
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

.info ul {
  margin: 5px 0;
  padding-left: 20px;
}

.info li {
  margin: 3px 0;
}

kbd {
  background-color: #eee;
  border-radius: 3px;
  border: 1px solid #b4b4b4;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
  display: inline-block;
  font-family: monospace;
  font-size: 0.85em;
  padding: 2px 4px;
}

.tip {
  margin-top: 10px;
  padding: 8px;
  background-color: #e3f2fd;
  border-left: 3px solid #2196f3;
  font-weight: bold;
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

.no-polyline-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.polyline-info {
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 4px;
}

.points-info {
  margin-top: 15px;
}

.points-info h4 {
  margin-top: 0;
  margin-bottom: 10px;
}

.points-list {
  max-height: 200px;
  overflow-y: auto;
}

.points-list table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
}

.points-list th, .points-list td {
  border: 1px solid #ccc;
  padding: 6px 8px;
  text-align: left;
}

.points-list th {
  background-color: #e7f3ff;
  font-weight: bold;
  position: sticky;
  top: 0;
}

.points-list tr:nth-child(even) {
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
  font-size: 0.9em;
}

input[type="color"] {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
}

input[type="number"] {
  width: 60px;
  padding: 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
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
  
  .map-wrapper, .info-panel {
    width: 100%;
  }
  
  .info-panel {
    height: 300px;
    margin-top: 10px;
  }
  
  .drawing-options {
    margin-left: 0;
    width: 100%;
  }
}
</style>

