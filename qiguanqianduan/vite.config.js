/**
 * Vite 配置文件
 * 
 * ⚠️ 重要说明 - base 路径配置：
 * base 路径决定了构建后所有静态资源（JS、CSS、图片等）的引用前缀。
 * 如果 base 设置不正确，会导致：
 *   1. 页面白屏（资源 404）
 *   2. 资源加载失败
 *   3. 与 Nginx/服务器配置不匹配
 * 
 * 解决方案：通过环境变量 VITE_BASE_PATH 动态配置，默认为根路径 '/'
 */
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: 8080,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:3000',
          changeOrigin: true
        }
      }
    },
    base: process.env.VITE_BASE_PATH || '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      },
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'element-plus': ['element-plus', '@element-plus/icons-vue'],
            'echarts': ['echarts'],
            'xlsx': ['xlsx']
          },
          compact: true,
          hoistTransitiveImports: true
        }
      }
    },
    optimizeDeps: {
      include: ['vue', 'vue-router', 'pinia', 'element-plus', 'echarts', 'axios', 'xlsx'],
      exclude: [],
      force: true
    }
  }
})