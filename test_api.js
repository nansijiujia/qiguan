const http = require('http');

function testAPI(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== API测试开始 ===\n');

  // 1. 健康检查
  console.log('1. 健康检查 GET /api/v1/health');
  const health = await testAPI('/api/v1/health');
  console.log(`   状态: ${health.status}, 数据: ${JSON.stringify(health.data).substring(0, 100)}...\n`);

  // 2. 登录测试
  console.log('2. 登录测试 POST /api/v1/auth/login');
  const login = await testAPI('/api/v1/auth/login', 'POST', {
    username: 'admin',
    password: 'admin123'
  });
  console.log(`   状态: ${login.status}, 数据: ${JSON.stringify(login.data).substring(0, 200)}\n`);

  let token = null;
  if (login.data && login.data.success && login.data.data && login.data.data.token) {
    token = login.data.data.token;
    console.log(`   ✅ 登录成功！Token获取成功\n`);
  } else {
    console.log(`   ❌ 登录失败\n`);
  }

  // 3-9. 其他API测试（使用token）
  const tests = [
    { name: '商品列表', path: '/api/v1/products?page=1&limit=5' },
    { name: '订单列表', path: '/api/v1/orders?page=1&limit=5' },
    { name: '用户列表', path: '/api/v1/users?page=1&limit=5' },
    { name: '优惠券列表', path: '/api/v1/coupons' },
    { name: '分类列表', path: '/api/v1/categories' },
    { name: 'Banner列表', path: '/api/v1/content/banners' },
    { name: '仪表盘概览', path: '/api/v1/dashboard/overview' }
  ];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`${i + 3}. ${test.name} GET ${test.path}`);

    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: test.path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const result = await new Promise((resolve) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: JSON.parse(body)
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data: body
            });
          }
        });
      });
      req.end();
    });

    const success = result.status === 200 || (result.data && result.data.success);
    console.log(`   状态: ${result.status}, ${success ? '✅ 成功' : '❌ 失败'}\n`);
  }

  console.log('=== API测试完成 ===');
}

runTests().catch(console.error);