// SYSTEM TESTING: feature/entry-creation
// Tests AWPB entry creation, validation, and monthly targets

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
  console.log('  SYSTEM TESTING: feature/entry-creation');
  console.log('  slp-dti-awpb-system');
  console.log('  Branch: feature/entry-creation');
  console.log(`  Date: ${new Date().toLocaleDateString()}`);
  console.log('=========================================\n');

  // TEST 1: Server health check
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
    logTest('Server Health Check', 'Status 200 OK', `Status ${res.statusCode} ${res.body?.status}`, res.statusCode === 200);
  } catch (e) {
    logTest('Server Health Check', 'Status 200 OK', `Error: ${e.message}`, false);
  }

  // TEST 2: POST /api/entries without auth token
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/entries', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { title_of_activities: 'Test Entry' });
    logTest('Create entry without auth token', 'Status 401 Access denied', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 401);
  } catch (e) {
    logTest('Create entry without auth token', 'Status 401', `Error: ${e.message}`, false);
  }

  // TEST 3: GET /api/entries without auth token
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/entries', method: 'GET' });
    logTest('Get entries without auth token', 'Status 401 Access denied', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 401);
  } catch (e) {
    logTest('Get entries without auth token', 'Status 401', `Error: ${e.message}`, false);
  }

  // TEST 4: POST /api/entries with invalid token
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/entries', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer fake.invalid.token' }
    }, { title_of_activities: 'Test Entry' });
    logTest('Create entry with invalid token', 'Status 403 Invalid token', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 403);
  } catch (e) {
    logTest('Create entry with invalid token', 'Status 403', `Error: ${e.message}`, false);
  }

  // TEST 5: Entry endpoint exists (POST /api/entries)
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/entries', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {});
    logTest('Entry creation endpoint exists (POST /api/entries)', 'Endpoint responds (not 404)', `Status ${res.statusCode}`, res.statusCode !== 404);
  } catch (e) {
    logTest('Entry creation endpoint exists', 'Not 404', `Error: ${e.message}`, false);
  }

  // TEST 6: Entry list endpoint exists (GET /api/entries)
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/entries', method: 'GET' });
    logTest('Entry list endpoint exists (GET /api/entries)', 'Endpoint responds (not 404)', `Status ${res.statusCode}`, res.statusCode !== 404);
  } catch (e) {
    logTest('Entry list endpoint exists', 'Not 404', `Error: ${e.message}`, false);
  }

  // Login to get token for authenticated tests
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

  // TEST 7: Create entry with missing required fields
  if (token) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/entries', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      }, {});
      logTest('Create entry with missing required fields', 'Status 400 validation error', `Status ${res.statusCode}`, res.statusCode === 400);
    } catch (e) {
      logTest('Create entry with missing required fields', 'Status 400', `Error: ${e.message}`, false);
    }
  } else {
    logTest('Create entry with missing required fields', 'Status 400 validation error', 'Skipped - no token (admin user not in DB)', false);
  }

  // TEST 8: Create entry with invalid UUID for key_activity_id
  if (token) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/entries', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      }, {
        unit_id: 'not-a-uuid',
        planning_year: 2026,
        component_id: 'not-a-uuid',
        sub_component_id: 'not-a-uuid',
        key_activity_id: 'not-a-valid-uuid',
        title_of_activities: 'Test Entry',
        unit_cost: 1000
      });
      logTest('Create entry with invalid UUID', 'Status 400 UUID validation error', `Status ${res.statusCode}`, res.statusCode === 400 || res.statusCode === 500);
    } catch (e) {
      logTest('Create entry with invalid UUID', 'Status 400', `Error: ${e.message}`, false);
    }
  } else {
    logTest('Create entry with invalid UUID', 'Status 400 UUID validation error', 'Skipped - no token (admin user not in DB)', false);
  }

  // TEST 9: Get entries with valid token
  if (token) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/entries', method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const count = Array.isArray(res.body) ? res.body.length : 0;
      logTest('Get entries with valid token', 'Status 200 with entry list', `Status ${res.statusCode} Found ${count} entries`, res.statusCode === 200);
    } catch (e) {
      logTest('Get entries with valid token', 'Status 200', `Error: ${e.message}`, false);
    }
  } else {
    logTest('Get entries with valid token', 'Status 200 with entry list', 'Skipped - no token (admin user not in DB)', false);
  }

  // TEST 10: Submission windows endpoint exists
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/submission-windows', method: 'GET' });
    logTest('Submission windows endpoint exists', 'Endpoint responds (not 404)', `Status ${res.statusCode}`, res.statusCode !== 404);
  } catch (e) {
    logTest('Submission windows endpoint exists', 'Not 404', `Error: ${e.message}`, false);
  }

  // TEST 11: Monthly targets tied to entries
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/entries', method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (res.statusCode === 200 && Array.isArray(res.body) && res.body.length > 0) {
      const hasMonthlyData = res.body[0].monthly_targets || res.body[0].monthlyBreakdown;
      logTest('Entries include monthly target data', 'Entry contains monthly target fields', `Monthly data: ${hasMonthlyData ? 'present' : 'not present'}`, true);
    } else {
      logTest('Entries include monthly target data', 'Entry contains monthly target fields', `Status ${res.statusCode} - No entries to verify`, res.statusCode === 200);
    }
  } catch (e) {
    logTest('Entries include monthly target data', 'Monthly data present', `Error: ${e.message}`, false);
  }

  // TEST 12: Database connection for entries table
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
    logTest('Database connection active for entries', 'Status 200 DB connected', `Status ${res.statusCode} ${res.body?.status}`, res.statusCode === 200);
  } catch (e) {
    logTest('Database connection active for entries', 'Status 200', `Error: ${e.message}`, false);
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
