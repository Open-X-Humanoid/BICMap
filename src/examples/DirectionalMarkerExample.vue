<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-24 21:15:30
 * @LastEditTime: 2025-04-29 17:21:11
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 方向标记示例
 * @FilePath: /bic-map/src/examples/DirectionalMarkerExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <h1>方向标记示例</h1>
    <div class="map-wrapper">
      <div id="directionalMap" class="map-container"></div>
    </div>
    <div class="controls">
      <button @click="addDirectionalMarker">添加方向标记</button>
      <button @click="toggleMapClickMode" :class="{ active: mapClickMode }">通过地图点击添加标记</button>
      <button @click="toggleEditMode" :disabled="!currentMarker">切换编辑模式</button>
      <button @click="removeMarker" :disabled="!currentMarker">移除标记</button>
      <button @click="rotateMarker" :disabled="!currentMarker">旋转45°</button>
    </div>
    <div class="info-panel" v-if="markerInfo">
      <h3>标记信息</h3>
      <div><strong>位置:</strong> [{{ markerInfo.lng.toFixed(4) }}, {{ markerInfo.lat.toFixed(4) }}]</div>
      <div><strong>旋转角度:</strong> {{ markerInfo.rotation.toFixed(1) }}°</div>
      <div><strong>编辑模式:</strong> {{ markerInfo.editMode ? '激活' : '未激活' }}</div>
      <div class="tip">提示: 双击标记可切换编辑模式。在编辑模式下，拖动绿色滑块可以旋转标记。</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import bicMap from '../bicMap/core/bicmap-gl';

// 地图和当前标记的引用
const map = ref(null);
const currentMarker = ref(null);
const markerInfo = ref(null);
const editMode = ref(false);
const mapClickMode = ref(false);

// 初始化地图
const initMap = async () => {
  try {
    // 初始化BicMap
    await bicMap.init();
    
    // 创建新的地图实例
    map.value = bicMap.createMap({
      container: 'directionalMap',
      center: [116.3912, 39.9073],
      zoom: 13
    });
    
    // 监听地图加载事件
    map.value.on('load', () => {
      
      // 添加带有等级显示的缩放控件
      bicMap.addZoomControl(map.value, 'bottom-right');

      console.log('地图加载成功！');
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 向地图添加方向标记
const addDirectionalMarker = () => {
  if (!map.value) return;
  
  // 如果已存在标记则移除
  if (currentMarker.value) {
    currentMarker.value.remove();
    currentMarker.value = null;
    markerInfo.value = null;
  }
  
  // 获取地图中心点
  const center = map.value.getCenter();
  
  // 添加方向标记
  currentMarker.value = bicMap.addDirectionalMarker(
    map.value,
    [center.lng, center.lat],
    {
      imagePath: '/bicMap/assets/svg/pos.svg',
      initialRotation: 0,
      draggable: true,
      rotationControl: true,
      highlightStyle: {
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        borderColor: '#4CAF50',
        shadowColor: 'rgba(76, 175, 80, 0.6)'
      },
      onChange: (data) => {
        updateMarkerInfo(data);
      }
    }
  );
  
  // 更新初始标记信息
  updateMarkerInfo({
    lngLat: currentMarker.value.getPosition(),
    rotation: currentMarker.value.getRotation()
  });
};

// 切换标记编辑模式
const toggleEditMode = () => {
  if (!currentMarker.value) return;
  
  currentMarker.value.toggleEditMode();
  editMode.value = !editMode.value;
  
  // 更新标记信息
  updateMarkerInfo({
    lngLat: currentMarker.value.getPosition(),
    rotation: currentMarker.value.getRotation()
  });
};

// 移除当前标记
const removeMarker = () => {
  if (!currentMarker.value) return;
  
  currentMarker.value.remove();
  currentMarker.value = null;
  markerInfo.value = null;
};

// 将标记旋转45度
const rotateMarker = () => {
  if (!currentMarker.value) return;
  
  const currentRotation = currentMarker.value.getRotation();
  currentMarker.value.setRotation(currentRotation + 45);
};

// 切换地图点击模式以添加标记
const toggleMapClickMode = () => {
  mapClickMode.value = !mapClickMode.value;
  
  if (mapClickMode.value) {
    // 向地图添加点击监听器
    map.value.on('click', handleMapClick);
    // 设置自定义光标，调整光标热点位置为图片中心点(10,10)
    map.value.getCanvas().style.cursor = `url('/bicMap/assets/svg/add-cursor.svg') 10 10, auto`;
  } else {
    // 移除点击监听器
    map.value.off('click', handleMapClick);
    // 恢复默认光标
    map.value.getCanvas().style.cursor = '';
  }
};

// 处理地图点击以在点击位置添加标记
const handleMapClick = (e) => {
  if (!mapClickMode.value) return;
  
  // 如果已存在标记则移除
  if (currentMarker.value) {
    currentMarker.value.remove();
    currentMarker.value = null;
    markerInfo.value = null;
  }
  
  // 在点击位置添加方向标记
  currentMarker.value = bicMap.addDirectionalMarker(
    map.value,
    [e.lngLat.lng, e.lngLat.lat],
    {
      imagePath: '/bicMap/assets/svg/pos.svg',
      initialRotation: 0,
      draggable: true,
      rotationControl: true,
      initialEditMode: true,
      highlightStyle: {
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        borderColor: '#4CAF50',
        shadowColor: 'rgba(76, 175, 80, 0.6)'
      },
      onChange: (data) => {
        updateMarkerInfo(data);
      }
    }
  );
  
  // 更新标记信息
  updateMarkerInfo({
    lngLat: currentMarker.value.getPosition(),
    rotation: currentMarker.value.getRotation()
  });
};

// 更新标记信息显示
const updateMarkerInfo = (data) => {
  const { lngLat, rotation } = data;
  
  markerInfo.value = {
    lng: lngLat.lng,
    lat: lngLat.lat,
    rotation: rotation,
    editMode: editMode.value
  };
};

// 组件挂载时初始化地图
onMounted(() => {
  initMap();
});

// 组件卸载时清理
onBeforeUnmount(() => {
  if (map.value) {
    // 移除事件监听器
    if (mapClickMode.value) {
      map.value.off('click', handleMapClick);
    }
    
    map.value.remove();
    map.value = null;
  }
});
</script>

<style scoped>
.example-container {
  display: flex;
  flex-direction: column;
  height: 80vh;
  padding: 20px;
  box-sizing: border-box;
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

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

button.active {
  background-color: #ff7700;
}

.info-panel {
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.info-panel h3 {
  margin-top: 0;
  margin-bottom: 10px;
}

.tip {
  margin-top: 10px;
  color: #666;
  font-style: italic;
}
</style> 