module.exports = {
  apps: [
    // ============================================================
    // 应用1: Node.js 后端 API 服务
    // ============================================================
    {
      name: 'qiguan-backend',
      script: './index.js',
      
      // 实例配置
      instances: 1,           // 单实例（数据库连接池考虑）
      exec_mode: 'fork',      // fork模式（调试方便）

      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },

      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/qiguan/backend-error.log',
      out_file: '/var/log/qiguan/backend-out.log',
      merge_logs: true,
      log_type: 'json',

      // 内存和CPU限制
      max_memory_restart: '256M',   // 内存超限自动重启
      min_uptime: '10s',
      max_restarts: 10,

      // 优雅关闭
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // 自动重启
      autorestart: true,
      restart_delay: 4000,

      // Node.js 参数
      node_args: '--max-old-space-size=256',
      
      // 源码映射
      source_map_support: true
    }
    
    // ============================================================
    // 应用2: 前端静态文件服务（可选，如果需要Node服务静态文件）
    // 注意：通常前端由Nginx直接托管，不需要这个应用
    // 如果你的后台管理系统有SSR需求才启用此配置
    /*
    {
      name: 'qiguan-admin-frontend',
      script: './serve-static.js',  // 需要创建这个脚本
      
      cwd: '/var/www/admin',
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080,
        STATIC_DIR: './dist'
      },
      
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/qiguan/admin-error.log',
      out_file: '/var/log/qiguan/admin-out.log',
      merge_logs: true,
      
      max_memory_restart: '128M',
      autorestart: true,
      watch: false
    }
    */
  ],

  // ============================================================
  # PM2 全局部署配置
  // ============================================================
  deploy: {
    production: {
      user: 'www-data',
      host: ['your-server-ip'],  // 替换为你的服务器IP
      ref: 'origin/main',
      repo: 'https://github.com/nansijiujia/qiguan.git',
      path: '/www/wwwroot/qiguan-backend',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 
        'npm install && ' +
        'cd qiguanqianduan && npm install && npm run build && cd .. && ' +
        'pm2 reload ecosystem.config.dual.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
