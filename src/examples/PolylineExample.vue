<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-29 18:15:30
 * @LastEditTime: 2025-05-07 19:10:54
 * @LastEditors: houser.hao@humanoid.com
 * @Description: Polyline example component
 * @FilePath: /bic-map/src/examples/PolylineExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <div class="map-container" ref="mapContainer"></div>
    
    <div class="control-panel">
      <h3>线段样式控制</h3>
      
      <div class="control-group">
        <label>线段颜色</label>
        <input type="color" v-model="lineStyle.color" @change="updateStyles">
      </div>
      
      <div class="control-group">
        <label>线段宽度</label>
        <input type="range" min="1" max="10" v-model.number="lineStyle.width" @input="updateStyles">
        <span>{{ lineStyle.width }}px</span>
      </div>
      
      <div class="control-group">
        <label>线段透明度</label>
        <input type="range" min="0" max="1" step="0.1" v-model.number="lineStyle.opacity" @input="updateStyles">
        <span>{{ lineStyle.opacity }}</span>
      </div>
      
      <div class="control-group">
        <label>虚线模式</label>
        <select v-model="lineStyle.dashType" @change="updateStyles">
          <option value="solid">实线</option>
          <option value="dashed">虚线</option>
          <option value="dotted">点线</option>
          <option value="dashdot">点划线</option>
        </select>
      </div>
      
      <div class="control-group">
        <label>显示方向箭头</label>
        <div class="switch-container">
          <input type="checkbox" id="arrow-switch" v-model="lineStyle.showArrow" @change="updateStyles" />
          <label for="arrow-switch" class="switch-label"></label>
        </div>
      </div>
      
      <div class="control-group" v-if="lineStyle.showArrow">
        <label>箭头大小</label>
        <input type="range" min="0.1" max="3" step="0.1" v-model.number="lineStyle.arrowSize" @input="updateArrowSize">
        <span>{{ lineStyle.arrowSize }}x</span>
      </div>
      
      <div class="control-group" v-if="lineStyle.showArrow">
        <label>箭头间距</label>
        <input type="range" min="20" max="200" step="10" v-model.number="lineStyle.arrowSpacing" @input="updateStyles">
        <span>{{ lineStyle.arrowSpacing }}px</span>
      </div>
      
      <h3>线段操作</h3>
      
      <div class="button-group">
        <button @click="addRandomLine">添加随机线段</button>
        <button @click="clearLines">清空所有线段</button>
      </div>

      <h3>预设线段集合</h3>
      
      <div class="button-group">
        <button @click="loadPreset('grid')">网格线段</button>
        <button @click="loadPreset('route')">路径线段</button>
        <button @click="loadPreset('multicolor')">多彩线段</button>
        <button @click="loadPreset('arrows')">箭头示例</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import bicMap from '../bicMap/core/bicmap-gl.js';

// 地图容器引用
const mapContainer = ref(null);
// 地图实例
let map = null;
// 线段控制器
let polylinesController = null;

// 当前线段样式
const lineStyle = reactive({
  color: '#3388ff',
  width: 3,
  opacity: 0.8,
  dashType: 'solid',
  showArrow: false,
  arrowSize: 1,
  arrowSpacing: 50
});

// 虚线模式映射到数组
const dashTypeToArray = {
  'solid': [0, 0],
  'dashed': [4, 4],
  'dotted': [1, 3],
  'dashdot': [4, 2, 1, 2]
};

// 地图范围
const mapBounds = {
  minLng: -0.002,
  maxLng: 0.002,
  minLat: -0.002,
  maxLat: 0.002
};

// 预设的线段集合
const linePresets = {
  grid: generateGridLines(),
  route: generateRouteLines(),
  multicolor: generateMultiColorLines(),
  arrows: generateArrowLines()
};

// 当前线段集合
const currentPolylines = ref([]);

// 加载地图
const initMap = async () => {
  try {
    // 初始化BicMap
    await bicMap.init();
    
    // 创建地图
    map = bicMap.createMap({
      container: mapContainer.value,
      center: [0, 0],
      zoom: 16,
      style: {
        version: 8,
        sources: {},
        layers: []
      }
    });
    
    // 等待地图加载完成
    map.on('load', () => {
      // 创建初始线段集合
      polylinesController = bicMap.createPolylines(map, [], {
        onClick: (feature) => {
          console.log('线段点击:', feature.properties);
        }
      });
      
      // 确保控制器初始化完成后加载线段
      setTimeout(() => {
        loadPreset('grid');
      }, 100);
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 更新线段样式
const updateStyles = () => {
  // 更新所有线段的样式
  if (currentPolylines.value.length > 0 && polylinesController) {
    const updatedPolylines = currentPolylines.value.map(line => ({
      ...line,
      color: lineStyle.color,
      width: lineStyle.width,
      opacity: lineStyle.opacity,
      dashType: lineStyle.dashType,
      showArrow: lineStyle.showArrow,
      arrowSize: lineStyle.arrowSize,
      arrowSpacing: lineStyle.arrowSpacing
    }));
    
    currentPolylines.value = updatedPolylines;
    polylinesController.update(updatedPolylines);
  }
};

// 添加随机线段
const addRandomLine = () => {
  if (!polylinesController) return;
  
  const points = [];
  const numPoints = Math.floor(Math.random() * 5) + 2; // 2-6个点
  
  for (let i = 0; i < numPoints; i++) {
    const lng = Math.random() * (mapBounds.maxLng - mapBounds.minLng) + mapBounds.minLng;
    const lat = Math.random() * (mapBounds.maxLat - mapBounds.minLat) + mapBounds.minLat;
    points.push([lng, lat]);
  }
  
  // 随机选择虚线类型
  const dashTypes = ['solid', 'dashed', 'dotted', 'dashdot'];
  const randomDashType = dashTypes[Math.floor(Math.random() * dashTypes.length)];
  
  // 随机颜色
  const randomColor = `#${Math.floor(Math.random()*16777215).toString(16)}`;
  
  const newLine = {
    path: points,
    color: randomColor,
    width: Math.floor(Math.random() * 5) + 2, // 2-6像素宽度
    opacity: 0.8,
    dashType: randomDashType,
    showArrow: lineStyle.showArrow,
    arrowSize: lineStyle.arrowSize,
    arrowSpacing: lineStyle.arrowSpacing,
    name: `随机线段 ${currentPolylines.value.length + 1}`
  };
  
  // 添加到当前线段集合并更新地图
  currentPolylines.value.push(newLine);
  polylinesController.update(currentPolylines.value);
};

// 清空所有线段
const clearLines = () => {
  if (!polylinesController) return;
  
  currentPolylines.value = [];
  polylinesController.clear();
};

// 加载预设线段集合
const loadPreset = (presetName) => {
  if (!polylinesController || !linePresets[presetName]) return;
  
  // 获取预设线段集合
  const preset = linePresets[presetName];
  
  // 特殊处理箭头示例预设
  if (presetName === 'arrows') {
    currentPolylines.value = [...preset];
  } else {
    // 直接使用预设线段（保留所有原始样式属性）
    // 同时应用当前箭头设置
    currentPolylines.value = preset.map(line => ({
      ...line,
      showArrow: presetName === 'route' ? true : lineStyle.showArrow,
      arrowSize: lineStyle.arrowSize,
      arrowSpacing: lineStyle.arrowSpacing
    }));
  }
  
  // 更新地图显示
  polylinesController.update(currentPolylines.value);
};

// 生成网格线段
function generateGridLines() {
  const lines = [];
  const step = 0.0005;
  
  // 水平线
  for (let lat = mapBounds.minLat; lat <= mapBounds.maxLat; lat += step) {
    lines.push({
      path: [[mapBounds.minLng, lat], [mapBounds.maxLng, lat]],
      dashType: 'solid',
      color: '#FF5733', 
      width: 2,
      name: `水平线 ${lat.toFixed(6)}`
    });
  }
  
  // 垂直线
  for (let lng = mapBounds.minLng; lng <= mapBounds.maxLng; lng += step) {
    lines.push({
      path: [[lng, mapBounds.minLat], [lng, mapBounds.maxLat]],
      dashType: 'solid',
      color: '#33FF57',
      width: 2,
      name: `垂直线 ${lng.toFixed(6)}`
    });
  }
  
  return lines;
}

// 生成路径线段
function generateRouteLines() {
  return [
    {
      path: [
        [-0.0015, -0.0015],
        [-0.0005, -0.001],
        [0, 0],
        [0.0005, 0.001],
        [0.0015, 0.0015]
      ],
      dashType: 'solid',
      color: '#FF0000', 
      width: 5,
      showArrow: true,
      arrowSize: 1,
      arrowSpacing: 0.0002,
      name: '主路径'
    },
    {
      path: [
        [0, 0],
        [0.001, -0.001],
        [0.0015, -0.0005]
      ],
      dashType: 'dashed',
      color: '#00FF00', 
      width: 3,
      showArrow: true,
      arrowSize: 1,
      arrowSpacing: 0.0002,
      name: '支路径 1'
    },
    {
      path: [
        [0, 0],
        [-0.001, 0.001],
        [-0.0015, 0.0005]
      ],
      dashType: 'dotted',
      color: '#0000FF', 
      width: 3,
      showArrow: true,
      arrowSize: 1,
      arrowSpacing: 0.0002,
      name: '支路径 2'
    }
  ];
}

// 生成多彩线段
function generateMultiColorLines() {
  const colors = ['#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3'];
  const widths = [2, 3, 4, 5, 6];
  const dashTypes = ['solid', 'dashed', 'dotted', 'dashdot', 'solid'];
  
  const lines = [];
  
  for (let i = 0; i < 5; i++) {
    const startLng = -0.0015 + i * 0.0006;
    
    lines.push({
      path: [
        [startLng, -0.0015],
        [startLng + 0.0005, 0],
        [startLng, 0.0015]
      ],
      color: colors[i % colors.length],
      width: widths[i % widths.length],
      opacity: 0.8,
      dashType: dashTypes[i % dashTypes.length],
      name: `彩色线段 ${i + 1}`
    });
  }
  
  return lines;
}

// 生成箭头示例线段
function generateArrowLines() {
  return [
    {
      path: [
        [-0.0015, 0.001],
        [0.0015, 0.001]
      ],
      dashType: 'solid',
      color: '#FF0000',
      width: 3,
      showArrow: true,
      arrowSize: 1,
      arrowSpacing: 50,
      name: '小箭头示例'
    },
    {
      path: [
        [-0.0015, 0.0005],
        [0.0015, 0.0005]
      ],
      dashType: 'solid',
      color: '#00FF00',
      width: 3,
      showArrow: true,
      arrowSize: 1,
      arrowSpacing: 50,
      name: '中箭头示例'
    },
    {
      path: [
        [-0.0015, 0],
        [0.0015, 0]
      ],
      dashType: 'solid',
      color: '#0000FF',
      width: 3,
      showArrow: true,
      arrowSize: 1,
      arrowSpacing: 50,
      name: '大箭头示例'
    },
    {
      path: [
        [-0.0015, -0.0005],
        [0.0015, -0.0005]
      ],
      dashType: 'solid',
      color: '#FFFF00',
      width: 3,
      showArrow: true,
      arrowSize: 1,
      arrowSpacing: 30,
      name: '密集箭头示例'
    },
    {
      path: [
        [-0.0015, -0.001],
        [0.0015, -0.001]
      ],
      dashType: 'solid',
      color: '#FF00FF',
      width: 3,
      showArrow: true,
      arrowSize: 1,
      arrowSpacing: 100,
      name: '稀疏箭头示例'
    }
  ];
}

// 更新箭头大小
const updateArrowSize = () => {
  if (!polylinesController) return;
  
  // 更新所有线段的箭头大小
  currentPolylines.value.forEach(line => {
    if (line.id) {
      polylinesController.updatePolylineArrowSize(line.id, lineStyle.arrowSize);
    }
  });
  
  // 更新全局箭头大小
  polylinesController.updateArrowSize(lineStyle.arrowSize);
};

// 组件挂载时初始化地图
onMounted(() => {
  initMap();
});
</script>

<style scoped>
.example-container {
  display: flex;
  height: 100%;
  width: 100%;
}

.map-container {
  flex: 1;
  min-height: 500px;
}

.control-panel {
  width: 300px;
  padding: 1rem;
  background-color: #f5f5f5;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: #333;
  font-size: 1rem;
}

.control-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.5rem;
}

.control-group label {
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
  color: #555;
}

.control-group input, .control-group select {
  padding: 0.35rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.control-group input[type="range"] {
  width: 100%;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

button {
  padding: 0.5rem 1rem;
  background-color: #3388ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  flex: 1;
  min-width: 120px;
}

button:hover {
  background-color: #2970d9;
}

/* 开关样式 */
.switch-container {
  display: inline-block;
  position: relative;
}

input[type="checkbox"] {
  height: 0;
  width: 0;
  visibility: hidden;
  position: absolute;
}

.switch-label {
  cursor: pointer;
  width: 50px;
  height: 24px;
  background: #ccc;
  display: block;
  border-radius: 24px;
  position: relative;
}

.switch-label:after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 20px;
  transition: 0.3s;
}

input:checked + .switch-label {
  background: #3388ff;
}

input:checked + .switch-label:after {
  left: calc(100% - 2px);
  transform: translateX(-100%);
}
</style> 