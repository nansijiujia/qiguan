const http = require('http');

const postData = JSON.stringify({
  username: 'admin',
  password: 'admin123'
});

console.log('发送的JSON数据:', postData);
console.log('数据长度:', postData.length);

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
  console.log('\n=== 响应状态 ===');
  console.log('状态码:', res.statusCode);
  console.log('响应头:', JSON.stringify(res.headers, null, 2));

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n=== 响应体 ===');
    console.log(data);

    try {
      const json = JSON.parse(data);
      console.log('\n=== 解析后的JSON ===');
      console.log('success:', json.success);

      if (json.success && json.data && json.data.token) {
        console.log('\n✅✅✅ 登录成功! ✅✅✅');
        console.log('Token (前50位):', json.data.token.substring(0, 50));
        console.log('用户信息:', JSON.stringify(json.data.user, null, 2));
      } else {
        console.log('\n❌ 登录失败');
        console.log('错误:', json.error || json.message);
      }
    } catch (e) {
      console.error('\n解析响应失败:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e.message);
});

req.write(postData);
req.end();

console.log('\n请求已发送...');
