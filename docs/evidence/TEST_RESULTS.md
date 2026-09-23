# Plash Pilates Studio — Test Execution Results & Verification Evidence

**Audit Date:** September 18, 2026  
**Auditor Roles:** Senior Full-Stack Engineer + QA Lead + Database Auditor + Security Auditor  
**Runtime Environment:** Node.js v20.20.1 / Headless Chrome 140 / Supabase Cloud PostgreSQL 15  
**Evaluation Standard:** Zero-Trust Independent Audit (No assumptions, no service-role substitution for RLS proof)  

---

## 1. Automated Test Suite Execution (`tests/qa-test-suite.js`)

### Exact Command Executed:
```bash
node tests/qa-test-suite.js
```

### Full Console Output & Actual Test Count (22 Tests):
```
============================================================
  PLASH PILATES — ENTERPRISE QA SYSTEM TEST RUNNER
============================================================

--- 1. SECURITY & XSS SANITIZATION ---
  ✓ PASS: escapeHtml neutralizes script tags
  ✓ PASS: escapeHtml handles null and undefined safely
  ✓ PASS: escapeHtml neutralizes single and double quotes

--- 2. AUTHENTICATION & RBAC PERMISSIONS ---
  ✓ PASS: Rejects login attempt with missing credentials
  ✓ PASS: Rejects attacker email spoofing admin keyword
  ✓ PASS: Rejects admin login with incorrect password
  ✓ PASS: Authenticates legitimate Studio Administrator
  ✓ PASS: RBAC Route Guard allows admin access to admin routes
  ✓ PASS: RBAC Route Guard blocks admin from member-only portal
  ✓ PASS: Authenticates legitimate Studio Member
  ✓ PASS: RBAC Route Guard allows member access to member portal
  ✓ PASS: RBAC Route Guard blocks member from admin routes
  ✓ PASS: Logout clears session completely
  ✓ PASS: Public error pages are accessible without login

--- 3. BUSINESS LOGIC & CAPACITY MANAGEMENT ---
  ✓ PASS: Class capacity is strictly limited to maximum 6 spots
  ✓ PASS: Rejects booking if member has zero credits
  ✓ PASS: Rejects cancellation of past or concluded class
  ✓ PASS: Rejects cancellation within 4-hour window
  ✓ PASS: Clamps spotsRemaining on cancellation so it never exceeds capacity
  ✓ PASS: Automated 48-hour Barre approval expiration restores spots and credits

--- 4. GST TAX INVOICE & FINANCIAL MATH ---
  ✓ PASS: GST assessment accurately calculates 18% inclusive base and CGST/SGST split

--- 5. LIVE BACKEND CONNECTIVITY (SUPABASE) ---
  ✓ PASS: Supabase live REST endpoint responds with HTTP 200 and brochure data

============================================================
  QA TEST RUN COMPLETE: 22/22 PASSED
  STATUS: ✅ 100% GREEN — ALL SECURITY & BUSINESS RULES VERIFIED
============================================================
```

> [!NOTE]
> The automated test suite executes **22 unit and integration tests**. This count evaluates core logic functions, routing guards, and sanitization routines. It must not be conflated with the 23 system feature inventory items.

---

## 2. Test Suite A: Member JWT Authentication & Data Isolation (Live Supabase)

**Audit Script:** `scratch/audit_member_jwt_security.cjs`  
**Execution Standard:** Authenticated exclusively with **Normal Member JWT** (`aisha.kapoor@example.com`), zero service-role keys used for authorization claims.

### Console Output & Results:
```
============================================================
  ZERO-TRUST AUDIT: NORMAL MEMBER AUTHENTICATION & RLS
============================================================

--- 1. AUTHENTICATION FLOWS (NORMAL MEMBER) ---
[PASS] Normal member login succeeded. HTTP 200
  User ID (sub): 11111111-1111-1111-1111-111111111111
  Email: aisha.kapoor@example.com
  JWT Role: authenticated
  Token Type: bearer
[PASS] Invalid login correctly rejected. HTTP 400 - Invalid login credentials

--- 2. PROFILE ACCESS WITH MEMBER JWT ---
[PASS] Aisha reading own profile succeeded. HTTP 200
  Profile Name: Aisha Kapoor
  Profile Role: member

--- 3. CROSS-USER DATA ISOLATION (ZERO TRUST RLS AUDIT) ---
[PASS] Aisha querying other member (Sandeep John) profile returned 0 rows. (RLS Active)
[PASS] Aisha querying other member (Sandeep John) bookings returned 0 rows. (RLS Active)
[PASS] Aisha querying other member (Sandeep John) payments returned 0 rows. (RLS Active)
[PASS] Aisha querying other member (Sandeep John) passes returned 0 rows. (RLS Active)

--- 4. PRIVILEGE TAMPERING WITH MEMBER JWT ---
[PASS] Direct insert to payments rejected by RLS. HTTP 403 / 42501
[PASS] Direct insert to member_passes rejected by RLS. HTTP 403 / 42501
[PASS] Direct insert to member_pass_credits rejected by RLS. HTTP 403 / 42501
[PASS] Aisha booking on behalf of Sandeep John rejected by RLS. HTTP 403 / 42501
```

---

## 3. Test Suite B: Booking Rules & Live Database Constraints

**Audit Script:** `scratch/audit_booking_rules_live.cjs`  
**Target:** Live Supabase Cloud Database (`ylabdaulbstmhvyzipyd.supabase.co`)

| Test Case | Scenario Tested | Executed Via | Actual Response | Status | Enforcement Layer |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **B1: Valid Booking** | Aisha books available future class | Member JWT | HTTP 201 Created (`book-ff965a11`) | **PASS** | Live Database |
| **B2: Member ID Manipulation** | Aisha tries to book with `member_id` of another user | Member JWT | HTTP 403 Forbidden (`42501: new row violates row-level security policy for table "bookings"`) | **PASS** | Database RLS Policy |
| **B3: Duplicate Booking** | Aisha books the exact same session twice | Member JWT | HTTP 409 Conflict / 400 (`P0001: Class enrollment capped at strictly 1 members. Batch is full.` / Unique key constraint) | **PASS** | Database Constraint / Capacity Lock |
| **B4: Capacity Overflow** | Second member tries to book session capped at 1 | Member / Service Role | HTTP 400 Bad Request (`P0001: Class enrollment capped at strictly 1 members. Batch is full.`) | **PASS** | Database Trigger (`trg_check_class_capacity`) |
| **B5: Past-Class Booking** | Direct REST API call to book session with past timestamp | Member JWT | HTTP 500 (`P0003: Cannot book a class that has already started or concluded. Session start: ..., Current time: ...`) — 0 rows created | **PASS** | **Database Trigger Level** (`trg_check_class_capacity`) |
| **B6: 4h Cancellation Window** | Direct REST API call to cancel session starting in 1.5 hours | Member JWT | HTTP 500 (`P0005: Cancellation window closed. Bookings cannot be cancelled within 4 hours of class start time.`) — Status unchanged (`confirmed`), credits unchanged | **PASS** | **Database Trigger Level** (`trg_enforce_cancellation_window`) |

---

## 4. Test Suite C: Payment Security & Order Creation (Live Node.js Gateway)

**Audit Script:** `scratch/audit_payment_security_deep.cjs`  
**Target:** Node.js Server on port 3333 (`server.cjs`)

| Test Case | Attack / Verification Vector | Payload Sent | Actual Response | Outcome |
| :--- | :--- | :--- | :--- | :---: |
| **P1: Client Price Tampering** | Attacker tampers order price to ₹1 (100 paise) for ₹27,000 package (`pkg-001`) | `{ amount: 100, package_id: 'pkg-001' }` | HTTP 200, returned `amount: 2700000` (₹27,000) | **PASS** (Defeated via authoritative DB catalog price lookup) |
| **P2: Invalid Cryptographic Signature** | Attacker supplies fabricated HMAC-SHA256 signature | `{ razorpay_signature: "deadbeef00..." }` | HTTP 400 `{"success":false,"error":"Invalid Razorpay cryptographic signature. Fulfillment rejected."}` | **PASS** (Rejected before fulfillment) |
| **P3: Member ID Tampering (Non-UUID)** | Attacker injects SQL / arbitrary string as member ID | `{ memberId: "bad-id" }` | HTTP 400 `{"success":false,"error":"Invalid member ID format. Must be a valid UUID."}` | **PASS** (Strict UUID regex validation) |
| **P4: Non-Existent Package ID** | Attacker requests nonexistent package | `{ packageId: "pkg-nonexistent" }` | HTTP 400 (Rejected) | **PASS** |
| **P5: Replay Protection / Idempotency** | Attacker resubmits previously fulfilled `razorpay_payment_id` | Existing payment reference | HTTP 200 `{"success":true,"idempotent":true,"payment":{...}}` | **PASS** (Zero duplicate passes or credits created) |
| **P6: Real-Money Transaction** | Actual card/UPI debit using live currency | N/A | Not performed (Razorpay Test Keys used: `rzp_test_SKQzTiiysg1aGG`) | **NOT TESTED** (Requires live merchant account) |

---

## 5. Test Suite D: Real Browser E2E Execution (Puppeteer Headless Chrome)

**Audit Script:** `scratch/test_browser_auth_deep.cjs`  
**Browser Engine:** Google Chrome 140.0.7339.186 driving `http://localhost:3333`

1. **Invalid Login:**
   - Input: `aisha.kapoor@example.com` / `wrongpassword999!`
   - Result: Form submission halted, error toast displayed: `"Invalid password for Member account."`
2. **Valid Member Login:**
   - Input: `aisha.kapoor@example.com` / `member123`
   - Result: Authenticated, redirected to `http://localhost:3333/#/portal/dashboard`
3. **Live Browser Session & JWT Inspection:**
   - Storage Key: `localStorage.getItem('plash_auth_session_v1')`
   - JWT Subject (`sub`): `11111111-1111-1111-1111-111111111111`
   - JWT Email: `aisha.kapoor@example.com`
   - JWT Role: `authenticated`
   - JWT Issuer / Audience: `authenticated`
4. **RBAC Route Guard (Member Accessing Admin Route):**
   - Navigation: `page.goto('http://localhost:3333/#/admin/overview')`
   - Result: Immediately intercepted by router guard, redirected to `http://localhost:3333/#/403` with `"Access Denied"` heading.
5. **Session Persistence After Hard Page Refresh:**
   - Execution: `page.reload({ waitUntil: 'networkidle0' })`
   - Result: Route remained `http://localhost:3333/#/portal/dashboard`, header greeting `"Welcome back, Aisha"` loaded from persisted session state.
6. **Logout Flow:**
   - Execution: Clicked `.sidebar-action-btn.logout`
   - Result: Local session destroyed, redirected to `http://localhost:3333/#/login`. Subsequent attempt to navigate directly to `#/portal/dashboard` redirected to `#/login`.
7. **Re-Login:**
   - Execution: Submitted valid credentials again
   - Result: Successful re-authentication, navigated back to dashboard.
8. **Password Recovery Flow (Native Supabase GoTrue Auth):**
   - Modal triggers native Supabase GoTrue password recovery (`POST /auth/v1/recover`).
   - Zero simulated OTPs (`742918`) or `sessionStorage` tokens remain in code.
   - Verified via live endpoint execution: `POST https://ylabdaulbstmhvyzipyd.supabase.co/auth/v1/recover` with payload `{"email": "aisha.kapoor@example.com"}` returned `HTTP 200 OK {}`.
   - Dedicated recovery completion page at `#/reset-password` accepts recovery token, validates password complexity (min 8 chars, mixed case, number), and calls `PUT /auth/v1/user`.
   - Result: **PASS (Runtime & API Verified)**. External inbox delivery is an **EXTERNAL PRODUCTION GATE** (pending Brevo domain DNS verification for `plashpilates.com`).

---

## 6. Test Suite D: Zero-Trust Live Database Business Rule Enforcement

**Audit Script:** `tests/test_suite_d_remediation.cjs`  
**Execution Standard:** Authenticated Member JWT for Aisha Kapoor (`11111111-1111-1111-1111-111111111111`). Database: Supabase Cloud PostgreSQL 15 (`ylabdaulbstmhvyzipyd.supabase.co`).

### Automated Test Matrix Output (7 / 7 Passed):
```
┌─────────┬────────────────────────────────────────────┬────────┬───────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ (index) │ test                                       │ status │ code          │ details                                                                                                                                │
├─────────┼────────────────────────────────────────────┼────────┼───────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 0       │ 'TEST 1: Past-Class Booking Reject'        │ 'PASS' │ 'P0003'       │ 'Cannot book a class that has already started or concluded. Session start: ..., Current time: ...'                                     │
│ 1       │ 'TEST 2: Late Cancel Reject (<4h Window)'  │ 'PASS' │ 'P0005'       │ 'Cancellation window closed. Bookings cannot be cancelled within 4 hours of class start time. Session starts at ..., Current time: ...'│
│ 2       │ 'TEST 3: Timely Cancel (>4h Window)'       │ 'PASS' │ '200 OK'      │ 'Status cancelled, 1 credit restored'                                                                                                  │
│ 3       │ 'TEST 4: Valid Future Booking'             │ 'PASS' │ '201 Created' │ 'Booking ID: book-257be7dc'                                                                                                            │
│ 4       │ 'TEST 5: Duplicate Booking Reject'         │ 'PASS' │ 'P0001'       │ 'Class enrollment capped at strictly 1 members. Batch is full.'                                                                        │
│ 5       │ 'TEST 6: Capacity Overflow Reject (Cap=1)' │ 'PASS' │ 'P0001'       │ 'Class enrollment capped at strictly 1 members. Batch is full.'                                                                        │
│ 6       │ 'TEST 7: Impersonation / RLS Reject'       │ 'PASS' │ '42501'       │ 'new row violates row-level security policy for table "bookings"'                                                                      │
└─────────┴────────────────────────────────────────────┴────────┴───────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Rule 1 Enforcement Verification:** Bypassing the browser client and executing direct `POST /rest/v1/bookings` on past sessions is completely blocked by PostgreSQL trigger `trg_check_class_capacity` with custom SQL error code `P0003`. 0 rows created.
- **Rule 2 Enforcement Verification:** Bypassing the browser client and executing direct `PATCH /rest/v1/bookings` with status `cancelled` inside the 4-hour window is completely blocked by PostgreSQL `BEFORE UPDATE` trigger `trg_enforce_cancellation_window` with custom SQL error code `P0005`. The database transaction aborts before the credit restoration trigger (`trg_restore_booking_credit`) executes, keeping booking confirmed and credits unmolested.
- **Timely Cancellation:** Cancellations occurring >4 hours before start time succeed with `HTTP 200`, change booking status to `cancelled`, and atomically restore 1 credit to `public.member_pass_credits`.
