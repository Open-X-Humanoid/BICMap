# BicMap
BicMap 是一款基于 MapLibre GL JS 的高性能、可扩展的开源机器人地图引擎，致力于为智能移动机器人、人形机器人及其他具身智能应用的开发者提供室内外一体化的地图渲染与交互解决方案

BicMap 不仅仅是一个地图渲染库，它更是一个连接机器人技术与广大开发者的桥梁。我们坚信，通过开放、协作和持续创新，BicMap 将能够赋能更多的开发者，共同推动机器人在各个行业的应用落地。

> 这些第三方引擎已作为 npm 依赖（精确锁定版本：`maplibre-gl@3.6.2`、`three@0.149.0`、`@turf/turf@7.3.5`）打包，无需再单独引入 `bicMap.min.js`。

## 快速开始

本项目使用 **pnpm** 作为包管理工具。如果您还没有安装 pnpm，请先安装：

```bash
# 使用 npm 全局安装 pnpm
npm install -g pnpm

# 或使用 corepack（Node.js 16.10+）
corepack enable
corepack prepare pnpm@latest --activate
```

### 开发环境设置

```bash
# 1. 克隆项目
git clone <repository-url>
cd bic-map

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev

# 4. 构建项目
pnpm build:all
```

## 使用方式

本插件提供两种使用方式以满足不同项目需求：

### 方式一：NPM 包安装（推荐用于标准 Vue 项目）

**使用 pnpm（推荐）：**
```bash
pnpm add @x-humanoid-cloud/bic-map-plugin
```

**或使用 npm：**
```bash
npm install @x-humanoid-cloud/bic-map-plugin
```

**或使用 yarn：**
```bash
yarn add @x-humanoid-cloud/bic-map-plugin
```

适用于：
- 标准的 Vue.js 项目
- 支持 ES6 模块的环境
- 现代化的前端构建工具（Webpack、Vite 等）

### 方式二：CDN 直接引入（推荐用于 uniapp renderJS 等兼容性要求高的项目）

`pnpm build:cdn` 产出的 `dist/cdn/bicMap.ext.min.js` 是**自包含**的单文件，已内联 MapLibre / Three / Turf 引擎与基础样式，**无需再单独引入 CSS 或其它脚本**：

```html
<!-- 仅需引入这一个文件 -->
<script src="https://your-cdn.com/bicMap.ext.min.js"></script>
```

适用于：
- uniapp 项目的 renderJS（解决真机运行时的兼容性问题）
- 需要通过 CDN 直接引入的项目
- 对模块系统支持有限的环境

加载后通过全局变量 `window.bicMap` 访问，调用方式与 npm 包完全一致：

```javascript
if (window.bicMap) {
  await window.bicMap.init({
    // 静态资源（图标/字体）所在路径，详见下方「静态资源托管说明」
    assetsUrl: 'https://your-cdn.com/bicMap/assets',
    fontsUrl: 'https://your-cdn.com/bicMap/assets/ttf'
  });
  const map = window.bicMap.createMap({
    container: 'mapContainer',
    center: [116.3974, 39.9093],
    zoom: 10
  });
}
```

### 文档链接

- [CDN 使用指南](./docs/CDN_USAGE.md)
- [uniapp 集成指南](./docs/UNIAPP_INTEGRATION.md)

## 静态资源托管说明

地图引擎（maplibre-gl / three / turf）已随包打包，但**运行时静态资源不会被打进 npm 包或 CDN 文件**，需要由使用方自行托管。这类资源包括：

| 资源 | 默认路径 | 用途 |
|---|---|---|
| 标记图标 | `/bicMap/assets/img/*.png`、`/bicMap/assets/svg/*.svg` | 方向标记、POI、机器人、折线箭头等默认图标 |
| 字体 | `/bicMap/assets/ttf/*.TTF` | 标签使用的鸿蒙字体 |
| glyphs（字形切片） | `/bicMap/glyphs/{fontstack}/{range}.pbf` | 地图内文字标注（添加带 `text-field` 的符号图层时才需要） |

> 为什么不打进包里：图标/字体/glyphs 体积较大且属于运行时资源，发布包仅包含 `dist`（`files: ["dist"]`），库构建也设置了 `publicDir: false`。这样可以保持发布包精简，由使用方按需托管。

### 如何托管

1. 把本仓库 `public/bicMap/` 下的 `assets/` 和 `glyphs/`（如需文字标注）拷贝到你项目的静态资源根目录，保持 `/bicMap/...` 的路径结构；
2. 或上传到任意 CDN / 对象存储，并在 `init()` 时通过参数指定路径。

### 自定义资源路径

`init()` 支持配置资源根路径（不传则使用上表的默认路径）：

```javascript
import bicMap from '@x-humanoid-cloud/bic-map-plugin'

await bicMap.init({
  assetsUrl: 'https://your-cdn.com/bicMap/assets',     // 图标资源根路径
  fontsUrl:  'https://your-cdn.com/bicMap/assets/ttf'  // 字体根路径
  // cssUrl / jsUrl 已无需传入：样式内联注入、引擎随包打包
})
```

也可以在调用具体 API 时单独覆盖图标路径，例如：

```javascript
bicMap.addDirectionalMarker(map, [116.39, 39.90], {
  imagePath: 'https://your-cdn.com/custom/marker.svg'
})
```

> 提示：若使用方默认调用且未托管资源，标记图标会出现 404；请确保资源可访问，或显式传入 `assetsUrl` / `imagePath`。

### 字体（开箱即用）

标签默认使用鸿蒙字体（`Harmony Regular` / `Bold` / `Medium`）。`init()` 会**自动注入对应的 `@font-face`**（指向 `fontsUrl`，默认 `/bicMap/assets/ttf`），因此：

- 只要把 `ttf/` 字体文件按约定托管好（或用 `fontsUrl` 指向你的 CDN），标签即可**开箱即用**地显示鸿蒙字体，无需自己再写 `@font-face`；
- 若未托管字体，浏览器会自动回退到 `sans-serif`，仅是字体观感不同，**不影响功能**；
- 注入是幂等的，且在非浏览器（SSR）环境下会自动跳过。

## 构建和发布指南

本文档主要介绍如何构建和发布 bic-map-plugin 到公司内部的 Nexus 仓库。

### 环境准备

确保您的开发环境已安装以下工具:

- Node.js (推荐 v16+)
- pnpm (作为包管理工具)
- Git (用于版本控制)

### pnpm 和 Nexus 仓库配置

本项目使用 **pnpm** 作为包管理工具。项目根目录下的 `.npmrc` 文件已包含仓库配置:

```
# 默认使用淘宝源
registry=https://registry.npmmirror.com/

# 指定组织作用域使用内网 Nexus 源
@x-humanoid-cloud:registry=https://maven.x-humanoid-cloud.com/repository/pnpm-hosted/
//maven.x-humanoid-cloud.com/repository/pnpm-hosted/:_auth=YWRtaW46SGVsbG8xMjM0
//maven.x-humanoid-cloud.com/repository/pnpm-hosted/:always-auth=true
```

这确保了:
1. 所有包默认从淘宝镜像源获取（提高下载速度）
2. 所有 `@x-humanoid-cloud` 作用域的包从内网 Nexus 仓库获取
3. 发布到 `pnpm-hosted` 仓库时使用 `admin:Hello1234` 作为认证凭据

### 构建流程

#### 1. 安装依赖
```bash
pnpm install
```

#### 2. 开发模式
```bash
pnpm dev
```
启动开发服务器，支持热重载。

#### 3. 构建项目
```bash
# 构建 NPM 包版本
pnpm build

# 构建 CDN 版本
pnpm build:cdn

# 构建所有版本（NPM + CDN）
pnpm build:all

# 预览构建结果
pnpm preview
```
   
这将在 `dist` 目录下生成打包文件：
- `dist/` - NPM 包版本文件
- `dist/cdn/` - CDN 版本文件

> **注意**: 库构建（`build` / `build:cdn`）设置了 `publicDir: false`，不会把 `public/` 下的任何资源（含 glyphs、assets）打进产物，以减小发布包体积。glyphs 和 assets 由使用方自行托管，详见上方「静态资源托管说明」。

### 发布流程

#### 使用 pnpm 发布

本项目使用 pnpm 进行包管理和发布。发布前请确保：

1. **构建项目**：
   ```bash
   pnpm build:all
   ```

2. **更新版本号**（可选，也可以在发布时自动更新）：
   ```bash
   # 补丁版本 (1.0.x)
   pnpm version patch
   
   # 次要版本 (1.x.0)
   pnpm version minor
   
   # 主要版本 (x.0.0)
   pnpm version major
   ```

3. **发布到 Nexus 仓库**：
   ```bash
   pnpm publish --no-git-checks --access public
   ```

#### pnpm 发布优势

- **更快的安装速度**：pnpm 使用硬链接和符号链接来避免重复下载
- **节省磁盘空间**：相同版本的包只存储一次
- **严格的依赖管理**：避免幽灵依赖问题
- **与 npm 完全兼容**：支持所有 npm 命令和配置

### 版本管理

项目使用语义化版本管理 (SemVer):

- **补丁版本** (0.0.x): 向后兼容的错误修复
- **次要版本** (0.x.0): 向后兼容的新功能
- **主要版本** (x.0.0): 不兼容的API变更

### 发布注意事项

1. 确保在 `package.json` 中 `publishConfig.registry` 配置正确
2. 确保 `.npmrc` 文件包含正确的认证信息
3. 发布前先在本地测试构建结果
4. 发布前确保所有更改已提交到 Git
5. 由于 glyphs 和 assets 资源较大，构建产物不包含这些文件，使用方需自行托管（见「静态资源托管说明」）

### 常见问题

#### 发布失败

如果遇到以下错误:

1. **413 Request Entity Too Large**: 
   - 优化包大小
   - 联系管理员调整 Nexus 上传限制

2. **401 Unauthorized**:
   - 检查 `.npmrc` 中的认证信息
   - 确认用户有发布权限

3. **409 Conflict**:
   - 版本号已存在，需要更新版本号

## 技术支持

如有问题，请联系: houser.hao@humanoid.com 

## 构建选项

### 标准构建（移除console输出）
```bash
# 构建插件版本（移除console）
npm run build

# 构建CDN版本（移除console）
npm run build:cdn

# 构建所有版本（移除console）
npm run build:all
```

### 调试构建（保留console输出）
```bash
# 构建插件版本（保留console）
npm run build:debug

# 构建CDN版本（保留console）
npm run build:cdn:debug

# 构建所有版本（保留console）
npm run build:all:debug
```

### 环境变量控制
您也可以手动设置环境变量来控制console输出：

```bash
# 保留console输出
KEEP_CONSOLE=true npm run build:cdn

# 移除console输出（默认）
KEEP_CONSOLE=false npm run build:cdn
```

**说明：**
- **标准构建**：生产环境使用，会移除所有的 `console.log`、`console.warn`、`console.info` 和 `debugger` 语句
- **调试构建**：开发和调试时使用，保留所有console输出，便于问题排查
- **环境变量**：`KEEP_CONSOLE=true` 保留console，`KEEP_CONSOLE=false`（默认）移除console

## 使用指南 
后续我们会发布 BicMap 主站，方便示例学习及源码使用。
大家敬请期待！

