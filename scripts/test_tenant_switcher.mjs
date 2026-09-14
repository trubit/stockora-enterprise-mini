import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8080/api/v1';

async function testCompanySwitching() {
  console.log('1. Logging in as Super Administrator...');
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: 'trustezika831@gmail.com',
    password: 'TRust222$',
  });

  const { accessToken, user } = loginRes.data;
  console.log(`✅ Logged in as: ${user.username} (${user.roleName})`);

  const headers = { Authorization: `Bearer ${accessToken}` };

  console.log('\n2. Fetching available companies for Super Administrator...');
  const tenantsRes = await axios.get(`${API_BASE}/tenants/user-tenants`, { headers });
  console.log(`✅ Found ${tenantsRes.data.length} companies available to switch into:`);
  tenantsRes.data.forEach(t => {
    console.log(`   - [ID: ${t.tenantId}] ${t.tenantName} (${t.tenantSlug}) | Default: ${t.isDefault}`);
  });

  if (tenantsRes.data.length > 1) {
    const target = tenantsRes.data[1];
    console.log(`\n3. Switching company context to: "${target.tenantName}" (${target.tenantId})...`);
    const switchRes = await axios.post(
      `${API_BASE}/tenants/switch`,
      { tenantId: target.tenantId.toString() },
      { headers }
    );
    console.log(`✅ Successfully switched context to: ${switchRes.data.activeTenant.name} (${switchRes.data.activeTenant.slug})!`);
  }

  console.log('\n🎉 Multi-Company Switcher verified successfully!');
}

testCompanySwitching().catch(console.error);
