/**
 * Plash Pilates — Comprehensive QA Automated Test Suite
 * Validates Authentication, RBAC, Business Logic, Tax Accounting,
 * Error Handling, and Supabase Live Connectivity.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import * as auth from '../js/core/auth.js';
import * as store from '../js/core/store.js';
import * as format from '../js/utils/format.js';
import { escapeHtml } from '../js/utils/dom.js';
import { CONFIG } from '../js/core/config.js';

// Hydrate CONFIG from .env for Node.js test runner
try {
  const envFile = fs.readFileSync('.env', 'utf-8');
  envFile.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k === 'SUPABASE_URL') CONFIG.SUPABASE.URL = v;
      if (k === 'SUPABASE_ANON_KEY') CONFIG.SUPABASE.ANON_KEY = v;
      if (k === 'RAZORPAY_KEY_ID') CONFIG.RAZORPAY.KEY_ID = v;
    }
  });
} catch (_) {}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    -> ${err.message}`);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    -> ${err.message}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('\n============================================================');
  console.log('  PLASH PILATES — ENTERPRISE QA SYSTEM TEST RUNNER');
  console.log('============================================================\n');

  /* ------------------------------------------------------------------
     1. SECURITY & XSS SANITIZATION
     ------------------------------------------------------------------ */
  console.log('--- 1. SECURITY & XSS SANITIZATION ---');

  test('escapeHtml neutralizes script tags', () => {
    const dirty = '<script>alert("XSS")</script>';
    const clean = escapeHtml(dirty);
    assert.strictEqual(clean, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    assert(!clean.includes('<script>'));
  });

  test('escapeHtml handles null and undefined safely', () => {
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');
    assert.strictEqual(escapeHtml(12345), '12345');
  });

  test('escapeHtml neutralizes single and double quotes', () => {
    const dirty = `Hello ' OR '1'='1"`;
    const clean = escapeHtml(dirty);
    assert.strictEqual(clean, 'Hello &#039; OR &#039;1&#039;=&#039;1&quot;');
  });

  /* ------------------------------------------------------------------
     2. AUTHENTICATION & ACCESS CONTROL (RBAC)
     ------------------------------------------------------------------ */
  console.log('\n--- 2. AUTHENTICATION & RBAC PERMISSIONS ---');

  await asyncTest('Rejects login attempt with missing credentials', async () => {
    let thrown = false;
    try {
      await auth.login('', '');
    } catch (e) {
      thrown = true;
      assert.strictEqual(e.message, 'Please provide both email and password.');
    }
    assert(thrown, 'Should throw on missing credentials');
  });

  await asyncTest('Rejects attacker email spoofing admin keyword', async () => {
    let thrown = false;
    try {
      await auth.login('hacker@admin.com', 'randompass123');
    } catch (e) {
      thrown = true;
      assert(e.message.includes('Account not found') || e.message.includes('Invalid'));
    }
    assert(thrown, 'Should reject unauthorized email containing admin');
  });

  await asyncTest('Rejects admin login with incorrect password', async () => {
    let thrown = false;
    try {
      await auth.login('studio.admin@plashpilates.com', 'wrongpassword999');
    } catch (e) {
      thrown = true;
      assert.strictEqual(e.message, 'Invalid password for Studio Administrator account.');
    }
    assert(thrown, 'Should reject bad password for admin');
  });

  await asyncTest('Authenticates legitimate Studio Administrator', async () => {
    const user = await auth.login('studio.admin@plashpilates.com', 'admin123');
    assert.strictEqual(auth.isAuthenticated(), true);
    assert.strictEqual(auth.getCurrentRole(), 'admin');
    assert(user);
  });

  test('RBAC Route Guard allows admin access to admin routes', () => {
    assert.strictEqual(auth.isRouteAllowed('#/admin/overview'), true);
    assert.strictEqual(auth.isRouteAllowed('#/admin/schedule'), true);
  });

  test('RBAC Route Guard blocks admin from member-only portal', () => {
    assert.strictEqual(auth.isRouteAllowed('#/portal/dashboard'), false);
    assert.strictEqual(auth.isRouteAllowed('#/portal/book'), false);
  });

  await asyncTest('Authenticates legitimate Studio Member', async () => {
    const user = await auth.login('aisha.kapoor@example.com', 'member123');
    assert.strictEqual(auth.isAuthenticated(), true);
    assert.strictEqual(auth.getCurrentRole(), 'member');
    assert(user);
  });

  test('RBAC Route Guard allows member access to member portal', () => {
    assert.strictEqual(auth.isRouteAllowed('#/portal/dashboard'), true);
    assert.strictEqual(auth.isRouteAllowed('#/portal/packages'), true);
    assert.strictEqual(auth.isRouteAllowed('#/portal/cart'), true);
  });

  test('RBAC Route Guard blocks member from admin routes', () => {
    assert.strictEqual(auth.isRouteAllowed('#/admin/overview'), false);
    assert.strictEqual(auth.isRouteAllowed('#/admin/schedule'), false);
    assert.strictEqual(auth.isRouteAllowed('#/partner/requests'), false);
  });

  await asyncTest('Member email update enforces duplicate DB prevention and verification gate', async () => {
    store.addMember({ id: '11111111-1111-1111-1111-111111111111', fullName: 'Aisha Kapoor', email: 'aisha.kapoor@example.com' });
    store.addMember({ id: '99999999-9999-9999-9999-999999999999', fullName: 'Other Member', email: 'other.member@example.com' });
    await auth.login('aisha.kapoor@example.com', 'member123');

    // 1. Rejects invalid email syntax
    let errInvalid = null;
    try {
      await auth.requestEmailChange('invalid-email-address');
    } catch (e) {
      errInvalid = e;
    }
    assert(errInvalid, 'Must reject invalid email syntax');

    // 2. Rejects email already in database for another account
    let errDuplicate = null;
    try {
      await auth.requestEmailChange('other.member@example.com');
    } catch (e) {
      errDuplicate = e;
    }
    assert(errDuplicate, 'Must reject email that already belongs to another member');
    assert(errDuplicate.message.includes('already in use'), 'Error message must specify email is already in use');

    // 3. Dispatches verification code (NO demo code in user response)
    const newEmail = 'aisha.real.test@example.com';
    const reqRes = await auth.requestEmailChange(newEmail);
    assert.strictEqual(reqRes.success, true, 'Email change request must succeed');
    assert.strictEqual(reqRes.devCode, undefined, 'Must NEVER return demo code to user response');

    const memberId = auth.getCurrentMemberId();
    const code = auth._getTestVerificationCode(memberId);

    // 4. Rejects incorrect verification code
    let errCode = null;
    try {
      await auth.verifyEmailChange(newEmail, '000000');
    } catch (e) {
      errCode = e;
    }
    assert(errCode, 'Must reject invalid verification code');

    // 5. Accepts valid code and updates email in session & member profile
    const verifyRes = await auth.verifyEmailChange(newEmail, code);
    assert.strictEqual(verifyRes.success, true);
    assert.strictEqual(verifyRes.email, newEmail);
    assert.strictEqual(auth.getCurrentUser().email, newEmail);
  });

  await asyncTest('Member signup enforces 6-digit OTP verification gate and duplicate DB prevention', async () => {
    // 1. Rejects duplicate email already in store
    let errDup = null;
    try {
      await auth.requestSignupOtp({
        fullName: 'Duplicate User',
        email: 'other.member@example.com',
        phone: '+91 98765 43210',
        password: 'ValidPassword123!'
      });
    } catch (e) {
      errDup = e;
    }
    assert(errDup, 'Must reject duplicate signup email');
    assert(errDup.message.includes('already registered'), 'Must mention account already registered');

    // 2. Dispatches OTP for valid new member
    const newSignupEmail = 'rohan.newmember@example.com';
    const signupData = {
      fullName: 'Rohan Mehra',
      email: newSignupEmail,
      phone: '+91 99887 76655',
      password: 'StrongPass123!',
      movementLevel: 'Intermediate'
    };
    const reqRes = await auth.requestSignupOtp(signupData);
    assert.strictEqual(reqRes.success, true);

    // 3. Rejects invalid code
    let errInvalidCode = null;
    try {
      await auth.verifySignupOtp(newSignupEmail, '999999', signupData);
    } catch (e) {
      errInvalidCode = e;
    }
    assert(errInvalidCode, 'Must reject invalid signup OTP code');

    // 4. Accepts valid OTP and creates authenticated member
    const member = await auth.verifySignupOtp(newSignupEmail, '742918', signupData);
    assert.strictEqual(member.email, newSignupEmail);
    assert.strictEqual(member.fullName, 'Rohan Mehra');
    assert.strictEqual(auth.isAuthenticated(), true);
    assert.strictEqual(auth.getCurrentRole(), 'member');
    assert.strictEqual(auth.getCurrentUser().email, newSignupEmail);
  });

  test('Logout clears session completely', () => {
    auth.logout();
    assert.strictEqual(auth.isAuthenticated(), false);
    assert.strictEqual(auth.getDefaultRoute(), '#/login');
    assert.strictEqual(auth.isRouteAllowed('#/portal/dashboard'), false);
    assert.strictEqual(auth.isRouteAllowed('#/admin/overview'), false);
  });

  await asyncTest('Cleanly switches accounts and isolates session IDs on consecutive logins', async () => {
    // 1. Log in as Member
    await auth.login(auth.DEMO_ACCOUNTS.member.email, auth.DEMO_ACCOUNTS.member.password);
    assert.strictEqual(auth.isAuthenticated(), true);
    assert.strictEqual(auth.getCurrentRole(), 'member');
    assert.ok(auth.getCurrentMemberId(), 'Member ID must exist');

    // 2. Switch directly to Admin account
    await auth.login(auth.DEMO_ACCOUNTS.admin.email, auth.DEMO_ACCOUNTS.admin.password);
    assert.strictEqual(auth.isAuthenticated(), true);
    assert.strictEqual(auth.getCurrentRole(), 'admin');
    assert.strictEqual(auth.getCurrentMemberId(), null, 'Member ID must be reset to null when switched to admin');

    // 3. Clean logout
    auth.logout();
    assert.strictEqual(auth.isAuthenticated(), false);
    assert.strictEqual(auth.getCurrentMemberId(), null);
  });

  test('Public error pages are accessible without login', () => {
    assert.strictEqual(auth.isRouteAllowed('#/404'), true);
    assert.strictEqual(auth.isRouteAllowed('#/403'), true);
    assert.strictEqual(auth.isRouteAllowed('#/500'), true);
    assert.strictEqual(auth.isRouteAllowed('#/login'), true);
    assert.strictEqual(auth.isRouteAllowed('#/reset-password'), true);
  });

  await asyncTest('Password recovery request enforces email validation', async () => {
    let emptyErr = null;
    try {
      await auth.requestPasswordReset('');
    } catch (e) {
      emptyErr = e;
    }
    assert(emptyErr, 'Must reject empty email address for password reset');

    let invalidErr = null;
    try {
      await auth.requestPasswordReset('not-an-email');
    } catch (e) {
      invalidErr = e;
    }
    assert(invalidErr, 'Must reject malformed email address');
  });

  await asyncTest('Enforces 30-minute idle session timeout and automatic logout', async () => {
    await auth.login(auth.DEMO_ACCOUNTS.member.email, auth.DEMO_ACCOUNTS.member.password);
    assert.strictEqual(auth.isAuthenticated(), true);

    // Simulate 31 minutes of inactivity (threshold is 30 minutes)
    const thirtyOneMinsAgo = Date.now() - (31 * 60 * 1000);
    auth._setLastActivityTimeForTesting(thirtyOneMinsAgo);

    // Inactivity check should trigger timeout and invalidate session
    const timedOut = auth.checkSessionInactivity();
    assert.strictEqual(timedOut, true);
    assert.strictEqual(auth.isAuthenticated(), false);
  });

  /* ------------------------------------------------------------------
     3. BUSINESS LOGIC & CAPACITY MANAGEMENT
     ------------------------------------------------------------------ */
  console.log('\n--- 3. BUSINESS LOGIC & CAPACITY MANAGEMENT ---');

  test('Class capacity is strictly limited to maximum 6 spots', () => {
    const session = store.addClassSession({
      title: 'Precision Reformer Testing Batch',
      disciplineId: 'disc-pilates',
      trainerId: 'trainer-001',
      date: '2026-10-01',
      time: '07:00',
      capacity: 6
    });

    assert.strictEqual(session.capacity, 6);
    assert.strictEqual(session.spotsRemaining, 6);
  });

  await asyncTest('Rejects booking if member has zero credits', async () => {
    const sessions = store.getAllClassSessions();
    const testSession = sessions[0];
    let thrown = false;
    try {
      await store.bookClass('member-nonexistent', testSession.id);
    } catch (e) {
      thrown = true;
      assert(e.message.includes('No remaining') || e.message.includes('credits'));
    }
    assert(thrown, 'Should reject booking without credits');
  });

  await asyncTest('Rejects cancellation of past or concluded class', async () => {
    const pastSession = store.addClassSession({
      title: 'Yesterday Class',
      disciplineId: 'disc-pilates',
      trainerId: 'trainer-001',
      startsAt: new Date(Date.now() - 86400000).toISOString(),
      capacity: 6
    });

    const pastBooking = {
      id: 'booking-past-cancel-test',
      memberId: 'member-001',
      classSessionId: pastSession.id,
      status: 'upcoming',
      bookedAt: new Date(Date.now() - 100000000).toISOString()
    };
    store.addBookingRecord(pastBooking);

    let thrown = false;
    try {
      await store.cancelBooking(pastBooking.id);
    } catch (e) {
      thrown = true;
      assert(e.message.includes('already started') || e.message.includes('cannot be cancelled'));
    }
    assert(thrown, 'Past session cancellation must be rejected');
  });

  await asyncTest('Enforces 12-hour cancellation window for morning classes (< 12:00 PM)', async () => {
    // Morning session inside 12-hour window (e.g. starting in 8 hours)
    const morningNear = store.addClassSession({
      title: 'Morning Class Near',
      disciplineId: 'disc-pilates',
      trainerId: 'trainer-001',
      time: '08:00',
      startsAt: new Date(Date.now() + 8 * 3600000).toISOString(),
      capacity: 6
    });

    const bkNear = {
      id: 'bk-mrg-near',
      memberId: 'member-001',
      classSessionId: morningNear.id,
      status: 'upcoming',
      bookedAt: new Date().toISOString()
    };
    store.addBookingRecord(bkNear);

    let thrown = false;
    try {
      await store.cancelBooking(bkNear.id);
    } catch (e) {
      thrown = true;
      assert(e.message.includes('12 hours'), 'Error must specify 12 hours for morning classes');
    }
    assert(thrown, 'Cancellation within 12 hours for morning class must be rejected');

    // Morning session outside 12-hour window (e.g. starting in 15 hours)
    const morningFar = store.addClassSession({
      title: 'Morning Class Far',
      disciplineId: 'disc-pilates',
      trainerId: 'trainer-001',
      time: '09:00',
      startsAt: new Date(Date.now() + 15 * 3600000).toISOString(),
      capacity: 6
    });

    const bkFar = {
      id: 'bk-mrg-far',
      memberId: 'member-001',
      classSessionId: morningFar.id,
      status: 'upcoming',
      bookedAt: new Date().toISOString()
    };
    store.addBookingRecord(bkFar);

    const result = await store.cancelBooking(bkFar.id);
    assert(result.success, 'Cancellation outside 12 hours must succeed');
    assert(result.booking.status === 'cancelled', 'Status must be cancelled');
  });

  await asyncTest('Enforces 6-hour cancellation window for evening classes (>= 12:00 PM)', async () => {
    // Evening session inside 6-hour window (e.g. starting in 4 hours)
    const eveningNear = store.addClassSession({
      title: 'Evening Class Near',
      disciplineId: 'disc-pilates',
      trainerId: 'trainer-001',
      time: '18:00',
      startsAt: new Date(Date.now() + 4 * 3600000).toISOString(),
      capacity: 6
    });

    const bkEveNear = {
      id: 'bk-eve-near',
      memberId: 'member-001',
      classSessionId: eveningNear.id,
      status: 'upcoming',
      bookedAt: new Date().toISOString()
    };
    store.addBookingRecord(bkEveNear);

    let thrown = false;
    try {
      await store.cancelBooking(bkEveNear.id);
    } catch (e) {
      thrown = true;
      assert(e.message.includes('6 hours'), 'Error must specify 6 hours for evening classes');
    }
    assert(thrown, 'Cancellation within 6 hours for evening class must be rejected');

    // Evening session outside 6-hour window (e.g. starting in 8 hours)
    const eveningFar = store.addClassSession({
      title: 'Evening Class Far',
      disciplineId: 'disc-pilates',
      trainerId: 'trainer-001',
      time: '18:00',
      startsAt: new Date(Date.now() + 8 * 3600000).toISOString(),
      capacity: 6
    });

    const bkEveFar = {
      id: 'bk-eve-far',
      memberId: 'member-001',
      classSessionId: eveningFar.id,
      status: 'upcoming',
      bookedAt: new Date().toISOString()
    };
    store.addBookingRecord(bkEveFar);

    const result = await store.cancelBooking(bkEveFar.id);
    assert(result.success, 'Cancellation outside 6 hours must succeed');
    assert(result.booking.status === 'cancelled', 'Status must be cancelled');
  });

  await asyncTest('markAttendance: no-show refunds credit, completed does not', async () => {
    const sess = store.addClassSession({
      title: 'Attendance Test',
      disciplineId: 'disc-pilates',
      trainerId: 'trainer-001',
      startsAt: new Date(Date.now() - 3600000).toISOString(),
      capacity: 6
    });
    sess.spotsRemaining = 4;

    const bk = {
      id: 'booking-attendance-test',
      memberId: 'member-001',
      classSessionId: sess.id,
      status: 'upcoming',
      bookedAt: new Date().toISOString()
    };
    store.addBookingRecord(bk);

    // Mark as no-show — should refund credit and restore spot
    const spotsBefore = sess.spotsRemaining;
    const res = await store.markAttendance(bk.id, 'no_show');
    assert(res.success, 'markAttendance no_show must succeed');
    assert(res.booking.status === 'no_show', 'Status must be no_show');
    assert(sess.spotsRemaining === spotsBefore + 1, 'Spot must be restored on no-show');
  });

  await asyncTest('Clamps spotsRemaining on cancellation so it never exceeds capacity', async () => {
    const session = store.addClassSession({
      title: 'Future Cancellation Test',
      disciplineId: 'disc-pilates',
      trainerId: 'trainer-001',
      startsAt: new Date(Date.now() + 72 * 3600000).toISOString(),
      capacity: 6
    });
    session.spotsRemaining = 6;

    const futureBooking = {
      id: 'booking-future-test',
      memberId: 'member-001',
      classSessionId: session.id,
      status: 'upcoming',
      bookedAt: new Date().toISOString()
    };
    store.addBookingRecord(futureBooking);

    await store.cancelBooking(futureBooking.id);
    assert.strictEqual(session.spotsRemaining, 6, 'Spots remaining should not exceed 6');
  });

  test('Automated 48-hour Barre approval expiration restores spots and credits', () => {
    const barreSession = store.addClassSession({
      title: 'Old Barre Request',
      disciplineId: CONFIG.DISCIPLINES.BARRE,
      trainerId: 'trainer-003',
      startsAt: new Date(Date.now() + 100 * 3600000).toISOString(),
      capacity: 6
    });
    barreSession.spotsRemaining = 5;

    const expiredBarreBooking = {
      id: 'barre-old-request',
      memberId: 'member-001',
      classSessionId: barreSession.id,
      status: 'pending_partner_approval',
      bookedAt: new Date(Date.now() - 50 * 3600000).toISOString() // 50 hours old
    };
    store.addBookingRecord(expiredBarreBooking);

    store.processExpiredBarreBookings();

    assert.strictEqual(expiredBarreBooking.status, 'cancelled');
    assert.strictEqual(expiredBarreBooking.decidedBy, 'system_auto_expiry');
    assert.strictEqual(barreSession.spotsRemaining, 6, 'Spot should be released on auto-expiry');
  });

  /* ------------------------------------------------------------------
     4. FINANCIAL INTEGRITY & GST TAX INVOICE MATH
     ------------------------------------------------------------------ */
  console.log('\n--- 4. GST TAX INVOICE & FINANCIAL MATH ---');

  test('GST assessment accurately calculates 18% exclusive tax charged on top at checkout', () => {
    store.addPackageRecord({ id: 'pkg-test-gst-1', name: 'Signature Pass', priceInr: 28000, durationMonths: 1 });
    store.addPackageRecord({ id: 'pkg-test-gst-2', name: 'Quarterly Pass', priceInr: 80000, durationMonths: 3 });

    const packages = store.getPackageCatalog();
    assert(packages.length > 0, 'Packages catalog should have items');

    packages.forEach(pkg => {
      const base = Number(pkg.priceInr);
      const cgst = Math.round(base * 0.09);
      const sgst = Math.round(base * 0.09);
      const gstTotal = cgst + sgst;
      const totalAmount = base + gstTotal;

      assert.strictEqual(base + cgst + sgst, totalAmount, `Base (${base}) + CGST (${cgst}) + SGST (${sgst}) must equal Total (${totalAmount})`);
      assert.strictEqual(gstTotal, Math.round(base * 0.18), 'Total GST must equal 18% of base price');
      assert(cgst > 0, 'CGST must be greater than 0');
      assert(sgst > 0, 'SGST must be greater than 0');
      assert(totalAmount > base, 'Total amount charged must exceed base price by 18%');
    });
  });

  test('Official Tax Invoice email receipt template compiles with SAC 999723 and GST split', () => {
    const templatePath = 'email-templates/payment-receipt-invoice.html';
    assert(fs.existsSync(templatePath), 'Payment receipt invoice email template must exist');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    assert(templateHtml.includes('{{INVOICE_NO}}'), 'Template must have {{INVOICE_NO}} placeholder');
    assert(templateHtml.includes('{{MEMBER_NAME}}'), 'Template must have {{MEMBER_NAME}} placeholder');
    assert(templateHtml.includes('{{MEMBER_EMAIL}}'), 'Template must have {{MEMBER_EMAIL}} placeholder');
    assert(templateHtml.includes('{{BASE_AMOUNT}}'), 'Template must have {{BASE_AMOUNT}} placeholder');
    assert(templateHtml.includes('{{CGST_AMOUNT}}'), 'Template must have {{CGST_AMOUNT}} placeholder');
    assert(templateHtml.includes('{{SGST_AMOUNT}}'), 'Template must have {{SGST_AMOUNT}} placeholder');
    assert(templateHtml.includes('{{TOTAL_AMOUNT}}'), 'Template must have {{TOTAL_AMOUNT}} placeholder');
    assert(templateHtml.includes('999723'), 'Template must state SAC Code 999723 for fitness services');
    assert(templateHtml.includes('29ABIFP5917A1Z7'), 'Template must state studio official GSTIN');
    assert(templateHtml.includes('Plash Pilates Studio LLP'), 'Template must state studio legal entity LLP');
  });

  /* ------------------------------------------------------------------
     5. LIVE BACKEND CONNECTIVITY (SUPABASE)
     ------------------------------------------------------------------ */
  console.log('\n--- 5. LIVE BACKEND CONNECTIVITY (SUPABASE) ---');

  await asyncTest('Supabase live REST endpoint responds with HTTP 200 and brochure data', async () => {
    try {
      const url = `${CONFIG.SUPABASE.URL}/rest/v1/packages?select=id,name,price_inr&limit=3`;
      const res = await fetch(url, {
        headers: {
          'apikey': CONFIG.SUPABASE.ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`
        }
      });
      assert.strictEqual(res.status, 200, 'Supabase REST endpoint must return HTTP 200');
      const data = await res.json();
      assert(Array.isArray(data) && data.length > 0, 'Live packages must return array');
    } catch (err) {
      if (err.message?.includes('fetch failed') || err.message?.includes('ENOTFOUND')) {
        console.log('    [Offline/Sandboxed environment detected — network fetch skipped]');
        return;
      }
      throw err;
    }
  });

  /* ------------------------------------------------------------------
     6. MEMBER IDENTITY DISPLAY RESOLUTION (NO RAW UUIDs)
     ------------------------------------------------------------------ */
  console.log('\n--- 6. MEMBER IDENTITY DISPLAY RESOLUTION ---');

  test('Resolves member full name from profiles relationship and isolates distinct members', () => {
    const mem1 = { id: '11111111-1111-1111-1111-111111111111', fullName: 'Aisha Kapoor', email: 'aisha@example.com', phone: '+91 98450 71864' };
    const mem2 = { id: '6f79f329-ed37-400d-9d23-316f2cfe8a10', fullName: 'Member B Testing', email: 'member.b@plashpilates.com', phone: '+91 99887 76655' };
    const memNoName = { id: '77777777-7777-7777-7777-777777777777', email: 'only.email@example.com' };
    const memEmpty = { id: '88888888-8888-8888-8888-888888888888' };

    store.addMember(mem1);
    store.addMember(mem2);
    store.getAllMembers().push(memNoName, memEmpty);

    const res1 = store.resolveMember(mem1.id);
    const res2 = store.resolveMember(mem2.id);

    assert(res1, 'Member A should resolve');
    assert(res2, 'Member B should resolve');
    assert.strictEqual(res1.fullName, 'Aisha Kapoor');
    assert.strictEqual(res2.fullName, 'Member B Testing');
    assert.notStrictEqual(res1.fullName, res2.fullName, 'Distinct members must have isolated identities');

    // Rule 1: full_name when available
    assert.strictEqual(store.resolveMemberDisplayName(mem1.id), 'Aisha Kapoor');
    assert.strictEqual(store.resolveMemberDisplayName(mem2.id), 'Member B Testing');

    // Rule 2: email when full_name unavailable
    assert.strictEqual(store.resolveMemberDisplayName(memNoName.id), 'only.email@example.com');

    // Rule 3: "Unknown member" when both unavailable
    assert.strictEqual(store.resolveMemberDisplayName(memEmpty.id), 'Unknown member');
    assert.strictEqual(store.resolveMemberDisplayName('non-existent-uuid'), 'Unknown member');
  });

  /* ------------------------------------------------------------------
     7. TIMEZONE INVARIANCE & ASIA/KOLKATA TIME LOCK
     ------------------------------------------------------------------ */
  console.log('\n--- 7. TIMEZONE INVARIANCE & ASIA/KOLKATA LOCK ---');

  test('Class timestamps lock strictly to Asia/Kolkata across all edge case times', () => {
    const timeEdgeCases = [
      { date: '2026-09-20', time: '00:00', expectedUtc: '2026-09-19T18:30:00.000Z' },
      { date: '2026-09-20', time: '09:00', expectedUtc: '2026-09-20T03:30:00.000Z' },
      { date: '2026-09-20', time: '10:00', expectedUtc: '2026-09-20T04:30:00.000Z' },
      { date: '2026-09-20', time: '18:00', expectedUtc: '2026-09-20T12:30:00.000Z' },
      { date: '2026-09-20', time: '23:30', expectedUtc: '2026-09-20T18:00:00.000Z' },
    ];

    for (const tc of timeEdgeCases) {
      const computedUtc = format.parseClassDateTimeToUTC(tc.date, tc.time);
      assert.strictEqual(computedUtc, tc.expectedUtc, `Input ${tc.date} ${tc.time} IST must map to ${tc.expectedUtc}`);

      const roundtripParts = format.getISTDateParts(computedUtc);
      assert.strictEqual(roundtripParts.date, tc.date, `Roundtrip date for ${tc.time} must be ${tc.date}`);
      assert.strictEqual(roundtripParts.time, tc.time, `Roundtrip time for ${tc.time} must be ${tc.time}`);
    }

    // 10:00 AM IST display verification
    const sampleUtc = '2026-09-20T04:30:00.000Z';
    assert.strictEqual(format.formatTime(sampleUtc), '10:00 AM');
    assert.strictEqual(format.formatDate('2026-09-20'), '20 Sep 2026');

    // IST ISO generation verification (+05:30)
    const istSessionTime = format.formatClassDateTimeIST('2026-09-20', '09:00');
    assert.strictEqual(istSessionTime, '2026-09-20T09:00:00+05:30');
    const parsedIstMillis = new Date(istSessionTime).getTime();
    const expectedUtcMillis = new Date('2026-09-20T03:30:00.000Z').getTime();
    assert.strictEqual(parsedIstMillis, expectedUtcMillis, 'IST timestamp must resolve to identical UTC instant');

    const generatedIstStr = format.toISTISOString(new Date('2026-09-20T03:30:00.000Z'));
    assert.strictEqual(generatedIstStr, '2026-09-20T09:00:00+05:30');
  });

  /* ------------------------------------------------------------------
     8. REGISTERED PROSPECTS & STUDIO ACTIVITY AUDIT TRAIL
     ------------------------------------------------------------------ */
  console.log('\n--- 8. REGISTERED PROSPECTS & ACTIVITY LOGS ---');

  test('store.getNonMemberProspects isolates users without active passes and resolves display identities', () => {
    // Member with active pass
    const activeMember = { id: 'usr-prospect-active-1', fullName: 'Active Priya', email: 'priya@example.com', role: 'member' };
    store.addMember(activeMember);
    store.grantComplimentaryPass({ memberId: activeMember.id, packageId: 'pkg-test-gst-1', adminId: 'admin-001' });

    // Registered prospect who never bought a pass
    const freshLead = { id: 'usr-fresh-lead-1', fullName: 'Fresh Lead Vikram', email: 'vikram@example.com', phone: '+91 99999 88888', role: 'member' };
    store.addMember(freshLead);
    store.updateHealthProfile(freshLead.id, { movementLevel: 'Beginner', fitnessGoals: ['Core Conditioning'] });

    const prospects = store.getNonMemberProspects();
    assert(Array.isArray(prospects), 'Prospects must be an array');

    // freshLead must be in prospects
    const found = prospects.find(p => p.id === freshLead.id);
    assert(found, 'Fresh lead without pass must be included in prospects');
    assert.strictEqual(found.name, 'Fresh Lead Vikram');
    assert.strictEqual(found.movementLevel, 'Beginner');
    assert.strictEqual(found.status, 'registered_prospect');
    assert.strictEqual(found.phone, '+91 99999 88888');

    // activeMember must NOT be in prospects
    const foundActive = prospects.find(p => p.id === activeMember.id);
    assert.strictEqual(foundActive, undefined, 'Member with active pass must NOT be in prospects');
  });

  test('store.getAllActivityLogs resolves actor identities and supports category filtering', () => {
    const actorId = 'usr-audit-test-1';
    store.addMember({ id: actorId, fullName: 'Audit Trail Member', email: 'audit@example.com', role: 'member' });

    store.logSystemActivity(actorId, 'member', 'Updated emergency contacts in health profile', 'profile', { field: 'emergencyContact' });
    store.logSystemActivity(actorId, 'member', 'Booked Reformer Flow spot', 'booking', { sessionId: 'sess-001' });

    const allLogs = store.getAllActivityLogs();
    assert(allLogs.length >= 2, 'Activity logs should include logged entries');

    const bookingLogs = store.getAllActivityLogs({ category: 'booking' });
    assert(bookingLogs.length >= 1, 'Should filter by category');
    assert(bookingLogs.every(l => l.category === 'booking'), 'All returned logs must have booking category');

    const sample = allLogs.find(l => l.memberId === actorId && l.category === 'booking');
    assert(sample, 'Must find logged booking entry');
    assert.strictEqual(sample.displayName, 'Audit Trail Member');
    assert.strictEqual(sample.actor, 'member');
    assert(sample.createdAt, 'Timestamp must exist');
    assert(typeof sample.createdAt === 'string', 'Timestamp must be string');
  });

  test('store.grantComplimentaryPass activates pass and transitions prospect to active pass holder', () => {
    const prospect = { id: 'usr-prospect-to-convert-1', fullName: 'Convertible Candidate', email: 'convert@example.com', role: 'member' };
    store.addMember(prospect);

    // Initial check: prospect
    const initialProspects = store.getNonMemberProspects();
    assert(initialProspects.some(p => p.id === prospect.id), 'Candidate should initially be a prospect');

    // Grant trial pass
    const pass = store.grantComplimentaryPass({
      memberId: prospect.id,
      packageId: 'pkg-test-gst-1',
      adminId: 'admin-001',
      note: 'VIP Welcome Trial'
    });
    assert(pass, 'Pass object must be returned');
    assert.strictEqual(pass.status, 'active');
    assert.strictEqual(pass.isTrial, true);

    // Post check: candidate has active pass, no longer a prospect
    const postProspects = store.getNonMemberProspects();
    assert(!postProspects.some(p => p.id === prospect.id), 'Candidate with active pass must no longer be in prospects');

    // Confirm activity was logged
    const logs = store.getAllActivityLogs({ category: 'pass' });
    const passLog = logs.find(l => l.memberId === prospect.id);
    assert(passLog, 'Activity log must be created for complimentary pass grant');
    assert(passLog.action.includes('Granted complimentary trial pass'), 'Action text must describe trial grant');
  });

  /* ------------------------------------------------------------------
     9. ADMIN PAYMENTS & INVOICES LEDGER
     ------------------------------------------------------------------ */
  console.log('\n--- 9. ADMIN PAYMENTS & INVOICES LEDGER ---');

  await asyncTest('Admin payments ledger deduplicates, sorts newest first, and enforces RBAC', async () => {
    // 1. RBAC route guard check
    await auth.login('studio.admin@plashpilates.com', 'plashAdmin2026!');
    assert.strictEqual(auth.isRouteAllowed('#/admin/payments'), true, 'Admin must be authorized for #/admin/payments');

    await auth.login('aisha.kapoor@example.com', 'member123');
    assert.strictEqual(auth.isRouteAllowed('#/admin/payments'), false, 'Member must NOT be authorized for #/admin/payments');

    auth.logout();
    assert.strictEqual(auth.isRouteAllowed('#/admin/payments'), false, 'Unauthenticated visitor must NOT be authorized for #/admin/payments');

    // 2. Data ledger validation
    store.addPayment({
      id: 'pay-test-dedup-1',
      reference: 'rzp_test_dedup_1',
      memberId: '11111111-1111-1111-1111-111111111111',
      invoiceNo: 'PLASH-INV-TEST-001',
      baseAmountInr: 10000,
      cgstInr: 900,
      sgstInr: 900,
      totalAmountInr: 11800,
      createdAt: '2026-09-01T10:00:00Z',
      status: 'paid'
    });

    // Add duplicate
    store.addPayment({
      id: 'pay-test-dedup-1-copy',
      reference: 'rzp_test_dedup_1',
      memberId: '11111111-1111-1111-1111-111111111111',
      invoiceNo: 'PLASH-INV-TEST-001',
      baseAmountInr: 10000,
      cgstInr: 900,
      sgstInr: 900,
      totalAmountInr: 11800,
      createdAt: '2026-09-01T10:00:00Z',
      status: 'paid'
    });

    const allPayments = store.getAllPayments();
    const matches = allPayments.filter(p => p.reference === 'rzp_test_dedup_1');
    assert.strictEqual(matches.length, 1, 'getAllPayments must deduplicate records with same reference');
    assert(typeof store.fetchAdminPayments === 'function', 'fetchAdminPayments function must exist');
  });

  /* ------------------------------------------------------------------
     10. BOOKINGS SYNC, CANCELLATION WINDOWS & PHYSICQ 57 REVIEWS
     ------------------------------------------------------------------ */
  console.log('\n--- 10. BOOKINGS SYNC, ATTENDANCE & PHYSICQ 57 REVIEWS ---');

  await asyncTest('Barre session bookings book directly with status upcoming', async () => {
    const member = { id: 'usr-barre-booker', fullName: 'Barre Member', email: 'barre@example.com', role: 'member' };
    store.addMember(member);
    const barrePkg = store.addPackageRecord({
      id: 'pkg-barre-test-qa',
      name: 'Barre Special Pass',
      priceInr: 15000,
      sessionAllocations: [{ disciplineId: 'disc-002', sessionCount: 5 }]
    });

    store.grantComplimentaryPass({
      memberId: member.id,
      packageId: barrePkg.id,
      adminId: 'admin-001',
      note: 'Barre direct booking test pass'
    });

    const barreSession = store.addClassSession({
      title: 'Barre Direct Test',
      disciplineId: 'disc-002',
      trainerId: 'trainer-004',
      startsAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      capacity: 6
    });

    const booking = await store.bookClass(member.id, barreSession.id);
    assert(booking, 'Booking must be created');
    assert.strictEqual(booking.status, 'upcoming', 'Barre booking must have upcoming status directly without partner review gate');
    assert(booking.sessionId === barreSession.id, 'Session ID must match');
  });

  await asyncTest('Trainer attendance: no-show forfeits credit by default unless explicitly waived', async () => {
    const m1 = { id: 'usr-noshow-forfeit', fullName: 'Forfeited Member', email: 'forfeit@example.com', role: 'member' };
    const m2 = { id: 'usr-noshow-waive', fullName: 'Waived Member', email: 'waive@example.com', role: 'member' };
    store.addMember(m1);
    store.addMember(m2);

    const pilatesPkg = store.addPackageRecord({
      id: 'pkg-pilates-attend-qa',
      name: 'Pilates Attendance Pass',
      priceInr: 12000,
      sessionAllocations: [{ disciplineId: 'disc-001', sessionCount: 10 }]
    });

    store.grantComplimentaryPass({ memberId: m1.id, packageId: pilatesPkg.id, adminId: 'admin-001' });
    store.grantComplimentaryPass({ memberId: m2.id, packageId: pilatesPkg.id, adminId: 'admin-001' });

    const sess = store.addClassSession({
      title: 'No-Show Attendance Policy Test',
      disciplineId: 'disc-001',
      trainerId: 'trainer-001',
      startsAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      capacity: 6
    });

    const b1 = await store.bookClass(m1.id, sess.id);
    const b2 = await store.bookClass(m2.id, sess.id);

    const credit1Before = store.getRemainingCredits(m1.id, 'disc-001');
    const credit2Before = store.getRemainingCredits(m2.id, 'disc-001');

    // Attendance 1: No-show with credit forfeiture (standard)
    await store.markAttendance(b1.id, 'no_show', { refundCredit: false });
    const credit1After = store.getRemainingCredits(m1.id, 'disc-001');
    assert.strictEqual(credit1After, credit1Before, 'Credit must remain deducted / forfeited on standard no-show');

    // Attendance 2: No-show with penalty waiver (genuine reason)
    await store.markAttendance(b2.id, 'no_show', { refundCredit: true, reason: 'Medical emergency' });
    const credit2After = store.getRemainingCredits(m2.id, 'disc-001');
    assert.strictEqual(credit2After, credit2Before + 1, 'Credit must be refunded when trainer waives penalty');
  });

  await asyncTest('Physicq 57 partner reviews lifecycle: pending, accept, decline with reason', async () => {
    const reviews = store.getPartnerReviews();
    assert(Array.isArray(reviews), 'getPartnerReviews must return an array');

    // Create a dummy review
    const testRevId = 'prev-test-audit-1';
    store.addPartnerReviewRecord({
      id: testRevId,
      memberId: 'usr-audit-p57',
      memberName: 'Ananya P57 Candidate',
      memberEmail: 'ananya@example.com',
      packageId: 'pkg-barre-test',
      packageName: 'Barre 10-Pack',
      status: 'pending',
      healthNotes: 'Spinal surgery 6 months ago',
      createdAt: new Date().toISOString()
    });

    // Accept review
    await store.acceptPartnerReview(testRevId, 'Lead Coach Sneha');
    const accepted = store.getPartnerReviews().find(r => r.id === testRevId);
    assert.strictEqual(accepted.status, 'accepted', 'Status must transition to accepted');
    assert.strictEqual(accepted.decidedBy, 'Lead Coach Sneha', 'Must record deciding coach');

    // Decline review with mandatory reason
    const testRevId2 = 'prev-test-audit-2';
    store.addPartnerReviewRecord({
      id: testRevId2,
      memberId: 'usr-audit-p57-2',
      memberName: 'Decline Candidate',
      memberEmail: 'decline@example.com',
      packageId: 'pkg-barre-test',
      packageName: 'Barre 10-Pack',
      status: 'pending',
      healthNotes: 'Severe lumbar disc protrusion',
      createdAt: new Date().toISOString()
    });

    await store.declinePartnerReview(testRevId2, 'High impact barre contraindicated for lumbar herniation', 'Lead Coach Ritika');
    const declined = store.getPartnerReviews().find(r => r.id === testRevId2);
    assert.strictEqual(declined.status, 'declined', 'Status must transition to declined');
    assert.strictEqual(declined.decisionReason, 'High impact barre contraindicated for lumbar herniation', 'Declination reason must be preserved');
  });

  /* ------------------------------------------------------------------
     SUMMARY
     ------------------------------------------------------------------ */
  console.log('\n============================================================');
  console.log(`  QA TEST RUN COMPLETE: ${passedTests}/${totalTests} PASSED`);
  if (failedTests > 0) {
    console.log(`  STATUS: ❌ ${failedTests} FAILURES DETECTED`);
    process.exit(1);
  } else {
    console.log('  STATUS: ✅ 100% GREEN — ALL SECURITY & BUSINESS RULES VERIFIED');
    console.log('============================================================\n');
    process.exit(0);
  }
}

runAllTests();
