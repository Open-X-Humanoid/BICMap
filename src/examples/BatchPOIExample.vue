<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-30 20:15:30
 * @LastEditTime: 2025-06-21 10:04:34
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 批量POI点位示例
 * @FilePath: /bic-map/src/examples/BatchPOIExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <h1>批量POI点位示例</h1>
    <div class="map-wrapper">
      <div id="batchPoiMap" class="map-container"></div>
    </div>
    <div class="controls">
      <div class="control-section">
        <button @click="loadMarkers(100)">加载100个POI</button>
        <button @click="loadMarkers(500)">加载500个POI</button>
        <button @click="loadMarkers(1000)">加载1000个POI</button>
        <button @click="clearMarkers">清除点位</button>
      </div>
      <div class="control-section">
        <label>旋转所有点位:</label>
        <input type="range" min="0" max="360" v-model="rotationValue" @input="rotateAllMarkers" />
        <span>{{ rotationValue }}°</span>
      </div>
      <div class="control-section">
        <button @click="generateRandomMovement">随机移动点位</button>
        <button @click="generateRandomRotation">随机旋转点位</button>
        <label class="toggle-label">
          <input type="checkbox" v-model="showLabels" @change="handleLabelToggle" />
          显示标签
        </label>
      </div>
      <div class="control-section">
        <label class="toggle-label">
          <input type="checkbox" v-model="markersSelectable" @change="handleSelectableToggle" />
          启用点位选中功能
        </label>
        <button @click="testSelectById" :disabled="!markersSelectable">测试根据ID选中</button>
        <button @click="clearSelection" :disabled="!markersSelectable">清除选中</button>
      </div>
    </div>
    <div class="info-panel">
      <h3>统计信息</h3>
      <div><strong>当前点位数量:</strong> {{ markersCount }}</div>
      <div><strong>渲染帧率:</strong> {{ fps }} FPS</div>
      <div><strong>选中功能状态:</strong> {{ markersSelectable ? '启用' : '禁用' }}</div>
      <div v-if="selectedMarker">
        <h4>已选中点位</h4>
        <div><strong>位置:</strong> [{{ selectedMarker.lngLat[0].toFixed(4) }}, {{ selectedMarker.lngLat[1].toFixed(4) }}]</div>
        <div><strong>旋转角度:</strong> {{ selectedMarker.rotation.toFixed(1) }}°</div>
        <div><strong>名称:</strong> {{ selectedMarker.name }}</div>
        <div><strong>索引:</strong> {{ selectedMarker.index }}</div>
        <button @click="removeSelectedMarker">移除选中点位</button>
        <div class="edit-name">
          <input type="text" v-model="editName" placeholder="修改点位名称" />
          <button @click="updateSelectedMarkerName">更新名称</button>
        </div>
      </div>
      <div class="tip">
        提示: 点击任意点位查看其详细信息。批量POI使用WebGL渲染，可高效显示大量点位。
        勾选"显示标签"可切换POI标签的显示。
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import bicMap from '../bicMap/core/bicmap-gl';

// 地图和点位控制器引用
const map = ref(null);
const markersController = ref(null);
const markersCount = ref(0);
const selectedMarker = ref(null);
const rotationValue = ref(0);
const fps = ref(0);
const showLabels = ref(false);
const editName = ref('');
const markersSelectable = ref(true);

// 位置名称数据集，用于随机生成标签名称
const locationNames = [
  '1层大厅入口', '2层会议室', '3层休息区', '电梯间A', '安全出口', 
  '机器人停放点', '充电站', '前台', '餐厅', '咖啡厅',
  '洗手间', '办公区A', '办公区B', '会议室C', '休息区',
  '储藏室', '安保室', '机房', '展示厅', '培训室'
];

// FPS计算相关变量
let frameCount = 0;
let lastTime = 0;
let fpsInterval = null;

// 初始化地图
const initMap = async () => {
  try {
    // 初始化BicMap
    await bicMap.init();
    
    // 创建新的地图实例
    map.value = bicMap.createMap({
      container: 'batchPoiMap',
      center: [116.3912, 39.9073],
      zoom: 13
    });
    
    // 监听地图加载事件
    map.value.on('load', () => {
      
      // 添加带有等级显示的缩放控件
      bicMap.addZoomControl(map.value, 'bottom-right');
      
      // 启动FPS监测
      startFpsMonitoring();
      
      console.log('地图加载成功！');
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 开始FPS监测
const startFpsMonitoring = () => {
  // 添加帧率监听
  const updateFrameCount = () => {
    frameCount++;
    requestAnimationFrame(updateFrameCount);
  };
  
  requestAnimationFrame(updateFrameCount);
  
  // 每秒更新FPS显示
  fpsInterval = setInterval(() => {
    const currentTime = performance.now();
    fps.value = Math.round(frameCount * 1000 / (currentTime - lastTime));
    frameCount = 0;
    lastTime = currentTime;
  }, 1000);
};

// 生成随机位置名称
const getRandomLocationName = (index) => {
  if (index < locationNames.length) {
    return locationNames[index];
  }
  
  // 如果索引超出预设名称范围，则组合生成
  const prefix = locationNames[Math.floor(Math.random() * locationNames.length)];
  return `${prefix}-${index + 1}`;
};

// 生成随机点位数据
const generateRandomPoints = (count) => {
  const center = map.value.getCenter();
  const centerLng = center.lng;
  const centerLat = center.lat;
  const points = [];
  
  // 当前地图可视范围
  const bounds = map.value.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  
  // 计算可视范围的经纬度跨度
  const lngSpan = ne.lng - sw.lng;
  const latSpan = ne.lat - sw.lat;
  
  // 生成随机点位
  for (let i = 0; i < count; i++) {
    // 在当前可视范围内生成随机位置
    const lng = sw.lng + Math.random() * lngSpan * 0.8;
    const lat = sw.lat + Math.random() * latSpan * 0.8;
    
    // 随机旋转角度
    const rotation = Math.random() * 360;
    
    // 随机位置名称
    const name = getRandomLocationName(i);
    
    points.push({
      id: `poi-${i}`,
      lngLat: [lng, lat],
      rotation,
      name
    });
  }
  
  return points;
};

// 加载指定数量的随机标记
const loadMarkers = (count) => {
  if (!map.value) return;
  
  // 如果已有点位控制器，先移除
  if (markersController.value) {
    markersController.value.remove();
  }
  
  // 生成随机点位
  const points = generateRandomPoints(count);
  
  // 添加批量POI点位
  markersController.value = bicMap.addBatchPOIMarkers(
    map.value,
    points,
    {
      imagePath: '/bicMap/assets/img/pos.png',
      size: 32,
      showLabels: showLabels.value,
      labelIconPath: '/bicMap/assets/img/poi-sig.png',
      selectable: markersSelectable.value, // 设置初始可选中状态
      onClick: (markerData) => {
        selectedMarker.value = markerData;
        editName.value = markerData.name;
        console.log('点击选中点位:', markerData);
      },
      onSelectionChange: (data) => {
        console.log('选中状态变化:', data);
      }
    }
  );
  
  markersCount.value = count;
};

// 切换标签显示 - 完全绕过库的toggleLabels方法
const handleLabelToggle = () => {
  if (!markersController.value) return;
  
  // Instead of calling the problematic toggleLabels function,
  // we'll manually handle the label visibility
  const points = markersController.value.getMarkers();
  
  if (showLabels.value) {
    // If showing labels, recreate all markers with labels enabled
    markersController.value.remove();
    markersController.value = bicMap.addBatchPOIMarkers(
      map.value,
      points,
      {
        imagePath: '/bicMap/assets/img/pos.png',
        size: 32,
        showLabels: true,
        labelIconPath: '/bicMap/assets/img/poi-sig.png',
        selectable: markersSelectable.value,
        onClick: (markerData) => {
          selectedMarker.value = markerData;
          editName.value = markerData.name;
        },
        onSelectionChange: (data) => {
          console.log('选中状态变化:', data);
        }
      }
    );
  } else {
    // If hiding labels, recreate all markers with labels disabled
    markersController.value.remove();
    markersController.value = bicMap.addBatchPOIMarkers(
      map.value,
      points,
      {
        imagePath: '/bicMap/assets/img/pos.png',
        size: 32,
        showLabels: false,
        labelIconPath: '/bicMap/assets/img/poi-sig.png',
        selectable: markersSelectable.value,
        onClick: (markerData) => {
          selectedMarker.value = markerData;
          editName.value = markerData.name;
        },
        onSelectionChange: (data) => {
          console.log('选中状态变化:', data);
        }
      }
    );
  }
};

// 清除所有点位
const clearMarkers = () => {
  if (!markersController.value) return;
  
  markersController.value.clearMarkers();
  markersCount.value = 0;
  selectedMarker.value = null;
};

// 旋转所有点位
const rotateAllMarkers = () => {
  if (!markersController.value) return;
  
  const points = markersController.value.getMarkers();
  const updatedPoints = points.map(point => ({
    ...point,
    rotation: parseInt(rotationValue.value)
  }));
  
  markersController.value.updateMarkers(updatedPoints);
  
  // 更新选中点位的旋转值
  if (selectedMarker.value) {
    selectedMarker.value.rotation = parseInt(rotationValue.value);
  }
};

// 随机移动所有点位
const generateRandomMovement = () => {
  if (!markersController.value) return;
  
  // 获取当前所有点位
  const points = markersController.value.getMarkers();
  
  // 当前地图可视范围
  const bounds = map.value.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  
  // 计算可视范围的经纬度跨度
  const lngSpan = ne.lng - sw.lng;
  const latSpan = ne.lat - sw.lat;
  
  // 随机更新所有点位位置
  const updatedPoints = points.map(point => {
    const movement = {
      lng: (Math.random() - 0.5) * 0.01 * lngSpan,
      lat: (Math.random() - 0.5) * 0.01 * latSpan
    };
    
    return {
      ...point,
      lngLat: [
        point.lngLat[0] + movement.lng,
        point.lngLat[1] + movement.lat
      ]
    };
  });
  
  // 更新点位
  markersController.value.updateMarkers(updatedPoints);
  
  // 更新选中点位
  if (selectedMarker.value) {
    const updatedPoint = updatedPoints[selectedMarker.value.index];
    if (updatedPoint) {
      selectedMarker.value.lngLat = updatedPoint.lngLat;
    }
  }
};

// 随机旋转所有点位
const generateRandomRotation = () => {
  if (!markersController.value) return;
  
  // 获取当前所有点位
  const points = markersController.value.getMarkers();
  
  // 随机更新所有点位旋转角度
  const updatedPoints = points.map(point => ({
    ...point,
    rotation: Math.random() * 360
  }));
  
  // 更新点位
  markersController.value.updateMarkers(updatedPoints);
  
  // 更新选中点位
  if (selectedMarker.value) {
    const updatedPoint = updatedPoints[selectedMarker.value.index];
    if (updatedPoint) {
      selectedMarker.value.rotation = updatedPoint.rotation;
    }
  }
};

// 更新选中点位的名称
const updateSelectedMarkerName = () => {
  if (!markersController.value || !selectedMarker.value || !editName.value) return;
  
  // 更新点位名称
  markersController.value.updateMarker(selectedMarker.value.index, {
    name: editName.value
  });
  
  // 更新选中点位信息
  selectedMarker.value.name = editName.value;
};

// 移除选中的点位
const removeSelectedMarker = () => {
  if (!markersController.value || !selectedMarker.value) return;
  
  markersController.value.removeMarker(selectedMarker.value.index);
  markersCount.value--;
  selectedMarker.value = null;
};

// 切换点位选中功能
const handleSelectableToggle = () => {
  if (!markersController.value) return;
  
  const isSelectable = markersController.value.setSelectable(markersSelectable.value);
  console.log(`点位选中功能${isSelectable ? '已启用' : '已禁用'}`);
  
  // 如果禁用选中功能，清除当前选中状态
  if (!isSelectable) {
    selectedMarker.value = null;
  }
};

// 测试根据ID选中点位
const testSelectById = () => {
  if (!markersController.value || !markersSelectable.value) return;
  
  const markers = markersController.value.getMarkers();
  if (markers.length === 0) {
    alert('请先加载一些POI点位');
    return;
  }
  
  // 随机选择一个点位ID进行测试
  const randomIndex = Math.floor(Math.random() * markers.length);
  const randomMarker = markers[randomIndex];
  
  console.log(`测试选中ID为 "${randomMarker.id}" 的点位`);
  
  const success = markersController.value.selectById(randomMarker.id);
  if (success) {
    // 更新选中状态显示
    selectedMarker.value = {
      ...randomMarker,
      index: randomIndex,
      id: randomMarker.id
    };
    editName.value = randomMarker.name;
    console.log('选中成功！');
  } else {
    console.log('选中失败！');
  }
};

// 清除选中状态
const clearSelection = () => {
  if (!markersController.value || !markersSelectable.value) return;
  
  markersController.value.clearSelection();
  selectedMarker.value = null;
  console.log('已清除所有选中状态');
};

// 组件挂载时初始化地图
onMounted(() => {
  initMap();
});

// 组件卸载时清理
onBeforeUnmount(() => {
  if (fpsInterval) {
    clearInterval(fpsInterval);
  }
  
  if (markersController.value) {
    markersController.value.remove();
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
  height: 100%;
  padding: 0 1rem;
}

.example-container h1 {
  margin: 1rem 0;
}

.map-wrapper {
  flex: 1;
  position: relative;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
  min-height: 500px;
}

.map-container {
  width: 100%;
  height: 100%;
}

.controls {
  margin: 1rem 0;
  padding: 1rem;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.control-section {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.control-section:last-child {
  margin-bottom: 0;
}

.control-section button {
  margin-right: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.control-section button:hover {
  background-color: #45a049;
}

.control-section button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.control-section button:disabled:hover {
  background-color: #cccccc;
}

.control-section label {
  margin-right: 0.5rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  margin-left: 1rem;
}

.toggle-label input[type="checkbox"] {
  margin-right: 0.5rem;
}

.control-section input[type="range"] {
  width: 200px;
  margin-right: 0.5rem;
}

.info-panel {
  margin: 1rem 0;
  padding: 1rem;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.info-panel h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.info-panel h4 {
  margin: 1rem 0 0.5rem 0;
}

.info-panel .tip {
  margin-top: 1rem;
  font-style: italic;
  color: #666;
}

.info-panel button {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.info-panel button:hover {
  background-color: #e53935;
}

.edit-name {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
}

.edit-name input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-right: 0.5rem;
}

.edit-name button {
  padding: 0.5rem 1rem;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.edit-name button:hover {
  background-color: #1E88E5;
}
</style> 