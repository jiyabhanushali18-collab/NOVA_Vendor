import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

export type AnalyticsEventType = 
  | 'product_viewed'
  | 'product_searched'
  | 'search_results_returned'
  | 'ar_tryon_started'
  | 'ar_tryon_completed'
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
const MAX_LOCAL_EVENTS = 2500;
const DEDUPLICATION_WINDOW_MS = 20000; // 20s deduplication for identical action in same session

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
  if (recentEvents.size > 200) {
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
const writeStoredEvents = (events: AnalyticsEvent[]) => {
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

  // 3. Attempt async write to Firestore (fails gracefully if unauthenticated)
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
  vendorId?: string
) => {
  return logAnalyticsEvent({
    type: 'product_viewed',
    productId,
    productName,
    category,
    vendorId: vendorId || 'VEN001'
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

export const trackArTryOn = (
  productId: string,
  productName: string,
  category: string,
  status: 'started' | 'completed',
  durationSeconds?: number,
  vendorId?: string
) => {
  return logAnalyticsEvent({
    type: status === 'completed' ? 'ar_tryon_completed' : 'ar_tryon_started',
    productId,
    productName,
    category,
    vendorId: vendorId || 'VEN001',
    metadata: { durationSeconds: durationSeconds || 0 }
  });
};

export const trackAddToCart = (
  productId: string,
  productName: string,
  category: string,
  vendorId?: string
) => {
  return logAnalyticsEvent({
    type: 'product_added_to_cart',
    productId,
    productName,
    category,
    vendorId: vendorId || 'VEN001'
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
 * Filter events by date range and vendor
 */
export const getFilteredEvents = (
  events: AnalyticsEvent[],
  range: string,
  vendorId?: string
): { currentPeriodEvents: AnalyticsEvent[]; previousPeriodEvents: AnalyticsEvent[]; windowDays: number } => {
  const targetVendor = (vendorId || 'VEN001').trim();
  const now = Date.now();

  let days = 30;
  if (range === 'Last 7 Days') days = 7;
  else if (range === 'Last 30 Days') days = 30;
  else if (range === 'Last 90 Days') days = 90;
  else if (range === 'This Month') {
    const cur = new Date();
    days = Math.max(1, cur.getDate());
  } else if (range === 'Last Month') {
    days = 30;
  } else if (range === 'This Year') {
    days = 365;
  }

  const windowMs = days * 24 * 60 * 60 * 1000;
  const currentStart = now - windowMs;
  const previousStart = currentStart - windowMs;

  const vendorFiltered = events.filter(e => {
    if (!e.vendorId || !targetVendor) return true;
    return e.vendorId === targetVendor || targetVendor === 'all';
  });

  const currentPeriodEvents = vendorFiltered.filter(e => e.timestamp >= currentStart && e.timestamp <= now);
  const previousPeriodEvents = vendorFiltered.filter(e => e.timestamp >= previousStart && e.timestamp < currentStart);

  return { currentPeriodEvents, previousPeriodEvents, windowDays: days };
};

/**
 * Realistic Traffic Simulator:
 * Allows vendors to simulate organic discovery traffic (views, searches, AR try-ons, cart adds)
 * across their actual catalog clothing items. This grounds the analytics in real items while testing.
 */
export const seedSimulatedClothingTraffic = (products: Array<{ id: string; name: string; category: string; vendorId?: string }>) => {
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
    { term: 'winter puffer coat', cat: 'Jackets', results: 0 }, // Zero results query
    { term: 'waterproof rain jacket', cat: 'Jackets', results: 0 }, // Zero results query
    { term: 'party wear blazer', cat: 'Ethnic Wear', results: 1 }  // Low inventory query
  ];

  const now = Date.now();
  const simulatedEvents: AnalyticsEvent[] = [];
  const sessionCount = 45;

  // Distribute over past 28 days
  for (let s = 0; s < sessionCount; s++) {
    const sessionId = 'ses_sim_' + s + '_' + Math.random().toString(36).substring(2, 6);
    // Random time between 1 and 28 days ago
    const daysAgo = Math.random() * 26;
    const sessionTime = now - daysAgo * 24 * 60 * 60 * 1000;

    // 1. Search action (70% of sessions begin with search)
    if (Math.random() < 0.75) {
      const q = popularQueries[Math.floor(Math.random() * popularQueries.length)];
      simulatedEvents.push({
        id: 'evt_sim_search_' + s,
        type: 'product_searched',
        timestamp: sessionTime,
        sessionId,
        vendorId: 'VEN001',
        searchTerm: q.term,
        resultCount: q.results,
        category: q.cat
      });
    }

    // 2. View 1 to 4 products in this session
    const viewedCount = Math.floor(Math.random() * 3) + 1;
    for (let v = 0; v < viewedCount; v++) {
      const prod = products[Math.floor(Math.random() * products.length)];
      const viewTime = sessionTime + (v + 1) * 45000;

      simulatedEvents.push({
        id: 'evt_sim_view_' + s + '_' + v,
        type: 'product_viewed',
        timestamp: viewTime,
        sessionId,
        vendorId: prod.vendorId || 'VEN001',
        productId: prod.id,
        productName: prod.name,
        category: prod.category
      });

      // 3. AR Try-On on some products (40% chance if clothing item)
      if (Math.random() < 0.42) {
        const tryonTime = viewTime + 30000;
        simulatedEvents.push({
          id: 'evt_sim_ar_start_' + s + '_' + v,
          type: 'ar_tryon_started',
          timestamp: tryonTime,
          sessionId,
          vendorId: prod.vendorId || 'VEN001',
          productId: prod.id,
          productName: prod.name,
          category: prod.category
        });

        // 80% of AR try-on attempts complete successfully
        if (Math.random() < 0.85) {
          simulatedEvents.push({
            id: 'evt_sim_ar_comp_' + s + '_' + v,
            type: 'ar_tryon_completed',
            timestamp: tryonTime + 42000,
            sessionId,
            vendorId: prod.vendorId || 'VEN001',
            productId: prod.id,
            productName: prod.name,
            category: prod.category,
            metadata: { durationSeconds: 42 }
          });

          // Try-on to cart conversion (35% of completed try-ons add to cart)
          if (Math.random() < 0.35) {
            simulatedEvents.push({
              id: 'evt_sim_cart_' + s + '_' + v,
              type: 'product_added_to_cart',
              timestamp: tryonTime + 75000,
              sessionId,
              vendorId: prod.vendorId || 'VEN001',
              productId: prod.id,
              productName: prod.name,
              category: prod.category
            });

            // Cart to checkout started (60%)
            if (Math.random() < 0.6) {
              simulatedEvents.push({
                id: 'evt_sim_chk_' + s + '_' + v,
                type: 'checkout_started',
                timestamp: tryonTime + 120000,
                sessionId,
                vendorId: prod.vendorId || 'VEN001',
                productId: prod.id,
                productName: prod.name,
                category: prod.category
              });
            }
          }
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
