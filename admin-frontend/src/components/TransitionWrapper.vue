<template>
  <router-view v-slot="{ Component, route }">
    <transition
      :name="transitionName"
      mode="out-in"
      @before-enter="beforeEnter"
      @after-enter="afterEnter"
      @before-leave="beforeLeave"
      @after-leave="afterLeave"
    >
      <div :key="route.path" class="route-wrapper">
        <component :is="Component" v-if="Component" />
      </div>
    </transition>
  </router-view>
</template>

<script setup>
import { ref } from 'vue'

const transitionName = ref('fade')

const beforeEnter = (el) => {
  el.style.opacity = '0'
}

const afterEnter = (el) => {
  el.style.opacity = '1'
}

const beforeLeave = (el) => {
  el.style.opacity = '1'
}

const afterLeave = (el) => {
  el.style.opacity = '0'
}
</script>

<style scoped>
.route-wrapper {
  width: 100%;
  min-height: calc(100vh - 84px);
}

/* Fade 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}
</style>
