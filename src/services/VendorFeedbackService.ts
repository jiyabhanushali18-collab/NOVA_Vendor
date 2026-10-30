import { collection, onSnapshot, query, where, type DocumentData, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Product } from '../types';

export interface VendorTryOnFeedback {
  id: string;
  productId: string;
  productName: string;
  rating: number;
  comment: string;
  customerName: string;
  color: string;
  createdAt: Date | null;
}

const readText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

const readDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  return null;
};

const normalizeFeedback = (
  data: DocumentData,
  id: string,
  vendorId: string,
  productsById: Map<string, Product>
): VendorTryOnFeedback | null => {
  const productId = readText(data.productId, data.productID, data.product_id);
  const product = productsById.get(productId);
  const reviewVendorId = readText(data.vendorId, data.vendorID);
  const isTryOnFeedback = data.arTryOn === true || data.arRating !== undefined || data.source === 'tryon';
  const ratingValue = data.arRating ?? data.rating ?? data.stars;
  const rating = typeof ratingValue === 'number' ? ratingValue : Number(ratingValue);

  if (
    (!product && reviewVendorId !== vendorId)
    || (reviewVendorId && vendorId && reviewVendorId !== vendorId)
    || !isTryOnFeedback
    || !Number.isInteger(rating)
    || rating < 1
    || rating > 5
  ) {
    return null;
  }

  return {
    id,
    productId,
    productName: product?.name || readText(data.productName, data.product),
    rating,
    comment: readText(data.comment, data.feedback, data.review, data.text),
    customerName: readText(data.customerName, data.userName, data.author, data.displayName, data.name) || 'NOVA customer',
    color: readText(data.color, data.variantColor),
    createdAt: readDate(data.createdAt ?? data.timestamp)
  };
};

export const subscribeToVendorTryOnFeedback = (
  vendorId: string,
  products: Product[],
  onFeedback: (feedback: VendorTryOnFeedback[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const productsById = new Map(
    products
      .filter(product => product.vendorId === vendorId)
      .map(product => [product.id, product])
  );

  if (!vendorId) {
    onFeedback([]);
    return () => {};
  }

  const snapshots = new Map<string, Map<string, VendorTryOnFeedback>>();
  const publish = () => {
    const unique = new Map<string, VendorTryOnFeedback>();
    snapshots.forEach(items => items.forEach((item, id) => unique.set(id, item)));
    const feedback = Array.from(unique.values())
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    onFeedback(feedback);
  };
  const handleSnapshot = (source: string) => (snapshot: any) => {
    const items = new Map<string, VendorTryOnFeedback>();
    snapshot.docs.forEach((reviewDoc: any) => {
      const review = normalizeFeedback(reviewDoc.data(), reviewDoc.id, vendorId, productsById);
      if (review) items.set(review.id, review);
    });
    snapshots.set(source, items);
    publish();
  };
  const handleError = (error: Error) => onError(error);
  const liveUnsubscribe = onSnapshot(
    query(collection(db, 'reviews'), where('vendorId', '==', vendorId)),
    handleSnapshot('reviews'),
    handleError
  );
  const legacyUnsubscribe = onSnapshot(
    query(collection(db, 'product_reviews'), where('vendorId', '==', vendorId)),
    handleSnapshot('product_reviews'),
    handleError
  );

  return () => {
    liveUnsubscribe();
    legacyUnsubscribe();
  };
};
