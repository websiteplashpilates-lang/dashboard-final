const fs = require('fs');

async function auditPaymentSecurity() {
  console.log('============================================================');
  console.log('  ZERO-TRUST AUDIT: PAYMENT GATEWAY SECURITY & INTEGRITY');
  console.log('============================================================\n');

  const BASE_URL = 'http://localhost:3333';

  // 1. Price Tampering Test on Order Creation
  console.log('--- TEST P1: CLIENT PRICE TAMPERING ON /api/create-razorpay-order ---');
  // Attacker sends amount = 100 paise (₹1) for pkg-001 (catalog price ₹27,000 = 2,700,000 paise)
  const orderRes = await fetch(`${BASE_URL}/api/create-razorpay-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 100, // TAMPERED ₹1
      package_id: 'pkg-001',
      member_id: '11111111-1111-1111-1111-111111111111'
    })
  });
  console.log('Order creation HTTP status:', orderRes.status);
  const orderData = await orderRes.json();
  console.log('Returned order amount (paise):', orderData.amount, '(₹' + (orderData.amount / 100) + ')');
  const priceTamperingBlocked = orderData.amount === 2700000;
  console.log('Price tampering defeated (authoritative catalog price enforced):', priceTamperingBlocked);

  // 2. Invalid Cryptographic Signature Test on Payment Verification
  console.log('\n--- TEST P2: INVALID CRYPTOGRAPHIC SIGNATURE ---');
  const fakeSigRes = await fetch(`${BASE_URL}/api/verify-razorpay-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: orderData.id || 'order_fake_12345',
      razorpay_payment_id: 'pay_fake_99999',
      razorpay_signature: 'deadbeef00000000000000000000000000000000000000000000000000000000',
      packageId: 'pkg-001',
      memberId: '11111111-1111-1111-1111-111111111111'
    })
  });
  console.log('Invalid signature HTTP status:', fakeSigRes.status);
  const fakeSigText = await fakeSigRes.text();
  console.log('Invalid signature rejection response:', fakeSigText);

  // 3. Member ID Tampering Test (Non-UUID)
  console.log('\n--- TEST P3: MEMBER ID TAMPERING (NON-UUID INJECTION) ---');
  const badMemberRes = await fetch(`${BASE_URL}/api/verify-razorpay-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: 'order_test_123',
      razorpay_payment_id: 'pay_test_123',
      razorpay_signature: 'valid_sig_mock',
      packageId: 'pkg-001',
      memberId: 'admin_injection; DROP TABLE payments; --'
    })
  });
  console.log('Bad member ID HTTP status:', badMemberRes.status);
  const badMemberText = await badMemberRes.text();
  console.log('Bad member ID rejection response:', badMemberText);

  // 4. Non-Existent Package ID Test
  console.log('\n--- TEST P4: NON-EXISTENT PACKAGE ID TAMPERING ---');
  const badPkgRes = await fetch(`${BASE_URL}/api/verify-razorpay-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: 'order_test_123',
      razorpay_payment_id: 'pay_test_123',
      razorpay_signature: 'valid_sig_mock',
      packageId: 'pkg-fake-nonexistent-999',
      memberId: '11111111-1111-1111-1111-111111111111'
    })
  });
  console.log('Bad package HTTP status:', badPkgRes.status);
  const badPkgText = await badPkgRes.text();
  console.log('Bad package rejection response:', badPkgText);

  // 5. Replay Attack Test (Simulating idempotent payment check)
  console.log('\n--- TEST P5: IDEMPOTENCY / REPLAY ATTACK CHECK ---');
  // Query Supabase for any existing payment reference to simulate replay
  const env = Object.fromEntries(
    fs.readFileSync('.env', 'utf8')
      .split('\n')
      .filter(l => l.includes('='))
      .map(l => {
        const idx = l.indexOf('=');
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
      })
  );

  const existingRes = await fetch(`${env.SUPABASE_URL}/rest/v1/payments?select=reference,invoice_no&limit=1`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const existingList = await existingRes.json();
  if (existingList && existingList.length > 0 && existingList[0].reference) {
    const existingRef = existingList[0].reference;
    console.log(`Testing replay submission with existing reference: ${existingRef}`);
    const replayRes = await fetch(`${BASE_URL}/api/verify-razorpay-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: 'order_replay_test',
        razorpay_payment_id: existingRef,
        razorpay_signature: 'dummy_sig',
        packageId: 'pkg-001',
        memberId: '11111111-1111-1111-1111-111111111111'
      })
    });
    console.log('Replay submission HTTP status:', replayRes.status);
    const replayData = await replayRes.json();
    console.log('Replay detected idempotency flag:', replayData.idempotent === true);
    console.log('Replay returned existing invoice:', replayData.payment?.invoiceNumber);
  } else {
    console.log('No prior payment reference in DB to simulate direct replay.');
  }

  console.log('\n============================================================');
  console.log('  PAYMENT SECURITY AUDIT COMPLETED');
  console.log('============================================================');
}

auditPaymentSecurity().catch(err => {
  console.error('PAYMENT AUDIT ERROR:', err);
  process.exit(1);
});
