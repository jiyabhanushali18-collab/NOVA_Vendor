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
const LOCAL_AUTH_PROFILE_KEY = 'nova-local-auth-profile';

const readLocalProfile = () => {
  try {
    const value = window.localStorage.getItem(LOCAL_AUTH_PROFILE_KEY);
    return value ? JSON.parse(value) as ProfileInfo : null;
  } catch {
    return null;
  }
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
};

const keyLooksLikePrice = (key: string) => {
  const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
  return normalizedKey.includes('price')
    || normalizedKey.includes('mrp')
    || normalizedKey.includes('amount')
    || normalizedKey.includes('cost')
    || normalizedKey.includes('rate');
};

const readFirstPositiveNumber = (value: unknown): number => {
  const directNumber = readNumber(value);
  if (directNumber > 0) {
    return directNumber;
  }

  if (!value || typeof value !== 'object') {
    return 0;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedNumber = readFirstPositiveNumber(item);
      if (nestedNumber > 0) {
        return nestedNumber;
      }
    }

    return 0;
  }

  for (const fieldValue of Object.values(value)) {
    const nestedNumber = readFirstPositiveNumber(fieldValue);
    if (nestedNumber > 0) {
      return nestedNumber;
    }
  }

  return 0;
};

const readNestedPrice = (value: unknown): number => {
  if (!value || typeof value !== 'object') {
    return 0;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedPrice = readNestedPrice(item);
      if (nestedPrice > 0) {
        return nestedPrice;
      }
    }

    return 0;
  }

  for (const [key, fieldValue] of Object.entries(value)) {
    if (keyLooksLikePrice(key)) {
      const price = readFirstPositiveNumber(fieldValue);
      if (price > 0) {
        return price;
      }
    }

    if (fieldValue && typeof fieldValue === 'object') {
      const nestedPrice = readNestedPrice(fieldValue);
      if (nestedPrice > 0) {
        return nestedPrice;
      }
    }
  }

  return 0;
};

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

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
        const localProfile = readLocalProfile();
        if (localProfile) {
          setProfileInfo(localProfile);
        }
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
          const price = readNumber(
            data.price,
            data.sellingPrice,
            data.salePrice,
            data.retailPrice,
            data.mrp,
            data.MRP,
            data.priceInRupees,
            data.amount
          ) || readNestedPrice(data);
          const stock = readNumber(data.stock, data.quantity, data.availableStock, data.units);
          const rating = readNumber(data.rating, data.averageRating, data.avgRating, data.productRating);
          const ratingCount = readNumber(data.ratingCount, data.reviewCount, data.reviewsCount, data.totalReviews);
          const arTryOnRating = readNumber(data.arTryOnRating, data.arRating, data.tryOnRating, data.arTryOn?.rating);
          const arTryOnRatingCount = readNumber(
            data.arTryOnRatingCount,
            data.arRatingCount,
            data.tryOnRatingCount,
            data.arTryOn?.ratingCount
          );
          const reviews = Array.isArray(data.reviews) ? data.reviews : [];

          return {
            id: doc.id,
            name: readString(data.name, data.productName, data.title),
            brand: readString(data.brand, data.companyName, data.vendorName) || 'Unbranded',
            category: readString(data.category, data.productCategory, data.type) || 'Uncategorized',
            price,
            stock,
            color: readString(data.color, data.colour),
            description: readString(data.description, data.details),
            imageUrl: readString(data.imageUrl, data.image, data.photoUrl, data.thumbnailUrl)
              || `https://ui-avatars.com/api/?name=${encodeURIComponent(readString(data.name, data.productName, data.title) || 'Product')}&background=e2d9ff&color=451ebb&bold=true`,
            status: stock > 0 ? (stock < 5 ? 'Low Stock' : 'In Stock') : 'Out of Stock',
            frameShape: data.frameShape,
            material: data.material,
            gender: data.gender,
            sku: readString(data.sku, data.vendorId, data.productId),
            faceShapes: data.faceShapes || [],
            rating,
            ratingCount,
            arTryOnRating,
            arTryOnRatingCount,
            reviews
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

  // Realtime reviews listener — keeps product ratings & reviews in sync
  useEffect(() => {
    if (!isLoggedIn) return;

    let unsubscribe: (() => void) | undefined;

    const listenReviews = async () => {
      try {
        const { collection, onSnapshot } = await import('firebase/firestore');
        const { db } = await import('./firebase');

        const reviewsCol = collection(db, 'reviews');
        unsubscribe = onSnapshot(reviewsCol, (snapshot) => {
          const byProduct: Record<string, any[]> = {};
          snapshot.docs.forEach(doc => {
            const d = doc.data() as any;
            const pid = d.productId || d.product || 'unknown';
            if (!byProduct[pid]) byProduct[pid] = [];
            byProduct[pid].push({ id: doc.id, ...d });
          });

          // compute aggregates and merge into products
          setProducts(prev => prev.map(p => {
            const reviews = byProduct[p.id] || [];
            const ratingSum = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0);
            const arSum = reviews.reduce((s, r) => s + ((r.arTryOn ? Number(r.arRating || 0) : 0) || 0), 0);
            const ratingCount = reviews.filter(r => Number(r.rating) > 0).length;
            const arCount = reviews.filter(r => r.arTryOn && Number(r.arRating) > 0).length;

            return {
              ...p,
              reviews: reviews as any,
              rating: ratingCount ? +(ratingSum / ratingCount).toFixed(2) : 0,
              ratingCount,
              arTryOnRating: arCount ? +(arSum / arCount).toFixed(2) : 0,
              arTryOnRatingCount: arCount
            } as Product;
          }));
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to listen to reviews', err);
      }
    };

    listenReviews();

    return () => unsubscribe && unsubscribe();
  }, [isLoggedIn]);

  const handleLoginSuccess = (email: string, profile?: ProfileInfo) => {
    if (profile) {
      setProfileInfo(profile);
    } else {
      const localProfile = readLocalProfile();
      if (localProfile) {
        setProfileInfo(localProfile);
      }
    }

    setIsLoggedIn(true);
    // Add dynamic activity indicating login
    setActivities(prev => [
      {
        id: 'login-' + Date.now(),
        type: 'verification',
        title: 'Partner Signed In',
        description: `Successfully signed in as ${profile?.ownerName ?? readLocalProfile()?.ownerName ?? email}`,
        time: 'Just now'
      },
      ...prev
    ]);
  };

  // Submit a review to Firestore (realtime)
  const handleSubmitReview = async (productId: string, payload: { rating: number; comment?: string; author?: string; arTryOn?: boolean; arRating?: number; }) => {
    try {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      const reviewsCol = collection(db, 'reviews');
      await addDoc(reviewsCol, {
        productId,
        rating: payload.rating || 0,
        comment: payload.comment || '',
        author: payload.author || 'Anonymous',
        arTryOn: !!payload.arTryOn,
        arRating: payload.arRating || 0,
        createdAt: serverTimestamp()
      });
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to submit review', err);
      return false;
    }
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
    window.localStorage.removeItem(LOCAL_AUTH_PROFILE_KEY);
    window.sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
    setIsLoggedIn(false);
    setActiveTab('dashboard');
  };

  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    const id = newProd.name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 100);
    const completedProduct: Product = {
      ...newProd,
      id,
      rating: newProd.rating ?? 0,
      ratingCount: newProd.ratingCount ?? 0,
      arTryOnRating: newProd.arTryOnRating ?? 0,
      arTryOnRatingCount: newProd.arTryOnRatingCount ?? 0,
      reviews: newProd.reviews ?? []
    };
    
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
              onSubmitReview={handleSubmitReview}
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
