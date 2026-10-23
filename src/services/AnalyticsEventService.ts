import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  type Unsubscribe 
} from 'firebase/firestore';
import { db } from '../firebase';

export type AnalyticsEventType = 
  | 'product_viewed'
  | 'product_searched'
  | 'search_results_returned'
  | 'product_wishlisted'
  | 'product_unwishlisted'
  | 'ar_tryon_started'
  | 'ar_tryon_completed'
  | 'ar_tryon_failed'
  | 'product_added_to_cart'
  | 'checkout_started'
  | 'purchase_completed';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  timestamp: number;
  sessionId: string;
  vendorId?: string;
  productId?: string;
  productName?: string;
  category?: string;
  searchTerm?: string;
  resultCount?: number;
  metadata?: Record<string, any>;
}

const LOCAL_STORAGE_KEY = 'nova-vendor-analytics-events';
const MAX_LOCAL_EVENTS = 3500;
const DEDUPLICATION_WINDOW_MS = 15000; // 15s deduplication for identical action in same session

// Helper to get or create persistent anonymous session ID
export const getAnalyticsSessionId = (): string => {
  try {
    let sid = window.sessionStorage.getItem('nova_analytics_session_id');
    if (!sid) {
      sid = 'ses_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      window.sessionStorage.setItem('nova_analytics_session_id', sid);
    }
    return sid;
  } catch {
    return 'ses_default_' + Date.now();
  }
};

// Recent event fingerprint cache for deduplication
const recentEvents = new Map<string, number>();

const isDuplicate = (fingerprint: string, now: number): boolean => {
  const lastTime = recentEvents.get(fingerprint);
  if (lastTime && (now - lastTime) < DEDUPLICATION_WINDOW_MS) {
    return true;
  }
  recentEvents.set(fingerprint, now);
  // Clean old entries
  if (recentEvents.size > 250) {
    for (const [key, time] of recentEvents.entries()) {
      if (now - time > DEDUPLICATION_WINDOW_MS * 2) {
        recentEvents.delete(key);
      }
    }
  }
  return false;
};

// Read events from local storage cache
export const readStoredEvents = (): AnalyticsEvent[] => {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse local analytics events:', err);
    return [];
  }
};

// Write events to local storage cache
export const writeStoredEvents = (events: AnalyticsEvent[]) => {
  try {
    const trimmed = events.slice(-MAX_LOCAL_EVENTS);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Failed to persist analytics events to local storage:', err);
  }
};

// Broadcast event to active React listeners
const broadcastEvent = (event: AnalyticsEvent) => {
  try {
    window.dispatchEvent(new CustomEvent('nova-analytics-event-logged', { detail: event }));
  } catch {}
};

/**
 * Core event logging function
 */
export const logAnalyticsEvent = async (
  eventData: Omit<AnalyticsEvent, 'id' | 'timestamp' | 'sessionId'> & { sessionId?: string; timestamp?: number }
): Promise<AnalyticsEvent | null> => {
  const now = eventData.timestamp || Date.now();
  const sessionId = eventData.sessionId || getAnalyticsSessionId();

  // Deduplication check
  const fingerprint = `${eventData.type}_${eventData.productId || eventData.searchTerm || 'gen'}_${sessionId}`;
  if (isDuplicate(fingerprint, now)) {
    return null;
  }

  const newEvent: AnalyticsEvent = {
    id: 'evt_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
    type: eventData.type,
    timestamp: now,
    sessionId,
    vendorId: eventData.vendorId || 'VEN001',
    productId: eventData.productId,
    productName: eventData.productName,
    category: eventData.category,
    searchTerm: eventData.searchTerm,
    resultCount: eventData.resultCount,
    metadata: eventData.metadata
  };

  // 1. Immediately store in local cache
  const currentEvents = readStoredEvents();
  currentEvents.push(newEvent);
  writeStoredEvents(currentEvents);

  // 2. Broadcast to UI subscribers
  broadcastEvent(newEvent);

  // 3. Attempt async write to Firestore
  try {
    const colRef = collection(db, 'analytics_events');
    addDoc(colRef, {
      ...newEvent,
      createdAt: new Date(now)
    }).catch(() => {
      // Background write silently handled
    });
  } catch {
    // Graceful fallback
  }

  return newEvent;
};

// Convenience tracking helpers
export const trackProductView = (
  productId: string,
  productName: string,
  category: string,
  vendorId?: string,
  metadata?: Record<string, any>
) => {
  return logAnalyticsEvent({
    type: 'product_viewed',
    productId,
    productName,
    category,
    vendorId: vendorId || 'VEN001',
    metadata
  });
};

export const trackProductSearch = (
  searchTerm: string,
  resultCount: number,
  category?: string,
  vendorId?: string
) => {
  const normalized = (searchTerm || '').trim().toLowerCase();
  if (!normalized || normalized.length < 2) return Promise.resolve(null);

  return logAnalyticsEvent({
    type: 'product_searched',
    searchTerm: normalized,
    resultCount,
    category,
    vendorId: vendorId || 'VEN001'
  });
};

export const trackWishlistAdded = (
  productId: string,
  productName: string,
  category: string,
  vendorId?: string
) => {
  return logAnalyticsEvent({
    type: 'product_wishlisted',
    productId,
    productName,
    category,
    vendorId: vendorId || 'VEN001'
  });
};

export const trackWishlistRemoved = (
  productId: string,
  productName: string,
  category: string,
  vendorId?: string
) => {
  return logAnalyticsEvent({
    type: 'product_unwishlisted',
    productId,
    productName,
    category,
    vendorId: vendorId || 'VEN001'
  });
};

export const trackArTryOn = (
  productId: string,
  productName: string,
  category: string,
  status: 'started' | 'completed' | 'failed',
  durationSeconds?: number,
  vendorId?: string,
  errorReason?: string
) => {
  let eventType: AnalyticsEventType = 'ar_tryon_started';
  if (status === 'completed') eventType = 'ar_tryon_completed';
  if (status === 'failed') eventType = 'ar_tryon_failed';

  return logAnalyticsEvent({
    type: eventType,
    productId,
    productName,
    category,
    vendorId: vendorId || 'VEN001',
    metadata: { 
      durationSeconds: durationSeconds || 0,
      errorReason: errorReason || undefined,
      engine: 'Decart-AR-v2'
    }
  });
};

export const trackAddToCart = (
  productId: string,
  productName: string,
  category: string,
  vendorId?: string,
  metadata?: { size?: string; color?: string; quantity?: number }
) => {
  return logAnalyticsEvent({
    type: 'product_added_to_cart',
    productId,
    productName,
    category,
    vendorId: vendorId || 'VEN001',
    metadata
  });
};

export const trackCheckoutStarted = (
  cartItemCount: number,
  totalAmount: number,
  vendorId?: string
) => {
  return logAnalyticsEvent({
    type: 'checkout_started',
    vendorId: vendorId || 'VEN001',
    metadata: { cartItemCount, totalAmount }
  });
};

export const trackPurchaseCompleted = (
  orderId: string,
  productId: string,
  productName: string,
  category: string,
  amount: number,
  vendorId?: string
) => {
  return logAnalyticsEvent({
    type: 'purchase_completed',
    productId,
    productName,
    category,
    vendorId: vendorId || 'VEN001',
    metadata: { orderId, amount }
  });
};

/**
 * Realtime Firestore Listener for Analytics Events
 * Merges cloud events with local cache and deduplicates by event ID.
 */
export const subscribeToAnalyticsEvents = (
  vendorId?: string,
  onEvents?: (events: AnalyticsEvent[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  // 1. Immediately emit current local cache
  const localEvents = readStoredEvents();
  if (onEvents) {
    onEvents(localEvents);
  }

  // 2. Setup Firestore listener
  try {
    const colRef = collection(db, 'analytics_events');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(1200));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreEvents: AnalyticsEvent[] = snapshot.docs.map(doc => {
          const d = doc.data();
          let ts = Date.now();
          if (typeof d.timestamp === 'number') {
            ts = d.timestamp;
          } else if (d.createdAt && typeof d.createdAt.toMillis === 'function') {
            ts = d.createdAt.toMillis();
          } else if (d.createdAt instanceof Date) {
            ts = d.createdAt.getTime();
          }

          return {
            id: doc.id,
            type: d.type as AnalyticsEventType,
            timestamp: ts,
            sessionId: d.sessionId || 'ses_anon',
            vendorId: d.vendorId,
            productId: d.productId,
            productName: d.productName,
            category: d.category,
            searchTerm: d.searchTerm,
            resultCount: d.resultCount,
            metadata: d.metadata
          };
        });

        // Merge with local events, avoiding duplicate IDs
        const existing = readStoredEvents();
        const existingMap = new Map(existing.map(e => [e.id, e]));

        for (const fe of firestoreEvents) {
          existingMap.set(fe.id, fe);
        }

        const merged = Array.from(existingMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        writeStoredEvents(merged);

        if (onEvents) {
          onEvents(merged);
        }
      },
      (err) => {
        console.warn('Firestore analytics snapshot listener error:', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err: any) {
    console.warn('Failed to initialize Firestore analytics listener:', err);
    if (onError) onError(err);
    return () => {};
  }
};

/**
 * Filter events by date range and vendor identity
 */
export const getFilteredEvents = (
  events: AnalyticsEvent[],
  range: string,
  vendorId?: string,
  vendorProductIds?: Set<string>,
  customRange?: { startMs: number; endMs: number }
): { currentPeriodEvents: AnalyticsEvent[]; previousPeriodEvents: AnalyticsEvent[]; windowDays: number } => {
  const targetVendor = (vendorId || 'VEN001').trim();
  const now = Date.now();

  let days = 30;
  let currentStart = now - 30 * 24 * 60 * 60 * 1000;
  let previousStart = currentStart - 30 * 24 * 60 * 60 * 1000;
  let currentEnd = now;
  let previousEnd = currentStart;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (customRange && customRange.startMs && customRange.endMs) {
    currentStart = customRange.startMs;
    currentEnd = customRange.endMs;
    const durationMs = Math.max(ONE_DAY_MS, currentEnd - currentStart);
    days = Math.max(1, Math.round(durationMs / ONE_DAY_MS));
    previousStart = currentStart - durationMs;
    previousEnd = currentStart;
  } else if (range === 'Today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    currentStart = today.getTime();
    currentEnd = now;
    days = 1;
    previousStart = currentStart - ONE_DAY_MS;
    previousEnd = currentStart - ONE_DAY_MS + (currentEnd - currentStart);
  } else if (range === 'Last 7 Days') {
    days = 7;
    currentStart = now - 7 * ONE_DAY_MS;
    previousStart = currentStart - 7 * ONE_DAY_MS;
  } else if (range === 'Last 30 Days') {
    days = 30;
    currentStart = now - 30 * ONE_DAY_MS;
    previousStart = currentStart - 30 * ONE_DAY_MS;
  } else if (range === 'Last 90 Days') {
    days = 90;
    currentStart = now - 90 * ONE_DAY_MS;
    previousStart = currentStart - 90 * ONE_DAY_MS;
  } else if (range === 'This Month') {
    const cur = new Date();
    const startOfMonth = new Date(cur.getFullYear(), cur.getMonth(), 1).getTime();
    currentStart = startOfMonth;
    currentEnd = now;
    const elapsedMs = Math.max(ONE_DAY_MS, currentEnd - currentStart);
    days = Math.max(1, Math.round(elapsedMs / ONE_DAY_MS));
    previousStart = new Date(cur.getFullYear(), cur.getMonth() - 1, 1).getTime();
    previousEnd = previousStart + elapsedMs;
  } else if (range === 'Last Month') {
    const cur = new Date();
    const startOfLastMonth = new Date(cur.getFullYear(), cur.getMonth() - 1, 1).getTime();
    const endOfLastMonth = new Date(cur.getFullYear(), cur.getMonth(), 0, 23, 59, 59, 999).getTime();
    currentStart = startOfLastMonth;
    currentEnd = endOfLastMonth;
    days = Math.max(28, Math.round((currentEnd - currentStart) / ONE_DAY_MS));
    previousStart = new Date(cur.getFullYear(), cur.getMonth() - 2, 1).getTime();
    previousEnd = new Date(cur.getFullYear(), cur.getMonth() - 1, 0, 23, 59, 59, 999).getTime();
  } else if (range === 'This Year') {
    const cur = new Date();
    currentStart = new Date(cur.getFullYear(), 0, 1).getTime();
    currentEnd = now;
    days = Math.max(1, Math.round((currentEnd - currentStart) / ONE_DAY_MS));
    previousStart = new Date(cur.getFullYear() - 1, 0, 1).getTime();
    previousEnd = previousStart + (currentEnd - currentStart);
  }

  // Multi-tenant vendor scoping
  const vendorFiltered = events.filter(e => {
    if (!targetVendor || targetVendor === 'all') return true;
    if (e.vendorId && e.vendorId === targetVendor) return true;
    if (e.productId && vendorProductIds && vendorProductIds.has(e.productId)) return true;
    // Support partner alias for VEN001
    if (targetVendor === 'VEN001' && (!e.vendorId || e.vendorId === 'VEN001')) return true;
    return false;
  });

  const currentPeriodEvents = vendorFiltered.filter(e => e.timestamp >= currentStart && e.timestamp <= currentEnd);
  const previousPeriodEvents = vendorFiltered.filter(e => e.timestamp >= previousStart && e.timestamp < previousEnd);

  return { currentPeriodEvents, previousPeriodEvents, windowDays: days };
};

/**
 * Realistic Traffic Simulator:
 * Allows vendors to simulate organic discovery traffic (views, searches, AR try-ons, cart adds, wishlists)
 * across their actual catalog clothing items. This grounds the analytics in real items while testing.
 */
export const seedSimulatedClothingTraffic = (
  products: Array<{ id: string; name: string; category: string; vendorId?: string }>,
  targetVendorId?: string
) => {
  if (!products || products.length === 0) return;

  const popularQueries = [
    { term: 'oversized t-shirt', cat: 'T-Shirts', results: 14 },
    { term: 'graphic tee black', cat: 'T-Shirts', results: 12 },
    { term: 'cotton polo shirt', cat: 'Polo T-Shirts', results: 8 },
    { term: 'baggy cargo pants', cat: 'Cargo Pants', results: 6 },
    { term: 'heavyweight hoodie', cat: 'Hoodies', results: 9 },
    { term: 'kurti ethnic wear', cat: 'Ethnic Wear', results: 7 },
    { term: 'denim jacket vintage', cat: 'Jackets', results: 4 },
    { term: 'linen casual shirt', cat: 'Shirts', results: 11 },
    { term: 'slim fit formal trousers', cat: 'Trousers', results: 6 },
    { term: 'winter puffer coat', cat: 'Jackets', results: 0 }, // Zero results query
    { term: 'waterproof rain jacket', cat: 'Jackets', results: 0 }, // Zero results query
    { term: 'silk embroidered sherwani', cat: 'Ethnic Wear', results: 0 }, // Zero results query
    { term: 'party wear blazer', cat: 'Jackets', results: 1 }  // Low inventory query
  ];

  const now = Date.now();
  const simulatedEvents: AnalyticsEvent[] = [];
  const sessionCount = 55;
  const vendor = targetVendorId || 'VEN001';

  // Distribute over past 28 days
  for (let s = 0; s < sessionCount; s++) {
    const sessionId = 'ses_sim_' + s + '_' + Math.random().toString(36).substring(2, 6);
    // Random time between 0.2 and 27 days ago
    const daysAgo = Math.random() * 26.5;
    const sessionTime = now - daysAgo * 24 * 60 * 60 * 1000;

    // 1. Search action (75% of sessions begin with search)
    if (Math.random() < 0.78) {
      const q = popularQueries[Math.floor(Math.random() * popularQueries.length)];
      simulatedEvents.push({
        id: 'evt_sim_search_' + s,
        type: 'product_searched',
        timestamp: sessionTime,
        sessionId,
        vendorId: vendor,
        searchTerm: q.term,
        resultCount: q.results,
        category: q.cat
      });
    }

    // 2. View 1 to 4 products in this session
    const viewedCount = Math.floor(Math.random() * 3) + 1;
    for (let v = 0; v < viewedCount; v++) {
      const prod = products[Math.floor(Math.random() * products.length)];
      const viewTime = sessionTime + (v + 1) * 40000;

      simulatedEvents.push({
        id: 'evt_sim_view_' + s + '_' + v,
        type: 'product_viewed',
        timestamp: viewTime,
        sessionId,
        vendorId: prod.vendorId || vendor,
        productId: prod.id,
        productName: prod.name,
        category: prod.category
      });

      // 3. Wishlist action (25% chance)
      if (Math.random() < 0.26) {
        simulatedEvents.push({
          id: 'evt_sim_wish_' + s + '_' + v,
          type: 'product_wishlisted',
          timestamp: viewTime + 18000,
          sessionId,
          vendorId: prod.vendorId || vendor,
          productId: prod.id,
          productName: prod.name,
          category: prod.category
        });
      }

      // 4. AR Try-On on some products (45% chance)
      if (Math.random() < 0.45) {
        const tryonTime = viewTime + 32000;
        simulatedEvents.push({
          id: 'evt_sim_ar_start_' + s + '_' + v,
          type: 'ar_tryon_started',
          timestamp: tryonTime,
          sessionId,
          vendorId: prod.vendorId || vendor,
          productId: prod.id,
          productName: prod.name,
          category: prod.category,
          metadata: { engine: 'Decart-AR-v2' }
        });

        // 88% of AR try-on attempts complete successfully, 12% fail (network/camera abort)
        if (Math.random() < 0.88) {
          simulatedEvents.push({
            id: 'evt_sim_ar_comp_' + s + '_' + v,
            type: 'ar_tryon_completed',
            timestamp: tryonTime + 38000,
            sessionId,
            vendorId: prod.vendorId || vendor,
            productId: prod.id,
            productName: prod.name,
            category: prod.category,
            metadata: { durationSeconds: 38, fitQualityScore: 92 }
          });

          // Try-on to cart conversion (38% of completed try-ons add to cart)
          if (Math.random() < 0.38) {
            simulatedEvents.push({
              id: 'evt_sim_cart_' + s + '_' + v,
              type: 'product_added_to_cart',
              timestamp: tryonTime + 72000,
              sessionId,
              vendorId: prod.vendorId || vendor,
              productId: prod.id,
              productName: prod.name,
              category: prod.category
            });

            // Cart to checkout started (65%)
            if (Math.random() < 0.65) {
              simulatedEvents.push({
                id: 'evt_sim_chk_' + s + '_' + v,
                type: 'checkout_started',
                timestamp: tryonTime + 115000,
                sessionId,
                vendorId: prod.vendorId || vendor,
                productId: prod.id,
                productName: prod.name,
                category: prod.category
              });
            }
          }
        } else {
          // Failed try-on session
          simulatedEvents.push({
            id: 'evt_sim_ar_fail_' + s + '_' + v,
            type: 'ar_tryon_failed',
            timestamp: tryonTime + 15000,
            sessionId,
            vendorId: prod.vendorId || vendor,
            productId: prod.id,
            productName: prod.name,
            category: prod.category,
            metadata: { errorReason: 'Camera stream disconnected or lighting too low' }
          });
        }
      }
    }
  }

  // Merge with existing events, ensuring no duplicate IDs
  const existing = readStoredEvents();
  const existingIds = new Set(existing.map(e => e.id));
  const newEvents = simulatedEvents.filter(e => !existingIds.has(e.id));
  const combined = [...existing, ...newEvents].sort((a, b) => a.timestamp - b.timestamp);

  writeStoredEvents(combined);
  window.dispatchEvent(new CustomEvent('nova-analytics-event-logged'));
};

/**
 * Clear all logged events
 */
export const clearStoredAnalyticsEvents = () => {
  window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('nova-analytics-event-logged'));
};

/**
 * Official Customer App Analytics Integration Contract
 * Exported reference for connecting the customer application.
 */
export const CUSTOMER_APP_ANALYTICS_CONTRACT = {
  version: '2.0.0',
  firestoreCollection: 'analytics_events',
  requiredFields: ['type', 'timestamp', 'sessionId'],
  supportedEventTypes: [
    'product_viewed',
    'product_searched',
    'product_wishlisted',
    'product_unwishlisted',
    'ar_tryon_started',
    'ar_tryon_completed',
    'ar_tryon_failed',
    'product_added_to_cart',
    'checkout_started',
    'purchase_completed'
  ],
  decartArEngineRequirements: {
    startEvent: 'ar_tryon_started (upon camera/model initialization)',
    completedEvent: 'ar_tryon_completed (upon successful drape projection on body)',
    failedEvent: 'ar_tryon_failed (upon camera error or user timeout)'
  }
};
