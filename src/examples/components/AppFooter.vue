<!--
 * @Description: 公共底部 Footer 组件
 * 支持 props:
 *   leftButtons  - 左侧按钮数组 [{ label, active, icon, onClick }]
 *   rightButtons - 右侧按钮数组（可选）
 * 支持 slot:
 *   #left  - 完全自定义左侧内容（覆盖 leftButtons）
 *   #right - 完全自定义右侧内容（覆盖 rightButtons）
-->
<template>
  <footer class="footer-bar">
    <div class="footer-bg"></div>
    <div class="footer-line"></div>
    <div class="footer-line-glow"></div>

    <!-- 第一行：功能按钮区 -->
    <div class="footer-content">
      <div class="footer-left">
        <slot name="left">
          <TechButton
            v-for="(btn, i) in leftButtons"
            :key="i"
            :label="btn.label"
            :active="btn.active || false"
            :disabled="btn.disabled || false"
            @click="btn.onClick"
          >
            <template v-if="btn.icon" #icon>
              <component :is="btn.icon" :size="16" />
            </template>
          </TechButton>
        </slot>
      </div>

      <div class="footer-right" v-if="rightButtons.length || $slots.right">
        <slot name="right">
          <TechButton
            v-for="(btn, i) in rightButtons"
            :key="i"
            :label="btn.label"
            :active="btn.active || false"
            :disabled="btn.disabled || false"
            @click="btn.onClick"
          >
            <template v-if="btn.icon" #icon>
              <component :is="btn.icon" :size="16" />
            </template>
          </TechButton>
        </slot>
      </div>
    </div>

    <!-- 第二行：版权声明 & ICP备案（独立行，不与按钮区混叠） -->
    <div class="footer-beian">
      <span>Copyright © 2026 北京人形机器人创新中心 版权所有 All Rights Reserved.</span>
      <span class="footer-beian__sep">|</span>
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        class="footer-beian__link"
      >京ICP备2024078606号-2</a>
    </div>
  </footer>
</template>

<script setup>
import TechButton from './TechButton.vue'

/**
 * 按钮配置项类型：
 * {
 *   label:   string,          // 按钮文字
 *   active:  boolean,         // 是否选中状态，默认 false
 *   icon:    Component,       // Lucide 或其他 Vue 组件，可选
 *   onClick: () => void       // 点击回调
 * }
 */
defineProps({
  leftButtons:  { type: Array, default: () => [] },
  rightButtons: { type: Array, default: () => [] }
})
</script>

<style scoped>
.footer-bar {
  position: relative;
  z-index: 20;
  flex-shrink: 0;
  /* 去掉 delay：both + delay 会在延迟窗口内让元素卡在 opacity:0，
     bfcache / HMR 恢复时动画不重播导致按钮不可见 */
  animation: slide-in-bottom 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.footer-bg {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(240,248,255,0.92) 0%, rgba(224,242,254,0.88) 40%, rgba(230,240,255,0.90) 100%);
  backdrop-filter: blur(20px);
}
.footer-line {
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent 5%, #06b6d4 20%, #3b82f6 40%, #137af5 60%, #06b6d4 80%, transparent 95%);
}
.footer-line-glow {
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent 5%, rgba(6,182,212,0.12) 30%, rgba(59,130,246,0.10) 50%, rgba(6,182,212,0.12) 70%, transparent 95%);
  filter: blur(3px);
}
.footer-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
}
.footer-left  { display: flex; align-items: center; gap: 12px; }
.footer-right { display: flex; align-items: center; gap: 12px; }

/* 版权备案行 */
.footer-beian {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 4px 24px 8px;
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  border-top: 1px solid rgba(14, 165, 233, 0.08);
}
.footer-beian__sep {
  opacity: 0.35;
}
.footer-beian__link {
  color: #94a3b8;
  text-decoration: none;
  transition: color 0.18s;
}
.footer-beian__link:hover {
  color: #1d81f5;
}

@keyframes slide-in-bottom {
  from { opacity: 0; }
  to   { opacity: 1; }
}
</style>
