const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', function() {
  console.log('SSH connected!');
  
  conn.exec(`
echo "=== PM2 Status ==="
pm2 list 2>/dev/null || echo "PM2 not responding"
echo ""
echo "=== Check if node is running ==="
ps aux | grep node | grep -v grep || echo "No node processes"
echo ""
echo "=== Try to start backend ==="
cd /www/wwwroot/qiguan && pm2 stop backend 2>/dev/null; pm2 delete backend 2>/dev/null
pm2 start index.js --name backend 2>&1
echo ""
sleep 5
echo "=== PM2 Status After Start ==="
pm2 list
echo ""
echo "=== Health Check (local) ==="
curl -s -w "\\nHTTP: %{http_code}\\n" http://127.0.0.1:3003/api/v1/health || echo "Health check failed"
echo ""
echo "=== Backend Logs (last 20 lines) ==="
pm2 logs backend --lines 20 --nostream 2>/dev/null || echo "No logs available"
  `, function(err, stream) {
    if (err) { console.error('Exec error:', err.message); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => { 
      console.log('\\n=== Done ===');
      conn.end(); 
      setTimeout(() => process.exit(0), 1000);
    });
  });
});

conn.on('error', e => { console.error('SSH Error:', e.message); process.exit(1); });
conn.connect({
  host: '101.34.39.231',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync(path.resolve(__dirname, '..', 'qimengzhiyue.pem')),
  readyTimeout: 30000
});
