import { LayoutDashboard, Package, ShoppingCart, UserCircle } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isLoggedIn: boolean;
}

export default function BottomNav({ activeTab, setActiveTab, isLoggedIn }: BottomNavProps) {
  if (!isLoggedIn) return null;

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'profile', label: 'Profile', icon: UserCircle },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-2xl flex justify-around items-center z-40 border-t border-slate-200/50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 flex-1 py-2 h-full justify-center transition-colors ${
              isActive ? 'text-primary font-bold' : 'text-slate-400 font-medium'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] tracking-wide">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
