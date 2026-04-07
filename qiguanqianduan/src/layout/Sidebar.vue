<template>
  <div class="sidebar-container">
    <!-- Logo 区域 -->
    <div class="logo-container">
      <h1 class="logo-text" v-show="!isCollapse">
        <el-icon><Shop /></el-icon>
        绮管后台
      </h1>
      <h1 class="logo-icon" v-show="isCollapse">
        <el-icon><Shop /></el-icon>
      </h1>
    </div>

    <!-- 导航菜单 -->
    <el-menu
      :default-active="activeMenu"
      :collapse="isCollapse"
      :unique-opened="true"
      background-color="#181824"
      text-color="#bfcbd9"
      active-text-color="#409eff"
      router
    >
      <el-menu-item index="/dashboard">
        <el-icon><DataAnalysis /></el-icon>
        <template #title>仪表盘</template>
      </el-menu-item>

      <el-menu-item index="/products">
        <el-icon><Goods /></el-icon>
        <template #title>商品管理</template>
      </el-menu-item>

      <el-menu-item index="/categories">
        <el-icon><Menu /></el-icon>
        <template #title>分类管理</template>
      </el-menu-item>

      <el-menu-item index="/orders">
        <el-icon><Document /></el-icon>
        <template #title>订单管理</template>
      </el-menu-item>

      <el-menu-item index="/users">
        <el-icon><User /></el-icon>
        <template #title>用户管理</template>
      </el-menu-item>
    </el-menu>

    <!-- 折叠按钮 -->
    <div class="collapse-btn" @click="$emit('toggle')">
      <el-icon :size="20">
        <Fold v-if="!isCollapse" />
        <Expand v-else />
      </el-icon>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

defineProps({
  isCollapse: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle'])

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style scoped>
.sidebar-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #181824;
}

.logo-container {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-text {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 24px;
  color: #409eff;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.el-menu {
  flex: 1;
  border-right: none;
  padding: 10px 0;
}

.el-menu-item {
  margin: 4px 8px;
  border-radius: 6px;
  height: 48px;
  line-height: 48px;
  
  &:hover {
    background-color: rgba(64, 158, 255, 0.1) !important;
  }

  &.is-active {
    background-color: rgba(64, 158, 255, 0.15) !important;
    
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 24px;
      background-color: #409eff;
      border-radius: 0 2px 2px 0;
    }
  }
}

.collapse-btn {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #bfcbd9;
  transition: all 0.3s;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  
  &:hover {
    color: #409eff;
    background-color: rgba(64, 158, 255, 0.1);
  }
}
</style>