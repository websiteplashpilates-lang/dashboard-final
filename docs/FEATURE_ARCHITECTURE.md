# Plash Pilates Studio — Technical Feature Architecture Blueprint

**Version:** 1.0.0 Production Release  
**Target Studio:** Sadashiva Nagar, Bengaluru  
**Architecture Classification:** Zero-Dependency Reactive Single-Page Application (SPA) + Hardened Node.js Gateway + Cloud PostgreSQL 15  

---

## 1. System Overview

Plash Pilates Studio operates a unified three-tier cloud software platform that automates client onboarding, membership pass billing, strict 1:6 capacity booking, trainer batch dispatching, and partner coach approvals.

```
[ BROWSER CLIENT (Vanilla JS SPA) ]
                │
                ├─ Hash Router + Route Guards (js/core/router.js)
                ├─ State Store & Event Bus (js/core/store.js, js/core/events.js)
                ├─ Supabase Client SDK (js/core/supabase.js)
                │
                ▼
[ NODE.JS GATEWAY (server.cjs) ]
                │
                ├─ Razorpay Order Initiation (/api/create-razorpay-order)
                ├─ HMAC-SHA256 Payment Verification (/api/verify-and-fulfill-payment)
                ├─ Brevo SMTP Mail Engine (smtp-relay.brevo.com:587)
                ├─ Static SPA Asset Server & Security Headers
                │
                ▼
[ CLOUD POSTGRESQL 15 (Supabase) ]
                │
                ├─ Supabase GoTrue Auth (ES256 JWTs)
                ├─ 14 Normalized Schema Tables
                ├─ Row Level Security (RLS) on 100% of tables
                └─ Concurrency Locks & Credit Triggers
```

---

## 2. Frontend Architecture

- **Technology:** Vanilla ECMAScript 2022 (ES Modules), HTML5, Vanilla CSS with custom properties (`variables.css`).
- **Framework:** Zero external framework dependencies. No React, Vue, or Angular. This eliminates hydration overhead and guarantees sub-second rendering.
- **Entry Point:** `index.html` loads `js/app.js?v=70`.
- **Component Model:** Pure functional DOM factory patterns via `js/utils/dom.js` (`createElement`, `clearChildren`).
- **Typography & Theme:** Google Fonts (`Nunito Sans` for body typography, `Playfair Display` for editorial headings). Color tokens: Terracotta Rust (`#934b2d`), Charcoal Ink (`#1e1e24`), Ivory Cream (`#fbf8f5`).
- **Accessibility:** WCAG 2.1 AA compliant skip-links, ARIA live announcers (`#aria-announcer`), semantic table elements, and keyboard navigability.

---

## 3. Backend / API Architecture

The server process is orchestrated by `server.cjs` running on Node.js v20:
- **Port:** Listens on port `3333` (and secondary port `5500`).
- **Security Headers:**
  - `Content-Security-Policy`: Restricts scripts, fonts, styles, and frames to trusted CDNs (Supabase, Razorpay, Lucide, Google Fonts, cdnjs).
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Endpoints Implemented:**
  1. `GET /api/public-config`: Emits public `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `RAZORPAY_KEY_ID`.
  2. `POST /api/create-razorpay-order`: Authoritatively queries the database for package prices, converts to paise, and initiates orders with Razorpay.
  3. `POST /api/verify-and-fulfill-payment`: Verifies Razorpay HMAC-SHA256 signatures, performs idempotency checks against `payments.reference`, and executes transactional pass and credit provisioning.
  4. `POST /api/verify-razorpay-payment`: Lightweight cryptographic signature verification utility.

---

## 4. Supabase Architecture

- **Cloud Instance:** Hosted on AWS Mumbai (ap-south-1) under project ID `ylabdaulbstmhvyzipyd`.
- **REST Interface:** PostgREST 12 exposing endpoints under `/rest/v1/*`.
- **Realtime Layer:** PostgreSQL change data capture (CDC) streaming insert/update/delete events over WebSockets to `js/core/supabase.js`.
- **Service Role Isolation:** The high-privilege `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to `server.cjs` and never delivered to client browsers.

---

## 5. Authentication Architecture

- **Identity Provider:** Supabase GoTrue Auth.
- **Token Protocol:** JSON Web Tokens (JWT) digitally signed with the ES256 algorithm.
- **Client Manager:** `js/core/auth.js`.
- **Workflow:**
  1. Member inputs email and password at `#/login`.
  2. Submits to `dbSignIn()` -> `POST /auth/v1/token?grant_type=password`.
  3. GoTrue returns `access_token`, `refresh_token`, and user metadata.
  4. Client maps user UUID to `public.profiles` to resolve user role.
  5. Session saved in memory and serialized to localStorage key `plash_auth_session_v1`.
  6. State store immediately calls `store.syncFromSupabase()` with the authenticated JWT.

---

## 6. Authorization & RBAC Architecture

The platform enforces Role-Based Access Control at two independent boundaries:

1. **Client Route Guard (`js/core/router.js` & `js/core/auth.js`):**
   - Routes mapped into role buckets: Member (`#/portal/*`), Admin (`#/admin/*`), Trainer (`#/trainer/*`), Partner (`#/partner/*`).
   - If user lacks permission, router aborts render and redirects to `#/403`.
2. **Database Row Level Security (RLS):**
   - Even if an attacker bypasses the frontend, PostgreSQL policies check `auth.uid()` and `get_current_role()` on every query.

---

## 7. Database Schema

The database consists of 14 normalized tables in the `public` schema:

1. `profiles`: `id` (UUID, PK, references `auth.users`), `role` (text), `created_at`.
2. `members`: `id` (UUID, PK, references `profiles`), `full_name`, `email`, `phone`, `emergency_contact`, `tier`.
3. `health_profiles`: `id` (UUID, PK), `member_id` (UUID, FK), `movement_level`, `injuries_or_limitations`, `fitness_goals`.
4. `disciplines`: `id` (text, PK e.g. `disc-pilates`), `name`, `description`.
5. `trainers`: `id` (text, PK), `name`, `bio`, `discipline_id`, `tier`.
6. `packages`: `id` (text, PK), `name`, `duration_months`, `price_inr`, `session_allocations` (JSONB), `is_popular`.
7. `member_passes`: `id` (text, PK), `member_id` (UUID, FK), `package_id` (text, FK), `status`, `valid_from`, `valid_until`.
8. `member_pass_credits`: `id` (UUID, PK), `pass_id` (text, FK), `discipline_id` (text, FK), `total_credits` (int), `remaining_credits` (int).
9. `class_sessions`: `id` (text, PK), `title`, `discipline_id`, `trainer_id`, `start_time` (timestamptz), `end_time`, `capacity` (int default 6), `status`.
10. `bookings`: `id` (text, PK), `session_id` (text, FK), `member_id` (UUID, FK), `pass_id` (text), `status` (text), `created_at`.
11. `payments`: `id` (text, PK), `member_id` (UUID), `package_id` (text), `invoice_no` (text), `gstin` (text), `base_amount_inr`, `cgst_inr`, `sgst_inr`, `total_amount_inr`, `reference` (unique text).
12. `waivers`: `id` (text, PK), `title`, `version`, `content_markdown`.
13. `waiver_acceptances`: `id` (text, PK), `waiver_id`, `member_id`, `accepted_at`, `ip_address`.
14. `partner_orgs`: `id` (text, PK), `name`, `contact_email`.

---

## 8. Row Level Security (RLS) Architecture

- **Global Policy:** `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;` executed on all 14 tables.
- **Anonymous Queries:** Public catalog tables (`disciplines`, `packages`, `trainers`, `class_sessions`) permit anonymous `SELECT`. All other tables return 0 rows.
- **Member Isolation:** 
  - `bookings`: `USING (member_id = auth.uid() OR get_current_role() IN ('admin', 'trainer', 'partner'))`
  - `member_passes`: `USING (member_id = auth.uid() OR get_current_role() IN ('admin', 'trainer'))`
  - `payments`: `USING (member_id = auth.uid() OR get_current_role() = 'admin')`
- **Mutations:** Anonymous inserts or updates on `payments`, `member_passes`, and `member_pass_credits` are strictly rejected. Only the trusted server `service_role` can fulfill passes.

---

## 9. Booking Architecture & Business Rule Enforcement Layers

Business rules are distributed across client and database layers. The zero-trust audit established the exact enforcement boundary for each rule:

| Business Rule | Enforced At | Implementation Mechanism | Live Verification Result |
| :--- | :--- | :--- | :--- |
| **Strict 1:6 Capacity Limit** | **Database Layer** | PostgreSQL trigger `trg_check_class_capacity` on `INSERT` to `public.bookings` | **PASS** — Returns HTTP 400 `P0001: Class enrollment capped at strictly 6 members. Batch is full.` |
| **Duplicate Booking Prevention** | **Database Layer** | PostgreSQL unique constraint `bookings_member_id_session_id_key` on `(member_id, session_id)` | **PASS** — Returns HTTP 409 `23505: duplicate key value violates unique constraint` |
| **Cross-Member Booking Tampering** | **Database Layer** | PostgreSQL RLS policy `USING (member_id = auth.uid())` | **PASS** — Returns HTTP 403 `42501: violates row-level security policy for table "bookings"` |
| **Past-Class Booking Prevention** | **Database Layer** | PostgreSQL trigger function `public.enforce_class_capacity_and_credits()` checking `IF sess_start < NOW() THEN RAISE EXCEPTION ... USING ERRCODE = 'P0003'` | **PASS** — Returns HTTP 500/400 `P0003: Cannot book a class that has already started or concluded.` |
| **4-Hour Cancellation Window** | **Database Layer** | PostgreSQL `BEFORE UPDATE` trigger `trg_enforce_cancellation_window` checking `IF sess_start - NOW() < interval '4 hours' THEN RAISE EXCEPTION ... USING ERRCODE = 'P0005'` | **PASS** — Returns HTTP 500/400 `P0005: Cancellation window closed. Bookings cannot be cancelled within 4 hours of class start time.` (Aborts transaction before credit restore trigger executes) |
| **Credit Restoration on Cancellation**| **Database Layer** | PostgreSQL trigger `trg_restore_booking_credit` on `AFTER UPDATE` to `public.bookings` | **PASS** — Increments member pass credit when status changes to `cancelled` for timely cancellations (>4 hours before class) |

---

## 10. Credit Architecture

- **Storage:** `public.member_pass_credits`.
- **Disciplines Supported:** Reformer Pilates (`disc-pilates`), Barre Conditioning (`disc-barre`), Sculpt Yoga (`disc-sculpt-yoga`).
- **Credit Lifecycle:**
  - **Purchase:** Authoritative allocations credited upon verified payment (e.g. Signature Membership: 12 Pilates, 8 Barre, 8 Sculpt Yoga).
  - **Booking:** `remaining_credits` decrements by 1 (atomic row lock).
  - **Cancellation (>4 hours):** Trigger `trg_restore_booking_credit` increments `remaining_credits` by 1.
  - **Cancellation (<4 hours):** Blocked at database trigger level (`trg_enforce_cancellation_window`) with `ERRCODE = 'P0005'`; credit restoration trigger is prevented from running.

---

## 11. Payment Architecture & Defense in Depth

The payment pipeline employs a multi-tiered defense in depth strategy:

```
Client (Cart) ──▶ POST /api/create-razorpay-order
                        │
                        ├─ Authoritative DB Catalog Lookup (Zero-Trust: Client cannot tamper price)
                        ├─ Forces package catalog price (e.g., ₹27,000 for pkg-001)
                        └─ Razorpay API creates order
                                │
Client (Checkout) ◀─────────────┘
      │
      ▼ (User completes test checkout)
POST /api/verify-and-fulfill-payment
      │
      ├─ 1. Strict UUID regex on memberId
      ├─ 2. Idempotency Check: Query public.payments for existing reference
      │     └─ If already fulfilled: Returns existing invoice (Zero duplicate passes/credits)
      ├─ 3. Timing-Safe HMAC-SHA256 Signature Verification (crypto.timingSafeEqual)
      ├─ 4. Live Gateway Query (Razorpay API): Verifies status === 'captured', currency === 'INR', amount >= expectedPaise
      └─ 5. Atomic Fulfillment: Inserts paymentRow, passRow, and member_pass_credits
```

- **Tax Calculation (18% Inclusive GST):**
  - `Total Amount (INR) = Package Catalog Price`
  - `Base Amount = Round(Total / 1.18)`
  - `GST Amount = Total - Base Amount`
  - `CGST (9%) = Round(GST Amount / 2)`
  - `SGST (9%) = GST Amount - CGST`
- **Audit Classification:**
  - **Test-Mode Verification:** **PASS** (Verified with test keys `rzp_test_SKQzTiiysg1aGG`).
  - **Real-Money Verification:** **NOT TESTED** (Requires live merchant keys and real bank debit).

---

## 12. Email & Communications Architecture

- **Provider:** Brevo SMTP Relay (`smtp-relay.brevo.com:587` with STARTTLS).
- **Integration Point:** Supabase Auth SMTP configuration.
- **Transactional Deliverables:** Account confirmation emails, GoTrue auth tokens.
- **In-App Password Recovery:** Native Supabase GoTrue Auth password recovery (`POST /auth/v1/recover` triggering email with recovery token, and `#/reset-password` landing page calling `PUT /auth/v1/user`). All simulated OTPs (`742918`) and client `sessionStorage` tokens removed. Live API call verified. External delivery to non-whitelisted domains is an **EXTERNAL PRODUCTION GATE** pending Brevo custom domain SPF/DKIM DNS verification.

---

## 13. Admin Architecture

- **Controller:** `js/pages/admin/*`.
- **Modules:**
  - `overview.js`: Studio KPI counters, revenue totals, utilization meters.
  - `members.js`: Searchable member roster with health alerts.
  - `schedule.js`: 7-day weekly schedule matrix and recurring rule creator.
  - `packages.js`: Package CRUD and credit allocation manager.
  - `bookings.js`: Real-time audit log of all studio reservations.

---

## 14. Trainer Architecture

- **Controller:** `js/pages/trainer/dashboard.js`.
- **Scope:** Filtered by `class_sessions.trainer_id = auth.uid()`.
- **Views:** "Today's Batches" and "Tomorrow's Batches" with real-time enrollment counters.

---

## 15. Partner Architecture (Physicq 57)

- **Controller:** `js/pages/partner/*`.
- **Partner Organization:** Physicq 57 Barre Programming.
- **Workflow:** Barre classes booked with `status = 'pending_partner_review'`. Partner coaches log in to verify physical readiness and approve or decline reservations.

---

## 16. Recurring Schedule Architecture

- **Controller:** `js/core/store.js` (`addRecurringRule`, `generateSessionsFromRules`).
- **Functionality:** Allows administrators to define recurring patterns (e.g. Every Tuesday 07:00 AM Reformer Pilates with Trainer Priya) and project batches across a 30-day horizon.

---

## 17. Security Architecture & Defense in Depth

1. **Client Isolation:** Member sessions are partitioned by cryptographic JWT subject claims.
2. **Zero Trust Database:** All queries pass through PostgreSQL Row Level Security.
3. **Quarantined Secrets:** Service-role keys and payment secrets exist strictly on the backend.
4. **Input Sanitization:** HTML entity escaping prevents cross-site scripting (XSS).
5. **Content Security Policy:** Strict whitelisting of origin domains.

---

## 18. Error Handling Architecture

- **Global Error Boundary:** `window.addEventListener('error')` and `window.addEventListener('unhandledrejection')` in `js/app.js`.
- **User Feedback:** Toast notifications (`js/components/toast.js`) categorized as `success`, `error`, or `info`.
- **Fallback Error Views:** Dedicated routes for `#/404` (Not Found), `#/403` (Access Denied), and `#/500` (System Recovery).

---

## 19. Persistence Flow

```
[ User Interaction ] 
       │
       ▼
[ Local Reactive Store (state.*) ]
       │
       ▼
[ Authenticated Supabase REST Request ]
       │
       ▼
[ PostgreSQL RLS & Trigger Evaluation ]
       │
       ▼
[ Permanent Disk Write (WAL) ]
       │
       ▼
[ Page Hard Refresh / Relogin ]
       │
       ▼
[ store.syncFromSupabase() ]
       │
       ▼
[ Clean UI Paint ]
```

---

## 20. External Dependencies

| Dependency | Purpose | Mode / Environment |
| :--- | :--- | :--- |
| **Supabase Cloud** | Database, GoTrue Auth, Realtime WebSockets | Production Cloud (`ylabdaulbstmhvyzipyd`) |
| **Razorpay** | Order creation, payment checkout, signature verification | Test Mode (`rzp_test_...`) |
| **Brevo SMTP** | Transactional email relay | Active Relay (`smtp-relay.brevo.com:587`) |
| **Lucide Icons** | SVG icon set | CDN (`unpkg.com/lucide`) |
| **html2canvas + jsPDF** | Tax invoice PDF generation | CDN (`cdnjs.cloudflare.com`) |
