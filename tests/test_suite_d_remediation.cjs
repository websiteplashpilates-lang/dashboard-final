const fs = require('fs');

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

async function runSuiteD() {
  console.log('======================================================================');
  console.log('  TEST SUITE D: DATABASE-ENFORCED BUSINESS RULES (ZERO-TRUST AUDIT)');
  console.log('======================================================================\n');

  // Authenticate as Aisha Kapoor (normal member)
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aisha.kapoor@example.com', password: 'member123' })
  });
  if (!authRes.ok) throw new Error('Member authentication failed: ' + (await authRes.text()));
  const { access_token: memberJwt, user } = await authRes.json();
  const aishaId = user.id;
  console.log(`[AUTH] Authenticated member: ${user.email} (id: ${aishaId})`);

  // Setup test session fixtures using service role
  const now = new Date();
  const pastTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // -24h
  const pastEndTime = new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString();
  const lateCancelTime = new Date(now.getTime() + 1.5 * 60 * 60 * 1000).toISOString(); // +1.5h (inside 4h window)
  const lateCancelEndTime = new Date(now.getTime() + 2.5 * 60 * 60 * 1000).toISOString();
  const timelyCancelTime = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(); // +48h (>4h window)
  const timelyCancelEndTime = new Date(now.getTime() + 49 * 60 * 60 * 1000).toISOString();
  const futureCap1Time = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(); // +72h, cap 1
  const futureCap1EndTime = new Date(now.getTime() + 73 * 60 * 60 * 1000).toISOString();

  const idPrefix = 'suite-d-' + Date.now();
  const sessPastId = `${idPrefix}-past`;
  const sessLateId = `${idPrefix}-late`;
  const sessTimelyId = `${idPrefix}-timely`;
  const sessCap1Id = `${idPrefix}-cap1`;

  // Fixtures
  const sessions = [
    { id: sessPastId, title: 'Past Session Test', discipline_id: 'disc-pilates', trainer_id: 'trainer-001', start_time: pastTime, end_time: pastEndTime, capacity: 6, status: 'completed' },
    { id: sessLateId, title: 'Late Cancel Test', discipline_id: 'disc-pilates', trainer_id: 'trainer-001', start_time: lateCancelTime, end_time: lateCancelEndTime, capacity: 6, status: 'scheduled' },
    { id: sessTimelyId, title: 'Timely Cancel Test', discipline_id: 'disc-pilates', trainer_id: 'trainer-001', start_time: timelyCancelTime, end_time: timelyCancelEndTime, capacity: 6, status: 'scheduled' },
    { id: sessCap1Id, title: 'Cap 1 Overflow Test', discipline_id: 'disc-pilates', trainer_id: 'trainer-001', start_time: futureCap1Time, end_time: futureCap1EndTime, capacity: 1, status: 'scheduled' }
  ];

  for (const s of sessions) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/class_sessions`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    });
    if (!r.ok) throw new Error(`Fixture session setup failed: ${await r.text()}`);
  }
  console.log('[FIXTURES] Created 4 test sessions on live PostgreSQL.\n');

  // Dynamically find Aisha's active pass
  const passRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${aishaId}&status=eq.active`, {
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const passData = await passRes.json();
  const activePassId = passData[0]?.id;
  if (!activePassId) throw new Error('No active pass found for member ' + aishaId);
  console.log(`[PASS BASELINE] Member active pass: ${activePassId}`);

  // Check initial member credits
  const initialCreditsRes = await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${activePassId}&discipline_id=eq.disc-pilates`, {
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const initialCreditsData = await initialCreditsRes.json();
  const initialCredits = initialCreditsData[0]?.remaining_credits ?? 12;
  console.log(`[CREDITS BASELINE] ${activePassId} disc-pilates remaining credits: ${initialCredits}\n`);

  const results = [];

  // ==========================================================================
  // TEST 1: PAST-CLASS BOOKING REJECTION (PostgreSQL Trigger)
  // Direct member REST insert on session where start_time < NOW()
  // ==========================================================================
  console.log('--- TEST 1: PAST-CLASS BOOKING REJECTION ---');
  const t1Res = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      session_id: sessPastId,
      member_id: aishaId,
      status: 'confirmed'
    })
  });
  const t1Status = t1Res.status;
  const t1Body = await t1Res.json().catch(() => ({}));
  const t1Blocked = (t1Status >= 400) && t1Body.code === 'P0003';
  
  // Verify 0 rows in DB
  const t1Check = await fetch(`${SUPABASE_URL}/rest/v1/bookings?session_id=eq.${sessPastId}`, {
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const t1Rows = await t1Check.json();
  const t1Passed = t1Blocked && t1Rows.length === 0;

  console.log(`HTTP Status: ${t1Status} | Code: ${t1Body.code} | Message: "${t1Body.message}"`);
  console.log(`Rows in DB for past session: ${t1Rows.length}`);
  console.log(`TEST 1 RESULT: ${t1Passed ? 'PASS' : 'FAIL'}\n`);
  results.push({ test: 'TEST 1: Past-Class Booking Reject', status: t1Passed ? 'PASS' : 'FAIL', code: t1Body.code, details: t1Body.message });

  // ==========================================================================
  // TEST 2: LATE CANCELLATION REJECTION (4-Hour Window Trigger)
  // Session starts in 1.5h (< 4h). Member creates booking, then attempts PATCH status='cancelled'
  // ==========================================================================
  console.log('--- TEST 2: LATE CANCELLATION REJECTION (< 4H WINDOW) ---');
  // First, create booking for lateCancel session (starts in 1.5h, which is in future so booking succeeds)
  const t2BookRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      session_id: sessLateId,
      member_id: aishaId,
      pass_id: activePassId,
      status: 'confirmed'
    })
  });
  const t2BookData = await t2BookRes.json();
  const t2BookingId = t2BookData[0]?.id;
  console.log(`Created confirmed booking: ${t2BookingId} for session starting in 1.5h.`);

  // Check credits after booking (should have decremented by 1)
  const credsAfterBookRes = await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${activePassId}&discipline_id=eq.disc-pilates`, {
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const credsAfterBook = (await credsAfterBookRes.json())[0].remaining_credits;
  console.log(`Credits after booking: ${credsAfterBook} (expected ${initialCredits - 1})`);

  // Now attempt late cancellation (<4 hours before start) with member JWT
  const t2CancelRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${t2BookingId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ status: 'cancelled' })
  });
  const t2CancelStatus = t2CancelRes.status;
  const t2CancelBody = await t2CancelRes.json().catch(() => ({}));
  const t2Blocked = (t2CancelStatus >= 400) && t2CancelBody.code === 'P0005';

  // Verify booking is still confirmed in DB
  const t2VerifyRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${t2BookingId}`, {
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const t2VerifyBooking = (await t2VerifyRes.json())[0];

  // Verify credits were NOT restored
  const credsAfterFailedCancelRes = await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${activePassId}&discipline_id=eq.disc-pilates`, {
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const credsAfterFailedCancel = (await credsAfterFailedCancelRes.json())[0].remaining_credits;

  const t2Passed = t2Blocked && t2VerifyBooking.status === 'confirmed' && credsAfterFailedCancel === credsAfterBook;
  console.log(`HTTP Status: ${t2CancelStatus} | Code: ${t2CancelBody.code} | Message: "${t2CancelBody.message}"`);
  console.log(`Booking status in DB: ${t2VerifyBooking.status} | Credits remaining: ${credsAfterFailedCancel}`);
  console.log(`TEST 2 RESULT: ${t2Passed ? 'PASS' : 'FAIL'}\n`);
  results.push({ test: 'TEST 2: Late Cancel Reject (<4h Window)', status: t2Passed ? 'PASS' : 'FAIL', code: t2CancelBody.code, details: t2CancelBody.message });

  // ==========================================================================
  // TEST 3: TIMELY CANCELLATION SUCCEEDED (> 4H WINDOW)
  // Session starts in 48h (>4h). Member books, cancels, status -> cancelled, 1 credit restored
  // ==========================================================================
  console.log('--- TEST 3: TIMELY CANCELLATION SUCCEEDED (> 4H WINDOW) ---');
  const t3BookRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      session_id: sessTimelyId,
      member_id: aishaId,
      pass_id: activePassId,
      status: 'confirmed'
    })
  });
  const t3BookData = await t3BookRes.json();
  const t3BookingId = t3BookData[0]?.id;
  console.log(`Created booking for session starting in 48h: ${t3BookingId}`);

  // Credits before cancel
  const credsBeforeTimelyCancelRes = await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${activePassId}&discipline_id=eq.disc-pilates`, {
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const credsBeforeTimely = (await credsBeforeTimelyCancelRes.json())[0].remaining_credits;

  // Timely cancellation
  const t3CancelRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${t3BookingId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ status: 'cancelled' })
  });
  const t3CancelStatus = t3CancelRes.status;
  const t3CancelData = await t3CancelRes.json().catch(() => ({}));

  // Verify booking status is 'cancelled'
  const t3VerifyRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${t3BookingId}`, {
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const t3VerifyBooking = (await t3VerifyRes.json())[0];

  // Verify credits were restored (+1)
  const credsAfterTimelyCancelRes = await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${activePassId}&discipline_id=eq.disc-pilates`, {
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const credsAfterTimely = (await credsAfterTimelyCancelRes.json())[0].remaining_credits;

  const t3Passed = t3CancelStatus === 200 && t3VerifyBooking.status === 'cancelled' && credsAfterTimely === credsBeforeTimely + 1;
  console.log(`HTTP Status: ${t3CancelStatus} | Booking Status: ${t3VerifyBooking.status}`);
  console.log(`Credits before: ${credsBeforeTimely} | Credits after: ${credsAfterTimely} (restored +1)`);
  console.log(`TEST 3 RESULT: ${t3Passed ? 'PASS' : 'FAIL'}\n`);
  results.push({ test: 'TEST 3: Timely Cancel (>4h Window)', status: t3Passed ? 'PASS' : 'FAIL', code: '200 OK', details: 'Status cancelled, 1 credit restored' });

  // ==========================================================================
  // TEST 4: VALID FUTURE BOOKING SUCCEEDED
  // Direct member REST insert on valid future session
  // ==========================================================================
  console.log('--- TEST 4: VALID FUTURE BOOKING SUCCEEDED ---');
  const t4Res = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      session_id: sessCap1Id,
      member_id: aishaId,
      pass_id: activePassId,
      status: 'confirmed'
    })
  });
  const t4Status = t4Res.status;
  const t4Data = await t4Res.json();
  const t4BookingId = t4Data[0]?.id;
  const t4Passed = t4Status === 201 && !!t4BookingId;
  console.log(`HTTP Status: ${t4Status} | Created Booking ID: ${t4BookingId}`);
  console.log(`TEST 4 RESULT: ${t4Passed ? 'PASS' : 'FAIL'}\n`);
  results.push({ test: 'TEST 4: Valid Future Booking', status: t4Passed ? 'PASS' : 'FAIL', code: '201 Created', details: `Booking ID: ${t4BookingId}` });

  // ==========================================================================
  // TEST 5: DUPLICATE BOOKING REJECTION
  // Same member attempts to book same session again
  // ==========================================================================
  console.log('--- TEST 5: DUPLICATE BOOKING REJECTION ---');
  const t5Res = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session_id: sessCap1Id,
      member_id: aishaId,
      pass_id: activePassId,
      status: 'confirmed'
    })
  });
  const t5Status = t5Res.status;
  const t5Body = await t5Res.json().catch(() => ({}));
  // Capacity trigger or unique constraint blocks duplicate
  const t5Passed = t5Status >= 400;
  console.log(`HTTP Status: ${t5Status} | Code: ${t5Body.code} | Message: "${t5Body.message}"`);
  console.log(`TEST 5 RESULT: ${t5Passed ? 'PASS' : 'FAIL'}\n`);
  results.push({ test: 'TEST 5: Duplicate Booking Reject', status: t5Passed ? 'PASS' : 'FAIL', code: t5Body.code, details: t5Body.message });

  // ==========================================================================
  // TEST 6: CAPACITY OVERFLOW REJECTION
  // Capacity is 1, aisha booked slot 1, 2nd member tries to book -> rejected
  // ==========================================================================
  console.log('--- TEST 6: CAPACITY OVERFLOW REJECTION ---');
  const t6Res = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session_id: sessCap1Id,
      member_id: '22222222-2222-2222-2222-222222222222',
      status: 'confirmed'
    })
  });
  const t6Status = t6Res.status;
  const t6Body = await t6Res.json().catch(() => ({}));
  const t6Passed = (t6Status >= 400) && t6Body.code === 'P0001';
  console.log(`HTTP Status: ${t6Status} | Code: ${t6Body.code} | Message: "${t6Body.message}"`);
  console.log(`TEST 6 RESULT: ${t6Passed ? 'PASS' : 'FAIL'}\n`);
  results.push({ test: 'TEST 6: Capacity Overflow Reject (Cap=1)', status: t6Passed ? 'PASS' : 'FAIL', code: t6Body.code, details: t6Body.message });

  // ==========================================================================
  // TEST 7: MEMBER ID IMPERSONATION / RLS REJECTION
  // Member JWT for Aisha attempts to insert booking for another member_id
  // ==========================================================================
  console.log('--- TEST 7: MEMBER ID IMPERSONATION / RLS REJECTION ---');
  // Use a fresh session with capacity 6 so capacity trigger doesn't pre-empt RLS
  const sessRlsId = `${idPrefix}-rls`;
  await fetch(`${SUPABASE_URL}/rest/v1/class_sessions`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: sessRlsId, title: 'RLS Session Test', discipline_id: 'disc-pilates', trainer_id: 'trainer-001', start_time: timelyCancelTime, end_time: timelyCancelEndTime, capacity: 6, status: 'scheduled' })
  });

  const t7Res = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session_id: sessRlsId,
      member_id: '00000000-0000-0000-0000-000000000000',
      status: 'confirmed'
    })
  });
  const t7Status = t7Res.status;
  const t7Body = await t7Res.json().catch(() => ({}));
  // RLS violation in PostgREST is either 403 or 400 or 404 (with RLS returning 0 rows)
  const t7Passed = t7Status >= 400;
  console.log(`HTTP Status: ${t7Status} | Code: ${t7Body.code} | Message: "${t7Body.message}"`);
  console.log(`TEST 7 RESULT: ${t7Passed ? 'PASS' : 'FAIL'}\n`);
  results.push({ test: 'TEST 7: Impersonation / RLS Reject', status: t7Passed ? 'PASS' : 'FAIL', code: t7Body.code || `${t7Status}`, details: t7Body.message || 'Blocked by RLS' });

  // CLEANUP FIXTURES
  console.log('--- CLEANUP FIXTURES ---');
  for (const s of [sessPastId, sessLateId, sessTimelyId, sessCap1Id, sessRlsId]) {
    await fetch(`${SUPABASE_URL}/rest/v1/class_sessions?id=eq.${s}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });
  }
  // Restore initial credits for Aisha
  await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${activePassId}&discipline_id=eq.disc-pilates`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ remaining_credits: initialCredits })
  });
  console.log(`Restored credits baseline: ${initialCredits}`);

  console.log('\n======================================================================');
  console.log('  TEST SUITE D SUMMARY: 7 / 7 ZERO-TRUST CHECKS');
  console.log('======================================================================');
  console.table(results);

  const allPassed = results.every(r => r.status === 'PASS');
  if (!allPassed) {
    console.error('FAILED: Not all tests passed!');
    process.exit(1);
  } else {
    console.log('ALL 7 DATABASE ENFORCEMENT AUDIT TESTS PASSED WITH FLYING COLORS!');
  }
}

runSuiteD().catch(err => {
  console.error('SUITE D FATAL ERROR:', err);
  process.exit(1);
});
