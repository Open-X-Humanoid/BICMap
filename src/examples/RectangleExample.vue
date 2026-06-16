<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-05-10 14:30:30
 * @LastEditTime: 2025-04-29 18:08:56
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 矩形面显示示例
 * @FilePath: /bic-map-plugin/src/examples/RectangleExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <h1>矩形面显示示例</h1>
    <div class="main-content">
      <div class="map-wrapper">
        <div id="rectangleMap" class="map-container"></div>
      </div>
      <div class="sidebar">
        <div class="info-panel">
          <h3>矩形面信息</h3>
          <div><strong>状态:</strong> {{ rectanglesVisible ? '可见' : '隐藏' }}</div>
          <div><strong>矩形数量:</strong> {{ rectangleCount }}</div>
          <div><strong>全局填充状态:</strong> {{ allFilled ? '填充' : '无填充' }}</div>
          <div v-if="selectedRectangle">
            <h4>选中矩形</h4>
            <div><strong>ID:</strong> {{ selectedRectangle.id }}</div>
            <div><strong>填充颜色:</strong> {{ selectedRectangle.fillColor }}</div>
            <div><strong>边框颜色:</strong> {{ selectedRectangle.outlineColor }}</div>
            <div><strong>填充状态:</strong> {{ selectedRectangle.filled ? '填充' : '无填充' }}</div>
            <div><strong>位置:</strong> [{{ formatCoordinates(selectedRectangle.coordinates) }}]</div>
          </div>
          <div class="tip">提示: 点击矩形可以查看详细信息，使用控制面板可以调整矩形的显示效果。</div>
        </div>
        <div class="controls">
          <div class="control-section">
            <button @click="generateRectangles" :disabled="loading">
              {{ rectangleController ? '重新生成矩形' : '生成矩形' }}
            </button>
            <button @click="clearRectangles" :disabled="!rectangleController || loading">清除矩形</button>
          </div>
          <div class="control-section">
            <button @click="toggleRectangles" :disabled="!rectangleController || loading">
              {{ rectanglesVisible ? '隐藏矩形' : '显示矩形' }}
            </button>
            <button @click="addRandomRectangle" :disabled="!rectangleController || loading">添加一个随机矩形</button>
          </div>
          <div class="control-section">
            <button @click="toggleAllFilled" :disabled="!rectangleController || loading">
              {{ allFilled ? '切换为无填充' : '切换为有填充' }}
            </button>
            <button 
              @click="toggleSelectedFilled" 
              :disabled="!rectangleController || !selectedRectangle || loading"
            >
              {{ selectedRectangle && selectedRectangle.filled ? '取消选中矩形填充' : '填充选中矩形' }}
            </button>
          </div>
          <div class="control-group">
            <label>填充不透明度:</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              v-model.number="fillOpacity"
              @change="updateGlobalOptions"
              :disabled="!rectangleController || loading"
            />
            <span>{{ fillOpacity }}</span>
          </div>
          <div class="control-group">
            <label>边框粗细:</label>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              v-model.number="outlineWidth"
              @change="updateGlobalOptions"
              :disabled="!rectangleController || loading"
            />
            <span>{{ outlineWidth }}px</span>
          </div>
          <div class="control-group">
            <label>高亮颜色:</label>
            <input
              type="color"
              v-model="highlightColor"
              @change="updateGlobalOptions"
              :disabled="!rectangleController || loading"
            />
          </div>
        </div>
        <div v-if="rectangleIds.length > 0" class="rectangle-list">
          <h3>矩形列表</h3>
          <ul>
            <li 
              v-for="id in rectangleIds" 
              :key="id" 
              @click="selectRectangle(id)"
              :class="{ active: selectedRectangle && selectedRectangle.id === id }"
            >
              {{ id }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import bicMap from '../bicMap/core/bicmap-gl';

// 地图和矩形控制器引用
const map = ref(null);
const rectangleController = ref(null);
const rectangleIds = ref([]);
const selectedRectangle = ref(null);
const loading = ref(false);

// 矩形设置
const rectanglesVisible = ref(true);
const fillOpacity = ref(0.6);
const outlineWidth = ref(2);
const highlightColor = ref('#ff6600');
const allFilled = ref(true); // 新增: 全局填充状态

// 矩形数量计算属性
const rectangleCount = computed(() => rectangleIds.value.length);

// 格式化坐标显示
const formatCoordinates = (coords) => {
  if (!coords || coords.length !== 2) return '无效坐标';
  return `${coords[0][0].toFixed(4)}, ${coords[0][1].toFixed(4)} - ${coords[1][0].toFixed(4)}, ${coords[1][1].toFixed(4)}`;
};

// 初始化地图
const initMap = async () => {
  try {
    // 初始化BicMap
    await bicMap.init();
    
    // 创建新的地图实例
    map.value = bicMap.createMap({
      container: 'rectangleMap',
      center: [116.3912, 39.9073], // 北京坐标
      zoom: 14,
      pitch: 30,
      bearing: 0,
      antialias: true,
      style: 'mapbox://styles/mapbox/light-v11'
    });
    
    // 监听地图加载事件
    map.value.on('load', () => {      
      // 添加缩放控件
      bicMap.addZoomControl(map.value, 'bottom-right');
      
      console.log('地图加载成功！');
      
      // 自动生成初始矩形
      generateRectangles();
    });
    
    // 监听矩形点击事件
    map.value.on('rectangleclick', (e) => {
      const { rectangleId } = e;
      selectRectangle(rectangleId);
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 生成随机矩形数据
const generateRandomRectangles = (count) => {
  const center = map.value.getCenter();
  const bounds = map.value.getBounds();
  
  // 计算范围的大小
  const lngDiff = bounds._ne.lng - bounds._sw.lng;
  const latDiff = bounds._ne.lat - bounds._sw.lat;
  
  // 生成随机颜色
  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };
  
  // 生成随机矩形
  const rectangles = [];
  for (let i = 0; i < count; i++) {
    // 随机大小
    const width = Math.random() * lngDiff * 0.2;
    const height = Math.random() * latDiff * 0.2;
    
    // 随机起始点
    const sw_lng = center.lng + (Math.random() - 0.5) * lngDiff * 0.8;
    const sw_lat = center.lat + (Math.random() - 0.5) * latDiff * 0.8;
    
    // 计算东北角
    const ne_lng = sw_lng + width;
    const ne_lat = sw_lat + height;
    
    // 随机颜色
    const fillColor = getRandomColor();
    const outlineColor = getRandomColor();
    
    // 创建矩形数据
    rectangles.push({
      id: `rectangle-${i}`,
      coordinates: [
        [sw_lng, sw_lat], // 西南角
        [ne_lng, ne_lat]  // 东北角
      ],
      fillColor,
      outlineColor,
      fillOpacity: Math.random() * 0.5 + 0.3, // 0.3 - 0.8
      outlineWidth: Math.random() * 3 + 1, // 1 - 4
      filled: Math.random() > 0.3 // 70%的矩形有填充
    });
  }
  
  return rectangles;
};

// 生成矩形
const generateRectangles = () => {
  if (!map.value || loading.value) return;
  
  loading.value = true;
  
  // 清除现有矩形
  if (rectangleController.value) {
    rectangleController.value.remove();
  }
  
  // 生成10个随机矩形
  const rectangles = generateRandomRectangles(10);
  
  // 创建矩形控制器
  rectangleController.value = bicMap.createRectangles(map.value, rectangles, {
    fillOpacity: fillOpacity.value,
    outlineWidth: outlineWidth.value,
    highlightColor: highlightColor.value,
    filled: allFilled.value
  });
  
  // 更新矩形ID列表
  rectangleIds.value = rectangleController.value.getRectangleIds();
  
  rectanglesVisible.value = true;
  loading.value = false;
  
  // 清除选中状态
  selectedRectangle.value = null;
};

// 清除矩形
const clearRectangles = () => {
  if (!rectangleController.value || loading.value) return;
  
  rectangleController.value.remove();
  rectangleController.value = null;
  rectangleIds.value = [];
  selectedRectangle.value = null;
};

// 切换矩形可见性
const toggleRectangles = () => {
  if (!rectangleController.value || loading.value) return;
  
  if (rectanglesVisible.value) {
    rectangleController.value.hide();
    rectanglesVisible.value = false;
  } else {
    rectangleController.value.show();
    rectanglesVisible.value = true;
  }
};

// 添加一个随机矩形
const addRandomRectangle = () => {
  if (!rectangleController.value || loading.value) return;
  
  const newRectangles = generateRandomRectangles(1);
  const newRectangleId = rectangleController.value.addRectangle(newRectangles[0]);
  
  // 更新矩形ID列表
  rectangleIds.value = rectangleController.value.getRectangleIds();
  
  // 选中新添加的矩形
  selectRectangle(newRectangleId);
};

// 切换所有矩形的填充状态
const toggleAllFilled = () => {
  if (!rectangleController.value || loading.value) return;
  
  allFilled.value = !allFilled.value;
  rectangleController.value.setAllFilled(allFilled.value);
  
  // 如果有选中的矩形，更新其显示状态
  if (selectedRectangle.value) {
    const feature = rectangleController.value.getRectangleData(selectedRectangle.value.id);
    if (feature) {
      selectedRectangle.value.filled = feature.properties.filled;
    }
  }
};

// 切换选中矩形的填充状态
const toggleSelectedFilled = () => {
  if (!rectangleController.value || !selectedRectangle.value || loading.value) return;
  
  const id = selectedRectangle.value.id;
  rectangleController.value.toggleRectangleFilled(id);
  
  // 更新选中矩形的状态
  const feature = rectangleController.value.getRectangleData(id);
  if (feature) {
    selectedRectangle.value.filled = feature.properties.filled;
  }
};

// 更新全局配置选项
const updateGlobalOptions = () => {
  if (!rectangleController.value || loading.value) return;
  
  // 获取所有矩形
  const allRectangles = rectangleController.value.getAllRectangles();
  
  // 创建新的矩形控制器（替换旧的）
  const rectanglesData = allRectangles.map(feature => {
    const { id, properties } = feature;
    const { coordinates, ...rest } = properties;
    
    return {
      id,
      coordinates: [
        [properties.coordinates[0][0], properties.coordinates[0][1]],
        [properties.coordinates[2][0], properties.coordinates[2][1]]
      ],
      ...rest
    };
  });
  
  // 移除旧的控制器
  rectangleController.value.remove();
  
  // 创建新的控制器并设置数据
  rectangleController.value = bicMap.createRectangles(map.value, rectanglesData, {
    fillOpacity: fillOpacity.value,
    outlineWidth: outlineWidth.value,
    highlightColor: highlightColor.value,
    filled: allFilled.value
  });
  
  // 更新选中状态
  if (selectedRectangle.value) {
    selectRectangle(selectedRectangle.value.id);
  }
};

// 选择矩形
const selectRectangle = (id) => {
  if (!rectangleController.value) return;
  
  // 清除之前的高亮
  rectangleController.value.clearHighlights();
  
  // 获取矩形数据
  const feature = rectangleController.value.getRectangleData(id);
  if (!feature) return;
  
  // 处理矩形数据以便于显示
  const { properties, geometry } = feature;
  const coordinates = [
    [geometry.coordinates[0][0], geometry.coordinates[0][1]],
    [geometry.coordinates[0][2], geometry.coordinates[0][3]]
  ];
  
  // 更新选中矩形
  selectedRectangle.value = {
    id,
    coordinates,
    ...properties
  };
  
  // 高亮选中矩形
  rectangleController.value.highlightRectangle(id);
};

// 组件挂载时初始化地图
onMounted(() => {
  initMap();
});

// 组件卸载时清理
onBeforeUnmount(() => {
  if (rectangleController.value) {
    rectangleController.value.remove();
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
}

.main-content {
  display: flex;
  flex: 1;
  gap: 20px;
  height: calc(90vh - 80px);
}

.map-wrapper {
  flex: 3;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
}

.sidebar {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 300px;
  max-width: 400px;
  overflow-y: auto;
}

.map-container {
  width: 100%;
  height: 100%;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.control-section {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 5px;
}

button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  flex-grow: 1;
}

button:hover {
  background-color: #388E3C;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.control-group label {
  min-width: 100px;
}

.control-group input[type="range"] {
  flex: 1;
}

.info-panel {
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.info-panel h3 {
  margin-top: 0;
  margin-bottom: 15px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 8px;
}

.info-panel h4 {
  margin-top: 15px;
  margin-bottom: 10px;
  padding-top: 10px;
  border-top: 1px dashed #ddd;
}

.info-panel div {
  margin-bottom: 8px;
}

.tip {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px dashed #ddd;
  color: #666;
  font-style: italic;
}

.rectangle-list {
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.rectangle-list h3 {
  margin-top: 0;
  margin-bottom: 15px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 8px;
}

.rectangle-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

.rectangle-list li {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.rectangle-list li:hover {
  background-color: #e9e9e9;
}

.rectangle-list li.active {
  background-color: #dff0d8;
  border-left: 3px solid #4CAF50;
}

@media (max-width: 900px) {
  .main-content {
    flex-direction: column;
  }
  
  .sidebar {
    max-width: 100%;
  }
}
</style> 