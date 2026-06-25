/**
 * 通用同步图标图层 - CustomLayer (3D)
 *
 * 使用 renderingMode: '3d' + 投影矩阵，图标位置跟随 pitch/zoom/bearing。
 * iconSize 为 CSS 像素（屏幕像素），每帧根据当前 zoom 换算 Mercator 大小，
 * 实现 3D 空间定位 + 固定屏幕像素大小（类 billboard 效果）。
 *
 * 用法:
 *   const layer = new SyncIconLayer({
 *     id: 'my-layer',
 *     iconImage: imageData,       // ImageData | HTMLImageElement | HTMLCanvasElement
 *     iconSize: 30,               // CSS像素（屏幕像素），默认30
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
    this.renderingMode = '3d';

    this._iconImage = options.iconImage || null;
    this._iconSize = options.iconSize || 30; // CSS像素（屏幕像素）
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

    // 3D 坐标系相关
    this._map = null;

    // uniform 位置缓存
    this._uMatrix = null;
    this._uWorldPos = null;
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
    this._map = map;
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

  render(gl, matrixOrArgs) {
    if (!this._initialized) return;
    if (this._features.length === 0) return;

    const map = this._map;
    const features = this._features;
    const texture = this._texture;
    const program = this._program;

    if (!texture) return;
    if (!program) return;

    // 解析投影矩阵
    let mainMatrix = null;
    if (matrixOrArgs && (Array.isArray(matrixOrArgs) || ArrayBuffer.isView(matrixOrArgs))) {
      mainMatrix = matrixOrArgs;
    } else if (matrixOrArgs && typeof matrixOrArgs === 'object') {
      const dpd = matrixOrArgs.defaultProjectionData;
      if (dpd?.mainMatrix && dpd.mainMatrix.length === 16) {
        mainMatrix = dpd.mainMatrix;
      } else if (matrixOrArgs.projectionMatrix?.length === 16) {
        mainMatrix = matrixOrArgs.projectionMatrix;
      } else if (matrixOrArgs.modelViewProjectionMatrix?.length === 16) {
        mainMatrix = matrixOrArgs.modelViewProjectionMatrix;
      }
    }
    if (!mainMatrix || mainMatrix.length !== 16) return;

    // WebGL gl.uniformMatrix4fv 只接受 Float32Array
    if (mainMatrix instanceof Float64Array) {
      mainMatrix = new Float32Array(mainMatrix);
    }

    gl.useProgram(program);

    // 绑定纹理
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this._uTexture, 0);

    // 用 map.project() 将经纬度转屏幕像素，再转 clip space
    const canvasW = map.getCanvas().width;
    const canvasH = map.getCanvas().height;
    const clipSize = this._iconSize / canvasW * 2;
    gl.uniform1f(this._uClipSize, clipSize);

    // 确保深度测试不遮挡图标
    gl.depthFunc(gl.ALWAYS);

    // 绑定 VAO
    if (this._vao) {
      gl.bindVertexArray(this._vao);
    }

    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      if (!feat || !feat.geometry || !feat.geometry.coordinates) continue;

      const coords = feat.geometry.coordinates;

      // map.project() → CSS 像素 → clip space
      const screenPos = map.project(coords);
      const clipX = (screenPos.x / canvasW) * 2 - 1;
      const clipY = -(screenPos.y / canvasH) * 2 + 1;
      gl.uniform2f(this._uClipPos, clipX, clipY);

      // 旋转
      let rotation = 0;
      if (feat.properties && feat.properties.rotation) {
        rotation = parseFloat(feat.properties.rotation) || 0;
      }
      gl.uniform1f(this._uRotation, rotation * Math.PI / 180);

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
    if (!this._map || this._features.length === 0) return [];
    const hitRadius = radius != null ? radius : 20; // 默认 20 CSS 像素
    const results = [];
    for (const feat of this._features) {
      if (!feat.geometry || !feat.geometry.coordinates) continue;
      const pos = this._map.project(feat.geometry.coordinates);
      const dx = point.x - pos.x;
      const dy = point.y - pos.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        results.push(feat);
      }
    }
    return results;
  }

  // ==================== 内部方法 ====================

  /** 经纬度 → Mercator 坐标 */
  _lngLatToMercator(lngLat) {
    const maplibregl = window.maplibregl;
    if (!maplibregl || !maplibregl.MercatorCoordinate) {
      return { x: 0, y: 0, z: 0 };
    }
    return maplibregl.MercatorCoordinate.fromLngLat(
      { lng: lngLat[0], lat: lngLat[1] }, 0
    );
  }

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
      uniform vec2 u_clipPos;
      uniform float u_clipSize;
      uniform float u_rotation;
      varying vec2 v_uv;
      void main() {
        float ca = cos(u_rotation);
        float sa = sin(u_rotation);
        vec2 r = vec2(
          a_pos.x * ca - a_pos.y * sa,
          a_pos.x * sa + a_pos.y * ca
        );
        gl_Position = vec4(u_clipPos + r * u_clipSize, 0.0, 1.0);
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
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('[SyncIconLayer] VS compile error:', gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('[SyncIconLayer] FS compile error:', gl.getShaderInfoLog(fs));
    }

    this._program = gl.createProgram();
    gl.attachShader(this._program, vs);
    gl.attachShader(this._program, fs);
    gl.linkProgram(this._program);
    if (!gl.getProgramParameter(this._program, gl.LINK_STATUS)) {
      console.error('[SyncIconLayer] program link error:', gl.getProgramInfoLog(this._program));
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // 缓存 uniform 位置
    this._uMatrix = gl.getUniformLocation(this._program, 'u_matrix');
    this._uWorldPos = gl.getUniformLocation(this._program, 'u_worldPos');
    this._uRotation = gl.getUniformLocation(this._program, 'u_rotation');
    this._uSize = gl.getUniformLocation(this._program, 'u_size');
    this._uTexture = gl.getUniformLocation(this._program, 'u_texture');
    this._uClipPos = gl.getUniformLocation(this._program, 'u_clipPos');
    this._uClipSize = gl.getUniformLocation(this._program, 'u_clipSize');
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
