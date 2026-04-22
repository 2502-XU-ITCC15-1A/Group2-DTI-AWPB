// SYSTEM TESTING: feature/user-management
// Tests all user management CRUD operations

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
  console.log('  SYSTEM TESTING: feature/user-management');
  console.log('  slp-dti-awpb-system');
  console.log('  Branch: feature/user-management');
  console.log(`  Date: ${new Date().toLocaleDateString()}`);
  console.log('=========================================\n');

  // TEST 1: Health check
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
    logTest('Server Health Check', 'Status 200 OK', `Status ${res.statusCode} ${res.body?.status}`, res.statusCode === 200);
  } catch (e) {
    logTest('Server Health Check', 'Status 200 OK', `Error: ${e.message}`, false);
  }

  // TEST 2: Get users without token (should fail)
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/users', method: 'GET' });
    logTest('GET /api/users without token', 'Status 401 Access denied', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 401);
  } catch (e) {
    logTest('GET /api/users without token', 'Status 401', `Error: ${e.message}`, false);
  }

  // TEST 3: Login to get token
  let token = null;
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'password123' });
    token = res.body?.token || null;
    logTest('Login to get JWT token', 'Status 200 with token', `Status ${res.statusCode} Token: ${token ? 'received' : 'not received'}`, res.statusCode === 200 && token !== null);
  } catch (e) {
    logTest('Login to get JWT token', 'Status 200 with token', `Error: ${e.message}`, false);
  }

  // TEST 4: Get users with valid token
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/users', method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const userCount = Array.isArray(res.body) ? res.body.length : 0;
    logTest('GET /api/users with valid token', 'Status 200 with user list', `Status ${res.statusCode} Found ${userCount} users`, res.statusCode === 200);
  } catch (e) {
    logTest('GET /api/users with valid token', 'Status 200', `Error: ${e.message}`, false);
  }

  // TEST 5: Create user with missing username
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/users', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, { username: '', fullName: 'Test', email: 'test@dti.gov.ph', password: 'password123', role: 'encoder' });
    logTest('Create user with empty username', 'Validation error (400)', `Status ${res.statusCode}`, res.statusCode === 400 || res.statusCode === 422);
  } catch (e) {
    logTest('Create user with empty username', 'Validation error', `Error: ${e.message}`, false);
  }

  // TEST 6: Create user with missing email
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/users', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, { username: 'enc_test', fullName: 'Test', email: '', password: 'password123', role: 'encoder' });
    logTest('Create user with empty email', 'Validation error (400)', `Status ${res.statusCode}`, res.statusCode === 400 || res.statusCode === 422);
  } catch (e) {
    logTest('Create user with empty email', 'Validation error', `Error: ${e.message}`, false);
  }

  // TEST 7: Create user with short password
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/users', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, { username: 'enc_shortpw', fullName: 'Test User', email: 'short@dti.gov.ph', password: '123', role: 'encoder' });
    logTest('Create user with short password (<8 chars)', 'Validation error (400)', `Status ${res.statusCode}`, res.statusCode === 400 || res.statusCode === 422);
  } catch (e) {
    logTest('Create user with short password', 'Validation error', `Error: ${e.message}`, false);
  }

  // TEST 8: Create valid encoder user
  const testUsername = `enc_test_${Date.now()}`;
  let createdUserId = null;
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/users', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, { username: testUsername, fullName: 'Test Encoder', email: `${testUsername}@dti.gov.ph`, password: 'password123', role: 'encoder' });
    createdUserId = res.body?.user?.id || res.body?.id || null;
    logTest('Create valid encoder account', 'Status 201 User created', `Status ${res.statusCode} User ID: ${createdUserId || 'N/A'}`, res.statusCode === 201 || res.statusCode === 200);
  } catch (e) {
    logTest('Create valid encoder account', 'Status 201', `Error: ${e.message}`, false);
  }

  // TEST 9: Create duplicate username
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/users', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, { username: testUsername, fullName: 'Duplicate User', email: `dup_${testUsername}@dti.gov.ph`, password: 'password123', role: 'encoder' });
    logTest('Create duplicate username', 'Error - username already exists', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 400 || res.statusCode === 409 || res.statusCode === 500);
  } catch (e) {
    logTest('Create duplicate username', 'Error response', `Error: ${e.message}`, false);
  }

  // TEST 10: Update user (if user was created)
  if (createdUserId) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/users/${createdUserId}`, method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      }, { fullName: 'Updated Test Encoder', role: 'encoder' });
      logTest('Update user full name', 'Status 200 User updated', `Status ${res.statusCode}`, res.statusCode === 200);
    } catch (e) {
      logTest('Update user full name', 'Status 200', `Error: ${e.message}`, false);
    }
  } else {
    logTest('Update user full name', 'Status 200', 'Skipped - no user created', false);
  }

  // TEST 11: Delete user (if user was created)
  if (createdUserId) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/users/${createdUserId}`, method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      logTest('Delete user account', 'Status 200 User deleted', `Status ${res.statusCode}`, res.statusCode === 200);
    } catch (e) {
      logTest('Delete user account', 'Status 200', `Error: ${e.message}`, false);
    }
  } else {
    logTest('Delete user account', 'Status 200', 'Skipped - no user created', false);
  }

  // TEST 12: Create user without authentication token
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/users', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'enc_noauth', fullName: 'No Auth', email: 'noauth@dti.gov.ph', password: 'password123', role: 'encoder' });
    logTest('Create user without auth token', 'Status 401 Access denied', `Status ${res.statusCode}`, res.statusCode === 401);
  } catch (e) {
    logTest('Create user without auth token', 'Status 401', `Error: ${e.message}`, false);
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
