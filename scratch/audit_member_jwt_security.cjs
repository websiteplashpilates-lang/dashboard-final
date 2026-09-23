const fs = require('fs');

// Load environment variables
const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function runAudit() {
  console.log('============================================================');
  console.log('  LIVE ZERO-TRUST AUDIT: NORMAL MEMBER JWT & SECURITY TESTS');
  console.log('============================================================');

  // 1. Authenticate Aisha Kapoor with Supabase GoTrue Auth (ANON key only)
  console.log('\n--- 1. AUTHENTICATE NORMAL MEMBER VIA SUPABASE GOTRUE ---');
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'aisha.kapoor@example.com',
      password: 'member123'
    })
  });

  console.log('GoTrue Login Status:', loginRes.status);
  const loginData = await loginRes.json();
  if (loginRes.status !== 200 || !loginData.access_token) {
    console.error('FAILED TO AUTHENTICATE AISHA:', loginData);
    process.exit(1);
  }

  const memberJwt = loginData.access_token;
  const user = loginData.user;
  console.log('✓ Successfully authenticated member:');
  console.log('  User UUID (auth.uid / sub):', user.id);
  console.log('  Email:', user.email);
  console.log('  Token Type:', loginData.token_type);
  console.log('  Expires In:', loginData.expires_in, 'seconds');

  // Decode JWT payload without verifying to inspect claims
  const jwtParts = memberJwt.split('.');
  const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString('utf8'));
  console.log('  JWT Claims:');
  console.log('    sub (Subject):', payload.sub);
  console.log('    role (Auth Role):', payload.role);
  console.log('    aud (Audience):', payload.aud);
  console.log('    iss (Issuer):', payload.iss);

  // 2. Query Aisha's own profile using her member JWT
  console.log('\n--- 2. PROFILE MAPPING VIA NORMAL MEMBER JWT ---');
  const ownProfileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`
    }
  });
  const ownProfile = await ownProfileRes.json();
  console.log('Own profile query status:', ownProfileRes.status);
  console.log('Own profile data:', ownProfile);

  // 3. Test Invalid Login
  console.log('\n--- 3. TEST INVALID LOGIN REJECTION ---');
  const invalidLoginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'aisha.kapoor@example.com',
      password: 'wrongpassword999!'
    })
  });
  console.log('Invalid login status:', invalidLoginRes.status, '(Expected: 400)');
  const invData = await invalidLoginRes.json();
  console.log('Invalid login error response:', invData.error_description || invData.msg || invData);

  // 4. Test Cross-User Isolation with Member JWT
  console.log('\n--- 4. CROSS-MEMBER DATA ISOLATION (MEMBER JWT QUERYING ANOTHER USER) ---');
  const otherMemberId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; // Sandeep John

  // 4a. Read other member's profile
  const crossProfileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${otherMemberId}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`
    }
  });
  const crossProfile = await crossProfileRes.json();
  console.log('Cross-member profile read (Aisha reading Sandeep):', crossProfileRes.status, crossProfile);

  // 4b. Read other member's bookings
  const crossBookingsRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?member_id=eq.${otherMemberId}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`
    }
  });
  const crossBookings = await crossBookingsRes.json();
  console.log('Cross-member bookings read (Aisha reading Sandeep):', crossBookingsRes.status, crossBookings);

  // 4c. Read other member's payments
  const crossPaymentsRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?member_id=eq.${otherMemberId}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`
    }
  });
  const crossPayments = await crossPaymentsRes.json();
  console.log('Cross-member payments read (Aisha reading Sandeep):', crossPaymentsRes.status, crossPayments);

  // 4d. Read other member's passes
  const crossPassesRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${otherMemberId}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`
    }
  });
  const crossPasses = await crossPassesRes.json();
  console.log('Cross-member passes read (Aisha reading Sandeep):', crossPassesRes.status, crossPasses);

  // 5. Test Direct API Tampering with Member JWT
  console.log('\n--- 5. DIRECT API PRIVILEGE TAMPERING (WITH MEMBER JWT) ---');

  // 5a. Attempt to insert into payments directly
  const fakePaymentRes = await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: `pay-hack-${Date.now()}`,
      member_id: user.id,
      package_id: 'pkg-001',
      total_amount_inr: 1,
      status: 'paid',
      reference: `hack_${Date.now()}`
    })
  });
  console.log('Direct payment insert status:', fakePaymentRes.status, await fakePaymentRes.text());

  // 5b. Attempt to grant self a pass directly
  const fakePassRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: `pass-hack-${Date.now()}`,
      member_id: user.id,
      package_id: 'pkg-001',
      status: 'active'
    })
  });
  console.log('Direct pass insert status:', fakePassRes.status, await fakePassRes.text());

  // 5c. Attempt to grant self credits directly
  const fakeCreditsRes = await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pass_id: 'pass-trig-1789743676463',
      discipline_id: 'disc-pilates',
      total_credits: 999,
      remaining_credits: 999
    })
  });
  console.log('Direct credits insert status:', fakeCreditsRes.status, await fakeCreditsRes.text());

  // 5d. Attempt to book on behalf of another member
  const fakeOtherBookingRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session_id: 'sess-001',
      member_id: otherMemberId,
      status: 'confirmed'
    })
  });
  console.log('Book on behalf of another member status:', fakeOtherBookingRes.status, await fakeOtherBookingRes.text());

  console.log('\n============================================================');
  console.log('  TEST SUITE A COMPLETED');
  console.log('============================================================');
}

runAudit().catch(err => {
  console.error('FATAL AUDIT ERROR:', err);
  process.exit(1);
});
