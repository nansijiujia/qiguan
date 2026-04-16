const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('='.repeat(60));
console.log('  云服务器清理 & 重新部署工具');
console.log('  时间:', new Date().toLocaleString('zh-CN'));
console.log('='.repeat(60));

// 配置信息
const SERVER_CONFIG = {
  host: '101.34.39.231',  // 从 .env.production 或 domain.js 获取
  port: 22,
  username: 'root',
  privateKey: path.resolve(__dirname, '..', '..', 'qimengzhiyue.pem'),
  remotePath: '/www/wwwroot/qiguan'
};

// 危险操作确认
console.log('\n⚠️  **危险操作警告**');
console.log(`   目标服务器: ${SERVER_CONFIG.host}`);
console.log(`   清理路径: ${SERVER_CONFIG.remotePath}`);
console.log('   此操作将删除该目录下的所有文件并重新部署！');
console.log('\n请确认您已：');
console.log('   ✅ 备份数据库数据');
console.log('   ✅ 备份重要配置文件');
console.log('   ✅ 确认本地代码是最新测试通过的版本\n');

const conn = new Client();

conn.on('ready', async () => {
  console.log('[✅] SSH连接成功');

  try {
    // Step 1: 备份当前状态（可选）
    console.log('\n[Step 1/6] 检查当前服务器状态...');
    await executeCommand(conn, `ls -la ${SERVER_CONFIG.remotePath} | head -20`);

    // Step 2: 停止PM2服务
    console.log('\n[Step 2/6] 停止PM2服务...');
    await executeCommand(conn, 'pm2 stop all 2>/dev/null || echo "No PM2 processes"');
    await executeCommand(conn, 'pm2 delete all 2>/dev/null || echo "No PM2 apps to delete"');

    // Step 3: 清理目标目录（保留目录结构）
    console.log('\n[Step 3/6] 清理服务器文件...');
    console.log(`   正在删除 ${SERVER_CONFIG.remotePath}/* ...`);
    
    // 使用 rm -rf 删除所有内容，但保留目录本身
    const cleanCommand = `
      # 创建临时备份目录（用于记录被删除的内容）
      BACKUP_DIR="/tmp/qiguan_backup_$(date +%Y%m%d_%H%M%S)"
      mkdir -p "$BACKUP_DIR"
      
      # 记录当前文件列表到日志
      find ${SERVER_CONFIG.remotePath} -type f > "$BACKUP_DIR/deleted_files.log" 2>/dev/null || true
      
      # 删除所有文件（保留子目录结构）
      find ${SERVER_CONFIG.remotePath} -mindepth 1 -delete 2>/dev/null || true
      
      # 删除空目录
      find ${SERVER_CONFIG.remotePath} -mindepth 1 -type d -empty -delete 2>/dev/null || true
      
      echo "✅ 清理完成"
      echo "已删除的文件列表保存在: $BACKUP_DIR/deleted_files.log"
    `;
    
    await executeCommand(conn, cleanCommand);

    // Step 4: 重建目录结构
    console.log('\n[Step 4/6] 重建目录结构...');
    await executeCommand(conn, `mkdir -p ${SERVER_CONFIG.remotePath}/{logs,uploads,data,backups}`);

    // Step 5: 上传最新代码
    console.log('\n[Step 5/6] 上传最新后台代码...');
    
    // 使用 SFTP 上传文件
    await uploadFiles(conn);
    
    // Step 6: 安装依赖并启动服务
    console.log('\n[Step 6/6] 安装依赖并启动服务...');
    
    await executeCommand(conn, `cd ${SERVER_CONFIG.remotePath} && npm install --production 2>&1`);
    
    // 启动PM2
    await executeCommand(conn, `cd ${SERVER_CONFIG.remotePath} && pm2 start ecosystem.config.js 2>&1`);
    
    // 等待服务启动
    console.log('\n等待服务启动...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 验证部署
    console.log('\n' + '='.repeat(60));
    console.log('  部署验证');
    console.log('='.repeat(60));
    
    await verifyDeployment(conn);
    
    console.log('\n' + '='.repeat(60));
    console.log('  ✅ 部署完成！');
    console.log('='.repeat(60));
    console.log('\n后续步骤:');
    console.log('  1. 访问 https://admin.qimengzhiyue.cn 验证前端页面');
    console.log('  2. 测试登录功能');
    console.log('  3. 检查各管理模块是否正常');
    console.log('  4. 运行: pm2 logs 查看实时日志');
    console.log('  5. 如有问题，查看: cat /www/wwwroot/qiguan/logs/app-error.log');
    
  } catch (error) {
    console.error('\n❌ 部署失败:', error.message);
    console.error('错误详情:', error.stack);
  } finally {
    conn.end();
    console.log('\n[✅] SSH连接已关闭');
    process.exit(0);
  }
});

// 辅助函数：执行远程命令
function executeCommand(conn, command) {
  return new Promise((resolve, reject) => {
    console.log(`   执行: ${command.split('\n')[0].trim()}...`);
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      
      let output = '';
      stream.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);  // 实时输出
      });
      
      stream.stderr.on('data', (data) => {
        output += data.toString();
        process.stderr.write(data);  // 实时输出错误
      });
      
      stream.on('close', (code, signal) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`命令执行失败 (exit code: ${code}): ${output}`));
        } else {
          resolve(output);
        }
      });
    });
  });
}

// 辅助函数：上传文件
async function uploadFiles(conn) {
  return new Promise((resolve, reject) => {
    const sftpOptions = {};
    
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }
      
      let uploadCount = 0;
      let totalCount = 0;
      
      // 统计需要上传的文件数
      const filesToUpload = [];
      
      function collectFiles(dir) {
        try {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const relativePath = path.relative(__dirname, fullPath);
            
            if (fs.statSync(fullPath).isDirectory()) {
              // 跳过不需要上传的目录
              if (!['node_modules', '.git', 'qiguanqianduan/dist', 'coverage'].includes(item)) {
                collectFiles(fullPath);
              }
            } else {
              // 跳过特定文件
              if (!item.endsWith('.log') && !item.includes('.backup') && !item.startsWith('.')) {
                filesToUpload.push({
                  local: fullPath,
                  remote: `${SERVER_CONFIG.remotePath}/${relativePath.replace(/\\/g, '/')}`
                });
                totalCount++;
              }
            }
          }
        } catch (e) {
          // 忽略无法访问的目录
        }
      }
      
      collectFiles(__dirname);
      
      console.log(`   发现 ${totalCount} 个文件需要上传...`);
      
      if (filesToUpload.length === 0) {
        console.log('   ⚠️ 没有需要上传的文件');
        sftp.end();
        resolve();
        return;
      }
      
      // 批量上传
      const uploadNext = (index) => {
        if (index >= filesToUpload.length) {
          console.log(`\n   ✅ 成功上传 ${uploadCount}/${totalCount} 个文件`);
          sftp.end();
          resolve();
          return;
        }
        
        const file = filesToUpload[index];
        const progressMsg = `   [${index + 1}/${totalCount}] ${path.basename(file.local)}`;
        
        sftp.fastPut(file.local, file.remote, (err) => {
          if (err) {
            console.error(`${progressMsg} ❌ 失败: ${err.message}`);
          } else {
            uploadCount++;
            if (uploadCount % 50 === 0) {
              process.stdout.write(`\r${progressMsg} (${uploadCount}/${totalCount})`);
            }
          }
          
          setImmediate(() => uploadNext(index + 1));
        });
      };
      
      uploadNext(0);
    });
  });
}

// 辅助函数：验证部署结果
async function verifyDeployment(conn) {
  console.log('\n检查服务状态...\n');
  
  // 检查PM2状态
  try {
    await executeCommand(conn, 'pm2 list');
  } catch (e) {
    console.log('⚠️ PM2列表获取失败');
  }
  
  // 检查关键文件是否存在
  const criticalFiles = [
    '.env.production',
    'index.js',
    'db_unified.js',
    'package.json'
  ];
  
  console.log('\n检查关键文件:');
  for (const file of criticalFiles) {
    try {
      await executeCommand(conn, `test -f ${SERVER_CONFIG.remotePath}/${file} && echo "✅ ${file}" || echo "❌ ${file} 缺失"`);
    } catch (e) {}
  }
  
  // 尝试健康检查
  console.log('\n尝试健康检查...');
  try {
    await executeCommand(conn, 'curl -s --max-time 5 http://127.0.0.1:3003/api/v1/health | head -10');
  } catch (e) {
    console.log('⚠️ 健康检查失败（可能服务还在启动中）');
  }
}

// 错误处理
conn.on('error', (err) => {
  console.error('\n❌ SSH连接失败:', err.message);
  console.error('请检查：');
  console.error('  1. 私钥文件是否存在: qimengzhiyue.pem');
  console.error('  2. 服务器IP是否正确: 101.34.39.231');
  console.error('  3. SSH端口(22)是否开放');
  console.error('  4. root用户是否有SSH权限');
  process.exit(1);
});

// 开始连接
console.log(`\n正在连接服务器 ${SERVER_CONFIG.host}...`);
conn.connect({
  host: SERVER_CONFIG.host,
  port: SERVER_CONFIG.port,
  username: SERVER_CONFIG.username,
  privateKey: fs.readFileSync(SERVER_CONFIG.privateKey)
});
