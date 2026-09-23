# Plash Pilates Studio — Visual Evidence & Screenshot Index

This index catalogs the 23 visual evidence screenshots captured from the live running application at `http://localhost:3333` using headless Google Chrome automation.

**Evidence Directory:** `docs/evidence/screenshots/` (and mirrored to `docs/screenshots/`)  
**Capture Method:** Puppeteer-Core (`headless: true`) driving Google Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`)  
**Capture Automation Script:** `scratch/capture_all_screens.cjs`  
**Capture Timestamp:** September 19, 2026 between 08:04:10 and 08:05:00 IST (Direct execution)  
**Runtime Server:** Node.js v20.20.1 on port 3333  
**Database Host:** Supabase Cloud PostgreSQL 15 (`ylabdaulbstmhvyzipyd.supabase.co`)  

---

## Provenance & Verification Notice
- Screenshots demonstrate real browser rendering of UI components, form inputs, dynamic state from the live database, and access control route guards.
- **Critical Audit Distinction:** Screenshots verify *UI rendering and browser-level client behavior*. They do NOT, on their own, prove server-side or database-level constraint enforcement. Backend and database constraints are independently validated via API and SQL challenge scripts (`tests/test_suite_d_remediation.cjs`, `scratch/audit_member_jwt_security.cjs`, `scratch/audit_payment_security_deep.cjs`).

---

| # | Screenshot Filename | Feature / View | Route Hash | What It Proves (UI / State) | Status |
| :-: | :--- | :--- | :--- | :--- | :-: |
| 01 | `01-homepage.png` | Public Landing & Login Portal | `#/login` | Branded split-card layout, photography carousel, GoTrue authentication inputs, DPDPA cookie banner. | **PASS** |
| 02 | `02-signup.png` | Member Registration | `#/signup` | Registration form with phone, movement level (Beginner/Intermediate/Advanced), and password complexity. | **PASS** |
| 03 | `03-forgot-password.png` | Password Recovery Modal | `#/forgot-password` | Modal UI for native Supabase email recovery dispatch (zero simulated OTPs). | **PASS** |
| 04 | `04-member-dashboard.png` | Member Dashboard | `#/portal/dashboard` | Active pass, real-time remaining credits (Reformer, Barre, Sculpt Yoga), booking streak. | **PASS** |
| 05 | `05-member-packages.png` | Package Catalog | `#/portal/packages` | Available membership plans, duration, transparent pricing, GST inclusive notation, and "Choose Plan" buttons. | **PASS** |
| 06 | `06-member-book.png` | Class Schedule & Spot Selection | `#/portal/book` | 14-day date strip, discipline filters, live spot availability, and "Book Class" / "Request Barre Spot" buttons. | **PASS** |
| 07 | `07-booking-modal.png` | Barre Booking Request Modal | `#/portal/book` | Specialized Physicq 57 partner review confirmation dialog for high-intensity Barre conditioning classes. | **PASS** |
| 08 | `08-member-bookings.png` | Upcoming Bookings & Cancellation | `#/portal/bookings` | Ledger of member reservations with status badges and cancellation actions (DB-enforced 4h window). | **PASS** |
| 09 | `09-member-cart.png` | Membership Cart & Checkout | `#/portal/cart` | 18% GST tax breakdown (9% CGST + 9% SGST), mandatory DPDPA liability waiver acceptance, and Razorpay gateway trigger. | **PASS** |
| 10 | `10-member-payments.png` | Payment History & Invoices | `#/portal/payments` | Completed payments ledger with Razorpay payment reference IDs, amounts, and tax invoice download buttons. | **PASS** |
| 11 | `11-member-profile.png` | Member Health Profile | `#/portal/profile` | Contact details, emergency contact, movement level, and musculoskeletal injury declarations for instructors. | **PASS** |
| 12 | `12-member-security.png` | Account Security | `#/portal/security` | Password update interface, cryptographic session tokens, and privacy consent management. | **PASS** |
| 13 | `13-security-403.png` | RBAC Security Route Guard | `#/403` | Access restricted denial screen when an authenticated member attempts to browse administrative routes. | **PASS** |
| 14 | `14-admin-overview.png` | Admin Studio Overview | `#/admin/overview` | Studio KPIs: Active memberships, weekly sessions, apparatus utilization %, monthly revenue, and today's schedule. | **PASS** |
| 15 | `15-admin-members.png` | Admin Member Directory | `#/admin/members` | Searchable member roster with phone numbers, medical limitation flags, pass statuses, and waiver audit badges. | **PASS** |
| 16 | `16-admin-schedule.png` | Class Scheduling Matrix | `#/admin/schedule` | Visual 7-day weekly timetable matrix, recurring rules scheduler, and session creator with capacity controls. | **PASS** |
| 17 | `17-admin-packages.png` | Admin Package Manager | `#/admin/packages` | Pass configuration suite for durations, prices, popularity highlights, and discipline credit allotments. | **PASS** |
| 18 | `18-admin-bookings.png` | Admin Bookings Audit Log | `#/admin/bookings` | Real-time audit log of all studio reservations with member names, session apparatus times, and status filters. | **PASS** |
| 19 | `19-trainer-dashboard.png` | Studio Trainer Cockpit | `#/trainer/dashboard` | Scoped instructor view showing today's and tomorrow's assigned batches with live member headcount against the 6-seat cap. | **PASS** |
| 20 | `20-partner-portal.png` | Physicq 57 Partner Portal | `#/partner/requests` | Barre partner coach review queue to approve or decline participant readiness for intense barre sessions. | **PASS** |
| 21 | `21-legal-privacy.png` | DPDPA 2023 Privacy Policy | `#/legal/privacy` | Comprehensive statutory privacy policy aligned with India's Digital Personal Data Protection Act (DPDPA 2023). | **PASS** |
| 22 | `22-legal-terms.png` | Studio Terms & Conditions | `#/legal/terms` | Studio terms, 4-hour cancellation rules, apparatus safety requirements, and member waiver. | **PASS** |
| 23 | `23-reset-password.png` | Set New Password Page | `#/reset-password` | Native Supabase password recovery landing interface with password strength validation and session update. | **PASS** |

