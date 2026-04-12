const http = require('http');

// 测试登录功能
const testData = JSON.stringify({
  username: 'admin',
  password: 'admin123'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(testData)
  }
};

console.log('=== 测试登录功能 ===');
console.log('测试数据:', testData);
console.log('\n发送请求到:', `http://${options.hostname}:${options.port}${options.path}`);
console.log('='.repeat(50));

const req = http.request(options, (res) => {
  console.log(`\n响应状态码: ${res.statusCode}`);
  console.log(`响应头: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n响应内容:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.success && parsed.data?.token) {
        console.log('\n✅ 登录成功！');
        console.log('Token:', parsed.data.token.substring(0, 50) + '...');
        console.log('用户:', parsed.data.user);
      } else {
        console.log('\n❌ 登录失败！');
      }
    } catch (e) {
      console.log(data);
      console.error('\n解析响应失败:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ 请求失败:', error.message);
  console.error('请确保后端服务已在 localhost:3000 上启动');
});

req.write(testData);
req.end();
