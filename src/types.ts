export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  color: string;
  colors?: string[];
  description: string;
  mainImage?: string;
  imageUrl: string;
  images?: string[];
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  fabric?: string;
  fit?: string;
  gender?: string;
  occasion?: string;
  season?: string;
  pattern?: string;
  stretch?: string;
  sleeveType?: string;
  neckType?: string;
  careInstructions?: string;
  tags?: string[];
  frameShape?: string;
  material?: string;
  sku?: string;
  vendorId?: string;
  vendorName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  // Variants: each variant has a color, available sizes, and multiple images
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
  sizes?: string[];
  images: string[];
  stock?: number;
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
  vendorId?: string;
  vendorName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
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
