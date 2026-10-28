import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  where
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { Order, OrderLineItem } from '../types';

export interface OrderDocument extends Order {
  vendorId?: string;
  vendorName?: string;
  vendorIds?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
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

const readOrderItems = (data: DocumentData): OrderLineItem[] => {
  const rawItems = [data.items, data.orderItems, data.cartItems, data.products]
    .find(value => Array.isArray(value) && value.length > 0) as unknown[] | undefined;

  if (!rawItems) return [];

  return rawItems.flatMap(rawItem => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) return [];

    const item = rawItem as DocumentData;
    const product = item.product && typeof item.product === 'object'
      ? item.product as DocumentData
      : {};
    const quantity = readNumber(item.quantity || item.qty || item.count) || 1;
    const productName = readString(
      item.productName,
      item.name,
      item.title,
      item.productTitle,
      product.name,
      product.title
    );
    if (!productName) return [];

    const price = readNumber(item.price, item.unitPrice, item.sellingPrice, product.price);
    const amount = readNumber(item.amount, item.total, item.totalPrice, item.subtotal)
      || price * quantity;

    return [{
      productId: readString(item.productId, item.id, product.id) || undefined,
      vendorId: readString(item.vendorId, product.vendorId) || undefined,
      productName,
      quantity,
      amount,
      status: ['Pending', 'Shipped', 'Delivered', 'Cancelled'].includes(item.status)
        ? item.status
        : undefined
    }];
  });
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
  const items = readOrderItems(data);
  const firstItem = items[0];
  const customerName = readString(data.customerName, data.customer?.name, data.buyerName, data.userName) || 'Customer';
  const productName = readString(
    data.productName,
    data.product?.name,
    data.productTitle,
    data.itemName,
    firstItem?.productName
  ) || (items.length > 1 ? `${items.length} products` : 'Product');
  const quantity = readNumber(data.quantity || data.qty) || (
    items.length ? items.reduce((sum, item) => sum + item.quantity, 0) : 1
  );
  const totalAmount = readNumber(data.amount, data.total, data.totalAmount, data.totalPrice);
  const amount = totalAmount
    || readNumber(data.price) * quantity
    || items.reduce((sum, item) => sum + item.amount, 0);
  const product = data.product && typeof data.product === 'object'
    ? data.product as DocumentData
    : {};

  return {
    id: snapshot.id,
    customerName,
    customerInitials: readString(data.customerInitials) || customerName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
    customerAvatar: readString(data.customerAvatar, data.customer?.avatar, data.userAvatar) || undefined,
    productName,
    productId: readString(data.productId, data.product?.id, firstItem?.productId) || undefined,
    quantity,
    amount,
    items: items.length ? items : undefined,
    date: readDate(data.date, data.createdAt, data.orderDate, data.timestamp),
    status: ['Shipped', 'Delivered', 'Cancelled'].includes(data.status)
      ? data.status
      : ['Shipped', 'Delivered', 'Cancelled'].includes(data.orderStatus)
        ? data.orderStatus
        : 'Pending',
    vendorId: readString(data.vendorId, data.vendor?.id, product.vendorId) || undefined,
    vendorName: readString(data.vendorName, data.vendor?.name, product.vendorName) || undefined,
    vendorIds: Array.isArray(data.vendorIds)
      ? data.vendorIds.filter((value: unknown): value is string => typeof value === 'string')
      : undefined,
    salesEligible: data.salesEligible === true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  } as OrderDocument;
};

export const subscribeToOrders = (
  vendorId: string,
  onOrders: (orders: OrderDocument[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const emitScopedOrders = (orders: OrderDocument[]) => {
    const scopedOrders = orders.flatMap(order => {
      const vendorItems = order.items?.filter(item => item.vendorId === vendorId) || [];
      if (vendorItems.length) {
        return [{
          ...order,
          vendorId,
          items: vendorItems,
          productName: vendorItems.length === 1 ? vendorItems[0].productName : `${vendorItems.length} products`,
          quantity: vendorItems.reduce((sum, item) => sum + item.quantity, 0),
          amount: vendorItems.reduce((sum, item) => sum + item.amount, 0),
          status: vendorItems[0].status || order.status
        }];
      }
      if (order.vendorId === vendorId || order.vendorIds?.includes(vendorId)) {
        return [order];
      }
      return [];
    });
    onOrders(scopedOrders);
  };
  activeSubscribers.add(emitScopedOrders);

  // Immediately emit current cached orders
  if (cachedOrders.length > 0) {
    emitScopedOrders(cachedOrders);
  }

  const firestoreUnsubscribes: Unsubscribe[] = [];
  const queryOrders = new Map<string, Map<string, OrderDocument>>();
  const emitMergedOrders = () => {
    const merged = new Map<string, OrderDocument>();
    queryOrders.forEach(orders => orders.forEach((order, id) => merged.set(id, order)));
    cachedOrders.forEach(order => {
      if (!merged.has(order.id)) merged.set(order.id, order);
    });
    emitScopedOrders(Array.from(merged.values()).sort(
      (a, b) => readTimestampMs(b.updatedAt || b.createdAt) - readTimestampMs(a.updatedAt || a.createdAt)
    ));
  };

  try {
    const subscribeToQuery = (queryKey: string, ordersQuery: ReturnType<typeof query>) => {
      const unsubscribe = onSnapshot(
        ordersQuery,
        snapshot => {
          queryOrders.set(queryKey, new Map(snapshot.docs.map(document => {
            const order = mapOrderDocument(document);
            return [order.id, order];
          })));
          emitMergedOrders();
        },
        error => {
          onError?.(new Error(`Failed to load ${queryKey} orders: ${error.message}`));
          emitMergedOrders();
        }
      );
      firestoreUnsubscribes.push(unsubscribe);
    };

    subscribeToQuery('single-vendor', query(collection(db, 'orders'), where('vendorId', '==', vendorId)));
    subscribeToQuery('vendor-feed', query(collection(db, 'vendorOrders', vendorId, 'orders')));
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    onError?.(error);
    emitMergedOrders();
  }

  return () => {
    activeSubscribers.delete(emitScopedOrders);
    firestoreUnsubscribes.forEach(unsubscribe => unsubscribe());
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
  const updateStatus = httpsCallable<
    { orderId: string; status: Order['status'] },
    { updated: boolean }
  >(getFunctions(undefined, 'us-central1'), 'updateVendorOrderStatus');
  await updateStatus({ orderId, status });
};

export const removeOrder = async (orderId: string) => {
  await deleteDoc(doc(db, 'orders', orderId));
  notifySubscribers(cachedOrders.filter(order => order.id !== orderId));
};