import React, { useEffect, useRef, useState } from 'react';
import { Building, Hash, Mail, Lock, Eye, EyeOff, ShieldCheck, Globe, Loader2, ArrowRight, MapPin, Phone, User, Image as ImageIcon, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from '../firebase';
import { ProfileInfo } from '../types';
import {
  buildProfileFromVendorDetails,
  createVendorProfile,
  getNextVendorId,
  type VendorSignupData
} from '../services/VendorService';

interface LoginProps {
  onLoginSuccess: (email: string, profile?: ProfileInfo) => void;
}

type LocalUser = {
  email: string;
  password: string;
  vendorDetails?: VendorSignupDetails;
};

type VendorSignupDetails = VendorSignupData & { vendorId: string };

const LOCAL_AUTH_USERS_KEY = 'nova-local-auth-users';
const LOCAL_AUTH_SESSION_KEY = 'nova-local-auth-session';
const LOCAL_AUTH_REMEMBER_KEY = 'nova-local-auth-remember';
const LOCAL_AUTH_PROFILE_KEY = 'nova-local-auth-profile';
const DEMO_EMAIL = 'name@company.com';
const DEMO_PASSWORD = 'password123';

const uploadVendorLogo = async (file: File, vendorKey: string) => {
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
  const logoRef = ref(storage, `vendor-logos/${vendorKey}/${Date.now()}-${safeName}`);
  const uploadResult = await Promise.race([
    uploadBytes(logoRef, file),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Logo upload timed out')), 8000);
    })
  ]);

  return getDownloadURL(uploadResult.ref);
};

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
      return 'Firebase could not be reached. Local demo sign in is available.';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'Email/password authentication is not enabled in Firebase. Local demo sign in is available.';
    case 'auth/unauthorized-domain':
    case 'auth/app-not-authorized':
    case 'auth/api-key-not-valid':
      return 'Firebase is not configured for this app URL. Local demo sign in is available.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed. Please verify your credentials.';
  }
};

const readLocalUsers = (): LocalUser[] => {
  try {
    const value = window.localStorage.getItem(LOCAL_AUTH_USERS_KEY);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
};

const writeLocalUsers = (users: LocalUser[]) => {
  window.localStorage.setItem(LOCAL_AUTH_USERS_KEY, JSON.stringify(users));
};

const writeLocalProfile = (profile: ProfileInfo) => {
  window.localStorage.setItem(LOCAL_AUTH_PROFILE_KEY, JSON.stringify(profile));
};

const completeLocalSignIn = (userEmail: string, shouldRemember: boolean) => {
  const sessionStore = shouldRemember ? window.localStorage : window.sessionStorage;

  window.localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
  window.sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
  window.localStorage.setItem(LOCAL_AUTH_REMEMBER_KEY, shouldRemember ? 'true' : 'false');
  sessionStore.setItem(LOCAL_AUTH_SESSION_KEY, userEmail);
  return userEmail;
};

const signInLocally = (userEmail: string, userPassword: string, shouldRemember: boolean) => {
  const normalizedEmail = userEmail.trim().toLowerCase();
  const localUser = readLocalUsers().find(user => user.email === normalizedEmail);

  if (localUser?.password === userPassword || (normalizedEmail === DEMO_EMAIL && userPassword === DEMO_PASSWORD)) {
    if (localUser?.vendorDetails) {
      writeLocalProfile(buildProfileFromVendorDetails(localUser.vendorDetails));
    }
    return completeLocalSignIn(normalizedEmail, shouldRemember);
  }

  throw new Error('The email or password is incorrect.');
};

const signUpLocally = (userEmail: string, userPassword: string, shouldRemember: boolean, vendorDetails: VendorSignupDetails) => {
  const normalizedEmail = userEmail.trim().toLowerCase();
  const users = readLocalUsers();

  if (users.some(user => user.email === normalizedEmail)) {
    throw new Error('An account already exists for this email. Try logging in instead.');
  }

  writeLocalUsers([...users, { email: normalizedEmail, password: userPassword, vendorDetails }]);
  writeLocalProfile(buildProfileFromVendorDetails(vendorDetails));
  return completeLocalSignIn(normalizedEmail, shouldRemember);
};

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('name@company.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [vendorDetails, setVendorDetails] = useState<VendorSignupDetails>({
    companyName: 'Trendy Threads',
    ownerName: 'Rahul Shah',
    gstNumber: '27ABCDE1234F1Z5',
    phoneNumber: '9876543210',
    businessAddress: 'Mumbai, Maharashtra',
    vendorId: 'VEN001'
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (mode !== 'signup') {
      return;
    }

    let cancelled = false;

    getNextVendorId()
      .then(vendorId => {
        if (!cancelled) {
          setVendorDetails(prev => ({ ...prev, vendorId }));
        }
      })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.error('Failed to generate vendor ID from Firestore', err);
      });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const updateVendorDetails = (field: keyof VendorSignupDetails, value: string) => {
    setVendorDetails(prev => ({ ...prev, [field]: value }));
  };

  const updateLogo = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for the brand logo.');
      return;
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

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
    }

    setIsLoading(true);
    let firebaseAccountCreated = false;

    try {
      let userEmail = email.trim().toLowerCase();
      let signupProfile: ProfileInfo | undefined;
      await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence);

      if (mode === 'login') {
        const credential = await signInWithEmailAndPassword(auth, userEmail, password);
        userEmail = credential.user.email || userEmail;
      } else {
        const credential = await createUserWithEmailAndPassword(auth, userEmail, password);
        firebaseAccountCreated = true;
        userEmail = credential.user.email || userEmail;
        const { vendorId: _vendorId, ...vendorSignupData } = vendorDetails;
        let logoUrl = '';

        if (logoFile) {
          try {
            logoUrl = await uploadVendorLogo(logoFile, credential.user.uid);
          } catch (uploadErr) {
            // eslint-disable-next-line no-console
            console.error('Failed to upload vendor logo to Firebase Storage', uploadErr);
            setError('Failed to upload vendor logo. Please try again or choose a different image.');
            setIsLoading(false);
            return;
          }
        }

        const profile = await createVendorProfile(credential.user.uid, userEmail, { ...vendorSignupData, logoUrl });
        setVendorDetails(prev => ({ ...prev, vendorId: profile.vendorId || prev.vendorId }));
        writeLocalProfile(profile);
        signupProfile = profile;
      }

      setIsSuccess(true);
      setTimeout(() => {
        onLoginSuccess(userEmail, signupProfile);
      }, 800);
    } catch (err) {
      if (mode === 'signup' && firebaseAccountCreated) {
        setError('Firebase account was created, but vendor details could not be saved. Check Firestore rules for owner/vendors writes.');
        setIsLoading(false);
        return;
      }

      try {
        const userEmail = mode === 'login'
          ? signInLocally(email, password, keepSignedIn)
          : signUpLocally(email, password, keepSignedIn, vendorDetails);

        setNotice('Using local demo authentication because Firebase rejected the request.');
        setIsSuccess(true);
        setTimeout(() => {
          onLoginSuccess(userEmail, mode === 'signup' ? buildProfileFromVendorDetails(vendorDetails) : undefined);
        }, 800);
      } catch {
        setError(getAuthErrorMessage(err));
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-10 font-body select-none relative overflow-hidden bg-slate-50">
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
              Vendor Portal
            </h2>
            <p className="text-slate-400 font-medium text-sm mt-1">
              {mode === 'login'
                ? 'Sign in to manage your product catalog'
                : 'Create an account to manage your product catalog'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                <a href="#reset" className="text-xs font-semibold text-primary hover:text-secondary transition-colors duration-200">
                  Forgot Password?
                </a>
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
                      placeholder="Trendy Threads"
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
                      accept="image/*"
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
                      placeholder="Rahul Shah"
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
                      placeholder="VEN001"
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
                      onChange={(e) => updateVendorDetails('gstNumber', e.target.value)}
                      placeholder="27ABCDE1234F1Z5"
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
                      onChange={(e) => updateVendorDetails('phoneNumber', e.target.value)}
                      placeholder="9876543210"
                      required
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-primary/25 bg-white/40 font-medium text-slate-700 placeholder-slate-400 focus:bg-white/60 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-300 outline-none"
                    />
                  </div>
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
                  <span>{mode === 'login' ? 'Login to Portal' : 'Create Account'}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {error && (
              <p className="text-sm text-rose-500 font-medium mt-2">
                {error}
              </p>
            )}

            {notice && (
              <p className="text-sm text-emerald-600 font-medium mt-2">
                {notice}
              </p>
            )}

            <div className="text-center mt-2">
              {mode === 'login' ? (
                <p className="text-sm text-slate-500">
                  New here?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                      setNotice('');
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
                      setNotice('');
                      setIsSuccess(false);
                    }}
                    className="font-bold text-primary hover:underline"
                  >
                    Log in
                  </button>
                </p>
              )}
            </div>
          </form>

          {/* Partnership note */}
          <div className="mt-8 pt-6 border-t border-slate-200/50 text-center">
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              New to the network?{' '}
              <a href="#partner" className="text-primary font-bold hover:underline underline-offset-4 decoration-primary/30">
                Apply for Partnership
              </a>
            </p>
          </div>
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
