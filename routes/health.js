const express = require('express');
const { query } = require('../db-unified');
const { isDbReady, getDbStatus, getDatabaseHealth } = require('../db-unified');
const { asyncHandler } = require('../middleware/errorHandler');
const { getRequestStats } = require('../middleware/request-logger-enhanced');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const dbStatus = getDbStatus();
    res.json({
      status: isDbReady() ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: 'v4.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      },
      database: {
        ready: dbStatus.isInitialized,
        type: dbStatus.dbType,
        host: dbStatus.host,
        name: dbStatus.database,
        lastError: dbStatus.lastError
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/db-test', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'DB_NOT_READY',
          message: '数据库未初始化，请检查启动日志',
          suggestion: '确保 initPool() 在服务启动时被正确调用'
        }
      });
    }

    const result = await query('SELECT 1 AS test');
    if (result && result.length > 0) {
      res.json({ success: true, message: 'Database connection is healthy' });
    } else {
      res.status(500).json({ success: false, message: 'Database connection failed' });
    }
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      error: {
        code: error.code || 'DB_TEST_FAILED',
        message: error.message || 'Database connection error',
        statusCode: status
      }
    });
  }
});

router.get('/database', async (req, res) => {
  try {
    const healthData = await getDatabaseHealth();
    const httpStatus = healthData.status === 'healthy' ? 200 :
                       healthData.status === 'degraded' ? 200 : 503;
    res.status(httpStatus).json(healthData);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      poolSize: 0,
      activeConnections: 0,
      idleConnections: 0,
      lastSuccessfulPing: null,
      uptime: 0,
      error: error.message || 'Failed to get database health status'
    });
  }
});

router.get('/detailed', asyncHandler(async (req, res) => {
  const checks = {};
  
  try {
    const start = Date.now();
    await query('SELECT 1');
    checks.database = { 
      status: 'ok', 
      latency_ms: Date.now() - start 
    };
  } catch (err) {
    checks.database = { 
      status: 'error', 
      error: err.message,
      latency_ms: -1
    };
  }
  
  const memUsage = process.memoryUsage();
  checks.memory = {
    status: memUsage.heapUsed > 500 * 1024 * 1024 ? 'warning' : 'ok',
    used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
    total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
    rss_mb: Math.round(memUsage.rss / 1024 / 1024)
  };
  
  checks.process = {
    uptime_seconds: Math.floor(process.uptime()),
    pid: process.pid,
    node_version: process.version
  };
  
  const overallStatus = Object.values(checks).some(c => c.status === 'error') 
    ? 'error' 
    : Object.values(checks).some(c => c.status === 'warning') 
      ? 'degraded' 
      : 'ok';
  
  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks
  });
}));

router.get('/metrics', (req, res) => {
  const requestStats = getRequestStats();
  const memUsage = process.memoryUsage();
  
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
    node_version: process.version,
    
    request_metrics: {
      ...requestStats,
      slow_request_threshold_ms: parseInt(process.env.SLOW_REQUEST_THRESHOLD) || 2000
    },
    
    memory: {
      rss_mb: Math.round(memUsage.rss / 1024 / 1024),
      heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
      external_mb: Math.round(memUsage.external / 1024 / 1024)
    },
    
    cpu: {
      usage: process.cpuUsage()
    }
  });
});

module.exports = router;
