const http = require('http');

function checkURL(url) {
  return new Promise((resolve) => {
    const req = http.request(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url: url,
          status: res.statusCode,
          success: res.statusCode === 200 || res.statusCode === 304,
          preview: data.substring(0, 100)
        });
      });
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
  console.log('=== 前端静态资源验证（HTTP模式）===\n');

  const urls = [
    { url: 'http://127.0.0.1:3000/site.webmanifest', name: 'PWA应用清单' },
    { url: 'http://127.0.0.1:3000/robots.txt', name: '爬虫规则' },
    { url: 'http://127.0.0.1:3000/vite.svg', name: 'Favicon图标' },
    { url: 'http://127.0.0.1:3000/', name: '前端首页' }
  ];

  for (const item of urls) {
    console.log(`检查: ${item.name} (${item.url})`);
    try {
      const result = await checkURL(item.url);
      console.log(`   状态码: ${result.status}`);
      console.log(`   结果: ${result.success ? '✅ 可访问' : '❌ 不可访问'}`);
      if (result.preview) {
        console.log(`   预览: ${result.preview}...`);
      }
      if (result.error) {
        console.log(`   错误: ${result.error}`);
      }
    } catch (e) {
      console.log(`   ❌ 异常: ${e.message}`);
    }
    console.log('');
  }

  // 检查Nginx配置的静态文件目录
  console.log('=== 检查服务器上的静态文件 ===');
  const { execSync } = require('child_process');
  try {
    const files = execSync('ls -la /var/www/admin/dist/ | head -10').toString();
    console.log(files);
  } catch (e) {
    console.log('无法读取静态文件目录:', e.message);
  }

  console.log('\n=== 静态资源验证完成 ===');
}

runChecks().catch(console.error);