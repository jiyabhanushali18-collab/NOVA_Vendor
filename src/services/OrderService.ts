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
): Unsubscribe => onSnapshot(
  collection(db, 'orders'),
  snapshot => {
    const orders = snapshot.docs
      .map(mapOrderDocument)
      .sort((a, b) => readTimestampMs(b.updatedAt || b.createdAt) - readTimestampMs(a.updatedAt || a.createdAt));
    onOrders(orders);
  },
  error => onError?.(error)
);

export const updateOrderStatus = (orderId: string, status: Order['status']) =>
  updateDoc(doc(db, 'orders', orderId), { status, updatedAt: new Date() });

export const removeOrder = (orderId: string) => deleteDoc(doc(db, 'orders', orderId));