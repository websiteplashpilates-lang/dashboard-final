---
name: lock-razorpay
description: Permanent zero-touch lock on Razorpay gateway and payment fulfillment pipeline
---

# STRICT CODE LOCK: RAZORPAY & PAYMENT PIPELINE

## 1. Zero Modification Rule
DO NOT modify, edit, touch, delete, or refactor any Razorpay or payment-related code across the entire codebase. This includes:
- `POST /api/create-razorpay-order`
- `POST /api/verify-and-fulfill-payment`
- `POST /api/webhooks/razorpay`
- `syncAllRazorpayPaymentsToSupabase`
- `fulfillVerifiedPayment`
- `sendPaymentReceiptEmail`
- Razorpay modal checkout in `js/pages/portal/cart.js`

**ONLY EXCEPTION**: User explicitly says `"UNLOCK RAZORPAY"`.

## 2. Minimal Edit Rule
Only make edits strictly requested by the user. Do not touch or modify other parts of the system.
