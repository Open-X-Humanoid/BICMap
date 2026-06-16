<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-29 10:35:30
 * @LastEditTime: 2025-05-14 15:25:37
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 点云渲染示例
 * @FilePath: /bic-map/src/examples/PointCloudExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <h1>点云渲染示例 (WebGL)</h1>
    <div class="main-content">
      <div class="map-wrapper">
        <div id="pointCloudMap" class="map-container"></div>
      </div>
      <div class="sidebar">
        <div class="info-panel">
          <h3>点云信息</h3>
          <div><strong>状态:</strong> {{ pointCloudVisible ? '可见' : '隐藏' }}</div>
          <div><strong>模式:</strong> {{ is3D ? '3D' : '2D' }}</div>
          <div><strong>颜色:</strong> {{ useColorMap ? '渐变色 (基于高度)' : pointColor }}</div>
          <div><strong>点数量:</strong> {{ currentPoints.length }}</div>
          <div v-if="is3D"><strong>高度系数:</strong> {{ heightScale }}</div>
          <div v-if="is3D"><strong>高度偏移:</strong> {{ heightOffset }}</div>
          <div class="performance-info">
            <strong>渲染方式:</strong> WebGL (高性能)
            <div class="performance-tip">使用WebGL渲染可以支持10,000+点的流畅展示</div>
          </div>
          <div class="tip">提示: 使用控制面板调整点云的渲染参数，在3D模式下调整视角倾斜可以更好地观察悬浮在空中的点位。</div>
          <div v-if="loading" class="loading">正在生成点云数据...</div>
        </div>
        <div class="controls">
          <div class="control-section">
            <button @click="generateRandomPointCloud" :disabled="loading">生成随机点云</button>
            <button @click="clearPointCloud" :disabled="!pointCloud || loading">清除点云</button>
          </div>
          <div class="control-section">
            <button @click="togglePointCloud" :disabled="!pointCloud || loading">
              {{ pointCloudVisible ? '隐藏点云' : '显示点云' }}
            </button>
            <button @click="updateRandomPointCloud" :disabled="!pointCloud || loading">更新点云数据</button>
          </div>
          <div class="control-section">
            <button @click="toggle3DMode" :disabled="!pointCloud || loading">
              {{ is3D ? '切换到2D模式' : '切换到3D模式' }}
            </button>
            <button @click="toggleColorMap" :disabled="!pointCloud || loading">
              {{ useColorMap ? '使用单色' : '使用渐变色' }}
            </button>
          </div>
          <div class="control-section">
            <button @click="adjustCameraAngle(60)" :disabled="!map || loading">增加视角倾斜</button>
            <button @click="adjustCameraAngle(0)" :disabled="!map || loading">重置视角</button>
          </div>
          <div class="control-group">
            <label>点大小:</label>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              v-model.number="pointSize"
              @change="updatePointCloudOptions"
              :disabled="!pointCloud || loading"
            />
            <span>{{ pointSize }}px</span>
          </div>
          <div class="control-group">
            <label>不透明度:</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              v-model.number="pointOpacity"
              @change="updatePointCloudOptions"
              :disabled="!pointCloud || loading"
            />
            <span>{{ pointOpacity }}</span>
          </div>
          <div class="control-group" v-if="!useColorMap">
            <label>点颜色:</label>
            <input
              type="color"
              v-model="pointColor"
              @change="updatePointCloudOptions"
              :disabled="!pointCloud || loading || useColorMap"
            />
          </div>
          <div class="control-group">
            <label>点数量:</label>
            <input
              type="range"
              min="100"
              max="10000"
              step="100"
              v-model.number="pointCount"
              :disabled="loading"
            />
            <span>{{ pointCount }}</span>
          </div>
          <div class="control-group" v-if="is3D">
            <label>高度系数:</label>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              v-model.number="heightScale"
              @change="updatePointCloudOptions"
              :disabled="!pointCloud || loading || !is3D"
            />
            <span>{{ heightScale }}</span>
          </div>
          <div class="control-group" v-if="is3D">
            <label>高度偏移:</label>
            <input
              type="range"
              min="0"
              max="500"
              step="10"
              v-model.number="heightOffset"
              @change="updatePointCloudOptions"
              :disabled="!pointCloud || loading || !is3D"
            />
            <span>{{ heightOffset }}</span>
          </div>
          <div class="performance-test">
            <h4>性能测试</h4>
            <button @click="performStressTest" :disabled="loading" class="stress-test-btn">
              渲染 10,000 点云压力测试
            </button>
            <div class="performance-result" v-if="performanceResult">
              <strong>结果:</strong> {{ performanceResult }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import bicMap from '../bicMap/core/bicmap-gl';

// 地图和点云控制器引用
const map = ref(null);
const pointCloud = ref(null);
const currentPoints = ref([]);
const loading = ref(false);
const performanceResult = ref('');

// 点云设置
const pointCloudVisible = ref(true);
const is3D = ref(true);
const useColorMap = ref(false);
const pointSize = ref(5);
const pointColor = ref('#ff0000');
const pointOpacity = ref(0.8);
const pointCount = ref(1000);
const heightScale = ref(200);
const heightOffset = ref(0);

// 初始化地图
const initMap = async () => {
  try {
    // 初始化BicMap
    await bicMap.init();
    
    // 创建新的地图实例
    map.value = bicMap.createMap({
      container: 'pointCloudMap',
      center: [116.3912, 39.9073], // 北京坐标
      zoom: 14,
      pitch: 60, // 更大的倾斜角度，便于观察3D点
      bearing: 0,
      antialias: true,
      style: 'mapbox://styles/mapbox/light-v11' // 使用浅色风格以更好地观察点云
    });
    
    // 监听地图加载事件
    map.value.on('load', () => {
      
      // 添加缩放控件
      bicMap.addZoomControl(map.value, 'bottom-right');
      
      console.log('地图加载成功！');
      
      // 自动生成初始点云
      generateRandomPointCloud();
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 调整相机角度以便更好地观察3D效果
const adjustCameraAngle = (pitch) => {
  if (!map.value) return;
  
  map.value.easeTo({
    pitch: pitch,
    duration: 1000
  });
};

// 生成随机点云数据
const generateRandomPoints = (count, is3DMode = true) => {
  const center = map.value.getCenter();
  const bounds = map.value.getBounds();
  
  // 计算范围的大小
  const lngDiff = bounds._ne.lng - bounds._sw.lng;
  const latDiff = bounds._ne.lat - bounds._sw.lat;
  
  // 生成随机点
  const points = [];
  for (let i = 0; i < count; i++) {
    // 随机经纬度，限制在地图视图范围内
    const lng = center.lng + (Math.random() - 0.5) * lngDiff * 0.8;
    const lat = center.lat + (Math.random() - 0.5) * latDiff * 0.8;
    
    if (is3DMode) {
      // 添加随机高度 (第三个坐标)
      const altitude = Math.random() * 5; // 0-5 的随机高度值
      points.push([lng, lat, altitude]);
    } else {
      points.push([lng, lat]);
    }
  }
  
  return points;
};

// 生成随机点云
const generateRandomPointCloud = () => {
  if (!map.value || loading.value) return;
  
  loading.value = true;
  performanceResult.value = '';
  
  // 生成随机点
  setTimeout(() => {
    const startTime = performance.now();
    
    const points = generateRandomPoints(pointCount.value, is3D.value);
    currentPoints.value = points;
    
    // 如果已有点云，先移除
    if (pointCloud.value) {
      pointCloud.value.remove();
    }
    
    // 创建新的点云
    pointCloud.value = bicMap.createPointCloud(map.value, points, {
      pointSize: pointSize.value,
      pointColor: pointColor.value,
      pointOpacity: pointOpacity.value,
      is3D: is3D.value,
      useColorMap: useColorMap.value,
      zRange: [0, 5], // 高度范围
      heightScale: heightScale.value,
      heightOffset: heightOffset.value
    });
    
    const endTime = performance.now();
    console.log(`点云渲染耗时: ${(endTime - startTime).toFixed(2)}ms, 点数: ${points.length}`);
    
    pointCloudVisible.value = true;
    loading.value = false;
    
    // 如果是3D模式，确保视角有适当的倾斜
    if (is3D.value && map.value.getPitch() < 30) {
      adjustCameraAngle(60);
    }
  }, 100);
};

// 更新点云数据
const updateRandomPointCloud = () => {
  if (!pointCloud.value || !map.value || loading.value) return;
  
  loading.value = true;
  performanceResult.value = '';
  
  // 生成新的随机点
  setTimeout(() => {
    const startTime = performance.now();
    
    const points = generateRandomPoints(pointCount.value, is3D.value);
    currentPoints.value = points;
    
    // 更新点云数据
    pointCloud.value.update(points);
    
    const endTime = performance.now();
    console.log(`点云更新耗时: ${(endTime - startTime).toFixed(2)}ms, 点数: ${points.length}`);
    
    loading.value = false;
  }, 100);
};

// 更新点云选项
const updatePointCloudOptions = () => {
  if (!pointCloud.value || loading.value) return;
  
  pointCloud.value.update(currentPoints.value, {
    pointSize: pointSize.value,
    pointColor: pointColor.value,
    pointOpacity: pointOpacity.value,
    is3D: is3D.value,
    useColorMap: useColorMap.value,
    zRange: [0, 5],
    heightScale: heightScale.value,
    heightOffset: heightOffset.value
  });
};

// 切换点云可见性
const togglePointCloud = () => {
  if (!pointCloud.value || loading.value) return;
  
  if (pointCloudVisible.value) {
    pointCloud.value.hide();
    pointCloudVisible.value = false;
  } else {
    pointCloud.value.show();
    pointCloudVisible.value = true;
  }
};

// 切换3D/2D模式
const toggle3DMode = () => {
  if (!pointCloud.value || loading.value) return;
  
  is3D.value = !is3D.value;
  
  // 尝试使用set3D方法
  if (pointCloud.value.set3D) {
    pointCloud.value.set3D(is3D.value);
    
    // 更新点云选项
    updatePointCloudOptions();
    
    // 调整相机角度
    adjustCameraAngle(is3D.value ? 60 : 0);
  } else {
    // 如果不支持set3D方法，则重新生成点云
    generateRandomPointCloud();
  }
};

// 切换渐变色/单色
const toggleColorMap = () => {
  if (!pointCloud.value || loading.value) return;
  
  useColorMap.value = !useColorMap.value;
  
  // 更新点云选项
  updatePointCloudOptions();
};

// 清除点云
const clearPointCloud = () => {
  if (!pointCloud.value || loading.value) return;
  
  pointCloud.value.remove();
  pointCloud.value = null;
  currentPoints.value = [];
  performanceResult.value = '';
};

// 性能压力测试
const performStressTest = () => {
  if (!map.value || loading.value) return;
  
  loading.value = true;
  performanceResult.value = '';
  
  setTimeout(() => {
    // 设置点数为10000
    const testCount = 10000;
    
    const startTime = performance.now();
    
    const points = generateRandomPoints(testCount, is3D.value);
    currentPoints.value = points;
    
    // 如果已有点云，先移除
    if (pointCloud.value) {
      pointCloud.value.remove();
    }
    
    // 创建新的点云
    pointCloud.value = bicMap.createPointCloud(map.value, points, {
      pointSize: 3, // 小一点的点尺寸，避免太拥挤
      pointColor: pointColor.value,
      pointOpacity: pointOpacity.value,
      is3D: is3D.value,
      useColorMap: useColorMap.value,
      zRange: [0, 5],
      heightScale: heightScale.value,
      heightOffset: heightOffset.value
    });
    
    const endTime = performance.now();
    const renderTime = (endTime - startTime).toFixed(2);
    
    // 更新UI
    pointCount.value = testCount;
    pointCloudVisible.value = true;
    performanceResult.value = `成功渲染 ${testCount} 个点，耗时 ${renderTime}ms`;
    console.log(`性能测试: 渲染 ${testCount} 个点，耗时 ${renderTime}ms`);
    
    loading.value = false;
  }, 100);
};

// 组件挂载时初始化地图
onMounted(() => {
  initMap();
});

// 组件卸载时清理
onBeforeUnmount(() => {
  if (pointCloud.value) {
    pointCloud.value.remove();
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
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.sidebar {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 300px;
  max-width: 400px;
}

.map-container {
  width: 100%;
  height: 100%;
}

/* 点云样式 */
:global(.point-cloud-marker) {
  cursor: default;
  will-change: transform;
  transition: transform 0.3s ease-out, width 0.3s, height 0.3s, opacity 0.3s;
}

:global(.point-cloud-container) {
  pointer-events: none;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  overflow-y: auto;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
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
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #45a049;
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
  min-width: 70px;
}

.control-group input[type="range"] {
  flex: 1;
}

.info-panel {
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  margin-bottom: 15px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.info-panel h3 {
  margin-top: 0;
  margin-bottom: 15px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 8px;
}

.info-panel div {
  margin-bottom: 8px;
}

.performance-info {
  margin-top: 15px;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 4px;
  border-left: 4px solid #4CAF50;
}

.performance-tip {
  margin-top: 5px;
  font-size: 0.9em;
  color: #2e7d32;
}

.tip {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px dashed #ddd;
  color: #666;
  font-style: italic;
}

.loading {
  margin-top: 10px;
  color: #ff6600;
  font-weight: bold;
}

.performance-test {
  margin-top: 20px;
  padding: 15px;
  background-color: #f0f4f8;
  border-radius: 4px;
  border: 1px solid #d0e0f0;
}

.performance-test h4 {
  margin-top: 0;
  margin-bottom: 10px;
}

.stress-test-btn {
  background-color: #2196F3;
  width: 100%;
  margin: 10px 0;
}

.stress-test-btn:hover:not(:disabled) {
  background-color: #1976D2;
}

.performance-result {
  margin-top: 10px;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 4px;
  font-size: 0.9em;
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