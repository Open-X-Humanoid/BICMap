import maplibregl from 'maplibre-gl';

import { safeImageLoader } from '../utils/loaders.js';

/**
 * 向地图添加带有旋转控制的方向标记
 * @param {Object} maplibregl - maplibregl实例
 * @param {Object} map - 地图实例
 * @param {Array} lngLat - 标记的[经度,纬度]坐标
 * @param {Object} options - 标记选项
 * @param {string} options.imagePath - 标记图片路径，默认为'/bicMap/assets/svg/pos.svg'
 * @param {number} options.size - 标记图标大小（像素），默认为30
 * @param {number} options.initialRotation - 初始旋转角度（0°指向右侧，逆时针0-360°），默认为0
 * @param {boolean} options.draggable - 标记是否可拖动（仅在编辑模式下生效），默认为true
 * @param {boolean} options.rotationControl - 是否显示旋转控制，默认为true
 * @param {boolean} options.initialEditMode - 初始是否为编辑模式，默认为false
 * @param {Object} options.highlightStyle - 高亮样式配置
 * @param {string} options.highlightStyle.backgroundColor - 高亮背景颜色，默认为'rgba(76, 175, 80, 0.15)'
 * @param {string} options.highlightStyle.borderColor - 高亮边框颜色，默认为'#4CAF50'
 * @param {string} options.highlightStyle.shadowColor - 高亮阴影颜色，默认为'rgba(76, 175, 80, 0.6)'
 * @param {Function} options.onChange - 标记位置或旋转变化时的回调
 * @returns {Object} 包含操作标记方法的控制器对象
 */
export function addDirectionalMarker(map, lngLat, options = {}) {
  if (!maplibregl || !map) {
    throw new Error('地图未初始化。');
  }
  
  const {
    imagePath = '/bicMap/assets/svg/pos.svg',
    size = 30,
    initialRotation = 0,
    draggable = true,
    rotationControl = true,
    initialEditMode = false,
    highlightStyle = {},
    onChange = null
  } = options;
  
  // 高亮样式配置，提供默认值
  const {
    backgroundColor = 'rgba(76, 175, 80, 0.15)',
    borderColor = '#4CAF50',
    shadowColor = 'rgba(76, 175, 80, 0.6)'
  } = highlightStyle;
  
  // 计算高亮效果大小（比图标大约27%）
  const highlightSize = Math.round(size * 1.27);
  
  // 创建标记容器
  const markerEl = document.createElement('div');
  markerEl.className = 'bic-directional-marker';
  markerEl.style.width = `${size}px`;
  markerEl.style.height = `${size}px`;
  markerEl.style.cursor = initialEditMode ? 'move' : 'pointer';
  markerEl.style.position = 'absolute'; 
  markerEl.style.transition = 'filter 0.2s ease-in-out';
  markerEl.style.zIndex = 1;
  
  // 添加选中高亮效果元素 - 放在最底层
  const highlightEl = document.createElement('div');
  highlightEl.className = 'bic-marker-highlight';
  highlightEl.style.position = 'absolute';
  highlightEl.style.top = '50%';
  highlightEl.style.left = '50%';
  highlightEl.style.width = `${highlightSize}px`;
  highlightEl.style.height = `${highlightSize}px`;
  highlightEl.style.transform = 'translate(-50%, -50%)';
  highlightEl.style.borderRadius = '50%';
  highlightEl.style.backgroundColor = backgroundColor;
  highlightEl.style.border = `2px solid ${borderColor}`;
  highlightEl.style.boxShadow = `0 0 5px ${shadowColor}`;
  highlightEl.style.display = 'none'; 
  highlightEl.style.zIndex = 1;
  highlightEl.style.pointerEvents = 'none';
  markerEl.appendChild(highlightEl);
  
  // 创建标记图片包装容器 - 放在中间层
  const markerWrapper = document.createElement('div');
  markerWrapper.style.width = '100%';
  markerWrapper.style.height = '100%';
  markerWrapper.style.position = 'relative';
  markerWrapper.style.zIndex = 1;
  markerWrapper.style.transition = 'transform 0.2s ease-in-out';
  markerEl.appendChild(markerWrapper);
  
  // 创建标记图片 - 放在最上层
  const markerImg = document.createElement('img');
  markerImg.src = imagePath;
  markerImg.style.width = '100%';
  markerImg.style.height = '100%';
  markerImg.style.transition = 'transform 0.2s ease';
  markerImg.style.transform = `rotate(${-initialRotation}deg)`; // 应用初始旋转
  markerWrapper.appendChild(markerImg);
  
  // 创建并添加标记到地图
  const marker = new maplibregl.Marker({
    element: markerEl,
    draggable: false, // 初始设置为不可拖动
    anchor: 'center',
    rotationAlignment: 'map'
  })
    .setLngLat(lngLat)
    .addTo(map);
  
  // 当前旋转值
  let rotation = initialRotation;
  
  // 如果启用，创建旋转控制
  let rotationControlEl = null;
  let isRotating = false;
  let rotationStartX = 0;
  let lastX = 0;
  
  if (rotationControl) {
    // 旋转控制样式
    const style = document.createElement('style');
    style.innerHTML = `
      .bic-rotation-control {
        position: absolute;
        top: -50px;
        left: 50%;
        transform: translateX(-50%);
        width: 130px;
        height: 45px;
        background-color: rgba(255, 255, 255, 0.8);
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        z-index: 9999;
      }
      .bic-rotation-slider {
        width: 80px;
        height: 10px;
        background-color: #e0e0e0;
        border-radius: 5px;
        position: relative;
      }
      .bic-rotation-handle {
        width: 5px;
        height: 16px;
        background-color: #4CAF50;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
      .bic-rotation-labels {
        display: flex;
        width: 85px;
        justify-content: space-between;
        font-size: 10px;
        color: #666;
        position: absolute;
        bottom: 10px;
        left:-3px;
      }
      .bic-marker-highlight {
        box-shadow: 0 0 8px ${shadowColor};
      }
      /* 调试边框样式 - 只在开发时使用 
      .bic-directional-marker {
        outline: 1px dashed red;
      }
      .bic-marker-highlight {
        outline: 1px dashed blue;
      }
      */
    `;
    document.head.appendChild(style);
    
    // 创建旋转控制元素
    rotationControlEl = document.createElement('div');
    rotationControlEl.className = 'bic-rotation-control';
    rotationControlEl.style.display = 'none'; // 初始显示
    
    // 添加旋转值文本
    const rotationText = document.createElement('span');
    rotationText.textContent = `${Math.round(initialRotation)}°`;
    
    // 创建滑块容器
    const sliderContainer = document.createElement('div');
    sliderContainer.style.position = 'relative';
    sliderContainer.style.width = '80px';
    
    // 创建滑块轨道
    const sliderTrack = document.createElement('div');
    sliderTrack.className = 'bic-rotation-slider';
    
    // 创建滑块手柄
    const sliderHandle = document.createElement('div');
    sliderHandle.className = 'bic-rotation-handle';
    
    // 根据初始旋转位置手柄(0-360范围)
    const initialHandlePos = (initialRotation / 360) * 100;
    sliderHandle.style.left = `${initialHandlePos}%`;
    
    // 添加标签0°和360°
    const labelsDiv = document.createElement('div');
    labelsDiv.className = 'bic-rotation-labels';
    labelsDiv.innerHTML = '<span>0°</span><span>360°</span>';
    
    sliderTrack.appendChild(sliderHandle);
    sliderContainer.appendChild(sliderTrack);
    sliderContainer.appendChild(labelsDiv);
    
    rotationControlEl.appendChild(rotationText);
    rotationControlEl.appendChild(sliderContainer);
    markerEl.appendChild(rotationControlEl);
    
    // 滑块交互
    let isDragging = false;
    
    const updateRotationFromSlider = (clientX) => {
      const rect = sliderTrack.getBoundingClientRect();
      const trackWidth = rect.width;
      
      // 计算轨道内位置(限制在0-100%)
      let percent = (clientX - rect.left) / trackWidth * 100;
      percent = Math.max(0, Math.min(100, percent));
      
      // 更新手柄位置
      sliderHandle.style.left = `${percent}%`;
      
      // 计算旋转(0-360°)
      rotation = (percent / 100) * 360;
      
      // 更新显示和标记
      rotationText.textContent = `${Math.round(rotation)}°`;
      markerImg.style.transform = `rotate(${-rotation}deg)`;
      
      // 如果提供了onChange回调则调用
      if (onChange && typeof onChange === 'function') {
        onChange({
          lngLat: marker.getLngLat(),
          rotation: rotation
        });
      }
    };
    
    sliderHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      e.preventDefault();
      e.stopPropagation();
    });
    
    sliderTrack.addEventListener('mousedown', (e) => {
      isDragging = true;
      updateRotationFromSlider(e.clientX);
      e.preventDefault();
      e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      updateRotationFromSlider(e.clientX);
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
  
  // 切换编辑模式(显示/隐藏旋转控制)
  let editMode = false;
  
  const toggleEditMode = () => {
    editMode = !editMode;
    if (rotationControlEl) {
      rotationControlEl.style.display = editMode ? 'flex' : 'none';
    }
    
    // 显示/隐藏高亮效果
    if (highlightEl) {
      highlightEl.style.display = editMode ? 'block' : 'none';
    }
    
    // 切换标记是否可拖动
    marker.setDraggable(editMode);
    
    // 修改标记外观以表示选中状态
    if (editMode) {
      markerWrapper.style.transform = 'scale(1.05)'; // 只缩放包装容器，不影响旋转
      markerEl.style.filter = `drop-shadow(0 0 5px ${shadowColor})`; // 使用自定义阴影颜色
      markerEl.style.zIndex = 3; // 确保编辑状态的标记在最上层
      markerEl.style.cursor = 'move'; // 设置鼠标样式为可移动
    } else {
      markerWrapper.style.transform = 'scale(1)';
      markerEl.style.filter = 'none';
      markerEl.style.zIndex = 1; // 恢复默认层级
      markerEl.style.cursor = 'pointer'; // 设置鼠标样式为可点击
    }
  };
  
  // 双击切换编辑模式
  markerEl.addEventListener('dblclick', (e) => {
    toggleEditMode();
    e.preventDefault();
    e.stopPropagation();
  });
  
  // 如果启用了可拖动，则跟踪位置变化
  if (draggable) {
    marker.on('dragend', () => {
      if (onChange && typeof onChange === 'function') {
        onChange({
          lngLat: marker.getLngLat(),
          rotation: rotation
        });
      }
    });
  }
  
  // 初始化时根据options设置初始编辑模式状态
  if (initialEditMode) {
    toggleEditMode();
  }
  
  // 返回控制器对象
  return {
    marker,
    getPosition: () => marker.getLngLat(),
    setPosition: (lngLat) => marker.setLngLat(lngLat),
    getRotation: () => rotation,
    setRotation: (degrees) => {
      rotation = (degrees % 360 + 360) % 360; // 规范化到0-360
      markerImg.style.transform = `rotate(${-rotation}deg)`; // 负值用于逆时针旋转
      
      if (rotationControlEl) {
        // 更新文本显示
        rotationControlEl.querySelector('span').textContent = `${Math.round(rotation)}°`;
        
        // 如果存在滑块手柄则更新其位置
        const handle = rotationControlEl.querySelector('.bic-rotation-handle');
        if (handle) {
          handle.style.left = `${(rotation / 360) * 100}%`;
        }
      }
      
      if (onChange && typeof onChange === 'function') {
        onChange({
          lngLat: marker.getLngLat(),
          rotation: rotation
        });
      }
    },
    toggleEditMode,
    enableEditMode: () => {
      if (!editMode) toggleEditMode();
    },
    disableEditMode: () => {
      if (editMode) toggleEditMode();
    },
    remove: () => marker.remove(),
    isInEditMode: () => editMode
  };
}

/**
 * 批量添加带选中功能的POI点位标记，支持旋转角度和选中动态效果（单选模式）
 * @param {Object} map - 地图实例
 * @param {Array} points - 点位数组，每个点包含位置和旋转信息 [{id: string, lngLat: [lng, lat], rotation: number, name: string}]
 * @param {Object} options - 配置选项
 * @param {string} options.imagePath - 标记图片路径，默认为'/bicMap/assets/img/pos.png'
 * @param {number} options.size - 标记尺寸，默认为24像素
 * @param {boolean} options.showLabels - 是否显示标签，默认为false
 * @param {string} options.labelIconPath - 标签图标路径，默认为'/bicMap/assets/img/poi-sig.png'
 * @param {boolean} options.selectable - 是否支持选中功能，默认为true
 * @param {Object} options.selectedStyle - 选中样式配置
 * @param {string} options.selectedStyle.color - 选中时的扩散效果边框颜色，默认为'#ffba40'
 * @param {string} options.selectedStyle.fillColor - 选中时的扩散效果填充颜色，默认为'#ffba40'
 * @param {number} options.selectedStyle.fillOpacity - 填充透明度，默认为1
 * @param {number} options.selectedStyle.baseRadius - 扩散圆环的基础半径倍数，默认为0.2（相对于marker尺寸）
 * @param {number} options.selectedStyle.maxRadius - 扩散动画的最大半径倍数，默认为0.6（相对于marker尺寸）
 * @param {number} options.selectedStyle.strokeWidth - 扩散圆环的边框宽度，默认为3
 * @param {number} options.selectedStyle.opacity - 扩散圆环的初始透明度，默认为0
 * @param {number} options.selectedStyle.animationDuration - 动画持续时间（毫秒），默认为2000
 * @param {Function} options.onClick - 点击点位的回调函数
 * @param {Function} options.onSelectionChange - 选中状态变化的回调函数，包含previousSelected参数
 * @returns {Object} 包含批量点位控制方法的对象
 * @returns {Function} returns.selectById - 根据ID选中点位 selectById(id)
 * @returns {Function} returns.getMarkerById - 根据ID获取点位信息 getMarkerById(id)
 * @returns {Function} returns.toggleSelection - 切换点位选中状态
 * @returns {Function} returns.setSelection - 设置选中状态
 * @returns {Function} returns.clearSelection - 清除所有选中
 * @returns {Function} returns.getSelectedMarker - 获取当前选中的点位（单选模式）
 * @returns {Function} returns.setSelectable - 动态设置是否可选中 setSelectable(boolean)
 * @returns {Function} returns.isSelectable - 获取当前是否可选中状态 isSelectable()
 * @returns {Function} returns.updateMarkers - 更新点位数据
 * @returns {Function} returns.remove - 移除图层和数据源
 */
export function addBatchPOIMarkers(map, points = [], options = {}) {
  if (!maplibregl || !map) {
    throw new Error('地图未初始化。');
  }

  const {
    imagePath = '/bicMap/assets/img/pos.png',
    size = 24,
    showLabels = false,
    labelIconPath = '/bicMap/assets/img/poi-sig.png',
    selectable = true,
    selectedStyle = {
      color: '#ffba40',
      fillColor: '#ffba40',
      fillOpacity: 1,
      baseRadius: 0.2,
      maxRadius: 0.6,
      strokeWidth: 3,
      opacity: 0,
      animationDuration: 2000
    },
    // 标签空间避让（label collision avoidance）
    avoidLabelCollision = true, // 是否启用标签冲突隐藏
    labelPadding = 4,           // 标签外边距（像素），值越大标签越不容易相邻
    onClick = null,
    onSelectionChange = null
  } = options;

  // 创建可变的选中状态变量
  let isSelectableEnabled = selectable;

  // 验证和调整selectedStyle参数
  const adjustedStyle = { ...selectedStyle };
  
  // 确保maxRadius大于baseRadius
  if (adjustedStyle.maxRadius <= adjustedStyle.baseRadius) {
    console.warn(`selectedStyle.maxRadius (${adjustedStyle.maxRadius}) should be greater than baseRadius (${adjustedStyle.baseRadius}). Auto-adjusting maxRadius.`);
    adjustedStyle.maxRadius = adjustedStyle.baseRadius + 0.5;
  }
  
  // 计算实际像素值用于调试
  const baseRadiusPx = size * adjustedStyle.baseRadius;
  const maxRadiusPx = size * adjustedStyle.maxRadius;
  console.log(`POI Ripple Config: baseRadius=${baseRadiusPx.toFixed(1)}px, maxRadius=${maxRadiusPx.toFixed(1)}px, range=${(maxRadiusPx - baseRadiusPx).toFixed(1)}px`);
  console.log(`POI Fill Config: fillColor=${adjustedStyle.fillColor}, fillOpacity=${adjustedStyle.fillOpacity}`);
  
  // 使用调整后的样式
  const finalSelectedStyle = adjustedStyle;

  let opt_showLabels = showLabels || false;
  let selectedIndices = new Set(); // 存储选中的点位索引

  // 添加选中动画样式
  const addSelectionStyles = () => {
    const styleId = 'bic-poi-selection-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .bic-poi-label-selected {
        transform: scale(1.05);
        transition: transform 0.3s ease;
      }
      
              .bic-poi-label-selected .bic-poi-icon-container {
          background-color: ${finalSelectedStyle.color} !important;
          box-shadow: 0 0 8px ${finalSelectedStyle.color}99;
        }
        
        .bic-poi-label-selected .bic-poi-text-container {
          border-color: ${finalSelectedStyle.color} !important;
          box-shadow: 0 0 5px ${finalSelectedStyle.color}4D;
        }
    `;
    document.head.appendChild(style);
  };
  
  // 扩散动画控制
  let rippleAnimations = new Map(); // 存储每个点位的动画状态
  
  // 更新扩散圆环数据源
  const updateRippleData = () => {
    const rippleFeatures = [];
    
    selectedIndices.forEach(index => {
      if (index < points.length) {
        const point = points[index];
        rippleFeatures.push({
          type: 'Feature',
          id: `ripple-${index}`,
          geometry: {
            type: 'Point',
            coordinates: point.lngLat
          },
          properties: {
            index: index,
            scale: finalSelectedStyle.baseRadius,
            strokeOpacity: finalSelectedStyle.opacity,
            fillOpacity: finalSelectedStyle.fillOpacity
          }
        });
      }
    });
    
    console.log(`POI Ripple Data Update: selectedIndices=${Array.from(selectedIndices)}, features=${rippleFeatures.length}`);
    
    const rippleSource = map.getSource(rippleSourceId);
    if (rippleSource) {
      rippleSource.setData({
        type: 'FeatureCollection',
        features: rippleFeatures
      });
      console.log('POI Ripple Data: Source updated successfully');
    } else {
      console.error('POI Ripple Data: Source not found!', rippleSourceId);
    }
  };
  
  const startRippleAnimation = (index) => {
    const animationId = `ripple-${index}`;
    
    if (rippleAnimations.has(animationId)) {
      return; // 动画已在运行
    }
    
    const rippleLayerId = `${layerId}-ripple`;
    let animationFrame = 0;
    const maxFrames = Math.round((finalSelectedStyle.animationDuration / 1000) * 60); // 根据配置的持续时间计算帧数，60fps
    
    const animate = () => {
      if (!rippleAnimations.has(animationId) || !selectedIndices.has(index)) {
        return; // 动画已被停止或点位已取消选中
      }
      
      const progress = animationFrame / maxFrames;
      const scaleRange = finalSelectedStyle.maxRadius - finalSelectedStyle.baseRadius;
      const scale = finalSelectedStyle.baseRadius + progress * scaleRange; // 从baseRadius放大到maxRadius
      const strokeOpacity = Math.max(0, finalSelectedStyle.opacity * (1 - progress)); // 边框透明度渐变
      
      // 优化填充透明度渐变：使用更缓慢的衰减曲线，保持更长时间的高可见性
      let fillOpacity = 0;
      if (finalSelectedStyle.fillColor) {
        // 使用二次函数让透明度衰减更慢，前70%的动画保持较高透明度
        const fadeProgress = Math.max(0, (progress - 0.3) / 0.7); // 前30%保持满透明度
        fillOpacity = Math.max(0.1, finalSelectedStyle.fillOpacity * (1 - fadeProgress * fadeProgress)); // 最低保持0.1透明度
      }
      
      // 调试信息（开发时可以取消注释）
      if (animationFrame % 30 === 0) { // 每半秒输出一次调试信息
        const fadeProgress = Math.max(0, (progress - 0.3) / 0.7);
        // console.log(`POI ${index} Animation: frame=${animationFrame}, progress=${progress.toFixed(2)}, fadeProgress=${fadeProgress.toFixed(2)}, scale=${scale.toFixed(3)}, radius=${Math.max(2, size * scale).toFixed(1)}px, strokeOpacity=${strokeOpacity.toFixed(3)}, fillOpacity=${fillOpacity.toFixed(3)}, fillColor=${finalSelectedStyle.fillColor}`);
      }
      
              // 更新圆环样式
        if (map.getLayer(rippleLayerId)) {
          // 调试：检查图层是否可见
          if (animationFrame === 0) {
            // console.log(`POI Ripple Layer Check: layer=${rippleLayerId} exists, visible=${map.getLayoutProperty(rippleLayerId, 'visibility') !== 'none'}`);
          }
          // 更新半径
          map.setPaintProperty(rippleLayerId, 'circle-radius', [
            'case',
            ['==', ['get', 'index'], index],
            Math.max(2, size * scale), // 确保动画中的半径也有最小值
            Math.max(2, size * finalSelectedStyle.baseRadius)
          ]);
          
          // 更新边框透明度
          map.setPaintProperty(rippleLayerId, 'circle-stroke-opacity', [
            'case',
            ['==', ['get', 'index'], index],
            Math.min(1, strokeOpacity + 0.2),
            Math.min(1, finalSelectedStyle.opacity + 0.2)
          ]);
          
          // 更新填充效果（如果有填充）
          if (finalSelectedStyle.fillColor) {
            // 动态设置填充颜色 - 对所有点位都使用相同的填充颜色
            map.setPaintProperty(rippleLayerId, 'circle-color', finalSelectedStyle.fillColor);
            
            // 动态设置填充透明度 - 只有当前动画的点位使用动画透明度
            map.setPaintProperty(rippleLayerId, 'circle-opacity', [
              'case',
              ['==', ['get', 'index'], index],
              fillOpacity,
              finalSelectedStyle.fillOpacity
            ]);
          }
        }
      
      animationFrame++;
      
      if (animationFrame >= maxFrames) {
        animationFrame = 0; // 重新开始动画
      }
      
      if (rippleAnimations.has(animationId)) {
        requestAnimationFrame(animate);
      }
    };
    
    rippleAnimations.set(animationId, true);
    animate();
  };
  
  const stopRippleAnimation = (index) => {
    const animationId = `ripple-${index}`;
    rippleAnimations.delete(animationId);
  };

    // 确保地图加载了图标
  const iconId = 'poi-icon';
  
  const loadIcons = () => {
    return new Promise((resolve) => {
      if (map.hasImage(iconId)) {
        resolve();
        return;
      }
      
      safeImageLoader(imagePath)
        .then(img => {
          map.addImage(iconId, img);
          resolve();
        })
        .catch(error => {
          console.error('加载POI图标失败:', error);
          // 创建备用图标
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#4285F4';
          ctx.beginPath();
          ctx.arc(size/2, size/2, size/2-2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFF';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          map.addImage(iconId, canvas);
          resolve();
        });
    });
  };

  // 创建数据源和图层
  const sourceId = 'batch-poi-selection-source';
  const layerId = 'batch-poi-selection-layer';
  const rippleSourceId = `${sourceId}-ripple`;
  
  // 点位标记数据
  let markersData = {
    type: 'FeatureCollection',
    features: []
  };
  
  // HTML标签数组
  let labelMarkers = [];
  
  // 创建GeoJSON特征
  const createFeatures = (pointsData) => {
    const features = pointsData.map((point, index) => {
      const feature = {
        type: 'Feature',
        id: `${point.id}`, // 添加feature ID用于feature-state
        geometry: {
          type: 'Point',
          coordinates: point.lngLat
        },
        properties: {
          id: `${point.id}`,
          rotation: point.rotation || 0,
          name: point.name || `点位${index + 1}`
        }
      };
      
      // 调试信息：显示创建的feature（可选）
      // console.log(`POI Feature Created: index=${index}, point.id="${point.id}", feature.id="${feature.id}", properties.id="${feature.properties.id}"`);
      
      return feature;
    });
    
    return features;
  };
  
  // 创建HTML标签元素
  const createLabelElement = (point, index) => {
    const isSelected = selectedIndices.has(index);
    
    const labelEl = document.createElement('div');
    labelEl.className = `bic-poi-label`;
    labelEl.style.position = 'absolute';
    labelEl.style.pointerEvents = 'none';
    labelEl.style.display = opt_showLabels ? 'flex' : 'none';
    labelEl.style.alignItems = 'center';
    labelEl.style.justifyContent = 'flex-start';
    labelEl.style.marginTop = '0px';
    labelEl.style.zIndex = isSelected ? 2 : 1;
    
    // 创建左侧图标容器
    const iconContainer = document.createElement('div');
    iconContainer.className = 'bic-poi-icon-container';
    iconContainer.style.width = '20px';
    iconContainer.style.height = '20px';
    iconContainer.style.display = 'flex';
    iconContainer.style.alignItems = 'center';
    iconContainer.style.justifyContent = 'center';
    iconContainer.style.backgroundColor = '#1CD5A4';
    iconContainer.style.borderRadius = '5px';
    iconContainer.style.marginRight = '3px';
    iconContainer.style.transition = 'all 0.3s ease';
    
    // 向图标容器添加图标图片
    const locationIcon = document.createElement('img');
    locationIcon.src = labelIconPath;
    locationIcon.style.width = '20px';
    locationIcon.style.height = '20px';
    locationIcon.style.objectFit = 'contain';
    
    // 创建文字标签容器
    const textContainer = document.createElement('div');
    textContainer.className = 'bic-poi-text-container';
    textContainer.style.padding = '2px 5px';
    textContainer.style.backgroundColor = 'white';
    textContainer.style.border = `2px solid #1CD5A4`;
    textContainer.style.borderRadius = '5px';
    textContainer.style.whiteSpace = 'nowrap';
    textContainer.style.maxWidth = '200px';
    textContainer.style.minHeight = '20px';
    textContainer.style.boxSizing = 'border-box';
    textContainer.style.overflow = 'hidden';
    textContainer.style.textOverflow = 'ellipsis';
    textContainer.style.display = 'flex';
    textContainer.style.alignItems = 'center';
    textContainer.style.justifyContent = 'center';
    textContainer.style.transition = 'all 0.3s ease';
    
    // 添加文本
    const textSpan = document.createElement('span');
    textSpan.innerText = point.name || '未命名点位';
    textSpan.style.color = '#1CD5A4';
    textSpan.style.fontSize = '13px';
    textSpan.style.fontWeight = 'bold';
    textSpan.style.fontFamily = 'Harmony Regular, sans-serif';
    textSpan.style.lineHeight = '1';
    textSpan.style.display = 'block';
    textSpan.style.transition = 'color 0.3s ease';
    
    // 组装标签
    iconContainer.appendChild(locationIcon);
    textContainer.appendChild(textSpan);
    
    labelEl.appendChild(iconContainer);
    labelEl.appendChild(textContainer);
    
    return labelEl;
  };

  // 初始化图层和标签
  const initializeLayer = async () => {
    await loadIcons();
    addSelectionStyles();
    
    // 如果数据源已存在则更新，否则添加
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(markersData);
    } else {
      // 添加数据源
      map.addSource(sourceId, {
        type: 'geojson',
        data: markersData
      });
      
      // 添加符号图层以显示点位
      map.addLayer({
        id: layerId,
        type: 'symbol',
        source: sourceId,
        layout: {
          'icon-image': iconId,
          'icon-size': size / 48,
          'icon-rotate': ['get', 'rotation'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
      
      // 为扩散圆环创建单独的数据源
      map.addSource(rippleSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      
      // 添加扩散圆环图层（在符号图层下方）
      const ripplePaint = {
        'circle-radius': Math.max(2, size * finalSelectedStyle.baseRadius), // 确保最小半径为2px
        'circle-stroke-width': finalSelectedStyle.strokeWidth,
        'circle-stroke-color': finalSelectedStyle.color,
        'circle-stroke-opacity': Math.min(1, finalSelectedStyle.opacity + 0.2)
      };
      
      // 如果配置了填充颜色，则添加填充效果
      if (finalSelectedStyle.fillColor) {
        ripplePaint['circle-color'] = finalSelectedStyle.fillColor;
        ripplePaint['circle-opacity'] = finalSelectedStyle.fillOpacity;
        console.log(`POI Layer Init: Setting fill - color=${finalSelectedStyle.fillColor}, opacity=${finalSelectedStyle.fillOpacity}`);
      } else {
        // 无填充时，设置透明填充
        ripplePaint['circle-color'] = 'transparent';
        ripplePaint['circle-opacity'] = 0;
        console.log('POI Layer Init: No fill color configured');
      }
      
      map.addLayer({
        id: `${layerId}-ripple`,
        type: 'circle',
        source: rippleSourceId,
        paint: ripplePaint
      }, layerId); // 插入到符号图层之前，这样圆环在图标下方
      
      console.log(`POI Ripple Layer Added: id=${layerId}-ripple, paint=`, ripplePaint);
      
      // 监听地图移动事件，用于更新标签位置
      map.on('move', updateLabelsPosition);
    }
    
    // 清除现有标签
    clearLabels();
    
    // 如果需要显示标签，为每个点位创建独立的HTML标签
    if (opt_showLabels) {
      createLabelsForPoints();
    }
    
    // 为图层添加点击事件
    if (isSelectableEnabled || (onClick && typeof onClick === 'function')) {
      map.on('click', layerId, (e) => {
        // 防止事件冒泡，避免触发地图点击事件
        e.originalEvent.stopPropagation();
        
        // 获取点击的特征
        const features = map.queryRenderedFeatures(e.point, {
          layers: [layerId]
        });
        
        if (features.length > 0) {
          const feature = features[0];
          const pointId = feature.properties.id;
          
          // 调试信息：显示点击的feature信息和当前points数组（可选）
          // console.log(`POI Click Debug: feature.id="${pointId}", feature.properties=`, feature.properties);
          // console.log(`POI Click Debug: points array IDs=`, points.map(p => p.id));
          
          // 根据ID查找点位索引（处理类型转换）
          const pointIndex = points.findIndex(point => String(point.id) === String(pointId));
          
          if (pointIndex !== -1) {
            const clickedPoint = points[pointIndex];
            
            // 处理选中状态
            if (isSelectableEnabled) {
              toggleSelection(pointIndex);
            }
            
            // 调用点击回调
            if (onClick && typeof onClick === 'function') {
              onClick({
                lngLat: feature.geometry.coordinates,
                rotation: feature.properties.rotation,
                name: feature.properties.name,
                index: pointIndex,
                id: pointId,
                originalPoint: clickedPoint,
                selected: selectedIndices.has(pointIndex)
              });
            }
          } else {
            console.warn(`POI with id "${pointId}" not found in points array`);
          }
        }
      });
      
      // 鼠标悬停时改变光标样式
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    }
  };
  
  // 切换选中状态（单选模式）
  const toggleSelection = (index) => {
    if (index < 0 || index >= points.length) return false;
    
    const wasSelected = selectedIndices.has(index);
    
    // 清除所有现有选中状态
    const previousSelected = Array.from(selectedIndices);
    rippleAnimations.clear();
    
    // 清除所有feature-state
    previousSelected.forEach(prevIndex => {
      const prevPoint = points[prevIndex];
      if (prevPoint && prevPoint.id) {
        map.setFeatureState(
          { source: sourceId, id: prevPoint.id },
          { selected: false }
        );
      }
      stopRippleAnimation(prevIndex);
    });
    
    selectedIndices.clear();
    
    // 如果点击的不是已选中的marker，则选中它
    if (!wasSelected) {
      selectedIndices.add(index);
      const currentPoint = points[index];
      
      // 设置选中状态
      if (currentPoint && currentPoint.id) {
        map.setFeatureState(
          { source: sourceId, id: currentPoint.id },
          { selected: true }
        );
      }
      
      // 启动扩散动画
      startRippleAnimation(index);
    }
    
    // 更新扩散圆环数据
    updateRippleData();
    
    // 更新所有标签样式
    if (opt_showLabels) {
      labelMarkers.forEach(item => {
        const isSelected = selectedIndices.has(item.pointIndex);
        updateLabelSelection(item.pointIndex, isSelected);
      });
      // 选中项优先级提升，需要重算避让以确保它一定可见
      applyLabelCollisionAvoidance();
    }
    
    // 调用选中状态变化回调
    if (onSelectionChange && typeof onSelectionChange === 'function') {
      onSelectionChange({
        index,
        selected: !wasSelected,
        point: points[index],
        selectedIndices: Array.from(selectedIndices),
        previousSelected: previousSelected
      });
    }
    
    return !wasSelected;
  };
  
  // 更新标记数据
  const updateMarkersData = () => {
    markersData.features = createFeatures(points);
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(markersData);
      
      // 重新设置所有选中状态
      selectedIndices.forEach(index => {
        const point = points[index];
        if (point && point.id) {
          map.setFeatureState(
            { source: sourceId, id: point.id },
            { selected: true }
          );
        }
      });
    }
    
    // 数据变化可能改变标签位置/数量，重新执行空间避让
    applyLabelCollisionAvoidance();
  };
  
  // 更新标签选中状态
  const updateLabelSelection = (index, isSelected) => {
    const labelItem = labelMarkers.find(item => item.pointIndex === index);
    if (!labelItem || !labelItem.element) return;
    
    const labelEl = labelItem.element;
    const iconContainer = labelEl.querySelector('.bic-poi-icon-container');
    const textContainer = labelEl.querySelector('.bic-poi-text-container');
    
    if (isSelected) {
      if (iconContainer) {
        iconContainer.style.backgroundColor = finalSelectedStyle.color;
      }
      
      if (textContainer) {
        textContainer.style.borderColor = finalSelectedStyle.color;
      }
      
      // 字体颜色保持不变，不设置选中状态的颜色
    } else {
      if (iconContainer) {
        iconContainer.style.backgroundColor = '#1CD5A4';
      }
      
      if (textContainer) {
        textContainer.style.borderColor = '#1CD5A4';
      }
      
      // 字体颜色保持默认，不重置
    }
  };
  
  // 为所有点位创建标签
  const createLabelsForPoints = () => {
    points.forEach((point, index) => {
      createLabelForPoint(point, index);
    });
    // 批量创建后触发一次空间避让（rAF 里测量刚插入的 DOM 尺寸）
    applyLabelCollisionAvoidance();
  };
  
  // 为单个点位创建标签元素并添加到DOM
  const createLabelForPoint = (point, index) => {
    // 创建标签元素
    const labelEl = createLabelElement(point, index);
    labelEl.id = `bic-poi-label-${index}`;
    labelEl.style.position = 'absolute';
    
    // 添加到地图容器
    const mapContainer = map.getContainer();
    mapContainer.appendChild(labelEl);
    
    // 存储标签引用
    labelMarkers.push({
      element: labelEl,
      pointIndex: index
    });
    
    // 立即更新位置
    updateLabelPosition(labelEl, point.lngLat);
  };
  
  // 更新单个标签位置
  const updateLabelPosition = (labelEl, lngLat) => {
    const pos = map.project(lngLat);
    labelEl.style.left = `${pos.x - 10}px`;
    labelEl.style.top = `${pos.y - 35}px`;
  };
  
  // 更新所有标签位置
  const updateLabelsPosition = () => {
    if (!opt_showLabels) return;
    
    labelMarkers.forEach(marker => {
      const point = points[marker.pointIndex];
      if (point) {
        updateLabelPosition(marker.element, point.lngLat);
      }
    });
    
    // 空间避让：在位置更新后重新计算哪些标签需要隐藏
    applyLabelCollisionAvoidance();
  };
  
  // ========== 标签空间避让（Label Collision Avoidance） ==========
  // 用 AABB（轴对齐包围盒）做贪心放置：选中项最高优先级，其余按 pointIndex 稳定排序，
  // 后位若与已放置任一标签重叠则 visibility:hidden，反之 visible。
  
  const labelSizeCache = new WeakMap(); // 缓存标签尺寸，避免每帧重复强制回流
  
  const measureLabelSize = (labelEl) => {
    // 命中缓存直接返回（尺寸由文字长度决定，不随地图平移缩放变化）
    const cached = labelSizeCache.get(labelEl);
    if (cached && cached.width > 0 && cached.height > 0) return cached;
    
    const size = {
      width: labelEl.offsetWidth,
      height: labelEl.offsetHeight
    };
    if (size.width > 0 && size.height > 0) {
      labelSizeCache.set(labelEl, size);
    }
    return size;
  };
  
  const getLabelRect = (labelEl) => {
    const left = parseFloat(labelEl.style.left) || 0;
    const top  = parseFloat(labelEl.style.top)  || 0;
    const { width, height } = measureLabelSize(labelEl);
    return { left, top, right: left + width, bottom: top + height, width, height };
  };
  
  const rectsOverlap = (a, b, padding = 0) => {
    return !(
      a.right  + padding < b.left ||
      b.right  + padding < a.left ||
      a.bottom + padding < b.top  ||
      b.bottom + padding < a.top
    );
  };
  
  // 获取地图容器可视矩形（标签完全在可视区外也直接隐藏）
  const getContainerRect = () => {
    const canvas = map.getCanvas();
    return { left: 0, top: 0, right: canvas.clientWidth, bottom: canvas.clientHeight };
  };
  
  const rectInsideContainer = (rect, container) => {
    return !(
      rect.right  < container.left ||
      rect.left   > container.right ||
      rect.bottom < container.top ||
      rect.top    > container.bottom
    );
  };
  
  let collisionRaf = 0;
  const applyLabelCollisionAvoidance = () => {
    if (!opt_showLabels) return;
    if (!avoidLabelCollision) {
      // 未开启避让：全部强制可见，撤销可能遗留的 hidden 状态
      labelMarkers.forEach(item => {
        if (item.element) item.element.style.visibility = 'visible';
      });
      return;
    }
    
    // 用 rAF 合并同一帧内的多次调用（例如 move + updateMarkersData 同时触发）
    if (collisionRaf) return;
    collisionRaf = requestAnimationFrame(() => {
      collisionRaf = 0;
      runCollisionAvoidance();
    });
  };
  
  const runCollisionAvoidance = () => {
    if (!opt_showLabels || labelMarkers.length === 0) return;
    
    const container = getContainerRect();
    
    // 收集可参与避让的候选：必须有效、有尺寸、在可视区内
    const candidates = [];
    labelMarkers.forEach(item => {
      const point = points[item.pointIndex];
      if (!point || !item.element) return;
      
      const rect = getLabelRect(item.element);
      if (rect.width === 0 || rect.height === 0) return; // 还未测量到尺寸，跳过本帧
      
      if (!rectInsideContainer(rect, container)) {
        // 超出画布的直接隐藏，也不参与后续判定
        item.element.style.visibility = 'hidden';
        return;
      }
      
      candidates.push({
        element: item.element,
        pointIndex: item.pointIndex,
        isSelected: selectedIndices.has(item.pointIndex),
        rect
      });
    });
    
    // 优先级：选中 > 未选中；同优先级按 pointIndex 升序（稳定，不会因地图平移闪烁）
    candidates.sort((a, b) => {
      if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1;
      return a.pointIndex - b.pointIndex;
    });
    
    const placed = [];
    for (const cand of candidates) {
      let hit = false;
      for (let i = 0; i < placed.length; i++) {
        if (rectsOverlap(cand.rect, placed[i].rect, labelPadding)) {
          hit = true;
          break;
        }
      }
      if (hit) {
        cand.element.style.visibility = 'hidden';
      } else {
        cand.element.style.visibility = 'visible';
        placed.push(cand);
      }
    }
  };
  
  // 清除HTML标签
  const clearLabels = () => {
    labelMarkers.forEach(item => {
      if (item.element && item.element.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });
    labelMarkers = [];
  };
  
  // 更新点位数据
  const updateMarkers = (newPoints = []) => {
    points = newPoints;
    // 清理无效的选中索引
    selectedIndices = new Set([...selectedIndices].filter(index => index < points.length));
    updateMarkersData();
    
    // 更新HTML标签
    if (opt_showLabels) {
      clearLabels();
      createLabelsForPoints();
    }
  };
  
  // 添加点位
  const addMarker = (point) => {
    const newIndex = points.length;
    points.push(point);
    updateMarkersData();
    
    // 如果开启了标签显示，添加HTML标签
    if (opt_showLabels) {
      createLabelForPoint(point, newIndex);
    }
    
    return newIndex;
  };
  
  // 更新指定点位
  const updateMarker = (index, point) => {
    if (index >= 0 && index < points.length) {
      const oldPoint = points[index];
      points[index] = { ...oldPoint, ...point };
      updateMarkersData();
      
      // 如果开启了标签显示，更新HTML标签
      if (opt_showLabels) {
        const labelItem = labelMarkers.find(item => item.pointIndex === index);
        
        if (labelItem && labelItem.element) {
          // 移除旧标签
          if (labelItem.element.parentNode) {
            labelItem.element.parentNode.removeChild(labelItem.element);
          }
          
          // 创建新标签
          const itemIndex = labelMarkers.indexOf(labelItem);
          if (itemIndex !== -1) {
            createLabelForPoint(points[index], index);
            labelMarkers.splice(itemIndex, 1);
          }
        }
      }
      
      return true;
    }
    
    return false;
  };
  
  // 删除指定点位
  const removeMarker = (index) => {
    if (index >= 0 && index < points.length) {
      points.splice(index, 1);
      
      // 移除选中状态
      selectedIndices.delete(index);
      // 更新其他选中索引
      const newSelectedIndices = new Set();
      selectedIndices.forEach(selectedIndex => {
        if (selectedIndex > index) {
          newSelectedIndices.add(selectedIndex - 1);
        } else if (selectedIndex < index) {
          newSelectedIndices.add(selectedIndex);
        }
      });
      selectedIndices = newSelectedIndices;
      
      updateMarkersData();
      
      // 如果开启了标签显示，删除HTML标签
      if (opt_showLabels) {
        const labelItem = labelMarkers.find(item => item.pointIndex === index);
        
        if (labelItem && labelItem.element) {
          if (labelItem.element.parentNode) {
            labelItem.element.parentNode.removeChild(labelItem.element);
          }
          
          const itemIndex = labelMarkers.indexOf(labelItem);
          if (itemIndex !== -1) {
            labelMarkers.splice(itemIndex, 1);
          }
        }
        
        // 更新剩余标签的索引引用
        labelMarkers.forEach(item => {
          if (item.pointIndex > index) {
            item.pointIndex--;
          }
        });
      }
      
      return true;
    }
    
    return false;
  };
  
  // 删除所有点位
  const clearMarkers = () => {
    points = [];
    selectedIndices.clear();
    updateMarkersData();
    clearLabels();
  };
  
  // 获取所有点位
  const getMarkers = () => {
    return [...points];
  };
  
  // 获取选中的点位（单选模式下最多返回一个）
  const getSelectedMarkers = () => {
    return Array.from(selectedIndices).map(index => ({
      index,
      point: points[index]
    }));
  };
  
  // 获取当前选中的点位（单选模式专用）
  const getSelectedMarker = () => {
    if (selectedIndices.size === 0) return null;
    const index = Array.from(selectedIndices)[0];
    return {
      index,
      point: points[index]
    };
  };
  
  // 设置选中状态（单选模式下只选中第一个有效索引）
  const setSelection = (indices) => {
    // 停止所有现有动画
    rippleAnimations.clear();
    
    // 清除所有现有选中状态
    const previousSelected = Array.from(selectedIndices);
    previousSelected.forEach(prevIndex => {
      const prevPoint = points[prevIndex];
      if (prevPoint && prevPoint.id) {
        map.setFeatureState(
          { source: sourceId, id: prevPoint.id },
          { selected: false }
        );
      }
    });
    
    selectedIndices.clear();
    
    // 在单选模式下，只选中第一个有效索引
    const validIndices = indices.filter(index => index >= 0 && index < points.length);
    if (validIndices.length > 0) {
      const index = validIndices[0];
      selectedIndices.add(index);
      
      // 设置选中状态
      const currentPoint = points[index];
      if (currentPoint && currentPoint.id) {
        map.setFeatureState(
          { source: sourceId, id: currentPoint.id },
          { selected: true }
        );
      }
      
      // 启动扩散动画
      startRippleAnimation(index);
    }
    
    updateMarkersData();
    
    // 更新扩散圆环数据
    updateRippleData();
    
    if (opt_showLabels) {
      // 更新所有标签的选中状态
      labelMarkers.forEach(item => {
        updateLabelSelection(item.pointIndex, selectedIndices.has(item.pointIndex));
      });
      applyLabelCollisionAvoidance();
    }
  };
  
  // 清除所有选中
  const clearSelection = () => {
    // 停止所有动画
    rippleAnimations.clear();
    
    selectedIndices.clear();
    updateMarkersData();
    
    // 更新扩散圆环数据
    updateRippleData();
    
    if (opt_showLabels) {
      labelMarkers.forEach(item => {
        updateLabelSelection(item.pointIndex, false);
      });
      applyLabelCollisionAvoidance();
    }
  };
  
  // 选中第一个点位（单选模式下的"全选"行为）
  const selectAll = () => {
    if (points.length === 0) return;
    
    // 在单选模式下，"全选"意味着选中第一个点位
    setSelection([0]);
  };
  
  // 根据ID选中点位（单选模式）
  const selectById = (id) => {
    if (!id) return false;
    
    // 查找匹配ID的点位索引（处理类型转换）
    const index = points.findIndex(point => String(point.id) === String(id));
    
    if (index === -1) {
      console.warn(`POI with id "${id}" not found`);
      return false;
    }
    
    // 使用现有的toggleSelection方法来选中该点位
    // 由于是单选模式，会自动清除其他选中状态
    const wasSelected = selectedIndices.has(index);
    
    if (!wasSelected) {
      // 清除所有现有选中状态
      const previousSelected = Array.from(selectedIndices);
      rippleAnimations.clear();
      
      // 清除所有feature-state
      previousSelected.forEach(prevIndex => {
        const prevPoint = points[prevIndex];
        if (prevPoint && prevPoint.id) {
          map.setFeatureState(
            { source: sourceId, id: prevPoint.id },
            { selected: false }
          );
        }
        stopRippleAnimation(prevIndex);
      });
      
      selectedIndices.clear();
      
      // 选中新的点位
      selectedIndices.add(index);
      
      // 设置选中状态
      map.setFeatureState(
        { source: sourceId, id: id },
        { selected: true }
      );
      
      // 启动扩散动画
      startRippleAnimation(index);
      
      // 更新扩散圆环数据
      updateRippleData();
      
      // 更新所有标签样式
      if (opt_showLabels) {
        labelMarkers.forEach(item => {
          const isSelected = selectedIndices.has(item.pointIndex);
          updateLabelSelection(item.pointIndex, isSelected);
        });
        applyLabelCollisionAvoidance();
      }
      
      console.log(`POI selected by id: ${id}, index: ${index}`);
      return true;
    }
    
    return false;
  };
  
  // 根据ID获取点位信息
  const getMarkerById = (id) => {
    if (!id) return null;
    
    const index = points.findIndex(point => String(point.id) === String(id));
    if (index === -1) return null;
    
    return {
      index,
      point: points[index],
      selected: selectedIndices.has(index)
    };
  };
  
  // 显示/隐藏标签
  const toggleLabels = (show) => {
    let newShowLabels;
    if (show === undefined) {
      newShowLabels = !opt_showLabels;
    } else {
      newShowLabels = show;
    }
    
    if (newShowLabels && !opt_showLabels) {
      createLabelsForPoints();
    } else if (!newShowLabels && opt_showLabels) {
      clearLabels();
    }
    
    opt_showLabels = newShowLabels;
    return newShowLabels;
  };
  
  // 动态设置是否可选中
  const setSelectable = (isSelectable) => {
    const wasSelectable = isSelectableEnabled;
    isSelectableEnabled = !!isSelectable; // 转换为布尔值
    
    if (!isSelectableEnabled && wasSelectable) {
      // 如果从可选中变为不可选中，清除所有选中状态
      clearSelection();
      console.log('POI markers set to non-selectable, cleared all selections');
    } else if (isSelectableEnabled && !wasSelectable) {
      // 如果从不可选中变为可选中，需要重新创建label以确保正确的选中状态
      if (opt_showLabels) {
        // 重新创建所有label以确保它们具有正确的初始状态
        clearLabels();
        createLabelsForPoints();
        console.log('POI markers set to selectable, recreated labels with correct selection states');
      }
    }
    
    console.log(`POI markers selectable: ${isSelectableEnabled}`);
    return isSelectableEnabled;
  };
  
  // 获取当前是否可选中状态
  const isSelectable = () => {
    return isSelectableEnabled;
  };
  
  // 移除图层和数据源
  const remove = () => {
    // 停止所有动画
    rippleAnimations.clear();
    
    // 取消可能挂起的避让计算
    if (collisionRaf) {
      cancelAnimationFrame(collisionRaf);
      collisionRaf = 0;
    }
    
    if (map.getLayer(layerId)) {
      map.off('click', layerId);
      map.off('mouseenter', layerId);
      map.off('mouseleave', layerId);
      map.off('move', updateLabelsPosition);
      map.removeLayer(layerId);
    }
    
    // 移除扩散圆环图层和数据源
    const rippleLayerId = `${layerId}-ripple`;
    if (map.getLayer(rippleLayerId)) {
      map.removeLayer(rippleLayerId);
    }
    
    if (map.getSource(rippleSourceId)) {
      map.removeSource(rippleSourceId);
    }
    
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
    
    clearLabels();
    
    if (map.hasImage(iconId)) {
      map.removeImage(iconId);
    }
    
    // 清理样式
    const styleEl = document.getElementById('bic-poi-selection-styles');
    if (styleEl) {
      styleEl.remove();
    }
  };
  
  // 初始化点位数据
  markersData.features = createFeatures(points);
  
  // 初始化图层
  initializeLayer();
  
  // 返回控制器对象
  return {
    updateMarkers,
    addMarker,
    updateMarker,
    removeMarker,
    clearMarkers,
    getMarkers,
    getSelectedMarkers,
    getSelectedMarker, // 单选模式专用方法
    getMarkerById, // 根据ID获取点位信息
    toggleSelection,
    setSelection,
    clearSelection,
    selectAll, // 在单选模式下选中第一个点位
    selectById, // 根据ID选中点位
    toggleLabels,
    setSelectable, // 动态设置是否可选中
    isSelectable, // 获取当前是否可选中状态
    remove
  };
} 