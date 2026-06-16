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