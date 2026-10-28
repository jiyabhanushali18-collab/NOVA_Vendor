import React, { useRef, useState } from 'react';
import { Building, Hash, Mail, Lock, Eye, EyeOff, ShieldCheck, Globe, Loader2, ArrowRight, MapPin, Phone, User, Image as ImageIcon, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../firebase';
import { ProfileInfo } from '../types';
import ThemeToggle from '../components/ThemeToggle';
import {
  createVendorProfile,
  getLocalVendorProfile,
  type VendorSignupData
} from '../services/VendorService';
import { uploadVendorLogo } from '../utils/imageUtils';

interface LoginProps {
  onLoginSuccess: (email: string, profile?: ProfileInfo) => void;
  authProfileError?: string;
  onSwitchAccount: () => Promise<void>;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

type VendorSignupDetails = VendorSignupData & { vendorId: string };

const getAuthErrorCode = (err: unknown) => {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code?: unknown }).code ?? '');
  }
  return '';
};

const getAuthErrorMessage = (err: unknown) => {
  const code = getAuthErrorCode(err);

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Try logging in instead.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'The email or password is incorrect.';
    case 'auth/weak-password':
      return 'Use a password with at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/network-request-failed':
      return 'Firebase could not be reached. Check your connection and try again.';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'Email/password authentication is not enabled in Firebase. Enable it in Firebase Authentication and try again.';
    case 'auth/unauthorized-domain':
    case 'auth/app-not-authorized':
    case 'auth/api-key-not-valid':
      return 'Firebase is not configured for this app URL. Check the Firebase app configuration and authorized domains.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed. Please verify your credentials.';
  }
};

const getPasswordResetErrorMessage = (err: unknown) => {
  const code = getAuthErrorCode(err);

  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'If an account exists for this email, a password reset link will be sent.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a while before trying again.';
    case 'auth/network-request-failed':
      return 'Firebase could not be reached. Check your connection and try again.';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'Password reset is unavailable because Firebase Email/Password authentication is not enabled for this project.';
    case 'auth/unauthorized-domain':
    case 'auth/app-not-authorized':
      return 'This app domain is not authorized in Firebase Authentication.';
    default:
      return 'Could not send the password reset email. Please try again later.';
  }
};

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function Login({ onLoginSuccess, authProfileError, onSwitchAccount, darkMode, onToggleDarkMode }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [resetMessage, setResetMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [vendorDetails, setVendorDetails] = useState<VendorSignupDetails>({
    companyName: '',
    ownerName: '',
    gstNumber: '',
    phoneNumber: '',
    businessAddress: '',
    vendorId: ''
  });
  const [error, setError] = useState('');

  const updateVendorDetails = (field: keyof VendorSignupDetails, value: string) => {
    setVendorDetails(prev => ({ ...prev, [field]: value }));
  };

  const updateLogo = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }

    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      setError('Choose a JPG, PNG, or WebP image for the brand logo.');
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      return;
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setError('Brand logos must be 5 MB or smaller.');
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      return;
    }

    setError('');
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'forgot') {
      setResetMessage('');
      setIsLoading(true);
      try {
        await sendPasswordResetEmail(auth, email.trim());
        setResetMessage('If an account exists for this email, a password reset link has been sent. Please check your inbox.');
      } catch (err) {
        setError(getPasswordResetErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }

    if (mode === 'signup') {
      const { vendorId: _vendorId, ...requiredVendorDetails } = vendorDetails;
      const missingVendorField = Object.values(requiredVendorDetails).some(value => String(value).trim().length === 0);

      if (missingVendorField) {
        setError('Please fill in all vendor credentials.');
        return;
      }

      if (!/^\d{10}$/.test(vendorDetails.phoneNumber)) {
        setError('Enter a valid 10-digit phone number.');
        return;
      }

      if (!GSTIN_PATTERN.test(vendorDetails.gstNumber.trim().toUpperCase())) {
        setError('Enter a valid 15-character GSTIN.');
        return;
      }
    }

    setIsLoading(true);

    try {
      let userEmail = email.trim().toLowerCase();
      let signupProfile: ProfileInfo | undefined;
      await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence);

      if (mode === 'login') {
        const credential = await signInWithEmailAndPassword(auth, userEmail, password);
        userEmail = credential.user.email || userEmail;
        const local = getLocalVendorProfile(credential.user.uid, userEmail);
        if (local) {
          signupProfile = local;
        }
      } else {
        let credential;
        try {
          credential = await createUserWithEmailAndPassword(auth, userEmail, password);
        } catch (createErr) {
          const code = getAuthErrorCode(createErr);
          if (code === 'auth/email-already-in-use') {
            // User already registered in Firebase Auth (e.g. from a prior attempt where logo failed).
            // Attempt to sign in with their password so profile setup can complete.
            try {
              credential = await signInWithEmailAndPassword(auth, userEmail, password);
            } catch (signInErr) {
              const signInCode = getAuthErrorCode(signInErr);
              if (signInCode === 'auth/wrong-password' || signInCode === 'auth/invalid-credential') {
                setError('An account already exists for this email with a different password. Please check your password or switch to Login.');
                setIsLoading(false);
                return;
              }
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }

        userEmail = credential.user.email || userEmail;
        const { vendorId: _vendorId, ...vendorSignupData } = vendorDetails;
        let logoUrl = '';

        if (logoFile) {
          try {
            logoUrl = await uploadVendorLogo(logoFile, credential.user.uid);
          } catch (uploadErr) {
            // eslint-disable-next-line no-console
            console.warn('Fallback to UI avatar for logo', uploadErr);
            logoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(vendorSignupData.companyName || 'Vendor')}&background=451ebb&color=fff&bold=true`;
          }
        }

        const profile = await createVendorProfile(credential.user.uid, userEmail, { ...vendorSignupData, logoUrl });
        setVendorDetails(prev => ({ ...prev, vendorId: profile.vendorId || prev.vendorId }));
        signupProfile = profile;
      }

      setIsSuccess(true);
      onLoginSuccess(userEmail, signupProfile);
      return;
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-10 font-body select-none relative overflow-hidden bg-slate-50">
      <div className="absolute right-5 top-5 z-20">
        <ThemeToggle darkMode={darkMode} onToggle={onToggleDarkMode} />
      </div>
      {/* Dynamic Background Orbs */}
      <div className="absolute w-[400px] h-[400px] rounded-full bg-secondary-fixed filter blur-[80px] opacity-40 top-[-10%] left-[-10%] animate-pulse pointer-events-none" style={{ animationDuration: '8s' }} />
      <div className="absolute w-[300px] h-[300px] rounded-full bg-primary-fixed filter blur-[80px] opacity-40 bottom-[-5%] right-[-5%] animate-pulse pointer-events-none" style={{ animationDuration: '10s' }} />

      <main className="w-full max-w-[480px] z-10 flex flex-col items-center">
        {/* Brand identity */}
        <header className="text-center mb-10">
          <div className="inline-block mb-4 relative drop-shadow-md">
            <div className="absolute inset-x-0 bottom-0 top-1/2 bg-primary blur-2xl opacity-10 rounded-full" />
            <span className="text-primary font-display text-7xl font-extrabold tracking-tight">NOVA</span>
          </div>
          <p className="font-display text-lg font-semibold text-slate-500 tracking-wide">
            See Smarter. Choose Better.
          </p>
        </header>

        {/* glass login card */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full bg-white/70 backdrop-blur-3xl border border-white/50 rounded-2xl p-8 lg:p-10 shadow-[0_20px_40px_rgba(46,16,101,0.04)]"
        >
          <div className="flex flex-col mb-8">
            <h2 className="font-display text-2xl font-bold text-slate-800">
              {mode === 'forgot' ? 'Forgot Password' : 'Vendor Portal'}
            </h2>
            <p className="text-slate-400 font-medium text-sm mt-1">
              {mode === 'forgot'
                ? 'Enter your account email and we will send a password reset link'
                : mode === 'login'
                  ? 'Sign in to manage your product catalog'
                  : 'Create an account to manage your product catalog'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'forgot' ? (
              <>
                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vendor@example.com"
                      required
                      autoComplete="email"
                      className="w-full h-14 pl-12 pr-4 rounded-xl border border-primary/25 bg-white/40 font-medium text-slate-700 placeholder-slate-400 focus:bg-white/60 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-300 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setResetMessage('');
                      setError('');
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Back to login
                  </button>
                </div>
              </>
            ) : (
              <>
            {mode === 'login' && authProfileError && !isLoading && (
              <div className="space-y-2" role="alert">
                <p className="text-sm text-rose-500 font-medium">{authProfileError}</p>
                <button
                  type="button"
                  onClick={onSwitchAccount}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Sign out and use another account
                </button>
              </div>
            )}

            {/* Email field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors duration-200" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full h-14 pl-12 pr-4 rounded-xl border border-primary/25 bg-white/40 font-medium text-slate-700 placeholder-slate-400 focus:bg-white/60 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-300 outline-none"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-end">
                <label htmlFor="password" className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setResetMessage('');
                      setError('');
                    }}
                    className="text-xs font-semibold text-primary hover:text-secondary transition-colors duration-200"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors duration-200" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-14 pl-12 pr-12 rounded-xl border border-primary/25 bg-white/40 font-medium text-slate-700 placeholder-slate-400 focus:bg-white/60 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-300 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 active:scale-90 transition-all"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label htmlFor="companyName" className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Company Name
                  </label>
                  <div className="relative group">
                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors duration-200" />
                    <input
                      id="companyName"
                      type="text"
                      value={vendorDetails.companyName}
                      onChange={(e) => updateVendorDetails('companyName', e.target.value)}
                      placeholder="Enter your company name"
                      maxLength={100}
                      required
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-primary/25 bg-white/40 font-medium text-slate-700 placeholder-slate-400 focus:bg-white/60 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-300 outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label htmlFor="brandLogo" className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Brand Logo
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl border border-primary/25 bg-white/60 overflow-hidden flex items-center justify-center shrink-0">
                      {logoPreviewUrl ? (
                        <img
                          src={logoPreviewUrl}
                          alt="Brand logo preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <label
                      htmlFor="brandLogo"
                      className="h-12 flex-1 px-4 rounded-xl border border-primary/25 bg-white/40 font-semibold text-slate-600 hover:bg-white/70 hover:border-primary transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 text-sm"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="min-w-0 truncate">{logoFile ? logoFile.name : 'Upload logo'}</span>
                    </label>
                    <input
                      ref={logoInputRef}
                      id="brandLogo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => updateLogo(e.target.files)}
                      className="sr-only"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="ownerName" className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Owner Name
                  </label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors duration-200" />
                    <input
                      id="ownerName"
                      type="text"
                      value={vendorDetails.ownerName}
                      onChange={(e) => updateVendorDetails('ownerName', e.target.value)}
                      placeholder="Enter owner name"
                      maxLength={100}
                      required
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-primary/25 bg-white/40 font-medium text-slate-700 placeholder-slate-400 focus:bg-white/60 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-300 outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="vendorId" className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Vendor ID
                  </label>
                  <div className="relative group">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors duration-200" />
                    <input
                      id="vendorId"
                      type="text"
                      value={vendorDetails.vendorId}
                      placeholder="Assigned automatically"
                      readOnly
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-primary/25 bg-slate-100/60 font-medium text-slate-500 placeholder-slate-400 outline-none cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="gstNumber" className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">
                    GST Number
                  </label>
                  <div className="relative group">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors duration-200" />
                    <input
                      id="gstNumber"
                      type="text"
                      value={vendorDetails.gstNumber}
                      onChange={(e) => updateVendorDetails('gstNumber', e.target.value.toUpperCase())}
                      placeholder="27ABCDE1234F1Z5"
                      maxLength={15}
                      minLength={15}
                      pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"
                      title="Enter a valid 15-character GSTIN, for example 27ABCDE1234F1Z5."
                      required
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-primary/25 bg-white/40 font-medium text-slate-700 placeholder-slate-400 focus:bg-white/60 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-300 outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="phoneNumber" className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Phone Number
                  </label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors duration-200" />
                    <input
                      id="phoneNumber"
                      type="tel"
                      value={vendorDetails.phoneNumber}
                      onChange={(e) => updateVendorDetails('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      required
                      aria-describedby="phoneNumber-hint"
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-primary/25 bg-white/40 font-medium text-slate-700 placeholder-slate-400 focus:bg-white/60 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-300 outline-none"
                    />
                  </div>
                  <p id="phoneNumber-hint" className="text-xs font-medium text-slate-500">
                    Enter a 10-digit mobile number.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label htmlFor="businessAddress" className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Business Address
                  </label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors duration-200" />
                    <input
                      id="businessAddress"
                      type="text"
                      value={vendorDetails.businessAddress}
                      onChange={(e) => updateVendorDetails('businessAddress', e.target.value)}
                      placeholder="Mumbai, Maharashtra"
                      maxLength={300}
                      required
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-primary/25 bg-white/40 font-medium text-slate-700 placeholder-slate-400 focus:bg-white/60 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-300 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Keep Signed In toggle */}
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary transition-colors duration-300" />
                <span className="ml-3 text-sm font-semibold text-slate-500 hover:text-slate-700 selection:bg-none transition-colors">
                  Keep me signed in
                </span>
              </label>
            </div>
              </>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className={`w-full h-14 rounded-xl text-white font-semibold font-display flex items-center justify-center gap-2 mt-4 shadow-lg shadow-primary/10 transition-all duration-300 ${
                isSuccess 
                  ? 'bg-emerald-500 shadow-emerald-500/15 scale-[1.02]' 
                  : 'bg-gradient-to-r from-primary to-secondary hover:brightness-110 active:scale-95 hover:shadow-primary/25 cursor-pointer'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isSuccess ? (
                <svg className="w-6 h-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <>
                  <span>
                    {mode === 'forgot'
                      ? 'Send reset email'
                      : mode === 'login'
                        ? 'Login to Portal'
                        : 'Create Account'}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {resetMessage && (
              <p className="text-sm text-emerald-700 font-medium mt-2" role="status">
                {resetMessage}
              </p>
            )}

            {error && (
              <p className="text-sm text-rose-500 font-medium mt-2" role="alert">
                {error}
              </p>
            )}

            {mode !== 'forgot' && <div className="text-center mt-2">
              {mode === 'login' ? (
                <p className="text-sm text-slate-500">
                  New here?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                      setResetMessage('');
                      setIsSuccess(false);
                    }}
                    className="font-bold text-primary hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                      setResetMessage('');
                      setIsSuccess(false);
                    }}
                    className="font-bold text-primary hover:underline"
                  >
                    Log in
                  </button>
                </p>
              )}
            </div>}
          </form>

          {/* Partnership note */}
          {mode !== 'forgot' && <div className="mt-8 pt-6 border-t border-slate-200/50 text-center">
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              New to the network?{' '}
              <a href="#partner" className="text-primary font-bold hover:underline underline-offset-4 decoration-primary/30">
                Apply for Partnership
              </a>
            </p>
          </div>}
        </motion.div>

        {/* Footer info */}
        <footer className="mt-12 flex justify-center items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest pointer-events-none">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>SECURE ENDPOINT</span>
          </div>
          <div className="w-px h-3 bg-slate-300" />
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary-container" />
            <span>GLOBAL NODE V.4.2</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
