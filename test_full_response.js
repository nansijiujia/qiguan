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
    'Origin': 'https://qimengzhiyue.cn',
    'Referer': 'https://qimengzhiyue.cn/admin/login',
    'Content-Length': Buffer.byteLength(data)
  },
  rejectUnauthorized: false
};

const req = https.request(options, (res) => {
  console.log('=== 完整HTTP响应头 ===');
  console.log('状态码:', res.statusCode);
  console.log('响应头:', JSON.stringify(res.headers, null, 2));

  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('\n=== 响应体 ===');
    console.log('长度:', body.length, '字节');
    console.log('内容:', body);

    try {
      const result = JSON.parse(body);
      console.log('\n=== 解析结果 ===');
      console.log('success:', result.success);
      if (result.success) {
        console.log('✅ 登录成功!');
        console.log('Token存在:', !!result.data?.token);
        console.log('Token前50字符:', result.data?.token?.substring(0, 50));
        console.log('用户信息:', JSON.stringify(result.data?.user));
      } else {
        console.log('❌ 登录失败');
        console.log('错误:', result.error || result.message);
      }
    } catch (e) {
      console.error('解析失败:', e.message);
    }
  });
});

req.on('error', (e) => console.error('请求错误:', e.message));

req.write(data);
req.end();
