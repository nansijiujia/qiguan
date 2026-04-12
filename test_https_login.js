const https = require('https');
const data = JSON.stringify({
  username: 'admin',
  password: 'Qm@2026#Admin!Secure'
});

const options = {
  hostname: '127.0.0.1',
  port: 443,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  },
  rejectUnauthorized: false
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('=== HTTPS 登录API测试 ===');
    console.log('状态码:', res.statusCode);
    console.log('响应:', body);

    try {
      const result = JSON.parse(body);
      if (result.success) {
        console.log('\n✅ 外部登录API正常工作!');
        console.log('Token:', result.data?.token?.substring(0, 50) + '...');
      } else {
        console.log('\n❌ 登录失败:', result.error?.message || result.message);
      }
    } catch (e) {
      console.log('\n解析失败');
    }
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e.message);
});

req.write(data);
req.end();
