import { Menu, Search, Bell, User } from 'lucide-react';
import { ProfileInfo } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isLoggedIn: boolean;
  profileInfo: ProfileInfo;
  onMenuClick: () => void;
}

export default function Header({ 
  activeTab, 
  setActiveTab, 
  isLoggedIn, 
  profileInfo, 
  onMenuClick 
}: HeaderProps) {
  if (!isLoggedIn) return null;

  const avatarFallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileInfo.companyName || profileInfo.storeName || profileInfo.ownerName)}&background=451ebb&color=fff&bold=true`;

  const getPageTitle = () => {
    switch(activeTab) {
      case 'dashboard': return 'NOVA Showroom';
      case 'products': return 'Products';
      case 'addProduct': return 'Add Product';
      case 'orders': return 'Orders';
      case 'analytics': return 'Analytics';
      case 'profile': return 'Profile';
      case 'settings': return 'Settings';
      default: return 'NOVA Showroom';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-50/70 backdrop-blur-2xl flex justify-between items-center px-6 md:px-10 h-20 w-full border-b border-slate-200/50">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 hover:bg-slate-200/50 active:bg-slate-200 rounded-full transition-all text-primary"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-display text-xl md:text-2xl font-bold text-primary truncate">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        {/* Search Bar */}
        <div className="hidden sm:flex items-center bg-white/40 border border-slate-200/40 rounded-full px-4 py-1.5 focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary transition-shadow">
          <Search className="text-slate-400 w-4 h-4 mr-2" />
          <input 
            className="bg-transparent border-none focus:outline-none text-sm w-44 lg:w-64 placeholder-slate-400 text-slate-700" 
            placeholder="Search products, vendors..." 
            type="text"
          />
        </div>

        {/* Buttons and Avatar */}
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-slate-200/50 active:bg-slate-200 rounded-full transition-all relative">
            <Bell className="w-5 h-5 text-slate-500" />
            <span className="absolute top-[6px] right-[6px] w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
          </button>
          
          <div 
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="hidden md:flex flex-col text-right">
              <span className="font-display text-sm font-semibold text-slate-700 group-hover:text-primary transition-colors">
                {profileInfo.ownerName}
              </span>
              <span className="font-sans text-[11px] font-medium text-slate-400 mt-0.5">
                {profileInfo.storeName}
              </span>
            </div>
            
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 transition-all group-hover:border-primary/50 group-active:scale-95 bg-slate-100 flex items-center justify-center">
              <img 
                alt="User profile avatar" 
                className="w-full h-full object-cover" 
                src={profileInfo.logoUrl || avatarFallbackUrl}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src !== avatarFallbackUrl) {
                    img.src = avatarFallbackUrl;
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
