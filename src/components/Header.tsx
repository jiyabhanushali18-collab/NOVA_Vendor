import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Search, Bell, Package, ShoppingCart, Check } from 'lucide-react';
import { Order, Product, ProfileInfo } from '../types';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isLoggedIn: boolean;
  profileInfo: ProfileInfo;
  onMenuClick: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  products: Product[];
  orders: Order[];
}

interface VendorNotification {
  id: string;
  title: string;
  message: string;
  tab: 'orders' | 'products';
  icon: typeof Package;
}

export default function Header({ 
  activeTab, 
  setActiveTab, 
  isLoggedIn, 
  profileInfo, 
  onMenuClick,
  darkMode,
  onToggleDarkMode,
  products,
  orders
}: HeaderProps) {
  const [headerSearch, setHeaderSearch] = React.useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const storageKey = `nova-vendor-read-notifications-${profileInfo.vendorId || 'default'}`;
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) as string[] : [];
    } catch (error) {
      console.warn('Could not load notification preferences', error);
      return [];
    }
  });

  const notifications = useMemo<VendorNotification[]>(() => [
    ...orders
      .filter(order => order.status === 'Pending')
      .slice(0, 5)
      .map(order => ({
        id: `order-${order.id}`,
        title: 'New order needs attention',
        message: `${order.customerName} · ${order.productName}`,
        tab: 'orders' as const,
        icon: ShoppingCart
      })),
    ...products
      .filter(product => product.stock > 0 && product.stock <= 10)
      .slice(0, 5)
      .map(product => ({
        id: `stock-${product.id}`,
        title: 'Low stock alert',
        message: `${product.name} · ${product.stock} ${product.stock === 1 ? 'unit' : 'units'} left`,
        tab: 'products' as const,
        icon: Package
      }))
  ], [orders, products]);

  const unreadCount = notifications.filter(notification => !readNotificationIds.includes(notification.id)).length;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      setReadNotificationIds(saved ? JSON.parse(saved) as string[] : []);
    } catch (error) {
      console.warn('Could not load notification preferences', error);
      setReadNotificationIds([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !notificationPanelRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen]);

  const markNotificationsRead = (ids: string[]) => {
    const nextReadIds = Array.from(new Set([...readNotificationIds, ...ids]));
    setReadNotificationIds(nextReadIds);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextReadIds));
    } catch (error) {
      console.warn('Could not save notification preferences', error);
    }
  };

  if (!isLoggedIn) return null;

  const avatarFallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileInfo.companyName || profileInfo.storeName || profileInfo.ownerName)}&background=451ebb&color=fff&bold=true`;

  const getPageTitle = () => {
    switch(activeTab) {
      case 'dashboard': return 'NOVA Showroom';
      case 'products': return 'Products';
      case 'addProduct': return 'Add Product';
      case 'orders': return 'Orders';
      case 'analytics': return 'Analytics';
      case 'marketInsights': return 'AI Market Insights';
      case 'profile': return 'Profile';
      case 'settings': return 'Settings';
      default: return 'NOVA Showroom';
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && headerSearch.trim()) {
      import('../services/AnalyticsEventService').then(({ trackProductSearch }) => {
        trackProductSearch(headerSearch.trim(), 5, 'Apparel', profileInfo.vendorId);
      });
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
            value={headerSearch}
            onChange={(e) => setHeaderSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="bg-transparent border-none focus:outline-none text-sm w-44 lg:w-64 placeholder-slate-400 text-slate-700" 
            placeholder="Search products, vendors..." 
            type="text"
          />
        </div>

        {/* Buttons and Avatar */}
        <div className="flex items-center gap-3">
          <ThemeToggle darkMode={darkMode} onToggle={onToggleDarkMode} />
          <div className="relative" ref={notificationPanelRef}>
            <button
              type="button"
              onClick={() => setNotificationsOpen(open => !open)}
              aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
              className="p-2 hover:bg-slate-200/50 active:bg-slate-200 rounded-full transition-all relative"
            >
              <Bell className="w-5 h-5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-rose-500 rounded-full border-2 border-white text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <section
                role="dialog"
                aria-label="Notifications"
                className="vendor-notification-panel absolute right-0 top-full mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Notifications</h2>
                    <p className="text-xs text-slate-500">
                      {unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markNotificationsRead(notifications.map(notification => notification.id))}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length ? notifications.map(notification => {
                    const Icon = notification.icon;
                    const isRead = readNotificationIds.includes(notification.id);
                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => {
                          markNotificationsRead([notification.id]);
                          setNotificationsOpen(false);
                          setActiveTab(notification.tab);
                        }}
                        className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${
                          isRead ? '' : 'bg-primary/[0.04]'
                        }`}
                      >
                        <span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-800">{notification.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{notification.message}</span>
                        </span>
                        {!isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </button>
                    );
                  }) : (
                    <div className="flex flex-col items-center px-6 py-10 text-center">
                      <Check className="h-8 w-8 text-emerald-500" />
                      <p className="mt-2 text-sm font-semibold text-slate-700">No new notifications</p>
                      <p className="mt-1 text-xs text-slate-500">Order and low-stock alerts will show up here.</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
          
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
