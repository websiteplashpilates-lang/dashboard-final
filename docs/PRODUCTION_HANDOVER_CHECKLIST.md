# Plash Pilates Studio — Production Handover & Go-Live Checklist

**Document Version:** 1.0.0 Production Release  
**Target Deployment:** Sadashiva Nagar, Bengaluru  
**Audit Evaluation:** Zero-Trust Independent Audit  

---

## 1. Executive Handover Summary

This checklist outlines the final operational requirements for transitioning the Plash Pilates Studio software from verified staging/local status to active commercial production.

All application business logic, strict 1:6 batch capacity locks, database triggers, Razorpay HMAC-SHA256 signature verification, and RBAC security boundaries are implemented, hardened, and verified live on Supabase Cloud PostgreSQL.

---

## 2. Pre-Flight Architecture Verification Status

| System Layer | Verification Method | Status | Notes |
| :--- | :--- | :---: | :--- |
| **Vanilla SPA Client** | Puppeteer Chrome 140 (23 Views) | **PASS** | Sub-second load, mobile-responsive, zero framework bloat |
| **GoTrue Authentication** | Asymmetric ES256 JWTs | **PASS** | `auth.uid()` mapped directly to `public.profiles` |
| **PostgreSQL RLS** | Cross-User Member Isolation | **PASS** | 100% of schema tables protected by Row Level Security |
| **Capacity Constraint** | Database Trigger `trg_check_class_capacity` | **PASS** | Hard cap at 6 participants (P0001 rejection on overflow) |
| **Past-Class Booking** | Database Trigger Function | **PASS** | Rejects `start_time < NOW()` with code P0003; 0 rows created |
| **4-Hour Cancellation** | Database Trigger `trg_enforce_cancellation_window` | **PASS** | Rejects late cancellations (<4h) with code P0005 |
| **Credit Accounting** | Database Trigger `trg_restore_booking_credit` | **PASS** | Atomic row-lock (`FOR UPDATE`); timely cancels restore credit |
| **Payment Security** | Server Authoritative DB Catalog Lookup | **PASS** | Client price tampering strictly defeated (forces ₹27,000) |
| **Payment Verification** | Cryptographic Timing-Safe HMAC-SHA256 | **PASS** | Server-side fulfillment; replay protection via `payments.reference` |
| **Password Recovery** | Native Supabase GoTrue Auth | **PASS** | Dispatches secure recovery token; zero simulated OTPs |

---

## 3. External Production Go-Live Gates

These two remaining gates depend on third-party commercial accounts and domain registrar DNS access:

### Gate 1: Razorpay Production Merchant Activation
- **Current Mode:** Test Mode (`rzp_test_SKQzTiiysg1aGG`).
- **Prerequisite:** Complete bank account KYC verification in the Razorpay Merchant Dashboard (`dashboard.razorpay.com`).
- **Action Required:**
  1. Generate live API keys under **Settings > API Keys > Generate Live Key**.
  2. In production server `.env`, update:
     ```env
     RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
     RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
     ```
  3. Execute a ₹1 / real-money test transaction using a live credit card or UPI handle.
  4. Verify automatic pass and credit allocation in `public.member_passes` and `public.member_pass_credits`.
  5. Process refund via Razorpay dashboard to confirm end-to-end settlement.

### Gate 2: Brevo Custom Domain DNS Verification
- **Current Mode:** Active SMTP Relay on port 587 (`smtp-relay.brevo.com:587`).
- **Prerequisite:** Access to DNS management (Cloudflare / GoDaddy / Namecheap) for `plashpilates.com`.
- **Action Required:**
  1. Log in to Brevo dashboard (`app.brevo.com`) under **Senders, Domains & Dedicated IPs > Domains > Add a Domain**.
  2. Enter `plashpilates.com`.
  3. Add the following TXT and CNAME DNS records:
     - **SPF Record (TXT):** `v=spf1 include:spf.brevo.com ~all`
     - **DKIM Record (TXT):** `mail._domainkey.plashpilates.com` (Value provided by Brevo)
     - **DMARC Record (TXT):** `v=DMARC1; p=none; sp=none; rua=mailto:dmarc@plashpilates.com`
  4. Click **Verify Domain** in Brevo until all 3 green checkmarks appear.
  5. In Supabase Dashboard under **Authentication > Email Settings**, set **Sender Email** to `studio@plashpilates.com` and **Sender Name** to `Plash Pilates Studio`.

---

## 4. Production Deployment & Server Environment

### Environment Variables Template (`.env`):
```env
# Node.js Runtime
NODE_ENV=production
PORT=3333

# Supabase Cloud Database & Authentication
SUPABASE_URL=https://ylabdaulbstmhvyzipyd.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Razorpay Live Merchant Credentials
RAZORPAY_KEY_ID=rzp_live_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET

# Staging Flag (Keep false in production)
ALLOW_TEST_PAYMENTS_IN_PROD=false
```

### Process Management (PM2 / Systemd):
To run `server.cjs` as a resilient production daemon:
```bash
# Install PM2 globally
npm install -g pm2

# Start server with auto-restart and cluster mode
pm2 start server.cjs --name "plash-pilates" --time

# Configure system startup script
pm2 startup
pm2 save
```

### Reverse Proxy & SSL (Nginx):
```nginx
server {
    listen 80;
    server_name plashpilates.com www.plashpilates.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name plashpilates.com www.plashpilates.com;

    ssl_certificate /etc/letsencrypt/live/plashpilates.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/plashpilates.com/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 5. Security & Maintenance Playbook

1. **Secret Rotation Procedure:**
   - If `SUPABASE_SERVICE_ROLE_KEY` or `RAZORPAY_KEY_SECRET` is ever compromised:
     - Generate replacement secret in the respective cloud dashboard.
     - Update production `.env`.
     - Execute `pm2 restart plash-pilates`.
     - Verify API responses with `tests/test_suite_d_remediation.cjs`.
2. **Database Backup:**
   - Daily automated logical backups are maintained natively in Supabase Cloud under **Database > Backups**.
   - For manual export: `supabase db dump -f plash_backup.sql`.
3. **Emergency Class Cancellation:**
   - Administrators and service roles can cancel any session regardless of the 4-hour window using the Studio Admin overview (`#/admin/bookings`).
4. **GST Tax Compliance:**
   - All invoices are rendered with inclusive 18% GST (CGST 9% + SGST 9%) under studio GSTIN `29ABIFP5917A1Z7` in Karnataka (State Code: 29).
