const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', function() {
  console.log('SSH connected! Running DB diagnosis...\n');
  
  conn.exec(`
DB_PASS='LJN040821.'

echo "=== 1. SHOW TABLES ==="
mysql -h 10.0.0.16 -u QMZYXCX -p"$DB_PASS" qmzyxcx -e "SHOW TABLES;" 2>&1

echo ""
echo "=== 2. DESCRIBE users ==="
mysql -h 10.0.0.16 -u QMZYXCX -p"$DB_PASS" qmzyxcx -e "DESCRIBE users;" 2>&1

echo ""
echo "=== 3. DESCRIBE products ==="
mysql -h 10.0.0.16 -u QMZYXCX -p"$DB_PASS" qmzyxcx -e "DESCRIBE products;" 2>&1

echo ""
echo "=== 4. DESCRIBE customers ==="
mysql -h 10.0.0.16 -u QMZYXCX -p"$DB_PASS" qmzyxcx -e "DESCRIBE customers;" 2>&1

echo ""
echo "=== 5. DESCRIBE orders ==="
mysql -h 10.0.0.16 -u QMZYXCX -p"$DB_PASS" qmzyxcx -e "DESCRIBE orders;" 2>&1

echo ""
echo "=== 6. TEST: Products with JOIN + LIMIT/OFFSET (prepared stmt style) ==="
mysql -h 10.0.0.16 -u QMZYXCX -p"$DB_PASS" qmzyxcx -e "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC LIMIT 10 OFFSET 0;" 2>&1

echo ""
echo "=== 7. TEST: Customers basic ==="
mysql -h 10.0.0.16 -u QMZYXCX -p"$DB_PASS" qmzyxcx -e "SELECT id, nickname, phone, status FROM customers LIMIT 3;" 2>&1

echo ""
echo "=== 8. TEST: Orders basic ==="
mysql -h 10.0.0.16 -u QMZYXCX -p"$DB_PASS" qmzyxcx -e "SELECT id, order_no, status, user_id FROM orders LIMIT 3;" 2>&1

echo ""
echo "=== 9. TEST: Users with columns from code ==="
mysql -h 10.0.0.16 -u QMZYXCX -p"$DB_PASS" qmzyxcx -e "SELECT id, username, email, avatar, role, status, last_login, created_at FROM users LIMIT 3;" 2>&1
  `, function(err, stream) {
    if (err) { console.error('Exec error:', err.message); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => { 
      console.log('\n=== Diagnosis Complete ===');
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
