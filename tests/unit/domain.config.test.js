const fs = require('fs');
const path = require('path');

const originalEnv = process.env;

describe('domain config', () => {
  let domainConfig;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadConfig() {
    return require('../../config/domain');
  }

  describe('DOMAIN_CONFIG structure', () => {
    it('should export correct DOMAIN_CONFIG with all required properties', () => {
      const { DOMAIN_CONFIG } = loadConfig();

      expect(DOMAIN_CONFIG).toHaveProperty('primary');
      expect(DOMAIN_CONFIG).toHaveProperty('www');
      expect(DOMAIN_CONFIG).toHaveProperty('api');
      expect(DOMAIN_CONFIG).toHaveProperty('admin');
      expect(DOMAIN_CONFIG).toHaveProperty('serverIp');
      expect(DOMAIN_CONFIG).toHaveProperty('port');
      expect(DOMAIN_CONFIG).toHaveProperty('protocol');

      expect(typeof DOMAIN_CONFIG.primary).toBe('string');
      expect(typeof DOMAIN_CONFIG.port).toBe('number');
      expect(typeof DOMAIN_CONFIG.protocol).toBe('string');
    });

    it('should have default values when env vars not set', () => {
      delete process.env.DOMAIN_PRIMARY;
      delete process.env.DOMAIN_WWW;
      delete process.env.DOMAIN_API;
      delete process.env.DOMAIN_ADMIN;
      delete process.env.SERVER_IP;
      delete process.env.PORT;
      delete process.env.PROTOCOL;

      const { DOMAIN_CONFIG } = loadConfig();

      expect(DOMAIN_CONFIG.primary).toBe('qimengzhiyue.cn');
      expect(DOMAIN_CONFIG.www).toBe('www.qimengzhiyue.cn');
      expect(DOMAIN_CONFIG.api).toBe('api.qimengzhiyue.cn');
      expect(DOMAIN_CONFIG.admin).toBe('admin.qimengzhiyue.cn');
      expect(DOMAIN_CONFIG.serverIp).toBe('101.34.39.231');
      expect(DOMAIN_CONFIG.port).toBe(3000);
      expect(DOMAIN_CONFIG.protocol).toBe('https');
    });

    it('should use custom values from environment variables', () => {
      process.env.DOMAIN_PRIMARY = 'custom-domain.com';
      process.env.DOMAIN_API = 'api.custom.com';
      process.env.SERVER_IP = '192.168.1.1';
      process.env.PORT = '8080';
      process.env.PROTOCOL = 'http';

      const { DOMAIN_CONFIG } = loadConfig();

      expect(DOMAIN_CONFIG.primary).toBe('custom-domain.com');
      expect(DOMAIN_CONFIG.api).toBe('api.custom.com');
      expect(DOMAIN_CONFIG.serverIp).toBe('192.168.1.1');
      expect(DOMAIN_CONFIG.port).toBe(8080);
      expect(DOMAIN_CONFIG.protocol).toBe('http');
    });
  });

  describe('URL generation functions', () => {
    describe('getApiBaseUrl()', () => {
      it('should generate correct API base URL', () => {
        const { getApiBaseUrl, DOMAIN_CONFIG } = loadConfig();
        const url = getApiBaseUrl();
        expect(url).toBe(`${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}`);
      });
    });

    describe('getAdminUrl()', () => {
      it('should generate correct admin URL', () => {
        const { getAdminUrl, DOMAIN_CONFIG } = loadConfig();
        const url = getAdminUrl();
        expect(url).toBe(`${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.admin}`);
      });
    });

    describe('getHealthCheckUrl()', () => {
      it('should generate HTTP health check URL', () => {
        const { getHealthCheckUrl, DOMAIN_CONFIG } = loadConfig();
        const url = getHealthCheckUrl();
        expect(url).toBe(`http://${DOMAIN_CONFIG.serverIp}:${DOMAIN_CONFIG.port}/api/v1/health`);
      });

      it('should always use HTTP protocol for internal health checks', () => {
        process.env.PROTOCOL = 'https';
        const { getHealthCheckUrl } = loadConfig();
        const url = getHealthCheckUrl();
        expect(url.startsWith('http://')).toBe(true);
      });
    });

    describe('getRootHealthCheckUrl()', () => {
      it('should generate root path health check URL', () => {
        const { getRootHealthCheckUrl, DOMAIN_CONFIG } = loadConfig();
        const url = getRootHealthCheckUrl();
        expect(url).toBe(`http://${DOMAIN_CONFIG.serverIp}:${DOMAIN_CONFIG.port}/health`);
      });
    });
  });

  describe('CORS_CONFIG', () => {
    it('should export correct CORS configuration', () => {
      const { CORS_CONFIG, DOMAIN_CONFIG } = loadConfig();

      expect(CORS_CONFIG).toHaveProperty('allowedOrigins');
      expect(CORS_CONFIG).toHaveProperty('methods');
      expect(CORS_CONFIG).toHaveProperty('allowedHeaders');
      expect(CORS_CONFIG).toHaveProperty('credentials');
      expect(CORS_CONFIG).toHaveProperty('optionsSuccessStatus');

      expect(Array.isArray(CORS_CONFIG.allowedOrigins)).toBe(true);
      expect(Array.isArray(CORS_CONFIG.methods)).toBe(true);
      expect(Array.isArray(CORS_CONFIG.allowedHeaders)).toBe(true);
      expect(CORS_CONFIG.credentials).toBe(true);
      expect(CORS_CONFIG.optionsSuccessStatus).toBe(200);
    });

    it('should include domain-based origins in allowed list', () => {
      const { CORS_CONFIG, DOMAIN_CONFIG } = loadConfig();

      const expectedOrigins = [
        `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}`,
        `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.www}`,
        `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.api}`,
        `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.admin}`
      ];

      expectedOrigins.forEach(origin => {
        expect(CORS_CONFIG.allowedOrigins).toContain(origin);
      });
    });

    it('should include localhost origins for development', () => {
      const { CORS_CONFIG } = loadConfig();

      expect(CORS_CONFIG.allowedOrigins).toContain('http://localhost:5173');
      expect(CORS_CONFIG.allowedOrigins).toContain('http://localhost:3000');
      expect(CORS_CONFIG.allowedOrigins).toContain('http://127.0.0.1:5173');
    });

    it('should allow standard HTTP methods', () => {
      const { CORS_CONFIG } = loadConfig();

      expect(CORS_CONFIG.methods).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
    });

    it('should allow Content-Type and Authorization headers', () => {
      const { CORS_CONFIG } = loadConfig();

      expect(CORS_CONFIG.allowedHeaders).toEqual(['Content-Type', 'Authorization']);
    });
  });

  describe('Environment file loading', () => {
    it('should load .env.development in development mode by default', () => {
      process.env.NODE_ENV = 'development';
      
      const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const config = loadConfig();

      expect(existsSyncSpy).toHaveBeenCalled();
      
      existsSyncSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should warn when env file is missing', () => {
      const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const config = loadConfig();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );

      existsSyncSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should fallback to system env vars when env file missing', () => {
      const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      process.env.DOMAIN_PRIMARY = 'from-system-env';

      const { DOMAIN_CONFIG } = loadConfig();

      expect(DOMAIN_CONFIG.primary).toBe('from-system-env');

      existsSyncSpy.mockRestore();
    });
  });

  describe('Production mode configuration', () => {
    it('should load .env.production when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      
      const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      loadConfig();

      expect(existsSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining('.env.production')
      );

      existsSyncSpy.mockRestore();
    });
  });

  describe('Module exports', () => {
    it('should export all required functions and objects', () => {
      const config = loadConfig();

      expect(config).toHaveProperty('DOMAIN_CONFIG');
      expect(config).toHaveProperty('getApiBaseUrl');
      expect(config).toHaveProperty('getAdminUrl');
      expect(config).toHaveProperty('getHealthCheckUrl');
      expect(config).toHaveProperty('getRootHealthCheckUrl');
      expect(config).toHaveProperty('CORS_CONFIG');

      expect(typeof config.getApiBaseUrl).toBe('function');
      expect(typeof config.getAdminUrl).toBe('function');
      expect(typeof config.getHealthCheckUrl).toBe('function');
      expect(typeof config.getRootHealthCheckUrl).toBe('function');
    });
  });
});
