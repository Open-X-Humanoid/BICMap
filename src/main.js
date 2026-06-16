/*
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-22 19:00:30
 * @LastEditTime: 2025-04-22 19:00:30
 * @LastEditors: houser.hao@humanoid.com
 * @Description: Main entry for development
 * @FilePath: /bic-map-plugin/src/main.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */
import { createApp } from 'vue'
import App from './App.vue'
import BicMapPlugin from './index'
import router from './router'

// Import styles
import './style.css'

// Create and mount the app
const app = createApp(App)
app.use(BicMapPlugin)
app.use(router)
app.mount('#app') 