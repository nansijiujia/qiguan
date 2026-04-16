import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// 生成版本号（基于时间戳或环境变量）
const generateVersion = () => {
  const timestamp = Date.now()
  const shortHash = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${shortHash}`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProduction = mode === 'production'
  
  // 版本号用于缓存破坏
  const version = env.VITE_APP_VERSION || generateVersion()
  
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
          target: env.VITE_API_BASE_URL || 'http://localhost:3003',
          changeOrigin: true,
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.log('[Proxy Error]', err.message)
            })
            proxy.on('proxyReq', (proxyReq, req, res) => {
              if (!isProduction) {
                console.log(`[Proxy] ${req.method} ${req.url}`)
              }
            })
          }
        }
      }
    },
    base: env.VITE_BASE_PATH || '/',
    
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      
      reportCompressedSize: true,
      
      chunkSizeWarningLimit: 200,
      
      cssCodeSplit: true,
      
      sourcemap: isProduction ? false : 'inline',
      
      target: 'es2020',
      
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : []
        },
        format: {
          comments: false
        }
      },
      
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'element-plus': ['element-plus', '@element-plus/icons-vue'],
            'echarts': ['echarts'],
            'xlsx': ['xlsx']
          },
          
          // 使用内容哈希和版本号实现缓存破坏
          chunkFileNames: `assets/js/[name]-${version}-[hash].js`,
          entryFileNames: `assets/js/[name]-${version}-[hash].js`,
          assetFileNames: (assetInfo) => {
            const extType = assetInfo.name?.split('.').pop() || 'other'
            const extMap = {
              'css': 'styles',
              'png': 'images',
              'jpg': 'images',
              'jpeg': 'images',
              'gif': 'images',
              'svg': 'images',
              'ico': 'icons',
              'woff': 'fonts',
              'woff2': 'fonts',
              'ttf': 'fonts',
              'eot': 'fonts'
            }
            const assetDir = extMap[extType] || 'other'
            return `assets/${assetDir}/[name]-${version}-[hash].[ext]`
          }
        }
      }
    },
    
    // 定义全局常量，可在代码中使用 import.meta.env.VITE_APP_VERSION
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(version)
    },
    
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'pinia',
        'element-plus',
        '@element-plus/icons-vue',
        'axios',
        'echarts'
      ],
      exclude: []
    }
  }
})
