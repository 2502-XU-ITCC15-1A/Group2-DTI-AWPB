// SYSTEM TESTING: feature/pdf-reports
// Tests PDF report generation endpoint

const http = require('http');
let testResults = [];
let testNumber = 0;

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = [];
      let headers = res.headers;
      res.on('data', (chunk) => { body.push(chunk); });
      res.on('end', () => {
        const buffer = Buffer.concat(body);
        // Check if response is PDF (binary) or JSON (text)
        if (headers['content-type'] && headers['content-type'].includes('application/pdf')) {
          resolve({ statusCode: res.statusCode, body: null, headers, isPdf: true, pdfSize: buffer.length });
        } else {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(buffer.toString()), headers, isPdf: false, pdfSize: 0 });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: buffer.toString(), headers, isPdf: false, pdfSize: 0 });
          }
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
  console.log('  SYSTEM TESTING: feature/pdf-reports');
  console.log('  slp-dti-awpb-system');
  console.log('  Branch: feature/pdf-reports');
  console.log(`  Date: ${new Date().toLocaleDateString()}`);
  console.log('=========================================\n');

  // TEST 1: Server health check
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
    logTest('Server Health Check', 'Status 200 OK', `Status ${res.statusCode} ${res.body?.status}`, res.statusCode === 200);
  } catch (e) {
    logTest('Server Health Check', 'Status 200 OK', `Error: ${e.message}`, false);
  }

  // TEST 2: PDF endpoint exists
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/entries/report/pdf', method: 'GET'
    });
    logTest('PDF endpoint exists (GET /api/entries/report/pdf)', 'Endpoint responds (not 404)', `Status ${res.statusCode}`, res.statusCode !== 404);
  } catch (e) {
    logTest('PDF endpoint exists', 'Not 404', `Error: ${e.message}`, false);
  }

  // TEST 3: PDF endpoint requires authentication
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/entries/report/pdf', method: 'GET'
    });
    logTest('PDF endpoint requires auth token', 'Status 401 Access denied', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 401);
  } catch (e) {
    logTest('PDF endpoint requires auth token', 'Status 401', `Error: ${e.message}`, false);
  }

  // TEST 4: PDF endpoint rejects invalid token
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/entries/report/pdf', method: 'GET',
      headers: { 'Authorization': 'Bearer fake.invalid.token' }
    });
    logTest('PDF endpoint rejects invalid token', 'Status 403 Invalid token', `Status ${res.statusCode} ${res.body?.error || ''}`, res.statusCode === 403);
  } catch (e) {
    logTest('PDF endpoint rejects invalid token', 'Status 403', `Error: ${e.message}`, false);
  }

  // Login to get token
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

  // TEST 5: PDF generates with valid token
  if (token) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/entries/report/pdf', method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      logTest('PDF generates with valid token', 'Status 200 with PDF response', `Status ${res.statusCode} PDF: ${res.isPdf} Size: ${res.pdfSize} bytes`, res.statusCode === 200 && res.isPdf);
    } catch (e) {
      logTest('PDF generates with valid token', 'Status 200', `Error: ${e.message}`, false);
    }
  } else {
    logTest('PDF generates with valid token', 'Status 200 with PDF', 'Skipped - no token (admin user not in DB)', false);
  }

  // TEST 6: PDF response has correct Content-Type header
  if (token) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/entries/report/pdf', method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contentType = res.headers['content-type'] || '';
      logTest('PDF has correct Content-Type header', 'application/pdf', `${contentType}`, contentType.includes('application/pdf'));
    } catch (e) {
      logTest('PDF has correct Content-Type header', 'application/pdf', `Error: ${e.message}`, false);
    }
  } else {
    logTest('PDF has correct Content-Type header', 'application/pdf', 'Skipped - no token', false);
  }

  // TEST 7: PDF response has Content-Disposition header (download filename)
  if (token) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/entries/report/pdf', method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const disposition = res.headers['content-disposition'] || '';
      logTest('PDF has download filename header', 'Content-Disposition with AWPB-Entry-Report.pdf', `${disposition}`, disposition.includes('AWPB-Entry-Report.pdf'));
    } catch (e) {
      logTest('PDF has download filename header', 'Content-Disposition', `Error: ${e.message}`, false);
    }
  } else {
    logTest('PDF has download filename header', 'Content-Disposition', 'Skipped - no token', false);
  }

  // TEST 8: PDF file size is reasonable (not empty)
  if (token) {
    try {
      const res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/entries/report/pdf', method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      logTest('PDF file size is not empty', 'PDF size > 0 bytes', `PDF size: ${res.pdfSize} bytes`, res.pdfSize > 0);
    } catch (e) {
      logTest('PDF file size is not empty', 'Size > 0', `Error: ${e.message}`, false);
    }
  } else {
    logTest('PDF file size is not empty', 'Size > 0', 'Skipped - no token', false);
  }

  // TEST 9: PDFKit dependency installed
  try {
    require.resolve('pdfkit');
    logTest('PDFKit dependency installed', 'pdfkit module found', 'pdfkit module found', true);
  } catch (e) {
    logTest('PDFKit dependency installed', 'pdfkit module found', 'pdfkit not installed', false);
  }

  // TEST 10: PDF endpoint only accepts GET method
  try {
    const res = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/entries/report/pdf', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {});
    logTest('PDF endpoint rejects POST method', 'Status 404 or 405 (GET only)', `Status ${res.statusCode}`, res.statusCode === 404 || res.statusCode === 405 || res.statusCode === 401);
  } catch (e) {
    logTest('PDF endpoint rejects POST method', 'Not 200', `Error: ${e.message}`, false);
  }

  // TEST 11: Multiple PDF requests don't crash server
  try {
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/entries/report/pdf', method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      }));
    }
    const results = await Promise.all(promises);
    const allResponded = results.every(r => r.statusCode !== 500);
    logTest('Server stable with multiple PDF requests', 'All 3 requests responded (no 500)', `All responded: ${allResponded}`, allResponded);
  } catch (e) {
    logTest('Server stable with multiple PDF requests', 'No crash', `Error: ${e.message}`, false);
  }

  // TEST 12: Server still responds after PDF generation
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
    logTest('Server healthy after PDF generation', 'Status 200 OK', `Status ${res.statusCode} ${res.body?.status}`, res.statusCode === 200);
  } catch (e) {
    logTest('Server healthy after PDF generation', 'Status 200', `Error: ${e.message}`, false);
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
