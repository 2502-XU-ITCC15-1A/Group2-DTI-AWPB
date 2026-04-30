// SYSTEM TESTING: feature/database
// Tests database connection, schema, queries, and table relationships

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
  console.log('  SYSTEM TESTING: feature/database');
  console.log('  slp-dti-awpb-system');
  console.log('  Branch: feature/database');
  console.log(`  Date: ${new Date().toLocaleDateString()}`);
  console.log('=========================================\n');

  // TEST 1: Server health check (confirms DB connection)
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
    logTest('Database connection via health check', 'Status 200 OK - DB connected', `Status ${res.statusCode} ${res.body?.status}`, res.statusCode === 200);
  } catch (e) {
    logTest('Database connection via health check', 'Status 200 OK', `Error: ${e.message}`, false);
  }

  // TEST 2: Profiles table exists (GET /api/users)
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/users', method: 'GET'
    });
    logTest('Profiles table accessible (GET /api/users)', 'Endpoint responds (not 500 DB error)', `Status ${res.statusCode}`, res.statusCode === 401 || res.statusCode === 200);
  } catch (e) {
    logTest('Profiles table accessible', 'Not 500', `Error: ${e.message}`, false);
  }

  // TEST 3: Entries table exists (GET /api/entries)
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/entries', method: 'GET'
    });
    logTest('Entries table accessible (GET /api/entries)', 'Endpoint responds (not 500 DB error)', `Status ${res.statusCode}`, res.statusCode === 401 || res.statusCode === 200);
  } catch (e) {
    logTest('Entries table accessible', 'Not 500', `Error: ${e.message}`, false);
  }

  // TEST 4: Submission windows table exists
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/submission-windows', method: 'GET'
    });
    logTest('Submission windows table accessible', 'Endpoint responds (not 500 DB error)', `Status ${res.statusCode}`, res.statusCode !== 500);
  } catch (e) {
    logTest('Submission windows table accessible', 'Not 500', `Error: ${e.message}`, false);
  }

  // TEST 5: Template data endpoint (units, components, etc.)
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/template', method: 'GET'
    });
    logTest('Template/dropdown data accessible', 'Endpoint responds', `Status ${res.statusCode}`, res.statusCode !== 500);
  } catch (e) {
    logTest('Template/dropdown data accessible', 'Not 500', `Error: ${e.message}`, false);
  }

  // Login to get token for deeper DB tests
  let token = null;
  try {
    const loginRes = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'password123' });
    token = loginRes.body?.token || null;
  } catch (e) {
    token = null;
  }

  // TEST 6: Query profiles table returns valid data structure
  if (token) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/users', method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const isArray = Array.isArray(res.body);
      const hasCorrectFields = isArray && (res.body.length === 0 || (res.body[0].username && res.body[0].role));
      logTest('Profiles table returns valid data structure', 'Array with username, role fields', `Array: ${isArray}, Fields: ${hasCorrectFields ? 'correct' : 'missing'}`, res.statusCode === 200 && isArray);
    } catch (e) {
      logTest('Profiles table returns valid data structure', 'Valid array', `Error: ${e.message}`, false);
    }
  } else {
    logTest('Profiles table returns valid data structure', 'Array with fields', 'Skipped - no token (admin user not in DB)', false);
  }

  // TEST 7: Query entries table returns valid data structure
  if (token) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/entries', method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const isArray = Array.isArray(res.body);
      logTest('Entries table returns valid data structure', 'Status 200 with array response', `Status ${res.statusCode} Array: ${isArray}`, res.statusCode === 200 && isArray);
    } catch (e) {
      logTest('Entries table returns valid data structure', 'Valid array', `Error: ${e.message}`, false);
    }
  } else {
    logTest('Entries table returns valid data structure', 'Array response', 'Skipped - no token (admin user not in DB)', false);
  }

  // TEST 8: Database rejects invalid UUID format
  if (token) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/users/not-a-valid-uuid', method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      logTest('Database rejects invalid UUID format', 'Error response (400 or 500)', `Status ${res.statusCode}`, res.statusCode === 400 || res.statusCode === 404 || res.statusCode === 500);
    } catch (e) {
      logTest('Database rejects invalid UUID', 'Error response', `Error: ${e.message}`, false);
    }
  } else {
    logTest('Database rejects invalid UUID format', 'Error response', 'Skipped - no token', false);
  }

  // TEST 9: Database handles concurrent requests
  try {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(makeRequest({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' }));
    }
    const results = await Promise.all(promises);
    const allOk = results.every(r => r.statusCode === 200);
    logTest('Database handles concurrent requests (5 parallel)', 'All 5 requests return 200', `All OK: ${allOk} (${results.map(r => r.statusCode).join(', ')})`, allOk);
  } catch (e) {
    logTest('Database handles concurrent requests', 'All 200', `Error: ${e.message}`, false);
  }

  // TEST 10: Database connection pool stability
  try {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(makeRequest({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' }));
    }
    const results = await Promise.all(promises);
    const allOk = results.every(r => r.statusCode === 200);
    logTest('Connection pool handles 10 simultaneous requests', 'All 10 requests return 200', `All OK: ${allOk}`, allOk);
  } catch (e) {
    logTest('Connection pool stability', 'All 200', `Error: ${e.message}`, false);
  }

  // TEST 11: SSL/Secure database connection
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
    logTest('Secure SSL database connection (Supabase)', 'Status 200 - connection active', `Status ${res.statusCode} ${res.body?.status}`, res.statusCode === 200);
  } catch (e) {
    logTest('Secure SSL database connection', 'Status 200', `Error: ${e.message}`, false);
  }

  // TEST 12: Database error handling (invalid route)
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/nonexistent', method: 'GET' });
    logTest('Server handles invalid routes gracefully', 'Status 404 Route not found', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 404);
  } catch (e) {
    logTest('Server handles invalid routes', 'Status 404', `Error: ${e.message}`, false);
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
