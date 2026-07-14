<p align="right">
  English | <a href="./README.md">中文</a>
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

<h1 align="center">BicMap | <a href="https://bicmap.x-humanoid-cloud.com/">Documentation</a></h1>

<h5 align="center">Seamless indoor/outdoor GPU map rendering & interaction SDK · Built for robotics</h5>

[![BicMap Example Portal](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/scene_robotGuideTour.png)](https://bicmap.x-humanoid-cloud.com/)

BicMap (`@x-humanoid-cloud/bic-map`) is a WebGL-based map rendering library built on top of [MapLibre GL](https://maplibre.org), [Three.js](https://threejs.org), and [Turf](https://turfjs.org), extended with robotics-oriented features including **indoor SLAM maps, outdoor tile/HD maps, point clouds, 3D models, POI markers, drawing tools, path planning, and robot orchestration** — all ready to use out of the box.

BicMap maps **data** (GeoJSON / point clouds / robot poses) to a set of composable **layers and overlays**. Developers can build seamless indoor/outdoor visualization scenes through a single `bicMap` instance without worrying about engine initialization, coordinate transformations, or asset hosting.

Key Features:

* **Unified indoor/outdoor rendering** — SLAM grid maps, tile base maps, HD maps, 2D/3D point clouds, and 3D models in the same scene
* **Rich overlay types** — direction markers, batch POIs, robot markers, rectangles, polygons, circles, polylines, and wide line segments
* **Interactive drawing** — rectangles, polygons, polylines, circles, and traversable-area drawing & editing
* **Robotics capabilities** — pose tracking, relocalization, real-time positioning, path planning & playback, task orchestration
* **Zero-config engine** — `maplibre-gl` / `three` / `@turf/turf` / `urdf-loader` bundled via npm, CSS and fonts injected at runtime automatically

## Installation

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

Use as a Vue plugin (accessible via `this.$bicMap`):

```js
import { createApp } from 'vue'
import bicMap from '@x-humanoid-cloud/bic-map'
import App from './App.vue'

createApp(App).use(bicMap).mount('#app')
```

### Script Tag / CDN

For environments without a build step (uniapp renderJS, plain `<script>` tags, etc.), access via `window.bicMap` after loading:

```html
<script src="https://your-cdn/bicMap.ext.min.js"></script>
<script>
  bicMap.init().then(() => {
    const map = bicMap.createMap({ container: 'map' })
  })
</script>
```

## Feature Gallery

| | | |
| :---: | :---: | :---: |
| ![Robot Mapping](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/indoor_buildMap.png)<br/>Robot Mapping | ![3D Model Control](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/indoor_load3dControl.png)<br/>3D Model Control | ![Real-time Location](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/indoor_location.png)<br/>Real-time Location |
| ![POI Markers](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/base_POIMarkers.png)<br/>POI Markers | ![Graphic Drawing](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/expand_GraphicDrawing.png)<br/>Graphic Drawing | ![Cleaning Robot Scene](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/scene_indoorCleaning.png)<br/>Cleaning Robot Scene |
| ![Transit Hub Map Guide](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/scene_transportHub.png)<br/>Transit Hub Map Guide | ![Museum Tour Guide](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/scene_robotGuideTour.png)<br/>Museum Tour Guide | ![Community 24h Inspection](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/scene_communityInspect.png)<br/>Community 24h Inspection |
| ![Outdoor Buildings](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/outdoor_buildings.png)<br/>Outdoor Buildings | ![Outdoor Point Cloud](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/outdoor_pointCloud.png)<br/>Outdoor Point Cloud | ![HD Map Loading](https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/home-thum/outdoor_hdMap.png)<br/>HD Map Loading |

<p align="right"><a href="https://bicmap.x-humanoid-cloud.com/">View more examples →</a></p>

## Local Development & Examples

The repository includes a built-in example portal covering 30+ examples across indoor / outdoor / basic / extended / scene categories:

```bash
pnpm install
pnpm dev            # Start the example portal at https://bicmap.x-humanoid-cloud.com/
```

Build commands:

```bash
pnpm build          # Build npm package (ESM + UMD), third-party deps external
pnpm build:cdn      # Build CDN version (IIFE self-contained single file)
pnpm build:web      # Build example portal static site
pnpm build:all      # Build both npm package and CDN version
```

## Resources

* [Online Docs & Example Portal](https://bicmap.x-humanoid-cloud.com/) — Latest API reference and interactive preview of all examples; click any card to open the corresponding demo

## Ecosystem

| Project | Description | Repository |
|---------|-------------|------------|
| **BICMap-Mobile** | Mobile app built with uni-app (Vue3 + Vite), integrating BicMap via renderJS for scenes like SLAM mapping | [GitHub](https://github.com/Open-X-Humanoid/BICMap-Mobile) |
| **BICMap-Python** | Lets Python code drive the BicMap JS SDK directly through a pywebview desktop container and JS Bridge, enabling map rendering and data visualization from Python | [GitHub](https://github.com/Open-X-Humanoid/BICMap-Python) |

## Tech Stack

BicMap is built on top of the following open-source projects:

* [MapLibre GL JS](https://maplibre.org) — Core map rendering engine
* [Three.js](https://threejs.org) — 3D model and custom layer rendering
* [Turf.js](https://turfjs.org) — Geospatial computation
* [Vue 3](https://vuejs.org) + [Vite](https://vite.dev) — Example portal and build toolchain
* [urdf-loader](https://github.com/gkjohnson/urdf-loaders) — URDF robot model loading
* [Fabric.js](https://fabricjs.com) — Canvas-based drawing engine for the map editor in the example portal

## Contributors

Thanks to the following developers for their contributions to BicMap:

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

## Contact Us

Scan the QR code below to join our WeChat community for the latest updates and technical support:

<p align="center">
  <img src="https://raw.githubusercontent.com/Open-X-Humanoid/BICMap/develop/src/examples/assets/contact_us.png" width="400" alt="Scan to join WeChat group"/>
</p>

## License

[MIT](./LICENSE) © 2024-2026 Beijing Innovation Center of Humanoid Robotics

This project bundles and redistributes several third-party open-source libraries. Their copyright and license notices are listed in [THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md).
