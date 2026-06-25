import maplibregl from 'maplibre-gl';
import { safeImageLoader } from '../utils/loaders.js';
/**
 * 添加机器人位置标记，支持旋转角度和标签
 * @param {Object} maplibregl - maplibregl实例
 * @param {Object} map - 地图实例
 * @param {Array} robots - 机器人数组，每个机器人包含位置、旋转和标识信息 [{lngLat: [lng, lat], rotation: number, name: string, id: string}]
 * @param {Object} options - 配置选项
 * @param {string} options.svgPath - 标记SVG路径，默认为'/bicMap/assets/svg/robo.svg'
 * @param {number} options.size - 标记尺寸，默认为30像素
 * @param {boolean} options.showLabels - 是否显示标签，默认为true
 * @param {Function} options.onClick - 点击机器人标记的回调函数
 * @returns {Object} 包含机器人标记控制方法的对象
 */
export function addRobotMarkers(map, robots = [], options = {}) {
  if (!maplibregl || !map) {
    throw new Error('地图未初始化。');
  }

  const {
    svgPath = '/bicMap/assets/img/robo.png',
    size = 30,
    onClick = null,
    GPSToCartesian = null
  } = options;
  
  // 将 showLabels 变为可修改的变量，而不是从解构中获取的常量
  let showLabels = options.showLabels !== undefined ? options.showLabels : true;

  // 确保地图加载了图标
  const iconId = 'robot-icon';
  
  const loadIcon = () => {
    return new Promise((resolve) => {
      if (map.hasImage(iconId)) {
        resolve();
        return;
      }
      
      safeImageLoader(svgPath)
        .then(img => {
          map.addImage(iconId, img);
          resolve();
        })
        .catch(error => {
          console.error('加载机器人图标失败:', error);
          // 创建备用图标
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0066FF';
          ctx.beginPath();
          ctx.arc(size/2, size/2, size/2-2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#BBD6FF';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          map.addImage(iconId, canvas);
          resolve();
        });
    });
  };

  // 创建数据源和图层
  const sourceId = 'robot-markers-source';
  const layerId = 'robot-markers-layer';
  
  // 机器人标记数据
  let markersData = {
    type: 'FeatureCollection',
    features: []
  };
  
  // HTML标签数组
  let labelMarkers = [];
  
  // 创建GeoJSON特征
  const createFeatures = (robotsData) => {
    return robotsData.map((robot, index) => {
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: robot.lngLat
        },
        properties: {
          id: robot.id || `robot-${index}`,
          rotation: robot.rotation || 0,
          name: robot.name || `机器人${index + 1}`
        }
      };
    });
  };
  
  // 创建HTML标签元素
  const createLabelElement = (robot) => {
    const labelEl = document.createElement('div');
    labelEl.className = 'bic-robot-label';
    labelEl.style.position = 'absolute';
    labelEl.style.pointerEvents = 'none';
    labelEl.style.display = 'block'; // 始终创建为可见状态，通过toggleLabels控制整体可见性
    labelEl.style.textAlign = 'center';
    labelEl.style.marginTop = '-45px'; // 额外向上偏移
    labelEl.style.transform = 'translateX(-50%)'; // 水平居中对齐
    labelEl.style.zIndex = 2;
    
    // 创建带箭头的气泡容器
    const bubbleContainer = document.createElement('div');
    bubbleContainer.className = 'bic-robot-bubble-container';
    bubbleContainer.style.position = 'relative';
    bubbleContainer.style.padding = '0';
    bubbleContainer.style.marginBottom = '7px'; // 为箭头留出空间
    bubbleContainer.style.display = 'inline-block'; // 使容器宽度适应内容
    
    // 创建背景容器
    const bgContainer = document.createElement('table'); // 使用表格布局
    bgContainer.className = 'bic-robot-bg-container';
    bgContainer.style.borderCollapse = 'collapse';
    bgContainer.style.borderRadius = '6px';
    bgContainer.style.overflow = 'hidden'; // 确保子元素不会超出圆角
    bgContainer.style.border = '1px solid #86B3FF';
    bgContainer.style.minWidth = '120px';
    bgContainer.style.boxShadow = '0 1px 3px rgba(0, 102, 255, 0.2)';
    bgContainer.style.width = '100%';
    bgContainer.style.backgroundColor = '#0066FF';
    bgContainer.style.borderBottomLeftRadius = '6px';
    bgContainer.style.borderBottomRightRadius = '6px';

    
    // 创建表格行
    const coordRow = document.createElement('tr');
    const nameRow = document.createElement('tr');
    
    // 创建坐标信息单元格 (上部分 - 白底)
    const coordCell = document.createElement('td');
    coordCell.style.backgroundColor = '#FFFFFF';
    coordCell.style.padding = '3px 0';
    coordCell.style.height = '18px';
    coordCell.style.textAlign = 'center';
    coordCell.style.verticalAlign = 'middle';
    coordCell.style.borderBottomLeftRadius = '6px';
    coordCell.style.borderBottomRightRadius = '6px';
    
    // 创建坐标信息标签
    const gpsPoint = typeof GPSToCartesian === 'function'
      ? GPSToCartesian(robot.lngLat[0], robot.lngLat[1])
      : { x: robot.lngLat[0].toFixed(4), y: robot.lngLat[1].toFixed(4) };
    const rotate = robot.rotation?.toFixed(1) || '0.0';
    coordCell.innerHTML = `<span style="padding: 0px 10px;color:#0066FF;font-size:10px;font-weight:normal;font-family:Harmony Regular,sans-serif;line-height:1;white-space:nowrap;letter-spacing:-0.2px;">${gpsPoint.x},${gpsPoint.y},${rotate}°</span>`;
    
    // 创建名称单元格 (下部分 - 蓝底)
    const nameCell = document.createElement('td');
    nameCell.style.backgroundColor = '#0066FF';
    nameCell.style.padding = '3px 0';
    nameCell.style.height = '20px';
    nameCell.style.textAlign = 'center';
    nameCell.style.verticalAlign = 'middle';
    nameCell.style.borderBottomLeftRadius = '6px';
    nameCell.style.borderBottomRightRadius = '6px';
    
    // 准备机器人名称
    const robotName = robot.name || '未命名机器人';
    // 限制显示10个字符，超出显示...
    const displayName = robotName.length > 10 ? robotName.substring(0, 10) + '...' : robotName;
    nameCell.innerHTML = `<span style="color:#FFFFFF;font-size:12px;font-weight:bold;font-family:Harmony Regular,sans-serif;line-height:1;white-space:nowrap;">${displayName}</span>`;
    
    // 创建气泡箭头 (蓝色，与下部分同色)
    // const arrow = document.createElement('div');
    // arrow.className = 'bic-robot-bubble-arrow';
    // arrow.style.position = 'absolute';
    // arrow.style.bottom = '-6px';
    // arrow.style.left = '50%';
    // arrow.style.transform = 'translateX(-50%)';
    // arrow.style.width = '0';
    // arrow.style.height = '0';
    // arrow.style.borderLeft = '5px solid transparent';
    // arrow.style.borderRight = '5px solid transparent';
    // arrow.style.borderTop = '5px solid #0066FF';
    
    // 组装表格
    coordRow.appendChild(coordCell);
    nameRow.appendChild(nameCell);
    
    bgContainer.appendChild(coordRow);
    bgContainer.appendChild(nameRow);
    
    bubbleContainer.appendChild(bgContainer);
    // bubbleContainer.appendChild(arrow);
    
    labelEl.appendChild(bubbleContainer);
    
    return labelEl;
  };

  // 初始化图层和标签
  const initializeLayer = async () => {
    await loadIcon();
    
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
          'icon-size': size / 48, // 缩放比例
          'icon-rotate': ['get', 'rotation'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
      
      // 监听地图移动事件，用于更新标签位置
      map.on('move', updateLabelsPosition);
    }
    
    // 清除现有标签
    clearLabels();
    
    // 如果需要显示标签，为每个机器人创建独立的HTML标签
    if (showLabels && robots.length > 0) {
      createLabelsForRobots();
    }
    
    // 为图层添加点击事件
    if (onClick && typeof onClick === 'function') {
      map.on('click', layerId, (e) => {
        // 防止事件冒泡，避免触发地图点击事件
        e.originalEvent.stopPropagation();
        
        // 获取点击的特征
        const features = map.queryRenderedFeatures(e.point, {
          layers: [layerId]
        });
        
        if (features.length > 0) {
          const feature = features[0];
          const robotId = feature.properties.id;
          const robotIndex = robots.findIndex(robot => 
            (robot.id && robot.id === robotId) || 
            (!robot.id && robotId.startsWith('robot-'))
          );
          
          if (robotIndex !== -1) {
            const clickedRobot = robots[robotIndex];
            
            onClick({
              lngLat: feature.geometry.coordinates,
              rotation: feature.properties.rotation,
              name: feature.properties.name,
              id: robotId,
              index: robotIndex,
              originalRobot: clickedRobot
            });
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
  
  // 为所有机器人创建标签
  const createLabelsForRobots = () => {
    robots.forEach((robot, index) => {
      createLabelForRobot(robot, index);
    });
  };
  
  // 为单个机器人创建标签元素并添加到DOM
  const createLabelForRobot = (robot, index) => {
    // 创建标签元素
    const labelEl = createLabelElement(robot);
    labelEl.id = `bic-robot-label-${index}`;
    labelEl.style.position = 'absolute';
    labelEl.style.zIndex = 2; // 确保在其他元素之上
    
    // 添加到地图容器
    const mapContainer = map.getContainer();
    mapContainer.appendChild(labelEl);
    
    // 存储标签引用
    labelMarkers.push({
      element: labelEl,
      robotIndex: index
    });
    
    // 立即更新位置
    updateLabelPosition(labelEl, robot.lngLat);
  };
  
  // 更新单个标签位置
  const updateLabelPosition = (labelEl, lngLat) => {
    const pos = map.project(lngLat);
    // 设置标签位置在点位正上方居中
    labelEl.style.left = `${pos.x}px`; // 通过transform: translateX(-50%)实现水平居中
    labelEl.style.top = `${pos.y - 38}px`;  // 垂直偏移，在图标上方，保留箭头的空间
  };
  
  // 更新所有标签位置
  const updateLabelsPosition = () => {
    if (!showLabels) return;
    
    labelMarkers.forEach(marker => {
      const robot = robots[marker.robotIndex];
      if (robot) {
        updateLabelPosition(marker.element, robot.lngLat);
      }
    });
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
  
  // 更新机器人数据
  const updateRobots = (newRobots = []) => {
    robots = newRobots;
    markersData.features = createFeatures(robots);
    
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(markersData);
    }
    
    // 处理HTML标签
    clearLabels(); // 始终清除旧标签
    
    // 如果启用了标签显示且有机器人数据，重新创建标签
    if (showLabels && robots.length > 0) {
      createLabelsForRobots();
    }
  };
  
  // 添加机器人
  const addRobot = (robot) => {
    const newIndex = robots.length;
    robots.push(robot);
    markersData.features = createFeatures(robots);
    
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(markersData);
    }
    
    // 如果开启了标签显示，添加HTML标签
    if (showLabels) {
      createLabelForRobot(robot, newIndex);
    }
    
    return newIndex; // 返回新添加机器人的索引
  };
  
  // 更新指定机器人
  const updateRobot = (identifier, robot) => {
    let index = -1;
    
    // 可以通过索引或ID查找
    if (typeof identifier === 'number') {
      index = identifier;
    } else if (typeof identifier === 'string') {
      index = robots.findIndex(r => r.id === identifier);
    }
    
    if (index >= 0 && index < robots.length) {
      const oldRobot = robots[index];
      robots[index] = { ...oldRobot, ...robot };
      markersData.features = createFeatures(robots);
      
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData(markersData);
      }
      
      // 如果开启了标签显示，完全重建HTML标签以确保数据更新
      if (showLabels) {
        // 查找对应的标签
        const labelItem = labelMarkers.find(item => item.robotIndex === index);
        
        if (labelItem && labelItem.element) {
          // 移除旧标签
          if (labelItem.element.parentNode) {
            labelItem.element.parentNode.removeChild(labelItem.element);
          }
          
          // 创建新标签
          const itemIndex = labelMarkers.indexOf(labelItem);
          if (itemIndex !== -1) {
            labelMarkers.splice(itemIndex, 1); // 删除旧引用
            createLabelForRobot(robots[index], index);
          }
        }
      }
      
      return true;
    }
    
    return false;
  };
  
  // 删除指定机器人
  const removeRobot = (identifier) => {
    let index = -1;
    
    // 可以通过索引或ID查找
    if (typeof identifier === 'number') {
      index = identifier;
    } else if (typeof identifier === 'string') {
      index = robots.findIndex(r => r.id === identifier);
    }
    
    if (index >= 0 && index < robots.length) {
      robots.splice(index, 1);
      markersData.features = createFeatures(robots);
      
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData(markersData);
      }
      
      // 如果开启了标签显示，删除HTML标签
      if (showLabels) {
        // 查找对应的标签
        const labelItem = labelMarkers.find(item => item.robotIndex === index);
        
        if (labelItem && labelItem.element) {
          // 移除标签
          if (labelItem.element.parentNode) {
            labelItem.element.parentNode.removeChild(labelItem.element);
          }
          
          // 从数组移除
          const itemIndex = labelMarkers.indexOf(labelItem);
          if (itemIndex !== -1) {
            labelMarkers.splice(itemIndex, 1);
          }
        }
        
        // 更新剩余标签的索引引用
        labelMarkers.forEach(item => {
          if (item.robotIndex > index) {
            item.robotIndex--;
          }
        });
      }
      
      return true;
    }
    
    return false;
  };
  
  // 删除所有机器人
  const clearRobots = () => {
    robots = [];
    markersData.features = [];
    
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(markersData);
    }
    
    // 清除所有HTML标签
    clearLabels();
  };
  
  // 获取所有机器人
  const getRobots = () => {
    return [...robots];
  };
  
  // 显示/隐藏标签
  const toggleLabels = (show) => {
    // 确定新的显示状态
    const newShowLabels = show === undefined ? !showLabels : show;
    
    // 只有在状态发生变化时才执行操作
    if (newShowLabels !== showLabels) {
      if (newShowLabels) {
        // 从隐藏变为显示：创建标签
        if (labelMarkers.length === 0) {
          // 如果标签不存在，则创建新标签
          createLabelsForRobots();
        } else {
          // 如果标签已存在但被隐藏，只需更新其可见性
          labelMarkers.forEach(marker => {
            if (marker.element) {
              marker.element.style.display = 'block';
            }
          });
        }
      } else {
        // 从显示变为隐藏：隐藏标签而不移除它们
        labelMarkers.forEach(marker => {
          if (marker.element) {
            marker.element.style.display = 'none';
          }
        });
      }
      
      // 更新全局状态
      showLabels = newShowLabels;
    }
    
    return showLabels;
  };
  
  // 移除图层和数据源
  const remove = () => {
    if (map.getLayer(layerId)) {
      map.off('click', layerId);
      map.off('mouseenter', layerId);
      map.off('mouseleave', layerId);
      map.off('move', updateLabelsPosition);
      map.removeLayer(layerId);
    }
    
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
    
    // 清除HTML标签
    clearLabels();
    
    if (map.hasImage(iconId)) {
      map.removeImage(iconId);
    }
  };
  
  // 初始化机器人数据
  markersData.features = createFeatures(robots);
  
  // 初始化图层
  initializeLayer();
  
  // 返回控制器对象
  return {
    updateRobots,
    addRobot,
    updateRobot,
    removeRobot,
    clearRobots,
    getRobots,
    toggleLabels,
    remove
  };
}

/**
 * 添加机器人位置标记（同步版本，DOM Marker 实现）
 * @param {Object} map - 地图实例
 * @param {Array} robots - 机器人数组，每个机器人包含位置、旋转和标识信息 [{lngLat: [lng, lat], rotation: number, name: string, id: string}]
 * @param {Object} options - 配置选项
 * @param {string} options.svgPath - 标记SVG路径，默认为'/bicMap/assets/img/robo.png'
 * @param {number} options.size - 标记尺寸（CSS像素），默认为30px
 * @param {Function} options.onClick - 点击机器人标记的回调函数
 * @returns {Object} 包含机器人标记控制方法的对象
 */
export function addRobotMarkersSync(map, robots = [], options = {}) {
  const {
    svgPath = '/bicMap/assets/img/robo.png',
    size = 30,
    onClick = null
  } = options;

  let currentRobots = [...robots];
  const _markerPool = [];
  let _activeMarkers = [];
  let _displaySize = size; // 初始默认，图片加载后按异步版公式重算

  // 创建单个 Marker 的 DOM 元素
  const _createMarkerElement = () => {
    const container = document.createElement('div');
    container.className = 'bic-robot-dom-marker';
    container.style.width = `${_displaySize}px`;
    container.style.height = `${_displaySize}px`;

    if (onClick) {
      container.style.cursor = 'pointer';
    }

    const img = document.createElement('img');
    img.src = svgPath;
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.pointerEvents = 'none';
    img.onerror = function () {
      const s = _displaySize;
      const canvas = document.createElement('canvas');
      canvas.width = s;
      canvas.height = s;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0066FF';
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#BBD6FF';
      ctx.lineWidth = 2;
      ctx.stroke();
      this.src = canvas.toDataURL();
    };

    container.appendChild(img);
    return container;
  };

  // 从池中获取或创建 Marker，设置位置和旋转，绑定点击事件
  const _acquireMarker = (robot, index) => {
    let marker;
    let isNew = false;

    if (_markerPool.length > 0) {
      marker = _markerPool.pop();
      marker.addTo(map);
    } else {
      isNew = true;
      const el = _createMarkerElement();
      marker = new maplibregl.Marker({
        element: el,
        pitchAlignment: 'map',
        rotationAlignment: 'map'
      }).setLngLat(robot.lngLat).addTo(map);
    }

    // 更新位置
    marker.setLngLat(robot.lngLat);

    // 更新旋转角度
    const imgEl = marker.getElement().querySelector('img');
    if (imgEl) {
      imgEl.style.transform = `rotate(${robot.rotation || 0}deg)`;
    }

    // 存储点击数据到 DOM 元素上
    const clickData = {
      lngLat: robot.lngLat,
      rotation: robot.rotation,
      name: robot.name,
      id: robot.id || `robot-${index}`,
      index,
      originalRobot: robot
    };
    marker.getElement()._robotClickData = clickData;

    // 新创建的 Marker 绑定点击事件（后续通过 _robotClickData 读取最新数据）
    if (isNew && onClick) {
      marker.getElement().addEventListener('click', function (e) {
        e.stopPropagation();
        onClick(this._robotClickData);
      });
    }

    _activeMarkers.push({
      marker,
      robotIndex: index,
      robotId: robot.id
    });

    return marker;
  };

  // 释放 Marker 到空闲池
  const _releaseMarker = (marker) => {
    marker.remove();
    _markerPool.push(marker);
  };

  // 清空空闲池
  const _drainPool = () => {
    _markerPool.forEach(m => m.remove());
    _markerPool.length = 0;
  };

  // --- 控制器 API ---

  const updateRobots = (newRobots = []) => {
    // 先释放所有旧 Marker 到池中
    _activeMarkers.forEach(active => _releaseMarker(active.marker));
    _activeMarkers = [];

    // 更新数据
    currentRobots = [...newRobots];

    // 从池中复用或创建新 Marker（此时池中已有旧 Marker）
    currentRobots.forEach((robot, index) => {
      _acquireMarker(robot, index);
    });
  };

  const addRobot = (robot) => {
    const newIndex = currentRobots.length;
    currentRobots.push(robot);
    _acquireMarker(robot, newIndex);
    return newIndex;
  };

  const updateRobot = (identifier, robot) => {
    let index = -1;
    if (typeof identifier === 'number') {
      index = identifier;
    } else if (typeof identifier === 'string') {
      index = currentRobots.findIndex(r => r.id === identifier);
    }

    if (index >= 0 && index < currentRobots.length) {
      currentRobots[index] = { ...currentRobots[index], ...robot };

      const active = _activeMarkers.find(a => a.robotIndex === index);
      if (active) {
        active.marker.setLngLat(currentRobots[index].lngLat);
        const imgEl = active.marker.getElement().querySelector('img');
        if (imgEl) {
          imgEl.style.transform = `rotate(${currentRobots[index].rotation || 0}deg)`;
        }
        // 更新点击数据
        active.marker.getElement()._robotClickData = {
          lngLat: currentRobots[index].lngLat,
          rotation: currentRobots[index].rotation,
          name: currentRobots[index].name,
          id: currentRobots[index].id || `robot-${index}`,
          index,
          originalRobot: currentRobots[index]
        };
      }

      return true;
    }

    return false;
  };

  const removeRobot = (identifier) => {
    let index = -1;
    if (typeof identifier === 'number') {
      index = identifier;
    } else if (typeof identifier === 'string') {
      index = currentRobots.findIndex(r => r.id === identifier);
    }

    if (index >= 0 && index < currentRobots.length) {
      currentRobots.splice(index, 1);

      const activeIdx = _activeMarkers.findIndex(a => a.robotIndex === index);
      if (activeIdx !== -1) {
        const active = _activeMarkers[activeIdx];
        _releaseMarker(active.marker);
        _activeMarkers.splice(activeIdx, 1);
      }

      // 更新剩余活跃 Marker 的 robotIndex
      _activeMarkers.forEach(a => {
        if (a.robotIndex > index) {
          a.robotIndex--;
        }
      });

      return true;
    }

    return false;
  };

  const clearRobots = () => {
    currentRobots = [];
    _activeMarkers.forEach(active => _releaseMarker(active.marker));
    _activeMarkers = [];
  };

  const getRobots = () => [...currentRobots];

  const toggleLabels = () => true;

  const remove = () => {
    _activeMarkers.forEach(active => active.marker.remove());
    _activeMarkers = [];
    _drainPool();
  };

  // 预加载图片，按异步版 icon-size: size/48 公式计算实际 CSS 像素尺寸
  const preloadImage = () => {
    const tempImg = new Image();
    tempImg.onload = () => {
      // robo.png 实际 92×92，异步版 icon-size: size/48，等效 CSS 像素为 naturalWidth * size / 48
      _displaySize = Math.round(tempImg.naturalWidth * size / 48);
      // 图片加载完成后创建 Marker（此时已有正确尺寸）
      currentRobots.forEach((robot, index) => {
        _acquireMarker(robot, index);
      });
    };
    tempImg.onerror = () => {
      // 加载失败则使用默认 size，仍创建 Marker
      currentRobots.forEach((robot, index) => {
        _acquireMarker(robot, index);
      });
    };
    tempImg.src = svgPath;
  };
  preloadImage();

  // 返回控制器对象
  return {
    updateRobots,
    addRobot,
    updateRobot,
    removeRobot,
    clearRobots,
    getRobots,
    toggleLabels,
    remove
  };
}
