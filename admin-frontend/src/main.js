import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './assets/styles/index.css'
import './assets/styles/common.css'

import service from './utils/request'
import { reportErrorToServer } from './services/error-reporter'
import { initLogger, logAction } from './utils/logger'
import { initGlobalErrorHandler, setupVueErrorHandler } from './utils/error-handler-enhanced'

const app = createApp(App)
const pinia = createPinia()

app.config.globalProperties.$http = service

initGlobalErrorHandler()
setupVueErrorHandler(app)

initLogger()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
