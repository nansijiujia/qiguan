<template>
  <div class="sidebar-container">
    <!-- Logo 区域 -->
    <div class="logo-container">
      <h1 class="logo-text" v-show="!isCollapse">
        <el-icon class="logo-icon-svg"><Shop /></el-icon>
        绮管后台
      </h1>
      <h1 class="logo-icon" v-show="isCollapse">
        <el-icon class="logo-icon-svg"><Shop /></el-icon>
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
      class="sidebar-menu"
    >
      <el-menu-item index="/dashboard">
        <el-icon class="menu-icon"><DataAnalysis /></el-icon>
        <template #title>仪表盘</template>
      </el-menu-item>

      <el-menu-item index="/products">
        <el-icon class="menu-icon"><Goods /></el-icon>
        <template #title>商品管理</template>
      </el-menu-item>

      <el-menu-item index="/categories">
        <el-icon class="menu-icon"><Menu /></el-icon>
        <template #title>分类管理</template>
      </el-menu-item>

      <el-menu-item index="/orders">
        <el-icon class="menu-icon"><Document /></el-icon>
        <template #title>订单管理</template>
      </el-menu-item>

      <el-menu-item index="/customers">
        <el-icon class="menu-icon"><UserFilled /></el-icon>
        <template #title>客户资料管理</template>
      </el-menu-item>

      <el-menu-item index="/coupons">
        <el-icon class="menu-icon"><Ticket /></el-icon>
        <template #title>优惠券管理</template>
      </el-menu-item>

      <el-menu-item index="/content-manage">
        <el-icon class="menu-icon"><Document /></el-icon>
        <template #title>内容管理</template>
      </el-menu-item>
    </el-menu>

    <!-- 折叠按钮 -->
    <div class="collapse-btn" @click="$emit('toggle')">
      <el-icon :size="20" class="collapse-icon">
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
  position: relative;
}

.logo-container {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
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
  transition: all 0.3s ease;
}

.logo-icon {
  font-size: 24px;
  color: #409eff;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.logo-icon-svg {
  font-size: 24px;
  color: #409eff;
  transition: all 0.3s ease;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  padding: 10px 0;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}

.el-menu-item {
  margin: 4px 8px;
  border-radius: 6px;
  height: 48px;
  line-height: 48px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  
  &:hover {
    background-color: rgba(64, 158, 255, 0.1) !important;
    transform: translateX(4px);
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

.menu-icon {
  font-size: 18px;
  transition: all 0.3s ease;
}

.collapse-btn {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #bfcbd9;
  transition: all 0.3s ease;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  
  &:hover {
    color: #409eff;
    background-color: rgba(64, 158, 255, 0.1);
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  }
}

.collapse-icon {
  transition: all 0.3s ease;
  animation: rotate 0.3s ease;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(180deg);
  }
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .sidebar-container {
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.2);
  }
}
</style>