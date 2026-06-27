import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { initialOrders, initialActivities, initialProfile } from './store';
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
import { subscribeToProducts, type ProductDocument } from './services/ProductService';
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

const fetchVendorProfile = async (uid: string): Promise<ProfileInfo | null> => {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    // Fetch current vendor details from Firestore owner collection
    const ownerDoc = await getDoc(doc(db, 'owner', uid));
    if (!ownerDoc.exists()) {
      return null;
    }
    const data = ownerDoc.data() as any;
    return {
      storeName: data.companyName || data.storeName || '',
      companyName: data.companyName || data.storeName || '',
      vendorId: data.vendorId,
      ownerName: data.ownerName || '',
      gstNumber: data.gstNumber || '',
      contactDetails: data.contactDetails || '',
      businessAddress: data.businessAddress || '',
      logoUrl: data.logoUrl || '',
      status: data.status || 'VERIFIED',
      memberSince: data.memberSince || ''
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch vendor profile', err);
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

const readVariantImages = (variants: ProductDocument['variants']) => {
  if (!Array.isArray(variants)) return [];

  const extractFromObject = (obj: any): string[] => {
    if (!obj || typeof obj !== 'object') return [];

    const results: string[] = [];

    // Common array-shaped keys
    const arrayKeys = ['images', 'imageUrls', 'photos', 'media', 'imagesUrl', 'photosUrl'];
    for (const key of arrayKeys) {
      const v = obj[key];
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'string') results.push(item.trim());
          else if (item && typeof item === 'object') {
            const url = item.url || item.src || item.path || item.image;
            if (url && typeof url === 'string') results.push(url.trim());
          }
        }
      }
    }

    // Common single-string keys
    const stringKeys = ['image', 'imageUrl', 'photo', 'thumbnail', 'src'];
    for (const key of stringKeys) {
      const v = obj[key];
      if (typeof v === 'string' && v.trim()) results.push(v.trim());
    }

    return results.filter(Boolean);
  };

  return Array.from(new Set(variants.flatMap(variant => {
    if (!variant) return [];
    if (typeof variant === 'string') return [variant.trim()].filter(Boolean);
    if (Array.isArray(variant)) return variant.map(String).map(s => s.trim()).filter(Boolean);

    return extractFromObject(variant);
  })));
};

const productDocumentToProduct = (product: ProductDocument): Product => {
  const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name || 'Product')}&background=e2d9ff&color=451ebb&bold=true`;
  const images = Array.from(new Set([
    ...(product.images || []),
    ...readVariantImages(product.variants),
    product.imageUrl
  ].filter(Boolean)));

  return {
    id: product.id,
    name: product.name || 'Untitled Product',
    brand: product.brand || product.vendorName || 'Unbranded',
    category: product.category || 'Uncategorized',
    price: product.price,
    stock: product.stock,
    color: product.color,
    colors: product.colors,
    description: product.description,
    imageUrl: product.imageUrl || images[0] || fallbackImage,
    images: images.length ? images : [fallbackImage],
    status: product.stock > 0 ? (product.stock < 5 ? 'Low Stock' : 'In Stock') : 'Out of Stock',
    frameShape: product.frameShape,
    material: product.material,
    gender: product.gender,
    sku: product.sku || product.vendorId,
    vendorId: product.vendorId,
    vendorName: product.vendorName,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    originalPrice: product.originalPrice,
    discountedPrice: product.discountedPrice,
    variants: product.variants as Product['variants']
  };
};

const removeUndefinedFields = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(item => removeUndefinedFields(item)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([fieldKey, fieldValue]) => [fieldKey, removeUndefinedFields(fieldValue)])
  ) as T;
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
        if (user) {
          const vendorProfile = await fetchVendorProfile(user.uid);
          if (vendorProfile) {
            setProfileInfo(vendorProfile);
          }
        } else {
          const localProfile = readLocalProfile();
          if (localProfile) {
            setProfileInfo(localProfile);
          }
        }
        setIsLoggedIn(true);
        return;
      }

      setIsLoggedIn(false);
    });
    return unsubscribe;
  }, []);

  // Core application lists
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo>(initialProfile);
  const pendingProductsRef = useRef<Product[]>([]);

  const matchesCurrentStore = (product: Product) => {
    const currentVendorId = profileInfo.vendorId?.trim();
    const currentVendorName = (profileInfo.companyName || profileInfo.storeName || '').trim().toLowerCase();

    if (currentVendorId && product.vendorId === currentVendorId) {
      return true;
    }

    if (currentVendorName && product.vendorName?.trim().toLowerCase() === currentVendorName) {
      return true;
    }

    return false;
  };

  // State to support editing products within AddProduct screen
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setProducts([]);
      setProductsLoading(false);
      return;
    }

    setProductsLoading(true);

    const unsubscribe = subscribeToProducts(
      firestoreProducts => {
        const mappedProducts = firestoreProducts
          .map(productDocumentToProduct)
          .filter(matchesCurrentStore);
        const pendingProducts = pendingProductsRef.current.filter(pendingProduct =>
          !mappedProducts.some(product => product.id === pendingProduct.id)
        );

        pendingProductsRef.current = pendingProducts;
        setProducts([...pendingProducts, ...mappedProducts]);
        setProductsLoading(false);
      },
      err => {
        setProductsLoading(false);
        // eslint-disable-next-line no-console
        console.error('Failed to subscribe to products from Firestore', err);
      }
    );

    return unsubscribe;
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

  const handleAddProduct = async (newProd: Omit<Product, 'id'>) => {
    const id = newProd.name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 100);
    const vendorId = profileInfo.vendorId || auth.currentUser?.uid || 'VEN-DEMO';
    const vendorName = profileInfo.companyName || profileInfo.storeName;
    const completedProduct: Product = {
      ...newProd,
      id,
      vendorId,
      vendorName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rating: newProd.rating ?? 0,
      ratingCount: newProd.ratingCount ?? 0,
      arTryOnRating: newProd.arTryOnRating ?? 0,
      arTryOnRatingCount: newProd.arTryOnRatingCount ?? 0,
      reviews: newProd.reviews ?? []
    };
    
    // Add to list immediately for UI responsiveness
    pendingProductsRef.current = [completedProduct, ...pendingProductsRef.current];
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

    // Inject vendor metadata and save new product to Firestore using current logged-in vendor
    try {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const productDocument = removeUndefinedFields({
        ...newProd,
        sizes: [],
        vendorId,
        vendorName,
        ownerName: profileInfo.ownerName,
        vendorLocation: profileInfo.businessAddress,
        vendorPhone: profileInfo.contactDetails,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const docRef = await addDoc(collection(db, 'products'), productDocument);
      const savedProduct = {
        ...completedProduct,
        id: docRef.id
      };

      pendingProductsRef.current = pendingProductsRef.current.map(product =>
        product.id === completedProduct.id ? savedProduct : product
      );
      setProducts(prev => prev.map(product =>
        product.id === completedProduct.id ? savedProduct : product
      ));
    } catch (err) {
      pendingProductsRef.current = pendingProductsRef.current.filter(product => product.id !== completedProduct.id);
      setProducts(prev => prev.filter(product => product.id !== completedProduct.id));
      // eslint-disable-next-line no-console
      console.error('Failed to save product to Firestore', err);
      throw err;
    }
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
              profileInfo={profileInfo}
              isLoading={productsLoading}
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
