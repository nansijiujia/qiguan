const http = require('http');

// 测试登录API
function testLogin() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      username: 'admin',
      password: 'admin123'
    });
    
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 使用Token访问受保护API
function testProtectedApi(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/v1/products',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    
    req.on('error', reject);
    req.end();
  });
}

// 无Token访问
function testUnauthorized() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/v1/products',
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== 绮管后台 API 诊断测试 ===\n');
  
  // Test 1: 无Token访问
  console.log('Test 1: 无Token访问 /api/v1/products');
  try {
    const result = await testUnauthorized();
    console.log(`Status: ${result.status}`);
    console.log(`Body: ${result.body.substring(0, 200)}\n`);
  } catch(e) { console.error('Error:', e.message); }
  
  // Test 2: 登录
  console.log('Test 2: 登录 admin/admin123');
  try {
    const loginResult = await testLogin();
    console.log(`Status: ${loginResult.status}`);
    console.log(`Body: ${loginResult.body}\n`);
    
    if (loginResult.status === 200) {
      const loginData = JSON.parse(loginResult.body);
      if (loginData.success && loginData.data?.token) {
        // Test 3: 有Token访问
        console.log('Test 3: 使用Token访问 /api/v1/products');
        const protectedResult = await testProtectedApi(loginData.data.token);
        console.log(`Status: ${protectedResult.status}`);
        console.log(`Body: ${protectedResult.body.substring(0, 500)}\n`);
        
        // Test 4: 访问分类
        console.log('Test 4: 使用Token访问 /api/v1/categories');
        const catOptions = {
          hostname: '127.0.0.1',
          port: 3000,
          path: '/api/v1/categories',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${loginData.data.token}` }
        };
        const catResult = await new Promise((resolve, reject) => {
          const req = http.request(catOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
          });
          req.on('error', reject);
          req.end();
        });
        console.log(`Status: ${catResult.status}`);
        console.log(`Body: ${catResult.body.substring(0, 500)}\n`);
      }
    }
  } catch(e) { console.error('Error:', e.message); }
}

main().catch(console.error);
