/**
 * 通用同步图标图层 - CustomLayer
 *
 * 绕过 MapLibre GeoJSON worker 管线，在主线程中同步绘制图标点位。
 * setData() 仅替换内部数组，render() 直接读取，无异步延迟。
 *
 * 用法:
 *   const layer = new SyncIconLayer({
 *     id: 'my-layer',
 *     iconImage: imageData,       // ImageData | HTMLImageElement | HTMLCanvasElement
 *     iconSize: 30,               // 像素
 *     iconRotationAlignment: 'map', // 'map' | 'viewport'
 *     onClick: (feature, point) => {}
 *   });
 *   map.addLayer(layer);
 *   layer.setData(features);      // 同步！
 *   layer.updateFeature(id, feat); // 同步！
 *   layer.removeFeature(id);      // 同步！
 *
 * features 格式（仿 GeoJSON Feature）:
 *   [{ type: 'Feature', id: '...', geometry: { type: 'Point', coordinates: [lng, lat] },
 *      properties: { rotation: 45, ... }}]
 */
export default class SyncIconLayer {
  constructor(options = {}) {
    if (!options.id) throw new Error('SyncIconLayer: id is required');

    this.id = options.id;
    this.type = 'custom';
    this.renderingMode = '2d';

    this._iconImage = options.iconImage || null;
    this._iconSize = options.iconSize || 30;
    this._rotationAlignment = options.iconRotationAlignment || 'map';
    this._onClick = typeof options.onClick === 'function' ? options.onClick : null;

    // 内部同步数据
    this._features = [];
    this._featureMap = new Map(); // id -> index

    // 内部状态
    this._initialized = false;
    this._texture = null;
    this._program = null;
    this._vao = null;
    this._buffer = null;

    // uniform 位置缓存
    this._uResolution = null;
    this._uCenter = null;
    this._uRotation = null;
    this._uSize = null;
    this._uTexture = null;

    // 点击检测用
    this._clickHandler = null;
    this._mouseEnterHandler = null;
    this._mouseLeaveHandler = null;
  }

  // ==================== MapLibre CustomLayer 接口 ====================

  onAdd(map, gl) {
    this.map = map;
    this.gl = gl;

    // 兼容旧版 maplibre-gl（v3.x 用 painter 获取 GL 上下文）
    if (!gl && map.painter) {
      gl = map.painter.context.gl;
      this.gl = gl;
    }

    this._compileShaders(gl);
    this._createBuffers(gl);
    this._createTexture(gl);
    this._setupClickHandlers(map);

    this._initialized = true;
  }

  render(gl, matrix) {
    if (!this._initialized || this._features.length === 0) return;

    const map = this.map;
    const features = this._features;
    const size = this._iconSize;
    const texture = this._texture;
    const program = this._program;
    const dpr = window.devicePixelRatio || 1;

    if (!texture || !program) return;

    gl.useProgram(program);

    // 绑定纹理
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this._uTexture, 0);

    // 分辨率（CSS 像素）
    const w = map.transform.width;
    const h = map.transform.height;
    gl.uniform2f(this._uResolution, w, h);

    // 绑定 VAO
    if (this._vao) {
      gl.bindVertexArray(this._vao);
    }

    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      if (!feat || !feat.geometry || !feat.geometry.coordinates) continue;

      const coords = feat.geometry.coordinates;
      const screenPos = map.project(coords);

      // 视口裁剪：在屏幕外则跳过
      if (screenPos.x < -size || screenPos.x > w + size ||
          screenPos.y < -size || screenPos.y > h + size) {
        continue;
      }

      // 旋转角度
      let rotation = 0;
      if (feat.properties && feat.properties.rotation) {
        rotation = parseFloat(feat.properties.rotation) || 0;
      }
      const rad = rotation * Math.PI / 180;

      // 'map' 对齐：用 map.project() 投影偏移点计算屏幕角度。
      // map.project() 已自动包含 bearing 和 pitch 影响，偏移方向直接用原始角度（无需减 bearing）。
      let screenRotation;
      if (this._rotationAlignment === 'map') {
        const offset = 0.0001;
        const lng = coords[0];
        const lat = coords[1];
        const dx = Math.sin(rad) * offset;
        const dy = Math.cos(rad) * offset;
        // 经度偏移除以 cos(lat) 以补偿纬圈收敛
        const lngOffset = lng + dx / Math.cos(lat * Math.PI / 180);
        const latOffset = lat + dy;
        const pOffset = map.project([lngOffset, latOffset]);
        screenRotation = Math.atan2(
          pOffset.x - screenPos.x,
          -(pOffset.y - screenPos.y)
        );
      } else {
        screenRotation = rad;
      }

      gl.uniform2f(this._uCenter, screenPos.x, screenPos.y);
      gl.uniform1f(this._uRotation, screenRotation);
      gl.uniform1f(this._uSize, size * dpr);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (this._vao) {
      gl.bindVertexArray(null);
    }
  }

  onRemove(map, gl) {
    this._cleanupClickHandlers(map);
    this._cleanupGL(gl);
    this._initialized = false;
  }

  // ==================== 同步数据接口 ====================

  /** 全量替换（同步） */
  setData(features = []) {
    this._features = features;
    this._rebuildFeatureMap();
  }

  /** 更新或添加单个 feature（同步） */
  updateFeature(id, feature) {
    if (id == null) return;
    const idStr = String(id);
    if (this._featureMap.has(idStr)) {
      this._features[this._featureMap.get(idStr)] = feature;
    } else {
      this._featureMap.set(idStr, this._features.length);
      this._features.push(feature);
    }
  }

  /** 删除 feature（同步） */
  removeFeature(id) {
    if (id == null) return;
    const idStr = String(id);
    if (!this._featureMap.has(idStr)) return;
    const idx = this._featureMap.get(idStr);
    this._features.splice(idx, 1);
    this._rebuildFeatureMap();
  }

  /** 清空（同步） */
  clearFeatures() {
    this._features = [];
    this._featureMap.clear();
  }

  /** 获取当前 features */
  getFeatures() {
    return this._features;
  }

  /** 点击检测，返回匹配的 feature 数组 */
  queryRenderedFeatures(point, radius) {
    if (!this.map || this._features.length === 0) return [];
    const hitRadius = radius != null ? radius : this._iconSize;
    const results = [];
    for (const feat of this._features) {
      if (!feat.geometry || !feat.geometry.coordinates) continue;
      const pos = this.map.project(feat.geometry.coordinates);
      const dx = point.x - pos.x;
      const dy = point.y - pos.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        results.push(feat);
      }
    }
    return results;
  }

  // ==================== 内部方法 ====================

  _rebuildFeatureMap() {
    this._featureMap.clear();
    for (let i = 0; i < this._features.length; i++) {
      const feat = this._features[i];
      const fid = feat.id != null ? String(feat.id) :
                  (feat.properties && feat.properties.id != null ? String(feat.properties.id) : null);
      if (fid != null) {
        this._featureMap.set(fid, i);
      }
    }
  }

  _compileShaders(gl) {
    const vsSource = `
      attribute vec2 a_pos;
      attribute vec2 a_uv;
      uniform vec2 u_resolution;
      uniform vec2 u_center;
      uniform float u_rotation;
      uniform float u_size;
      varying vec2 v_uv;
      void main() {
        float ca = cos(u_rotation);
        float sa = sin(u_rotation);
        vec2 r = vec2(
          a_pos.x * ca - a_pos.y * sa,
          a_pos.x * sa + a_pos.y * ca
        );
        vec2 p = u_center + r * u_size;
        vec2 c = (p / u_resolution) * 2.0 - 1.0;
        c.y *= -1.0;
        gl_Position = vec4(c, 0.0, 1.0);
        v_uv = a_uv;
      }
    `;
    const fsSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      varying vec2 v_uv;
      void main() {
        vec4 color = texture2D(u_texture, v_uv);
        if (color.a < 0.01) discard;
        gl_FragColor = color;
      }
    `;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    this._program = gl.createProgram();
    gl.attachShader(this._program, vs);
    gl.attachShader(this._program, fs);
    gl.linkProgram(this._program);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // 缓存 uniform 位置
    this._uResolution = gl.getUniformLocation(this._program, 'u_resolution');
    this._uCenter = gl.getUniformLocation(this._program, 'u_center');
    this._uRotation = gl.getUniformLocation(this._program, 'u_rotation');
    this._uSize = gl.getUniformLocation(this._program, 'u_size');
    this._uTexture = gl.getUniformLocation(this._program, 'u_texture');
  }

  _createBuffers(gl) {
    // 6 个顶点（2 个三角形组成 quad），每个顶点 4 个 float（x, y, u, v）
    const vertices = new Float32Array([
      -0.5, -0.5,  0, 1,
       0.5, -0.5,  1, 1,
      -0.5,  0.5,  0, 0,
       0.5, -0.5,  1, 1,
       0.5,  0.5,  1, 0,
      -0.5,  0.5,  0, 0,
    ]);

    this._buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // VAO
    const ext = gl.getExtension('OES_vertex_array_object');
    if (ext) {
      this._vao = ext.createVertexArrayOES();
      ext.bindVertexArrayOES(this._vao);
    }

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    const aPos = gl.getAttribLocation(this._program, 'a_pos');
    const aUv = gl.getAttribLocation(this._program, 'a_uv');

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);

    if (ext) {
      ext.bindVertexArrayOES(null);
    }
  }

  _createTexture(gl) {
    if (!this._iconImage) return;

    // 对 HTMLImageElement，需要等 onload 后 texImage2D
    if (this._iconImage instanceof HTMLImageElement) {
      if (this._iconImage.complete && this._iconImage.naturalWidth > 0) {
        this._doCreateTexture(gl, this._iconImage);
      } else {
        this._iconImage.onload = () => {
          if (this.gl) this._doCreateTexture(gl, this._iconImage);
        };
      }
    } else {
      this._doCreateTexture(gl, this._iconImage);
    }
  }

  _doCreateTexture(gl, img) {
    this._texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    // 非 POT 纹理需要 CLAMP_TO_EDGE + LINEAR
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  _setupClickHandlers(map) {
    // 点击检测
    this._clickHandler = (e) => {
      if (!this._onClick) return;
      const features = this.queryRenderedFeatures(e.point);
      if (features.length > 0) {
        e.originalEvent.stopPropagation();
        this._onClick(features[0], e.point);
      }
    };

    this._mouseEnterHandler = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    this._mouseLeaveHandler = () => {
      map.getCanvas().style.cursor = '';
    };

    // 用 map.on('click') 模拟 layer click，手动做 hitTest
    map.on('click', this._clickHandler);

    // 悬停 cursor 用 canvas 的 mousemove 做近似
    map.getCanvas().addEventListener('mouseenter', this._mouseEnterHandler);
    map.getCanvas().addEventListener('mouseleave', this._mouseLeaveHandler);
  }

  _cleanupClickHandlers(map) {
    if (this._clickHandler) {
      map.off('click', this._clickHandler);
      this._clickHandler = null;
    }
    if (this._mouseEnterHandler) {
      const canvas = map.getCanvas();
      canvas.removeEventListener('mouseenter', this._mouseEnterHandler);
      canvas.removeEventListener('mouseleave', this._mouseLeaveHandler);
      this._mouseEnterHandler = null;
      this._mouseLeaveHandler = null;
    }
  }

  _cleanupGL(gl) {
    if (this._program) { gl.deleteProgram(this._program); this._program = null; }
    if (this._buffer) { gl.deleteBuffer(this._buffer); this._buffer = null; }
    if (this._vao) {
      const ext = this.gl.getExtension('OES_vertex_array_object');
      if (ext) ext.deleteVertexArrayOES(this._vao);
      this._vao = null;
    }
    if (this._texture) { gl.deleteTexture(this._texture); this._texture = null; }
  }
}
