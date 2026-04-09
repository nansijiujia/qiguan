module.exports = {
  apps: [{
    name: 'qiguan-backend',
    script: 'index.js',
    
    // 工作目录
    cwd: '/var/www/qiguan',
    
    // 实例数量（根据CPU核心数调整）
    instances: 1,
    exec_mode: 'fork',
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_TYPE: 'mysql',
      DB_HOST: '10.0.0.16',
      DB_PORT: 3306,
      DB_USER: 'QMZYXCX',
      DB_PASSWORD: 'LJN040821.',
      DB_NAME: 'qmzyxcx',
      JWT_SECRET: 'qiguan-production-secret-key-2026-change-me-at-least-32-characters-long'
    },
    
    // 日志配置
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/qiguan/pm2-error.log',
    out_file: '/var/log/qiguan/pm2-out.log',
    merge_logs: true,
    
    // 内存和CPU限制
    max_memory_restart: '500M',
    max_restarts: 10,
    
    // 自动重启延迟
    restart_delay: 3000,
    
    // 监听文件变化（开发环境用，生产环境建议关闭）
    watch: false,
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
