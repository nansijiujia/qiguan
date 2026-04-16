var Client = require('ssh2').Client;
var fs = require('fs');
var path = require('path');

try { require('child_process').execSync("icacls \"" + path.resolve(__dirname, '..', 'qimengzhiyue.pem') + "\" /inheritance:d /grant \"SYSTEM:R\" /grant \"" + process.env.USERNAME + ":R\"", {stdio: 'ignore'}); } catch(e){}

var c = new Client();
c.on('ready', function() {
  console.log('SSH OK - Deploying fix...\n');
  
  var files = [
    { local: path.join(__dirname, 'routes', 'auth.js'), remote: '/www/wwwroot/qiguan/routes/auth.js' },
    { local: path.join(__dirname, 'db_unified.js'), remote: '/www/wwwroot/qiguan/db_unified.js' }
  ];
  var idx = 0;
  
  function uploadNext() {
    if (idx >= files.length) {
      console.log('\nUploads done. Restarting and testing...\n');
      restartAndTest();
      return;
    }
    var f = files[idx++];
    console.log('Uploading: ' + path.basename(f.local));
    c.sftp(function(err, sftp) {
      sftp.fastPut(f.local, f.remote, function(err) {
        if (err) console.error('  Err:', err.message);
        else console.log('  OK: ' + f.remote);
        sftp.end();
        setTimeout(uploadNext, 500);
      });
    });
  }
  
  function restartAndTest() {
    c.exec("pm2 restart backend 2>&1; sleep 10; echo ===LOGIN TEST===; curl -s -X POST http://127.0.0.1:3003/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"admin123\"}'; echo; echo ===END===", function(err, s) {
      if (err) console.error('Err:', err.message);
      var out = '';
      s.on('data', function(d) { out += d.toString(); });
      s.stderr.on('data', function(d) { process.stderr.write('[E]' + d.toString()); });
      s.on('close', function() {
        console.log(out);
        c.end();
        setTimeout(function() { process.exit(0); }, 2000);
      });
    });
  }

  uploadNext();
});
c.on('error', function(e) { console.error('Err:', e.message); process.exit(1); });
c.connect({host:'101.34.39.231', port:22, username:'root', privateKey: fs.readFileSync(path.resolve(__dirname,'..','qimengzhiyue.pem')), readyTimeout:60000});