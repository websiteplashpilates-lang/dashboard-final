# Plash Pilates — Development Guidelines & Strict Locks

## 🔒 ZERO-TOUCH FROZEN SUBSYSTEMS

### 1. Razorpay Payment Gateway & Fulfillment Pipeline
**STATUS: PERMANENTLY LOCKED & FROZEN**

Under NO circumstances may any agent or assistant modify, refactor, rewrite, or alter the following code sections, files, or endpoints without explicit user authorization with the exact phrase `"UNLOCK RAZORPAY"`:

- **Order Creation**: `POST /api/create-razorpay-order` in `server.cjs`
- **Signature & Verification**: `POST /api/verify-and-fulfill-payment` in `server.cjs`
- **Fulfillment Engine**: `fulfillVerifiedPayment` in `server.cjs`
- **Auto-Sync Engine**: `syncAllRazorpayPaymentsToSupabase` in `server.cjs`
- **Razorpay Webhooks**: `POST /api/webhooks/razorpay` in `server.cjs`
- **Client Cart & Checkout Handlers**: `fulfillPayment`, `rzp.open()`, and Razorpay modal options in `js/pages/portal/cart.js`
- **Tax Invoice Email Generator**: `sendPaymentReceiptEmail` in `server.cjs`

### 2. Scope Constraint Rule
- **Explicit Additions Only**: When the user requests a change or addition, ONLY implement the exact change requested.
- **Do Not Touch Working Logic**: Do not refactor, rewrite, reformat, or modify any unrelated working modules or existing business logic.
- **Always Test**: Run `npm test` after any change to verify that all 32 enterprise tests remain 100% green.
