---
name: vue3-vite-frontend-standards
description: "为 bic-map-plugin（Vue3 + Vite + JS）新增页面/组件时强制执行团队前端开发规范，涵盖 <script setup>、import 四段式顺序、SFC 块内顺序、scss scoped 样式、文件头注释与命名规范。Use when the user mentions `新建页面`, `新增页面`, `新组件`, `new page`, `add view`, `前端规范`, `开发规范`, `Vue3 代码风格`, `import 顺序`, `生命周期顺序`."
---

# vue3-vite-frontend-standards

## Quick Start

在 `src/views/<feature>/index.vue` 或 `src/components/<module>/<Name>.vue` 新建 Vue3 单文件组件，必须使用 `<script setup>` + `<style lang="scss" scoped>`，并严格遵循下列 import / SFC 块内 / 注释 / 样式规范。

## 固定步骤

1. 文件/目录命名：文件夹 `kebab-case`，组件文件 `PascalCase`（页面入口用 `index.vue`），CSS class `kebab-case`，变量/函数 `camelCase`，常量 `UPPER_SNAKE_CASE`
2. 文件顶部加 koroFileHeader 文件头注释，补齐 `@Description` 与 `@FilePath`
3. `<script setup>` 内 import 严格按四段式，段间空一行：
   1) Vue 生态（`vue`、`vue-router`、`pinia`、`@vueuse/core`）
   2) 第三方库（`element-plus`、`lodash` 等，**必须按需引入**）
   3) 自定义组件 / 资源（`@/components/**`、`@/assets/**`）
   4) 工具类（`@/api/**`、`@/utils/**`、`@/hooks/**`、`@/stores/**`）
4. `<script setup>` 内代码按八段式顺序书写：
   import → `defineProps`/`defineEmits` → 响应式状态(ref/reactive) → computed → watch → 生命周期(onMounted...) → methods(业务函数) → `defineExpose`
5. 接口统一放 `src/api/<模块>/index.js`，命名 `get*/post*/put*/delete* + 资源名`，使用 `@/utils/request`，不直接 `axios.xxx`
6. 样式使用 `scss` + `scoped`，布局优先 `flex`；颜色/尺寸优先使用已有 CSS 变量 / scss 变量，不硬编码重复值
7. 导出函数、复杂业务方法加 JSDoc（`@param` / `@returns`）；行内注释只解释"为什么"而非逐行翻译代码
8. 提交前执行 `pnpm lint && pnpm format` 无报错

## 禁止事项

- ❌ 不要使用 Options API 写新代码（`data()` / `methods: {}` / `mounted()`）
- ❌ 不要全量引入：`import _ from 'lodash'`、`import ElementPlus from 'element-plus'`
- ❌ 不要在 `.vue` 里写未 `scoped` 的 `<style>` 或用 `less`/`stylus`/纯 CSS
- ❌ 不要写行内样式 `style="..."`（动态计算值用 `:style` + computed 除外）
- ❌ 不要出现魔法数字/字符串，必须抽取到 `constants.js`
- ❌ 不要写 `// 引入 xxx`、`// i++` 这种水账注释
- ❌ 不要留下 `console.log` 或未跟进的 `TODO`
- ❌ 不要用 `npm` / `yarn` 生成 lockfile，统一 `pnpm`

## 代码示例 / 模板

```
<!--
 * @Author: houser.hao@humanoid.com
 * @Date: Do not edit
 * @LastEditTime: Do not edit
 * @LastEditors: houser.hao@humanoid.com
 * @Description: <一句话描述本文件职责>
 * @FilePath: Do not edit
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="robot-debug">
    <span class="robot-debug__count">{{ total }}</span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import { ElMessage } from 'element-plus'
import { debounce } from 'lodash'

import MapDebug from '@/components/map/MapDebug.vue'

import { getRobotList } from '@/api/robot'
import { formatDate } from '@/utils/date'

const props = defineProps({
  robotId: { type: String, required: true }
})
const emit = defineEmits(['refresh'])

const loading = ref(false)
const list = ref([])

const total = computed(() => list.value.length)

watch(() => props.robotId, (id) => id && fetchList())

onMounted(() => fetchList())
onBeforeUnmount(() => { /* 清理定时器/监听 */ })

/**
 * 拉取机器人列表
 * @returns {Promise<void>}
 */
const fetchList = debounce(async () => {
  loading.value = true
  try {
    list.value = await getRobotList(props.robotId)
  } catch (e) {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}, 300)

defineExpose({ fetchList })
</script>

<style lang="scss" scoped>
.robot-debug {
  display: flex;
  align-items: center;
  gap: 8px;

  &__count { color: var(--el-color-danger); }
}
</style>
```
