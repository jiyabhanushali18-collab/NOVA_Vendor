import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Order } from '../types';

export interface OrderDocument extends Order {
  vendorId?: string;
  vendorName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const readNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const readDate = (...values: unknown[]) => {
  for (const value of values) {
    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      return value.toDate().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
};

const readTimestampMs = (value: unknown) => {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  const parsed = new Date(String(value || '')).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const ORDERS_STORAGE_KEY = 'nova-vendor-orders';

const readLocalOrders = (): OrderDocument[] => {
  try {
    const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalOrders = (orders: OrderDocument[]) => {
  try {
    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to save orders to localStorage', e);
  }
};

const activeSubscribers = new Set<(orders: OrderDocument[]) => void>();
let cachedOrders: OrderDocument[] = readLocalOrders();

const notifySubscribers = (orders: OrderDocument[]) => {
  cachedOrders = orders;
  writeLocalOrders(orders);
  activeSubscribers.forEach(cb => {
    try {
      cb(orders);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error notifying order subscriber', e);
    }
  });
};

const mapOrderDocument = (snapshot: QueryDocumentSnapshot<DocumentData>): OrderDocument => {
  const data = snapshot.data();
  const customerName = readString(data.customerName, data.customer?.name, data.buyerName, data.userName) || 'Customer';
  const productName = readString(data.productName, data.product?.name, data.productTitle, data.itemName) || 'Product';
  const quantity = readNumber(data.quantity || data.qty) || 1;

  return {
    id: snapshot.id,
    customerName,
    customerInitials: readString(data.customerInitials) || customerName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
    customerAvatar: readString(data.customerAvatar, data.customer?.avatar, data.userAvatar) || undefined,
    productName,
    quantity,
    amount: readNumber(data.amount || data.total || data.totalAmount || data.price * quantity),
    date: readDate(data.date, data.createdAt, data.orderDate),
    status: ['Pending', 'Shipped', 'Delivered', 'Cancelled'].includes(data.status) ? data.status : 'Pending',
    vendorId: readString(data.vendorId, data.vendor?.id) || undefined,
    vendorName: readString(data.vendorName, data.vendor?.name) || undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  } as OrderDocument;
};

export const subscribeToOrders = (
  onOrders: (orders: OrderDocument[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  activeSubscribers.add(onOrders);

  // Immediately emit current cached orders
  if (cachedOrders.length > 0) {
    onOrders(cachedOrders);
  }

  let firestoreUnsubscribe: Unsubscribe | undefined;

  try {
    firestoreUnsubscribe = onSnapshot(
      collection(db, 'orders'),
      snapshot => {
        const firestoreOrders = snapshot.docs
          .map(mapOrderDocument)
          .sort((a, b) => readTimestampMs(b.updatedAt || b.createdAt) - readTimestampMs(a.updatedAt || a.createdAt));

        // Merge firestore orders with any locally placed orders not yet in firestore
        const merged = [...firestoreOrders];
        cachedOrders.forEach(localOrd => {
          if (!merged.some(m => m.id === localOrd.id)) {
            merged.push(localOrd);
          }
        });
        merged.sort((a, b) => readTimestampMs(b.updatedAt || b.createdAt) - readTimestampMs(a.updatedAt || a.createdAt));

        notifySubscribers(merged);
      },
      error => {
        // eslint-disable-next-line no-console
        console.warn('Firestore orders sync failed (likely security rules); using local resilient order storage', error.message);
        onError?.(error);
        // Ensure subscriber receives current cached orders
        onOrders(cachedOrders);
      }
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    onError?.(error);
    onOrders(cachedOrders);
  }

  return () => {
    activeSubscribers.delete(onOrders);
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
    }
  };
};

export const saveOrderRecord = async (newOrder: Order): Promise<OrderDocument> => {
  const orderDoc: OrderDocument = {
    ...newOrder,
    id: newOrder.id || `#NV-${Math.floor(8834 + Math.random() * 1000)}`,
    createdAt: newOrder.createdAt || new Date(),
    updatedAt: new Date()
  };

  // Attempt Firestore write
  try {
    const { addDoc, collection: fsCollection } = await import('firebase/firestore');
    const { id: _ignore, ...firestorePayload } = orderDoc;
    const docRef = await addDoc(fsCollection(db, 'orders'), firestorePayload);
    orderDoc.id = docRef.id;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Could not persist order to Firestore; persisting to local storage', err);
  }

  // Update in-memory and local cache
  const nextOrders = [orderDoc, ...cachedOrders.filter(o => o.id !== orderDoc.id)];
  notifySubscribers(nextOrders);
  return orderDoc;
};

export const updateOrderStatus = async (orderId: string, status: Order['status']) => {
  // Update local immediately
  const nextOrders = cachedOrders.map(o =>
    o.id === orderId ? { ...o, status, updatedAt: new Date() } : o
  );
  notifySubscribers(nextOrders);

  // Attempt Firestore update
  try {
    await updateDoc(doc(db, 'orders', orderId), { status, updatedAt: new Date() });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Could not update order status in Firestore', err);
  }
};

export const removeOrder = async (orderId: string) => {
  // Update local immediately
  const nextOrders = cachedOrders.filter(o => o.id !== orderId);
  notifySubscribers(nextOrders);

  // Attempt Firestore delete
  try {
    await deleteDoc(doc(db, 'orders', orderId));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Could not delete order in Firestore', err);
  }
};