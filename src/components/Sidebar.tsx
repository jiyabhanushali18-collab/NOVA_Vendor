import { 
  LayoutDashboard, 
  Package, 
  PlusCircle, 
  ShoppingCart, 
  BarChart3, 
  UserCircle, 
  Settings,
  Boxes
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isLoggedIn: boolean;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, isLoggedIn, onLogout }: SidebarProps) {
  if (!isLoggedIn) return null;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'addProduct', label: 'Add Product', icon: PlusCircle },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: UserCircle },
  ];

  return (
    <aside id="nav-sidebar" className="hidden md:flex h-screen w-72 fixed left-0 top-0 rounded-r-xl bg-slate-50/70 backdrop-blur-2xl border-r border-white/50 shadow-[20px_0_40px_rgba(46,16,101,0.04)] flex flex-col p-8 gap-2 z-50">
      <div className="mb-8 flex items-center justify-between">
        <span className="font-display text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-primary to-secondary select-none tracking-tight">
          NOVA
        </span>
        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
          v4.2
        </span>
      </div>
      
      <nav className="flex flex-col gap-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-display text-base font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-left ${
                isActive
                  ? 'text-primary bg-white/60 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-primary hover:bg-white/40'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-slate-200/50 pt-6">
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-display text-base font-semibold transition-all duration-200 text-left ${
            activeTab === 'settings'
              ? 'text-primary bg-white/60 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-primary hover:bg-white/40'
          }`}
        >
          <Settings className="w-5 h-5 text-slate-400" />
          <span>Settings</span>
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-display text-base font-semibold text-rose-500 hover:bg-rose-50/50 hover:text-rose-600 transition-all duration-200 text-left"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
