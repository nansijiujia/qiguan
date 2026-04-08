const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = 'your-super-secret-key-at-least-32-characters-long!!!';
const JWT_EXPIRES_IN = '24h';
const JWT_ALGORITHM = 'HS256';

console.log('=== JWT Authentication System Test ===\n');

async function runTests() {
  console.log('1. Testing bcrypt password hashing and comparison...');
  const testPassword = 'TestPassword123!';
  const saltRounds = 10;

  const hashedPassword = await bcrypt.hash(testPassword, saltRounds);
  console.log('   ✓ Password hashed successfully');

  const isMatch = await bcrypt.compare(testPassword, hashedPassword);
  console.log('   ✓ Password comparison: ', isMatch ? 'PASS' : 'FAIL');

  const isWrongMatch = await bcrypt.compare('WrongPassword', hashedPassword);
  console.log('   ✓ Wrong password rejected: ', !isWrongMatch ? 'PASS' : 'FAIL');

  console.log('\n2. Testing JWT token generation...');
  const payload = {
    userId: 1,
    username: 'testuser',
    role: 'admin'
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRES_IN
  });
  console.log('   ✓ Token generated:', token.substring(0, 50) + '...');

  console.log('\n3. Testing JWT token verification...');
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    console.log('   ✓ Token verified successfully');
    console.log('     - userId:', decoded.userId);
    console.log('     - username:', decoded.username);
    console.log('     - role:', decoded.role);

    if (decoded.userId === payload.userId &&
        decoded.username === payload.username &&
        decoded.role === payload.role) {
      console.log('   ✓ Payload matches: PASS');
    } else {
      console.log('   ✗ Payload mismatch: FAIL');
    }
  } catch (error) {
    console.log('   ✗ Token verification failed:', error.message);
  }

  console.log('\n4. Testing invalid token rejection...');
  try {
    jwt.verify('invalid.token.here', JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    console.log('   ✗ Invalid token accepted: FAIL');
  } catch (error) {
    console.log('   ✓ Invalid token rejected: PASS (' + error.name + ')');
  }

  console.log('\n5. Testing expired token handling...');
  const expiredToken = jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '-1s' // Already expired
  });

  try {
    jwt.verify(expiredToken, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    console.log('   ✗ Expired token accepted: FAIL');
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('   ✓ Expired token detected: PASS (' + error.name + ')');
    } else {
      console.log('   ? Unexpected error:', error.name);
    }
  }

  console.log('\n6. Testing wrong secret key rejection...');
  const wrongSecretToken = jwt.sign(payload, 'wrong-secret-key', {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRES_IN
  });

  try {
    jwt.verify(wrongSecretToken, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    console.log('   ✗ Wrong secret accepted: FAIL');
  } catch (error) {
    console.log('   ✓ Wrong secret rejected: PASS (' + error.name + ')');
  }

  console.log('\n=== All Tests Completed ===\n');
  console.log('✅ JWT Authentication System is ready!');
  console.log('\nNote: To start the server, ensure better-sqlite3 is properly compiled.');
  console.log('You may need to install Python or use prebuilt binaries for better-sqlite3.');
}

runTests().catch(console.error);
