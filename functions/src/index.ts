import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();
setGlobalOptions({ region: 'us-central1' });

const sendGridApiKey = defineSecret('SENDGRID_API_KEY');
const hmacKey = defineSecret('PASSWORD_RESET_HMAC_KEY');
const fromEmail = defineString('PASSWORD_RESET_FROM_EMAIL');
const CODE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const MIN_RESEND_INTERVAL_MS = 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_REQUESTS_PER_IP_PER_HOUR = 20;
const LIMIT_TTL_MS = 24 * 60 * 60 * 1000;

const db = getFirestore();

const normalizeEmail = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  return email;
};

const digest = (purpose: string, value: string) =>
  createHmac('sha256', hmacKey.value()).update(`${purpose}:${value}`).digest('hex');

const hashMatches = (expected: string, actual: string) => {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
};

const isUnexpired = (value: unknown, now: number) =>
  value instanceof Timestamp && value.toMillis() > now;

const sendVerificationEmail = async (email: string, code: string) => {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sendGridApiKey.value()}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: fromEmail.value() },
      subject: 'Your NOVA Vendor Portal verification code',
      content: [{
        type: 'text/html',
        value: `<p>Your NOVA Vendor Portal password reset code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request a password reset, you can ignore this email.</p>`
      }]
    })
  });
  if (!response.ok) {
    console.error('SendGrid rejected a password reset email', response.status);
    throw new HttpsError('internal', 'Could not send a verification code. Please try again later.');
  }
};

export const requestVendorPasswordReset = onCall(
  { secrets: [sendGridApiKey, hmacKey] },
  async request => {
    const email = normalizeEmail(request.data?.email);
    const emailHash = digest('email', email);
    const now = Date.now();
    const limitRef = db.collection('passwordResetLimits').doc(emailHash);
    const ipHash = digest('ip', request.rawRequest.ip || 'unknown');
    const ipLimitRef = db.collection('passwordResetIpLimits').doc(ipHash);

    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(limitRef);
      const ipSnapshot = await transaction.get(ipLimitRef);
      const data = snapshot.data();
      const ipData = ipSnapshot.data();
      const windowStart = data?.windowStart instanceof Timestamp ? data.windowStart.toMillis() : 0;
      const requestCount = data?.requestCount ?? 0;
      const lastRequestedAt = data?.lastRequestedAt instanceof Timestamp
        ? data.lastRequestedAt.toMillis()
        : 0;
      const ipWindowStart = ipData?.windowStart instanceof Timestamp
        ? ipData.windowStart.toMillis()
        : 0;
      const ipRequestCount = ipData?.requestCount ?? 0;

      if (now - lastRequestedAt < MIN_RESEND_INTERVAL_MS) {
        throw new HttpsError('resource-exhausted', 'Please wait before requesting another code.');
      }
      if (now - windowStart < 60 * 60 * 1000 && requestCount >= MAX_REQUESTS_PER_HOUR) {
        throw new HttpsError('resource-exhausted', 'Too many code requests. Please try again later.');
      }
      if (now - ipWindowStart < 60 * 60 * 1000 && ipRequestCount >= MAX_REQUESTS_PER_IP_PER_HOUR) {
        throw new HttpsError('resource-exhausted', 'Too many code requests. Please try again later.');
      }

      transaction.set(limitRef, {
        windowStart: now - windowStart < 60 * 60 * 1000 ? data?.windowStart : Timestamp.fromMillis(now),
        requestCount: now - windowStart < 60 * 60 * 1000 ? requestCount + 1 : 1,
        lastRequestedAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + LIMIT_TTL_MS)
      });
      transaction.set(ipLimitRef, {
        windowStart: now - ipWindowStart < 60 * 60 * 1000
          ? ipData?.windowStart
          : Timestamp.fromMillis(now),
        requestCount: now - ipWindowStart < 60 * 60 * 1000 ? ipRequestCount + 1 : 1,
        expiresAt: Timestamp.fromMillis(now + LIMIT_TTL_MS)
      });
    });

    let user;
    try {
      user = await getAuth().getUserByEmail(email);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
        return { sent: true };
      }
      console.error('Could not look up password reset account', error);
      throw new HttpsError('internal', 'Could not process this request. Please try again later.');
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeRef = db.collection('passwordResetCodes').doc(emailHash);
    await codeRef.set({
      uid: user.uid,
      codeHash: digest('code', `${emailHash}:${code}`),
      expiresAt: Timestamp.fromMillis(now + CODE_TTL_MS),
      attempts: 0,
      createdAt: FieldValue.serverTimestamp()
    });

    try {
      await sendVerificationEmail(email, code);
    } catch (error) {
      await codeRef.delete();
      throw error;
    }

    return { sent: true };
  }
);

export const verifyVendorPasswordResetCode = onCall(
  { secrets: [hmacKey] },
  async request => {
    const email = normalizeEmail(request.data?.email);
    const code = request.data?.code;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      throw new HttpsError('invalid-argument', 'Enter the 6-digit verification code.');
    }

    const emailHash = digest('email', email);
    const codeRef = db.collection('passwordResetCodes').doc(emailHash);
    const challengeToken = randomBytes(32).toString('base64url');
    const now = Date.now();
    const isValid = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(codeRef);
      const data = snapshot.data();
      if (!data || !isUnexpired(data.expiresAt, now) || data.attempts >= MAX_CODE_ATTEMPTS) {
        if (data) transaction.delete(codeRef);
        return false;
      }

      const matches = hashMatches(
        data.codeHash,
        digest('code', `${emailHash}:${code}`)
      );
      if (!matches) {
        if (data.attempts + 1 >= MAX_CODE_ATTEMPTS) {
          transaction.delete(codeRef);
        } else {
          transaction.update(codeRef, { attempts: data.attempts + 1 });
        }
        return false;
      }

      transaction.update(codeRef, {
        challengeTokenHash: digest('challenge', `${emailHash}:${challengeToken}`),
        challengeExpiresAt: Timestamp.fromMillis(now + CHALLENGE_TTL_MS),
        expiresAt: Timestamp.fromMillis(now + CHALLENGE_TTL_MS),
        resetClaimed: false
      });
      return true;
    });

    if (!isValid) {
      throw new HttpsError('invalid-argument', 'The code is invalid or expired. Request a new code and try again.');
    }
    return { challengeToken };
  }
);

export const resetVendorPassword = onCall(
  { secrets: [hmacKey] },
  async request => {
    const email = normalizeEmail(request.data?.email);
    const { challengeToken, newPassword } = request.data ?? {};
    if (typeof challengeToken !== 'string' || challengeToken.length < 32) {
      throw new HttpsError('invalid-argument', 'Verify your email code before resetting your password.');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
      throw new HttpsError('invalid-argument', 'Use a password between 6 and 128 characters.');
    }

    const emailHash = digest('email', email);
    const codeRef = db.collection('passwordResetCodes').doc(emailHash);
    const challengeHash = digest('challenge', `${emailHash}:${challengeToken}`);
    const now = Date.now();
    const uid = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(codeRef);
      const data = snapshot.data();
      if (
        !data ||
        data.resetClaimed ||
        !isUnexpired(data.challengeExpiresAt, now) ||
        !hashMatches(data.challengeTokenHash, challengeHash)
      ) {
        throw new HttpsError('failed-precondition', 'Your verification has expired. Request a new code.');
      }
      transaction.update(codeRef, { resetClaimed: true });
      return data.uid as string;
    });

    try {
      await getAuth().updateUser(uid, { password: newPassword });
    } catch (error) {
      await codeRef.update({ resetClaimed: false });
      console.error('Could not update vendor password', error);
      throw new HttpsError('internal', 'Could not reset your password. Please request a new code and try again.');
    }

    try {
      await codeRef.delete();
    } catch (error) {
      console.error('Could not remove consumed password reset code', error);
    }

    return { reset: true };
  }
);
