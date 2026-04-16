const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

try { require('child_process').execSync(`icacls "${path.resolve(__dirname, '..', 'qimengzhiyue.pem')}" /inheritance:d /grant "SYSTEM:R" /grant "${process.env.USERNAME}:R"`, {stdio: 'ignore'}); } catch(e){}

const conn = new Client();
const distPath = path.resolve(__dirname, 'qiguanqianduan', 'dist');
const backendPath = __dirname;
const backendRemote = '/www/wwwroot/qiguan';

const configFiles = [
  {
    local: path.resolve(__dirname, '.env.production'),
    remote: '/www/wwwroot/qiguan/.env.production',
    mode: 0o600
  }
];

const skipDirs = ['node_modules', '.git', 'qiguanqianduan', 'dist', 'data', 'logs', 'uploads'];
const skipFiles = ['.env', '.env.local', '*.pem', '*.log'];

function shouldSkipFile(filePath) {
  const basename = path.basename(filePath);
  if (skipFiles.some(pattern => {
    if (pattern.startsWith('*')) return basename.endsWith(pattern.slice(1));
    return basename === pattern;
  })) return true;
  return false;
}

conn.on('ready', function() {
  console.log('OK');

  const envLocalPath = path.resolve(__dirname, '.env.production');
  const envRemotePath = '/www/wwwroot/qiguan/.env.production';

  if (!fs.existsSync(envLocalPath)) {
    console.error('❌ Required file .env.production not found. Aborting deployment.');
    conn.end();
    process.exit(1);
    return;
  }

  console.log('[Deploy] Uploading .env.production...');
  conn.sftp(function(err, sftp) {
    if (err) {
      console.error('❌ SFTP error:', err.message);
      conn.end();
      process.exit(1);
      return;
    }
    sftp.fastPut(envLocalPath, envRemotePath, { mode: 0o600 }, function(err) {
      if (err) {
        console.error('❌ .env.production upload failed:', err.message);
        sftp.end();
        conn.end();
        process.exit(1);
        return;
      }
      console.log('[Deploy] ✅ .env.production uploaded successfully');
      sftp.end();
      startFileUpload();
    });
  });

  function startFileUpload() {
    const allFiles = [];

    // 前端文件
    (function walk(dir, base) {
    fs.readdirSync(dir).forEach(f => {
      const fp = path.join(dir, f);
      const rp = (base + '/' + f).replace(/\\/g, '/');
      if (fs.statSync(fp).isDirectory()) {
        walk(fp, rp);
      } else {
        // 直接上传到根目录，与index.html同级别
        allFiles.push({local:fp, remote:'/www/wwwroot/qiguan'+rp});
      }
    });
  })(distPath, '');
  
  // 后端JS源码文件
  (function walk(dir, base) {
    try {
      fs.readdirSync(dir).forEach(f => {
        const fp = path.join(dir, f);
        const rp = (base + '/' + f).replace(/\\/g, '/');
        const stat = fs.statSync(fp);
        if (stat.isDirectory()) {
          if (!skipDirs.includes(f)) walk(fp, rp);
        } else {
          if (f.endsWith('.js') && !shouldSkipFile(fp)) {
            allFiles.push({local: fp, remote: backendRemote + rp});
          }
        }
      });
    } catch(e) {}
  })(backendPath, '');
  
  console.log('Files to upload: ' + allFiles.length);
  
  let idx = 0;
  function uploadNext() {
    if (idx >= allFiles.length) { done(); return; }
    
    const f = allFiles[idx++];
    conn.sftp(function(err, sftp) {
      sftp.fastPut(f.local, f.remote, function(err) {
        if (err && idx < 10) console.error('Err:', err.message);
        if (idx % 10 === 0 || idx === allFiles.length) process.stdout.write('\r' + idx + '/' + allFiles.length);
        sftp.end();
        setTimeout(uploadNext, 50);
      });
    });
  }
  
  uploadNext();
  }

  function done() {
    console.log('\n✅ All files uploaded! Uploading configuration files...');

    let configIdx = 0;
    function uploadConfigNext() {
      if (configIdx >= configFiles.length) {
        console.log('✅ Configuration files uploaded');
        console.log('Starting backend...');
        startBackend();
        return;
      }

      const cf = configFiles[configIdx++];
      if (fs.existsSync(cf.local)) {
        console.log(`  ✅ Uploading: ${path.basename(cf.local)}`);
        conn.sftp(function(err, sftp) {
          sftp.fastPut(cf.local, cf.remote, { mode: cf.mode }, function(err) {
            if (err) console.error('  ❌ Config upload error:', err.message);
            else console.log(`  ✅ Uploaded: ${cf.remote}`);
            sftp.end();
            setTimeout(uploadConfigNext, 100);
          });
        });
      } else {
        console.warn(`  ⚠️  Config file not found, skipping: ${cf.local}`);
        uploadConfigNext();
      }
    }
    uploadConfigNext();
  }
  
  function startBackend() {
    conn.exec(`
pm2 stop backend 2>/dev/null; pm2 delete backend 2>/dev/null; pkill -f "node.*index.js" 2>/dev/null; sleep 2
cd /www/wwwroot/qiguan && npm install --production >/dev/null 2>&1 || true
pm2 start index.js --name backend && sleep 2
echo "[Deploy] 🔄 Restarting PM2 to reload environment variables..."
pm2 restart backend --update-env && sleep 2
echo "[Deploy] ✅ PM2 restarted successfully, environment variables reloaded"
echo "--- Health Check ---"
HTTP_CODE=\$(curl -sI --max-time 5 --connect-timeout 5 http://127.0.0.1:3003/api/v1/health 2>&1 | head -1)
FULL_RESP=\$(curl -sI --max-time 5 --connect-timeout 5 http://127.0.0.1:3003/api/v1/health 2>&1 | head -5)
echo "\$HTTP_CODE"
if echo "\$HTTP_CODE" | grep -q "200"; then
  echo "✅ Backend health check PASSED (HTTP 200)"
else
  echo "❌ Backend health check FAILED"
  echo "--- Full Response ---"
  echo "\$FULL_RESP"
  echo "--- PM2 Status ---"
  pm2 list 2>/dev/null | grep backend || echo "backend process not found"
fi
echo ""
echo "--- Login Test ---"
curl -s -X POST http://127.0.0.1:3003/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' --max-time 5
echo ""
echo "Visit https://www.qimengzhiyue.cn/admin"
    `, function(e, s) {
      s.on('data', d => process.stdout.write(d.toString()));
      s.stderr.on('data', d => process.stderr.write(d.toString()));
      s.on('close', () => { conn.end(); setTimeout(process.exit,2000); });
    });
  }
});

conn.on('error', e => { console.error('Err:', e.message); process.exit(1); });
conn.connect({host:'101.34.39.231', port:22, username:'root', 
  privateKey: fs.readFileSync(path.resolve(__dirname,'..','qimengzhiyue.pem')), readyTimeout:30000});