<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-10-10 15:30:00
 * @LastEditTime: 2025-10-14 18:35:34
 * @LastEditors: houser.hao@humanoid.com
 * @Description: Wide line (track/road) example component
 * @FilePath: /bic-map-plugin/src/examples/WidelineExample.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="example-container">
    <div class="map-container" ref="mapContainer"></div>
    
    <div class="control-panel">
      <h3>宽轨道线样式控制</h3>
      
      <div class="control-group">
        <label>线段颜色</label>
        <input type="color" v-model="lineStyle.color" @change="updateStyles">
      </div>
      
      <div class="control-group">
        <label>线段宽度（米）</label>
        <input type="range" min="1" max="100" v-model.number="lineStyle.width" @input="updateStyles">
        <span>{{ lineStyle.width }}米</span>
      </div>
      
      <div class="control-group">
        <label>线段透明度</label>
        <input type="range" min="0" max="1" step="0.1" v-model.number="lineStyle.opacity" @input="updateStyles">
        <span>{{ lineStyle.opacity }}</span>
      </div>
      
      <div class="control-group">
        <label>显示边框</label>
        <div class="switch-container">
          <input type="checkbox" id="outline-switch" v-model="lineStyle.showOutline" @change="toggleOutline" />
          <label for="outline-switch" class="switch-label"></label>
        </div>
      </div>
      
      <div v-if="lineStyle.showOutline" class="control-group">
        <label>边框颜色</label>
        <input type="color" v-model="lineStyle.outlineColor" @change="updateStyles">
      </div>
      
      <div v-if="lineStyle.showOutline" class="control-group">
        <label>边框宽度</label>
        <input type="range" min="1" max="10" v-model.number="lineStyle.outlineWidth" @input="updateStyles">
        <span>{{ lineStyle.outlineWidth }}px</span>
      </div>
      
      <h3>操作</h3>
      
      <div class="button-group">
        <button @click="addRandomLine">添加随机轨道</button>
        <button @click="clearLines">清空所有轨道</button>
      </div>

      <h3>预设轨道示例</h3>
      
      <div class="button-group">
        <button @click="loadPreset('highway')">高速公路</button>
        <button @click="loadPreset('street')">城市街道</button>
        <button @click="loadPreset('track')">赛道</button>
        <button @click="loadPreset('railway')">铁路轨道</button>
      </div>

      <div class="info-panel">
        <h4>说明</h4>
        <p>宽轨道线可以实现类似马路、铁路等宽度可控的线条效果，宽度以米为单位。</p>
        <p>点击轨道线可以查看详细信息，点击列表项可以高亮对应的轨道线。</p>
        <p>编辑模式下可以拖拽顶点调整轨道线形状。</p>
      </div>

      <div v-if="currentWideLines.length > 0" class="wideline-list">
        <h3>轨道线列表 ({{ currentWideLines.length }}条)</h3>
        <ul>
          <li 
            v-for="line in currentWideLines" 
            :key="line.id" 
            @click="selectWideline(line)"
            :class="{ active: selectedWideline && selectedWideline.id === line.id }"
          >
            <div class="line-info">
              <div class="line-name">{{ line.name || line.id }}</div>
              <div class="line-details">
                宽度: {{ line.width }}米 | 点数: {{ line.path ? line.path.length : 0 }}
              </div>
            </div>
            <div class="line-actions">
              <button @click.stop="editWideline(line)" class="edit-btn">编辑</button>
              <button @click.stop="deleteWideline(line)" class="delete-btn">删除</button>
            </div>
          </li>
        </ul>
      </div>

      <div v-if="selectedWideline" class="selected-info">
        <h4>选中轨道线</h4>
        <div><strong>ID:</strong> {{ selectedWideline.id }}</div>
        <div><strong>名称:</strong> {{ selectedWideline.name }}</div>
        <div><strong>宽度:</strong> {{ selectedWideline.width }}米</div>
        <div><strong>颜色:</strong> {{ selectedWideline.color }}</div>
        <div><strong>透明度:</strong> {{ selectedWideline.opacity }}</div>
        <div><strong>点数:</strong> {{ selectedWideline.path ? selectedWideline.path.length : 0 }}</div>
        <div><strong>编辑状态:</strong> {{ isEditMode ? '编辑中' : '未编辑' }}</div>
      </div>

      <div v-if="isEditMode && editData" class="edit-info">
        <h4>编辑坐标信息</h4>
        <div><strong>轨道线ID:</strong> {{ editData.widelineId }}</div>
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
        <div class="edit-tips">
          <p><strong>编辑提示:</strong></p>
          <ul>
            <li>拖拽红色圆点可以调整顶点位置</li>
            <li>编辑完成后会自动更新轨道线形状</li>
            <li>点击"退出编辑模式"完成编辑</li>
          </ul>
        </div>
        <div class="edit-actions">
          <button @click="exitEditMode" class="exit-edit-btn">退出编辑模式</button>
        </div>
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
// 宽线段控制器
let widelinesController = null;

// 当前线段样式
const lineStyle = reactive({
  color: '#3388ff',
  width: 20,
  opacity: 0.8,
  showOutline: true,
  outlineColor: '#2266cc',
  outlineWidth: 2
});

// 地图范围
const mapBounds = {
  minLng: -0.002,
  maxLng: 0.002,
  minLat: -0.002,
  maxLat: 0.002
};

// 当前线段集合
const currentWideLines = ref([]);

// 编辑模式状态
const selectedWideline = ref(null);
const isEditMode = ref(false);
const editData = ref(null);
const drawingController = ref(null);

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
      console.log('地图加载完成，开始创建宽线段控制器');
      
      // 检查地图实例是否有getSource方法
      if (typeof map.getSource !== 'function') {
        console.error('地图实例缺少getSource方法:', map);
        return;
      }
      
      // 创建初始宽线段集合
      widelinesController = bicMap.createWideLines(map, [], {
        onClick: (feature) => {
          console.log('宽轨道线点击:', feature.properties);
          alert(`轨道名称: ${feature.properties.name}\n宽度: ${feature.properties.width}米`);
        }
      });
      
      console.log('宽线段控制器创建成功:', widelinesController);
      
      // 加载默认示例
      setTimeout(() => {
        loadPreset('highway');
      }, 100);
    });
  } catch (error) {
    console.error('初始化地图失败:', error);
  }
};

// 更新线段样式
const updateStyles = () => {
  if (currentWideLines.value.length > 0 && widelinesController) {
    // 更新当前线段集合中的样式
    currentWideLines.value.forEach(line => {
      const updatedLine = {
        ...line,
        color: lineStyle.color,
        width: lineStyle.width,
        opacity: lineStyle.opacity,
        outlineColor: lineStyle.outlineColor,
        outlineWidth: lineStyle.outlineWidth
      };
      
      // 使用 updateWideLine 方法更新单条线段
      widelinesController.updateWideLine(line.id, updatedLine);
      
      // 更新本地数据
      Object.assign(line, updatedLine);
    });
  }
};

// 切换边框显示
const toggleOutline = () => {
  if (!widelinesController) return;
  
  if (lineStyle.showOutline) {
    widelinesController.show();
  } else {
    widelinesController.hide();
  }
  
  // 更新所有线段的边框设置
  currentWideLines.value.forEach(line => {
    const updatedLine = {
      ...line,
      outlineColor: lineStyle.outlineColor,
      outlineWidth: lineStyle.outlineWidth
    };
    
    // 使用 updateWideLine 方法更新单条线段
    widelinesController.updateWideLine(line.id, updatedLine);
    
    // 更新本地数据
    Object.assign(line, updatedLine);
  });
};

// 添加随机线段
const addRandomLine = () => {
  if (!widelinesController) return;
  
  const points = [];
  const numPoints = Math.floor(Math.random() * 3) + 2; // 2-4个点
  
  for (let i = 0; i < numPoints; i++) {
    const lng = Math.random() * (mapBounds.maxLng - mapBounds.minLng) + mapBounds.minLng;
    const lat = Math.random() * (mapBounds.maxLat - mapBounds.minLat) + mapBounds.minLat;
    points.push([lng, lat]);
  }
  
  // 随机颜色
  const randomColor = `#${Math.floor(Math.random()*16777215).toString(16)}`;
  
  const newLine = {
    id: `wideline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    path: points,
    color: randomColor,
    width: Math.floor(Math.random() * 50) + 10, // 10-60米宽度
    opacity: 0.8,
    outlineColor: lineStyle.outlineColor,
    outlineWidth: lineStyle.outlineWidth,
    name: `随机轨道 ${currentWideLines.value.length + 1}`
  };
  
  // 使用 addWideLine 方法添加新线段
  const addedId = widelinesController.addWideLine(newLine);
  if (addedId) {
    currentWideLines.value.push(newLine);
    // 选中新添加的线段
    selectWideline(newLine);
  }
};

// 清空所有线段
const clearLines = () => {
  if (!widelinesController) return;
  
  currentWideLines.value = [];
  widelinesController.clear();
};

// 加载预设线段集合
const loadPreset = (presetName) => {
  if (!widelinesController) return;
  
  // 先清空现有线段
  currentWideLines.value = [];
  widelinesController.clear();
  
  let preset = [];
  
  switch (presetName) {
    case 'highway':
      preset = [
        {
          id: 'highway-main',
          path: [
            [-0.0015, 0.0010],
            [-0.0005, 0.0008],
            [0.0005, 0.0012],
            [0.0015, 0.0010]
          ],
          width: 30,
          color: '#2c3e50',
          opacity: 0.9,
          outlineColor: '#ecf0f1',
          outlineWidth: 3,
          name: '高速公路主线'
        },
        {
          id: 'highway-aux',
          path: [
            [-0.0015, 0.0005],
            [-0.0005, 0.0003],
            [0.0005, 0.0007],
            [0.0015, 0.0005]
          ],
          width: 25,
          color: '#34495e',
          opacity: 0.9,
          outlineColor: '#ecf0f1',
          outlineWidth: 3,
          name: '高速公路辅道'
        }
      ];
      break;
      
    case 'street':
      preset = [
        {
          id: 'street-main',
          path: [
            [-0.0010, 0.0015],
            [-0.0010, 0.0005],
            [-0.0010, -0.0005],
            [-0.0010, -0.0015]
          ],
          width: 15,
          color: '#95a5a6',
          opacity: 0.8,
          outlineColor: '#7f8c8d',
          outlineWidth: 2,
          name: '主干道'
        },
        {
          id: 'street-secondary',
          path: [
            [-0.0015, 0],
            [-0.0010, 0],
            [0, 0],
            [0.0010, 0],
            [0.0015, 0]
          ],
          width: 12,
          color: '#bdc3c7',
          opacity: 0.8,
          outlineColor: '#95a5a6',
          outlineWidth: 2,
          name: '次干道'
        },
        {
          id: 'street-branch',
          path: [
            [0.0010, 0.0010],
            [0.0010, 0],
            [0.0010, -0.0010]
          ],
          width: 8,
          color: '#d5dbdb',
          opacity: 0.8,
          outlineColor: '#bdc3c7',
          outlineWidth: 1,
          name: '支路'
        }
      ];
      break;
      
    case 'track':
      preset = [
        {
          id: 'f1-track',
          path: [
            [-0.0015, -0.0010],
            [-0.0005, -0.0015],
            [0.0005, -0.0015],
            [0.0015, -0.0010],
            [0.0015, 0.0010],
            [0.0005, 0.0015],
            [-0.0005, 0.0015],
            [-0.0015, 0.0010],
            [-0.0015, -0.0010]
          ],
          width: 20,
          color: '#e74c3c',
          opacity: 0.7,
          outlineColor: '#c0392b',
          outlineWidth: 3,
          name: 'F1赛道'
        }
      ];
      break;
      
    case 'railway':
      preset = [
        {
          id: 'railway-1',
          path: [
            [-0.0015, -0.0005],
            [0.0015, -0.0005]
          ],
          width: 5,
          color: '#7f8c8d',
          opacity: 0.9,
          outlineColor: '#34495e',
          outlineWidth: 2,
          name: '铁路轨道1'
        },
        {
          id: 'railway-2',
          path: [
            [-0.0015, -0.0010],
            [0.0015, -0.0010]
          ],
          width: 5,
          color: '#7f8c8d',
          opacity: 0.9,
          outlineColor: '#34495e',
          outlineWidth: 2,
          name: '铁路轨道2'
        }
      ];
      break;
  }
  
  // 使用 addWideLine 方法逐个添加预设线段
  preset.forEach(line => {
    const addedId = widelinesController.addWideLine(line);
    if (addedId) {
      currentWideLines.value.push(line);
    }
  });
};

// 选择轨道线
const selectWideline = (line) => {
  if (!widelinesController) return;
  
  // 如果当前在编辑模式，先退出编辑模式
  if (isEditMode.value) {
    exitEditMode();
  }
  
  // 清除之前的高亮
  widelinesController.clearHighlights();
  
  // 高亮选中轨道线
  widelinesController.highlightWideLine(line.id);
  
  selectedWideline.value = line;
  console.log('选中轨道线:', line);
};

// 编辑轨道线
const editWideline = (line) => {
  if (!widelinesController) return;
  
  selectedWideline.value = line;
  
  // 使用宽轨道线控制器的编辑模式
  const callbacks = {
    onEditStart: (data) => {
      console.log('开始编辑:', data);
      editData.value = data;
      isEditMode.value = true;
    },
    onEditUpdate: (data) => {
      console.log('编辑更新:', data);
      editData.value = data;
      
      // 实时更新当前线段集合中的数据
      const index = currentWideLines.value.findIndex(l => l.id === line.id);
      if (index !== -1) {
        currentWideLines.value[index].path = [...data.points];
      }
    },
    onEditEnd: (data) => {
      console.log('结束编辑:', data);
      
      // 如果编辑完成，更新数据并触发回调
      if (data && data.points) {
        const updatedLine = {
          ...line,
          path: data.points
        };
        
        // 更新当前线段集合
        const index = currentWideLines.value.findIndex(l => l.id === line.id);
        if (index !== -1) {
          currentWideLines.value[index] = updatedLine;
          // 使用 updateWideLine 方法更新单条线段
          widelinesController.updateWideLine(line.id, updatedLine);
        }
        
        // 更新选中状态
        selectedWideline.value = updatedLine;
        
        // 触发编辑完成回调
        onEditComplete(updatedLine);
      }
      
      editData.value = null;
      isEditMode.value = false;
    }
  };
  
  const success = widelinesController.enterEditMode(line.id, callbacks);
  if (success) {
    console.log('进入编辑模式，轨道线ID:', line.id);
  } else {
    console.error('进入编辑模式失败');
  }
};

// 删除轨道线
const deleteWideline = (line) => {
  if (!widelinesController) return;
  
  const index = currentWideLines.value.findIndex(l => l.id === line.id);
  if (index !== -1) {
    // 使用 removeWideLine 方法删除单条线段
    widelinesController.removeWideLine(line.id);
    currentWideLines.value.splice(index, 1);
    
    // 如果删除的是当前选中的轨道线，清除选中状态
    if (selectedWideline.value && selectedWideline.value.id === line.id) {
      selectedWideline.value = null;
    }
    
    console.log('删除轨道线:', line.id);
  }
};

// 退出编辑模式
const exitEditMode = () => {
  if (widelinesController) {
    widelinesController.exitEditMode();
  }
  isEditMode.value = false;
  editData.value = null;
  console.log('退出编辑模式');
};

// 编辑完成回调
const onEditComplete = (lineData) => {
  console.log('编辑完成，返回数据:', {
    id: lineData.id,
    coordinates: lineData.path,
    width: lineData.width,
    properties: {
      color: lineData.color,
      opacity: lineData.opacity,
      outlineColor: lineData.outlineColor,
      outlineWidth: lineData.outlineWidth,
      name: lineData.name,
      data: lineData.data
    }
  });
  
  // 这里可以触发父组件的事件或调用API保存数据
  // 例如：this.$emit('lineEdited', lineData);
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

h4 {
  margin: 0 0 0.5rem 0;
  color: #555;
  font-size: 0.9rem;
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

.info-panel {
  background-color: #e8f4f8;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.info-panel p {
  margin: 0.5rem 0;
  font-size: 0.85rem;
  color: #555;
  line-height: 1.4;
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

/* 轨道线列表样式 */
.wideline-list {
  background-color: #ffffff;
  padding: 0;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
  margin-top: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.wideline-list h3 {
  margin: 0;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  border-bottom: none;
}

.wideline-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}

.wideline-list li {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: #ffffff;
}

.wideline-list li:last-child {
  border-bottom: none;
}

.wideline-list li:hover {
  background-color: #f8f9fa;
  transform: translateX(2px);
}

.wideline-list li.active {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-left: 4px solid #2196f3;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
}

.line-info {
  flex: 1;
  min-width: 0;
}

.line-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 6px;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.line-details {
  font-size: 0.85rem;
  color: #7f8c8d;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.line-details span {
  background-color: #ecf0f1;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
}

.line-actions {
  display: flex;
  gap: 8px;
  margin-left: 12px;
}

.edit-btn, .delete-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s ease;
  min-width: 50px;
  text-align: center;
}

.edit-btn {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
}

.edit-btn:hover {
  background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(76, 175, 80, 0.4);
}

.delete-btn {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(244, 67, 54, 0.3);
}

.delete-btn:hover {
  background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(244, 67, 54, 0.4);
}

/* 选中信息样式 */
.selected-info {
  margin-top: 15px;
  padding: 15px;
  background-color: #e8f4f8;
  border-radius: 4px;
  border: 1px solid #b3d9ff;
}

.selected-info h4 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #0066cc;
}

.selected-info div {
  margin-bottom: 8px;
}

/* 编辑信息样式 */
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

/* 编辑操作按钮样式 */
.edit-actions {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #4CAF50;
}

.exit-edit-btn {
  padding: 8px 16px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s;
}

.exit-edit-btn:hover {
  background-color: #da190b;
}

/* 编辑提示样式 */
.edit-tips {
  margin-top: 15px;
  padding: 10px;
  background-color: #f0f8ff;
  border-radius: 4px;
  border: 1px solid #b3d9ff;
}

.edit-tips p {
  margin: 0 0 8px 0;
  color: #0066cc;
  font-size: 0.9em;
}

.edit-tips ul {
  margin: 0;
  padding-left: 20px;
  color: #555;
  font-size: 0.85em;
  line-height: 1.4;
}

.edit-tips li {
  margin-bottom: 4px;
}
</style>

