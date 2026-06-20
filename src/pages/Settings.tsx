import React, { useState } from 'react';
import { 
  Bell, 
  ShieldCheck, 
  Key, 
  Sliders, 
  Copy, 
  Eye, 
  EyeOff, 
  Check, 
  Lock,
  Sparkles
} from 'lucide-react';

export default function Settings() {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  
  // Settings switches states
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [stockWarnings, setStockWarnings] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState(true);
  const [mfa, setMfa] = useState(false);

  const mockApiKey = "nova_partner_api_key_88b193fac2a10";

  const handleCopy = () => {
    navigator.clipboard.writeText(mockApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2050);
  };

  return (
    <div className="max-w-[800px] mx-auto pb-32 select-none font-sans space-y-6 animate-fadeIn">
      
      {/* Alert Notification Card */}
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-3">
          <Bell className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-display font-bold text-slate-805 text-sm">System Notifications</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Control which channel events trigger browser notifications</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-2">
            <div>
              <p className="text-xs font-bold text-slate-700">Order Placed Ticker</p>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Receive immediate screen audio/ping when a client places orders</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={orderAlerts} onChange={() => setOrderAlerts(!orderAlerts)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-primary transition-colors" />
            </label>
          </div>

          <div className="flex justify-between items-center py-2">
            <div>
              <p className="text-xs font-bold text-slate-700">Low Stock Warnings</p>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Get flags daily when product inventory levels fall under 30 units</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={stockWarnings} onChange={() => setStockWarnings(!stockWarnings)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-primary transition-colors" />
            </label>
          </div>

          <div className="flex justify-between items-center py-2">
            <div>
              <p className="text-xs font-bold text-slate-700">AI Market Trend Alerts</p>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Authorize real-time smart predictions based on current localized search habits</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={aiAnalysis} onChange={() => setAiAnalysis(!aiAnalysis)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-primary transition-colors" />
            </label>
          </div>
        </div>
      </div>

      {/* Security MFA keys */}
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-display font-bold text-slate-805 text-sm">Security &amp; Gateways</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Encrypt authentication sessions to guard proprietary product catalogs</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-2">
            <div>
              <p className="text-xs font-bold text-slate-700">Two-Factor Authentication (2FA)</p>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Enforce phone code challenges when accessing from non-listed IPs</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={mfa} onChange={() => setMfa(!mfa)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-primary transition-colors" />
            </label>
          </div>
        </div>
      </div>

      {/* Connected Partner API Keys */}
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-3">
          <Key className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-display font-bold text-slate-805 text-sm">Connected API Integration</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Utilize the partner token to sync product details automatically into peripheral apps</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-[10px] font-bold text-slate-400 font-display tracking-wider uppercase">PARTNER API TOKEN</label>
          <div className="relative flex items-center bg-white/40 border border-slate-205 rounded-xl h-11 px-3">
            <Lock className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              className="bg-transparent border-none text-xs font-mono font-bold text-slate-600 focus:outline-none w-full select-all outline-none"
              type={showKey ? "text" : "password"} 
              value={mockApiKey}
              readOnly
            />
            
            <div className="flex items-center gap-1.5 ml-2">
              <button 
                onClick={() => setShowKey(!showKey)}
                className="p-1.5 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                title={showKey ? "Hide Token" : "Show Token"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button 
                onClick={handleCopy}
                className="p-1.5 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer relative"
                title="Copy Token"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-[10px] font-semibold text-slate-400">
            Keep this key completely private. Sharing triggers security locks across the network.
          </p>
        </div>
      </div>

      {/* Theme Preference Note - Exquisite Slate defaults */}
      <div className="bg-white/65 hover:bg-white border border-slate-250 p-6 rounded-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sliders className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h4 className="font-display text-sm font-bold text-slate-800">Slate Calibration Theme</h4>
            <p className="text-[11px] text-slate-450 leading-relaxed font-medium mt-0.5">
              NOVA uses the highly-contrastive Slate Theme specifically designed to neutralize strain under standard fluorescent clinic screens.
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-black text-primary bg-primary/5 px-3 py-1 rounded-full shrink-0 select-none border border-primary/10">
          ACTIVE
        </span>
      </div>

    </div>
  );
}
