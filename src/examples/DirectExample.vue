<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-23 16:35:30
 * @LastEditTime: 2025-04-29 17:17:07
 * @LastEditors: houser.hao@humanoid.com
 * @Description: BicMap-GL直接使用示例（无Vue组件）
 * @FilePath: /bic-map-plugin/src/examples/DirectExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <h1>BicMap-GL直接使用示例</h1>
    <div class="map-wrapper">
      <div id="mapNav" class="map-container"></div>
    </div>
    <div class="controls">
      <button @click="zoomIn">放大</button>
      <button @click="zoomOut">缩小</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import bicMap from '../bicMap/core/bicmap-gl';

// 地图引用
const map = ref(null);

// 初始化地图
const initMap = async () => {
  try {
    // 初始化BicMap
    await bicMap.init();
    
    // 创建新的地图实例
    map.value = bicMap.createMap({
      container: 'mapNav',
      center: [116.3912, 39.9073],
      zoom: 10
    });
    
    // 监听地图加载事件
    map.value.on('load', () => {
      bicMap.addZoomControl(map.value, 'bottom-right');
      console.log('地图加载成功！');
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 放大
const zoomIn = () => {
  if (!map.value) return;
  
  const currentZoom = map.value.getZoom();
  map.value.zoomTo(currentZoom + 1);
};

// 缩小
const zoomOut = () => {
  if (!map.value) return;
  
  const currentZoom = map.value.getZoom();
  map.value.zoomTo(currentZoom - 1);
};

// 组件挂载时初始化地图
onMounted(() => {
  initMap();
});

// 组件卸载时清理
onBeforeUnmount(() => {
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

.map-wrapper {
  flex: 1;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 20px;
}

.map-container {
  width: 100%;
  height: 100%;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
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
</style> 