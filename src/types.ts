export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  color: string;
  description: string;
  imageUrl: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  frameShape?: string;
  material?: string;
  gender?: string;
  sku?: string;
  vendorId?: string;
  vendorName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  // Variants: each variant has a color and multiple images (at least one)
  variants?: ProductVariant[];
  // Optional pricing: original was MRP, discounted is current sale price
  originalPrice?: number;
  discountedPrice?: number;
  rating?: number;
  ratingCount?: number;
  arTryOnRating?: number;
  arTryOnRatingCount?: number;
  reviews?: ProductReview[];
}

export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ProductVariant {
  id?: string;
  color: string;
  images: string[]; // image URLs or local object URLs for previews
}

export interface Order {
  id: string;
  customerName: string;
  customerInitials?: string;
  customerAvatar?: string;
  productName: string;
  quantity: number;
  amount: number;
  date: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
}

export interface Activity {
  id: string;
  type: 'order' | 'inventory' | 'stock_alert' | 'verification';
  title: string;
  description: string;
  time: string;
}

export interface ProfileInfo {
  storeName: string;
  companyName?: string;
  vendorId?: string;
  ownerName: string;
  gstNumber: string;
  contactDetails: string;
  businessAddress: string;
  logoUrl: string;
  status: string;
  memberSince: string;
}
