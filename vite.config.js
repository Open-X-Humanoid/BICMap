import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// npm 库构建中保持 external 的第三方依赖（由消费方自行安装，避免重复打包/多实例）
const LIB_EXTERNAL = ['vue', 'maplibre-gl', 'three', '@turf/turf']

// UMD / IIFE 场景下 external 依赖对应的全局变量名（仅浏览器 <script> 直接引用时需要）
const LIB_GLOBALS = {
  vue: 'Vue',
  'maplibre-gl': 'maplibregl',
  three: 'THREE',
  '@turf/turf': 'turf'
}

// CDN 单文件产物内联了第三方库，但上游 dist 未必携带版权横幅（如 maplibre-gl）。
// 在产物头部注入聚合的署名横幅，确保 BSD/MIT/Apache 的版权声明随单文件一并分发。
// 使用 /*! 前缀使其匹配 terser 的 comments: 'some'，不会被压缩删除。
const CDN_LICENSE_BANNER = `/*!
 * @license
 * @preserve
 * bic-map (@x-humanoid-cloud/bic-map)
 * Copyright (c) 2024-2026 北京人形机器人创新中心 (Beijing Innovation Center of Humanoid Robotics)
 * Released under the MIT License.
 *
 * This bundle inlines the following third-party open source libraries:
 *   - MapLibre GL JS — Copyright (c) 2023 MapLibre contributors; portions Copyright (c) 2020 Mapbox — BSD-3-Clause
 *   - Three.js       — Copyright (c) 2010-2023 three.js authors — MIT
 *   - Turf.js        — Copyright (c) 2017 TurfJS — MIT
 *   - urdf-loader    — Copyright 2020 California Institute of Technology — Apache-2.0
 *
 * Full copyright notices and license texts: see THIRD-PARTY-LICENSES.md
 * (https://github.com/Open-X-Humanoid/BICMap/blob/develop/THIRD-PARTY-LICENSES.md)
 */`

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // 检查是否为 CDN 构建模式
  const isCdnBuild = mode === 'cdn'

  // 检查是否为 Web 示例构建模式
  const isWebBuild = mode === 'web'

  // 资源目录策略：
  //  - dev / build:web 需要完整 public（glyphs、assets 等运行时资源）
  //  - 库构建（build / build:cdn）不再复制任何 public 资源（引擎已通过 npm 打包，
  //    glyphs/assets 由消费方自行托管），避免把无用文件塞进发布包
  const publicDir = isWebBuild
    ? 'public'
    : (command === 'build' ? false : 'public')

  // 检查是否保留console输出 (环境变量控制)
  const keepConsole = process.env.KEEP_CONSOLE === 'true'

  const terserOptions = {
    compress: {
      drop_console: !keepConsole,
      drop_debugger: !keepConsole,
      pure_funcs: keepConsole ? [] : ['console.log', 'console.warn', 'console.info']
    },
    mangle: true,
    format: {
      // 保留含 @license / @preserve / Copyright 的版权横幅（含本产物注入的聚合署名横幅与
      // 第三方库自带横幅），满足 MIT/BSD/Apache 等再分发的署名要求
      comments: /@license|@preserve|@cc_on|Copyright/i
    }
  }

  const config = {
    plugins: [
      vue()
    ],
    publicDir,
    assetsInclude: ['**/*.bmp', '**/*.pcd'],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  }

  if (command === 'build') {
    if (isWebBuild) {
      // Web 示例构建：与 dev 效果一致，打包整个 web app，输出到 dist/web
      config.build = {
        outDir: 'dist/web'
      }
    } else if (isCdnBuild) {
      // CDN 版本：IIFE 自包含，所有依赖（含 maplibre-gl / three / turf / vue）全部打进单文件，
      // 适配 uniapp renderJS、<script> 直引等无构建环境，运行后通过 window.bicMap 使用。
      config.build = {
        outDir: 'dist/cdn',
        lib: {
          entry: resolve(__dirname, 'src/cdn.js'),
          name: 'bicMap',
          fileName: () => 'bicMap.ext.min.js',
          formats: ['iife']
        },
        rollupOptions: {
          output: {
            globals: {},
            format: 'iife',
            name: 'bicMap',
            sourcemap: false
          }
        },
        minify: 'terser',
        // 用 terser 的 format.preamble 注入聚合署名横幅：它会被原样前置且不参与
        // comments 过滤/压缩，是 lib 模式下最可靠的 banner 注入方式
        terserOptions: {
          ...terserOptions,
          format: { ...terserOptions.format, preamble: CDN_LICENSE_BANNER }
        }
      }
    } else {
      // npm 包构建：输出 ESM(.mjs) + UMD(.umd.js)，第三方依赖 external 由消费方安装
      config.build = {
        lib: {
          entry: resolve(__dirname, 'src/index.js'),
          name: 'BicMapPlugin',
          fileName: (format) => `bic-map.${format === 'es' ? 'mjs' : 'umd.js'}`
        },
        rollupOptions: {
          external: LIB_EXTERNAL,
          output: {
            globals: LIB_GLOBALS,
            assetFileNames: (assetInfo) => {
              if (assetInfo.name === 'style.css') return 'bic-map.css';
              return assetInfo.name;
            }
          }
        },
        minify: 'terser',
        terserOptions
      }
    }
  }

  return config
})
