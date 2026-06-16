import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
const  mouseControl = {
  isDragging: false,
  lastX: 0,
  lastY: 0,
  sensitivity: 0.01
};
const cameraControl =  {
  azimuth: 0, // 水平角度（弧度）
  elevation: 0, // 垂直角度（弧度）
  rotationSpeed: 0.02, // 旋转速度（弧度/帧）
  distance: 1, // 相机距离（笛卡尔坐标系）
  minDistance: 2, // 最小距离（笛卡尔坐标系）
  maxDistance: 15, // 最大距离（笛卡尔坐标系）
  zoomSpeed: 0.1, // 缩放速度（笛卡尔坐标系）
  rotateSpeed: 0.02, // 旋转速度（弧度/帧）
}
 class URDFPlugin { 
   constructor(container, sceneOptions, cameraOptions, controlsOptions  = {mouseControl,cameraControl,controlsFlag:false}, opacity=1 ) {
    if (!container) throw new Error('容器必填');
    this.container = container;
    this.MathUtils = THREE.MathUtils;
    this.controlsOptions = Object.assign(
      { mouseControl, cameraControl },
      controlsOptions
    );
    this.renderer = null;
    this.scene = null;
    this.robot = null;
    this.joints = {};
    this.links = {};
    this.animateId = null;
    this.opacity = opacity;
    this.lookAtRobot = false;
    this.robotCenterXYZ = new THREE.Vector3();
    this.resetLinksColor = {}
    this.createThreejsCondition(sceneOptions, cameraOptions);
  }
/**
 * 创建Three.js渲染环境
 * 
 * @param {Object} sceneOptions - 场景配置选项
 * @param {number} [sceneOptions.backgroundColor] - 场景背景色，默认为0x263238
 * @param {Object} [cameraOptions] - 相机配置选项
 * @param {number} [cameraOptions.fov] - 相机视野角度
 * @param {number} [cameraOptions.near] - 相机近裁剪面
 * @param {number} [cameraOptions.far] - 相机远裁剪面
 * @param {number} [cameraOptions.aspect] - 相机宽高比
 * @param {boolean} controlsFlag - 是否启用轨道控制器
  */
  createThreejsCondition(sceneOptions, cameraOptions, controlsFlag) {
    this.scene = new THREE.Scene();
    if(sceneOptions) {
      this.scene.background = new THREE.Color(sceneOptions.backgroundColor);
    }
    this.camera = new THREE.PerspectiveCamera(20, this.container.clientWidth/this.container.clientHeight, 0.1, 1000);

    
    if (cameraOptions) {
      this.setCamera(cameraOptions.fov, cameraOptions.near, cameraOptions.far, cameraOptions.aspect);
    }
    if (cameraOptions?.position) {
      this.setCameraPosition(cameraOptions.position.x, cameraOptions.position.y, cameraOptions.position.z)
      const { elevation, azimuth, distance  }= this.worldToSpherical(cameraOptions.position.x, cameraOptions.position.y, cameraOptions.position.z);
      this.controlsOptions.cameraControl.elevation = elevation;
      this.controlsOptions.cameraControl.azimuth = azimuth;
      this.controlsOptions.cameraControl.distance = distance;
    } else {
      this.camera.position.set(0, 2, 10);
      this.camera.lookAt(0, 0, 0);
    }
    //关闭抗锯齿 优先使用高性能gpu 背景透明
    this.renderer = new THREE.WebGLRenderer({ alpha:true,antialias: true,powerPreference:'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);  
    this.startRender();
  }

  // 异步加载URDF模型文件
  async urdfLoad(url) {
    // 检查URL参数是否有效
    if (!url) throw new Error('文件路径必填');
    
    return new Promise((resolve, reject) => {
      // 创建加载管理器
      const manager = new THREE.LoadingManager();
      // 创建URDF加载器
      const loader = new URDFLoader(manager);
      
      // 加载URDF文件
      loader.load(url, result => {
        this.robot = result;
      }, undefined, err => {
        reject(new Error(`加载失败: ${err}`));
      });
      
      // 所有资源加载完成时的回调
      manager.onLoad = () => {
        // 遍历模型设置阴影投射
        const positions = [];
        this.robot.traverse(c => {
          c.castShadow = true;
          if (c.isMesh && this.opacity != 1) {
            c.material.wireframe = true;   // 瞬间变网格
            c.material.color.set(0xfffffff); // 线框颜色
            c.material.transparent = true;
            c.material.opacity = this.opacity;
            // c.material = new THREE.MeshStandardMaterial({
            //   color: 0xff0000,
            //   metalness: 0.4,
            //   roughness: 0.5,
            //   transparent: true,
            //   opacity: 0.25,          // ← 全身半透明
            //   depthWrite: false,      // 避免透明排序错误
            // });
          }
        });
        // 更新模型的世界矩阵
        this.robot.updateMatrixWorld(true);
        
        // 计算模型包围盒并调整位置
        const box3 = new THREE.Box3();
        box3.setFromObject(this.robot);
        this.robot.position.y += box3.min.y;
        // 将模型添加到场景
        this.scene.add(this.robot);
        // 保存关节信息
        this.joints = this.robot.joints;
        this.links = this.robot.links;
        resolve({ robot: this.robot, joints: this.robot.joints,links: this.robot.links });
      };
      
      // 加载错误处理
      manager.onError = err => {
        reject(new Error(`加载失败: ${err}`));
      };
    });
  }
  // 加载gltf模型 

  async gltfLoad(url) {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        // 将模型添加到场景
        this.scene.add(gltf.scene);
        resolve({ gltf: gltf.scene });
      }, undefined, err => {
        reject(new Error(`加载失败: ${err}`));
      });
    });
  }
  /**
   * 启动渲染循环
   * 
   * 使用requestAnimationFrame创建动画循环，持续渲染场景和相机视图。
   * 将动画ID存储在this.animateId中以便后续取消。
   */
  startRender() {
    const render = () => {
      this.renderer.render(this.scene, this.camera);
      this.animateId = requestAnimationFrame(render);
    };
    if(this.controls) {
      this.controls.update();
    }
    this.animateId = requestAnimationFrame(render);
  }

  /**
   * 停止当前渲染循环
   * 
   * 该方法会取消通过requestAnimationFrame设置的动画帧回调，
   * 并将animateId重置为null
   */
  stopRender() {
    if (this.animateId) {
      cancelAnimationFrame(this.animateId);
      this.animateId = null;
    }
  }

  destroy() {
    this.stopRender();
    this.scene = null;
    this.robot = null;
    this.joints = {};
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
  }

  /* 2. 关节角度驱动（弧度） */
  setJoint(name, value) {
    const joint = this.joints[name];
    if (!joint) {
      console.warn(`[URDFPlugin] 找不到关节 ${name}`);
      return;
    }
    joint.setJointValue(value);
  }

  /* 3. 批量设置，支持对象 {jointName:value} */
  setJoints(map) {
    Object.keys(map).forEach(k => this.setJoint(k, map[k]));
  }
  /* 4. 重置所有关节角度 */
  resetJoints() {
    Object.keys(this.joints).forEach(k => this.setJoint(k, 0));
  }
  /** 7.调整相机位置 */
  setCameraPosition(x, y, z) {
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.lookAtRobot ? this.robotCenterXYZ : new THREE.Vector3());
  }
  /** 8. 调整相机旋转角度 */
  setCameraRotation(x, y, z) {
    this.camera.rotation.set(x, y, z);
    this.camera.lookAt(this.lookAtRobot ? this.robotCenterXYZ : new THREE.Vector3());
  }
  /** 9. 调整相机视角 */
  setCamera(fov =20, near = 0.1, far = 1000, aspect = this.container.clientWidth/this.container.clientHeight) {
    this.camera.fov = fov;
    this.camera.near = near;
    this.camera.far = far;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
  /** 11. 窗口大小改变 */
  onResize() {
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio)
      this.camera.aspect =  this.container.clientWidth/ this.container.clientHeight;
      this.camera.updateProjectionMatrix();
  }
  /** 12.添加直射光 */
  addDirectionalLight(color = 0xffffff, intensity = 2, x = 5,y = 30,z = 5) {
      const light = new THREE.DirectionalLight(color, intensity);
      light.shadow.mapSize.setScalar(1024);
      light.position.set(5, 30, 5);
      light.castShadow = true;
      this.scene.add(light);
  }
  /** 13.添加环境光 */
  addAmbientLight(color = 0xffffff, intensity = 0.2) {
      const light = new THREE.AmbientLight(color, intensity);
      this.scene.add(light);
  }
  /**14 添加辅助网格 */
  addGridHelper(size = 20, divisions = 40, color1 = 0x9D9D9D, color2 = 0x9D9D9D) {
      const helper = new THREE.GridHelper(size, divisions, color1, color2);
      helper.material.opacity = 0.25;
      helper.material.transparent = true;
      this.scene.add(helper);
  }
  /** 创建接收阴影地面 */
  addGround(color = 0x9D9D9D, size = 40) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.8,
          metalness: 0.2,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.01; // 稍微降低以避免与网格重叠
    this.scene.add(ground);
  } 
  /** 15.添加辅助xyz */
  addAxesHelper(size = 10) {
    const L = size;                 // 半轴长
    const origin = new THREE.Vector3(0, 0, 0);
    
    [
      { dir: [ 1, 0, 0], color: 0xe93652 },
      { dir: [-1, 0, 0], color: 0xe93652 },
      { dir: [ 0, 1, 0], color: 0x0066ff },
      { dir: [ 0,-1, 0], color: 0x0066ff },
      { dir: [ 0, 0, 1], color: 0x82cc12 },
      { dir: [ 0, 0,-1], color: 0x82cc12 },
    ].forEach(({dir, color}) => {
      const d = new THREE.Vector3(...dir).normalize();
      const arrow = new THREE.ArrowHelper(d, origin, L, color, 0, 0);
      this.scene.add(arrow);
    });
      // const helper = new THREE.AxesHelper(size);
      // this.scene.add(helper);
  }
  /** 16.添加点光源 */
  addPointLight(color = 0xffffff, intensity = 1, x = 0, y = 10, z = 0) {
      const light = new THREE.PointLight(color, intensity);
      // light.position.set(x, y, z);
      this.scene.add(light);
  }
  /* --- 根据想要的初始世界坐标算出球坐标          azimuth: 0, // 水平角度（弧度）
            elevation: 0, // 垂直角度（弧度）--- */
  worldToSpherical(x, y, z) {
    const offset = new THREE.Vector3(x, y, z).sub(this.lookAtRobot ? this.robot.position : new THREE.Vector3());
    return {
      azimuth : Math.atan2(offset.z, offset.x),
      elevation: Math.asin(offset.y / offset.length()),
      distance : offset.length()
    };
  }
  /* --- 根据球坐标算出世界坐标 */
  sphericalToWorld(azimuth, elevation, distance) {
    const offset = new THREE.Vector3();
    offset.x = Math.cos(elevation) * Math.sin(azimuth);
    offset.y = Math.sin(elevation);
    offset.z = Math.cos(elevation) * Math.cos(azimuth);
    return offset.multiplyScalar(distance).add(new THREE.Vector3(0, 0, 0));
  }
  /* --- 相机控制器 */
  updateCameraControl = (azimuth=this.controlsOptions.cameraControl.azimuth ,elevation=this.controlsOptions.cameraControl.elevation, distance=this.controlsOptions.cameraControl.distance) => {
      // 限制垂直角度在-89到89度之间，避免万向节锁
      elevation = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, elevation));
      
      // 计算相机位置（球坐标系转笛卡尔坐标系）
      const x = distance * Math.cos(elevation) * Math.cos(azimuth);
      const y = distance * Math.sin(elevation);
      const z = distance * Math.cos(elevation) * Math.sin(azimuth);
      this.setCameraPosition(x, y, z);
  }
  /* --- 设置关节材质颜色 */
  /**
   * 设置URDF模型中指定链接的颜色
   * 
   * @param {string} link - 要设置颜色的链接名称
   * @param {THREE.Color} color - 要设置的颜色值
   */
  setLinkMaterialColor(link, color) {
    this.links[link].traverse((child) => {
      if (child.isMesh) {
        this.resetLinksColor[child]?'':this.resetLinksColor[child] = child.material.color.clone()
        child.material.color.set(color);
      }
    });
  }
  /* --- 重置关节材质颜色 */
  resetLinkMaterialColor(link) {
    this.links[link].traverse((child) => {
      if (child.isMesh && this.resetLinksColor[child]) {
        child.material.color.set(this.resetLinksColor[child])
      }
    });
  }
  /* --- 设置镜头朝向机器人 */
  setLookAtRobot(flag) {
    this.lookAtRobot = flag;
    if(flag) {
      const box3 = new THREE.Box3();
      box3.setFromObject(this.robot);
      this.robotCenterXYZ  = box3.getCenter(new THREE.Vector3());
      this.camera.lookAt(this.robotCenterXYZ );
    } else {
      this.camera.lookAt(new THREE.Vector3());
    }
  }
  /**鼠标操作视角 */
   moveMouseCamera = () => {
    // 鼠标事件监听
    this.renderer.domElement.addEventListener('mousedown', (event) => {
        this.controlsOptions.mouseControl.isDragging = true;
        this.controlsOptions.mouseControl.lastX = event.clientX;
        this.controlsOptions.mouseControl.lastY = event.clientY;
        this.renderer.domElement.style.cursor = 'grabbing';
    });
    
    this.renderer.domElement.addEventListener('mousemove', (event) => {
        if (this.controlsOptions.mouseControl.isDragging) {
            const deltaX = event.clientX - this.controlsOptions.mouseControl.lastX;
            const deltaY = event.clientY - this.controlsOptions.mouseControl.lastY;
            
            this.controlsOptions.cameraControl.azimuth += deltaX * this.controlsOptions.mouseControl.sensitivity;
            this.controlsOptions.cameraControl.elevation += deltaY * this.controlsOptions.mouseControl.sensitivity;
            
            this.controlsOptions.mouseControl.lastX = event.clientX;
            this.controlsOptions.mouseControl.lastY = event.clientY;
            this.updateCameraControl();
        }
    });
    
    this.renderer.domElement.addEventListener('mouseup', () => {
        this.controlsOptions.mouseControl.isDragging = false;
        this.renderer.domElement.style.cursor = 'grab';
    });
    
    this.renderer.domElement.addEventListener('mouseleave', () => {
        this.controlsOptions.mouseControl.isDragging = false;
        this.renderer.domElement.style.cursor = 'default';
    });
    
    // 设置初始鼠标样式
    this.renderer.domElement.style.cursor = 'grab';
  }
  /**加垂直弧度 */
  addElevation = () => {
    this.controlsOptions.cameraControl.elevation += this.controlsOptions.cameraControl.rotationSpeed;
  }
  /**减垂直弧度 */
  subElevation = () => {
    this.controlsOptions.cameraControl.elevation -= this.controlsOptions.cameraControl.rotationSpeed;
  }
  /**加水平弧度 */
  addAzimuth = () => {
    this.controlsOptions.cameraControl.azimuth += this.controlsOptions.cameraControl.rotationSpeed;
  }
  /**减水平弧度 */
  subAzimuth = () => {
    this.controlsOptions.cameraControl.azimuth -= this.controlsOptions.cameraControl.rotationSpeed;
  }
  /**加距离 */
  addDistance = () => {
    this.controlsOptions.cameraControl.distance = Math.max(this.controlsOptions.cameraControl.minDistance, this.controlsOptions.cameraControl.distance - this.controlsOptions.cameraControl.zoomSpeed);
  }
  /**减距离 */
  subDistance = () => {
    this.controlsOptions.cameraControl.distance = Math.min(this.controlsOptions.cameraControl.maxDistance, this.controlsOptions.cameraControl.distance + this.controlsOptions.cameraControl.zoomSpeed);
  }
  /**旋转四元数，修正坐标系差异 */
  quaternionFix = (x,y,z,w) => {
    const quat = new THREE.Quaternion(x,y,z,w);
    // Adjust for coordinate system difference
    const adjustQuat = new THREE.Quaternion();
    adjustQuat.setFromEuler(new THREE.Euler(Math.PI / 2 + Math.PI, 0, 0));
    quat.premultiply(adjustQuat);
    this.robot.quaternion.copy(quat);
  }
  /**设置相机水平 */
  setCameraEuler = () => {
    const e = new THREE.Euler(0, this.camera.rotation.y, 0, 'YXZ');
    this.camera.rotation.copy(e);
  }
  /**平移视角前进 */
  moveForward = () => {
     // 获取相机的方向向量
     const direction = new THREE.Vector3();
     this.camera.getWorldDirection(direction);
     this.camera.position.addScaledVector(direction, -this.controlsOptions.cameraControl.zoomSpeed);
  }
  /**平移视角后退 */
  moveBackward = () => {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    this.camera.position.addScaledVector(direction, this.controlsOptions.cameraControl.zoomSpeed);
  }
  /**平移视角向左 */
  moveLeft = () => {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    const right = new THREE.Vector3();
    right.crossVectors(this.camera.up, direction).normalize();
    this.camera.position.addScaledVector(right, this.controlsOptions.cameraControl.zoomSpeed);
  }
  /**平移视角向右 */
  moveRight = () => {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    const right = new THREE.Vector3();
    right.crossVectors(this.camera.up, direction).normalize();
    this.camera.position.addScaledVector(right, -this.controlsOptions.cameraControl.zoomSpeed);
  }
  /**平移视角左转 */
  turnLeft = () => {
    const angle = this.controlsOptions.cameraControl.rotationSpeed;
  // 绕世界 Y 轴转
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      angle
    );
    this.camera.quaternion.premultiply(q);
  }
  /**平移视角右转 */
  turnRight = () => {
    const angle = -this.controlsOptions.cameraControl.rotationSpeed;
    // 绕世界 Y 轴转
      const q = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        angle
      );
      this.camera.quaternion.premultiply(q);
  }
}
export default URDFPlugin;