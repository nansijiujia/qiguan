const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n' + '='.repeat(60));
console.log('  快速清理 & 部署工具 (简化版)');
console.log('  ' + new Date().toLocaleString('zh-CN'));
console.log('='.repeat(60) + '\n');

const conn = new Client();

conn.on('ready', async () => {
  console.log('[✅] SSH连接成功！\n');

  try {
    // Step 1: 显示当前状态
    console.log('[Step 1/4] 检查服务器当前状态...');
    await runCmd(conn, 'echo "=== 当前文件列表 ===" && ls /www/wwwroot/qiguan | head -15 && echo "" && echo "=== 磁盘空间 ===" && df -h /www/wwwroot && echo "" && echo "=== PM2 状态 ===" && pm2 list 2>/dev/null || echo "PM2未安装或无进程"');

    // Step 2: 停止服务并清理
    console.log('\n[Step 2/4] 停止服务并清理旧文件...');
    await runCmd(conn, `
      echo "停止 PM2 服务..."
      pm2 stop all 2>/dev/null || true
      pm2 delete all 2>/dev/null || true
      
      echo ""
      echo "⚠️ 开始清理 /www/wwwroot/qiguan ..."
      
      # 创建备份记录
      BACKUP_LOG="/tmp/clean_$(date +%Y%m%d_%H%M%S).log"
      find /www/wwwroot/qiguan -type f > "$BACKUP_LOG" 2>/dev/null
      FILE_COUNT=$(wc -l < "$BACKUP_LOG")
      echo "发现 $FILE_COUNT 个文件将被删除"
      
      # 删除所有内容（保留目录本身）
      rm -rf /www/wwwroot/qiguan/* /www/wwwroot/qiguan/.* 2>/dev/null || true
      
      # 重建目录结构
      mkdir -p /www/wwwroot/qiguan/{logs,uploads,data,backups}
      
      echo "✅ 清理完成！"
      echo "被删除的文件列表: $BACKUP_LOG"
    `);

    // Step 3: 验证清理结果
    console.log('\n[Step 3/4] 验证清理结果...');
    await runCmd(conn, 'ls -la /www/wwwroot/qiguan && echo "" && du -sh /www/wwwroot/qiguan');

    // Step 4: 提示下一步
    console.log('\n[Step 4/4] 准备就绪！');
    console.log('\n' + '='.repeat(60));
    console.log('  ✅ 服务器已清理完毕，等待上传新代码...');
    console.log('='.repeat(60) + '\n');
    
    console.log('下一步操作：');
    console.log('  1. 在另一个终端运行: cd e:\\1\\绮管后台 && node deploy.js');
    console.log('  2. 或手动上传文件到: root@101.34.39.231:/www/wwwroot/qiguan/');
    console.log('  3. 上传完成后运行: pm2 start ecosystem.config.js\n');

  } catch (err) {
    console.error('\n❌ 操作失败:', err.message);
  } finally {
    conn.end();
    process.exit(0);
  }
});

function runCmd(conn, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`   执行: ${cmd.split('\n')[0].trim().substring(0, 80)}...`);
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) { reject(err); return; }
      
      let output = '';
      stream.on('data', data => {
        output += data.toString();
        process.stdout.write(data);
      }).on('close', (code) => {
        if (code === 0 || code === null) resolve(output);
        else reject(new Error(`命令失败(code ${code}): ${output}`));
      });
    });
  });
}

conn.on('error', err => {
  console.error('\n❌ SSH连接错误:', err.message);
  console.error('\n可能的原因:');
  console.error('  1. 私钥文件路径不正确');
  console.error('  2. 服务器IP或端口已更改');
  console.error('  3. root用户SSH权限被禁用');
  console.error('  4. 防火墙阻止了22端口');
  console.error('\n请检查配置后重试。');
  process.exit(1);
});

// 连接配置（与deploy.js一致）
conn.connect({
  host: '101.34.39.231',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync(path.resolve(__dirname, '..', '..', 'qimengzhiyue.pem')),
  readyTimeout: 30000
});

console.log('正在连接服务器...');
