console.log('=== E-commerce Backend Starting ===');
console.log('Node:', process.version);
console.log('Time:', new Date().toISOString());

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');

let db;
try {
  db = require('./db');
  console.log('[DB] Status:', !!db?.db ? 'Connected' : 'Mock mode');
} catch (e) {
  console.error('[DB] Error:', e.message);
  db = null;
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

app.options('*', (req, res) => res.status(200).send());

const routes = [
  ['categories', './routes/categories'],
  ['products', './routes/products'],
  ['dashboard', './routes/dashboard'],
  ['orders', './routes/orders'],
  ['users', './routes/users'],
  ['cart', './routes/cart'],
  ['content', './routes/content'],
  ['search', './routes/search'],
  ['health', './routes/health']
];

routes.forEach(([name, path]) => {
  try {
    app.use('/api/v1', require(path));
    console.log(`[Route] /api/v1/${name} ✓`);
  } catch (e) {
    console.error(`[Route] ${name} ✗: ${e.message}`);
  }
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'E-commerce Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    database: !!db?.db,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

const server = http.createServer(app);

server.setTimeout(120000);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('✅✅✅ Server is RUNNING ✅✅✅');
  console.log(`   Port: ${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   PID: ${process.pid}`);
  console.log('');
});

server.on('error', (err) => {
  console.error('[FATAL] Server error:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${PORT} already in use`);
  }
  process.exit(1);
});

exports.main = async function(event, context) {
  const httpContext = context.httpContext || {};
  const method = event.httpMethod || (httpContext.method || 'GET');
  const url = event.path || (httpContext.url || '/');
  const headers = event.headers || (httpContext.headers || {});
  const queryStringParameters = event.queryStringParameters || (httpContext.query || {});
  const body = event.body || '';

  let parsedBody = body;
  if (typeof body === 'string' && body.length > 0) {
    try {
      parsedBody = event.isBase64Encoded
        ? JSON.parse(Buffer.from(body, 'base64').toString())
        : JSON.parse(body);
    } catch (e) {
      parsedBody = body;
    }
  }

  return new Promise((resolve) => {
    const req = { method, url, headers, query: queryStringParameters, body: parsedBody };
    let resolved = false;
    const res = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status(code) { this.statusCode = code; return this; },
      setHeader(k, v) { this.headers[k] = v; },
      end(data) {
        if (!resolved) { resolved = true; resolve({ statusCode: this.statusCode, headers: this.headers, body: data || '', isBase64Encoded: false }); }
      },
      json(data) { this.headers['Content-Type'] = 'application/json'; this.end(JSON.stringify(data)); },
      send(data) { data != null && typeof data === 'object' ? this.json(data) : this.end(String(data ?? '')); }
    };

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; resolve({ statusCode: 504, headers: res.headers, body: '{"timeout":true}', isBase64Encoded: false }); }
    }, 25000);

    try { app(req, res); clearTimeout(timeout); } catch (err) {
      clearTimeout(timeout);
      if (!resolved) { resolved = true; resolve({ statusCode: 500, headers: res.headers, body: JSON.stringify({error:err.message}), isBase64Encoded: false }); }
    }
  });
};

module.exports = { app, server };
