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

The vendor sign-in screen uses Firebase Cloud Functions and SendGrid to send a 6-digit password-reset code. Codes expire after 10 minutes, allow at most five verification attempts, and are rate-limited to one request per minute and five per hour per email address.

Before deploying:

1. Use the Firebase project configured in `src/firebase.ts` and ensure it has the Blaze plan, Firebase Authentication with email/password enabled, and Cloud Firestore enabled.
2. Verify a sender address in SendGrid, then configure the function secrets:
   - `firebase functions:secrets:set SENDGRID_API_KEY`
   - `firebase functions:secrets:set PASSWORD_RESET_HMAC_KEY` (use a long random value generated locally)
3. Deploy from the repository root with `firebase deploy --only functions`. Set `PASSWORD_RESET_FROM_EMAIL` to the verified SendGrid sender when prompted.
4. In Firestore, enable TTL deletion on the `expiresAt` field for the `passwordResetCodes`, `passwordResetLimits`, and `passwordResetIpLimits` collection groups to clean up expired codes and rate-limit records.

Do not put SendGrid or HMAC secrets in frontend environment variables. Until the functions are deployed and configured, the reset workflow cannot send codes or update passwords. Requests are limited per email address and source IP; code entry is limited to five attempts.
