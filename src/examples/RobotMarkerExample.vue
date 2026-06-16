<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-28 14:35:30
 * @LastEditTime: 2025-05-23 09:57:54
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 机器人位置标记示例
 * @FilePath: /bic-map-plugin/src/examples/RobotMarkerExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <h1>机器人位置标记示例</h1>
    <div class="map-wrapper">
      <div id="robotMarkerMap" class="map-container"></div>
    </div>
    <div class="controls">
      <div class="control-section">
        <button @click="addRandomRobot">添加随机机器人</button>
        <button @click="clearRobots">清除全部机器人</button>
      </div>
      <div class="control-section">
        <button @click="toggleLabels">{{ showLabels ? '隐藏标签' : '显示标签' }}</button>
        <button @click="updateRandomRobot">随机更新机器人</button>
      </div>
      <div class="control-section">
        <button @click="startAutoMoving" v-if="!isAutoMoving">开始自动移动</button>
        <button @click="stopAutoMoving" v-else>停止自动移动</button>
      </div>
    </div>
    <div class="info-panel">
      <h3>机器人列表</h3>
      <div class="robot-list">
        <div v-for="(robot, index) in robots" :key="robot.id" class="robot-item">
          <div class="robot-info">
            <div class="robot-name">{{ robot.name }}</div>
            <div class="robot-details">
              <div><strong>ID:</strong> {{ robot.id }}</div>
              <div><strong>位置:</strong> [{{ robot.lngLat[0].toFixed(4) }}, {{ robot.lngLat[1].toFixed(4) }}]</div>
              <div><strong>旋转角度:</strong> {{ robot.rotation.toFixed(1) }}°</div>
            </div>
          </div>
          <div class="robot-actions">
            <button @click="updateRobotRotation(index)">随机旋转</button>
            <button @click="removeRobot(index)" class="delete-btn">删除</button>
          </div>
        </div>
        <div v-if="robots.length === 0" class="no-robots">
          暂无机器人，请点击"添加随机机器人"按钮添加
        </div>
      </div>
      <div class="tip">
        提示: 点击任意机器人图标可查看其详细信息。机器人位置标记显示名称标签，并支持各种操作如添加、删除和更新位置及旋转角度。
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import bicMap from '../bicMap/core/bicmap-gl';

// 地图和机器人控制器引用
const map = ref(null);
const robotMarkers = ref(null);
const robots = ref([]);
const showLabels = ref(true);
const isAutoMoving = ref(false);
const autoMoveInterval = ref(null);

const zoomFactor = ref(1);

const scale = ref(1);

// 机器人名称数据集，用于随机生成名称
const robotNames = [
  "小达", "机灵", "智星", "未来", "小聪", "机器人001", 
  "智能助手", "电子侠", "机械伙伴", "智多星",
  "阿尔法", "贝塔", "伽马", "德尔塔", "艾普西龙"
];

// 初始化地图
const initMap = async () => {
  try {
    // 初始化BicMap
    await bicMap.init();
    
    // 创建新的地图实例
    map.value = bicMap.createMap({
      container: 'robotMarkerMap',
      style: 'mapbox://styles/mapbox/light-v10',
      center: [121.2887, 22.3287],
      zoom: 14,
      pitch: 0,
      bearing: 0,
      antialias: true
    });
    
    // 监听地图加载事件
    map.value.on('load', () => {
      
      // 初始化机器人标记控制器
      initRobotMarkers();
      
      // 添加初始机器人
      addInitialRobots();
      
      console.log('地图加载成功！');
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 坐标转换 转笛卡尔坐标
const GPSToCartesian = (lng, lat) => {
  const cartesian = MapUtils.GPSToCartesian({
    longitude: lng,
    latitude: lat,
    scale: scale.value,
    zoomFactor: zoomFactor.value
  });
  return cartesian;
}

// 初始化机器人标记控制器
const initRobotMarkers = () => {
  // 初始化机器人标记控制器
  robotMarkers.value = bicMap.addRobotMarkers(
    map.value,
    [],  // 初始为空
    {
      svgPath: '/bicMap/assets/img/robo.png',
      size: 30,
      showLabels: showLabels.value,
      onClick: handleRobotClick,
      GPSToCartesian: GPSToCartesian
    }
  );
};

// 添加初始机器人
const addInitialRobots = () => {
  // 添加几个初始机器人
  const initialRobots = [
    {
      id: 'robot-001',
      name: '小达',
      lngLat: [121.2887, 22.3287],
      rotation: 45
    },
    {
      id: 'robot-002',
      name: '机灵',
      lngLat: [121.2897, 22.3277],
      rotation: 90
    },
    {
      id: 'robot-003',
      name: '智星',
      lngLat: [121.2877, 22.3297],
      rotation: 180
    }
  ];
  
  // 记录添加的机器人
  robots.value = initialRobots;
  
  // 添加到地图
  robotMarkers.value.updateRobots(robots.value);
};

// 添加随机机器人
const addRandomRobot = () => {
  // 生成随机位置和旋转角度
  const center = map.value.getCenter();
  const randomLng = center.lng + (Math.random() - 0.5) * 0.02;
  const randomLat = center.lat + (Math.random() - 0.5) * 0.02;
  const randomRotation = Math.floor(Math.random() * 360);
  
  // 生成随机ID和名称
  const randomId = `robot-${Math.floor(Math.random() * 10000)}`;
  const randomName = robotNames[Math.floor(Math.random() * robotNames.length)];
  
  // 创建新机器人对象
  const newRobot = {
    id: randomId,
    name: randomName,
    lngLat: [randomLng, randomLat],
    rotation: randomRotation
  };
  
  // 添加到机器人列表
  robots.value.push(newRobot);
  
  // 添加到地图
  robotMarkers.value.addRobot(newRobot);
};

// 移除机器人
const removeRobot = (index) => {
  if (index >= 0 && index < robots.value.length) {
    // 从地图上移除
    robotMarkers.value.removeRobot(index);
    
    // 从列表中移除
    robots.value.splice(index, 1);
  }
};

// 清除所有机器人
const clearRobots = () => {
  // 清除所有机器人标记
  robotMarkers.value.clearRobots();
  
  // 清空列表
  robots.value = [];
};

// 切换标签显示
const toggleLabels = () => {
  // 切换标签显示状态
  showLabels.value = robotMarkers.value.toggleLabels();
};

// 更新随机机器人
const updateRandomRobot = () => {
  // 如果没有机器人则返回
  if (robots.value.length === 0) return;
  
  // 随机选择一个机器人
  const randomIndex = Math.floor(Math.random() * robots.value.length);
  const robot = robots.value[randomIndex];
  
  // 生成随机位置和旋转角度
  const center = map.value.getCenter();
  const randomLng = center.lng + (Math.random() - 0.5) * 0.02;
  const randomLat = center.lat + (Math.random() - 0.5) * 0.02;
  const randomRotation = Math.floor(Math.random() * 360);
  
  // 更新机器人属性
  const updatedRobot = {
    ...robot,
    lngLat: [randomLng, randomLat],
    rotation: randomRotation
  };
  
  // 更新机器人列表
  robots.value[randomIndex] = updatedRobot;
  
  // 更新地图上的标记
  robotMarkers.value.updateRobot(randomIndex, updatedRobot);
};

// 单独更新机器人的旋转角度
const updateRobotRotation = (index) => {
  if (index >= 0 && index < robots.value.length) {
    const robot = robots.value[index];
    const randomRotation = Math.floor(Math.random() * 360);
    
    // 更新机器人属性
    const updatedRobot = {
      ...robot,
      rotation: randomRotation
    };
    
    // 更新机器人列表
    robots.value[index] = updatedRobot;
    
    // 更新地图上的标记
    robotMarkers.value.updateRobot(index, updatedRobot);
  }
};

// 开始自动移动
const startAutoMoving = () => {
  // 如果已经在移动则返回
  if (isAutoMoving.value) return;
  
  // 设置定时器，每2秒随机移动一个机器人
  autoMoveInterval.value = setInterval(() => {
    updateRandomRobot();
  }, 2000);
  
  isAutoMoving.value = true;
};

// 停止自动移动
const stopAutoMoving = () => {
  // 清除定时器
  if (autoMoveInterval.value) {
    clearInterval(autoMoveInterval.value);
    autoMoveInterval.value = null;
  }
  
  isAutoMoving.value = false;
};

// 处理机器人点击事件
const handleRobotClick = (robotInfo) => {
  console.log('点击了机器人:', robotInfo);
  alert(`点击了机器人: ${robotInfo.name} (ID: ${robotInfo.id})`);
};

// 组件挂载时初始化地图
onMounted(() => {
  initMap();
});

// 组件卸载时清理
onBeforeUnmount(() => {
  stopAutoMoving();
  
  if (robotMarkers.value) {
    robotMarkers.value.remove();
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
  gap: 10px;
}

.control-section:last-child {
  margin-bottom: 0;
}

.control-section button {
  padding: 0.5rem 1rem;
  background-color: #0066FF;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  min-width: 120px;
}

.control-section button:hover {
  background-color: #0052cc;
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

.robot-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.robot-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 10px;
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.robot-info {
  flex: 1;
}

.robot-name {
  font-weight: bold;
  font-size: 16px;
  color: #0066FF;
  margin-bottom: 5px;
}

.robot-details {
  font-size: 14px;
  color: #555;
}

.robot-actions {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.robot-actions button {
  padding: 6px 10px;
  font-size: 12px;
  background-color: #0066FF;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.delete-btn {
  background-color: #f44336 !important;
}

.delete-btn:hover {
  background-color: #d32f2f !important;
}

.no-robots {
  padding: 20px;
  text-align: center;
  color: #666;
  font-style: italic;
}

.info-panel .tip {
  margin-top: 1rem;
  font-style: italic;
  color: #666;
  border-top: 1px solid #ddd;
  padding-top: 10px;
}
</style> 