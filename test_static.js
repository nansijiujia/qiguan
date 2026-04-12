const http = require('http');
const https = require('https');

function checkURL(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, (res) => {
      resolve({
        url: url,
        status: res.statusCode,
        success: res.statusCode === 200 || res.statusCode === 304
      });
      res.resume();
    });

    req.on('error', (e) => {
      resolve({
        url: url,
        status: 'ERROR',
        success: false,
        error: e.message
      });
    });

    req.end();
  });
}

async function runChecks() {
  console.log('=== 前端静态资源验证 ===\n');

  const urls = [
    'https://admin.qimengzhiyue.cn/site.webmanifest',
    'https://admin.qimengzhiyue.cn/robots.txt',
    'https://admin.qimengzhiyue.cn/vite.svg',
    'https://admin.qimengzhiyue.cn/',
    'https://admin.qimengzhiyue.cn/assets/index-DNyRHIKH.js'
  ];

  for (const url of urls) {
    console.log(`检查: ${url}`);
    try {
      const result = await checkURL(url);
      console.log(`   状态: ${result.status}, ${result.success ? '✅ 可访问' : '❌ 不可访问'}`);
      if (result.error) {
        console.log(`   错误: ${result.error}`);
      }
    } catch (e) {
      console.log(`   ❌ 异常: ${e.message}`);
    }
    console.log('');
  }

  console.log('=== 静态资源验证完成 ===');
}

runChecks().catch(console.error);