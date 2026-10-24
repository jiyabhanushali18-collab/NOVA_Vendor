import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../firebase';

const functions = getFunctions(auth.app, 'us-central1');

export const requestVendorPasswordReset = async (email: string) => {
  const requestReset = httpsCallable<{ email: string }, { sent: boolean }>(
    functions,
    'requestVendorPasswordReset'
  );
  await requestReset({ email });
};

export const verifyVendorPasswordResetCode = async (email: string, code: string) => {
  const verifyCode = httpsCallable<
    { email: string; code: string },
    { challengeToken: string }
  >(functions, 'verifyVendorPasswordResetCode');
  const result = await verifyCode({ email, code });
  return result.data;
};

export const resetVendorPassword = async (
  email: string,
  challengeToken: string,
  newPassword: string
) => {
  const resetPassword = httpsCallable<
    { email: string; challengeToken: string; newPassword: string },
    { reset: boolean }
  >(functions, 'resetVendorPassword');
  await resetPassword({ email, challengeToken, newPassword });
};
