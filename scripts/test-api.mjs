const BASE = 'http://localhost:3000';

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Origin': BASE
    },
    body: JSON.stringify({ email, password }),
  });
  
  if (!res.ok) {
    const data = await res.json();
    console.error(`Login failed: ${res.status}`, data);
    return null;
  }
  
  // Extract cookies from Set-Cookie headers
  const cookies = res.headers.getSetCookie();
  console.log(`✓ Logged in as ${email}`);
  return cookies;
}

async function testEndpoint(cookies, method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Cookie': cookies.join('; '),
      'Content-Type': 'application/json',
      'Origin': BASE,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    
    const status = res.ok ? '✓' : '✗';
    console.log(`${status} ${method} ${path}: ${res.status}`);
    if (!res.ok && typeof data === 'object') {
      console.log(`  Error: ${JSON.stringify(data)}`);
    }
    return { status: res.status, data };
  } catch (err) {
    console.log(`✗ ${method} ${path}: ${err.message}`);
    return { status: 0, data: null, error: err.message };
  }
}

async function main() {
  console.log('=== Testing API Endpoints ===\n');
  
  // Login as admin
  const adminCookies = await login('admin@docexpert.test', 'Admin123!');
  if (!adminCookies) {
    console.error('Cannot continue without admin login');
    process.exit(1);
  }
  
  console.log('\n--- Admin APIs ---');
  await testEndpoint(adminCookies, 'GET', '/api/admin/users');
  await testEndpoint(adminCookies, 'GET', '/api/admin/models');
  await testEndpoint(adminCookies, 'GET', '/api/admin/audit');
  await testEndpoint(adminCookies, 'GET', '/api/admin/groups');
  await testEndpoint(adminCookies, 'GET', '/api/admin/health');
  await testEndpoint(adminCookies, 'GET', '/api/admin/documents');
  
  console.log('\n--- Documents API ---');
  await testEndpoint(adminCookies, 'GET', '/api/documents');
  
  console.log('\n--- Collections API ---');
  await testEndpoint(adminCookies, 'GET', '/api/collections');
  const createColl = await testEndpoint(adminCookies, 'POST', '/api/collections', {
    name: 'Test Collection',
    description: 'API test',
  });
  
  console.log('\n--- Conversations API ---');
  await testEndpoint(adminCookies, 'GET', '/api/conversations');
  const createConv = await testEndpoint(adminCookies, 'POST', '/api/conversations', {
    title: 'Test Conversation',
  });
  
  console.log('\n--- Templates API ---');
  await testEndpoint(adminCookies, 'GET', '/api/templates');
  await testEndpoint(adminCookies, 'POST', '/api/templates', {
    title: 'Test Template',
    prompt: 'Test prompt',
    category: 'custom',
  });
  
  console.log('\n--- Notifications API ---');
  await testEndpoint(adminCookies, 'GET', '/api/notifications');
  await testEndpoint(adminCookies, 'POST', '/api/notifications/read-all');
  
  console.log('\n--- GraphQL API ---');
  await testEndpoint(adminCookies, 'POST', '/api/graphql', {
    query: '{ conversations { edges { node { id title } } } }',
  });
  
  console.log('\n--- Chat API ---');
  await testEndpoint(adminCookies, 'POST', '/api/chat', {
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'kat-coder-pro-v2.5',
  });
  
  console.log('\n=== Testing Complete ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
