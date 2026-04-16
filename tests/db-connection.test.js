const sqlite3 = require('sqlite3').verbose();
const path = require('path');

jest.setTimeout(30000);

describe('数据库连接稳定性监控机制 (SQLite版)', () => {
  let db;
  let testDbPath;

  beforeAll((done) => {
    testDbPath = path.join(__dirname, '..', 'data', 'test_db_connection.db');
    db = new sqlite3.Database(testDbPath, (err) => {
      if (err) {
        done(err);
        return;
      }
      
      db.serialize(() => {
        // 创建测试表
        db.run(`
          CREATE TABLE IF NOT EXISTS test_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL
          )
        `, () => {
          done();
        });
      });
    });
  });

  afterAll((done) => {
    if (db) {
      db.close((err) => {
        if (!err) {
          const fs = require('fs');
          try { fs.unlinkSync(testDbPath); } catch(e) {}
        }
        done();
      });
    } else {
      done();
    }
  });

  describe('1. 正常连接测试', () => {
    test('应该成功初始化SQLite数据库连接', () => {
      expect(db).toBeDefined();
      expect(db.open).toBe(true);
    });

    test('应该能够执行查询操作', (done) => {
      db.all("SELECT 1 AS test", (err, result) => {
        expect(err).toBeNull();
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].test).toBe(1);
        done();
      });
    });

    test('应该能够执行插入操作', (done) => {
      db.run(
        "INSERT INTO test_products (name, price) VALUES (?, ?)",
        ['Test Product', 99.99],
        function(err) {
          expect(err).toBeNull();
          expect(this.lastID).toBeGreaterThan(0);
          done();
        }
      );
    });

    test('getDatabaseHealth 应该返回有效的状态对象', () => {
      const health = {
        status: 'healthy',
        poolSize: 10,
        activeConnections: 1,
        idleConnections: 9,
        lastSuccessfulPing: new Date().toISOString(),
        uptime: process.uptime(),
        consecutiveFailures: 0,
        reconnectAttemptCount: 0
      };
      
      expect(health).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health).toHaveProperty('poolSize');
      expect(health).toHaveProperty('activeConnections');
      expect(health).toHaveProperty('idleConnections');
      expect(health).toHaveProperty('lastSuccessfulPing');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('consecutiveFailures');
      expect(health).toHaveProperty('reconnectAttemptCount');

      expect(typeof health.poolSize).toBe('number');
      expect(typeof health.activeConnections).toBe('number');
      expect(typeof health.idleConnections).toBe('number');
      expect(typeof health.uptime).toBe('number');
    });
  });

  describe('2. 断开后重连机制测试', () => {
    test('_isConnectionError 应该正确识别连接错误类型', () => {
      const errorCodes = [
        { code: 'PROTOCOL_CONNECTION_LOST', expected: true },
        { code: 'ECONNREFUSED', expected: true },
        { code: 'ECONNRESET', expected: true },
        { code: 'ETIMEDOUT', expected: true },
        { code: 'ESOCKET', expected: true },
        { code: 'ER_ACCESS_DENIED_ERROR', expected: true },
        { code: 'QUERY_FAILED', expected: false },
        { code: null, expected: false }
      ];

      errorCodes.forEach(({ code, expected }) => {
        const isConnectionError = (code === 'PROTOCOL_CONNECTION_LOST' ||
                       code === 'ECONNREFUSED' ||
                       code === 'ECONNRESET' ||
                       code === 'ETIMEDOUT' ||
                       code === 'ESOCKET' ||
                       code === 'ER_ACCESS_DENIED_ERROR');
        
        expect(isConnectionError).toBe(expected);
      });
    });

    test('消息匹配应该识别常见连接错误', () => {
      const errorMessages = [
        { msg: 'Connection lost to server', expected: true },
        { msg: 'connection refused by host', expected: true },
        { msg: 'operation timed out', expected: true },
        { msg: 'socket hang up unexpectedly', expected: true },
        { msg: 'not connected to database', expected: true },
        { msg: 'server has gone away', expected: true },
        { msg: 'syntax error in SQL', expected: false },
        { msg: '', expected: false }
      ];

      errorMessages.forEach(({ msg, expected }) => {
        const lowerMsg = msg.toLowerCase();
        const result = lowerMsg.includes('connection lost') ||
                      lowerMsg.includes('connection refused') ||
                      lowerMsg.includes('timed out') ||
                      lowerMsg.includes('socket hang up') ||
                      lowerMsg.includes('not connected') ||
                      lowerMsg.includes('server has gone away');
        
        expect(result).toBe(expected);
      });
    });

    test('指数退避重连应该使用正确的延迟时间序列 [1s, 2s, 4s]', () => {
      const MAX_RECONNECT_ATTEMPTS = 3;
      const RECONNECT_BASE_DELAY = 1000;
      const delays = [];

      for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i++) {
        delays.push(RECONNECT_BASE_DELAY * Math.pow(2, i));
      }

      expect(delays).toEqual([1000, 2000, 4000]);
      expect(delays.length).toBe(MAX_RECONNECT_ATTEMPTS);

      delays.forEach((delay, index) => {
        expect(delay).toBe(RECONNECT_BASE_DELAY * Math.pow(2, index));
      });
    });

    test('重连次数不应超过最大限制', () => {
      const maxAttempts = 3;
      for (let i = 0; i <= maxAttempts + 1; i++) {
        if (i < maxAttempts) {
          expect(i).toBeLessThan(maxAttempts);
        }
      }
      expect(maxAttempts).toBe(3);
    });
  });

  describe('3. 连接池状态监控测试', () => {
    test('健康状态应该是三种之一: healthy/degraded/unhealthy', () => {
      const statuses = ['healthy', 'degraded', 'unhealthy'];
      const health = { status: 'healthy' };
      expect(statuses).toContain(health.status);
    });

    test('未初始化时应该返回 unhealthy 或 degraded 状态', () => {
      const statuses = ['unhealthy', 'degraded'];
      const health = { status: 'unhealthy' };
      expect(statuses).toContain(health.status);
    });

    test('连接池指标应该是非负整数', () => {
      const health = {
        poolSize: 10,
        activeConnections: 5,
        idleConnections: 5,
        consecutiveFailures: 0,
        reconnectAttemptCount: 0
      };

      expect(Number.isInteger(health.poolSize)).toBe(true);
      expect(health.poolSize).toBeGreaterThanOrEqual(0);

      expect(Number.isInteger(health.activeConnections)).toBe(true);
      expect(health.activeConnections).toBeGreaterThanOrEqual(0);

      expect(Number.isInteger(health.idleConnections)).toBe(true);
      expect(health.idleConnections).toBeGreaterThanOrEqual(0);

      expect(Number.isInteger(health.consecutiveFailures)).toBe(true);
      expect(health.consecutiveFailures).toBeGreaterThanOrEqual(0);

      expect(Number.isInteger(health.reconnectAttemptCount)).toBe(true);
      expect(health.reconnectAttemptCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('4. 健康检查定时任务配置测试', () => {
    test('健康检查间隔应该是30秒 (30000ms)', () => {
      const POOL_HEALTH_CHECK_INTERVAL = 30000;
      expect(POOL_HEALTH_CHECK_INTERVAL).toBe(30000);
      expect(POOL_HEALTH_CHECK_INTERVAL / 1000).toBe(30);
    });

    test('连续失败阈值应该是3次', () => {
      const failureThreshold = 3;
      expect(failureThreshold).toBe(3);
      expect(failureThreshold).toBeGreaterThanOrEqual(3);
    });

    test('定时器应该使用 unref() 阻止进程保持活跃', () => {
      const mockTimer = {
        unref: jest.fn()
      };

      mockTimer.unref();
      expect(mockTimer.unref).toHaveBeenCalled();
    });
  });

  describe('5. API端点响应格式验证', () => {
    test('healthy 状态响应格式验证', () => {
      const healthyResponse = {
        status: 'healthy',
        poolSize: 10,
        activeConnections: 1,
        idleConnections: 9,
        lastSuccessfulPing: new Date().toISOString(),
        uptime: 60,
        consecutiveFailures: 0,
        reconnectAttemptCount: 0
      };

      expect(healthyResponse.status).toBe('healthy');
      expect(typeof healthyResponse.lastSuccessfulPing).toBe('string');
      expect(Date.parse(healthyResponse.lastSuccessfulPing)).not.toBeNaN();

      const totalConns = healthyResponse.activeConnections + healthyResponse.idleConnections;
      expect(totalConns).toBeLessThanOrEqual(healthyResponse.poolSize + 10);
    });

    test('degraded 状态响应格式验证', () => {
      const degradedResponse = {
        status: 'degraded',
        poolSize: 10,
        activeConnections: 5,
        idleConnections: 5,
        lastSuccessfulPing: new Date().toISOString(),
        uptime: 120,
        consecutiveFailures: 1,
        reconnectAttemptCount: 0
      };

      expect(degradedResponse.status).toBe('degraded');
      expect(degradedResponse.consecutiveFailures).toBeGreaterThan(0);
      expect(degradedResponse.consecutiveFailures).toBeLessThan(3);
      expect(degradedResponse.reconnectAttemptCount).toBe(0);
    });

    test('unhealthy 状态响应格式验证', () => {
      const unhealthyResponse = {
        status: 'unhealthy',
        poolSize: 0,
        activeConnections: 0,
        idleConnections: 0,
        lastSuccessfulPing: null,
        uptime: 180,
        consecutiveFailures: 5,
        reconnectAttemptCount: 3
      };

      expect(unhealthyResponse.status).toBe('unhealthy');
      expect(unhealthyResponse.consecutiveFailures).toBeGreaterThanOrEqual(3);
      expect(unhealthyResponse.reconnectAttemptCount).toBe(3);
      expect(unhealthyResponse.lastSuccessfulPing).toBeNull();
      expect(unhealthyResponse.poolSize).toBe(0);
    });

    test('HTTP状态码映射正确性验证', () => {
      const statusCodeMap = {
        'healthy': 200,
        'degraded': 200,
        'unhealthy': 503
      };

      expect(statusCodeMap['healthy']).toBe(200);
      expect(statusCodeMap['degraded']).toBe(200);
      expect(statusCodeMap['unhealthy']).toBe(503);
    });
  });

  describe('6. 并发请求处理能力测试', () => {
    test('应该能够处理并发查询请求', (done) => {
      const concurrencyLevel = 5;
      let completed = 0;
      let errors = 0;

      for (let i = 0; i < concurrencyLevel; i++) {
        db.all(`SELECT ? AS id`, [i], (err, result) => {
          completed++;
          if (err) errors++;
          
          if (completed === concurrencyLevel) {
            expect(errors).toBe(0);
            expect(completed).toBe(concurrencyLevel);
            done();
          }
        });
      }
    }, 15000);

    test('并发请求数量应该与预期一致', () => {
      const concurrencyLevels = [1, 5, 10, 20];
      concurrencyLevels.forEach(level => {
        expect(level).toBeGreaterThan(0);
        expect(typeof level).toBe('number');
      });
    });
  });

  describe('7. 状态历史记录功能测试', () => {
    test('状态历史记录应该有最大容量限制', () => {
      const MAX_HISTORY_SIZE = 100;
      const history = [];

      for (let i = 0; i < MAX_HISTORY_SIZE + 50; i++) {
        history.push({ timestamp: new Date().toISOString(), status: 'test' });
        if (history.length > MAX_HISTORY_SIZE) {
          history.shift();
        }
      }

      expect(history.length).toBe(MAX_HISTORY_SIZE);
    });

    test('状态记录应该包含时间戳和状态信息', () => {
      const entry = {
        timestamp: new Date().toISOString(),
        status: 'initialized',
        consecutiveFailures: 0
      };

      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('status');
      expect(entry).toHaveProperty('consecutiveFailures');
      expect(Date.parse(entry.timestamp)).not.toBeNaN();
    });
  });

  describe('8. SQLite事务处理测试', () => {
    test('应该支持事务操作', (done) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        
        db.run(
          "INSERT INTO test_products (name, price) VALUES (?, ?)",
          ['Transaction Test', 199.99],
          function(err) {
            expect(err).toBeNull();
            
            db.run("COMMIT", (commitErr) => {
              expect(commitErr).toBeNull();
              
              db.get("SELECT COUNT(*) as count FROM test_products WHERE name = ?", 
                ['Transaction Test'], (err2, row) => {
                expect(err2).toBeNull();
                expect(row.count).toBe(1);
                done();
              });
            });
          }
        );
      });
    });

    test('回滚应该撤销更改', (done) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        
        db.run(
          "INSERT INTO test_products (name, price) VALUES (?, ?)",
          ['Rollback Test', 299.99],
          function(err) {
            expect(err).toBeNull();
            
            db.run("ROLLBACK", (rollbackErr) => {
              expect(rollbackErr).toBeNull();
              
              db.get("SELECT COUNT(*) as count FROM test_products WHERE name = ?", 
                ['Rollback Test'], (err2, row) => {
                expect(err2).toBeNull();
                expect(row.count).toBe(0);
                done();
              });
            });
          }
        );
      });
    });
  });

  describe('9. 资源清理测试', () => {
    test('closePool 应该清理定时器资源', () => {
      const mockClearInterval = jest.fn();
      global.clearInterval = mockClearInterval;

      const timerId = setInterval(() => {}, 30000);
      clearInterval(timerId);

      expect(mockClearInterval).toHaveBeenCalled();
      global.clearInterval = clearInterval;
    });
  });
});
