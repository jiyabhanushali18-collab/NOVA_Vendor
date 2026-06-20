import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { initialProducts, initialOrders, initialActivities, initialProfile } from './store';
import { Product, Order, Activity, ProfileInfo } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import AddProduct from './pages/AddProduct';
import Orders from './pages/Orders';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const LOCAL_AUTH_SESSION_KEY = 'nova-local-auth-session';
const LOCAL_AUTH_REMEMBER_KEY = 'nova-local-auth-remember';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const rememberedLocalSession = window.localStorage.getItem(LOCAL_AUTH_REMEMBER_KEY) === 'true';

    if (!rememberedLocalSession) {
      window.localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const hasLocalSession = !!window.sessionStorage.getItem(LOCAL_AUTH_SESSION_KEY)
        || (rememberedLocalSession && !!window.localStorage.getItem(LOCAL_AUTH_SESSION_KEY));

      if (user || hasLocalSession) {
        setIsLoggedIn(true);
        return;
      }

      setIsLoggedIn(false);
    });
    return unsubscribe;
  }, []);

  // Core application lists
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo>(initialProfile);

  // State to support editing products within AddProduct screen
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;

    // Load products from Firestore when user is signed in
    const loadProducts = async () => {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        const q = collection(db, 'products');
        const snapshot = await getDocs(q);
        const items: Product[] = snapshot.docs.map(doc => {
          const data: any = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            brand: data.brand || '',
            category: data.category || 'Uncategorized',
            price: Number(data.price) || 0,
            stock: Number(data.stock) || 0,
            color: data.color || '',
            description: data.description || '',
            imageUrl: data.imageUrl || '',
            status: (Number(data.stock) > 0) ? (Number(data.stock) < 5 ? 'Low Stock' : 'In Stock') : 'Out of Stock',
            frameShape: data.frameShape,
            material: data.material,
            gender: data.gender,
            sku: data.sku,
            faceShapes: data.faceShapes || []
          } as Product;
        });
        setProducts(items);
      } catch (err) {
        // keep app running even if Firestore read fails
        // eslint-disable-next-line no-console
        console.error('Failed to load products from Firestore', err);
      }
    };

    loadProducts();
  }, [isLoggedIn]);

  const handleLoginSuccess = (email: string) => {
    setIsLoggedIn(true);
    // Add dynamic activity indicating login
    setActivities(prev => [
      {
        id: 'login-' + Date.now(),
        type: 'verification',
        title: 'Partner Signed In',
        description: `Successfully signed in as Alexander Vance`,
        time: 'Just now'
      },
      ...prev
    ]);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Logout failed', err);
    }
    window.localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
    window.localStorage.removeItem(LOCAL_AUTH_REMEMBER_KEY);
    window.sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
    setIsLoggedIn(false);
    setActiveTab('dashboard');
  };

  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    const id = newProd.name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 100);
    const completedProduct: Product = { ...newProd, id };
    
    // Add to list
    setProducts(prev => [completedProduct, ...prev]);

    // Create activity
    setActivities(prev => [
      {
        id: 'prod-' + Date.now(),
        type: 'inventory',
        title: 'New Product Added',
        description: `${newProd.brand} ${newProd.name} (${newProd.stock} Units Added)`,
        time: 'Just now'
      },
      ...prev
    ]);
  };

  const handleUpdateProduct = (updatedProd: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProd.id ? updatedProd : p));
    setEditingProduct(null);

    // Create activity
    setActivities(prev => [
      {
        id: 'prod-up-' + Date.now(),
        type: 'inventory',
        title: 'Product Updated',
        description: `${updatedProd.name} specification refined`,
        time: 'Just now'
      },
      ...prev
    ]);
  };

  const handleEditTrigger = (prod: Product) => {
    setEditingProduct(prod);
    setActiveTab('addProduct');
  };

  // Switch tabs instantly but reset editing states
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (tab !== 'addProduct') {
      setEditingProduct(null);
    }
  };

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 font-sans flex antialiased">
      {/* 2D Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-primary/3 rounded-full blur-[100px] opacity-60" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/3 rounded-full blur-[120px] opacity-60" />
      </div>

      {/* Responsive drawer mobile container backdrop overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 cursor-pointer"
          />
        )}
      </AnimatePresence>

      {/* Responsive mobile nav sidebar drawer */}
      <div className={`md:hidden fixed top-0 bottom-0 left-0 w-72 bg-slate-50 z-50 border-r border-slate-205 shadow-2xl transition-transform duration-300 flex flex-col p-6 rounded-r-2xl ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex justify-between items-center mb-8">
          <span className="font-display text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-primary to-secondary select-none tracking-tight">
            NOVA
          </span>
          <button 
            type="button" 
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 hover:bg-slate-200/50 rounded-full text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile menu listings */}
        <nav className="flex flex-col gap-2">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'products', label: 'Products' },
            { id: 'addProduct', label: 'Add Product' },
            { id: 'orders', label: 'Orders' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'profile', label: 'Profile' },
            { id: 'settings', label: 'Settings' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === item.id 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-slate-550 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button 
          onClick={handleLogout}
          className="mt-auto px-4 py-3 w-full text-left font-bold text-sm text-rose-500 hover:bg-rose-50 rounded-xl transition"
        >
          Sign Out of Portal
        </button>
      </div>

      {/* Desktop Sidebar Layout */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
      />

      {/* Content wrapper */}
      <div className="flex-1 flex flex-col md:pl-72 min-w-0 z-10">
        <Header 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          isLoggedIn={isLoggedIn} 
          profileInfo={profileInfo}
          onMenuClick={() => setMobileMenuOpen(true)}
        />

        {/* Dynamic page container */}
        <main className="flex-grow p-6 md:p-10 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard 
              products={products}
              orders={orders}
              activities={activities}
              profileInfo={profileInfo}
              setActiveTab={handleTabChange}
            />
          )}

          {activeTab === 'products' && (
            <Products 
              products={products}
              setProducts={setProducts}
              setActiveTab={handleTabChange}
              onEditProduct={handleEditTrigger}
            />
          )}

          {activeTab === 'addProduct' && (
            <AddProduct 
              onAddProduct={handleAddProduct}
              setActiveTab={handleTabChange}
              editingProduct={editingProduct}
              onUpdateProduct={handleUpdateProduct}
            />
          )}

          {activeTab === 'orders' && (
            <Orders 
              orders={orders}
              setOrders={setOrders}
            />
          )}

          {activeTab === 'analytics' && (
            <Analytics />
          )}

          {activeTab === 'profile' && (
            <Profile 
              profileInfo={profileInfo}
              setProfileInfo={setProfileInfo}
            />
          )}

          {activeTab === 'settings' && (
            <Settings />
          )}
        </main>

        {/* Mobile bottom nav helper */}
        <BottomNav 
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          isLoggedIn={isLoggedIn}
        />
      </div>
    </div>
  );
}
