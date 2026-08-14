<p align="right">
  <a href="./README.en.md">English</a> | 中文
</p>

<p align="right">
  <a href="https://www.npmjs.com/package/@x-humanoid-cloud/bic-map">
    <img src="https://img.shields.io/badge/version-0.0.1-1d81f5.svg?style=flat-square" alt="version" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="license" />
  </a>
  <a href="https://vuejs.org">
    <img src="https://img.shields.io/badge/Vue-3.x-42b883.svg?style=flat-square" alt="vue" />
  </a>
  <a href="https://maplibre.org">
    <img src="https://img.shields.io/badge/MapLibre%20GL-3.6-2d4ea0.svg?style=flat-square" alt="maplibre" />
  </a>
</p>

<h1 align="center">BicMap | <a href="https://bicmap.x-humanoid-cloud.com/">在线文档</a></h1>

<h5 align="center">室内外一体化的 GPU 地图渲染与交互解决方案 · 面向机器人场景</h5>

[![BicMap 示例门户](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/scene_robotGuideTour.png)](https://bicmap.x-humanoid-cloud.com/)

BicMap（`@x-humanoid-cloud/bic-map`）是一套基于 WebGL 的地图渲染库，在 [MapLibre GL](https://maplibre.org) + [Three.js](https://threejs.org) + [Turf](https://turfjs.org) 之上做了面向机器人业务的二次封装，提供 **室内 SLAM 地图、室外瓦片/高精地图、点云、3D 模型、POI 标注、绘制工具、路径规划与机器人编排** 等开箱即用的能力。

BicMap 将 **数据**（GeoJSON / 点云 / 机器人位姿）映射为一组可组合的 **图层与覆盖物**，开发者通过统一的 `bicMap` 单例即可快速搭建室内外一体化的可视化场景，无需关心底层引擎的加载、坐标转换与资源托管细节。

核心特性：

* 室内外一体化：SLAM 栅格地图、瓦片底图、高精地图、二三维点云、3D 模型同场景渲染
* 丰富的覆盖物：方向标记、批量 POI、机器人标记、矩形/多边形/圆形/折线/宽线段
* 交互式绘制：矩形、多边形、折线、圆形、可通行区域绘制与编辑
* 机器人能力：位姿跟随、重定位、实时定位、路径规划与回放、任务编排
* 引擎内置：`maplibre-gl` / `three` / `@turf/turf` / `urdf-loader` 通过 npm 静态打包，CSS 与字体运行时自动注入，零额外配置

## 安装方式

### NPM Module

```bash
pnpm add @x-humanoid-cloud/bic-map
```

```js
import bicMap from '@x-humanoid-cloud/bic-map'

await bicMap.init()

const map = bicMap.createMap({
  container: 'map',
  center: [116.397, 39.908],
  zoom: 16
})
```

作为 Vue 插件使用（可通过 `this.$bicMap` 访问）：

```js
import { createApp } from 'vue'
import bicMap from '@x-humanoid-cloud/bic-map'
import App from './App.vue'

createApp(App).use(bicMap).mount('#app')
```

### Script Tag / CDN

适配 uniapp renderJS、`<script>` 直引等无构建环境，加载后通过 `window.bicMap` 使用：

```html
<script src="https://your-cdn/bicMap.ext.min.js"></script>
<script>
  bicMap.init().then(() => {
    const map = bicMap.createMap({ container: 'map' })
  })
</script>
```

## 能力速览

| | | |
| :---: | :---: | :---: |
| ![机器人建图](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/indoor_buildMap.png)<br/>机器人建图 | ![3D模型控制](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/indoor_load3dControl.png)<br/>3D 模型控制 | ![实时位置更新](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/indoor_location.png)<br/>实时位置更新 |
| ![点位Marker](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/base_POIMarkers.png)<br/>点位 Marker | ![图形绘制](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/expand_GraphicDrawing.png)<br/>图形绘制 | ![扫地机器人场景](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/scene_indoorCleaning.png)<br/>扫地机器人场景 |
| ![三站一场地图引导](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/scene_transportHub.png)<br/>三站一场地图引导 | ![博物馆导览讲解](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/scene_robotGuideTour.png)<br/>博物馆导览讲解 | ![社区24h无人值守巡检](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/scene_communityInspect.png)<br/>社区 24h 无人值守巡检 |
| ![室外建筑物](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/outdoor_buildings.png)<br/>室外建筑物 | ![室外点云](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/outdoor_pointCloud.png)<br/>室外点云 | ![高精地图加载](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/outdoor_hdMap.png)<br/>高精地图加载 |

<p align="right"><a href="https://bicmap.x-humanoid-cloud.com/">查看更多示例 →</a></p>

## 本地开发与示例

仓库内置了一套示例门户，覆盖室内/室外/基础/扩展/场景共 30+ 个示例：

```bash
pnpm install
pnpm dev            # 启动示例门户，默认 https://bicmap.x-humanoid-cloud.com/
```

构建命令：

```bash
pnpm build          # 构建 npm 包（ESM + UMD），第三方依赖 external
pnpm build:cdn      # 构建 CDN 版本（IIFE 自包含单文件）
pnpm build:web      # 构建示例门户静态站点
pnpm build:all      # 同时构建 npm 包与 CDN 版本
```

## 学习资源

* [在线文档 & 示例门户](https://bicmap.x-humanoid-cloud.com/)：最新接口说明与所有示例的可交互预览，点击卡片即可打开对应示例

## 生态项目

| 项目 | 说明 | 仓库 |
|------|------|------|
| **BICMap-Mobile** | 基于 uni-app（Vue3 + Vite）的移动端应用，通过 renderJS 模式集成 BicMap，实现 SLAM 建图等场景 | [GitHub](https://github.com/Open-X-Humanoid/BICMap-Mobile) |
| **BICMap-Python** | 通过 pywebview 桌面容器 + JS Bridge，让 Python 代码直接调用 BicMap JS SDK 进行地图展示与数据渲染 | [GitHub](https://github.com/Open-X-Humanoid/BICMap-Python) |

## 技术栈

BicMap 构建于以下开源项目之上：

* [MapLibre GL JS](https://maplibre.org) — 底层地图渲染引擎
* [Three.js](https://threejs.org) — 3D 模型与自定义图层渲染
* [Turf.js](https://turfjs.org) — 地理空间计算
* [Vue 3](https://vuejs.org) + [Vite](https://vite.dev) — 示例门户与构建工具链
* [urdf-loader](https://github.com/gkjohnson/urdf-loaders) — URDF 机器人模型加载
* [Fabric.js](https://fabricjs.com) — 示例门户中地图编辑器的 Canvas 绘图引擎
* [PCL.js](https://github.com/PointCloudLibrary/pcl) — 点云处理

## Contributors

感谢以下开发者对 BicMap 的贡献：

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/HouserHao">
        <img src="https://github.com/HouserHao.png" width="80" height="80" style="border-radius:50%" alt="HouserHao"/>
        <br/>
        <sub><b>HouserHao</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/lxycreate">
        <img src="https://github.com/lxycreate.png" width="80" height="80" style="border-radius:50%" alt="lxycreate"/>
        <br/>
        <sub><b>lxycreate</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/yinwensong">
        <img src="https://github.com/yinwensong.png" width="80" height="80" style="border-radius:50%" alt="yinwensong"/>
        <br/>
        <sub><b>yinwensong</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/tianxiangLee">
        <img src="https://github.com/tianxiangLee.png" width="80" height="80" style="border-radius:50%" alt="tianxiangLee"/>
        <br/>
        <sub><b>tianxiangLee</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/Zy9907yy">
        <img src="https://github.com/Zy9907yy.png" width="80" height="80" style="border-radius:50%" alt="Zy9907yy"/>
        <br/>
        <sub><b>Zy9907yy</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/mayanhui">
        <img src="https://github.com/mayanhui.png" width="80" height="80" style="border-radius:50%" alt="mayanhui"/>
        <br/>
        <sub><b>mayanhui (Yuri)</b></sub>
      </a>
    </td>
  </tr>
</table>

## 联系我们

欢迎微信扫码加入社群，获取最新动态与技术支持：

<p align="center">
  <img src="https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/contact_us.png" width="400" alt="微信扫码加入群聊"/>
</p>

## License

[MIT](./LICENSE) © 2024-2026 北京人形机器人创新中心 (Beijing Innovation Center of Humanoid Robotics)

本项目打包并再分发了若干第三方开源库，其版权与许可证声明见 [THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md)。
