import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { initialActivities, initialProfile } from './store';
import { Product, Order, Activity, ProfileInfo, ProductFilters } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import AddProduct from './pages/AddProduct';
import Orders from './pages/Orders';
import Analytics from './pages/Analytics';
import MarketInsights from './pages/MarketInsights';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Feedback from './pages/Feedback';
import { subscribeToProducts, type ProductDocument } from './services/ProductService';
import { removeOrder, subscribeToOrders, updateOrderStatus } from './services/OrderService';
import { trackPurchaseCompleted } from './services/AnalyticsEventService';
import { getLocalVendorProfile, saveLocalVendorProfile } from './services/VendorService';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const fetchVendorProfile = async (uid: string, email: string): Promise<ProfileInfo | null> => {
  try {
    const { collection, doc, getDoc, getDocs, query, where } = await import('firebase/firestore');
    let data: any = null;

    try {
      const ownerDoc = await getDoc(doc(db, 'owner', uid));
      if (ownerDoc.exists()) {
        data = ownerDoc.data();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Could not read owner doc:', e);
    }

    if (!data?.vendorId) {
      try {
        const vendorSnapshot = await getDocs(query(collection(db, 'vendors'), where('uid', '==', uid)));
        if (!vendorSnapshot.empty) {
          data = vendorSnapshot.docs[0].data();
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Could not query vendors by uid:', e);
      }
    }

    if (!data?.vendorId && email) {
      try {
        const vendorSnapshot = await getDocs(collection(db, 'vendors'));
        const normalizedEmail = email.trim().toLowerCase();
        const matchingVendor = vendorSnapshot.docs.find(snapshot =>
          typeof snapshot.data().email === 'string'
          && snapshot.data().email.trim().toLowerCase() === normalizedEmail
        );
        if (matchingVendor) {
          data = matchingVendor.data();
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Could not query vendors by email:', e);
      }
    }

    if (data) {
      const profile: ProfileInfo = {
        storeName: data.companyName || data.storeName || '',
        companyName: data.companyName || data.storeName || '',
        vendorId: data.vendorId,
        ownerName: data.ownerName || '',
        gstNumber: data.gstNumber || '',
        contactDetails: data.contactDetails || data.phoneNumber || '',
        businessAddress: data.businessAddress || data.location || data.address || '',
        logoUrl: data.logoUrl || '',
        status: data.status || 'VERIFIED',
        memberSince: data.memberSince || ''
      };
      saveLocalVendorProfile(uid, profile);
      return profile;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Error fetching vendor profile from Firestore:', err);
  }

  const cached = getLocalVendorProfile(uid, email);
  if (cached) {
    return cached;
  }

  return null;
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

const extractVariantColors = (variants: ProductDocument['variants']) => {
  if (!Array.isArray(variants)) return [];

  return Array.from(new Set(variants.flatMap(variant => {
    if (!variant || typeof variant !== 'object') return [];
    const color = readString((variant as any).color, (variant as any).colour);
    return color ? [color] : [];
  })));
};

const productDocumentToProduct = (product: ProductDocument): Product => {
  const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name || 'Product')}&background=e2d9ff&color=451ebb&bold=true`;
  const variants = product.variants?.map(variant => ({
    color: readString(variant.color) || 'Default',
    images: Array.from(new Set((variant.images || []).filter(Boolean))),
    stock: variant.stock
  })).filter(variant => variant.color || variant.images.length);
  const firstVariantImage = variants?.flatMap(variant => variant.images)[0];
  const images = Array.from(new Set([
    ...(product.images || []),
    product.mainImage,
    product.imageUrl,
    firstVariantImage
  ].filter(Boolean)));

  const variantColors = variants?.map(variant => variant.color).filter(Boolean) || extractVariantColors(product.variants);
  const colors = Array.from(new Set([...(product.colors || []), ...variantColors].filter(Boolean)));
  const primaryColor = readString(product.color) || colors[0] || 'Default';
  const stockFromVariants = variants?.reduce((total, variant) => total + (variant.stock ?? 0), 0) || 0;
  const stock = product.stock || stockFromVariants;

  return {
    id: product.id,
    name: product.name || 'Untitled Product',
    brand: product.brand || product.vendorName || 'Unbranded',
    category: product.category || 'Uncategorized',
    price: product.price,
    stock,
    color: primaryColor,
    colors: colors.length ? colors : undefined,
    description: product.description,
    mainImage: product.mainImage || product.imageUrl || images[0] || fallbackImage,
    imageUrl: product.imageUrl || product.mainImage || images[0] || fallbackImage,
    images: images.length ? images : [fallbackImage],
    status: stock > 0 ? (stock <= 10 ? 'Low Stock' : 'In Stock') : 'Out of Stock',
    fabric: product.fabric,
    fit: product.fit,
    gender: product.gender,
    occasion: product.occasion,
    season: product.season,
    pattern: product.pattern,
    stretch: product.stretch,
    sleeveType: product.sleeveType,
    neckType: product.neckType,
    careInstructions: product.careInstructions,
    tags: product.tags,
    frameShape: product.frameShape,
    material: product.material,
    sku: product.sku || product.vendorId,
    vendorId: product.vendorId,
    vendorName: product.vendorName,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    originalPrice: product.originalPrice,
    discountedPrice: product.discountedPrice,
    variants
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
  const [authProfileError, setAuthProfileError] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return window.localStorage.getItem('nova-vendor-theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedProductVendor, setSelectedProductVendor] = useState('');
  const [dashboardProductFilters, setDashboardProductFilters] = useState<ProductFilters>({
    category: 'All Categories',
    status: 'Status: All',
    search: '',
    vendor: 'all'
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      window.localStorage.setItem('nova-vendor-theme', darkMode ? 'dark' : 'light');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Could not save theme preference', error);
    }
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.removeItem('nova-local-auth-users');
    window.localStorage.removeItem('nova-local-auth-session');
    window.localStorage.removeItem('nova-local-auth-remember');
    window.localStorage.removeItem('nova-local-auth-profile');
    window.sessionStorage.removeItem('nova-local-auth-session');

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoggedIn(false);
      setAuthProfileError('');

      if (user) {
        try {
          let vendorProfile = await fetchVendorProfile(user.uid, user.email || '');
          if (auth.currentUser?.uid !== user.uid) {
            return;
          }

          if (!vendorProfile) {
            const localFallback = getLocalVendorProfile(user.uid, user.email || '');
            if (localFallback) {
              vendorProfile = localFallback;
            } else {
              const fallbackDisplayName = user.displayName || user.email?.split('@')[0] || 'Vendor';
              const nextVendorId = `VEN${(Date.now() % 900) + 100}`;
              vendorProfile = {
                storeName: fallbackDisplayName,
                companyName: fallbackDisplayName,
                vendorId: nextVendorId,
                ownerName: fallbackDisplayName,
                gstNumber: '',
                contactDetails: user.phoneNumber || '',
                businessAddress: '',
                logoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackDisplayName)}&background=451ebb&color=fff&bold=true`,
                status: 'VERIFIED',
                memberSince: new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })
              };

              try {
                const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
                await setDoc(doc(db, 'owner', user.uid), {
                  ...vendorProfile,
                  uid: user.uid,
                  email: user.email || '',
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                }, { merge: true });
              } catch (writeErr) {
                // eslint-disable-next-line no-console
                console.warn('Could not save baseline owner doc', writeErr);
              }
              saveLocalVendorProfile(user.uid, vendorProfile);
            }
          }

          setProfileInfo(vendorProfile);
          setIsLoggedIn(true);
        } catch (err) {
          if (auth.currentUser?.uid !== user.uid) {
            return;
          }

          // eslint-disable-next-line no-console
          console.error('Failed to fetch vendor profile', err);
          const errorCode = err && typeof err === 'object' && 'code' in err
            ? String(err.code)
            : '';
          setAuthProfileError(
            errorCode.endsWith('permission-denied')
              ? 'Firebase signed you in, but Firestore rules block reading this vendor profile. Allow the signed-in user to read their own owner document (owner/{uid}) in Firestore Rules.'
              : `Could not load the vendor profile from Firebase: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
        return;
      }

      setIsLoggedIn(false);
    });
    return unsubscribe;
  }, []);

  // Core application lists
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersError, setOrdersError] = useState('');
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo>(initialProfile);
  const pendingProductsRef = useRef<Product[]>([]);
  const addingProductRef = useRef(false);

  const matchesCurrentStore = (product: Product) => {
    const currentVendorId = profileInfo.vendorId?.trim();
    const currentVendorName = (profileInfo.companyName || profileInfo.storeName || '').trim().toLowerCase();

    if (currentVendorId && product.vendorId === currentVendorId) {
      return true;
    }

    if (currentVendorName && product.vendorName?.trim().toLowerCase() === currentVendorName) {
      return true;
    }

    // Support VEN001 partner store aliases (Fashion Fushion / Trendy Threads)
    if (currentVendorId === 'VEN001' || currentVendorName.includes('fashion') || currentVendorName.includes('trendy')) {
      return product.vendorId === 'VEN001' ||
             product.vendorName?.toLowerCase() === 'fashion fushion' ||
             product.vendorName?.toLowerCase() === 'trendy threads';
    }

    if (!currentVendorId && !currentVendorName) {
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
  }, [isLoggedIn, profileInfo]);

  useEffect(() => {
    if (!isLoggedIn) {
      setOrders([]);
      setOrdersError('');
      return;
    }

    const currentVendorId = profileInfo.vendorId?.trim();
    if (!currentVendorId) {
      setOrders([]);
      setOrdersError('Your vendor profile is missing a vendor ID, so customer orders cannot be matched to your store.');
      return;
    }

    setOrdersError('');
    const unsubscribe = subscribeToOrders(
      currentVendorId,
      firestoreOrders => {
        const vendorId = profileInfo.vendorId?.trim();
        const vendorName = (profileInfo.companyName || profileInfo.storeName || '').trim().toLowerCase();
        setOrders(firestoreOrders.map(order => {
          const orderProductName = order.productName.trim().toLowerCase();
          const matchingProduct = products.find(product =>
            (order.productId && product.id === order.productId)
            || product.name.trim().toLowerCase() === orderProductName
            || order.items?.some(item =>
              (item.productId && product.id === item.productId)
              || product.name.trim().toLowerCase() === item.productName.trim().toLowerCase()
            )
          );
          return {
            ...order,
            vendorId: order.vendorId || matchingProduct?.vendorId || (!order.vendorName ? vendorId : undefined),
            vendorName: order.vendorName || matchingProduct?.vendorName || (!order.vendorId ? vendorName : undefined)
          };
        }).filter(order =>
          !order.vendorId && !order.vendorName
            ? true
            : (vendorId && order.vendorId === vendorId)
              || (vendorName && order.vendorName?.trim().toLowerCase() === vendorName)
        ));
      },
      error => {
        console.error('Failed to subscribe to vendor customer orders from Firestore', error);
        setOrdersError(`Could not load customer orders from Firebase: ${error.message}`);
      }
    );

    return unsubscribe;
  }, [isLoggedIn, profileInfo, products]);

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
      saveLocalVendorProfile(auth.currentUser?.uid || '', profile);
    }

    setAuthProfileError('');
    setIsLoggedIn(true);
    // Add dynamic activity indicating login
    setActivities(prev => [
      {
        id: 'login-' + Date.now(),
        type: 'verification',
        title: 'Partner Signed In',
        description: `Successfully signed in as ${profile?.ownerName || email}`,
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
    setIsLoggedIn(false);
    setActiveTab('dashboard');
  };

  const handleSwitchAccount = async () => {
    try {
      await signOut(auth);
      setAuthProfileError('');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to switch Firebase account', err);
      setAuthProfileError(`Could not sign out of the current Firebase account: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleAddProduct = async (newProd: Omit<Product, 'id'>) => {
    if (addingProductRef.current) {
      return;
    }
    addingProductRef.current = true;

    const stock = Number.isFinite(newProd.stock) ? Math.max(0, Math.trunc(newProd.stock)) : 0;
    const vendorId = profileInfo.vendorId || auth.currentUser?.uid || 'VEN-DEMO';
    const vendorName = profileInfo.companyName || profileInfo.storeName;
    const normalizeProductField = (value: string | undefined) =>
      (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const productColors = (product: Pick<Product, 'color' | 'colors'>) =>
      (product.colors?.length ? product.colors : [product.color])
        .map(color => normalizeProductField(color))
        .filter(Boolean)
        .sort()
        .join('|');
    const matchingProducts = products.filter(product =>
      normalizeProductField(product.name) === normalizeProductField(newProd.name)
      && normalizeProductField(product.brand) === normalizeProductField(newProd.brand)
      && normalizeProductField(product.category) === normalizeProductField(newProd.category)
      && productColors(product) === productColors(newProd)
      && (product.vendorId === vendorId
        || normalizeProductField(product.vendorName) === normalizeProductField(vendorName))
    );

    if (matchingProducts.length > 0) {
      const [matchingProduct, ...duplicateProducts] = matchingProducts;
      try {
        const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
        const productRefs = matchingProducts.map(product => doc(db, 'products', product.id));
        const increment = stock;
        const updatedProduct = await runTransaction(db, async transaction => {
          const snapshots = await Promise.all(productRefs.map(productRef => transaction.get(productRef)));
          const existingSnapshots = snapshots.filter(snapshot => snapshot.exists());
          if (existingSnapshots.length === 0) {
            throw new Error('The existing product could not be found. Refresh the catalog and try again.');
          }
          const currentStock = existingSnapshots.reduce((total, snapshot) => {
            const data = snapshot.data();
            return total + (Number(data.stock ?? data.stockQuantity) || 0);
          }, 0);
          const nextStock = currentStock + increment;
          const status: Product['status'] = nextStock > 10 ? 'In Stock' : nextStock > 0 ? 'Low Stock' : 'Out of Stock';
          transaction.update(existingSnapshots[0].ref, {
            stock: nextStock,
            stockQuantity: nextStock,
            status,
            updatedAt: serverTimestamp()
          });
          existingSnapshots.slice(1).forEach(snapshot => transaction.delete(snapshot.ref));
          return {
            productId: existingSnapshots[0].id,
            stock: nextStock,
            status,
            updatedAt: new Date().toISOString()
          };
        });

        const primaryProduct = matchingProducts.find(product => product.id === updatedProduct.productId) || matchingProduct;
        const mergedProduct = { ...primaryProduct, ...updatedProduct };
        const duplicateIds = new Set(matchingProducts
          .filter(product => product.id !== updatedProduct.productId)
          .map(product => product.id));
        setProducts(previous => [
          mergedProduct,
          ...previous.filter(product => product.id !== updatedProduct.productId && !duplicateIds.has(product.id))
        ]);
        setActivities(previous => [{
          id: 'stock-' + Date.now(),
          type: 'inventory',
          title: 'Product Stock Updated',
          description: `${newProd.name} stock increased by ${increment} units${duplicateProducts.length ? `; merged ${duplicateProducts.length} duplicate listing${duplicateProducts.length === 1 ? '' : 's'}` : ''}`,
          time: 'Just now'
        }, ...previous]);
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to add stock to existing product', err);
        throw err;
      } finally {
        addingProductRef.current = false;
      }
    }

    const id = newProd.name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 100);
    const completedProduct: Product = {
      ...newProd,
      stock,
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
        stock,
        stockQuantity: stock,
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
    } finally {
      addingProductRef.current = false;
    }
  };

  const handleUpdateProduct = async (updatedProd: Product) => {
    const previousProducts = products;
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

    try {
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { id, createdAt, updatedAt, reviews, rating, ratingCount, arTryOnRating, arTryOnRatingCount, ...productData } = updatedProd;
      const productDocument = removeUndefinedFields({
        ...productData,
        stock: Math.max(0, Math.trunc(updatedProd.stock)),
        stockQuantity: Math.max(0, Math.trunc(updatedProd.stock)),
        sizes: [],
        vendorId: updatedProd.vendorId || profileInfo.vendorId || auth.currentUser?.uid || 'VEN-DEMO',
        vendorName: updatedProd.vendorName || profileInfo.companyName || profileInfo.storeName,
        ownerName: profileInfo.ownerName,
        vendorLocation: profileInfo.businessAddress,
        vendorPhone: profileInfo.contactDetails,
        updatedAt: serverTimestamp()
      });

      await setDoc(doc(db, 'products', id), productDocument, { merge: true });
    } catch (err) {
      setProducts(previousProducts);
      // eslint-disable-next-line no-console
      console.error('Failed to update product in Firestore', err);
      throw err;
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const previousProducts = products;
    setProducts(prev => prev.filter(product => product.id !== productId));

    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'products', productId));
    } catch (err) {
      setProducts(previousProducts);
      console.error('Failed to delete product from Firestore', err);
      throw err;
    }
  };

  const handleCreateOrder = async (newOrder: Order) => {
    const vendorId = profileInfo.vendorId || auth.currentUser?.uid || 'VEN001';
    const vendorName = profileInfo.companyName || profileInfo.storeName || 'Fashion Fushion';
    const orderData = removeUndefinedFields({
      ...newOrder,
      vendorId,
      vendorName,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const { saveOrderRecord } = await import('./services/OrderService');
    await saveOrderRecord(orderData);

    const purchasedProduct = products.find(product => product.name.trim().toLowerCase() === newOrder.productName.trim().toLowerCase());
    if (purchasedProduct) {
      trackPurchaseCompleted(
        newOrder.id,
        purchasedProduct.id,
        purchasedProduct.name,
        purchasedProduct.category,
        newOrder.amount,
        vendorId
      );

      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const nextStock = Math.max(0, purchasedProduct.stock - newOrder.quantity);
        await updateDoc(doc(db, 'products', purchasedProduct.id), {
          stock: nextStock,
          stockQuantity: nextStock,
          status: nextStock > 0 ? 'active' : 'active',
          updatedAt: new Date()
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Could not update product stock in Firestore', err);
      }
    }
  };

  const handleSetOrderStatus = async (orderId: string, status: Order['status']) => {
    await updateOrderStatus(orderId, status);
  };

  const handleDeleteOrder = async (orderId: string) => {
    await removeOrder(orderId);
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
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        authProfileError={authProfileError}
        onSwitchAccount={handleSwitchAccount}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(current => !current)}
      />
    );
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
            { id: 'marketInsights', label: 'Market Insights' },
            { id: 'feedback', label: 'Try-On Feedback' },
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
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(current => !current)}
          products={products}
          orders={orders}
          uid={auth.currentUser?.uid || ''}
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
              onSelectVendor={setSelectedProductVendor}
              onApplyProductFilters={filters => {
                setDashboardProductFilters(filters);
                setSelectedProductVendor(filters.vendor);
                handleTabChange('products');
              }}
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
              onDeleteProduct={handleDeleteProduct}
              selectedVendor={selectedProductVendor}
              initialFilters={dashboardProductFilters}
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
                onCreateOrder={handleCreateOrder}
                onUpdateOrderStatus={handleSetOrderStatus}
                onDeleteOrder={handleDeleteOrder}
                products={products}
                ordersError={ordersError}
            />
          )}

          {activeTab === 'analytics' && (
            <Analytics orders={orders} products={products} vendorId={profileInfo.vendorId} />
          )}

          {activeTab === 'marketInsights' && (
            <MarketInsights 
              orders={orders}
              products={products}
              profileInfo={profileInfo}
              setActiveTab={handleTabChange}
            />
          )}

          {activeTab === 'feedback' && (
            <Feedback vendorId={profileInfo.vendorId} products={products} />
          )}

          {activeTab === 'profile' && (
            <Profile 
              profileInfo={profileInfo}
              setProfileInfo={setProfileInfo}
            />
          )}

          {activeTab === 'settings' && (
            <Settings
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode(current => !current)}
              uid={auth.currentUser?.uid || ''}
            />
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
