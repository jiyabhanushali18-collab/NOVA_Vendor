import {
  collection,
  getDocs,
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase';

export interface ProductDocument {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  originalPrice?: number;
  discountedPrice?: number;
  imageUrl: string;
  images?: string[];
  sizes: string[];
  vendorId: string;
  vendorName: string;
  stock: number;
  color: string;
  colors?: string[];
  description: string;
  frameShape?: string;
  material?: string;
  gender?: string;
  sku: string;
  variants?: unknown[];
  status?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ProductsSubscriber = (products: ProductDocument[]) => void;
export type ProductsErrorHandler = (error: Error) => void;

const productsCollection = () => collection(db, 'products');

const hiddenStatuses = new Set(['deleted', 'archived', 'inactive', 'disabled']);

const productIsVisible = (product: ProductDocument) => {
  const status = product.status?.trim().toLowerCase();
  return !status || !hiddenStatuses.has(status);
};

const readTimestampMs = (value: unknown) => {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  return 0;
};

const sortProductsByRecentUpdate = (products: ProductDocument[]) =>
  [...products].sort((a, b) => {
    const aTime = readTimestampMs(a.updatedAt) || readTimestampMs(a.createdAt);
    const bTime = readTimestampMs(b.updatedAt) || readTimestampMs(b.createdAt);
    return bTime - aTime;
  });

const readVisibleProducts = (docs: QueryDocumentSnapshot<DocumentData>[]) =>
  sortProductsByRecentUpdate(docs.map(mapProductDocument).filter(productIsVisible));

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const readNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const readSizes = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(size => String(size).trim())
    .filter(Boolean);
};

const readStrings = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,;|\n]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
};

const readImages = (...values: unknown[]) => {
  for (const value of values) {
    if (!Array.isArray(value)) {
      continue;
    }

    const images = value
      .map(item => String(item).trim())
      .filter(Boolean);

    if (images.length) {
      return images;
    }
  }

  return [];
};

const mapProductDocument = (snapshot: QueryDocumentSnapshot<DocumentData>): ProductDocument => {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    name: readString(data.name, data.productName, data.title),
    brand: readString(data.brand, data.companyName, data.vendorName),
    category: readString(data.category, data.productCategory, data.type),
    price: readNumber(data.price),
    originalPrice: data.originalPrice === undefined ? undefined : readNumber(data.originalPrice),
    discountedPrice: data.discountedPrice === undefined ? undefined : readNumber(data.discountedPrice),
    imageUrl: readString(data.imageUrl, data.image, data.photoUrl, data.thumbnailUrl),
    images: readImages(data.images, data.imageUrls, data.photos),
    sizes: readSizes(data.sizes),
    vendorId: readString(data.vendorId),
    vendorName: readString(data.vendorName),
    stock: readNumber(data.stock),
    color: readString(data.color, data.colour),
    colors: readStrings(data.colors),
    description: readString(data.description, data.details),
    frameShape: readString(data.frameShape) || undefined,
    material: readString(data.material) || undefined,
    gender: readString(data.gender) || undefined,
    sku: readString(data.sku, data.productId),
    variants: Array.isArray(data.variants) ? data.variants : undefined,
    status: readString(data.status) || undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
};

export const getProducts = async (): Promise<ProductDocument[]> => {
  const snapshot = await getDocs(productsCollection());
  return readVisibleProducts(snapshot.docs);
};

export const subscribeToProducts = (
  onProducts: ProductsSubscriber,
  onError?: ProductsErrorHandler
): Unsubscribe =>
  onSnapshot(
    productsCollection(),
    snapshot => {
      onProducts(readVisibleProducts(snapshot.docs));
    },
    error => {
      onError?.(error);
    }
  );
