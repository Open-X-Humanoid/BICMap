<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-06-20 21:15:00
 * @LastEditTime: 2025-06-20 21:15:00
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 多边形面显示示例
 * @FilePath: /bic-map-plugin/src/examples/PolygonExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <h1>多边形面显示示例</h1>
    <div class="main-content">
      <div class="map-wrapper">
        <div id="polygonMap" class="map-container"></div>
      </div>
      <div class="sidebar">
        <div class="info-panel">
          <h3>多边形面信息</h3>
          <div><strong>状态:</strong> {{ polygonsVisible ? '可见' : '隐藏' }}</div>
          <div><strong>多边形数量:</strong> {{ polygonCount }}</div>
          <div><strong>全局填充状态:</strong> {{ allFilled ? '填充' : '无填充' }}</div>
          <div v-if="selectedPolygon">
            <h4>选中多边形</h4>
            <div><strong>ID:</strong> {{ selectedPolygon.id }}</div>
            <div><strong>填充颜色:</strong> {{ selectedPolygon.fillColor }}</div>
            <div><strong>边框颜色:</strong> {{ selectedPolygon.outlineColor }}</div>
            <div><strong>填充状态:</strong> {{ selectedPolygon.filled ? '填充' : '无填充' }}</div>
            <div><strong>顶点数量:</strong> {{ selectedPolygon.pointCount }}</div>
            <div><strong>编辑状态:</strong> {{ isEditMode ? '编辑中' : '未编辑' }}</div>
          </div>
          <div v-if="isEditMode && editData" class="edit-info">
            <h4>编辑坐标信息</h4>
            <div><strong>多边形ID:</strong> {{ editData.polygonId }}</div>
            <div><strong>顶点数量:</strong> {{ editData.points.length }}</div>
            <div><strong>拖拽状态:</strong> {{ editData.isDragging ? '拖拽中' : '静止' }}</div>
            <div v-if="editData.isDragging && editData.dragPointIndex >= 0">
              <strong>拖拽顶点:</strong> 第{{ editData.dragPointIndex + 1 }}个点
            </div>
            <div class="coordinates-display">
              <h5>当前坐标:</h5>
              <div class="coordinates-list">
                <div v-for="(point, index) in editData.points" :key="index" 
                     :class="{ 'dragging': editData.isDragging && editData.dragPointIndex === index }">
                  <span class="point-index">{{ index + 1 }}.</span>
                  <span class="coordinates">[{{ point[0].toFixed(6) }}, {{ point[1].toFixed(6) }}]</span>
                </div>
              </div>
            </div>
          </div>
          <div class="tip">提示: 点击多边形可以查看详细信息，使用控制面板可以调整多边形的显示效果。编辑模式下可以拖拽顶点调整形状。</div>
        </div>
        <div class="controls">
          <div class="control-section">
            <button @click="generatePolygons" :disabled="loading">
              {{ polygonController ? '重新生成多边形' : '生成多边形' }}
            </button>
            <button @click="clearPolygons" :disabled="!polygonController || loading">清除多边形</button>
          </div>
          <div class="control-section">
            <button @click="togglePolygons" :disabled="!polygonController || loading">
              {{ polygonsVisible ? '隐藏多边形' : '显示多边形' }}
            </button>
            <button @click="addRandomPolygon" :disabled="!polygonController || loading">添加一个随机多边形</button>
          </div>
          <div class="control-section">
            <button @click="toggleAllFilled" :disabled="!polygonController || loading">
              {{ allFilled ? '切换为无填充' : '切换为有填充' }}
            </button>
            <button 
              @click="toggleSelectedFilled" 
              :disabled="!polygonController || !selectedPolygon || loading"
            >
              {{ selectedPolygon && selectedPolygon.filled ? '取消选中多边形填充' : '填充选中多边形' }}
            </button>
            <button 
              @click="toggleEditMode" 
              :disabled="!polygonController || !selectedPolygon || loading"
              :class="{ active: isEditMode }"
            >
              {{ isEditMode ? '退出编辑模式' : '进入编辑模式' }}
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
              :disabled="!polygonController || loading"
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
              :disabled="!polygonController || loading"
            />
            <span>{{ outlineWidth }}px</span>
          </div>
          <div class="control-group">
            <label>高亮颜色:</label>
            <input
              type="color"
              v-model="highlightColor"
              @change="updateGlobalOptions"
              :disabled="!polygonController || loading"
            />
          </div>
        </div>
        <div v-if="polygonIds.length > 0" class="polygon-list">
          <h3>多边形列表</h3>
          <ul>
            <li 
              v-for="id in polygonIds" 
              :key="id" 
              @click="selectPolygon(id)"
              :class="{ active: selectedPolygon && selectedPolygon.id === id }"
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

// 地图和多边形控制器引用
const map = ref(null);
const polygonController = ref(null);
const polygonIds = ref([]);
const selectedPolygon = ref(null);
const loading = ref(false);

// 多边形设置
const polygonsVisible = ref(true);
const fillOpacity = ref(0.6);
const outlineWidth = ref(2);
const highlightColor = ref('#ff6600');
const allFilled = ref(true);

// 编辑模式状态
const isEditMode = ref(false);
const editData = ref(null);
const editHistory = ref([]);

// 多边形数量计算属性
const polygonCount = computed(() => polygonIds.value.length);

// 初始化地图
const initMap = async () => {
  try {
    // 初始化BicMap
    await bicMap.init();
    
    // 创建新的地图实例
    map.value = bicMap.createMap({
      container: 'polygonMap',
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
      
      // 自动生成初始多边形
      generatePolygons();
    });
    
    // 监听多边形点击事件
    map.value.on('polygonclick', (e) => {
      const { polygonId } = e;
      selectPolygon(polygonId);
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 生成随机多边形数据
const generateRandomPolygons = (count) => {
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
  
  // 生成随机多边形
  const polygons = [];
  for (let i = 0; i < count; i++) {
    // 随机中心点
    const centerLng = center.lng + (Math.random() - 0.5) * lngDiff * 0.8;
    const centerLat = center.lat + (Math.random() - 0.5) * latDiff * 0.8;
    
    // 随机顶点数量 (3-8个顶点)
    const vertexCount = Math.floor(Math.random() * 6) + 3;
    
    // 随机半径
    const radius = Math.random() * Math.min(lngDiff, latDiff) * 0.1;
    
    // 生成多边形顶点
    const points = [];
    for (let j = 0; j < vertexCount; j++) {
      const angle = (j / vertexCount) * Math.PI * 2;
      // 添加一些随机变化让多边形不那么规则
      const r = radius * (0.7 + Math.random() * 0.6);
      const lng = centerLng + Math.cos(angle) * r;
      const lat = centerLat + Math.sin(angle) * r;
      points.push([lng, lat]);
    }
    
    // 随机颜色
    const fillColor = getRandomColor();
    const outlineColor = getRandomColor();
    
    // 创建多边形数据
    polygons.push({
      id: `polygon-${i}`,
      points,
      fillColor,
      outlineColor,
      fillOpacity: Math.random() * 0.5 + 0.3, // 0.3 - 0.8
      outlineWidth: Math.random() * 3 + 1, // 1 - 4
      filled: Math.random() > 0.3 // 70%的多边形有填充
    });
  }
  
  return polygons;
};

// 生成多边形
const generatePolygons = () => {
  if (!map.value || loading.value) return;
  
  loading.value = true;
  
  // 清除现有多边形
  if (polygonController.value) {
    polygonController.value.remove();
  }
  
  // 生成10个随机多边形
  const polygons = generateRandomPolygons(10);
  
  // 创建多边形控制器
  polygonController.value = bicMap.createPolygons(map.value, polygons, {
    fillOpacity: fillOpacity.value,
    outlineWidth: outlineWidth.value,
    highlightColor: highlightColor.value,
    filled: allFilled.value
  });
  
  // 更新多边形ID列表
  polygonIds.value = polygonController.value.getPolygonIds();
  
  polygonsVisible.value = true;
  loading.value = false;
  
  // 清除选中状态
  selectedPolygon.value = null;
};

// 清除多边形
const clearPolygons = () => {
  if (!polygonController.value || loading.value) return;
  
  polygonController.value.remove();
  polygonController.value = null;
  polygonIds.value = [];
  selectedPolygon.value = null;
};

// 切换多边形可见性
const togglePolygons = () => {
  if (!polygonController.value || loading.value) return;
  
  if (polygonsVisible.value) {
    polygonController.value.hide();
    polygonsVisible.value = false;
  } else {
    polygonController.value.show();
    polygonsVisible.value = true;
  }
};

// 添加一个随机多边形
const addRandomPolygon = () => {
  if (!polygonController.value || loading.value) return;
  
  const newPolygons = generateRandomPolygons(1);
  const newPolygonId = polygonController.value.addPolygon(newPolygons[0]);
  
  // 更新多边形ID列表
  polygonIds.value = polygonController.value.getPolygonIds();
  
  // 选中新添加的多边形
  selectPolygon(newPolygonId);
};

// 切换所有多边形的填充状态
const toggleAllFilled = () => {
  if (!polygonController.value || loading.value) return;
  
  allFilled.value = !allFilled.value;
  polygonController.value.setAllFilled(allFilled.value);
  
  // 如果有选中的多边形，更新其显示状态
  if (selectedPolygon.value) {
    const feature = polygonController.value.getPolygonData(selectedPolygon.value.id);
    if (feature) {
      selectedPolygon.value.filled = feature.properties.filled;
    }
  }
};

// 切换选中多边形的填充状态
const toggleSelectedFilled = () => {
  if (!polygonController.value || !selectedPolygon.value || loading.value) return;
  
  const id = selectedPolygon.value.id;
  polygonController.value.togglePolygonFilled(id);
  
  // 更新选中多边形的状态
  const feature = polygonController.value.getPolygonData(id);
  if (feature) {
    selectedPolygon.value.filled = feature.properties.filled;
  }
};

// 更新全局配置选项
const updateGlobalOptions = () => {
  if (!polygonController.value || loading.value) return;
  
  // 获取所有多边形
  const allPolygons = polygonController.value.getAllPolygons();
  
  // 创建新的多边形控制器（替换旧的）
  const polygonsData = allPolygons.map(feature => {
    const { id, properties, geometry } = feature;
    
    return {
      id,
      points: geometry.coordinates[0].slice(0, -1), // 移除闭合点
      ...properties
    };
  });
  
  // 移除旧的控制器
  polygonController.value.remove();
  
  // 创建新的控制器并设置数据
  polygonController.value = bicMap.createPolygons(map.value, polygonsData, {
    fillOpacity: fillOpacity.value,
    outlineWidth: outlineWidth.value,
    highlightColor: highlightColor.value,
    filled: allFilled.value
  });
  
  // 更新选中状态
  if (selectedPolygon.value) {
    selectPolygon(selectedPolygon.value.id);
  }
};

// 选择多边形
const selectPolygon = (id) => {
  if (!polygonController.value) return;
  
  // 如果当前在编辑模式，先退出编辑模式
  if (isEditMode.value) {
    exitEditMode();
  }
  
  // 清除之前的高亮
  polygonController.value.clearHighlights();
  
  // 获取多边形数据
  const feature = polygonController.value.getPolygonData(id);
  if (!feature) return;
  
  // 处理多边形数据以便于显示
  const { properties, geometry } = feature;
  const points = geometry.coordinates[0].slice(0, -1); // 移除闭合点
  
  // 更新选中多边形
  selectedPolygon.value = {
    id,
    pointCount: points.length,
    ...properties
  };
  
  // 高亮选中多边形
  polygonController.value.highlightPolygon(id);
};

// 切换编辑模式
const toggleEditMode = () => {
  if (!polygonController.value || !selectedPolygon.value) return;
  
  if (isEditMode.value) {
    exitEditMode();
  } else {
    enterEditMode();
  }
};

// 进入编辑模式
const enterEditMode = () => {
  if (!polygonController.value || !selectedPolygon.value) return;
  
  const callbacks = {
    onEditStart: (data) => {
      console.log('开始编辑:', data);
      editData.value = data;
      editHistory.value = [data];
    },
    onEditUpdate: (data) => {
      console.log('编辑更新:', data);
      editData.value = data;
      editHistory.value.push(data);
      
      // 限制历史记录数量，避免内存过多占用
      if (editHistory.value.length > 100) {
        editHistory.value = editHistory.value.slice(-50);
      }
    },
    onEditEnd: (data) => {
      console.log('结束编辑:', data);
      editData.value = null;
      editHistory.value = [];
    }
  };
  
  const success = polygonController.value.enterEditMode(selectedPolygon.value.id, callbacks);
  if (success) {
    isEditMode.value = true;
    console.log('进入编辑模式，多边形ID:', selectedPolygon.value.id);
  }
};

// 退出编辑模式
const exitEditMode = () => {
  if (!polygonController.value) return;
  
  polygonController.value.exitEditMode();
  isEditMode.value = false;
  console.log('退出编辑模式');
};

// 组件挂载时初始化地图
onMounted(() => {
  initMap();
});

// 组件卸载时清理
onBeforeUnmount(() => {
  // 退出编辑模式
  if (isEditMode.value) {
    exitEditMode();
  }
  
  if (polygonController.value) {
    polygonController.value.remove();
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

button.active {
  background-color: #f44336;
}

button.active:hover {
  background-color: #d32f2f;
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

.polygon-list {
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.polygon-list h3 {
  margin-top: 0;
  margin-bottom: 15px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 8px;
}

.polygon-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

.polygon-list li {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.polygon-list li:hover {
  background-color: #e9e9e9;
}

.polygon-list li.active {
  background-color: #dff0d8;
  border-left: 3px solid #4CAF50;
}

.edit-info {
  margin-top: 15px;
  padding: 15px;
  background-color: #e8f5e8;
  border-radius: 4px;
  border: 1px solid #4CAF50;
}

.edit-info h4 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #2E7D32;
}

.coordinates-display {
  margin-top: 10px;
}

.coordinates-display h5 {
  margin: 10px 0 5px 0;
  color: #2E7D32;
}

.coordinates-list {
  max-height: 150px;
  overflow-y: auto;
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
}

.coordinates-list div {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  margin: 2px 0;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.coordinates-list div:hover {
  background-color: #e9e9e9;
}

.coordinates-list div.dragging {
  background-color: #ffeb3b;
  font-weight: bold;
}

.point-index {
  min-width: 30px;
  font-weight: bold;
  color: #666;
}

.coordinates {
  font-family: monospace;
  font-size: 0.9em;
  color: #333;
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

