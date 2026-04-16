<template>
  <div id="app" :class="{ 'app-loading': isNavigating }">
    <ErrorBoundary @error="handleGlobalError">
      <TransitionWrapper />
      <PageLoading v-if="isNavigating" type="skeleton" />
    </ErrorBoundary>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import TransitionWrapper from '@/components/TransitionWrapper.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import PageLoading from '@/components/PageLoading.vue'
import '@/assets/styles/index.css'

const isNavigating = ref(false)

const handleRouteChangeStart = () => {
  isNavigating.value = true
}

const handleRouteChangeComplete = () => {
  setTimeout(() => {
    isNavigating.value = false
  }, 150)
}

const handleGlobalError = (error) => {
  console.error('[App] 全局错误捕获:', error)
  isNavigating.value = false
}

onMounted(() => {
  window.addEventListener('beforeunload', handleRouteChangeStart)
  window.addEventListener('routeChangeComplete', handleRouteChangeComplete)

  const originalPush = window.history.pushState
  const originalReplace = window.history.replaceState

  window.history.pushState = function(...args) {
    handleRouteChangeStart()
    return original.apply(this, args)
  }

  window.history.replaceState = function(...args) {
    handleRouteChangeStart()
    return originalReplace.apply(this, args)
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleRouteChangeStart)
  window.removeEventListener('routeChangeComplete', handleRouteChangeComplete)
})
</script>

<style>
#app {
  width: 100%;
  height: 100vh;
  position: relative;
}

.app-loading::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.3);
  pointer-events: none;
  z-index: 9999;
  transition: opacity 0.2s ease;
}
</style>
