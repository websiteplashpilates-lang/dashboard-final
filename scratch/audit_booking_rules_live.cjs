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

async function runBookingAudit() {
  console.log('============================================================');
  console.log('  LIVE ZERO-TRUST AUDIT: BOOKING RULES & CONSTRAINTS');
  console.log('============================================================');

  // 1. Get normal member JWT for Aisha
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aisha.kapoor@example.com', password: 'member123' })
  });
  const { access_token: memberJwt, user } = await loginRes.json();
  const aishaId = user.id;
  console.log('Authenticated Aisha Kapoor:', aishaId);

  // 2. Setup test sessions
  const sessFutureId = 'sess-audit-future-' + Date.now();
  const sessPastId = 'sess-audit-past-' + Date.now();
  const sessSoonId = 'sess-audit-soon-' + Date.now();

  // Past session (yesterday)
  await fetch(`${SUPABASE_URL}/rest/v1/class_sessions`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: sessPastId,
      title: 'Audit Past Session',
      discipline_id: 'disc-pilates',
      trainer_id: 'trainer-001',
      start_time: '2026-09-10T10:00:00Z',
      end_time: '2026-09-10T11:00:00Z',
      capacity: 6,
      status: 'completed'
    })
  });

  // Soon session (starts in 1 hour - inside 4-hour window)
  const now = new Date();
  const soonStart = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const soonEnd = new Date(now.getTime() + 120 * 60 * 1000).toISOString();
  await fetch(`${SUPABASE_URL}/rest/v1/class_sessions`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: sessSoonId,
      title: 'Audit Soon Session',
      discipline_id: 'disc-pilates',
      trainer_id: 'trainer-001',
      start_time: soonStart,
      end_time: soonEnd,
      capacity: 6,
      status: 'scheduled'
    })
  });

  // Future session (next week - capacity 1)
  await fetch(`${SUPABASE_URL}/rest/v1/class_sessions`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: sessFutureId,
      title: 'Audit Future Session',
      discipline_id: 'disc-pilates',
      trainer_id: 'trainer-001',
      start_time: '2026-09-25T10:00:00Z',
      end_time: '2026-09-25T11:00:00Z',
      capacity: 1,
      status: 'scheduled'
    })
  });
  console.log('Created test sessions: past, soon (1h), future (cap=1).');

  // --- TEST B1: NORMAL VALID BOOKING WITH MEMBER JWT ---
  console.log('\n--- TEST B1: NORMAL VALID BOOKING WITH MEMBER JWT ---');
  const b1 = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      session_id: sessFutureId,
      member_id: aishaId,
      status: 'confirmed'
    })
  });
  console.log('Valid booking status:', b1.status);
  const b1Data = await b1.json();
  const validBookingId = b1Data[0]?.id;
  console.log('Valid booking created ID:', validBookingId);

  // --- TEST B2: MEMBER ID MANIPULATION (MEMBER ATTEMPTS TO BOOK AS SOMEONE ELSE) ---
  console.log('\n--- TEST B2: MEMBER ID MANIPULATION WITH MEMBER JWT ---');
  const bManip = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session_id: sessFutureId,
      member_id: '00000000-0000-0000-0000-000000000000',
      status: 'confirmed'
    })
  });
  console.log('Member ID manipulation status:', bManip.status, '(Expected: 403 Forbidden by RLS)');
  const bManipText = await bManip.text();
  console.log('Member ID manipulation response:', bManipText);

  // --- TEST B3: DUPLICATE BOOKING (SAME MEMBER + SESSION) ---
  console.log('\n--- TEST B3: DUPLICATE BOOKING PREVENTION ---');
  const b2 = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session_id: sessFutureId,
      member_id: aishaId,
      status: 'confirmed'
    })
  });
  console.log('Duplicate booking status:', b2.status, '(Expected: 409 Conflict)');
  const b2Text = await b2.text();
  console.log('Duplicate booking error:', b2Text);

  // --- TEST B4: CAPACITY OVERFLOW (CAPACITY = 1, SECOND MEMBER BOOKING) ---
  console.log('\n--- TEST B4: CAPACITY OVERFLOW REJECTION (CAPACITY = 1) ---');
  // Attempt booking with another member ID via service role to isolate capacity trigger
  const capRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session_id: sessFutureId,
      member_id: '22222222-2222-2222-2222-222222222222',
      status: 'confirmed'
    })
  });
  console.log('Capacity overflow status:', capRes.status, '(Expected: 400 Bad Request via DB trigger)');
  const capText = await capRes.text();
  console.log('Capacity overflow error message:', capText);

  // --- TEST B5: PAST-CLASS BOOKING VIA NORMAL MEMBER API PATH ---
  console.log('\n--- TEST B5: PAST-CLASS BOOKING VIA MEMBER API ---');
  const pastRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session_id: sessPastId,
      member_id: aishaId,
      status: 'confirmed'
    })
  });
  console.log('Past-class booking HTTP status:', pastRes.status);
  const pastText = await pastRes.text();
  console.log('Past-class booking response:', pastText);

  // --- TEST B6: CANCELLATION INSIDE 4 HOURS VIA NORMAL MEMBER API PATH ---
  console.log('\n--- TEST B6: CANCELLATION INSIDE 4-HOUR WINDOW VIA MEMBER API ---');
  // First book the soon session
  const soonBookRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      session_id: sessSoonId,
      member_id: aishaId,
      status: 'confirmed'
    })
  });
  const soonBookData = await soonBookRes.json();
  const soonBookId = soonBookData[0]?.id;
  console.log('Soon session booking created ID:', soonBookId);

  // Now attempt to cancel it via member API (session starts in 1h, inside 4h cutoff)
  const cancelSoonRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${soonBookId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${memberJwt}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ status: 'cancelled' })
  });
  console.log('Cancel inside 4h HTTP status:', cancelSoonRes.status);
  const cancelSoonText = await cancelSoonRes.text();
  console.log('Cancel inside 4h response:', cancelSoonText);

  // Cleanup test data
  console.log('\n--- CLEANUP TEST SESSIONS ---');
  for (const sId of [sessFutureId, sessPastId, sessSoonId]) {
    await fetch(`${SUPABASE_URL}/rest/v1/class_sessions?id=eq.${sId}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });
  }
  console.log('Cleaned up test sessions and bookings.');

  console.log('\n============================================================');
  console.log('  TEST SUITE B COMPLETED');
  console.log('============================================================');
}

runBookingAudit().catch(err => {
  console.error('FATAL BOOKING AUDIT ERROR:', err);
  process.exit(1);
});

