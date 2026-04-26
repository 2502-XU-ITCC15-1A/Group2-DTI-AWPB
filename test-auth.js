// SYSTEM TESTING: feature/user-authentication
// Tests login, JWT, bcrypt, protected routes

const http = require('http');
let testResults = [];
let testNumber = 0;

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function logTest(name, expected, actual, passed) {
  testNumber++;
  const status = passed ? 'PASSED' : 'FAILED';
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} Test #${testNumber}: ${name}`);
  console.log(`   Expected: ${expected}`);
  console.log(`   Actual:   ${actual}`);
  console.log(`   Status:   ${status}`);
  console.log('');
  testResults.push({ testNumber, name, expected, actual, status });
}

async function runTests() {
  console.log('=========================================');
  console.log('  SYSTEM TESTING: feature/user-authentication');
  console.log('  slp-dti-awpb-system');
  console.log('  Branch: feature/user-authentication');
  console.log(`  Date: ${new Date().toLocaleDateString()}`);
  console.log('=========================================\n');

  // TEST 1: Server health check
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
    logTest('Server Health Check', 'Status 200 OK', `Status ${res.statusCode} ${res.body?.status}`, res.statusCode === 200);
  } catch (e) {
    logTest('Server Health Check', 'Status 200 OK', `Error: ${e.message}`, false);
  }

  // TEST 2: Login with empty username
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: '', password: 'password123' });
    logTest('Login with empty username', 'Status 400 validation error', `Status ${res.statusCode}`, res.statusCode === 400);
  } catch (e) {
    logTest('Login with empty username', 'Status 400', `Error: ${e.message}`, false);
  }

  // TEST 3: Login with empty password
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: '' });
    logTest('Login with empty password', 'Status 400 validation error', `Status ${res.statusCode}`, res.statusCode === 400);
  } catch (e) {
    logTest('Login with empty password', 'Status 400', `Error: ${e.message}`, false);
  }

  // TEST 4: Login with wrong password
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'wrongpassword' });
    logTest('Login with wrong password (bcrypt rejection)', 'Status 401 Invalid credentials', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 401);
  } catch (e) {
    logTest('Login with wrong password', 'Status 401', `Error: ${e.message}`, false);
  }

  // TEST 5: Login with non-existent user
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'nonexistent_user', password: 'password123' });
    logTest('Login with non-existent user', 'Status 401 Invalid credentials', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 401);
  } catch (e) {
    logTest('Login with non-existent user', 'Status 401', `Error: ${e.message}`, false);
  }

  // TEST 6: Access protected route without token
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/users', method: 'GET' });
    logTest('Access protected route without token', 'Status 401 Access token required', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 401);
  } catch (e) {
    logTest('Access protected route without token', 'Status 401', `Error: ${e.message}`, false);
  }

  // TEST 7: Access protected route with invalid token
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/users', method: 'GET',
      headers: { 'Authorization': 'Bearer fake.invalid.token' }
    });
    logTest('Access protected route with invalid JWT', 'Status 403 Invalid token', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 403);
  } catch (e) {
    logTest('Access protected route with invalid JWT', 'Status 403', `Error: ${e.message}`, false);
  }

  // TEST 8: Access protected route with expired/malformed token
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/users', method: 'GET',
      headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoxfQ.invalidSignature' }
    });
    logTest('Access protected route with malformed JWT', 'Status 403 Invalid or expired token', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 403);
  } catch (e) {
    logTest('Access protected route with malformed JWT', 'Status 403', `Error: ${e.message}`, false);
  }

  // TEST 9: Access protected route with missing Bearer prefix
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/users', method: 'GET',
      headers: { 'Authorization': 'some-random-token' }
    });
    logTest('Access route with missing Bearer prefix', 'Status 401 or 403 Rejected', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 401 || res.statusCode === 403);
  } catch (e) {
    logTest('Access route with missing Bearer prefix', 'Status 401/403', `Error: ${e.message}`, false);
  }

  // TEST 10: Login endpoint exists and accepts POST
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'password123' });
    logTest('Login endpoint exists (POST /api/auth/login)', 'Endpoint responds (not 404)', `Status ${res.statusCode}`, res.statusCode !== 404);
  } catch (e) {
    logTest('Login endpoint exists', 'Not 404', `Error: ${e.message}`, false);
  }

  // TEST 11: Login with valid credentials (requires admin user in DB)
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'password123' });
    const hasToken = res.body?.token ? true : false;
    const hasUser = res.body?.user ? true : false;
    logTest('Login with valid credentials (JWT generation)', 'Status 200 with JWT token and user data', `Status ${res.statusCode} Token: ${hasToken ? 'received' : 'not received'} User: ${hasUser ? 'received' : 'not received'}`, res.statusCode === 200 && hasToken && hasUser);
  } catch (e) {
    logTest('Login with valid credentials', 'Status 200', `Error: ${e.message}`, false);
  }

  // TEST 12: Access protected route with valid token
  let token = null;
  try {
    const loginRes = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'password123' });
    token = loginRes.body?.token || null;

    if (token) {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/users', method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      logTest('Access protected route with valid JWT', 'Status 200 Access granted', `Status ${res.statusCode}`, res.statusCode === 200);
    } else {
      logTest('Access protected route with valid JWT', 'Status 200 Access granted', 'Skipped - no token (admin user not in DB)', false);
    }
  } catch (e) {
    logTest('Access protected route with valid JWT', 'Status 200', `Error: ${e.message}`, false);
  }

  // SUMMARY
  const passed = testResults.filter(t => t.status === 'PASSED').length;
  const failed = testResults.filter(t => t.status === 'FAILED').length;
  const total = testResults.length;

  console.log('=========================================');
  console.log('  TEST SUMMARY');
  console.log('=========================================');
  console.log(`  Total Tests:  ${total}`);
  console.log(`  Passed:       ${passed}`);
  console.log(`  Failed:       ${failed}`);
  console.log(`  Pass Rate:    ${((passed / total) * 100).toFixed(1)}%`);
  console.log('=========================================');

  console.log('\n📊 Test Results Table:');
  console.log('| Test # | Test Case | Expected | Actual | Status |');
  console.log('|--------|-----------|----------|--------|--------|');
  testResults.forEach(t => {
    console.log(`| ${t.testNumber} | ${t.name} | ${t.expected} | ${t.actual} | ${t.status} |`);
  });
}

runTests().catch(console.error);
