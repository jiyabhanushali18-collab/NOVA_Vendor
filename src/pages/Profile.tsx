import React, { useState } from 'react';
import { 
  Building, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Save, 
  Calendar,
  Sparkles,
  Camera,
  Layers
} from 'lucide-react';
import { ProfileInfo } from '../types';

interface ProfileProps {
  profileInfo: ProfileInfo;
  setProfileInfo: React.Dispatch<React.SetStateAction<ProfileInfo>>;
}

export default function Profile({ profileInfo, setProfileInfo }: ProfileProps) {
  // Local form state mapped precisely to the ProfileInfo type in src/types.ts
  const [storeName, setStoreName] = useState(profileInfo.storeName);
  const [ownerName, setOwnerName] = useState(profileInfo.ownerName);
  const [gstNumber, setGstNumber] = useState(profileInfo.gstNumber);
  const [contactDetails, setContactDetails] = useState(profileInfo.contactDetails);
  const [businessAddress, setBusinessAddress] = useState(profileInfo.businessAddress);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // default banner image
  const defaultBannerUrl = 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=1200&q=80';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    setTimeout(() => {
      setIsSaving(false);
      setIsSaved(true);

      // Save to global state cleanly
      setProfileInfo(prev => ({
        ...prev,
        storeName,
        ownerName,
        gstNumber,
        contactDetails,
        businessAddress
      }));

      setTimeout(() => {
        setIsSaved(false);
      }, 2000);
    }, 1500);
  };

  return (
    <div className="max-w-[1000px] mx-auto pb-32 select-none font-sans animate-fadeIn">
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Banner with Profile Picture Overlay */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
          {/* Banner cover */}
          <div className="h-44 w-full relative">
            <img 
              alt="Profile banner" 
              className="w-full h-full object-cover select-none" 
              src={defaultBannerUrl}
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-slate-900/10 pointer-events-none" />
            <button 
              type="button" 
              onClick={() => alert("Banner upload is disabled in preview. Recommended layout: 1200x400px")}
              className="absolute right-4 top-4 p-2.5 bg-white/70 backdrop-blur-md rounded-xl hover:bg-white text-slate-705 transition-colors shadow-sm cursor-pointer border border-slate-200/40"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Profile Image & Meta */}
          <div className="px-6 pb-6 pt-16 relative flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            {/* Float Logo Circle */}
            <div className="absolute -top-12 left-6 w-24 h-24 rounded-2xl bg-white border-2 border-slate-200 overflow-hidden shadow-lg p-0.5 group">
              <img 
                alt="Store Logo" 
                className="w-full h-full object-cover rounded-2xl" 
                src={profileInfo.logoUrl}
                referrerPolicy="no-referrer"
              />
              <button 
                type="button"
                onClick={() => alert("Logo upload is disabled in preview. Recommended size: 300x300px")}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="font-display text-xl font-bold text-slate-805">{storeName}</h3>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-[10px] font-black text-emerald-600 rounded-full border border-emerald-100 uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{profileInfo.status}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined NOVA Network: {profileInfo.memberSince}</span>
              </p>
            </div>

            <button 
              type="submit" 
              disabled={isSaving || isSaved}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-display font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isSaved 
                  ? 'bg-emerald-500 shadow-emerald-500/10 text-white' 
                  : 'bg-primary hover:bg-secondary text-white shadow-primary/10 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save Profile'}</span>
            </button>
          </div>
        </div>

        {/* Form panel breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info Blocks */}
          <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-slate-200/50 md:col-span-2 space-y-6">
            <h4 className="font-display text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
              Corporate Details
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                <label className="font-display text-[10px] font-bold text-slate-400 uppercase tracking-wider">STORE NAME</label>
                <div className="relative group">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl outline-none text-xs font-semibold text-slate-705 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                <label className="font-display text-[10px] font-bold text-slate-400 uppercase tracking-wider">OWNER / HEAD REPRESENTATIVE</label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl outline-none text-xs font-semibold text-slate-705 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                <label className="font-display text-[10px] font-bold text-slate-400 uppercase tracking-wider">GSTIN / TAX IDENTIFIER</label>
                <div className="relative group">
                  <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    value={gstNumber}
                    onChange={e => setGstNumber(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl outline-none text-xs font-semibold text-slate-705 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                <label className="font-display text-[10px] font-bold text-slate-400 uppercase tracking-wider">CONTACT GENERAL DETAILS</label>
                <div className="relative group">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    value={contactDetails}
                    onChange={e => setContactDetails(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl outline-none text-xs font-semibold text-slate-705 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="font-display text-[10px] font-bold text-slate-400 uppercase tracking-wider">PHYSICAL REGISTERED ADDRESS</label>
                <div className="relative group">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    value={businessAddress}
                    onChange={e => setBusinessAddress(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl outline-none text-xs font-semibold text-slate-705 transition-all"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick instructions bio sidebar panel */}
          <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-slate-200/50 flex flex-col justify-between">
            <div className="space-y-4">
              <h4 className="font-display text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
                Supply Philosophy
              </h4>
              <p className="text-xs text-slate-450 leading-relaxed font-semibold">
                This verification card represents your authority to distribute custom optical styles on our secure nodes. To modify banking routes or core ownership credentials, please submit an official partnership update ticker to our admin workspace.
              </p>
            </div>

            <div className="bg-primary/5 rounded-xl border border-primary/10 p-4 font-semibold text-[11px] text-primary mt-6">
              💡 Keep your GSTIN and Business Address exactly synchronized with state registries to prevent cold-starts.
            </div>
          </div>
        </div>

        {/* Global Security partner policy */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 mix-blend-overlay" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="p-3.5 bg-white/10 rounded-xl border border-white/15 text-accent-fixed">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h5 className="font-display text-sm font-bold">Encrypted Partner Link</h5>
              <p className="text-xs text-slate-400 max-w-lg mt-0.5 font-medium leading-relaxed">
                Your connection to the NOVA Global Optical Network utilizes enterprise-grade optical verification channels to secure supply inventories and payment nodes.
              </p>
            </div>
          </div>
          <span className="relative z-10 text-[10px] uppercase font-bold tracking-widest text-slate-400 border border-slate-700/55 rounded-xl px-4 py-2 bg-slate-950/60 font-mono">
            NODE_STATE: SHIELDED
          </span>
        </div>

      </form>
    </div>
  );
}
