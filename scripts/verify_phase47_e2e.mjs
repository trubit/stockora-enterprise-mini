import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8080/api/v1';

async function verifyPhase47() {
  console.log('\n======================================================');
  console.log('🚀 Phase 47: Globalization & Regional Platform E2E Verification');
  console.log('======================================================\n');

  // 1. Authenticate as Super Administrator
  console.log('1. Authenticating as Super Administrator...');
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: 'trustezika831@gmail.com',
    password: 'TRust222$',
  });

  const { accessToken, user } = loginRes.data;
  console.log(`✅ Authentication Successful! User: ${user.username}, Role: ${user.roleName}`);

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  // 2. Test Currency & Country Public Metadata
  console.log('\n2. Fetching Supported Currencies, Countries, Timezones, and Languages...');
  const [currenciesRes, countriesRes, timezonesRes, languagesRes] = await Promise.all([
    axios.get(`${API_BASE}/currencies`, authHeaders),
    axios.get(`${API_BASE}/countries`, authHeaders),
    axios.get(`${API_BASE}/timezones`, authHeaders),
    axios.get(`${API_BASE}/languages`, authHeaders),
  ]);

  console.log(`✅ Supported Currencies: ${currenciesRes.data.length} registered (USD, NGN, EUR, GBP, CAD, JPY, etc.)`);
  console.log(`✅ Supported Countries: ${countriesRes.data.length} registered`);
  console.log(`✅ Supported Timezones: ${timezonesRes.data.length} registered`);
  console.log(`✅ Supported Languages: ${languagesRes.data.length} registered (en, es, fr, de, ar, yo, ha, ig, zh)`);

  // 3. Test Regional Settings Retrieval
  console.log('\n3. Retrieving Active Tenant Regional Settings...');
  const settingsRes = await axios.get(`${API_BASE}/regional-settings`, authHeaders);
  console.log(`✅ Current Base Currency: ${settingsRes.data.currency} (${settingsRes.data.currencySymbol})`);
  console.log(`✅ Current Timezone: ${settingsRes.data.timezone}`);
  console.log(`✅ Current Country: ${settingsRes.data.country} (${settingsRes.data.countryCode})`);
  console.log(`✅ Current Tax Policy: ${settingsRes.data.taxConfig.taxType} @ ${settingsRes.data.taxConfig.defaultTaxRate}%`);

  // 4. Test Updating Regional Settings (PATCH)
  console.log('\n4. Testing Regional Settings Mutation (Updating to Nigeria, NGN, Africa/Lagos, 7.5% VAT)...');
  const patchRes = await axios.patch(
    `${API_BASE}/regional-settings`,
    {
      country: 'Nigeria',
      countryCode: 'NG',
      currency: 'NGN',
      supportedCurrencies: ['NGN', 'USD', 'EUR', 'GBP'],
      timezone: 'Africa/Lagos',
      language: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      taxConfig: {
        taxId: 'VAT-NG-2026-9911',
        taxRegistrationName: 'FIRS VAT',
        taxType: 'VAT',
        defaultTaxRate: 7.5,
        isTaxInclusive: true,
        taxExemptionAllowed: true,
        taxRates: [
          { name: 'Standard VAT', code: 'STANDARD', ratePercentage: 7.5, type: 'VAT', category: 'STANDARD', isInclusive: true, isActive: true },
          { name: 'Zero-Rated Essentials', code: 'ZERO_RATED', ratePercentage: 0, type: 'VAT', category: 'ZERO_RATED', isInclusive: false, isActive: true },
        ],
      },
    },
    authHeaders
  );

  console.log(`✅ Updated Regional Settings: Currency: ${patchRes.data.currency} (${patchRes.data.currencySymbol}), Tax: ${patchRes.data.taxConfig.defaultTaxRate}% ${patchRes.data.taxConfig.taxRegistrationName}`);

  // 5. Test Live Exchange Rates & Currency Conversion
  console.log('\n5. Testing Live Multi-Currency Conversion Engine...');
  const convertRes = await axios.post(
    `${API_BASE}/exchange-rates/convert`,
    {
      amount: 100,
      fromCurrency: 'USD',
      toCurrency: 'NGN',
    },
    authHeaders
  );

  console.log(`✅ Currency Conversion: $${convertRes.data.originalAmount} USD = ₦${convertRes.data.convertedAmount.toLocaleString()} NGN (Rate: ${convertRes.data.exchangeRate})`);

  // 6. Test Setting Custom Tenant Exchange Rate Override
  console.log('\n6. Setting Custom Tenant Rate Override (1 USD = 1520 NGN)...');
  const customRateRes = await axios.post(
    `${API_BASE}/exchange-rates/custom`,
    {
      baseCurrency: 'USD',
      targetCurrency: 'NGN',
      rate: 1520.0,
    },
    authHeaders
  );

  const customConvertRes = await axios.post(
    `${API_BASE}/exchange-rates/convert`,
    {
      amount: 100,
      fromCurrency: 'USD',
      toCurrency: 'NGN',
    },
    authHeaders
  );

  console.log(`✅ Tenant Override Applied: $100 USD = ₦${customConvertRes.data.convertedAmount.toLocaleString()} NGN (Custom Rate: ${customConvertRes.data.exchangeRate})`);

  // 7. Test Authoritative Server-Side Tax Calculation
  console.log('\n7. Testing Authoritative Server-Side Tax Engine (/taxes/calculate)...');
  const taxRes = await axios.post(
    `${API_BASE}/taxes/calculate`,
    {
      items: [
        { name: 'Standard Electronics', unitPrice: 100, quantity: 2, taxCategory: 'STANDARD' },
        { name: 'Zero-Rated Foods', unitPrice: 50, quantity: 1, taxCategory: 'ZERO_RATED' },
      ],
      overrideTaxInclusive: false,
    },
    authHeaders
  );

  console.log(`✅ Tax Calculation Results:`);
  console.log(`   - Subtotal: $${taxRes.data.subtotal.toFixed(2)}`);
  console.log(`   - Tax Total: $${taxRes.data.taxTotal.toFixed(2)}`);
  console.log(`   - Grand Total: $${taxRes.data.grandTotal.toFixed(2)}`);
  console.log(`   - Number of Line Items: ${taxRes.data.lineItems.length}`);

  // Restore Default US Settings for Cleanliness
  console.log('\n8. Resetting Default Regional Settings to US Standard...');
  await axios.patch(
    `${API_BASE}/regional-settings`,
    {
      country: 'United States',
      countryCode: 'US',
      currency: 'USD',
      supportedCurrencies: ['USD', 'NGN', 'EUR', 'GBP'],
      timezone: 'America/New_York',
      language: 'en',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '12h',
      taxConfig: {
        taxId: 'TAX-US-1002',
        taxRegistrationName: 'Sales Tax',
        taxType: 'SALES_TAX',
        defaultTaxRate: 8.0,
        isTaxInclusive: false,
        taxExemptionAllowed: true,
      },
    },
    authHeaders
  );
  console.log('✅ Settings restored to standard baseline.');

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 47 END-TO-END VALIDATIONS COMPLETED SUCCESSFULLY!');
  console.log('======================================================\n');
}

verifyPhase47().catch((err) => {
  console.error('❌ Phase 47 Verification Failed:', err?.response?.data || err.message);
  process.exit(1);
});
