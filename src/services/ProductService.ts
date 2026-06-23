import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
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
  sizes: string[];
  vendorId: string;
  vendorName: string;
  stock: number;
  color: string;
  description: string;
  frameShape?: string;
  material?: string;
  gender?: string;
  sku: string;
  variants?: unknown[];
  status: 'active';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ProductsSubscriber = (products: ProductDocument[]) => void;
export type ProductsErrorHandler = (error: Error) => void;

const productsQuery = () =>
  query(
    collection(db, 'products'),
    where('status', '==', 'active'),
    orderBy('updatedAt', 'desc')
  );

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
    sizes: readSizes(data.sizes),
    vendorId: readString(data.vendorId),
    vendorName: readString(data.vendorName),
    stock: readNumber(data.stock),
    color: readString(data.color, data.colour),
    description: readString(data.description, data.details),
    frameShape: readString(data.frameShape) || undefined,
    material: readString(data.material) || undefined,
    gender: readString(data.gender) || undefined,
    sku: readString(data.sku, data.productId),
    variants: Array.isArray(data.variants) ? data.variants : undefined,
    status: 'active',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
};

export const getProducts = async (): Promise<ProductDocument[]> => {
  const snapshot = await getDocs(productsQuery());
  return snapshot.docs.map(mapProductDocument);
};

export const subscribeToProducts = (
  onProducts: ProductsSubscriber,
  onError?: ProductsErrorHandler
): Unsubscribe =>
  onSnapshot(
    productsQuery(),
    snapshot => {
      onProducts(snapshot.docs.map(mapProductDocument));
    },
    error => {
      onError?.(error);
    }
  );
