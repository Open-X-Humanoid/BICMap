<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2026-06-03 16:00:00
 * @LastEditTime: 2026-06-03 16:25:00
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 扫地机器人清扫场景 —— 未清扫路径 PathReplay 动画 + 已清扫区域 passableArea 展示
 * @FilePath: /bic-map/src/examples/scene/indoorCleaning/index.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="app-root">
    <canvas id="cleaningCanvas" class="canvas-hidden"></canvas>

    <AppHeader title="扫地机器人清扫场景 沿边清扫" />

    <main class="map-area">
      <div class="grid-bg"></div>
      <div class="map-container">
        <div id="cleaningMap" class="map-gl"></div>

        <aside class="overlay-panel" aria-label="清扫信息">
          <div class="panel-title">清扫状态</div>
          <p v-if="!slamMapReady" class="hint-wait">正在加载 SLAM 底图…</p>
          <template v-else>
            <dl class="stat-grid">
              <div><dt>状态</dt><dd>{{ statusLabel }}</dd></div>
              <div><dt>进度</dt><dd class="tabular">{{ progressPercent }}%</dd></div>
              <div><dt>总路径长</dt><dd class="tabular">{{ totalLengthM.toFixed(2) }} m</dd></div>
              <div><dt>已清扫</dt><dd class="tabular">{{ cleanedLengthM.toFixed(2) }} m</dd></div>
            </dl>
            <div class="legend">
              <span class="dot dot--cleaned"></span>已清扫区域（passableArea，宽 0.1 m）
            </div>
            <div class="legend">
              <span class="dot dot--route"></span>待清扫路线（PathReplay）
            </div>
          </template>
        </aside>
      </div>
    </main>

    <AppFooter>
      <template #left>
        <div class="toolbar-actions" role="toolbar" aria-label="清扫控制">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!slamMapReady || playState === 'playing'"
            @click="onStart"
          >
            开始清扫
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!slamMapReady || playState !== 'playing'"
            @click="onPause"
          >
            暂停
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!slamMapReady || playState !== 'paused'"
            @click="onResume"
          >
            继续
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!slamMapReady"
            @click="onReset"
          >
            重置
          </button>
          <label class="opt opt-check">
            <span>循环</span>
            <input v-model="loop" type="checkbox" :disabled="!slamMapReady">
          </label>
          <label class="opt">
            <span>时长(s)</span>
            <input
              v-model.number="durationSeconds"
              type="number"
              min="1"
              max="120"
              step="0.5"
              :disabled="!slamMapReady || playState === 'playing'"
            >
          </label>
        </div>
      </template>
    </AppFooter>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_transparent.png'
import robotImage from './assets/robot_vacuum_transparent.png'

// ===== SLAM 底图参数 =====
const MAP_START_X = -58.999993705749512;
const MAP_START_Y = -21.349997329711914;
const MAP_X_GRID_COUNT = 2048;
const MAP_Y_GRID_COUNT = 1143;
const MAP_RESOLUTION = 0.05;

// ===== 完整清扫路径（两段拼接，PathReplay 动画，机器人走过则动态变为 passableArea） =====
const RAW_PATH_SEGMENT_1 = [
  [116.40735453390567, 39.90420210608286],
  [116.40735453390567, 39.90420112394585],
  [116.40735460503385, 39.90420036006145],
  [116.40735574307331, 39.90420036006145],
  [116.40735645434802, 39.90420030549825],
  [116.40735645434802, 39.90419937792436],
  [116.40735702336775, 39.90419937792436],
  [116.40735773464246, 39.90419937792436],
  [116.407358730427, 39.90419937792436],
  [116.40735922831868, 39.90419888685582],
  [116.40735922831868, 39.904197959281845],
  [116.40735922831868, 39.90419692258109],
  [116.40735922831868, 39.904196486075676],
  [116.40735965508344, 39.904196486075676],
  [116.40736022410323, 39.90419643151253],
  [116.40736036635815, 39.90419719539699],
  [116.40736036635815, 39.904197850155526],
  [116.40736036635815, 39.904198614039956],
  [116.40736036635815, 39.90419943248753],
  [116.40736036635815, 39.90420036006145],
  [116.40736036635815, 39.904201178509],
  [116.40736043748632, 39.904201724140705],
  [116.40736136214275, 39.90420194239337],
  [116.40736250018222, 39.90420194239337],
  [116.40736306920195, 39.90420194239337],
  [116.40736456287948, 39.90420216064604],
  [116.407365700919, 39.90420216064604],
  [116.40736676783166, 39.90420216064604],
  [116.4073676924881, 39.904201996956544],
  [116.40736811925296, 39.90420166957753],
  [116.40736840376286, 39.90420090569316],
  [116.40736819038108, 39.904200087245556],
  [116.40736826150788, 39.90419910510849],
  [116.40736819038108, 39.904198450350435],
  [116.40736819038108, 39.9041979047187],
  [116.40736811925296, 39.904196649765225],
  [116.40736811925296, 39.90419621325984],
  [116.40736811925296, 39.9041956676281],
  [116.40736804812616, 39.904195067433164],
  [116.40736811925296, 39.90419463092775],
  [116.40736911503751, 39.90419463092775],
  [116.40737039533201, 39.90419463092775],
  [116.40737146224467, 39.904194576364574],
  [116.4073720312644, 39.90419484918047],
  [116.4073720312644, 39.90419550393858],
  [116.4073720312644, 39.90419626782298],
  [116.4073720312644, 39.90419686801792],
  [116.4073720312644, 39.90419757733969],
  [116.4073720312644, 39.90419866860313],
  [116.40737196013629, 39.90419915967169],
  [116.40737196013629, 39.90420003268241],
  [116.40737196013629, 39.90420057831412],
  [116.40737196013629, 39.904201178509],
  [116.40737196013629, 39.904201724140705],
  [116.40737274253911, 39.9042018878302],
  [116.4073735960688, 39.9042018878302],
  [116.40737444959836, 39.9042018878302],
  [116.40737480523507, 39.90420210608286],
  [116.40737480523507, 39.904202869967236],
  [116.40737487636318, 39.90420319734628],
  [116.40737637004065, 39.90420319734628],
  [116.40737779259007, 39.90420325190942],
  [116.40737843273666, 39.904203033656785],
  [116.40737978415916, 39.904203033656785],
  [116.4073814200903, 39.90420308821993],
  [116.40738255812988, 39.904203142783075],
  [116.40738305602281, 39.90420319734628],
  [116.40738412293422, 39.90420319734628],
  [116.40738526097368, 39.90420325190942],
  [116.40738557956092, 39.90420308590757],
  [116.40738633693127, 39.90420308590757],
  [116.40738714839796, 39.90420312740733],
  [116.40738828445251, 39.90420304440852],
  [116.4073892582121, 39.90420308590757],
  [116.40739055655968, 39.90420308590757],
  [116.40739158441954, 39.90420300290873],
  [116.40739304506002, 39.90420300290873],
  [116.4073942893092, 39.90420308590757],
  [116.40739564175499, 39.90420308590757],
  [116.40739683190793, 39.90420308590757],
  [116.40739775156919, 39.90420308590757],
  [116.40739872533084, 39.90420308590757],
  [116.40739986138544, 39.90420304440852],
  [116.40740072695041, 39.90420304440852],
  [116.40740202529793, 39.90420304440852],
  [116.4074034859384, 39.90420300290873],
  [116.40740445969999, 39.90420291990992],
  [116.40740548755798, 39.90420291990992],
  [116.40740662361253, 39.90420296140971],
  [116.40740738098089, 39.90420287841087],
  [116.40740840883882, 39.90420283691108],
  [116.40740992357763, 39.90420283691108],
  [116.40741122192702, 39.90420283691108],
  [116.4074123579797, 39.90420291990992],
  [116.40741365632715, 39.90420287841087],
  [116.40741484648004, 39.90420287841087],
  [116.40741609072927, 39.90420296140971],
  [116.40741668580472, 39.90420279541203],
  [116.40741657761004, 39.90420188242422],
  [116.40741663170837, 39.90420121843363],
  [116.40741663170837, 39.90420026394753],
  [116.40741668580472, 39.90419906046418],
  [116.40741668580472, 39.9041979814794],
  [116.40741679400134, 39.9041968609956],
  [116.40741684809961, 39.90419615550516],
  [116.40741701039252, 39.904195408515704],
  [116.40741722678376, 39.90419474452506],
  [116.40741809234879, 39.90419470302527],
  [116.4074192284034, 39.90419457852738],
  [116.40742150051051, 39.9041946200264],
  [116.40742182509837, 39.904195035020564],
  [116.407421933293, 39.90419611400617],
  [116.40742187919665, 39.90419719299092],
  [116.40742187919665, 39.90419835497451],
  [116.40742182509837, 39.904199350960454],
  [116.40742177100009, 39.90420047144423],
  [116.40742177100009, 39.90420134293228],
  [116.40742177100009, 39.90420250491579],
  [116.4074216628054, 39.90420341790281],
  [116.4074216628054, 39.90420503638023],
  [116.4074216628054, 39.90420619836365],
  [116.4074215546089, 39.90420715284969],
  [116.40742031035961, 39.90420719434948],
  [116.40741917430506, 39.90420715284969],
  [116.40741771366459, 39.904206945353025],
  [116.40741706449086, 39.904206945353025],
  [116.40741684809961, 39.9042062398627],
  [116.40741571204506, 39.9042062398627],
  [116.4074147923817, 39.9042062398627],
  [116.40741473828342, 39.904206986852046],
  [116.40741371042549, 39.904206903853236],
  [116.40741111373046, 39.904206862354215],
  [116.40740970718633, 39.904206862354215],
  [116.4074086793284, 39.904206903853236],
  [116.40740759737213, 39.904207028351834],
  [116.40740759737213, 39.904207982837875],
  [116.40740754327385, 39.90420931081968],
  [116.40740754327385, 39.904210472803044],
  [116.40740759737213, 39.90421159328665],
  [116.40740819244763, 39.90421142728903],
  [116.40740873342668, 39.90421109529376],
  [116.40740943669874, 39.90421097079593],
  [116.40741057275136, 39.90421088779712],
  [116.40741208749205, 39.90421080479831],
  [116.40741430550094, 39.904210680299684],
  [116.40741630712051, 39.90421055580188],
  [116.4074176595663, 39.9042105973009],
  [116.4074192284034, 39.904210680299684],
  [116.40742063494554, 39.90421063880069],
  [116.40742182509837, 39.9042105973009],
  [116.407421933293, 39.90420980881254],
  [116.40742198739133, 39.904209352318674],
  [116.40742285295636, 39.90420926931989],
  [116.40742415130381, 39.90420926931989],
  [116.40742663980416, 39.90420922782084],
  [116.40742929059752, 39.90420931081968],
  [116.40743048074836, 39.90420960131516],
  [116.40743004796587, 39.904210389804234],
  [116.40743021025884, 39.90421121979239],
  [116.40743118402048, 39.904211676285456],
  [116.40743204958545, 39.904211385790006],
  [116.40743351022593, 39.90421109529376],
  [116.40743378071551, 39.90421159328665],
  [116.40743372661717, 39.90421279676977],
  [116.40743367251889, 39.904213917253315],
  [116.40743307744339, 39.90421429074834],
  [116.40743275285752, 39.90421507923739],
  [116.4074328610522, 39.9042161167221],
  [116.40743345612765, 39.904216075223076],
  [116.40743378071551, 39.904216158221885],
  [116.40743362172611, 39.90421682906012],
  [116.40743370122442, 39.90421859762907],
  [116.40743370122442, 39.904219634376915],
  [116.40743370122442, 39.90422091506471],
  [116.40743370122442, 39.9042225006782],
  [116.40743370122442, 39.9042225006782],
]

const RAW_PATH_SEGMENT_2 = [
  [116.40743356298634, 39.904222866564226],
  [116.40743356298634, 39.904223598385784],
  [116.40743348348809, 39.904224269222226],
  [116.40743348348809, 39.90422469611815],
  [116.40743348348809, 39.90422542793971],
  [116.40743348348809, 39.904226281731525],
  [116.40743348348809, 39.90422701355362],
  [116.40743348348809, 39.904227806360296],
  [116.40743308599212, 39.90422841621151],
  [116.407432767996, 39.90422890409258],
  [116.40743070102104, 39.90422896507769],
  [116.40742791855405, 39.90422908704792],
  [116.40742513608848, 39.90422908704792],
  [116.40742139963305, 39.90422914803307],
  [116.40741949165619, 39.90422914803307],
  [116.40741718618335, 39.90422914803307],
  [116.40741702718537, 39.90422841621151],
  [116.40741567570245, 39.90422841621151],
  [116.40741464221423, 39.90422841621151],
  [116.40741448321614, 39.90422878212229],
  [116.4074101902682, 39.90422902606281],
  [116.4074078847969, 39.90422884310743],
  [116.40740359184741, 39.90422884310743],
  [116.40740065038386, 39.9042285381818],
  [116.40740057088402, 39.90422695256791],
  [116.40739921940121, 39.904226281731525],
  [116.40739921940121, 39.90422579385046],
  [116.40740136587442, 39.904225671880226],
  [116.40740319435304, 39.904225671880226],
  [116.40740430733945, 39.90422518399916],
  [116.40740422783978, 39.9042238423263],
  [116.40740422783978, 39.90422213474264],
  [116.40740430733945, 39.90422061011432],
  [116.40740422783978, 39.90421890253057],
  [116.40740430733945, 39.9042171949462],
  [116.40740406884169, 39.90421548736231],
  [116.40740398934338, 39.90421451160009],
  [116.40740001439156, 39.90421451160009],
  [116.40739850390912, 39.90421445061497],
  [116.4073985834089, 39.90421219416481],
  [116.40739866290716, 39.90421036461055],
  [116.4073985834089, 39.90420859604134],
  [116.40739842441081, 39.90420688845677],
  [116.4073980269149, 39.904206034664725],
  [116.40739476745512, 39.904205851709264],
  [116.40739293897661, 39.90420621762013],
  [116.40739071300356, 39.90420621762013],
  [116.40738745354236, 39.90420621762013],
  [116.40738459157706, 39.90420621762013],
  [116.40738165011197, 39.90420591269438],
  [116.40737831115246, 39.90420597367955],
  [116.40737497219288, 39.90420609564981],
  [116.40737155373506, 39.90420609564981],
  [116.40736845327194, 39.90420597367955],
  [116.40736551180686, 39.90420597367955],
  [116.40736312683578, 39.90420646156073],
  [116.4073611393606, 39.90420658353102],
  [116.40735899288586, 39.90420768126364],
  [116.4073582773953, 39.904209083922524],
  [116.40735851589164, 39.904210730521385],
  [116.40735867488974, 39.90421152332823],
  [116.40736121885885, 39.90421140135794],
  [116.40736185485116, 39.90421024264023],
  [116.40736217284734, 39.904209388848244],
  [116.40736360382999, 39.904209388848244],
  [116.40736487581455, 39.904210730521385],
  [116.40736519381073, 39.9042120721945],
  [116.40736559130659, 39.90421390174873],
  [116.40736527331052, 39.90421469455555],
  [116.40736312683578, 39.90421469455555],
  [116.40736312683578, 39.90421316992703],
  [116.40736082136442, 39.90421316992703],
  [116.4073571644073, 39.90421292598646],
  [116.40735549492825, 39.90421286500134],
  [116.40735549492825, 39.90421170628366],
  [116.40735557442662, 39.90421054756595],
  [116.40735557442662, 39.90420914490764],
  [116.407354302442, 39.904208778996775],
  [116.40735438194179, 39.90420749830818],
  [116.4073542229437, 39.904205241857795],
  [116.407354302442, 39.90420292442212],
  [116.407354302442, 39.904201643733984],
  [116.407354302442, 39.904201643733984],
  [116.407354302442, 39.904201643733984],
  [116.407354302442, 39.904201643733984],
]

// ===== 样式常量（与 passableArea 对齐） =====
const CLEANED_CENTERLINE_ID = 'cleaned-centerline'
const CLEANED_POLYGON_ID = 'cleaned-polygon'

/** 已清扫中心线样式，与 passableArea DEFAULT_LINE_STYLE 对齐 */
const CLEANED_CENTERLINE_STYLE = {
  color: '#00E1A0',
  width: 2,
  opacity: 1,
  dashType: 'solid',
  showArrow: false,
}

/** 已清扫 polygon 样式，与 passableArea DEFAULT_POLYLINE_AREA_STYLE 对齐 */
const CLEANED_POLYGON_STYLE = {
  fillColor: '#00e1a0',
  highlightColor: '#fff',
  outlineColor: '#00e1a0',
  fillOpacity: 0.1,
  outlineWidth: 0,
  filled: true,
}

// ===== 工具函数 =====
/**
 * 去除相邻重复坐标点
 * @param {Array} points
 * @returns {Array}
 */
function deduplicatePath(points) {
  const result = []
  for (const p of points) {
    const last = result[result.length - 1]
    if (last && last[0] === p[0] && last[1] === p[1]) continue
    result.push([p[0], p[1]])
  }
  return result
}

/**
 * Haversine 距离（米）
 * @param {Array} a [lng, lat]
 * @param {Array} b [lng, lat]
 * @returns {number}
 */
function haversineMeters(a, b) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * 路径总长度（米）
 * @param {Array} path
 * @returns {number}
 */
function pathLengthMeters(path) {
  let sum = 0
  for (let i = 0; i < path.length - 1; i++) {
    sum += haversineMeters(path[i], path[i + 1])
  }
  return sum
}

/**
 * 以像素为单位计算各线段长度，用于基于屏幕的插值（与 pathReplay 一致）
 * @param {Object} mapInstance
 * @param {Array} path
 * @returns {{ segmentLengths: number[], totalPixelLength: number }}
 */
function buildPixelSegmentMetrics(mapInstance, path) {
  const segmentLengths = []
  let total = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = mapInstance.project(path[i])
    const b = mapInstance.project(path[i + 1])
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    segmentLengths.push(len)
    total += len
  }
  return { segmentLengths, totalPixelLength: total }
}

/**
 * 沿路径按像素距离插值（与 pathReplay 一致）
 * @param {Array} path
 * @param {number[]} segmentLengths
 * @param {number} totalLen
 * @param {number} distAlong
 * @returns {{ lngLat: number[], segIndex: number }}
 */
function interpolateAlongPath(path, segmentLengths, totalLen, distAlong) {
  if (!path.length) return { lngLat: [0, 0], segIndex: 0 }
  if (path.length < 2 || totalLen <= 0) return { lngLat: [...path[0]], segIndex: 0 }
  let d = Math.min(Math.max(0, distAlong), totalLen)
  let i = 0
  while (i < segmentLengths.length && d > segmentLengths[i]) {
    d -= segmentLengths[i]
    i++
  }
  if (i >= path.length - 1) {
    return { lngLat: [...path[path.length - 1]], segIndex: path.length - 2, t: 1 }
  }
  const segLen = segmentLengths[i]
  const t = segLen > 0 ? d / segLen : 0
  const p0 = path[i]
  const p1 = path[i + 1]
  return {
    lngLat: [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t],
    segIndex: i,
    t,
  }
}

/**
 * 地理方位角（正北 0°，顺时针 0-360°）
 * @param {Array} from [lng, lat]
 * @param {Array} to   [lng, lat]
 * @returns {number}
 */
function geographicBearingDeg(from, to) {
  const φ1 = (from[1] * Math.PI) / 180
  const φ2 = (to[1] * Math.PI) / 180
  const Δλ = ((to[0] - from[0]) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/**
 * 图标默认朝右（+90°），转换为 addDirectionalMarker rotation 参数（与 pathReplay 一致）
 * @param {number} bearingDeg
 * @returns {number}
 */
function markerRotationForBearing(bearingDeg) {
  return (360 - bearingDeg + 90) % 360
}

/**
 * 获取指定段的地理方位角，距离太短返回 null
 * @param {Array} path
 * @param {number} segIndex
 * @returns {number|null}
 */
function segmentBearing(path, segIndex) {
  if (segIndex < 0 || segIndex >= path.length - 1) return null
  if (haversineMeters(path[segIndex], path[segIndex + 1]) < 0.001) return null
  return geographicBearingDeg(path[segIndex], path[segIndex + 1])
}

/**
 * 构造已走过路径（起点到当前插值点），与 pathReplay buildTraversedPath 一致
 * @param {Array} path
 * @param {number} segIndex
 * @param {number[]} lngLat
 * @returns {Array}
 */
function buildTraversedPath(path, segIndex, lngLat) {
  const out = []
  for (let j = 0; j <= segIndex; j++) {
    out.push([path[j][0], path[j][1]])
  }
  const last = out[out.length - 1]
  if (!last || last[0] !== lngLat[0] || last[1] !== lngLat[1]) {
    out.push([lngLat[0], lngLat[1]])
  }
  if (out.length < 2 && path.length >= 2) {
    const p0 = path[0]
    const p1 = path[1]
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    const k = len > 1e-15 ? 1e-9 / len : 1e-9
    out.push([p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k])
  }
  return out
}

/**
 * 颜色插值（与 pathReplay interpolateColor 一致）
 * @param {string} color1 hex
 * @param {string} color2 hex
 * @param {number} ratio  0-1
 * @returns {string} hex
 */
function interpolateColor(color1, color2, ratio) {
  const hex2rgb = hex => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0]
  }
  const rgb2hex = (r, g, b) =>
    '#' + [r, g, b].map(x => {
      const h = Math.round(x).toString(16)
      return h.length === 1 ? '0' + h : h
    }).join('')
  const [r1, g1, b1] = hex2rgb(color1)
  const [r2, g2, b2] = hex2rgb(color2)
  return rgb2hex(r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio)
}

/**
 * 构建 PathReplay 渐变色路线段（与 pathReplay buildReplayPolylinesPayload 对齐）
 * 仅包含剩余的待清扫段，颜色从 #00F5FF → #00EE00，方向箭头间距 35
 * @param {Array} path  剩余待清扫路径点
 * @returns {Array}
 */
function buildRemainingRouteSegments(path) {
  if (path.length < 2) return []
  const total = path.length - 1
  return Array.from({ length: total }, (_, i) => ({
    id: `route-seg-${i}`,
    path: [path[i], path[i + 1]],
    color: interpolateColor('#00F5FF', '#00EE00', i / Math.max(total - 1, 1)),
    width: 5,
    opacity: 0.85,
    showArrow: true,
    arrowSize: 0.5,
    arrowSpacing: 35,
  }))
}

/**
 * 用 turf.buffer 将路径膨胀为 polygon ring（与 passableArea bufferLineToRing 一致）
 * @param {number[][]} path
 * @param {number} widthMeters
 * @returns {number[][]|null}
 */
function bufferLineToRing(path, widthMeters) {
  const turf = bicMap.turf
  if (!turf || !path?.length || path.length < 2) return null
  const line = turf.lineString(path)
  const buffered = turf.buffer(line, widthMeters / 2, { units: 'meters' })
  if (!buffered?.geometry) return null
  const geom = buffered.geometry
  // 沿边清扫回到起点后，路径闭合成环，buffer 结果是带洞的 polygon（外环 + 内环）。
  // 此时只取外环会把整个内部填满，造成"整体填充"，并非期望效果，直接返回 null 跳过本次填充，
  // 保留闭合前最后一帧的细条状已清扫区域。
  if (geom.type === 'Polygon') {
    if (geom.coordinates.length > 1) return null
    return geom.coordinates[0]
  }
  if (geom.type === 'MultiPolygon') {
    const first = geom.coordinates[0]
    if (!first || first.length > 1) return null
    return first[0] || null
  }
  return null
}

// ===== 路径数据（两段合并） =====
const FULL_PATH = deduplicatePath([...RAW_PATH_SEGMENT_1, ...RAW_PATH_SEGMENT_2])

// ===== 响应式状态 =====
const map = ref(null)
const slamMapReady = ref(false)
const routePolyCtrl = ref(null)
const cleanedCenterlineCtrl = ref(null)
const cleanedPolygonCtrl = ref(null)
const markerCtrl = ref(null)

const playState = ref('idle')
const loop = ref(false)
const durationSeconds = ref(20)
const progress = ref(0)

// ===== computed =====
const totalLengthM = computed(() => pathLengthMeters(FULL_PATH))
const cleanedLengthM = computed(() => totalLengthM.value * progress.value)
const progressPercent = computed(() => Math.round(progress.value * 1000) / 10)
const statusLabel = computed(() => {
  const MAP = { idle: '待清扫', playing: '清扫中', paused: '已暂停', finished: '已完成' }
  return MAP[playState.value] ?? playState.value
})
const durationMs = computed(() => Math.max(500, durationSeconds.value * 1000))

// ===== RAF 动画变量（非响应式） =====
let segmentLengths = []
let totalPixelLength = 0
let rafId = null
let playStartPerf = 0
let pausedElapsedMs = 0
let lastBearingDeg = 0
let lastCleanedSegIndex = -1
let cleanedPolygonAdded = false

// ===== 动画逻辑 =====
function refreshPathMetrics() {
  const m = map.value
  if (!m || FULL_PATH.length < 2) { segmentLengths = []; totalPixelLength = 0; return }
  const metrics = buildPixelSegmentMetrics(m, FULL_PATH)
  segmentLengths = metrics.segmentLengths
  totalPixelLength = metrics.totalPixelLength
}

/**
 * 更新已清扫区域（passableArea 样式）：仅当 segIndex 变化时调用，避免频繁 turf.buffer
 * @param {number[][]} cleanedPath
 */
function updateCleanedArea(cleanedPath) {
  if (cleanedPath.length < 2) return

  const clCtrl = cleanedCenterlineCtrl.value
  if (clCtrl) {
    clCtrl.removePolyline(CLEANED_CENTERLINE_ID)
    clCtrl.addPolyline({ id: CLEANED_CENTERLINE_ID, path: cleanedPath, ...CLEANED_CENTERLINE_STYLE })
  }

  const ring = bufferLineToRing(cleanedPath, 0.1)
  if (!ring || ring.length < 3) return
  const pgCtrl = cleanedPolygonCtrl.value
  if (!pgCtrl) return
  if (cleanedPolygonAdded) {
    pgCtrl.removePolygon(CLEANED_POLYGON_ID)
  }
  pgCtrl.addPolygon({ id: CLEANED_POLYGON_ID, points: ring, ...CLEANED_POLYGON_STYLE })
  cleanedPolygonAdded = true
}

function applyFrame(distAlong) {
  const m = map.value
  const mCtrl = markerCtrl.value
  if (!m || !mCtrl || FULL_PATH.length < 2) return

  const { lngLat, segIndex } = interpolateAlongPath(
    FULL_PATH, segmentLengths, totalPixelLength, distAlong
  )

  const b = segmentBearing(FULL_PATH, segIndex)
  if (b != null) lastBearingDeg = b
  mCtrl.setPosition(lngLat)
  mCtrl.setRotation(markerRotationForBearing(lastBearingDeg))

  // 待清扫路线：PathReplay 渐变色线段（从当前位置到终点）
  const routeCtrl = routePolyCtrl.value
  if (routeCtrl?.update) {
    const remainingPath = [lngLat, ...FULL_PATH.slice(segIndex + 1)]
    routeCtrl.update(buildRemainingRouteSegments(remainingPath))
  }

  // 已清扫区域：passableArea 样式（segIndex 变化时才重绘）
  if (segIndex !== lastCleanedSegIndex) {
    lastCleanedSegIndex = segIndex
    updateCleanedArea(buildTraversedPath(FULL_PATH, segIndex, lngLat))
  }
}

function stopRaf() {
  if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
}

function tick() {
  if (playState.value !== 'playing' || !map.value) return
  const elapsed = performance.now() - playStartPerf
  const p = Math.min(1, elapsed / durationMs.value)
  progress.value = p
  applyFrame(p * totalPixelLength)

  if (p >= 1) {
    if (loop.value) {
      playStartPerf = performance.now()
      pausedElapsedMs = 0
      progress.value = 0
      rafId = requestAnimationFrame(tick)
    } else {
      playState.value = 'finished'
      applyFrame(totalPixelLength)
      progress.value = 1
      stopRaf()
    }
    return
  }
  rafId = requestAnimationFrame(tick)
}

// ===== 控制函数 =====
function onStart() {
  if (!slamMapReady.value || !markerCtrl.value) return
  refreshPathMetrics()
  stopRaf()
  pausedElapsedMs = 0
  progress.value = 0
  lastCleanedSegIndex = -1
  cleanedPolygonAdded = false
  cleanedCenterlineCtrl.value?.clear?.()
  if (cleanedPolygonCtrl.value) {
    cleanedPolygonCtrl.value.getPolygonIds?.().forEach(id => cleanedPolygonCtrl.value.removePolygon(id))
  }
  lastBearingDeg = segmentBearing(FULL_PATH, 0) ?? 0
  applyFrame(0)
  playState.value = 'playing'
  playStartPerf = performance.now()
  rafId = requestAnimationFrame(tick)
}

function onPause() {
  if (playState.value !== 'playing') return
  pausedElapsedMs = performance.now() - playStartPerf
  playState.value = 'paused'
  stopRaf()
}

function onResume() {
  if (playState.value !== 'paused') return
  playState.value = 'playing'
  playStartPerf = performance.now() - pausedElapsedMs
  rafId = requestAnimationFrame(tick)
}

function onReset() {
  stopRaf()
  playState.value = 'idle'
  pausedElapsedMs = 0
  progress.value = 0
  lastCleanedSegIndex = -1
  cleanedPolygonAdded = false
  cleanedCenterlineCtrl.value?.clear?.()
  if (cleanedPolygonCtrl.value) {
    cleanedPolygonCtrl.value.getPolygonIds?.().forEach(id => cleanedPolygonCtrl.value.removePolygon(id))
  }
  refreshPathMetrics()
  lastBearingDeg = segmentBearing(FULL_PATH, 0) ?? 0
  routePolyCtrl.value?.update?.(buildRemainingRouteSegments(FULL_PATH))
  markerCtrl.value?.setPosition?.(FULL_PATH[0])
  markerCtrl.value?.setRotation?.(markerRotationForBearing(lastBearingDeg))
}

// ===== 初始化地图图层 =====
function initLayers() {
  const m = map.value
  if (!m) return

  refreshPathMetrics()

  cleanedCenterlineCtrl.value = bicMap.createPolylines(m, [], { showArrow: false })

  cleanedPolygonCtrl.value = bicMap.createPolygons(m, [], { ...CLEANED_POLYGON_STYLE })

  routePolyCtrl.value = bicMap.createPolylines(
    m,
    buildRemainingRouteSegments(FULL_PATH),
    { showArrow: true, arrowSpacing: 35, arrowSize: 0.5, arrowImagePath: '/bicMap/assets/svg/arrow.svg' }
  )

  lastBearingDeg = segmentBearing(FULL_PATH, 0) ?? 0
  markerCtrl.value = bicMap.addDirectionalMarker(
    m,
    FULL_PATH[0] ?? [116.4074, 39.9042],
    {
      imagePath: robotImage,
      rotationControl: false,
      draggable: false,
      initialEditMode: false,
      initialRotation: markerRotationForBearing(lastBearingDeg),
      size: 40,
    }
  )
  markerCtrl.value.setRotation(markerRotationForBearing(lastBearingDeg))

  m.once('moveend', () => { refreshPathMetrics() })
}

// ===== 生命周期 =====
onMounted(() => { initMap() })

onBeforeUnmount(() => {
  stopRaf()
  markerCtrl.value?.remove?.()
  routePolyCtrl.value?.remove?.()
  cleanedCenterlineCtrl.value?.remove?.()
  cleanedPolygonCtrl.value?.remove?.()
  map.value?.remove?.()
  map.value = null
})

async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'cleaningMap',
      center: [116.4074, 39.9042],
      zoom: 19,
      backgroundColor: '#fff',
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', () => { loadSlamMap() })
  } catch (err) {
    console.error('初始化地图失败:', err)
  }
}

async function loadSlamMap() {
  if (!map.value) return
  try {
    await bicMap.loadSlamMap(map.value, {
      startX: MAP_START_X,
      startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT,
      yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      imagePath: slamImage,
      canvasId: 'cleaningCanvas',
      fitBounds: true,
    })
    initLayers()
    slamMapReady.value = true
  } catch (err) {
    console.error('加载底图失败:', err)
  }
}
</script>

<style lang="scss" scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);
}

.map-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  z-index: 10;
}

.grid-bg {
  position: absolute;
  inset: 0;
  opacity: 0.04;
  background-image:
    linear-gradient(rgba(14, 165, 233, 1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 1) 1px, transparent 1px);
  background-size: 40px 40px;
}

.map-container {
  position: absolute;
  inset: 12px;
  border-radius: 16px;
  overflow: hidden;
  background: rgb(129 182 220 / 49%);
  box-shadow:
    0 4px 30px rgba(14, 165, 233, 0.06),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-gl {
  width: 100%;
  height: 100%;
}

.canvas-hidden {
  display: none;
}

.overlay-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
  max-width: min(300px, calc(100% - 24px));
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(14, 165, 233, 0.22);
  box-shadow:
    0 8px 32px rgba(14, 165, 233, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.6) inset;
  font-size: 13px;
  line-height: 1.45;
  color: #0c4a6e;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #0369a1;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(14, 165, 233, 0.15);
}

.hint-wait {
  color: #64748b;
  font-size: 11px;
  margin: 0;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
  margin: 0 0 10px;
  font-size: 11px;

  dt { color: #64748b; margin: 0; }
  dd { margin: 0; font-weight: 600; color: #0c4a6e; }
}

.legend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #475569;
  margin-top: 4px;
}

.dot {
  display: inline-block;
  width: 14px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;

  &--cleaned { background: #00e1a0; opacity: 0.9; }
  &--route   {
    background: linear-gradient(to right, #00F5FF, #00EE00);
    opacity: 0.9;
  }
}

.tabular {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, 'SF Mono', monospace;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 12px;
  border: 1px solid rgba(14, 165, 233, 0.2);
  font-size: 14px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.7);
  color: #0369a1;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.06);
  cursor: pointer;
  user-select: none;
  outline: none;
  transition: all 0.3s ease;

  &:focus-visible { box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.5), 0 2px 8px rgba(14, 165, 233, 0.06); }
  &:active:not(:disabled) { transform: scale(0.97); }
  &:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.03);
    border-color: rgba(14, 165, 233, 0.35);
    box-shadow: 0 4px 15px rgba(14, 165, 233, 0.1);
  }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
}

.btn-primary {
  border: none;
  color: #fff;
  background: linear-gradient(to right, #0167ff, #40bbe9, #c3e8ff);
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.3);
}

.opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #0369a1;

  input[type='number'] {
    width: 64px;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid rgba(14, 165, 233, 0.35);
    font-size: 12px;
  }
}

.opt-check input { width: auto; }

@media (max-width: 768px) {
  .map-container { inset: 8px; }

  .overlay-panel {
    left: 8px;
    right: 8px;
    max-width: none;
    top: 8px;
  }
}
</style>
