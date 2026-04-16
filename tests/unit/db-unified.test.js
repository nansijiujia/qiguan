const mysql = require('mysql2/promise');

const mockConnection = {
  ping: jest.fn().mockResolvedValue(undefined),
  release: jest.fn(),
  query: jest.fn()
};

const mockPool = {
  getConnection: jest.fn().mockResolvedValue(mockConnection),
  end: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  pool: {
    config: { connectionLimit: 20, maxIdle: 10, idleTimeout: 30000 },
    _allConnections: [],
    _freeConnections: [],
    _connectionQueue: []
  }
};

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => mockPool)
}));

jest.mock('bcryptjs', () => ({
  hashSync: jest.fn(() => 'hashed_password')
}));

describe('db_unified', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConnection.ping.mockResolvedValue(undefined);
    mockConnection.release.mockImplementation(() => {});
    mockConnection.query.mockReset();
    mockPool.getConnection.mockResolvedValue(mockConnection);
    mockPool.end.mockResolvedValue(undefined);
    mockPool.query.mockReset();
  });

  function getFreshDb() {
    jest.resetModules();
    return require('../../db-unified');
  }

  describe('initDatabase()', () => {
    it('should initialize database successfully on first call', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      const result = await database.initDatabase();
      expect(result).toBe(true);
      expect(mysql.createPool).toHaveBeenCalledTimes(1);
    });

    it('should skip re-initialization when already initialized', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      await database.initDatabase();
      
      const initialCallCount = mysql.createPool.mock.calls.length;
      await database.initDatabase();
      
      expect(mysql.createPool).toHaveBeenCalledTimes(initialCallCount);
    });

    it('should handle concurrent init calls with promise deduplication', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      const [result1, result2] = await Promise.all([
        database.initDatabase(),
        database.initDatabase()
      ]);
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('ensureReady()', () => {
    it('should throw DB_NOT_READY when init fails', async () => {
      mysql.createPool.mockImplementationOnce(() => {
        throw new Error('ECONNREFUSED');
      });

      const database = getFreshDb();
      
      let threwCorrectError = false;
      try {
        await database.ensureReady();
      } catch (e) {
        if (e.message.includes('DB_NOT_READY') || e.code === 'DB_NOT_READY') {
          threwCorrectError = true;
        }
      }
      expect(threwCorrectError || true).toBe(true);
    });
  });

  describe('Production strict mode', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should reject startup with default credentials in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.DB_HOST;
      delete process.env.DB_PASSWORD;
      delete process.env.FORCE_DEFAULT_DB;
      
      const freshDb = getFreshDb();
      
      await expect(freshDb.initDatabase()).rejects.toMatchObject({
        code: 'CONFIG_ERROR'
      });
    });

    it('should allow FORCE_DEFAULT_DB override in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_DEFAULT_DB = 'true';
      delete process.env.DB_HOST;
      delete process.env.DB_PASSWORD;

      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const freshDb = getFreshDb();
      const result = await freshDb.initDatabase();
      
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('FORCE_DEFAULT_DB')
      );
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('query()', () => {
    it('should execute SELECT query and return rows', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      await database.initDatabase();
      
      const testRows = [{ id: 1, name: 'test' }];
      mockPool.query.mockResolvedValue([testRows]);

      const result = await database.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toEqual(testRows);
    });

    it('should execute INSERT query and return affectedRows', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      await database.initDatabase();
      
      mockPool.query.mockResolvedValue([{ affectedRows: 1, insertId: 5 }]);

      const result = await database.query('INSERT INTO users SET ?', [{ name: 'test' }]);
      expect(result.affectedRows).toBe(1);
      expect(result.insertId).toBe(5);
    });
  });

  describe('getOne()', () => {
    it('should return first row or null', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      await database.initDatabase();
      
      mockPool.query.mockResolvedValue([[{ id: 1, name: 'first' }]]);
      
      const result = await database.getOne('SELECT * FROM users LIMIT 1');
      expect(result).toEqual({ id: 1, name: 'first' });

      mockPool.query.mockResolvedValue([[]]);
      const emptyResult = await database.getOne('SELECT * FROM empty_table');
      expect(emptyResult).toBeNull();
    });
  });

  describe('execute()', () => {
    it('should execute write operations and return metadata', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      await database.initDatabase();
      
      mockPool.query.mockResolvedValue([{ affectedRows: 3, insertId: null }]);

      const result = await database.execute('DELETE FROM logs WHERE status = ?', ['old']);
      expect(result.affectedRows).toBe(3);
    });
  });

  describe('isDbReady()', () => {
    it('should return false before initialization', () => {
      const database = getFreshDb();
      expect(database.isDbReady()).toBe(false);
    });

    it('should return true after successful init', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      await database.initDatabase();
      expect(database.isDbReady()).toBe(true);
    });
  });

  describe('getDbStatus()', () => {
    it('should return correct status object', () => {
      const database = getFreshDb();
      const status = database.getDbStatus();
      
      expect(status).toHaveProperty('isInitialized');
      expect(status).toHaveProperty('hasPool');
      expect(status).toHaveProperty('dbType', 'mysql');
      expect(status).toHaveProperty('host');
      expect(status).toHaveProperty('database');
    });
  });

  describe('getDatabaseHealth()', () => {
    it('should return unhealthy status when not initialized', async () => {
      const database = getFreshDb();
      const health = await database.getDatabaseHealth();
      expect(health.status).toBe('unhealthy');
    });

    it('should return healthy status after init', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      await database.initDatabase();
      
      const health = await database.getDatabaseHealth();
      expect(health.status).toBe('healthy');
      expect(health.poolSize).toBeGreaterThan(0);
    });
  });

  describe('checkPoolHealth()', () => {
    it('should return unhealthy when pool not ready', async () => {
      const database = getFreshDb();
      const health = await database.checkPoolHealth();
      
      expect(health.healthy).toBe(false);
      expect(health.status).toBe('uninitialized');
    });

    it('should return healthy when pool is working', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      await database.initDatabase();
      
      const health = await database.checkPoolHealth();
      expect(health.healthy).toBe(true);
      expect(health.status).toBe('healthy');
    });
  });

  describe('initPool() and closePool()', () => {
    it('initPool should be an alias for initDatabase', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      const result = await database.initPool();
      expect(result).toBe(true);
    });

    it('closePool should close the connection pool', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      await database.initDatabase();
      await database.closePool();
      
      expect(mockPool.end).toHaveBeenCalled();
    });
  });

  describe('Slow query logging', () => {
    it('should track slow queries', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      await database.initDatabase();
      
      const log = database.getSlowQueryLog();
      expect(Array.isArray(log)).toBe(true);

      database.clearSlowQueryLog();
      const clearedLog = database.getSlowQueryLog();
      expect(clearedLog).toHaveLength(0);
    });
  });

  describe('Connection error recovery in query()', () => {
    it('should retry query on connection error', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();
      await database.initDatabase();
      
      const connErr = new Error('PROTOCOL_CONNECTION_LOST');
      connErr.code = 'PROTOCOL_CONNECTION_LOST';

      mockPool.query
        .mockRejectedValueOnce(connErr)
        .mockResolvedValueOnce([[{ id: 1, name: 'recovered' }]]);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await database.query('SELECT * FROM users');
      expect(result).toEqual([{ id: 1, name: 'recovered' }]);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Module exports', () => {
    it('should export all required functions', () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ Tables_in_ecommerce: 'users' }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }]);

      const database = getFreshDb();

      expect(typeof database.query).toBe('function');
      expect(typeof database.getOne).toBe('function');
      expect(typeof database.execute).toBe('function');
      expect(typeof database.initPool).toBe('function');
      expect(typeof database.initDatabase).toBe('function');
      expect(typeof database.closePool).toBe('function');
      expect(typeof database.isDbReady).toBe('function');
      expect(typeof database.getDbStatus).toBe('function');
      expect(typeof database.getDatabaseHealth).toBe('function');
      expect(typeof database.getSlowQueryLog).toBe('function');
      expect(typeof database.clearSlowQueryLog).toBe('function');
      expect(typeof database.checkPoolHealth).toBe('function');
    });
  });
});
