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
  mainImage?: string;
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
  variants?: ProductVariantDocument[];
  status?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProductVariantDocument {
  color: string;
  images: string[];
  stock?: number;
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

const readImageStrings = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap(item => {
      if (typeof item === 'string') {
        return [item.trim()];
      }

      if (item && typeof item === 'object') {
        return [readString(
          (item as any).url,
          (item as any).src,
          (item as any).path,
          (item as any).image,
          (item as any).imageUrl,
          (item as any).photo
        )];
      }

      return [];
    })
    .filter(Boolean);
};

const readVariants = (value: unknown): ProductVariantDocument[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const variants = value.flatMap(variant => {
    if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
      return [];
    }

    const data = variant as any;
    const color = readString(data.color, data.colour, data.name);
    const images = readImageStrings(data.images)
      .concat(readImageStrings(data.imageUrls))
      .concat(readImageStrings(data.photos))
      .concat(readImageStrings(data.media));
    const singleImage = readString(data.image, data.imageUrl, data.photo, data.thumbnail, data.src);
    const stock = data.stock === undefined ? undefined : readNumber(data.stock);
    const normalizedImages = Array.from(new Set([
      ...images,
      singleImage
    ].filter(Boolean)));

    if (!color && normalizedImages.length === 0) {
      return [];
    }

    return [{
      color: color || 'Default',
      images: normalizedImages,
      stock
    }];
  });

  return variants.length ? variants : undefined;
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
    mainImage: readString(data.mainImage, data.imageUrl, data.image, data.photoUrl, data.thumbnailUrl),
    imageUrl: readString(data.imageUrl, data.mainImage, data.image, data.photoUrl, data.thumbnailUrl),
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
    variants: readVariants(data.variants),
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
