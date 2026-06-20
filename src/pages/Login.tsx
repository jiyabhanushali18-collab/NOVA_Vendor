import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Globe, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess: (email: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('name@company.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      
      setTimeout(() => {
        onLoginSuccess(email);
      }, 800);
    }, 1200);
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
              Sign in to manage your precision optics store
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

            {/* Keep Signed In toggle */}
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer group">
                <input type="checkbox" className="sr-only peer" defaultChecked />
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
                  <span>Login to Portal</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
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
