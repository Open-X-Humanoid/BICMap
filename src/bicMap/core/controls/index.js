/**
 * 添加自定义缩放控件，带有缩放级别显示
 * @param {Object} maplibregl - maplibregl实例
 * @param {Object} map - 地图实例
 * @param {string} position - 控件位置，默认为'bottom-right'
 */
export function addZoomControl(maplibregl, map, position = 'bottom-right') {
  if (!maplibregl || !map) {
    throw new Error('地图未初始化。');
  }

  // 创建自定义缩放控件类
  class ZoomControl {
    onAdd(map) {
      this._map = map;
      this._container = document.createElement('div');
      this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
      this._container.style.display = 'flex';
      this._container.style.flexDirection = 'column';
      
      // 放大按钮
      this._zoomInButton = document.createElement('button');
      this._zoomInButton.className = 'maplibregl-ctrl-zoom-in';
      this._zoomInButton.type = 'button';
      this._zoomInButton.innerHTML = '<span class="maplibregl-ctrl-icon" aria-hidden="true" title="放大"></span>';
      this._zoomInButton.onclick = () => {
        this._map.zoomIn();
      };
      
      // 缩小按钮
      this._zoomOutButton = document.createElement('button');
      this._zoomOutButton.className = 'maplibregl-ctrl-zoom-out';
      this._zoomOutButton.type = 'button';
      this._zoomOutButton.innerHTML = '<span class="maplibregl-ctrl-icon" aria-hidden="true" title="缩小"></span>';
      this._zoomOutButton.onclick = () => {
        this._map.zoomOut();
      };
      
      // 将元素添加到容器
      this._container.appendChild(this._zoomInButton);
      this._container.appendChild(this._zoomOutButton);
      
      return this._container;
    }
    
    onRemove() {
      this._container.parentNode.removeChild(this._container);
      this._map = undefined;
    }
  }
  
  map.addControl(new ZoomControl(), position);
} 