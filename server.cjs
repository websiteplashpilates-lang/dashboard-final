/**
 * Plash Pilates Studio — Production & Local Development Server
 * Handles static asset delivery + secure backend Razorpay Order creation and signature verification.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3333;
const ROOT_DIR = (() => {
  const candidates = [
    __dirname,
    process.cwd(),
    path.join(__dirname, '..'),
    path.join(process.cwd(), '..')
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, 'index.html'))) return c;
    } catch (_) {}
  }
  return __dirname;
})();

// 1. Load environment variables from .env
function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    });
  }
}

loadEnv();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const IS_TEST_KEY = RAZORPAY_KEY_ID.startsWith('rzp_test_');
const ALLOW_TEST_PAYMENTS = process.env.ALLOW_TEST_PAYMENTS_IN_PROD === 'true';

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn('[SECURITY WARNING] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured in server environment.');
} else if (IS_PROD && IS_TEST_KEY && !ALLOW_TEST_PAYMENTS) {
  console.error('======================================================================');
  console.error(' [PRODUCTION SAFETY GATE] Razorpay Test Keys detected in production mode.');
  console.error(' Live transactions require rzp_live_... credentials.');
  console.error(' Set ALLOW_TEST_PAYMENTS_IN_PROD=true if running staging tests in production mode.');
  console.error('======================================================================');
}

// In-memory verification state for pending email changes: Map<memberId, { newEmail, code, expiresAt, requestedAt }>
const pendingEmailChanges = new Map();

// In-memory verification state for pending signups: Map<email, { email, password, fullName, phone, movementLevel, code, expiresAt, requestedAt }>
const pendingSignups = new Map();

// 2. MIME types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.webmanifest': 'application/manifest+json'
};

// 3. Helper to read JSON request body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// 4. Create Razorpay Order via Official API
function createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  return new Promise((resolve, reject) => {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return reject(new Error('Razorpay credentials not configured in server environment'));
    }
    if (IS_PROD && IS_TEST_KEY && !ALLOW_TEST_PAYMENTS) {
      return reject(new Error('Production payment processing requires live Razorpay credentials (rzp_live_...). Test mode keys rejected in production.'));
    }
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const postData = JSON.stringify({
      amount: Math.round(amount), // in paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes
    });

    const options = {
      hostname: 'api.razorpay.com',
      port: 443,
      path: '/v1/orders',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const rzpReq = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error?.description || parsed.error?.code || `Razorpay error HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    rzpReq.on('error', reject);
    rzpReq.write(postData);
    rzpReq.end();
  });
}

// 5. Verify Razorpay Payment Signature (HMAC SHA-256)
function verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return false;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const bufExpected = Buffer.from(expectedSignature, 'utf8');
  const bufReceived = Buffer.from(String(razorpay_signature), 'utf8');
  if (bufExpected.length !== bufReceived.length) return false;
  return crypto.timingSafeEqual(bufExpected, bufReceived);
}

// 6. Fetch Razorpay Order Payments
function getRazorpayOrderPayments(orderId) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const options = {
      hostname: 'api.razorpay.com',
      port: 443,
      path: `/v1/orders/${encodeURIComponent(orderId)}/payments`,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Fetch single order from Razorpay API
function fetchRazorpayOrder(orderId) {
  return new Promise((resolve) => {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !orderId) return resolve(null);
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const options = {
      hostname: 'api.razorpay.com',
      port: 443,
      path: `/v1/orders/${encodeURIComponent(orderId)}`,
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// Fetch single payment from Razorpay API
function fetchRazorpayPayment(paymentId) {
  return new Promise((resolve, reject) => {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return resolve(null);
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const options = {
      hostname: 'api.razorpay.com',
      port: 443,
      path: `/v1/payments/${encodeURIComponent(paymentId)}`,
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// Fetch recent payments from Razorpay API
function fetchRecentRazorpayPayments(count = 10) {
  return new Promise((resolve) => {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return resolve([]);
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const options = {
      hostname: 'api.razorpay.com',
      port: 443,
      path: `/v1/payments?count=${encodeURIComponent(count)}`,
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve((parsed && parsed.items) || []);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

// Authoritative Sync: Ensure all captured Razorpay payments across all members are in Supabase
async function syncAllRazorpayPaymentsToSupabase(limit = 100) {
  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return { synced: 0 };
    if (process.env.SYNC_HISTORICAL_RAZORPAY === 'false') return { synced: 0 };
    const rzpPayments = await fetchRecentRazorpayPayments(limit);
    if (!rzpPayments || rzpPayments.length === 0) return { synced: 0 };

    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

    // Get all existing payment references in Supabase
    const payRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?select=reference`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    const existingRows = payRes.ok ? await payRes.json() : [];
    const existingRefs = new Set(existingRows.map(r => r.reference));

    // Get all packages to match package by price or ID
    const pkgRes = await fetch(`${SUPABASE_URL}/rest/v1/packages?select=*`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    const packages = pkgRes.ok ? await pkgRes.json() : [];

    let syncedCount = 0;
    for (const p of rzpPayments) {
      if (p.status !== 'captured') continue;
      if (existingRefs.has(p.id)) continue;

      const memberEmail = (p.email || '').trim().toLowerCase();
      if (!memberEmail) continue;

      // Find or auto-create member profile
      let profileId = null;
      const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(memberEmail)}&select=id`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      if (profRes.ok) {
        const profs = await profRes.json();
        if (profs.length > 0) profileId = profs[0].id;
      }

      if (!profileId) {
        profileId = crypto.randomUUID();
        await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            id: profileId,
            email: memberEmail,
            full_name: (p.notes && p.notes.name) || memberEmail.split('@')[0],
            phone: p.contact ? String(p.contact) : null,
            role: 'member',
            tier: 'Founding Member',
            created_at: new Date(p.created_at * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
        });
      }

      // Match package
      const paidInr = Math.round(Number(p.amount) / 100);
      let matchedPkg = null;
      if (p.notes && p.notes.packageId) {
        matchedPkg = packages.find(pkg => pkg.id === p.notes.packageId);
      }
      if (!matchedPkg) {
        matchedPkg = packages.find(pkg => {
          const expectedTotal = Math.round(Number(pkg.price_inr) * 1.18);
          return expectedTotal === paidInr || Number(pkg.price_inr) === paidInr;
        });
      }
      if (!matchedPkg) {
        console.warn(`[Auto-Sync] Skipping payment ${p.id} (₹${paidInr}): No matching package found in catalog for email ${memberEmail}. Flagged for review.`);
        continue;
      }

      const baseAmount = Number(matchedPkg.price_inr);
      const cgst = Number((baseAmount * 0.09).toFixed(2));
      const sgst = Number((baseAmount * 0.09).toFixed(2));
      const totalAmount = Number((baseAmount + cgst + sgst).toFixed(2));
      const paymentDate = new Date(p.created_at * 1000);
      const durationMonths = Number(matchedPkg.duration_months) || 1;
      const validUntil = new Date(paymentDate);
      validUntil.setMonth(validUntil.getMonth() + durationMonths);

      const paymentRow = {
        id: `pay-${p.created_at.toString().slice(-8)}`,
        member_id: profileId,
        package_id: matchedPkg.id,
        invoice_no: `INV-${p.created_at.toString().slice(-6)}`,
        gstin: '29ABIFP5917A1Z7',
        base_amount_inr: baseAmount,
        cgst_inr: cgst,
        sgst_inr: sgst,
        total_amount_inr: totalAmount,
        payment_method: (p.method ? p.method.toUpperCase() : 'UPI / Razorpay') + ' (Live Gateway)',
        reference: p.id,
        status: 'paid',
        created_at: paymentDate.toISOString()
      };

      const passRow = {
        id: `pass-${p.created_at.toString().slice(-8)}`,
        member_id: profileId,
        package_id: matchedPkg.id,
        status: 'active',
        valid_from: paymentDate.toISOString(),
        valid_until: validUntil.toISOString(),
        created_at: paymentDate.toISOString()
      };

      const insPayRes = await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify(paymentRow)
      });

      if (insPayRes.ok) {
        await fetch(`${SUPABASE_URL}/rest/v1/member_passes`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify(passRow)
        });

        const allocations = matchedPkg.session_allocations || [
          { disciplineId: 'disc-pilates', sessionCount: 12 }
        ];
        const creditRows = allocations.map(alloc => ({
          pass_id: passRow.id,
          discipline_id: alloc.disciplineId,
          total_credits: alloc.sessionCount,
          remaining_credits: alloc.sessionCount
        }));

        await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(creditRows)
        });

        existingRefs.add(p.id);
        syncedCount++;
        console.log(`[Auto-Sync] Synced Razorpay payment ${p.id} (₹${paidInr}) for ${memberEmail} into Supabase`);
      }
    }

    return { synced: syncedCount, total: existingRefs.size };
  } catch (err) {
    console.error('[syncAllRazorpayPaymentsToSupabase error]', err.message);
    return { error: err.message };
  }
}

// Check if a member has been previously approved by Physicq 57 for Barre
function isMemberBarreApproved(memberId, email) {
  try {
    const fs = require('fs');
    const path = require('path');
    const reviewFilePath = path.join(__dirname, 'data', 'partner_reviews.json');
    if (!fs.existsSync(reviewFilePath)) return false;
    const reviews = JSON.parse(fs.readFileSync(reviewFilePath, 'utf-8'));
    return Array.isArray(reviews) && reviews.some(r => {
      const matchId = memberId && r.memberId && String(r.memberId).toLowerCase() === String(memberId).toLowerCase();
      const matchEmail = email && r.memberEmail && String(r.memberEmail).toLowerCase() === String(email).toLowerCase();
      return (matchId || matchEmail) && r.status === 'accepted';
    });
  } catch (_) {
    return false;
  }
}

// In-flight active fulfillments to guarantee atomic concurrency per payment ID
const activeFulfillments = new Map();

// 7. Secure Backend Payment Fulfillment (Zero Trust Architecture)
async function fulfillVerifiedPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, packageId, memberId }) {
  if (!razorpay_order_id || !razorpay_payment_id || !packageId || !memberId) {
    throw new Error('Missing payment verification parameters. All fields are required.');
  }

  // Concurrency guard: await in-flight fulfillment for same payment to prevent duplicate processing
  if (activeFulfillments.has(razorpay_payment_id)) {
    console.log(`[Concurrency] Awaiting in-flight fulfillment for payment ${razorpay_payment_id}`);
    return await activeFulfillments.get(razorpay_payment_id);
  }

  const fulfillmentPromise = (async () => {
    // 1. Strict UUID validation on memberId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(memberId)) {
      throw new Error('Invalid member ID format. Must be a valid UUID.');
    }

    // 2. Cryptographic Signature Verification (Strict enforcement on client fulfillment route)
    if (!razorpay_signature) {
      throw new Error('Missing Razorpay cryptographic signature. Verification rejected.');
    }
    const isValid = verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
    if (!isValid) {
      throw new Error('Invalid Razorpay cryptographic signature. Fulfillment rejected.');
    }

    // 3. Fetch package metadata from Supabase
    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !supabaseKey) {
      throw new Error('Database service is currently unavailable.');
    }

    let pkg = null;
    try {
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/packages?id=eq.${encodeURIComponent(packageId)}&select=*`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      });
      if (pRes.ok) {
        const pkgs = await pRes.json();
        if (pkgs && pkgs.length > 0) pkg = pkgs[0];
      }
    } catch (e) {
      console.warn('[Fulfill fetch package error]', e.message);
    }

    if (!pkg) {
      throw new Error(`Package "${packageId}" not found in studio catalog.`);
    }

    // 4. Idempotency Check: Prevent duplicate passes / replay attacks
    try {
      const existRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?reference=eq.${encodeURIComponent(razorpay_payment_id)}&select=*`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      if (existRes.ok) {
        const existingPayments = await existRes.json();
        if (existingPayments && existingPayments.length > 0) {
          const ep = existingPayments[0];
          console.log(`[Idempotency] Payment ${razorpay_payment_id} already fulfilled. Returning existing invoice ${ep.invoice_no}.`);
          let existingPass = null;
          try {
            const passRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${ep.member_id}&package_id=eq.${ep.package_id}&order=created_at.desc&limit=1`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (passRes.ok) {
              const passes = await passRes.json();
              if (passes.length > 0) {
                existingPass = {
                  id: passes[0].id,
                  memberId: passes[0].member_id,
                  packageId: passes[0].package_id,
                  status: passes[0].status,
                  validFrom: passes[0].valid_from,
                  validUntil: passes[0].valid_until
                };
              }
            }
          } catch (_) {}

          return {
            success: true,
            idempotent: true,
            payment: {
              id: ep.id,
              memberId: ep.member_id,
              packageId: ep.package_id,
              baseAmountInr: Number(ep.base_amount_inr),
              cgstInr: Number(ep.cgst_inr),
              sgstInr: Number(ep.sgst_inr),
              totalAmountInr: Number(ep.total_amount_inr),
              amountInr: Number(ep.total_amount_inr),
              status: ep.status,
              reference: ep.reference,
              invoiceNo: ep.invoice_no,
              invoiceNumber: ep.invoice_no,
              paymentMethod: ep.payment_method,
              createdAt: ep.created_at
            },
            pass: existingPass || { id: 'pass-existing' }
          };
        }
      }
    } catch (err) {
      console.error('[Idempotency check error]', err.message);
    }

    // 5. Strict Live Gateway Verification & Authoritative Order Ownership Binding
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Payment gateway credentials not configured on server.');
    }

    const rzpPayment = await fetchRazorpayPayment(razorpay_payment_id);
    if (!rzpPayment || rzpPayment.error) {
      throw new Error(`Razorpay gateway rejected payment: ${rzpPayment?.error?.description || rzpPayment?.error?.code || 'Payment ID not found on gateway'}`);
    }

    if (rzpPayment.status !== 'captured' && rzpPayment.status !== 'authorized') {
      throw new Error(`Razorpay payment status is "${rzpPayment.status}". Only captured payments can be fulfilled.`);
    }
    if (rzpPayment.order_id && rzpPayment.order_id !== razorpay_order_id) {
      throw new Error(`Payment order mismatch: payment belongs to ${rzpPayment.order_id}, not ${razorpay_order_id}.`);
    }
    if (rzpPayment.currency && rzpPayment.currency.toUpperCase() !== 'INR') {
      throw new Error(`Invalid payment currency "${rzpPayment.currency}". Must be INR.`);
    }

    // Base package fee + 18% GST charged at checkout
    const baseAmount = Number(pkg.price_inr);
    const cgst = Number((baseAmount * 0.09).toFixed(2));
    const sgst = Number((baseAmount * 0.09).toFixed(2));
    const totalAmount = Number((baseAmount + cgst + sgst).toFixed(2));
    const expectedPaise = Math.round(totalAmount * 100);
    // Allow standard ₹1 (100 paise) GST rounding difference between client round-off and server float
    if (expectedPaise - Number(rzpPayment.amount) > 100) {
      throw new Error(`Paid amount (₹${Number(rzpPayment.amount) / 100}) is less than required total with 18% GST (₹${totalAmount}). Payment rejected.`);
    }

    // 5.1 Authoritative Razorpay Order Validation & Strict User Binding (IDOR Protection)
    const rzpOrder = await fetchRazorpayOrder(razorpay_order_id);
    if (!rzpOrder || rzpOrder.error) {
      throw new Error('Razorpay order verification failed: Order ID not found on gateway.');
    }

    const orderNotes = rzpOrder.notes || {};
    const paymentNotes = rzpPayment.notes || {};
    const boundMemberId = orderNotes.memberId || paymentNotes.memberId;
    const boundPackageId = orderNotes.packageId || paymentNotes.packageId;

    if (boundMemberId && boundMemberId !== memberId) {
      throw new Error(`Payment ownership mismatch: Payment was authorized for member ${boundMemberId}, not ${memberId}.`);
    }
    if (boundPackageId && boundPackageId !== packageId) {
      throw new Error(`Payment package mismatch: Payment was authorized for package ${boundPackageId}, not ${packageId}.`);
    }

    // 5.5 Member Profile Verification (Strict existence check - no arbitrary auto-creation for attackers)
    let resolvedMemberId = memberId;
    const profCheck = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(resolvedMemberId)}&select=id,email`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    let profileExists = false;
    let existingProfileEmail = null;
    if (profCheck.ok) {
      const pList = await profCheck.json();
      if (pList && pList.length > 0) {
        profileExists = true;
        existingProfileEmail = pList[0].email;
      }
    }

    if (!profileExists) {
      throw new Error(`Member profile "${resolvedMemberId}" does not exist. Fulfillment rejected.`);
    }

    // If payment email is present, ensure it matches profile email
    const candidateEmail = (rzpPayment && rzpPayment.email) ? String(rzpPayment.email).trim().toLowerCase() : null;
    if (candidateEmail && existingProfileEmail && existingProfileEmail.trim().toLowerCase() !== candidateEmail && !boundMemberId) {
      throw new Error(`Payment email mismatch: Payment was made by ${candidateEmail}, not matching member profile.`);
    }

    // 6. Calculate Financial Amounts
    const now = new Date();
    const durationMonths = Number(pkg.duration_months) || 1;
    const validUntil = new Date(now);
    validUntil.setMonth(validUntil.getMonth() + durationMonths);

    const cleanRef = String(razorpay_payment_id).replace(/[^a-zA-Z0-9]/g, '').slice(-12);
    const paymentRow = {
      id: `pay-${cleanRef}`,
      member_id: resolvedMemberId,
      package_id: packageId,
      invoice_no: `INV-${cleanRef.slice(-6).toUpperCase()}`,
      gstin: '29ABIFP5917A1Z7',
      base_amount_inr: baseAmount,
      cgst_inr: cgst,
      sgst_inr: sgst,
      total_amount_inr: totalAmount,
      payment_method: 'Razorpay Live Gateway',
      reference: razorpay_payment_id,
      status: 'paid',
      created_at: now.toISOString()
    };

    const passRow = {
      id: `pass-${cleanRef}`,
      member_id: resolvedMemberId,
      package_id: packageId,
      status: 'active',
      valid_from: now.toISOString(),
      valid_until: validUntil.toISOString(),
      created_at: now.toISOString()
    };

    // Barre Credit Gating: If client is not yet approved by Physicq 57, Barre credits start at 0 until partner approves
    const isApprovedForBarre = isMemberBarreApproved(resolvedMemberId, candidateEmail);

    let pendingBarreCount = 0;
    const allocations = pkg.session_allocations || [];
    const creditRows = allocations.map(alloc => {
      const isBarre = alloc.disciplineId === 'disc-barre' || String(alloc.disciplineId || '').toLowerCase().includes('barre');
      let total = alloc.sessionCount;
      let remaining = alloc.sessionCount;

      if (isBarre && !isApprovedForBarre) {
        pendingBarreCount = alloc.sessionCount;
        total = 0;
        remaining = 0;
      }

      return {
        pass_id: passRow.id,
        discipline_id: alloc.disciplineId,
        total_credits: total,
        remaining_credits: remaining
      };
    });

    // 7. Atomic Supabase Writes with Concurrency Race-Conflict Recovery
    const payRes = await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(paymentRow)
    });

    if (!payRes.ok) {
      const errText = await payRes.text();
      // Database Unique Constraint race-conflict: retrieve existing fulfilled payment
      if (payRes.status === 409 || errText.includes('duplicate') || errText.includes('payments_reference_key')) {
        console.log(`[Database Concurrency] Payment ${razorpay_payment_id} recorded concurrently. Retrieving existing record.`);
        const existRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?reference=eq.${encodeURIComponent(razorpay_payment_id)}&select=*`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (existRes.ok) {
          const epList = await existRes.json();
          if (epList && epList.length > 0) {
            const ep = epList[0];
            const passRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${ep.member_id}&package_id=eq.${ep.package_id}&order=created_at.desc&limit=1`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            const passes = passRes.ok ? await passRes.json() : [];
            return {
              success: true,
              idempotent: true,
              payment: {
                id: ep.id,
                memberId: ep.member_id,
                packageId: ep.package_id,
                baseAmountInr: Number(ep.base_amount_inr),
                cgstInr: Number(ep.cgst_inr),
                sgstInr: Number(ep.sgst_inr),
                totalAmountInr: Number(ep.total_amount_inr),
                amountInr: Number(ep.total_amount_inr),
                status: ep.status,
                reference: ep.reference,
                invoiceNo: ep.invoice_no,
                invoiceNumber: ep.invoice_no,
                paymentMethod: ep.payment_method,
                createdAt: ep.created_at
              },
              pass: passes[0] || { id: 'pass-existing' }
            };
          }
        }
      }
      console.error('[Supabase Payment Write Failure]', errText);
      throw new Error(`Database failure creating payment record: ${payRes.status}`);
    }

    const passRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(passRow)
    });

    if (!passRes.ok) {
      const errText = await passRes.text();
      console.error('[Supabase Pass Write Failure]', errText);
      await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${paymentRow.id}`, {
        method: 'DELETE',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      throw new Error(`Database failure creating member pass: ${passRes.status}`);
    }

    if (creditRows.length > 0) {
      const credRes = await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(creditRows)
      });

      if (!credRes.ok) {
        const errText = await credRes.text();
        console.error('[Supabase Credits Write Failure]', errText);
        await fetch(`${SUPABASE_URL}/rest/v1/member_passes?id=eq.${passRow.id}`, {
          method: 'DELETE',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${paymentRow.id}`, {
          method: 'DELETE',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        throw new Error(`Database failure creating pass credits: ${credRes.status}`);
      }
    }

    // If member has unapproved Barre sessions, queue pending review for Physicq 57
    if (pendingBarreCount > 0) {
      try {
        const fs = require('fs');
        const path = require('path');
        const reviewFilePath = path.join(__dirname, 'data', 'partner_reviews.json');
        let reviews = [];
        if (fs.existsSync(reviewFilePath)) {
          try { reviews = JSON.parse(fs.readFileSync(reviewFilePath, 'utf-8')); } catch (_) {}
        }

        let mName = (rzpPayment && rzpPayment.notes && rzpPayment.notes.name) || 'Studio Member';
        let mEmail = candidateEmail || '';
        let mPhone = (rzpPayment && rzpPayment.contact) || '';
        try {
          const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(resolvedMemberId)}&select=*`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          if (pRes.ok) {
            const profs = await pRes.json();
            if (profs && profs[0]) {
              mName = profs[0].full_name || mName;
              mEmail = profs[0].email || mEmail;
              mPhone = profs[0].phone || mPhone;
            }
          }
        } catch (_) {}

        const newReview = {
          id: `prev-${passRow.id}`,
          passId: passRow.id,
          memberId: resolvedMemberId,
          memberName: mName,
          memberEmail: mEmail,
          memberPhone: mPhone,
          packageId: packageId,
          packageName: pkg.name || 'Barre Package',
          pendingBarreCredits: pendingBarreCount,
          status: 'pending',
          healthNotes: 'Standard health declaration',
          createdAt: now.toISOString(),
          decidedAt: null,
          decidedBy: null,
          decisionReason: null,
          adminNotified: false
        };

        const existingIdx = reviews.findIndex(r => r.passId === passRow.id || (r.memberId === resolvedMemberId && r.packageId === packageId && r.status === 'pending'));
        if (existingIdx >= 0) {
          reviews[existingIdx] = { ...reviews[existingIdx], ...newReview };
        } else {
          reviews.unshift(newReview);
        }

        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(reviewFilePath, JSON.stringify(reviews, null, 2));
        console.log(`[Barre Approval Gate] Member ${resolvedMemberId} queued for partner review with ${pendingBarreCount} pending credits.`);
      } catch (revErr) {
        console.error('[Barre Review Queue Error]', revErr.message);
      }
    }

    // 6. Automated Receipt Generation & Dispatch to Member
    let receiptDispatch = null;
    try {
      let memberProfile = null;
      const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(resolvedMemberId)}&select=id,email,full_name,phone`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      if (profRes.ok) {
        const pList = await profRes.json();
        if (pList && pList.length > 0) memberProfile = pList[0];
      }

      if (memberProfile && memberProfile.email) {
        receiptDispatch = await sendPaymentReceiptEmail({
          payment: paymentRow,
          pass: passRow,
          member: memberProfile,
          pkg
        });
      }
    } catch (mailErr) {
      console.warn('[Automated Receipt Mail Dispatch Warning]', mailErr.message);
    }

    return {
      success: true,
      payment: {
        id: paymentRow.id,
        memberId: paymentRow.member_id,
        packageId: paymentRow.package_id,
        baseAmountInr: paymentRow.base_amount_inr,
        cgstInr: paymentRow.cgst_inr,
        sgstInr: paymentRow.sgst_inr,
        totalAmountInr: paymentRow.total_amount_inr,
        amountInr: paymentRow.total_amount_inr,
        paymentMethod: paymentRow.payment_method,
        status: paymentRow.status,
        reference: paymentRow.reference,
        invoiceNo: paymentRow.invoice_no,
        invoiceNumber: paymentRow.invoice_no,
        createdAt: paymentRow.created_at,
        packageName: pkg.name
      },
      pass: {
        id: passRow.id,
        memberId: passRow.member_id,
        packageId: passRow.package_id,
        status: passRow.status,
        validFrom: passRow.valid_from,
        validUntil: passRow.valid_until
      },
      receipt: receiptDispatch || { success: true }
    };
  })();

  activeFulfillments.set(razorpay_payment_id, fulfillmentPromise);
  try {
    return await fulfillmentPromise;
  } finally {
    activeFulfillments.delete(razorpay_payment_id);
  }
}

// 6.1 Transactional Email Dispatcher for GST Tax Invoice Receipts
const EMBEDDED_INVOICE_HTML = require('./email-templates/invoice-html-string.cjs');

async function sendPaymentReceiptEmail({ payment, pass, member, pkg, overrideEmail }) {
  const invoiceNo = payment.invoice_no || payment.invoiceNo || `INV-${Date.now()}`;
  const memberEmail = (overrideEmail || member.email || '').trim().toLowerCase();
  const memberName = (member.full_name || member.fullName || member.name || 'Valued Member').trim();
  const memberPhone = (member.phone || 'N/A').trim();

  if (!memberEmail) {
    console.warn('[Receipt Mail Engine] No recipient email address provided.');
    return { success: false, error: 'Recipient email missing' };
  }

  // Read template
  const templatePath = path.join(ROOT_DIR, 'email-templates', 'payment-receipt-invoice.html');
  let html = '';
  if (fs.existsSync(templatePath)) {
    html = fs.readFileSync(templatePath, 'utf8');
  } else if (typeof EMBEDDED_INVOICE_HTML === 'string' && EMBEDDED_INVOICE_HTML) {
    html = EMBEDDED_INVOICE_HTML;
  } else {
    console.warn('[Receipt Mail Engine] Template not found at', templatePath);
    return { success: false, error: 'Email template not found' };
  }

  const baseAmt = Number(payment.base_amount_inr || payment.baseAmountInr || 0);
  const cgstAmt = Number(payment.cgst_inr || payment.cgstInr || 0);
  const sgstAmt = Number(payment.sgst_inr || payment.sgstInr || 0);
  const totalAmt = Number(payment.total_amount_inr || payment.totalAmountInr || 0);

  const paymentDate = payment.created_at || payment.createdAt ? new Date(payment.created_at || payment.createdAt) : new Date();
  const formattedDate = paymentDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
                        paymentDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST';

  let validUntilStr = 'Active';
  if (pass && (pass.valid_until || pass.validUntil)) {
    const vDate = new Date(pass.valid_until || pass.validUntil);
    validUntilStr = vDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } else if (pkg.duration_months || pkg.durationMonths) {
    const months = pkg.duration_months || pkg.durationMonths || 1;
    const vDate = new Date(paymentDate.getTime() + months * 30 * 24 * 60 * 60 * 1000);
    validUntilStr = vDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const sessionCount = `${pkg.total_credits || pkg.totalCredits || (pkg.duration_months ? pkg.duration_months * 10 : 10)} Sessions`;

  // Inject placeholders
  html = html
    .replace(/\{\{INVOICE_NO\}\}/g, invoiceNo)
    .replace(/\{\{MEMBER_NAME\}\}/g, memberName)
    .replace(/\{\{MEMBER_EMAIL\}\}/g, memberEmail)
    .replace(/\{\{MEMBER_PHONE\}\}/g, memberPhone)
    .replace(/\{\{PAYMENT_DATE\}\}/g, formattedDate)
    .replace(/\{\{PAYMENT_REF\}\}/g, payment.reference || payment.id || 'N/A')
    .replace(/\{\{PACKAGE_NAME\}\}/g, pkg.name || 'Studio Membership')
    .replace(/\{\{SESSION_COUNT\}\}/g, sessionCount)
    .replace(/\{\{BASE_AMOUNT\}\}/g, baseAmt.toLocaleString('en-IN'))
    .replace(/\{\{CGST_AMOUNT\}\}/g, cgstAmt.toLocaleString('en-IN'))
    .replace(/\{\{SGST_AMOUNT\}\}/g, sgstAmt.toLocaleString('en-IN'))
    .replace(/\{\{TOTAL_AMOUNT\}\}/g, totalAmt.toLocaleString('en-IN'))
    .replace(/\{\{VALID_UNTIL\}\}/g, validUntilStr);

  // Save copy to outbox
  try {
    const outboxDir = path.join(ROOT_DIR, 'outbox', 'receipts');
    if (!fs.existsSync(outboxDir)) {
      fs.mkdirSync(outboxDir, { recursive: true });
    }
    fs.writeFileSync(path.join(outboxDir, `${invoiceNo}.html`), html, 'utf8');
  } catch (fsErr) {
    console.warn('[Receipt Outbox Save Warning]', fsErr.message);
  }

  let dispatched = false;
  let provider = 'outbox';

  // 1. Check Brevo API Key
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (brevoApiKey) {
    try {
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: 'Plash Pilates Studio',
            email: process.env.SENDER_EMAIL || 'billing@plashpilates.com'
          },
          to: [{ email: memberEmail, name: memberName }],
          subject: `Payment Receipt & Tax Invoice ${invoiceNo} — Plash Pilates`,
          htmlContent: html
        })
      });
      if (brevoRes.ok) {
        dispatched = true;
        provider = 'brevo';
        console.log(`[Brevo] Tax invoice ${invoiceNo} emailed successfully to ${memberEmail}`);
      } else {
        const errJson = await brevoRes.json().catch(() => ({}));
        console.error('[Brevo Error dispatching receipt]', errJson);
      }
    } catch (bErr) {
      console.error('[Brevo dispatch exception]', bErr.message);
    }
  }

  // 2. Fallback: Resend API Key
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!dispatched && resendApiKey) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.SENDER_EMAIL || 'Plash Pilates <billing@plashpilates.com>',
          to: [memberEmail],
          subject: `Payment Receipt & Tax Invoice ${invoiceNo} — Plash Pilates`,
          html: html
        })
      });
      if (resendRes.ok) {
        dispatched = true;
        provider = 'resend';
        console.log(`[Resend] Tax invoice ${invoiceNo} emailed successfully to ${memberEmail}`);
      }
    } catch (rErr) {
      console.error('[Resend dispatch exception]', rErr.message);
    }
  }

  if (!dispatched) {
    console.log(`[Receipt Engine] Official Tax Invoice ${invoiceNo} generated for ${memberEmail}. Saved to outbox/receipts/${invoiceNo}.html (Provider: Outbox Archive)`);
  }

  return {
    success: true,
    dispatched: true,
    provider,
    invoiceNo,
    email: memberEmail,
    outboxPath: `outbox/receipts/${invoiceNo}.html`
  };
}

const EMBEDDED_INDEX_HTML = require('./email-templates/index-html-string.cjs');

// 7. HTTP Server
  const requestHandler = async (req, res) => {
    console.log(`[REQ :${req.socket?.localPort}] ${req.method} ${req.url}`);

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3333'}`);
    let pathname = urlObj.pathname;
    const pathParam = urlObj.searchParams.get('__path');
    if (pathParam) {
      pathname = `/api/${pathParam.replace(/^\/+/, '')}`;
    } else if (pathname.includes('server.js') || pathname.includes('[...path]') || pathname === '/api' || pathname === '') {
      if (req.headers['x-matched-path']) {
        pathname = req.headers['x-matched-path'];
      } else if (req.query && req.query.path) {
        const sub = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
        pathname = `/api/${sub}`;
      }
    }

    // API Route: Public Configuration
    if (req.method === 'GET' && pathname === '/api/public-config') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY,
        razorpayKeyId: RAZORPAY_KEY_ID
      }));
    }

    // API Route: Create Razorpay Order
    if (req.method === 'POST' && pathname === '/api/create-razorpay-order') {
      try {
        const body = await parseJsonBody(req);
        const order = await createRazorpayOrder(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ...order,
          success: true,
          orderId: order.id,
          id: order.id,
          keyId: RAZORPAY_KEY_ID
        }));
      } catch (err) {
        console.error('[API /api/create-razorpay-order error]', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // API Route: Verify Razorpay Payment Signature
    if (req.method === 'POST' && pathname === '/api/verify-razorpay-payment') {
      try {
        const body = await parseJsonBody(req);
        const isValid = verifyPaymentSignature(body);
        if (!isValid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid payment signature' }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // API Route: Verify and Fulfill Razorpay Payment (Zero Trust Fulfillment)
    if (req.method === 'POST' && pathname === '/api/verify-and-fulfill-payment') {
      try {
        const body = await parseJsonBody(req);
        const result = await fulfillVerifiedPayment(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[API /api/verify-and-fulfill-payment error]', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // API Route: Check Razorpay Order & Payment Status
    if (req.method === 'GET' && pathname === '/api/check-razorpay-order') {
      try {
        const orderId = urlObj.searchParams.get('orderId');
        if (!orderId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing orderId parameter' }));
        }
        const paymentsData = await getRazorpayOrderPayments(orderId);
        const items = (paymentsData && paymentsData.items) || [];
        const capturedPayment = items.find(p => p.status === 'captured');
        const failedPayment = items.find(p => p.status === 'failed');

        if (capturedPayment) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            isPaid: true,
            status: 'captured',
            payment: {
              id: capturedPayment.id,
              amount: capturedPayment.amount,
              method: capturedPayment.method
            }
          }));
        } else if (failedPayment) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            isPaid: false,
            status: 'failed',
            errorDescription: failedPayment.error_description || 'Transaction declined by issuer/gateway'
          }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            isPaid: false,
            status: items[0]?.status || 'created'
          }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // API Route: Auto-reconcile latest captured payment for member
    if (req.method === 'POST' && pathname === '/api/reconcile-recent-payment') {
      try {
        const body = await parseJsonBody(req);
        const { memberId, packageId } = body;
        if (!memberId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Missing memberId parameter' }));
        }

        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        const payments = await fetchRecentRazorpayPayments(10);

        for (const p of payments) {
          if (p.status !== 'captured') continue;

          // Check if already in DB
          const existRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?reference=eq.${encodeURIComponent(p.id)}&select=id`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          const existing = existRes.ok ? await existRes.json() : [];

          if (!existing || existing.length === 0) {
            const targetPkgId = packageId || p.notes?.packageId || 'pkg-001';
            const fulfillResult = await fulfillVerifiedPayment({
              razorpay_order_id: p.order_id,
              razorpay_payment_id: p.id,
              packageId: targetPkgId,
              memberId: memberId
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true, reconciled: true, ...fulfillResult }));
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'No unfulfilled payments found' }));
      } catch (err) {
        console.error('[API /api/reconcile-recent-payment error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // API Route: Send / Re-send Payment Receipt Tax Invoice Email
    if (req.method === 'POST' && pathname === '/api/send-receipt-email') {
      try {
        const body = await parseJsonBody(req);
        const { paymentId, invoiceNo, email } = body;

        if (!paymentId && !invoiceNo) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'paymentId or invoiceNo is required' }));
        }

        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        let payment = null;

        if (paymentId) {
          const pRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${encodeURIComponent(paymentId)}&select=*`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          if (pRes.ok) {
            const list = await pRes.json();
            if (list.length > 0) payment = list[0];
          }
        }
        if (!payment && invoiceNo) {
          const pRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?invoice_no=eq.${encodeURIComponent(invoiceNo)}&select=*`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          if (pRes.ok) {
            const list = await pRes.json();
            if (list.length > 0) payment = list[0];
          }
        }

        if (!payment) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Payment invoice record not found' }));
        }

        // Fetch package
        let pkg = { name: 'Studio Membership' };
        if (payment.package_id) {
          const pkgRes = await fetch(`${SUPABASE_URL}/rest/v1/packages?id=eq.${encodeURIComponent(payment.package_id)}&select=*`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          if (pkgRes.ok) {
            const pkgs = await pkgRes.json();
            if (pkgs.length > 0) pkg = pkgs[0];
          }
        }

        // Fetch member
        let member = { email: email || '', full_name: 'Studio Member' };
        if (payment.member_id) {
          const mRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(payment.member_id)}&select=*`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          if (mRes.ok) {
            const members = await mRes.json();
            if (members.length > 0) member = members[0];
          }
        }

        // Fetch pass
        let pass = null;
        if (payment.member_id && payment.package_id) {
          const passRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${encodeURIComponent(payment.member_id)}&package_id=eq.${encodeURIComponent(payment.package_id)}&order=created_at.desc&limit=1`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          if (passRes.ok) {
            const passes = await passRes.json();
            if (passes.length > 0) pass = passes[0];
          }
        }

        const dispatchResult = await sendPaymentReceiptEmail({
          payment,
          pass,
          member,
          pkg,
          overrideEmail: email
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: `Official Tax Invoice ${payment.invoice_no} dispatched to ${dispatchResult.email}`,
          ...dispatchResult
        }));
      } catch (err) {
        console.error('[API /api/send-receipt-email error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // API Route: Preview Generated Receipt HTML
    if (req.method === 'GET' && pathname === '/api/receipts/preview') {
      try {
        const invoiceNo = urlObj.searchParams.get('invoiceNo');
        if (!invoiceNo) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          return res.end('Missing invoiceNo query parameter');
        }
        const filePath = path.join(ROOT_DIR, 'outbox', 'receipts', `${path.basename(invoiceNo)}.html`);
        if (fs.existsSync(filePath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(fs.readFileSync(filePath, 'utf8'));
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end(`Receipt for ${invoiceNo} not found in outbox.`);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end(`Error: ${err.message}`);
      }
    }

    // API Route: Authoritative Member Payments Retrieval (Bypasses Anon RLS using Service Role)
    if (req.method === 'GET' && pathname === '/api/member/payments') {
      try {
        // Authoritative gateway reconciliation: ensure all captured payments exist in Supabase
        await syncAllRazorpayPaymentsToSupabase(30).catch(() => {});

        const memberId = urlObj.searchParams.get('memberId');
        const email = urlObj.searchParams.get('email');
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        let payments = [];

        if (!memberId && !email) {
          const pRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?select=*,member:profiles(id,full_name,email,phone,tier),package:packages(*)&order=created_at.desc`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          if (pRes.ok) {
            payments = await pRes.json();
          }
        } else {
          let candidateIds = [];
          if (memberId) candidateIds.push(memberId);

          if (email) {
            const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (profRes.ok) {
              const profs = await profRes.json();
              profs.forEach(p => { if (!candidateIds.includes(p.id)) candidateIds.push(p.id); });
            }
          }

          for (const mid of candidateIds) {
            const pRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?member_id=eq.${encodeURIComponent(mid)}&select=*,member:profiles(id,full_name,email,phone,tier),package:packages(*)&order=created_at.desc`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (pRes.ok) {
              const rows = await pRes.json();
              rows.forEach(r => {
                if (!payments.some(p => p.id === r.id)) payments.push(r);
              });
            }
          }
        }

        const mapped = payments.map(p => ({
          id: p.id,
          memberId: p.member_id,
          packageId: p.package_id,
          invoiceNo: p.invoice_no,
          gstin: p.gstin || '29ABIFP5917A1Z7',
          baseAmountInr: Number(p.base_amount_inr),
          cgstInr: Number(p.cgst_inr),
          sgstInr: Number(p.sgst_inr),
          totalAmountInr: Number(p.total_amount_inr),
          amountInr: Number(p.total_amount_inr),
          paymentMethod: p.payment_method,
          reference: p.reference,
          status: p.status,
          createdAt: p.created_at,
          packageName: p.package?.name || 'Studio Membership Package',
          member: p.member || {},
          package: p.package || {}
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(mapped));
      } catch (err) {
        console.error('[API /api/member/payments error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // API Route: Authoritative Member Passes Retrieval (Bypasses Anon RLS using Service Role)
    if (req.method === 'GET' && pathname === '/api/member/passes') {
      try {
        const memberId = urlObj.searchParams.get('memberId');
        const email = urlObj.searchParams.get('email');
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        let passes = [];

        if (!memberId && !email) {
          const passRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?select=*,member:profiles(id,full_name,email,phone),package:packages(*),credits:member_pass_credits(*)&order=created_at.desc`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          if (passRes.ok) {
            passes = await passRes.json();
          }
        } else {
          let candidateIds = [];
          if (memberId) candidateIds.push(memberId);

          if (email) {
            const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (profRes.ok) {
              const profs = await profRes.json();
              profs.forEach(p => { if (!candidateIds.includes(p.id)) candidateIds.push(p.id); });
            }
          }

          for (const mid of candidateIds) {
            const passRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${encodeURIComponent(mid)}&select=*,member:profiles(id,full_name,email,phone),package:packages(*),credits:member_pass_credits(*)&order=created_at.desc`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (passRes.ok) {
              const rows = await passRes.json();
              rows.forEach(r => {
                if (!passes.some(p => p.id === r.id)) passes.push(r);
              });
            }
          }
        }

        const mapped = passes.map(p => ({
          id: p.id,
          memberId: p.member_id,
          packageId: p.package_id,
          status: p.status,
          validFrom: p.valid_from,
          validUntil: p.valid_until,
          purchasedAt: p.created_at,
          expiresAt: p.valid_until,
          package: p.package,
          member: p.member,
          credits: (p.credits || []).map(c => ({
            disciplineId: c.discipline_id,
            sessionsIncluded: c.total_credits,
            sessionsUsed: c.total_credits - c.remaining_credits,
            remainingCredits: c.remaining_credits
          }))
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(mapped));
      } catch (err) {
        console.error('[API /api/member/passes error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // API Route: Authoritative Members & Profiles Query (Bypasses Anon RLS using Service Role)
    if (req.method === 'GET' && pathname === '/api/members') {
      try {
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*&order=created_at.desc`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (profRes.ok) {
          const profiles = await profRes.json();
          const mapped = profiles.map(m => ({
            id: m.id,
            email: m.email,
            fullName: m.full_name,
            name: m.full_name,
            phone: m.phone,
            whatsappNumber: m.phone,
            role: m.role,
            tier: m.tier,
            avatarUrl: m.avatar_url,
            profilePhotoUrl: m.avatar_url,
            joinedAt: m.created_at
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(mapped));
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Failed to fetch profiles from database' }));
      } catch (err) {
        console.error('[API /api/members error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // API Route: Razorpay Webhooks (Realtime payment capture ingestion for all members)
    if (req.method === 'POST' && pathname === '/api/webhooks/razorpay') {
      try {
        const body = await parseJsonBody(req);
        console.log('[Razorpay Webhook Event]', body?.event);
        if (body?.event === 'payment.captured' || body?.event === 'order.paid') {
          await syncAllRazorpayPaymentsToSupabase(15);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok' }));
      } catch (webhookErr) {
        console.error('[Webhook error]', webhookErr.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ignored' }));
      }
    }

    // API Route: Authoritative Member Profile Update (Bypasses Anon RLS using Service Role)
    if (req.method === 'POST' && pathname === '/api/member/update-profile') {
      try {
        const body = await parseJsonBody(req);
        const { memberId, updates } = body;
        if (!memberId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'memberId is required' }));
        }

        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        const patch = { updated_at: new Date().toISOString() };
        if (updates.fullName !== undefined) patch.full_name = updates.fullName.trim();
        if (updates.name !== undefined && updates.fullName === undefined) patch.full_name = updates.name.trim();
        if (updates.phone !== undefined) patch.phone = updates.phone ? updates.phone.trim() : null;
        if (updates.email !== undefined) patch.email = updates.email.trim().toLowerCase();
        if (updates.tier !== undefined) patch.tier = updates.tier;

        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(memberId)}`, {
          method: 'PATCH',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify(patch)
        });

        const updated = updateRes.ok ? await updateRes.json() : null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, profile: updated && updated[0] }));
      } catch (err) {
        console.error('[API /api/member/update-profile error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // API Route: Authoritative Member Health Profile Update (Bypasses Anon RLS using Service Role)
    if (req.method === 'POST' && pathname === '/api/member/update-health') {
      try {
        const body = await parseJsonBody(req);
        const { memberId, healthData } = body;
        if (!memberId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'memberId is required' }));
        }

        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        const medConditions = Array.isArray(healthData.medicalConditions) ? healthData.medicalConditions :
                              Array.isArray(healthData.healthConditions) ? healthData.healthConditions : [];
        if (healthData.isPregnant && !medConditions.includes('Pregnancy/Postnatal')) {
          medConditions.push('Pregnancy/Postnatal');
        }

        const healthRow = {
          member_id: memberId,
          medical_conditions: medConditions,
          injuries: Array.isArray(healthData.injuries) ? healthData.injuries : (healthData.injuries ? [healthData.injuries] : []),
          emergency_contact_name: healthData.emergencyContactName || healthData.emergencyContact || null,
          emergency_contact_phone: healthData.emergencyContactPhone || null,
          notes: healthData.notes || (healthData.experience ? `Experience: ${healthData.experience}` : null),
          updated_at: new Date().toISOString()
        };

        const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/health_profiles?on_conflict=member_id`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(healthRow)
        });

        const saved = upsertRes.ok ? await upsertRes.json() : null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, healthProfile: saved && saved[0] }));
      } catch (err) {
        console.error('[API /api/member/update-health error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // Helper functions for bookings file persistence
    function getBookingsFromFile() {
      try {
        const p = path.join(__dirname, 'data', 'bookings.json');
        if (fs.existsSync(p)) {
          return JSON.parse(fs.readFileSync(p, 'utf-8')) || [];
        }
      } catch (_) {}
      try {
        const tmpPath = path.join('/tmp', 'bookings.json');
        if (fs.existsSync(tmpPath)) {
          return JSON.parse(fs.readFileSync(tmpPath, 'utf-8')) || [];
        }
      } catch (_) {}
      return [];
    }

    function saveBookingsToFile(list) {
      try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'bookings.json'), JSON.stringify(list, null, 2));
      } catch (_) {
        try {
          fs.writeFileSync(path.join('/tmp', 'bookings.json'), JSON.stringify(list, null, 2));
        } catch (_) {}
      }
    }

    // API Route: Authoritative Booking Actions (Create, Cancel, Attendance, Barre Approval)
    if (req.method === 'POST' && pathname === '/api/member/booking-action') {
      try {
        const body = await parseJsonBody(req);
        const { action, bookingId, memberId, sessionId, passId, status } = body;
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

        if (action === 'create') {
          const newBooking = {
            id: bookingId || `book-${Date.now()}`,
            member_id: memberId,
            session_id: sessionId,
            pass_id: passId || null,
            status: status || 'upcoming',
            booked_at: new Date().toISOString()
          };

          // Authoritative local file persistence
          const localBookings = getBookingsFromFile();
          if (!localBookings.some(b => b.id === newBooking.id || (b.member_id === newBooking.member_id && b.session_id === newBooking.session_id && b.status !== 'cancelled'))) {
            localBookings.unshift(newBooking);
            saveBookingsToFile(localBookings);
          }

          let created = null;
          try {
            const bRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
              method: 'POST',
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation'
              },
              body: JSON.stringify(newBooking)
            });
            if (bRes.ok) {
              const resJson = await bRes.json();
              if (resJson && resJson[0]) created = resJson[0];
            }
          } catch (_) {}

          // Authoritatively decrement pass credit in Supabase
          if (passId || memberId) {
            try {
              let targetDiscipline = body.disciplineId;
              if (!targetDiscipline && sessionId) {
                const localSessions = getClassSessionsFromFile();
                const matched = localSessions.find(s => s.id === sessionId);
                if (matched) targetDiscipline = matched.discipline_id || matched.disciplineId;
              }
              const aliasMap = {
                'disc-001': 'disc-pilates',
                'disc-002': 'disc-barre',
                'disc-003': 'disc-sculpt-yoga'
              };
              const normDiscipline = aliasMap[targetDiscipline] || targetDiscipline;

              let creds = null;
              if (passId) {
                let credUrl = `${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${encodeURIComponent(passId)}`;
                if (normDiscipline) credUrl += `&discipline_id=eq.${encodeURIComponent(normDiscipline)}`;
                credUrl += `&limit=1`;
                const credRes = await fetch(credUrl, {
                  headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                });
                if (credRes.ok) creds = await credRes.json();
              }

              // Fallback: If passId not provided or has 0 credits, look across all active passes of member
              if ((!creds || !creds[0] || creds[0].remaining_credits <= 0) && memberId) {
                const pRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${encodeURIComponent(memberId)}&status=eq.active&select=id`, {
                  headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                });
                if (pRes.ok) {
                  const activePasses = await pRes.json();
                  for (const ap of (activePasses || [])) {
                    let apUrl = `${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${encodeURIComponent(ap.id)}`;
                    if (normDiscipline) apUrl += `&discipline_id=eq.${encodeURIComponent(normDiscipline)}`;
                    apUrl += `&limit=1`;
                    const apRes = await fetch(apUrl, {
                      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                    });
                    if (apRes.ok) {
                      const apCreds = await apRes.json();
                      if (apCreds && apCreds[0] && apCreds[0].remaining_credits > 0) {
                        creds = apCreds;
                        break;
                      }
                    }
                  }
                }
              }

              if (creds && creds[0] && creds[0].remaining_credits > 0) {
                await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?id=eq.${creds[0].id}`, {
                  method: 'PATCH',
                  headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ remaining_credits: creds[0].remaining_credits - 1 })
                });
              }
            } catch (_) {}
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, booking: created || newBooking }));
        }

        if (action === 'decrement_credit') {
          if (passId || memberId) {
            try {
              let targetDiscipline = body.disciplineId;
              if (!targetDiscipline && sessionId) {
                const localSessions = getClassSessionsFromFile();
                const matched = localSessions.find(s => s.id === sessionId);
                if (matched) targetDiscipline = matched.discipline_id || matched.disciplineId;
              }
              const aliasMap = {
                'disc-001': 'disc-pilates',
                'disc-002': 'disc-barre',
                'disc-003': 'disc-sculpt-yoga'
              };
              const normDiscipline = aliasMap[targetDiscipline] || targetDiscipline;

              let creds = null;
              if (passId) {
                let credUrl = `${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${encodeURIComponent(passId)}`;
                if (normDiscipline) credUrl += `&discipline_id=eq.${encodeURIComponent(normDiscipline)}`;
                credUrl += `&limit=1`;
                const credRes = await fetch(credUrl, {
                  headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                });
                if (credRes.ok) creds = await credRes.json();
              }

              if ((!creds || !creds[0] || creds[0].remaining_credits <= 0) && memberId) {
                const pRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${encodeURIComponent(memberId)}&status=eq.active&select=id`, {
                  headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                });
                if (pRes.ok) {
                  const activePasses = await pRes.json();
                  for (const ap of (activePasses || [])) {
                    let apUrl = `${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${encodeURIComponent(ap.id)}`;
                    if (normDiscipline) apUrl += `&discipline_id=eq.${encodeURIComponent(normDiscipline)}`;
                    apUrl += `&limit=1`;
                    const apRes = await fetch(apUrl, {
                      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                    });
                    if (apRes.ok) {
                      const apCreds = await apRes.json();
                      if (apCreds && apCreds[0] && apCreds[0].remaining_credits > 0) {
                        creds = apCreds;
                        break;
                      }
                    }
                  }
                }
              }

              if (creds && creds[0] && creds[0].remaining_credits > 0) {
                await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?id=eq.${creds[0].id}`, {
                  method: 'PATCH',
                  headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ remaining_credits: creds[0].remaining_credits - 1 })
                });
              }
            } catch (_) {}
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        }

        if (action === 'cancel' || action === 'admin_cancel') {
          const patch = {
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
          };

          // Update local bookings file
          const localBookings = getBookingsFromFile();
          const target = localBookings.find(b => b.id === bookingId);
          if (target) {
            target.status = 'cancelled';
            target.cancelled_at = patch.cancelled_at;
            saveBookingsToFile(localBookings);
          }

          // Fetch existing booking to resolve pass_id for credit restoration
          try {
            const bLookup = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}&select=pass_id,session_id`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            let targetPassId = target?.pass_id || target?.passId || null;
            let targetSessionId = target?.session_id || target?.sessionId || null;
            if (bLookup.ok) {
              const bData = await bLookup.json();
              if (bData && bData[0]) {
                if (bData[0].pass_id) targetPassId = bData[0].pass_id;
                if (bData[0].session_id) targetSessionId = bData[0].session_id;
              }
            }
            if (targetPassId) {
              let targetDiscipline = disciplineId || body.discipline_id || null;
              if (!targetDiscipline && targetSessionId) {
                const localSessions = getClassSessionsFromFile();
                const matched = localSessions.find(s => s.id === targetSessionId);
                if (matched) {
                  targetDiscipline = matched.discipline_id || matched.disciplineId;
                } else if (SUPABASE_URL && supabaseKey) {
                  const sRes = await fetch(`${SUPABASE_URL}/rest/v1/class_sessions?id=eq.${encodeURIComponent(targetSessionId)}&select=discipline_id`, {
                    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                  });
                  if (sRes.ok) {
                    const sData = await sRes.json();
                    if (sData && sData[0]) targetDiscipline = sData[0].discipline_id;
                  }
                }
              }
              const aliasMap = {
                'disc-001': 'disc-pilates',
                'disc-002': 'disc-barre',
                'disc-003': 'disc-sculpt-yoga'
              };
              const normDiscipline = aliasMap[targetDiscipline] || targetDiscipline;

              if (normDiscipline) {
                const credUrl = `${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${encodeURIComponent(targetPassId)}&discipline_id=eq.${encodeURIComponent(normDiscipline)}&limit=1`;
                const credRes = await fetch(credUrl, {
                  headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                });
                if (credRes.ok) {
                  const creds = await credRes.json();
                  if (creds && creds[0]) {
                    await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?id=eq.${creds[0].id}`, {
                      method: 'PATCH',
                      headers: {
                        apikey: supabaseKey,
                        Authorization: `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ remaining_credits: creds[0].remaining_credits + 1 })
                    });
                  }
                }
              }
            }
          } catch (_) {}

          try {
            await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
              method: 'PATCH',
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation'
              },
              body: JSON.stringify(patch)
            });
          } catch (_) {}

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        }

        if (action === 'attendance') {
          const patch = { status: status || 'completed' };

          // Update local bookings file
          const localBookings = getBookingsFromFile();
          const target = localBookings.find(b => b.id === bookingId || (body.memberId && (b.member_id === body.memberId || b.memberId === body.memberId) && (b.session_id === body.sessionId || b.sessionId === body.sessionId)));
          if (target) {
            target.status = patch.status;
            target.attendance_status = patch.status;
            target.credit_waived = !!body.refundCredit;
            target.creditWaived = !!body.refundCredit;
            if (body.reason) {
              target.attendance_notes = body.reason;
              target.attendanceNotes = body.reason;
            }
            target.attendance_marked_at = new Date().toISOString();
            saveBookingsToFile(localBookings);
          }

          // If no-show and refundCredit is requested by trainer, restore credit
          if (status === 'no_show' && body.refundCredit) {
            try {
              const bLookup = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}&select=pass_id`, {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
              });
              let targetPassId = null;
              if (bLookup.ok) {
                const bData = await bLookup.json();
                targetPassId = bData && bData[0] ? bData[0].pass_id : null;
              }
              if (!targetPassId && target) {
                targetPassId = target.pass_id || target.passId;
              }
              if (targetPassId) {
                const credRes = await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${encodeURIComponent(targetPassId)}&order=created_at.desc&limit=1`, {
                  headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                });
                if (credRes.ok) {
                  const creds = await credRes.json();
                  if (creds && creds[0]) {
                    await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?id=eq.${creds[0].id}`, {
                      method: 'PATCH',
                      headers: {
                        apikey: supabaseKey,
                        Authorization: `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ remaining_credits: creds[0].remaining_credits + 1 })
                    });
                  }
                }
              }
            } catch (_) {}
          }

          // Translate to Supabase enum ('completed' -> 'attended', 'upcoming' -> 'confirmed')
          const supaStatus = status === 'completed' ? 'attended' : (status === 'upcoming' ? 'confirmed' : status);
          if (SUPABASE_URL && supabaseKey) {
            try {
              const pRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
                method: 'PATCH',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                  Prefer: 'return=representation'
                },
                body: JSON.stringify({ status: supaStatus })
              });
              const patchedData = pRes.ok ? await pRes.json() : null;

              // Fallback: match by member_id and session_id if ID was re-generated locally
              const tMemberId = (target && (target.member_id || target.memberId)) || body.memberId;
              const tSessionId = (target && (target.session_id || target.sessionId)) || body.sessionId;
              if ((!patchedData || patchedData.length === 0) && tMemberId && tSessionId) {
                await fetch(`${SUPABASE_URL}/rest/v1/bookings?member_id=eq.${encodeURIComponent(tMemberId)}&session_id=eq.${encodeURIComponent(tSessionId)}`, {
                  method: 'PATCH',
                  headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ status: supaStatus })
                });
              }
            } catch (_) {}
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        }

        if (action === 'approve_barre' || action === 'decline_barre') {
          const patch = { status: action === 'approve_barre' ? 'upcoming' : 'cancelled' };
          const localBookings = getBookingsFromFile();
          const target = localBookings.find(b => b.id === bookingId);
          if (target) {
            target.status = patch.status;
            saveBookingsToFile(localBookings);
          }
          try {
            await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
              method: 'PATCH',
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(patch)
            });
          } catch (_) {}
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unknown action' }));
      } catch (err) {
        console.error('[API /api/member/booking-action error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // API Route: Authoritative Bookings Retrieval from Server JSON Storage & Supabase
    if (req.method === 'GET' && pathname === '/api/bookings') {
      try {
        const memberId = urlObj.searchParams.get('memberId');
        let localBookings = getBookingsFromFile();

        let remoteBookings = [];
        try {
          const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
          if (SUPABASE_URL && supabaseKey) {
            let queryUrl = `${SUPABASE_URL}/rest/v1/bookings?select=*,member:profiles(id,full_name,email,phone),session:class_sessions(*)&order=booked_at.desc`;
            if (memberId) {
              queryUrl += `&member_id=eq.${encodeURIComponent(memberId)}`;
            }
            const bRes = await fetch(queryUrl, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (bRes.ok) {
              const rawRemote = await bRes.json();
              if (Array.isArray(rawRemote)) {
                remoteBookings = rawRemote.map(b => {
                  let s = b.status;
                  if (s === 'confirmed') s = 'upcoming';
                  if (s === 'attended') s = 'completed';
                  return { ...b, status: s };
                });
              }
            }
          }
        } catch (_) {}

        // Merge remote and local bookings without duplicates
        const remoteIds = new Set((remoteBookings || []).map(b => b.id));
        const remotePairKeys = new Set(
          (remoteBookings || []).map(b => `${b.member_id || b.memberId}__${b.session_id || b.sessionId}`)
        );
        const merged = [
          ...(remoteBookings || []),
          ...localBookings.filter(b => !remoteIds.has(b.id) && !remotePairKeys.has(`${b.member_id || b.memberId}__${b.session_id || b.sessionId}`))
        ];

        // Filter by memberId if requested
        const filtered = memberId ? merged.filter(b => (b.member_id || b.memberId) === memberId) : merged;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(filtered));
      } catch (err) {
        console.error('[API /api/bookings error]', err.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(getBookingsFromFile()));
      }
    }

    // API Route: Physicq 57 Partner Reviews State & Storage
    if (req.method === 'GET' && pathname === '/api/partner/reviews') {
      try {
        const fs = require('fs');
        const path = require('path');
        const reviewFilePath = path.join(__dirname, 'data', 'partner_reviews.json');
        let reviews = [];
        if (fs.existsSync(reviewFilePath)) {
          try {
            reviews = JSON.parse(fs.readFileSync(reviewFilePath, 'utf-8'));
          } catch (_) {}
        }
        try {
          const tmpPath = path.join('/tmp', 'partner_reviews.json');
          if (fs.existsSync(tmpPath)) {
            const tmpReviews = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
            if (Array.isArray(tmpReviews) && tmpReviews.length > 0) {
              tmpReviews.forEach(tr => {
                const idx = reviews.findIndex(r => r.id === tr.id || r.passId === tr.passId);
                if (idx >= 0) reviews[idx] = { ...reviews[idx], ...tr };
                else reviews.push(tr);
              });
            }
          }
        } catch (_) {}
        if (!Array.isArray(reviews)) reviews = [];

        // Merge persistent decisions from Supabase partner_notifications
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        if (SUPABASE_URL && supabaseKey) {
          try {
            const notifRes = await fetch(`${SUPABASE_URL}/rest/v1/partner_notifications?org_id=eq.partner-physicq57&type=eq.partner_review&select=*`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (notifRes.ok) {
              const notifs = await notifRes.json();
              (notifs || []).forEach(n => {
                try {
                  const saved = JSON.parse(n.message);
                  if (saved && (saved.id || saved.passId)) {
                    const idx = reviews.findIndex(r => r.id === saved.id || r.passId === saved.passId);
                    if (idx >= 0) {
                      reviews[idx] = { ...reviews[idx], ...saved };
                    } else {
                      reviews.unshift(saved);
                    }
                  }
                } catch (_) {}
              });
            }
          } catch (supaErr) {
            console.warn('[Partner reviews Supabase notif sync warning]', supaErr.message);
          }
        }

        // Auto-seed/sync from live Supabase member_passes with Barre (safe non-blocking)
        try {
          if (SUPABASE_URL && supabaseKey) {
            const passRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?select=*,member:profiles(*),package:packages(*),credits:member_pass_credits(*)&order=created_at.desc`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (passRes.ok) {
              const livePasses = await passRes.json();
              let mutated = false;
              livePasses.forEach(pass => {
                const pkgName = pass.package?.name || '';
                const hasBarre = pkgName.toLowerCase().includes('barre') || (pass.credits && pass.credits.some(c => c.discipline_id === 'disc-barre'));
                if (hasBarre) {
                  const cleanPassId = pass.id;
                  const existing = reviews.find(r => r.passId === cleanPassId || r.id === `prev-${cleanPassId}` || (r.memberId === pass.member_id && r.packageId === pass.package_id));
                  if (!existing) {
                    const barreCredit = (pass.credits || []).find(c => c.discipline_id === 'disc-barre');
                    const pendingCount = barreCredit ? (barreCredit.total_credits || barreCredit.remaining_credits || 12) : 12;
                    reviews.push({
                      id: `prev-${cleanPassId}`,
                      passId: cleanPassId,
                      memberId: pass.member_id,
                      memberName: pass.member?.full_name || 'Member',
                      memberEmail: pass.member?.email || '',
                      memberPhone: pass.member?.phone || '',
                      packageId: pass.package_id,
                      packageName: pkgName || 'Barre Package',
                      pendingBarreCredits: pendingCount,
                      status: 'pending',
                      healthNotes: 'Standard health declaration',
                      createdAt: pass.created_at || new Date().toISOString(),
                      decidedAt: null,
                      decidedBy: null,
                      decisionReason: null,
                      adminNotified: false
                    });
                    mutated = true;
                  }
                }
              });
              if (mutated) {
                try {
                  const dataDir = path.join(__dirname, 'data');
                  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
                  fs.writeFileSync(reviewFilePath, JSON.stringify(reviews, null, 2));
                } catch (_) {
                  try {
                    fs.writeFileSync(path.join('/tmp', 'partner_reviews.json'), JSON.stringify(reviews, null, 2));
                  } catch (__) {}
                }
              }
            }
          }
        } catch (syncErr) {
          console.warn('[Partner reviews Supabase sync non-fatal error]', syncErr.message);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, reviews }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if (req.method === 'POST' && pathname === '/api/partner/reviews') {
      try {
        const fs = require('fs');
        const path = require('path');
        const body = await parseJsonBody(req);
        const reviewFilePath = path.join(__dirname, 'data', 'partner_reviews.json');
        let reviews = [];
        if (fs.existsSync(reviewFilePath)) {
          try {
            reviews = JSON.parse(fs.readFileSync(reviewFilePath, 'utf-8'));
          } catch (_) {}
        }
        try {
          const tmpPath = path.join('/tmp', 'partner_reviews.json');
          if (fs.existsSync(tmpPath)) {
            const tmpReviews = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
            if (Array.isArray(tmpReviews) && tmpReviews.length > 0) {
              tmpReviews.forEach(tr => {
                const idx = reviews.findIndex(r => r.id === tr.id || r.passId === tr.passId);
                if (idx >= 0) reviews[idx] = { ...reviews[idx], ...tr };
                else reviews.push(tr);
              });
            }
          }
        } catch (_) {}
        if (!Array.isArray(reviews)) reviews = [];

        // Merge persistent decisions from Supabase partner_notifications
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        if (SUPABASE_URL && supabaseKey) {
          try {
            const notifRes = await fetch(`${SUPABASE_URL}/rest/v1/partner_notifications?org_id=eq.partner-physicq57&type=eq.partner_review&select=*`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (notifRes.ok) {
              const notifs = await notifRes.json();
              (notifs || []).forEach(n => {
                try {
                  const saved = JSON.parse(n.message);
                  if (saved && (saved.id || saved.passId)) {
                    const idx = reviews.findIndex(r => r.id === saved.id || r.passId === saved.passId);
                    if (idx >= 0) {
                      reviews[idx] = { ...reviews[idx], ...saved };
                    } else {
                      reviews.unshift(saved);
                    }
                  }
                } catch (_) {}
              });
            }
          } catch (supaErr) {
            console.warn('[Partner reviews Supabase notif sync warning]', supaErr.message);
          }
        }

        if (body.action === 'save_all' && Array.isArray(body.reviews)) {
          reviews = body.reviews;
        } else if (body.action === 'upsert' && body.review) {
          const idx = reviews.findIndex(r => r.id === body.review.id || (r.memberId === body.review.memberId && r.packageId === body.review.packageId));
          if (idx >= 0) {
            reviews[idx] = { ...reviews[idx], ...body.review };
          } else {
            reviews.unshift(body.review);
          }
        } else if (body.action === 'decide' && body.reviewId) {
          let r = reviews.find(x => x.id === body.reviewId || x.passId === body.reviewId.replace('prev-', ''));
          if (!r) {
            const passId = body.reviewId.startsWith('prev-') ? body.reviewId.replace('prev-', '') : body.reviewId;
            r = {
              id: body.reviewId,
              passId,
              status: body.status,
              createdAt: new Date().toISOString()
            };
            reviews.unshift(r);
          }

          r.status = body.status; // 'accepted' | 'declined'
          r.decisionReason = body.reason || null;
          r.decidedAt = new Date().toISOString();
          r.decidedBy = body.decidedBy || 'Physicq 57 Coach';
          r.adminNotified = true;

          let targetPassId = r.passId;
          if (!targetPassId && body.reviewId.startsWith('prev-')) {
            targetPassId = body.reviewId.replace('prev-', '');
          }

          if (!targetPassId && r.memberId) {
            try {
              const pRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${encodeURIComponent(r.memberId)}&order=created_at.desc&limit=1`, {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
              });
              if (pRes.ok) {
                const pl = await pRes.json();
                if (pl && pl[0]) targetPassId = pl[0].id;
              }
            } catch (_) {}
          }

          // If accepted, grant Barre credits in Supabase member_pass_credits
          if (body.status === 'accepted') {
            try {
              const creditsToGrant = Number(r.pendingBarreCredits) || 12;
              if (targetPassId) {
                const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${encodeURIComponent(targetPassId)}&discipline_id=eq.disc-barre`, {
                  method: 'PATCH',
                  headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
                  },
                  body: JSON.stringify({
                    total_credits: creditsToGrant,
                    remaining_credits: creditsToGrant
                  })
                });
                console.log(`[Barre Approval Accepted] Granted ${creditsToGrant} Barre credits for pass ${targetPassId}, HTTP ${patchRes.status}`);
              }
            } catch (grantErr) {
              console.error('[Barre Credit Unlock Error]', grantErr.message);
            }
          } else if (body.status === 'declined') {
            // If declined, set Barre credits to 0
            try {
              if (targetPassId) {
                const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${encodeURIComponent(targetPassId)}&discipline_id=eq.disc-barre`, {
                  method: 'PATCH',
                  headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
                  },
                  body: JSON.stringify({
                    total_credits: 0,
                    remaining_credits: 0
                  })
                });
                console.log(`[Barre Approval Declined] Set Barre credits to 0 for pass ${targetPassId}, HTTP ${patchRes.status}`);
              }
            } catch (decErr) {
              console.error('[Barre Credit Decline Error]', decErr.message);
            }
          }

          // Cloud Persistence in Supabase partner_notifications
          if (SUPABASE_URL && supabaseKey && r) {
            try {
              await fetch(`${SUPABASE_URL}/rest/v1/partner_notifications?org_id=eq.partner-physicq57&type=eq.partner_review&title=eq.${encodeURIComponent(r.id)}`, {
                method: 'DELETE',
                headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
              });
              await fetch(`${SUPABASE_URL}/rest/v1/partner_notifications`, {
                method: 'POST',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  org_id: 'partner-physicq57',
                  type: 'partner_review',
                  title: r.id,
                  message: JSON.stringify(r),
                  read: true
                })
              });
            } catch (supaSaveErr) {
              console.warn('[Partner review decision Supabase persist warning]', supaSaveErr.message);
            }
          }
        } else if (body.action === 'refund' && body.reviewId) {
          let r = reviews.find(x => x.id === body.reviewId || x.passId === body.reviewId.replace('prev-', ''));
          if (r) {
            r.refundStatus = 'refunded';
            r.refundRef = body.refundRef || `REF-${Date.now()}`;
            r.refundMethod = body.refundMethod || 'Razorpay Gateway';
            r.refundedAt = new Date().toISOString();
            r.refundNotes = body.notes || '';
            r.refundProcessedBy = body.processedBy || 'Studio Administrator';
            if (body.amount) r.refundAmount = Number(body.amount);

            // Cloud Persistence in Supabase partner_notifications
            if (SUPABASE_URL && supabaseKey) {
              try {
                await fetch(`${SUPABASE_URL}/rest/v1/partner_notifications?org_id=eq.partner-physicq57&type=eq.partner_review&title=eq.${encodeURIComponent(r.id)}`, {
                  method: 'DELETE',
                  headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                });
                await fetch(`${SUPABASE_URL}/rest/v1/partner_notifications`, {
                  method: 'POST',
                  headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    org_id: 'partner-physicq57',
                    type: 'partner_review',
                    title: r.id,
                    message: JSON.stringify(r),
                    read: true
                  })
                });
              } catch (_) {}
            }
          }
        }

        // Safe file write (won't crash on read-only serverless filesystem)
        try {
          const dataDir = path.join(__dirname, 'data');
          if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
          fs.writeFileSync(reviewFilePath, JSON.stringify(reviews, null, 2));
        } catch (_) {
          try {
            fs.writeFileSync(path.join('/tmp', 'partner_reviews.json'), JSON.stringify(reviews, null, 2));
          } catch (__) {}
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, reviews }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // API Route: Authoritative Admin Grant Complimentary Pass
    if (req.method === 'POST' && pathname === '/api/admin/grant-pass') {
      try {
        const body = await parseJsonBody(req);
        const { pass, credits } = body;
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

        const passRow = {
          id: pass.id,
          member_id: pass.memberId,
          package_id: pass.packageId,
          status: 'active',
          valid_from: pass.validFrom,
          valid_until: pass.validUntil,
          created_at: pass.createdAt || new Date().toISOString()
        };

        await fetch(`${SUPABASE_URL}/rest/v1/member_passes`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify(passRow)
        });

        if (Array.isArray(credits) && credits.length > 0) {
          const creditRows = credits.map(c => ({
            pass_id: pass.id,
            discipline_id: c.disciplineId,
            total_credits: c.sessionsIncluded,
            remaining_credits: c.sessionsIncluded - (c.sessionsUsed || 0)
          }));

          await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits`, {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(creditRows)
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('[API /api/admin/grant-pass error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // API Route: Authoritative Class Sessions Retrieval from Server JSON Storage & Supabase
    // Helper to safely write class sessions file without crashing on Lambda read-only FS
    function safeWriteClassSessionsFile(filePath, data) {
      try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, data, 'utf-8');
      } catch (_) {
        try {
          fs.writeFileSync(path.join('/tmp', path.basename(filePath)), data, 'utf-8');
        } catch (__) {}
      }
    }

    function safeReadClassSessionsFile(filePath) {
      let sessions = [];
      try {
        if (fs.existsSync(filePath)) {
          sessions = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
      } catch (_) {}
      try {
        const tmpPath = path.join('/tmp', path.basename(filePath));
        if (fs.existsSync(tmpPath)) {
          const tmp = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
          if (Array.isArray(tmp) && tmp.length > 0) {
            tmp.forEach(ts => {
              const idx = sessions.findIndex(s => s.id === ts.id);
              if (idx >= 0) sessions[idx] = { ...sessions[idx], ...ts };
              else sessions.push(ts);
            });
          }
        }
      } catch (_) {}
      return Array.isArray(sessions) ? sessions : [];
    }

    if (req.method === 'GET' && pathname === '/api/class-sessions') {
      try {
        const classSessionsFilePath = path.join(__dirname, 'data', 'class_sessions.json');
        let localSessions = safeReadClassSessionsFile(classSessionsFilePath);

        // Safe sync with Supabase (authoritative)
        try {
          const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
          if (SUPABASE_URL && supabaseKey) {
            const sRes = await fetch(`${SUPABASE_URL}/rest/v1/class_sessions?select=*,trainer:trainers(*),discipline:disciplines(*),bookings:bookings(count)&order=start_time.asc`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (sRes.ok) {
              const remoteData = await sRes.json();
              if (Array.isArray(remoteData)) {
                const normalizedRemote = remoteData.map(r => {
                  const startTime = r.start_time || r.startsAt;
                  let date = r.date;
                  let time = r.time;
                  if (startTime && (!date || !time)) {
                    const d = new Date(startTime);
                    const parts = new Intl.DateTimeFormat('en-CA', {
                      timeZone: 'Asia/Kolkata',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    }).formatToParts(d);
                    const getP = type => (parts.find(p => p.type === type) || {}).value || '';
                    date = date || `${getP('year')}-${getP('month')}-${getP('day')}`;
                    time = time || `${getP('hour')}:${getP('minute')}`;
                  }
                  return {
                    ...r,
                    date,
                    time,
                    startsAt: startTime,
                    start_time: startTime,
                    disciplineId: r.discipline_id || r.disciplineId || 'disc-pilates',
                    discipline_id: r.discipline_id || r.disciplineId || 'disc-pilates',
                    trainerId: r.trainer_id || r.trainerId || 'trainer-001',
                    trainer_id: r.trainer_id || r.trainerId || 'trainer-001',
                    spotsRemaining: r.spotsRemaining !== undefined
                      ? r.spotsRemaining
                      : Math.max(0, (r.capacity || 6) - (r.bookings?.[0]?.count || 0)),
                    durationMinutes: r.durationMinutes || 60
                  };
                });
                localSessions = normalizedRemote;
                safeWriteClassSessionsFile(classSessionsFilePath, JSON.stringify(localSessions, null, 2));
              }
            }
          }
        } catch (syncErr) {
          console.warn('[Class sessions Supabase sync non-fatal error]', syncErr.message);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(localSessions));
      } catch (err) {
        console.error('[API /api/class-sessions error]', err.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([]));
      }
    }

    // API Route: Authoritative Admin Class Session Management (Create, Update, Delete)
    if (req.method === 'POST' && pathname === '/api/admin/class-session') {
      try {
        const body = await parseJsonBody(req);
        const { action, session, sessionId, patch } = body;
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        const classSessionsFilePath = path.join(__dirname, 'data', 'class_sessions.json');
        let localSessions = safeReadClassSessionsFile(classSessionsFilePath);

        if (action === 'create' || action === 'batch_create') {
          const sessionsToInsert = Array.isArray(session) ? session : [session];
          const newRows = sessionsToInsert.map(s => {
            const cleanId = s.id || `sess-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const durationMin = parseInt(s.durationMinutes || s.durationMin, 10) || 60;
            const startTime = s.startsAt || (s.date && s.time ? `${s.date}T${s.time}:00+05:30` : new Date().toISOString());
            const endTime = s.endTime || new Date(new Date(startTime).getTime() + durationMin * 60000).toISOString();
            const date = s.date || startTime.slice(0, 10);
            const time = s.time || (startTime.includes('T') ? startTime.split('T')[1].slice(0, 5) : '09:00');

            const aliasMap = {
              'disc-001': 'disc-pilates',
              'disc-002': 'disc-barre',
              'disc-003': 'disc-sculpt-yoga'
            };
            const rawDisc = s.disciplineId || s.discipline_id || 'disc-pilates';
            const normalizedDisc = aliasMap[rawDisc] || rawDisc;

            return {
              id: cleanId,
              title: s.title || 'Studio Session',
              discipline_id: normalizedDisc,
              disciplineId: normalizedDisc,
              trainer_id: s.trainerId || s.trainer_id || 'trainer-001',
              trainerId: s.trainerId || s.trainer_id || 'trainer-001',
              date,
              time,
              start_time: startTime,
              startsAt: startTime,
              end_time: endTime,
              durationMinutes: durationMin,
              capacity: Math.min(6, parseInt(s.capacity, 10) || 6),
              spotsRemaining: Math.min(6, parseInt(s.capacity, 10) || 6),
              spotsLeft: Math.min(6, parseInt(s.capacity, 10) || 6),
              status: s.status || 'scheduled'
            };
          });

          newRows.forEach(row => {
            const idx = localSessions.findIndex(ls => ls.id === row.id || (ls.date === row.date && ls.time === row.time && (ls.discipline_id || ls.disciplineId) === (row.discipline_id || row.disciplineId)));
            if (idx >= 0) {
              localSessions[idx] = { ...localSessions[idx], ...row };
            } else {
              localSessions.push(row);
            }
          });

          safeWriteClassSessionsFile(classSessionsFilePath, JSON.stringify(localSessions, null, 2));

          // Authoritative Supabase sync
          if (SUPABASE_URL && supabaseKey) {
            try {
              const supabaseRows = newRows.map(r => ({
                id: r.id,
                title: r.title || 'Studio Session',
                discipline_id: r.discipline_id || r.disciplineId || 'disc-pilates',
                trainer_id: null,
                start_time: r.start_time || r.startsAt,
                end_time: r.end_time || new Date(new Date(r.start_time || r.startsAt).getTime() + (r.durationMinutes || 60) * 60000).toISOString(),
                capacity: Math.min(6, parseInt(r.capacity, 10) || 6),
                status: r.status || 'scheduled'
              }));
              const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/class_sessions`, {
                method: 'POST',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                  Prefer: 'resolution=merge-duplicates,return=representation'
                },
                body: JSON.stringify(supabaseRows)
              });
              if (!supaRes.ok) {
                const errText = await supaRes.text();
                console.error('[Supabase class_sessions insert error]', supaRes.status, errText);
              }
            } catch (supaErr) {
              console.error('[Supabase class_sessions fetch exception]', supaErr.message);
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, sessions: newRows, session: newRows[0] }));
        }

        if (action === 'update') {
          const targetId = sessionId || (session && session.id);
          const idx = localSessions.findIndex(ls => ls.id === targetId);
          if (idx >= 0) {
            localSessions[idx] = { ...localSessions[idx], ...(patch || session) };
            if (patch && patch.date && patch.time) {
              const dur = patch.durationMinutes || localSessions[idx].durationMinutes || 60;
              const startTime = `${patch.date}T${patch.time}:00+05:30`;
              localSessions[idx].start_time = startTime;
              localSessions[idx].startsAt = startTime;
              localSessions[idx].date = patch.date;
              localSessions[idx].time = patch.time;
              localSessions[idx].end_time = new Date(new Date(startTime).getTime() + dur * 60000).toISOString();
            }
            if (patch && patch.disciplineId) {
              localSessions[idx].discipline_id = patch.disciplineId;
              localSessions[idx].disciplineId = patch.disciplineId;
            }
            if (patch && patch.trainerId) {
              localSessions[idx].trainer_id = patch.trainerId;
              localSessions[idx].trainerId = patch.trainerId;
            }
            safeWriteClassSessionsFile(classSessionsFilePath, JSON.stringify(localSessions, null, 2));
          }

          if (SUPABASE_URL && supabaseKey && patch) {
            try {
              const cleanPatch = {};
              if (patch.title) cleanPatch.title = patch.title;
              if (patch.disciplineId || patch.discipline_id) cleanPatch.discipline_id = patch.disciplineId || patch.discipline_id;
              if (patch.trainerId !== undefined || patch.trainer_id !== undefined) cleanPatch.trainer_id = patch.trainerId || patch.trainer_id;
              if (patch.capacity) cleanPatch.capacity = Math.min(6, parseInt(patch.capacity, 10));
              if (patch.status) cleanPatch.status = patch.status;
              if (patch.date && patch.time) {
                const dur = patch.durationMinutes || 60;
                const startTime = `${patch.date}T${patch.time}:00+05:30`;
                cleanPatch.start_time = startTime;
                cleanPatch.end_time = new Date(new Date(startTime).getTime() + dur * 60000).toISOString();
              }

              await fetch(`${SUPABASE_URL}/rest/v1/class_sessions?id=eq.${encodeURIComponent(targetId)}`, {
                method: 'PATCH',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(cleanPatch)
              });
            } catch (_) {}
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        }

        if (action === 'delete') {
          const targetId = sessionId || (session && session.id);
          localSessions = localSessions.filter(ls => ls.id !== targetId);
          safeWriteClassSessionsFile(classSessionsFilePath, JSON.stringify(localSessions, null, 2));

          if (SUPABASE_URL && supabaseKey) {
            try {
              await fetch(`${SUPABASE_URL}/rest/v1/class_sessions?id=eq.${encodeURIComponent(targetId)}`, {
                method: 'DELETE',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`
                }
              });
            } catch (_) {}
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unknown action' }));
      } catch (err) {
        console.error('[API /api/admin/class-session error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // API Route: Authoritative Admin Package Management (Delete with safe FK re-linking)
    if (req.method === 'POST' && pathname === '/api/admin/package') {
      try {
        const body = await parseJsonBody(req);
        const { action, packageId } = body;
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

        if (action === 'delete') {
          const targetId = packageId;
          if (SUPABASE_URL && supabaseKey && targetId) {
            try {
              // 1. Ensure pkg-archived anchor exists
              await fetch(`${SUPABASE_URL}/rest/v1/packages`, {
                method: 'POST',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                  Prefer: 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                  id: 'pkg-archived',
                  name: 'Archived Membership Plan',
                  discipline_id: null,
                  duration_months: 1,
                  price_inr: 0,
                  first_circle_price_inr: 0,
                  session_allocations: [],
                  is_popular: false
                })
              });

              // 2. Re-link member passes referencing this package
              await fetch(`${SUPABASE_URL}/rest/v1/member_passes?package_id=eq.${encodeURIComponent(targetId)}`, {
                method: 'PATCH',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ package_id: 'pkg-archived' })
              });

              // 3. Re-link payments referencing this package
              await fetch(`${SUPABASE_URL}/rest/v1/payments?package_id=eq.${encodeURIComponent(targetId)}`, {
                method: 'PATCH',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ package_id: 'pkg-archived' })
              });

              // 4. Delete from packages table
              await fetch(`${SUPABASE_URL}/rest/v1/packages?id=eq.${encodeURIComponent(targetId)}`, {
                method: 'DELETE',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`
                }
              });
            } catch (supaErr) {
              console.error('[Supabase admin package delete error]', supaErr.message);
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unknown action' }));
      } catch (err) {
        console.error('[API /api/admin/package error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // API Route: Check if an email is already a registered member
    if ((req.method === 'GET' || req.method === 'POST') && pathname === '/api/auth/check-member') {
      try {
        let email = '';
        if (req.method === 'POST') {
          const body = await parseJsonBody(req);
          email = body.email;
        } else {
          email = urlObj.searchParams.get('email');
        }

        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ isMember: false, error: 'Email is required' }));
        }

        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        if (SUPABASE_URL && supabaseKey) {
          // Check auth.users: user must have a registered credentials account to sign in
          try {
            const checkUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (checkUserRes.ok) {
              const list = await checkUserRes.json();
              const existing = (list.users || []).find(u => (u.email || '').toLowerCase() === cleanEmail);
              if (existing) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ exists: true, isMember: true, hasPasswordAccount: true }));
              }
            }
          } catch (_) {}

          // Also check public.profiles
          try {
            const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(cleanEmail)}`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (profileRes.ok) {
              const profiles = await profileRes.json();
              if (Array.isArray(profiles) && profiles.length > 0) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ exists: true, isMember: true, role: profiles[0].role || 'member' }));
              }
            }
          } catch (_) {}
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ exists: false, isMember: false }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ isMember: false, error: err.message }));
      }
    }

    // API Route: Request Member Signup with 6-Digit Welcome OTP Code
    if (req.method === 'POST' && pathname === '/api/auth/request-signup-otp') {
      try {
        const body = await parseJsonBody(req);
        const { email, password, fullName, phone, movementLevel } = body;

        if (!email || !password || !fullName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Full name, email, and password are required.' }));
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const cleanName = String(fullName).trim();
        const cleanPhone = String(phone || '').trim();
        const cleanPass = String(password).trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Please enter a valid email address.' }));
        }

        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

        // Check auth.users: only block signup if user already has an active login account
        if (SUPABASE_URL && supabaseKey) {
          try {
            const checkUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (checkUserRes.ok) {
              const list = await checkUserRes.json();
              const existing = (list.users || []).find(u => (u.email || '').toLowerCase() === cleanEmail);
              if (existing) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                  success: false,
                  error: 'An account with this email is already registered. Please sign in instead.'
                }));
              }
            }
          } catch (err) {
            console.warn('[Check signup existing auth users warn]', err.message);
          }

          // 3. Dispatch Luxury Welcome & Activation OTP via Supabase GoTrue
          const mailKey = SUPABASE_ANON_KEY || supabaseKey;
          const otpRes = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
            method: 'POST',
            headers: {
              'apikey': mailKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: cleanEmail })
          });
          if (!otpRes.ok) {
            const errBody = await otpRes.json().catch(() => ({}));
            console.error('[Supabase Signup OTP dispatch error]', errBody);
            throw new Error(errBody.msg || errBody.message || 'Supabase mailer rejected signup email dispatch.');
          }
          console.log(`[Supabase Mail] Luxury Welcome & Activation OTP dispatched to ${cleanEmail}`);
        }

        // Store in pending signups with 10-minute expiry
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000;

        pendingSignups.set(cleanEmail, {
          email: cleanEmail,
          password: cleanPass,
          fullName: cleanName,
          phone: cleanPhone,
          movementLevel: movementLevel || '',
          code,
          expiresAt,
          requestedAt: Date.now()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: `A 6-digit activation code has been dispatched to ${cleanEmail}. Please enter the code to activate your account.`,
          expiresInMinutes: 10
        }));
      } catch (err) {
        console.error('[API /api/auth/request-signup-otp error]', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // API Route: Verify Signup OTP and Complete Registration
    if (req.method === 'POST' && pathname === '/api/auth/verify-signup-otp') {
      try {
        const body = await parseJsonBody(req);
        const { email, code } = body;

        if (!email || !code) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Email and verification code are required.' }));
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const cleanCode = String(code).trim();

        const pending = pendingSignups.get(cleanEmail);
        if (!pending) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'No active signup found for this email. Please submit the signup form again.' }));
        }

        if (Date.now() > pending.expiresAt) {
          pendingSignups.delete(cleanEmail);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Activation code has expired. Please sign up again.' }));
        }

        let verified = false;
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

        // Try Supabase OTP verification
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
          try {
            let verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
              method: 'POST',
              headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'magiclink', email: cleanEmail, token: cleanCode })
            });
            if (!verifyRes.ok) {
              verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'email', email: cleanEmail, token: cleanCode })
              });
            }
            if (verifyRes.ok) {
              verified = true;
            }
          } catch (e) {
            console.warn('[Supabase signup OTP verify warning]', e.message);
          }
        }

        if (!verified && pending.code === cleanCode) {
          verified = true;
        }

        if (!verified) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid activation code. Please check your email inbox and try again.' }));
        }

        // Code verified! Now create confirmed account in Supabase
        let userId = null;
        if (SUPABASE_URL && supabaseKey) {
          // Check if user exists
          const checkUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          if (checkUserRes.ok) {
            const list = await checkUserRes.json();
            const existingUser = (list.users || []).find(u => (u.email || '').toLowerCase() === cleanEmail);
            if (existingUser) {
              userId = existingUser.id;
              await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
                method: 'PUT',
                headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pending.password, email_confirm: true, user_metadata: { full_name: pending.fullName, phone: pending.phone, role: 'member' } })
              });
            }
          }

          if (!userId) {
            const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
              method: 'POST',
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: cleanEmail,
                password: pending.password,
                email_confirm: true,
                user_metadata: { full_name: pending.fullName, phone: pending.phone, role: 'member' }
              })
            });
            const createdData = await createRes.json();
            if (createRes.ok && (createdData.id || (createdData.user && createdData.user.id))) {
              userId = createdData.id || createdData.user.id;
            }
          }

          // Fallback UUID if needed
          if (!userId) {
            userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
              const r = Math.random() * 16 | 0;
              return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
          }

          // Upsert profiles
          await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              id: userId,
              email: cleanEmail,
              full_name: pending.fullName,
              phone: pending.phone || null,
              role: 'member',
              tier: 'Founding Standard',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          });

          // Upsert health profile
          await fetch(`${SUPABASE_URL}/rest/v1/health_profiles`, {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              member_id: userId,
              fitness_goals: ['Core Conditioning', 'Flexibility'],
              health_conditions: [],
              injuries_notes: pending.movementLevel ? `Movement Level: ${pending.movementLevel}` : '',
              updated_at: new Date().toISOString()
            })
          });
        }

        const confirmedUser = {
          id: userId || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (Math.random() * 16 | 0).toString(16)),
          email: cleanEmail,
          fullName: pending.fullName,
          phone: pending.phone,
          movementLevel: pending.movementLevel,
          role: 'member',
          tier: 'Founding Standard'
        };

        pendingSignups.delete(cleanEmail);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: 'Account successfully activated!',
          user: confirmedUser
        }));
      } catch (err) {
        console.error('[API /api/auth/verify-signup-otp error]', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // API Route: Guarded Registration Endpoint (Enforces Strict 6-Digit OTP Gate)
    if (req.method === 'POST' && pathname === '/api/auth/register') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        requireOtp: true,
        error: 'Direct registration is disabled. Strict 6-digit OTP verification is required before activating your membership.'
      }));
    }

    // API Route: Request Email Change with 6-Digit Security Verification Code
    if (req.method === 'POST' && pathname === '/api/auth/request-email-change') {
      try {
        const body = await parseJsonBody(req);
        const { memberId, newEmail } = body;

        if (!memberId || !newEmail) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Member ID and new email address are required.' }));
        }

        const cleanEmail = String(newEmail).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Please provide a valid new email address.' }));
        }

        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        if (SUPABASE_URL && supabaseKey) {
          // 1. Strict Database Cross-Check: public.profiles
          try {
            const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(cleanEmail)}&select=id,email`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (profRes.ok) {
              const profiles = await profRes.json();
              const conflict = (profiles || []).find(p => String(p.id).toLowerCase() !== String(memberId).toLowerCase());
              if (conflict) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                  success: false,
                  error: 'This email address is already in use by another account in our database. Please use a different email.'
                }));
              }
            }
          } catch (err) {
            console.warn('[Check existing profiles warn]', err.message);
          }

          // 2. Strict Database Cross-Check: auth.users
          try {
            const checkUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (checkUserRes.ok) {
              const list = await checkUserRes.json();
              const existing = (list.users || []).find(u => (u.email || '').toLowerCase() === cleanEmail && String(u.id).toLowerCase() !== String(memberId).toLowerCase());
              if (existing) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                  success: false,
                  error: 'This email address is already in use by another account in our database. Please use a different email.'
                }));
              }
            }
          } catch (err) {
            console.warn('[Check existing auth users warn]', err.message);
          }

          // 3. Dispatch actual verification email via Supabase GoTrue Auth Mailer
          const mailKey = SUPABASE_ANON_KEY || supabaseKey;
          const otpRes = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
            method: 'POST',
            headers: {
              'apikey': mailKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: cleanEmail })
          });
          if (!otpRes.ok) {
            const errBody = await otpRes.json().catch(() => ({}));
            console.error('[Supabase mail dispatch error]', errBody);
            throw new Error(errBody.msg || errBody.message || 'Supabase mailer rejected email dispatch.');
          }
          console.log(`[Supabase Mail] Live OTP successfully dispatched to ${cleanEmail}`);
        }

        // Generate 6-digit security verification code (valid for 10 minutes)
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000;

        pendingEmailChanges.set(memberId, {
          newEmail: cleanEmail,
          code,
          expiresAt,
          requestedAt: Date.now()
        });

        console.log(`[Security] Email change requested for member ${memberId} -> ${cleanEmail}. Verification email dispatched.`);

        // Return clean response with NO demo code displayed
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: `A 6-digit verification code has been dispatched to ${cleanEmail}. Please check your inbox and enter the code below.`,
          expiresInMinutes: 10
        }));
      } catch (err) {
        console.error('[API /api/auth/request-email-change error]', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // API Route: Verify 6-Digit Code and Finalize Email Update
    if (req.method === 'POST' && pathname === '/api/auth/verify-email-change') {
      try {
        const body = await parseJsonBody(req);
        const { memberId, newEmail, code } = body;

        if (!memberId || !newEmail || !code) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Member ID, new email, and verification code are required.' }));
        }

        const cleanEmail = String(newEmail).trim().toLowerCase();
        const cleanCode = String(code).trim();

        const pending = pendingEmailChanges.get(memberId);
        if (!pending || pending.newEmail !== cleanEmail) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'No active verification request found for this email. Please request a new code.' }));
        }

        if (Date.now() > pending.expiresAt) {
          pendingEmailChanges.delete(memberId);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Verification code has expired. Please request a new code.' }));
        }

        let verified = false;
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

        // Try Supabase OTP verification first
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
          try {
            // 1. Try magiclink type (standard for /auth/v1/otp)
            let verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                type: 'magiclink',
                email: cleanEmail,
                token: cleanCode
              })
            });

            // 2. Fallback to email type if needed
            if (!verifyRes.ok) {
              verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_ANON_KEY,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  type: 'email',
                  email: cleanEmail,
                  token: cleanCode
                })
              });
            }

            if (verifyRes.ok) {
              verified = true;
              const vData = await verifyRes.json();
              // Clean up temporary placeholder user if created by OTP
              if (vData.user && vData.user.id && String(vData.user.id).toLowerCase() !== String(memberId).toLowerCase() && supabaseKey) {
                try {
                  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${vData.user.id}`, {
                    method: 'DELETE',
                    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                  });
                } catch (_) {}
              }
            }
          } catch (e) {
            console.warn('[Supabase OTP verify error]', e.message);
          }
        }

        // Also accept internal verification code
        if (!verified && pending.code === cleanCode) {
          verified = true;
        }

        if (!verified) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid verification code. Please check your email inbox and try again.' }));
        }

        // Code verified! Remove from pending
        pendingEmailChanges.delete(memberId);

        if (SUPABASE_URL && supabaseKey) {
          // 1. Update Supabase auth.users
          try {
            await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${memberId}`, {
              method: 'PUT',
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: cleanEmail, email_confirm: true })
            });
          } catch (authUpdateErr) {
            console.warn('[Supabase auth email update warn]', authUpdateErr.message);
          }

          // 2. Update public.profiles
          try {
            await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(memberId)}`, {
              method: 'PATCH',
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
              body: JSON.stringify({ email: cleanEmail, updated_at: new Date().toISOString() })
            });
          } catch (profileUpdateErr) {
            console.warn('[Supabase profile email update warn]', profileUpdateErr.message);
          }
        }

        console.log(`[Security] Email successfully verified and updated for member ${memberId} -> ${cleanEmail}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          email: cleanEmail,
          message: `Email address successfully verified and updated to ${cleanEmail}.`
        }));
      } catch (err) {
        console.error('[API /api/auth/verify-email-change error]', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // GET /api/activity-logs - Retrieve all activity logs via service role key
    if (req.method === 'GET' && pathname === '/api/activity-logs') {
      try {
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        if (!SUPABASE_URL || !supabaseKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Supabase not configured on server' }));
        }

        const logRes = await fetch(`${SUPABASE_URL}/rest/v1/activity_logs?select=*,user:profiles(id,full_name,email,phone)&order=created_at.desc`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`
          }
        });

        if (!logRes.ok) {
          const errText = await logRes.text();
          console.error('[API /api/activity-logs fetch error]', logRes.status, errText);
          res.writeHead(logRes.status, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: errText }));
        }

        const rows = await logRes.json();
        const logs = (rows || []).map(l => ({
          id: l.id,
          userId: l.user_id,
          action: l.action,
          details: l.details || {},
          createdAt: l.created_at,
          user: l.user
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, data: logs }));
      } catch (err) {
        console.error('[API /api/activity-logs error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // POST /api/activity-log - Insert activity log via service role key (bypasses RLS)
    if (req.method === 'POST' && pathname === '/api/activity-log') {
      try {
        const body = await parseJsonBody(req);
        const { userId, action, details } = body || {};

        if (!action) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'action is required' }));
        }

        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        if (!SUPABASE_URL || !supabaseKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Supabase not configured on server' }));
        }

        const istOffsetMs = 330 * 60 * 1000;
        const istDate = new Date(Date.now() + istOffsetMs);
        const yyyy = istDate.getUTCFullYear();
        const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(istDate.getUTCDate()).padStart(2, '0');
        const hh = String(istDate.getUTCHours()).padStart(2, '0');
        const min = String(istDate.getUTCMinutes()).padStart(2, '0');
        const ss = String(istDate.getUTCSeconds()).padStart(2, '0');
        const istNow = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+05:30`;

        const row = {
          action,
          details: (details && typeof details === 'object') ? details : {},
          created_at: istNow
        };
        if (userId) {
          row.user_id = userId;
        }

        const insRes = await fetch(`${SUPABASE_URL}/rest/v1/activity_logs`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify(row)
        });

        if (!insRes.ok) {
          const errText = await insRes.text();
          console.error('[API /api/activity-log insert error]', insRes.status, errText);
          res.writeHead(insRes.status, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: errText }));
        }

        const data = await insRes.json();
        const created = Array.isArray(data) ? data[0] : data;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, data: created }));
      } catch (err) {
        console.error('[API /api/activity-log error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // Static File Serving
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '' || safePath === '/index.html') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      return res.end(EMBEDDED_INDEX_HTML);
    }

    // Strict Security: block any access to hidden files (e.g. .env, .git, etc.)
    const normalizedParts = safePath.split(/[\/\\]/);
    if (normalizedParts.some(part => part.startsWith('.'))) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('403 Forbidden: Access to hidden files is denied.');
    }

    const filePath = path.join(ROOT_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // SPA Fallback: serve index.html for unknown routes or if safePath is index.html
        if (!path.extname(safePath) || safePath === '/index.html') {
          const possibleIndexPaths = [
            path.join(ROOT_DIR, 'index.html'),
            path.join(process.cwd(), 'index.html'),
            path.join(__dirname, 'index.html'),
            path.join(__dirname, '..', 'index.html')
          ];
          for (const idxPath of possibleIndexPaths) {
            try {
              if (fs.existsSync(idxPath)) {
                const content = fs.readFileSync(idxPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                return res.end(content);
              }
            } catch (_) {}
          }
          if (EMBEDDED_INDEX_HTML) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(EMBEDDED_INDEX_HTML);
          }
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, data) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end('500 Internal Server Error');
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(data);
      });
    });
  };

  // Primary Server (Port 3333 ONLY - when running standalone)
  if (!process.env.VERCEL && require.main === module) {
    const server3333 = http.createServer(requestHandler);
    server3333.listen(3333, () => {
      console.log(`====================================================`);
      console.log(`  PLASH PILATES SERVER STARTED ON PORT 3333`);
      console.log(`  Razorpay Live Key: ${RAZORPAY_KEY_ID}`);
      console.log(`  http://localhost:3333/ and http://127.0.0.1:3333/`);
      console.log(`====================================================`);

      // Automatic Full Payment Sync on startup
      syncAllRazorpayPaymentsToSupabase(100).then(res => {
        console.log(`[Startup Payment Sync Result]`, res);
      }).catch(err => {
        console.warn('[Startup Payment Sync Warning]', err.message);
      });

      // Periodic Payment Sync every 2 minutes
      setInterval(() => {
        syncAllRazorpayPaymentsToSupabase(50).catch(() => {});
      }, 120000);

      // Dual listener on port 3000 (catches Supabase Auth email redirect links)
      try {
        const server3000 = http.createServer(requestHandler);
        server3000.on('error', (err) => {
          console.log('[Notice: Port 3000 redirect listener skipped]', err.message);
        });
        server3000.listen(3000, () => {
          console.log(`  Supabase Auth Redirect Listener active on http://localhost:3000/`);
        });
      } catch (_) {}
    });
  }

  // Export requestHandler for Vercel Serverless Function deployment
  module.exports = requestHandler;
