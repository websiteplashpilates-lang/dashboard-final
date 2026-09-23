import { readFileSync } from 'fs';

// Load .env
const env = readFileSync('.env', 'utf-8');
const urlMatch = env.match(/SUPABASE_URL=["']?(https:\/\/[^"'\s]+)["']?/);
const keyMatch = env.match(/SUPABASE_ANON_KEY=["']?([^"'\s]+)["']?/);

const SUPABASE_URL = urlMatch ? urlMatch[1] : '';
const SUPABASE_KEY = keyMatch ? keyMatch[1] : '';

console.log('Testing live Supabase endpoints at:', SUPABASE_URL);

async function req(path, method = 'GET', body = null) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, json, text };
}

async function runAudit() {
  const results = [];

  // 1. PACKAGES
  console.log('\n--- 1. Testing PACKAGES CRUD ---');
  const pkgId = `test-pkg-${Date.now()}`;
  const pkgCreate = await req('packages', 'POST', {
    id: pkgId,
    name: 'Integration Test Plan',
    discipline_id: 'disc-pilates',
    duration_months: 1,
    price_inr: 500,
    first_circle_price_inr: 450,
    session_allocations: [{ disciplineId: 'disc-pilates', sessionCount: 4 }]
  });
  console.log('Package Create:', pkgCreate.status, pkgCreate.status === 201 ? '✓' : pkgCreate.text);
  results.push({ entity: 'packages:create', ok: pkgCreate.status === 201 });

  const pkgUpdate = await req(`packages?id=eq.${pkgId}`, 'PATCH', { price_inr: 550 });
  console.log('Package Update:', pkgUpdate.status, pkgUpdate.status === 200 ? '✓' : pkgUpdate.text);
  results.push({ entity: 'packages:update', ok: pkgUpdate.status === 200 });

  const pkgDelete = await req(`packages?id=eq.${pkgId}`, 'DELETE');
  console.log('Package Delete:', pkgDelete.status, [200, 204].includes(pkgDelete.status) ? '✓' : pkgDelete.text);
  results.push({ entity: 'packages:delete', ok: [200, 204].includes(pkgDelete.status) });

  // 2. CLASS SESSIONS
  console.log('\n--- 2. Testing CLASS_SESSIONS CRUD ---');
  const sessId = `test-sess-${Date.now()}`;
  const sessCreate = await req('class_sessions', 'POST', {
    id: sessId,
    title: 'Test Live Batch',
    discipline_id: 'disc-pilates',
    trainer_id: 'trainer-001',
    start_time: new Date(Date.now() + 86400000).toISOString(),
    end_time: new Date(Date.now() + 90000000).toISOString(),
    capacity: 6,
    status: 'scheduled'
  });
  console.log('Class Session Create:', sessCreate.status, sessCreate.status === 201 ? '✓' : sessCreate.text);
  results.push({ entity: 'class_sessions:create', ok: sessCreate.status === 201 });

  const sessUpdate = await req(`class_sessions?id=eq.${sessId}`, 'PATCH', { capacity: 5 });
  console.log('Class Session Update:', sessUpdate.status, sessUpdate.status === 200 ? '✓' : sessUpdate.text);
  results.push({ entity: 'class_sessions:update', ok: sessUpdate.status === 200 });

  const sessDelete = await req(`class_sessions?id=eq.${sessId}`, 'DELETE');
  console.log('Class Session Delete:', sessDelete.status, [200, 204].includes(sessDelete.status) ? '✓' : sessDelete.text);
  results.push({ entity: 'class_sessions:delete', ok: [200, 204].includes(sessDelete.status) });

  // 3. BOOKINGS
  console.log('\n--- 3. Testing BOOKINGS CRUD ---');
  const bookSessId = `test-sess-book-${Date.now()}`;
  await req('class_sessions', 'POST', {
    id: bookSessId,
    title: 'Booking Test Session',
    discipline_id: 'disc-pilates',
    start_time: new Date(Date.now() + 86400000).toISOString(),
    end_time: new Date(Date.now() + 90000000).toISOString(),
    capacity: 6,
    status: 'scheduled'
  });

  const bookId = `test-book-${Date.now()}`;
  const bookCreate = await req('bookings', 'POST', {
    id: bookId,
    member_id: '11111111-1111-1111-1111-111111111111',
    session_id: bookSessId,
    status: 'confirmed'
  });
  console.log('Booking Create:', bookCreate.status, bookCreate.status === 201 ? '✓' : bookCreate.text);
  results.push({ entity: 'bookings:create', ok: bookCreate.status === 201 });

  const bookCancel = await req(`bookings?id=eq.${bookId}`, 'PATCH', { status: 'cancelled' });
  console.log('Booking Cancel:', bookCancel.status, bookCancel.status === 200 ? '✓' : bookCancel.text);
  results.push({ entity: 'bookings:cancel', ok: bookCancel.status === 200 });

  await req(`bookings?id=eq.${bookId}`, 'DELETE');
  await req(`class_sessions?id=eq.${bookSessId}`, 'DELETE');

  // 4. PAYMENTS
  console.log('\n--- 4. Testing PAYMENTS INSERT ---');
  const payId = `test-pay-${Date.now()}`;
  const payCreate = await req('payments', 'POST', {
    id: payId,
    member_id: '11111111-1111-1111-1111-111111111111',
    package_id: 'pkg-001',
    invoice_no: `INV-TEST-${Date.now()}`,
    gstin: '29ABIFP5917A1Z7',
    base_amount_inr: 847.46,
    cgst_inr: 76.27,
    sgst_inr: 76.27,
    total_amount_inr: 1000.00,
    payment_method: 'Test Razorpay',
    reference: `PAY-REF-${Date.now()}`,
    status: 'paid'
  });
  console.log('Payment Create:', payCreate.status, payCreate.status === 201 ? '✓' : payCreate.text);
  results.push({ entity: 'payments:create', ok: payCreate.status === 201 });
  await req(`payments?id=eq.${payId}`, 'DELETE');

  // 5. MEMBER PASSES & CREDITS
  console.log('\n--- 5. Testing MEMBER PASSES & CREDITS ---');
  const passId = `test-pass-${Date.now()}`;
  const passCreate = await req('member_passes', 'POST', {
    id: passId,
    member_id: '11111111-1111-1111-1111-111111111111',
    package_id: 'pkg-001',
    status: 'active',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString()
  });
  console.log('Member Pass Create:', passCreate.status, passCreate.status === 201 ? '✓' : passCreate.text);
  results.push({ entity: 'member_passes:create', ok: passCreate.status === 201 });

  const credCreate = await req('member_pass_credits', 'POST', {
    pass_id: passId,
    discipline_id: 'disc-pilates',
    total_credits: 12,
    remaining_credits: 12
  });
  console.log('Member Pass Credits Create:', credCreate.status, credCreate.status === 201 ? '✓' : credCreate.text);
  results.push({ entity: 'member_pass_credits:create', ok: credCreate.status === 201 });

  await req(`member_passes?id=eq.${passId}`, 'DELETE');

  console.log('\n=============================================');
  console.log('LIVE SUPABASE MUTATION AUDIT SUMMARY:');
  const failed = results.filter(r => !r.ok);
  if (failed.length === 0) {
    console.log('✅ ALL MUTATIONS VERIFIED 100% OPERATIONAL ON SUPABASE!');
  } else {
    console.log(`❌ ${failed.length} MUTATIONS FAILED:`, failed.map(f => f.entity));
  }
  console.log('=============================================');
}

runAudit();
