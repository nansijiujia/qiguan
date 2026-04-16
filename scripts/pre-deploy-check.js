const fs = require('fs');
const path = require('path');

console.log('\n=== 🚀 绮管后台部署前环境检查 ===\n');

// 1. Node.js环境
console.log('📌 Node.js 环境:');
console.log(`   版本: ${process.version}`);
console.log(`   平台: ${process.platform}`);
console.log(`   架构: ${process.arch}\n`);

// 2. 关键文件检查
console.log('📌 关键文件检查:');
const criticalFiles = [
  '.env.production',
  'deploy.js', 
  'package.json',
  'qiguanqianduan/package.json'
];

criticalFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   [${exists ? '✅' : '❌'}] ${file}`);
});

// 3. 目录结构
console.log('\n📌 目录结构检查:');
const dirs = [
  { path: 'node_modules', desc: '后端依赖' },
  { path: 'qiguanqianduan/node_modules', desc: '前端依赖' },
  { path: 'qiguanqianduan/dist', desc: '前端构建产物' },
  { path: 'data', desc: '数据目录' },
  { path: 'logs', desc: '日志目录' },
  { path: 'uploads', desc: '上传目录' }
];

dirs.forEach(({ path: dirPath, desc }) => {
  const exists = fs.existsSync(dirPath);
  if (exists) {
    const stat = fs.statSync(dirPath);
    console.log(`   [✅] ${dirPath} (${desc}) - ${stat.isDirectory() ? '目录' : '文件'}`);
  } else {
    console.log(`   [⚠️]  ${dirPath} (${desc}) - 不存在`);
  }
});

// 4. 项目信息
console.log('\n📌 项目信息:');
try {
  const pkg = require('./package.json');
  console.log(`   项目名: ${pkg.name}`);
  console.log(`   版本: ${pkg.version || 'N/A'}`);
  console.log(`   依赖数: ${Object.keys(pkg.dependencies || {}).length}`);
  console.log(`   开发依赖: ${Object.keys(pkg.devDependencies || {}).length}`);
  
  // 检查关键依赖
  console.log('\n📌 关键依赖状态:');
  const keyDeps = ['express', 'mysql2', 'sqlite3', 'jsonwebtoken', 'bcryptjs'];
  keyDeps.forEach(dep => {
    try {
      require.resolve(dep);
      console.log(`   [✅] ${dep} - 已安装`);
    } catch(e) {
      console.log(`   [❌] ${dep} - 未安装`);
    }
  });
  
} catch(e) {
  console.log('   ❌ 无法读取 package.json');
}

// 5. 数据库配置验证
console.log('\n📌 数据库配置 (.env.production):');
try {
  const envContent = fs.readFileSync('.env.production', 'utf8');
  const dbHost = envContent.match(/DB_HOST=(.+)/)?.[1];
  const dbPort = envContent.match(/DB_PORT=(.+)/)?.[1];
  const dbName = envContent.match(/DB_NAME=(.+)/)?.[1];
  const dbUser = envContent.match(/DB_USER=(.+)/)?.[1];
  const jwtSecret = envContent.match(/JWT_SECRET=(.+)/)?.[1];
  
  console.log(`   DB_HOST: ${dbHost || '未配置'}`);
  console.log(`   DB_PORT: ${dbPort || '未配置'}`);
  console.log(`   DB_NAME: ${dbName || '未配置'}`);
  console.log(`   DB_USER: ${dbUser || '未配置'}`);
  console.log(`   JWT_SECRET: ${jwtSecret ? `${jwtSecret.substring(0, 8)}...(${jwtSecret.length}字符)` : '❌ 未配置'}`);
  
  if (jwtSecret && jwtSecret.length >= 32) {
    console.log('   ✅ JWT密钥强度: 达标 (≥32字符)');
  } else if (jwtSecret) {
    console.log('   ⚠️ JWT密钥强度: 不足 (<32字符)');
  }
  
} catch(e) {
  console.log('   ❌ 无法读取 .env.production');
}

// 6. 部署脚本检查
console.log('\n📌 部署脚本 (deploy.js):');
if (fs.existsSync('deploy.js')) {
  const deployContent = fs.readFileSync('deploy.js', 'utf8');
  const hasSSH = deployContent.includes('ssh2') || deployContent.includes('Client');
  const hasSFTP = deployContent.includes('sftp') || deployContent.includes('fastPut');
  
  console.log(`   [✅] 文件存在`);
  console.log(`   [${hasSSH ? '✅' : '❌'}] SSH连接模块`);
  console.log(`   [${hasSFTP ? '✅' : '❌'}] SFTP文件传输`);
}

// 7. 总结
console.log('\n' + '='.repeat(50));
console.log('📊 环境检查完成\n');

const issues = [];
if (!fs.existsSync('node_modules')) issues.push('❌ 后端依赖未安装 (运行 npm install)');
if (!fs.existsSync('qiguanqianduan/dist')) issues.push('⚠️ 前端未构建 (运行 npm run build)');
if (!fs.existsSync('.env.production')) issues.push('❌ 生产环境配置缺失');

if (issues.length === 0) {
  console.log('✅ 环境就绪，可以执行部署！');
  console.log('   执行命令: node deploy.js\n');
} else {
  console.log('⚠️ 需要处理以下问题:\n');
  issues.forEach(issue => console.log(`   ${issue}`));
  console.log('\n建议按顺序执行上述修复命令。\n');
}
