#!/usr/bin/env node

/**
 * 绮管后台 - 一键启动开发环境
 * 
 * 功能:
 * - 同时启动后端API服务 (端口3003)
 * - 启动前端开发服务器 (端口8080)
 * - 自动检测依赖安装情况
 * - 提供实时日志和状态监控
 * - 一键停止所有服务
 * 
 * 使用方法:
 *   node start-dev.js          # 启动前后端服务
 *   node start-dev.js --stop   # 停止所有服务
 *   node start-dev.js --check  # 检查环境配置
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('\n' + '='.repeat(70));
console.log('🚀 绮管后台 - 开发环境一键启动工具');
console.log('='.repeat(70) + '\n');

// 配置信息
const CONFIG = {
  backend: {
    dir: path.resolve(__dirname),
    port: 3003,
    command: 'node',
    args: ['index.js'],
    name: '后端API服务'
  },
  frontend: {
    dir: path.resolve(__dirname, 'qiguanqianduan'),
    port: 8080,
    command: 'npm',
    args: ['run', 'dev'],
    name: '前端开发服务器'
  }
};

let backendProcess = null;
let frontendProcess = null;

function checkEnvironment() {
  console.log('📋 环境检查:\n');

  const checks = [
    {
      name: 'Node.js版本',
      check: () => process.version,
      pass: (v) => {
        const major = parseInt(v.slice(1).split('.')[0]);
        return major >= 16;
      },
      failMsg: '需要Node.js >= 16，当前版本: '
    },
    {
      name: '后端目录',
      check: () => fs.existsSync(CONFIG.backend.dir),
      pass: (exists) => exists,
      failMsg: '后端目录不存在: '
    },
    {
      name: '前端目录',
      check: () => fs.existsSync(CONFIG.frontend.dir),
      pass: (exists) => exists,
      failMsg: '前端目录不存在: '
    },
    {
      name: '后端依赖(node_modules)',
      check: () => fs.existsSync(path.join(CONFIG.backend.dir, 'node_modules')),
      pass: (exists) => exists,
      failMsg: '后端依赖未安装，请执行: npm install'
    },
    {
      name: '前端依赖(node_modules)',
      check: () => fs.existsSync(path.join(CONFIG.frontend.dir, 'node_modules')),
      pass: (exists) => exists,
      failMsg: '前端依赖未安装，请执行: cd qiguanqianduan && npm install'
    },
    {
      name: '数据库文件(ecommerce.db)',
      check: () => fs.existsSync(path.join(CONFIG.backend.dir, 'data', 'ecommerce.db')),
      pass: (exists) => exists,
      failMsg: '数据库未初始化，请执行: node scripts/init_sqlite_database.js'
    },
    {
      name: '前端环境变量(.env.development)',
      check: () => {
        const envFile = path.join(CONFIG.frontend.dir, '.env.development');
        if (!fs.existsSync(envFile)) return false;
        
        const content = fs.readFileSync(envFile, 'utf8');
        return content.includes('localhost:3003'); // 验证端口是否正确
      },
      pass: (ok) => ok,
      failMsg: '前端API地址未配置或端口错误，应指向 localhost:3003'
    }
  ];

  let allPassed = true;

  checks.forEach(({ name, check, pass, failMsg }) => {
    const result = check();
    const isOk = pass(result);

    if (isOk) {
      console.log(`   ✅ ${name}`);
    } else {
      console.log(`   ❌ ${name}`);
      console.log(`      ⚠️  ${failMsg}${typeof result === 'string' ? result : ''}`);
      allPassed = false;
    }
  });

  return allPassed;
}

function startBackend() {
  return new Promise((resolve, reject) => {
    console.log(`\n🔧 启动${CONFIG.backend.name}...`);
    console.log(`   端口: ${CONFIG.backend.port}`);
    console.log(`   目录: ${CONFIG.backend.dir}\n`);

    backendProcess = spawn(CONFIG.backend.command, CONFIG.backend.args, {
      cwd: CONFIG.backend.dir,
      stdio: 'pipe',
      shell: true
    });

    let started = false;
    const startupTimeout = setTimeout(() => {
      if (!started) {
        reject(new Error('后端启动超时（5秒）'));
      }
    }, 5000);

    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      // 检测启动成功标志
      if (output.includes('Server running') || output.includes('listening') || output.includes('3003')) {
        if (!started) {
          started = true;
          clearTimeout(startupTimeout);
          console.log(`   ✅ ${CONFIG.backend.name}已启动`);
          console.log(`   📍 地址: http://localhost:${CONFIG.backend.port}\n`);
          resolve();
        }
      }

      // 显示关键日志
      if (output.includes('Error') || output.includes('error')) {
        console.log(`   [后端] ${output.trim()}`);
      } else if (output.includes('Database') || output.includes('Server')) {
        console.log(`   [后端] ${output.trim()}`);
      }
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`   [后端错误] ${data.toString().trim()}`);
    });

    backendProcess.on('error', (err) => {
      clearTimeout(startupTimeout);
      reject(err);
    });
  });
}

function startFrontend() {
  return new Promise((resolve, reject) => {
    console.log(`\n🎨 启动${CONFIG.frontend.name}...`);
    console.log(`   端口: ${CONFIG.frontend.port}`);
    console.log(`   目录: ${CONFIG.frontend.dir}\n`);

    frontendProcess = spawn(CONFIG.frontend.command, CONFIG.frontend.args, {
      cwd: CONFIG.frontend.dir,
      stdio: 'pipe',
      shell: true
    });

    let started = false;
    const startupTimeout = setTimeout(() => {
      if (!started) {
        resolve(); // Vite启动较慢，不强制等待
      }
    }, 10000);

    frontendProcess.stdout.on('data', (data) => {
      const output = data.toString();

      // 检测Vite启动成功
      if (output.includes('Local:') || output.includes('8080')) {
        if (!started) {
          started = true;
          clearTimeout(startupTimeout);
          console.log(`   ✅ ${CONFIG.frontend.name}已启动`);
          
          // 提取URL
          const urlMatch = output.match(/http:\/\/localhost:(\d+)/);
          if (urlMatch) {
            console.log(`   📍 地址: http://localhost:${urlMatch[1]}\n`);
          }
          
          resolve();
        }
      }

      // 显示Vite关键输出
      if (output.includes('ready') || output.includes('ERROR') || output.includes('warn')) {
        console.log(`   [前端] ${output.trim()}`);
      }
    });

    frontendProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Error') || output.includes('error')) {
        console.error(`   [前端错误] ${output.trim()}`);
      }
    });

    frontendProcess.on('error', (err) => {
      clearTimeout(startupTimeout);
      reject(err);
    });
  });
}

async function openBrowser() {
  const url = `http://localhost:${CONFIG.frontend.port}/admin`;
  
  console.log(`\n🌐 准备打开浏览器...`);
  console.log(`   📍 访问地址: ${url}\n`);

  setTimeout(() => {
    const opener = process.platform === 'win32' ? 'start' :
                   process.platform === 'darwin' ? 'open' : 'xdg-open';
    
    exec(`${opener} ${url}`, (err) => {
      if (err) {
        console.log(`   ℹ️ 请手动打开浏览器访问: ${url}`);
      } else {
        console.log(`   ✅ 浏览器已打开\n`);
      }
    });
  }, 2000); // 等待2秒让服务完全启动
}

function showStatus() {
  console.log('\n' + '='.repeat(70));
  console.log('✅ 开发环境已就绪！');
  console.log('='.repeat(70));
  
  console.log(`
📌 服务地址:
   后端API: http://localhost:${CONFIG.backend.port}
   前端界面: http://localhost:${CONFIG.frontend.port}/admin
   API文档: http://localhost:${CONFIG.backend.port}/api-docs

📌 登录信息:
   用户名: admin
   密码: admin123

📌 快捷操作:
   - 按 Ctrl+C 停止所有服务
   - 访问 http://localhost:${CONFIG.frontend.port}/admin 进入管理后台
   
⏰ 启动时间: ${new Date().toLocaleString()}
`);
}

function cleanup() {
  console.log('\n\n🛑 正在停止所有服务...\n');

  if (backendProcess) {
    backendProcess.kill();
    console.log('   ✅ 后端服务已停止');
  }

  if (frontendProcess) {
    frontendProcess.kill();
    console.log('   ✅ 前端服务已停止');
  }

  console.log('\n👋 所有服务已停止，再见！\n');
  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);

  // 停止命令
  if (args.includes('--stop')) {
    console.log('⚠️ 请直接按 Ctrl+C 停止运行中的服务\n');
    process.exit(0);
    return;
  }

  // 仅检查命令
  if (args.includes('--check')) {
    const isOk = checkEnvironment();
    process.exit(isOk ? 0 : 1);
    return;
  }

  // 正常启动流程
  console.log('🔍 第一步: 检查运行环境...\n');
  
  const envOk = checkEnvironment();

  if (!envOk) {
    console.log('\n❌ 环境检查未通过，请先解决上述问题\n');
    console.log('💡 常见解决方案:');
    console.log('   1. 安装依赖: npm install');
    console.log('   2. 初始化数据库: node scripts/init_sqlite_database.js');
    console.log('   3. 检查Node.js版本: node -v (需要>=16)\n');
    
    process.exit(1);
    return;
  }

  try {
    console.log('\n✅ 环境检查通过，开始启动服务...\n');

    await startBackend();
    await startFrontend();
    
    showStatus();
    openBrowser();

    // 注册退出信号处理
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // 保持进程运行
    process.stdin.resume();

  } catch (error) {
    console.error(`\n❌ 启动失败: ${error.message}\n`);
    console.error(error.stack);
    
    cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { startBackend, startFrontend, checkEnvironment };
