/**
 * PM2 生态系统配置文件 - 生产环境优化版
 * @version 3.0
 * @description 包含完整的进程管理、日志配置、监控和告警设置
 */

module.exports = {
  apps: [{
    name: 'qimeng-api',
    script: './index.js',
    
    // ============================================================
    // 环境变量配置
    // ============================================================
    env: {
      NODE_ENV: 'development',
      PORT: 3003,
      SLOW_REQUEST_THRESHOLD: '2000',
      LOG_LEVEL: 'debug'
    },
    
    env_production: {
      NODE_ENV: 'production',
      PORT: 3003,
      SLOW_REQUEST_THRESHOLD: '2000',
      LOG_LEVEL: 'info'
    },
    
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 3003,
      SLOW_REQUEST_THRESHOLD: '1500',
      LOG_LEVEL: 'warn'
    },
    
    // ============================================================
    // 进程管理配置
    // ============================================================
    instances: 1,                    // 单实例模式（如需集群可改为 'max' 或 CPU核心数）
    exec_mode: 'fork',               // fork模式（cluster模式用 'cluster'）
    autorestart: true,               // 崩溃后自动重启
    max_restarts: 10,                // 最大重启次数（1小时内）
    min_uptime: '10s',              // 最小运行时间（低于此时间崩溃不计入restart次数）
    restart_delay: 4000,            // 重启延迟（毫秒）
    kill_timeout: 5000,             // 强制终止超时（毫秒）
    listen_timeout: 10000,          // 启动监听超时
    
    // ============================================================
    // 内存和资源限制
    // ============================================================
    max_memory_restart: '512M',     // 超过512MB自动重启
    max_old_space_size: 512,        // V8堆内存上限（MB）
    
    // ============================================================
    // 日志配置
    // ============================================================
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,               // 合并所有实例的日志
    log_type: 'json',              // JSON格式日志（便于解析）
    
    // ============================================================
    // 进程管理增强
    // ============================================================
    wait_ready: true,              // 等待就绪信号
    ready_signal: 'SIGUSR2',       // 就绪信号类型
    shutdown_with_message: false,   // 不使用消息关闭
    
    // ============================================================
    // 源码映射（便于调试）
    // ============================================================
    source_map_support: true,       // 启用Source Map支持
    
    // ============================================================
    // 部署配置
    // ============================================================
    deploy: {
      production: {
        user: 'node',
        host: ['192.168.1.100'],
        ref: 'origin/main',
        repo: 'git@github.com:user/qimeng-backend.git',
        path: '/var/www/qimeng-api',
        'pre-deploy': 'git fetch origin',
        'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
        env: {
          NODE_ENV: 'production'
        }
      }
    },
    
    // ============================================================
    // 监控配置
    // ============================================================
    watch: false,                   // 生产环境关闭文件监听
    ignore_watch: [
      'node_modules',
      'logs',
      'uploads',
      'dist',
      '.git'
    ],
    
    // ============================================================
    // 实例间通信（cluster模式下使用）
    // ============================================================
    instance_var: 'INSTANCE_ID',   // 环境变量名，用于标识实例ID
    
    // ============================================================
    // 自动化运维脚本
    // ============================================================
    post_update: ['npm install'],  // 更新后执行
    
    // ============================================================
    // 健康检查配置
    // ============================================================
    health_check_grace_period: 5000, // 健康检查宽限期
  }],
  
  // ============================================================
  // 部署配置
  // ============================================================
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-org/qimeng-ecommerce.git',
      path: '/var/www/qimeng-api',
      'pre-setup': 'apt-get install git || true',
      'post-setup': '',
      'pre-deploy-local': '',
      'post-deploy': 
        'npm ci --production && ' +
        'pm2 reload ecosystem.config.js --env production && ' +
        'pm2 save',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};

/**
 * 使用说明：
 * 
 * 1. 启动生产环境：
 *    pm2 start ecosystem.config.js --env production
 * 
 * 2. 查看进程状态：
 *    pm2 list
 *    pm2 show qimeng-api
 * 
 * 3. 查看实时日志：
 *    pm2 logs qimeng-api
 *    pm2 logs qimeng-api --err (仅错误)
 *    pm2 logs qimeng-api --lines 100 (最近100行)
 * 
 * 4. 重启服务：
 *    pm2 restart qimeng-api
 *    pm2 reload qimeng-api (零停机重启)
 * 
 * 5. 停止服务：
 *    pm2 stop qimeng-api
 * 
 * 6. 删除进程：
 *    pm2 delete qimeng-api
 * 
 * 7. 监控仪表盘：
 *    pm2 monit
 * 
 * 8. 日志轮转配置（需要安装 pm2-logrotate）：
 *    pm2 install pm2-logrotate
 *    pm2 set pm2-logrotate:max_size 10M
 *    pm2 set pm2-logrotate:retain 30
 *    pm2 set pm2-logrotate:compress true
 *    pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
 * 
 * 9. 性能监控：
 *    pm2 show qimeng-api (查看详细状态)
 *    curl http://localhost:3003/api/v1/health/metrics (查看请求指标)
 * 
 * 10. 应急操作：
 *     pm2 flush (清空所有日志)
 *     pm2 reset qimeng-api (重置计数器)
 */
