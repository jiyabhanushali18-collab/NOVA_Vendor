<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/50c70a86-ef8f-425a-bba2-83177957c212

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Vendor password reset

The vendor sign-in screen uses Firebase Authentication's built-in `sendPasswordResetEmail(auth, email)` flow. No Cloud Functions, mail-provider credentials, or Firestore changes are required. Enable Email/Password sign-in in Firebase Authentication and configure the authorized domains in the Firebase project; Firebase sends the reset email using its configured email templates.

## Customer orders and vendor sales analytics

Customer checkout must call the `placeCustomerOrder` callable in `us-central1` rather than writing directly to the `orders` collection. Send only product IDs and quantities; the function verifies each product against Firestore and calculates vendor IDs, images, unit prices, and totals on the server:

```ts
const checkout = httpsCallable(getFunctions(app, 'us-central1'), 'placeCustomerOrder');
const result = await checkout({
  idempotencyKey: checkoutAttemptId,
  items: cart.map(item => ({ productId: item.productId, quantity: item.quantity }))
});
```

Create and persist `checkoutAttemptId` once when checkout starts, reuse it for retries, and clear it only after confirmation. A successful result contains `orderId`; show confirmation only after the callable resolves. The idempotency key makes repeated calls for the same checkout return the existing order instead of decrementing stock or counting sales again.

The callable stores order lines in `orders/{orderId}` and the customer-to-order link in `customerOrders/{customerId}/orders/{orderId}`. Customer IDs are kept out of the vendor-readable order document. `aggregateOrderSales` maintains transaction-safe all-time and daily documents under `vendorSales/{vendorId}`. Status changes to `Cancelled` remove the order's contribution; `Failed` or unknown statuses are not counted. The vendor Analytics page listens to these documents for Today, Last 7 Days, Last 30 Days, and All Time views.

Deploy the Cloud Functions and the Firestore rules together with `firebase deploy --only functions,firestore:rules`. The rules make sales aggregates read-only to clients, scope vendor reads by the authenticated vendor profile, and prevent direct customer writes to orders. To reprocess existing orders created by the trusted checkout callable, grant a trusted administrator the Firebase Auth custom claim `admin: true` and call `reindexHistoricalSales` repeatedly with the returned `nextCursor` until `complete` is true. Orders from an older client-only checkout are not treated as verified sales until their totals and ownership have been independently reconciled; missing identifiers are never inferred.
